/* Contrato de animación y FOW de NPCs y jugadores remotos. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const actors=require('./fh-actor-presentation.js');

test('player/NPC: idle y walk se alternan cada 0.5 s de movimiento real',()=>{
 for(const kind of ['player','npc']){
  const cycle=actors.createCycle();
  assert.equal(cycle.tick(false,.7),'idle',kind);
  assert.equal(cycle.tick(true,.01),'walk',kind);
  assert.equal(cycle.tick(true,.49),'walk',kind);
  assert.equal(cycle.tick(true,.02),'idle',kind);
  assert.equal(cycle.tick(true,.5),'walk',kind);
  assert.equal(cycle.tick(false,4),'idle',kind);
  assert.equal(cycle.tick(true,0),'walk',kind+' reinicia al volver a caminar');
 }
 assert.equal(actors.WALK_INTERVAL_SECONDS,.5);
});

test('campo visual: otros personajes necesitan mismo piso y línea de visión; el jugador local es independiente',()=>{
 const seen=(x,z)=>x===2&&z===3;
 assert.equal(actors.visibleOtherActor(0,0,2,3,seen),true);
 assert.equal(actors.visibleOtherActor(0,0,4,3,seen),false);
 assert.equal(actors.visibleOtherActor(1,0,2,3,seen),false);
 assert.equal(actors.visibleOtherActor(0,0,2,3,()=>false),false);
 assert.equal(actors.visibleOtherActor(0,0,NaN,3,seen),false);
 assert.equal(actors.visibleOtherActor(0,0,2,3,null),false);
});

test('adapter 3D aplica FOW también al repartidor y expone registro para jugadores remotos',()=>{
 const root=path.resolve(__dirname,'../..'),index=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const ctx={window:{}};
 for(let i=0;i<=12;i++){
  const code=fs.readFileSync(path.join(__dirname,'engine-'+String(i).padStart(2,'0')+'.js'),'utf8');
  vm.runInNewContext(code,ctx,{timeout:5000});
 }
 const engine=Buffer.from(ctx.window.__FOREST_EMBEDDED_ENGINE__,'base64').toString('utf8');
 const start=index.indexOf('function addLiveTextToEngine(doc){');
 const end=index.indexOf('let fhCharacterLaunchPending',start);
 assert.ok(start>=0&&end>start,'adaptadores localizados');
 const env={URL,document:{baseURI:'https://example.test/'},window:{},ENGINE_SOURCE:engine};
 vm.runInNewContext(index.slice(start,end)+'\nvar PATCHED=prepareGLBEngineDoc(ENGINE_SOURCE);',env,{timeout:20000});
 const result=env.PATCHED;
 assert.match(result,/window\.FHActorVisibility=Object\.freeze/);
 assert.match(result,/fhRegisterVisibleActor\(fhDeliveryNpc/);
 assert.match(result,/fhRegisterVisibleActor\(sprite/);
 assert.match(result,/fhRefreshActorVisibility\(\);\s*if\(peeking\)/);
 assert.match(result,/const poseIdle=fhPlayerWalkCycle\.tick\(user\.walking,dt\)==='idle'/);
 assert.match(result,/fhNpcWalkCycle\.tick\(true,dt\)/);
 assert.match(result,/let fhActorSightSnapshot=null/);
 assert.match(result,/fhActorSightSnapshot=\{at,opaque,params\}/);
 assert.match(result,/litPointVisible\(x,z,at,opaque,params\)/);
 assert.match(result,/fh-actor-presentation\.js/);
 assert.match(result,/hero\.visible=shadow\.visible=!GameState\.hidden/);
 const body=result.match(/<script>([\s\S]*?)<\/script>/g)||[];
 for(const script of body){
  const js=script.replace(/^<script>/,'').replace(/<\/script>$/,'');
  if(js.trim())assert.doesNotThrow(()=>new vm.Script(js));
 }
});
