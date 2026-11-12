/* Ejecutar: node --test juego/assets/fh-barriers.test.js */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const B=require('./fh-barriers.js');
const rail={id:'rail-1',type:'fence',barrierKind:'railing',a:{x:2,y:3},b:{x:4,y:3},heightFt:3.5};
const mesh={...rail,id:'mesh-1',barrierKind:'mesh',heightFt:6};
const old={...rail,id:'old',barrierKind:undefined,heightFt:4};

test('el mapa v1 mantiene rejas antiguas y distingue dos variantes',()=>{
 assert.equal(B.isBarrier(old),false);
 assert.equal(B.isBarrier({...rail,barrierKind:'invalid'}),false);
 assert.equal(B.isBarrier({...rail,type:'red_wall'}),false);
 assert.equal(B.isBarrier(rail),true);
 assert.equal(B.isBarrier(mesh),true);
 assert.equal(B.heightFt(rail),3.5);
 assert.equal(B.heightFt(mesh),6);
 assert.equal(B.heightFt({...mesh,heightFt:8}),8);
 assert.equal(B.heightFt({...mesh,heightFt:NaN}),6);
});

test('cruzar una barandilla sólo cerca del tramo y deja al jugador en el otro lado',()=>{
 const c=B.crossing(rail,3*1.524,3*1.524+.38,1.524);
 assert.ok(c);
 assert.equal(c.action,'jump');
 assert.ok(c.goal.z<3*1.524);
 assert.ok(c.seconds>0&&c.lift>0);
 assert.equal(B.crossing(rail,3*1.524,3*1.524+1.2,1.524),null);
 assert.equal(B.crossing(rail,5*1.524,3*1.524+.38,1.524),null);
});

test('la malla exige escalada y funciona desde ambos lados',()=>{
 const above=B.crossing(mesh,3*1.524,3*1.524+.35,1.524);
 const below=B.crossing(mesh,3*1.524,3*1.524-.35,1.524);
 assert.equal(above.action,'climb');
 assert.equal(below.action,'climb');
 assert.ok(above.goal.z<3*1.524&&below.goal.z>3*1.524);
 assert.ok(above.seconds>B.crossing(rail,3*1.524,3*1.524+.35,1.524).seconds);
 assert.equal(B.nearest([old,rail,mesh],3*1.524,3*1.524+.35,1.524).item.id,'rail-1');
});

test('segmentos degenerados y coordenadas inválidas no producen acciones',()=>{
 assert.equal(B.crossing({...rail,b:{x:2,y:3}},3,3,1.524),null);
 assert.equal(B.crossing(rail,NaN,3,1.524),null);
 assert.equal(B.crossing(rail,3,3,0),null);
 assert.equal(B.crossing(old,3,3,1.524),null);
});

function embeddedEngine(){
 const root=path.resolve(__dirname,'..','..');
 const sandbox={window:{}};vm.createContext(sandbox);
 for(let i=0;i<=12;i++){
  const file=path.join(root,'juego','assets','engine-'+String(i).padStart(2,'0')+'.js');
  vm.runInContext(fs.readFileSync(file,'utf8'),sandbox,{filename:file});
 }
 return Buffer.from(sandbox.window.__FOREST_EMBEDDED_ENGINE__,'base64').toString('utf8');
}
function barrierHook(){
 const script=fs.readFileSync(path.join(__dirname,'fh-barriers-engine-hook.js'),'utf8');
 const hookContext={
  window:{},URL,document:{baseURI:'https://example.test/',currentScript:{src:'https://example.test/juego/assets/fh-barriers-engine-hook.js'}}
 };
 vm.runInNewContext(script,hookContext);
 return hookContext.window.FHBarriersEngine;
}

test('el adaptador 3D reconoce el motor Base64 real, sin regenerarlo',()=>{
 const html=embeddedEngine();
 const adapted=barrierHook().patch(html);
 assert.ok(adapted.length>html.length);
 assert.match(adapted,/fhBarrierId:it\.id/);
 assert.match(adapted,/function fhBarrierAdvance\(dt\)/);
 assert.match(adapted,/if\(!fhBarrierAdvance\(dt\)\)moveUpdate\(dt\)/);
 assert.match(adapted,/hero\.position\.set\(user\.x,visualBase\+travelRise\+fhBarrierLift/);
 assert.match(adapted,/if\(it\.type==='fence'&&!window\.FHBarriers\.isBarrier\(it\)\)/);
 assert.match(adapted,/FH_BARRIER_TEXT\.climb/);
 assert.match(adapted,/fh-barriers\.js/);
 assert.match(adapted,/fh-barriers-strings\.js/);
});

test('barreras se integran después de preparar el motor y conservan los bloqueos de interacción',()=>{
 const entry=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 const document={baseURI:'https://example.test/Blakpine-Wood/'};
 const window={document};
 for(const file of ['fh-roof-engine-hook.js','fh-comic-action-engine-hook.js',
  'fh-context-engine-hook.js','fh-services-engine-hook.js','fh-architecture-skins.js',
  'fh-structure-engine-hook.js']){
  document.currentScript={src:new URL('juego/assets/'+file,document.baseURI).href};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,file),'utf8'),{window,document,URL});
 }
 const sharedStart=entry.indexOf('const ForestShared=(()=>{');
 const sharedEnd=entry.indexOf("\n'use strict';",sharedStart);
 const start=entry.indexOf('function addLiveTextToEngine(doc){');
 const end=entry.indexOf('let fhCharacterLaunchPending=false;',start);
 assert.ok(sharedStart>=0&&sharedEnd>sharedStart&&start>=0&&end>start);
 const prepare=new Function('window','document','URL',
  entry.slice(sharedStart,sharedEnd)+entry.slice(start,end)+';return prepareGLBEngineDoc;')(window,document,URL);
 let prepared=prepare(embeddedEngine());
 prepared=window.FHServicesEngine.patch(prepared);
 prepared=window.FHArchitectureSkins.patchEngineDoc(prepared);
 prepared=window.FHStructureHealthEngine.patch(prepared);
 const adapted=barrierHook().patch(prepared);
 assert.match(adapted,/function toggleDoor\(\)\{if\(fhBarrierTravel\)return;if\(window\.FHStorageRuntime\?\.isOpen\)return;if\(peeking\|\|fhDeliveryUiActive\|\|stairTravel\|\|breakerPanelItem\)return;/);
 const movement='if(!fhDeliveryUiActive&&!window.FHStorageRuntime?.isOpen){if(!fhBarrierAdvance(dt))moveUpdate(dt);}else{user.vx=user.vz=0;}';
 assert.ok(adapted.includes(movement),'el movimiento permanece dentro del bloqueo de entregas/almacenamiento');
 const scripts=[...adapted.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match=>match[1]).filter(Boolean);
 assert.ok(scripts.length>0);
 for(const script of scripts)assert.doesNotThrow(()=>new Function(script));

 // Ejecutar el tramo real del fotograma comprueba la asociación del else.
 for(const delivery of [false,true])for(const storage of [false,true])for(const traveling of [false,true]){
  let advances=0,moves=0;
  const state={vx:1,vz:1};
  new Function('window','fhDeliveryUiActive','fhBarrierAdvance','moveUpdate','user','dt',movement)(
   {FHStorageRuntime:{isOpen:storage}},delivery,()=>{advances++;return traveling;},()=>moves++,state,.016);
  const blocked=delivery||storage;
  assert.equal(advances,blocked?0:1);
  assert.equal(moves,!blocked&&!traveling?1:0);
  assert.equal(state.vx,blocked?0:1);
  assert.equal(state.vz,blocked?0:1);
 }
});

test('editor y detección de recintos usan sólo fence + campo opcional',()=>{
 const html=fs.readFileSync(path.resolve(__dirname,'..','..','index.html'),'utf8');
 const editor=fs.readFileSync(path.join(__dirname,'fh-barriers-editor.js'),'utf8');
 assert.match(editor,/originalCreate\('fence',a,b\)/);
 assert.match(editor,/barrierKind=kind/);
 assert.match(html,/it\.type==='fence'&&it\.barrierKind/);
 assert.match(html,/kind==='fence'&&it\.barrierKind/);
 assert.match(html,/FHBarriersEngine\.patch\(architectureDoc\)/);
 assert.match(html,/fh-barriers-editor\.js/);
});
