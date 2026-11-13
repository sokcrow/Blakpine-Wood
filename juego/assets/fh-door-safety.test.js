'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const editor=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const sharedStart=editor.indexOf('const ForestShared=(()=>{');
const sharedEnd=editor.indexOf("\n'use strict';",sharedStart);
const shared=vm.runInNewContext(editor.slice(sharedStart,sharedEnd)+'\nForestShared');
const chunks={window:{}};
for(let i=0;i<=12;i++)vm.runInNewContext(fs.readFileSync(path.join(__dirname,`engine-${String(i).padStart(2,'0')}.js`),'utf8'),chunks);
const base=Buffer.from(chunks.window.__FOREST_EMBEDDED_ENGINE__,'base64').toString('utf8');
const adapter=editor.slice(editor.indexOf('function addDoorSafetyToEngine(doc){'),editor.indexOf('function addPreviewReturnToSpawnpoint(doc){'));
const patch=vm.runInNewContext(adapter+'\naddDoorSafetyToEngine',{ForestShared:shared});
const engine=patch(base);
const runtimeSharedStart=engine.indexOf('const ForestShared=(()=>{');
const runtimeSharedEnd=engine.indexOf("})();",runtimeSharedStart)+5;
const runtimeShared=vm.runInNewContext(engine.slice(runtimeSharedStart,runtimeSharedEnd)+'\nForestShared');
function scene(door,point){
 const d={id:'door',f:0,open:true,locked:false,block:{x1:3,z1:2,x2:3,z2:4},...door};
 const notices=[],saved=[];
 const c={ForestShared:runtimeShared,user:{x:point.x,z:point.y},PLAYER_RADIUS:.22,currentFloor:0,
  window:{FH_PREVIEW_TEXT:{doorOccupied:'umbral'}},notice:s=>notices.push(s),
  peeking:false,stairTravel:false,breakerPanelItem:null,playerPose:{occupied:false},
  occupiedShaft:()=>null,useTarget:()=>({kind:'door',target:d}),
  GameState:{flags:{}},rememberDoor:door=>saved.push({...door}),visibilityDirty:false,roomLightsDirty:false,
  doorList:[[d]],GameEvents:{on:(name,fn)=>{if(name==='door:toggle')c.event=fn}}
 };
 const helper=engine.slice(engine.indexOf('function doorCloseOccupied(d){'),engine.indexOf('function doorModel(f,it){'));
 const toggle=engine.slice(engine.indexOf('function toggleDoor(){'),engine.indexOf('function peephole(){'));
 const event=engine.slice(engine.indexOf("GameEvents.on('door:toggle'"),engine.indexOf("GameEvents.on('flag:changed'"));
 vm.runInNewContext(helper+toggle+event+'\nvar toggle=toggleDoor;',c);
 return {d,c,notices,saved};
}
test('2D y 3D comparten el volumen de colisión del umbral en ambos lados y extremos',()=>{
 const doors=[{a:{x:3,y:2},b:{x:3,y:4}},{a:{x:2,y:3},b:{x:4,y:3}},{a:{x:2,y:2},b:{x:4,y:4}}];
 for(const geometry of doors)for(const delta of [-.1,0,.1]){
  const x=(geometry.a.x+geometry.b.x)/2+delta,y=(geometry.a.y+geometry.b.y)/2;
  for(const api of [shared,runtimeShared]){
   assert.equal(api.doorOccupiesPoint(x,y,geometry,.22,.038),true);
   assert.equal(api.solidAt(x,y,{width:10,height:10,radius:.22,doors:[{...geometry,open:false}],doorPad:.038}),true);
   assert.equal(api.doorOccupiesPoint(geometry.a.x,geometry.a.y,geometry,.22,.038),true);
   assert.equal(api.doorOccupiesPoint(8,8,geometry,.22,.038),false);
  }
 }
});
test('el cierre manual y por evento conserva la puerta abierta, sin guardar ni mover al jugador',()=>{
 for(const kind of ['single','double','garage'])for(const side of [-.25,0,.25])for(const source of ['toggle','event']){
  const s=scene({family:kind},{x:3+side,y:3}),before={...s.c.user};
  source==='toggle'?s.c.toggle():s.c.event({id:s.d.id});
  assert.equal(s.d.open,true);
  assert.equal(s.saved.length,0);
  assert.deepEqual(s.c.user,before);
  assert.deepEqual(s.notices,['umbral']);
  assert.equal(runtimeShared.solidAt(before.x,before.z,{width:10,height:10,radius:.22,doors:[s.d],doorPad:.038}),false);
 }
});
test('al salir del umbral se puede cerrar desde ambos lados y volver a abrir',()=>{
 for(const side of [-.4,.4]){
  const s=scene({}, {x:3+side,y:3});s.c.toggle();
  assert.equal(s.d.open,false);assert.equal(s.d.target,0);assert.equal(s.saved.length,1);
  s.c.toggle();assert.equal(s.d.open,true);assert.equal(s.saved.length,2);
 }
});
test('los eventos en otro piso conservan el cierre normal',()=>{
 const s=scene({f:1},{x:3,y:3});s.c.event({id:s.d.id});assert.equal(s.d.open,false);
});
test('la prueba 2D rechaza el cierre dentro del umbral y lo permite al apartarse',()=>{
 const it={id:'d',type:'door',a:{x:3,y:2},b:{x:3,y:4}};
 const tip={textContent:''};const state={running:true,near:it,x:3,y:3,doors:new Map([['d',true]])};
 const c={playState:state,PLAY_DOORS:new Set(['door']),ForestShared:shared,
  playDoorOpen:it=>state.doors.get(it.id),playUpdateNearby:()=>{},
  window:{FH_PREVIEW_TEXT:{doorOccupied:'umbral'}},document:{querySelector:()=>tip}};
 vm.runInNewContext(editor.slice(editor.indexOf('function playAction(){'),editor.indexOf('function playTryMove('))+'\nvar act=playAction;',c);
 c.act();assert.equal(state.doors.get('d'),true);assert.equal(tip.textContent,'umbral');
 state.x=3.4;c.act();assert.equal(state.doors.get('d'),false);
});
test('el adaptador exige anclajes únicos y produce JavaScript válido',()=>{
 assert.throws(()=>patch(''),/Hook cierre seguro incompatible/);
 assert.doesNotThrow(()=>new vm.Script(engine.slice(engine.lastIndexOf('<script>')+8,engine.lastIndexOf('</script>'))));
});
