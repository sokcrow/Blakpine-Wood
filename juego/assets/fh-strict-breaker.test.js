'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Services=require('./fh-services-core.js');

const editor=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const start=editor.indexOf('const ForestShared=(()=>{');
const end=editor.indexOf("\n'use strict';",start);
const context=vm.createContext({window:{},console});
vm.runInContext(editor.slice(start,end)+'\nglobalThis.shared=ForestShared;',context);
const shared=context.shared;
global.window=global;
require('./fh-lights.js');
const Lights=global.FHLights;

function prepareEngine(){
 const document={baseURI:'https://example.test/',currentScript:null};
 const window={document,__FOREST_EMBEDDED_ENGINE__:''};
 const ctx=vm.createContext({window,document,URL,console});
 vm.runInContext(editor.slice(start,end),ctx);
 for(let i=0;i<=12;i++){
  vm.runInContext(fs.readFileSync(path.join(__dirname,'engine-'+String(i).padStart(2,'0')+'.js'),'utf8'),ctx);
 }
 for(const file of ['fh-architecture-skins.js','fh-comic-action-engine-hook.js','fh-context-engine-hook.js','fh-structure-engine-hook.js','fh-services-engine-hook.js']){
  document.currentScript={src:new URL('juego/assets/'+file,document.baseURI).href};
  vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),ctx);
 }
 const from=editor.indexOf('function addLiveTextToEngine(');
 const to=editor.indexOf('\nlet fhCharacterLaunchPending=false;',from);
 vm.runInContext(editor.slice(from,to),ctx);
 const original=Buffer.from(window.__FOREST_EMBEDDED_ENGINE__,'base64').toString('utf8');
 const prepared=ctx.prepareGLBEngineDoc(original);
 const patched=window.FHServicesEngine.patch(prepared);
 return {original,prepared,patched};
}
const engine=prepareEngine();
function factoryFrom(doc,window={}){
 const from=doc.indexOf('// shared/lighting.js'),to=doc.indexOf('// shared/breakers.js',from);
 assert.ok(from>=0&&to>from);
 return vm.runInNewContext('(()=>{'+doc.slice(from,to)+'\nreturn createLightingSystem;})()',{window});
}
const room={id:'room-a',roomId:'room-a',type:'room',zoneId:'a',x:0,y:0,w:8,h:8};
const lamp={id:'lamp-a',type:'light_fixture',roomId:'room-a',x:2,y:2};
const panel={id:'panel-a',type:'breaker_panel',powerScope:'zone',zoneId:'a',circuits:[{id:'a',zoneId:'a',powerScope:'zone',powerFlag:'circuit-a'}]};
const floor=items=>({id:'f0',items:[{id:'wall',type:'wall',a:{x:0,y:0},b:{x:10,y:0}},...items]});
function withWiring(create){
 return (floors,state={})=>{
  const runtime=Services.createRuntime({floors,units:{feetPerCell:5}},state);
  return create(floors,state,{fixturePowered:(f,it,zone)=>!!runtime.sourceFor(f,it,zone)});
 };
}
function hallway(){
 const room={id:'hall',roomId:'hall',type:'room',zoneId:'a',x:0,y:0,w:10,h:2};
 const lamps=[1,3,6,8].map((x,i)=>({id:'hall-lamp-'+i,type:'light_fixture',roomId:'hall',x,y:.5}));
 const panel={id:'hall-breaker',type:'breaker_panel',x:0,y:0,zoneId:'a',powerScope:'zone',circuits:[{zoneId:'a',rangeFt:60}]};
 const door={id:'hall-door',type:'door',a:{x:4,y:0},b:{x:5,y:0},open:false};
 const floors=[{id:'f0',items:[room,panel,...lamps,
  {id:'left',type:'wall',a:{x:0,y:0},b:{x:4,y:0}},door,
  {id:'right',type:'wall',a:{x:5,y:0},b:{x:10,y:0}}]}];
 return {floors,room,lamps,panel,door};
}

for(const [name,factory] of [
 ['compartido',shared.createLightingSystem],
 ['motor 3D preparado',factoryFrom(engine.prepared)],
 ['motor 3D con servicios',factoryFrom(engine.patched)]
]){
 const create=withWiring(factory);
 for(const failure of ['enabled','on','damage','powerFlag']){
  test(name+': el panel conectado debe estar disponible aunque otro panel sano comparta zona ('+failure+')',()=>{
   const room={id:'r',roomId:'r',type:'room',zoneId:'a',x:0,y:0,w:14,h:2};
   const lamp={id:'l',type:'light_fixture',roomId:'r',x:12,y:.2};
   const isolated={id:'isolated',type:'breaker_panel',x:0,y:0,powerScope:'zone',zoneId:'a',circuits:[{zoneId:'a',rangeFt:120}]};
   const nearby={id:'nearby',type:'breaker_panel',x:10,y:0,powerScope:'zone',zoneId:'a',powerFlag:'panel_nearby_on',circuits:[{zoneId:'a',rangeFt:120,powerFlag:'circuit_nearby_on'}]};
   const state={};
   if(failure==='enabled')nearby.enabled=false;
   if(failure==='on')nearby.on=false;
   if(failure==='damage')state.services={damage:{nearby:100}};
   if(failure==='powerFlag')state.flags={panel_nearby_on:false};
   const floors=[{id:'f0',items:[room,lamp,isolated,nearby,
    {id:'left',type:'wall',a:{x:0,y:0},b:{x:4,y:0}},
    {id:'right',type:'wall',a:{x:10,y:0},b:{x:14,y:0}}]}];
   const services=Services.createRuntime({floors,units:{feetPerCell:5}},state);
   assert.equal(services.sourceFor(0,lamp,'a'),null,'no usar el panel cercano que no está disponible');
   assert.equal(create(floors,state).fixtureLit(0,room,lamp),false);
   assert.equal(services.statusFor(0,lamp).power.powered,false);
   nearby.enabled=true;nearby.on=true;state.services.damage.nearby=0;
   state.flags.panel_nearby_on=true;
   assert.equal(services.sourceFor(0,lamp,'a').panel.id,nearby.id,'restaurar el panel devuelve la ruta sin reconstruir el grafo');
   assert.equal(create(floors,state).fixtureLit(0,room,lamp),true);
  });
 }
 test(name+': otro breaker sano sí puede alimentar la lámpara cuando su ruta llega hasta ella',()=>{
  const {floors,room,lamps,panel,door}=hallway();door.type='window';
  floors[0].items.push({id:'bad',type:'breaker_panel',x:1,y:0,enabled:false,zoneId:'a',powerScope:'zone',circuits:[{zoneId:'a',rangeFt:60}]});
  const services=Services.createRuntime({floors,units:{feetPerCell:5}},{});
  assert.equal(services.sourceFor(0,lamps[0],'a').panel.id,panel.id);
  assert.equal(create(floors,{}).fixtureLit(0,room,lamps[0]),true);
 });
 test(name+': la puerta secciona cuatro luces del mismo pasillo en dos con energía y dos sin ella',()=>{
  const {floors,room,lamps,door}=hallway();
  const lighting=create(floors,{});
  assert.deepEqual(lamps.map(l=>lighting.fixtureLit(0,room,l)),[true,true,false,false]);
  const services=Services.createRuntime({floors,units:{feetPerCell:5}},{});
  assert.deepEqual(lamps.map(l=>services.statusFor(0,l).power.powered),[true,true,false,false]);
  const entries=lamps.map(l=>({floor:0,room,lamp:l,x:l.x,z:l.y,radius:3}));
  assert.equal(Lights.sourcesNear(entries,lighting,0,0,0,100).length,2);
  door.open=true;
  assert.deepEqual(lamps.map(l=>create(floors,{}).fixtureLit(0,room,l)),[true,true,false,false]);
 });
 test(name+': otro breaker y su circuito devuelven energía sólo al tramo aislado',()=>{
  const {floors,room,lamps}=hallway();
  floors[0].items.push({id:'second-breaker',type:'breaker_panel',x:10,y:0,zoneId:'b',powerScope:'zone',circuits:[{zoneId:'b',rangeFt:60}]});
  const unassigned=create(floors,{});
  assert.equal(unassigned.fixtureLit(0,room,lamps[2]),false,'el segundo panel no conecta luces asignadas al primero');
  lamps[2].zoneId=lamps[3].zoneId='b';
  const state={},lighting=create(floors,state);
  assert.deepEqual(lamps.map(l=>lighting.fixtureLit(0,room,l)),[true,true,true,true]);
  state.flags['power_zone:b']=false;
  assert.deepEqual(lamps.map(l=>lighting.fixtureLit(0,room,l)),[true,true,false,false]);
 });
 test(name+': una ventana conserva las cuatro luces conectadas y se respeta el alcance',()=>{
  const {floors,room,lamps,panel,door}=hallway();door.type='window';
  assert.deepEqual(lamps.map(l=>create(floors,{}).fixtureLit(0,room,l)),[true,true,true,true]);
  panel.circuits[0].rangeFt=10;
  const lighting=create(floors,{});
  assert.deepEqual(lamps.map(l=>lighting.fixtureLit(0,room,l)),[true,false,false,false]);
 });
 test(name+': sin comprobación de cableado disponible, la lámpara queda apagada',()=>{
  const {floors,room,lamps}=hallway();
  assert.equal(factory(floors,{}).fixtureLit(0,room,lamps[0]),false);
 });
 test(name+': mapa antiguo sin breaker permanece apagado aunque las banderas estén en true',()=>{
  const state={flags:{power_global:true,'power_floor:f0':true,'power_zone:a':true}};
  const runtime=create([floor([room,lamp])],state);
  assert.equal(runtime.fixtureLit(0,room,lamp),false);
  assert.equal(runtime.roomLit(0,room),false);
  assert.equal(Lights.sourcesNear([{floor:0,room,lamp,x:2,z:2,radius:3}],runtime,0,2,2).length,0);
 });
 test(name+': un panel no conecta automáticamente luces sin asignación',()=>{
  const plain={...lamp,zoneId:''},unassigned={...room,zoneId:''};
  const legacyPanel={id:'legacy',type:'breaker_panel',powerScope:'floor'};
  const runtime=create([floor([unassigned,plain,legacyPanel])],{});
  assert.equal(runtime.fixtureLit(0,unassigned,plain),false);
  assert.equal(runtime.fixtureLit(0,{...unassigned,zoneId:'main'},plain),true);
 });
 test(name+': no inferir circuitos huérfanos del contenido del mapa',()=>{
  const legacyPanel={id:'legacy',type:'breaker_panel',zoneId:'b',powerScope:'zone'};
  const runtime=create([floor([room,lamp,legacyPanel])],{});
  assert.equal(runtime.fixtureLit(0,room,lamp),false);
  assert.equal(runtime.fixtureLit(0,room,{...lamp,zoneId:'b'}),true);
 });
 test(name+': heredar el circuito del cuarto y apagarlo mediante su breaker',()=>{
  const state={},runtime=create([floor([room,lamp,panel])],state);
  assert.equal(runtime.fixtureLit(0,room,lamp),true);
  assert.equal(runtime.roomLit(0,room),true);
  runtime.setBreakerPower(0,panel.circuits[0],false);
  assert.equal(runtime.fixtureLit(0,room,lamp),false);
  runtime.restoreBreaker(0,panel.circuits[0]);
  assert.equal(runtime.fixtureLit(0,room,lamp),true);
  state.flags['circuit-a']=false;
  assert.equal(runtime.fixtureLit(0,room,lamp),false);
 });
 test(name+': la asignación explícita de la lámpara prevalece y no cae al circuito del cuarto',()=>{
  const runtime=create([floor([room,lamp,panel])],{});
  assert.equal(runtime.fixtureLit(0,room,{...lamp,zoneId:'missing'}),false);
  assert.equal(runtime.fixtureLit(0,null,{...lamp,zoneId:'a'}),true);
 });
 test(name+': varios circuitos del mismo panel se controlan de forma independiente',()=>{
  const multi={...panel,circuits:[...panel.circuits,{id:'b',zoneId:'b',powerScope:'zone'}]};
  const state={},runtime=create([floor([room,lamp,multi])],state);
  runtime.setBreakerPower(0,multi.circuits[0],false);
  assert.equal(runtime.fixtureLit(0,room,lamp),false);
  assert.equal(runtime.fixtureLit(0,null,{...lamp,zoneId:'b'}),true);
  state.flags.power_global=false;
  assert.equal(runtime.fixtureLit(0,null,{...lamp,zoneId:'b'}),false);
 });
 test(name+': un breaker de otro piso no crea un cableado entre plantas',()=>{
  const floors=[floor([room,lamp]),{id:'f1',items:[panel]}];
  assert.equal(create(floors,{}).fixtureLit(0,room,lamp),false);
  floors[1].items=[{...panel,circuits:[{...panel.circuits[0],floorId:'f0'}]}];
  assert.equal(create(floors,{}).fixtureLit(0,room,lamp),false);
 });
 test(name+': flags de piso, panel, suministro y estados guardados se respetan',()=>{
  for(const state of [
   {flags:{'power_floor:f0':false}},
   {flags:{'panel-a':false}},
   {services:{contracts:{electricity:'suspended'}}},
   {services:{enabled:{'panel-a':false}}},
   {services:{enabled:{'power_zone:a':false}}},
   {services:{damage:{'panel-a':100}}}
  ])assert.equal(create([floor([room,lamp,panel])],structuredClone(state)).fixtureLit(0,room,lamp),false);
  const offPanel={...panel,powerFlag:'panel-on'};
  assert.equal(create([floor([room,lamp,offPanel])],{flags:{'panel-on':false}}).fixtureLit(0,room,lamp),false);
 });
 test(name+': el interruptor no genera energía y los cuartos vacíos no generan luz',()=>{
  const runtime=create([floor([room,lamp])],{});
  runtime.toggleRoom(0,room.roomId);
  assert.equal(runtime.toggleRoom(0,room.roomId).lit,false);
  assert.equal(runtime.fixtureLit(0,room,lamp),false);
  const empty=create([floor([room,panel])],{});
  assert.equal(empty.roomLit(0,room),false);
  assert.equal(empty.roomLit(0,null),false);
  assert.equal(empty.fixtureLit(0,room,null),false);
  const connected=create([floor([room,lamp,panel])],{});
  assert.equal(connected.toggleRoom(0,room.roomId).lit,false);
  assert.equal(connected.toggleRoom(0,room.roomId).lit,true);
 });
 test(name+': la linterna conserva encendido, consumo y recarga sin breaker',()=>{
  const runtime=create([floor([room,lamp])],{flashlight:{enabled:false,charge:50},inventory:['battery']});
  assert.equal(runtime.toggleFlashlight().enabled,true);
  runtime.tick(.1);
  assert.ok(runtime.state.charge<50);
  assert.equal(runtime.recharge('battery',[{id:'battery',kind:'consumable'}]).ok,true);
  assert.equal(runtime.range(0,room).beam,10.4);
  assert.equal(runtime.fixtureLit(0,room,lamp),false);
 });
}

test('la integración 3D aplica la fábrica compartida, conserva servicios y produce JS válido',()=>{
 assert.equal(factoryFrom(engine.prepared).toString(),shared.createLightingSystem.toString());
 assert.match(engine.prepared,/fixturePowered:\(floor,fixture,zone\)=>!!window.FHServicesRuntime\?\.sourceFor\(floor,fixture,zone\)/);
 assert.match(engine.patched,/fixture\?\.service\?\.requiresPower/,'se conserva el chequeo opt-in de suministro físico');
 const script=engine.patched.slice(engine.patched.lastIndexOf('<script>')+8,engine.patched.lastIndexOf('</script>'));
 assert.doesNotThrow(()=>new vm.Script(script));
 const create=withWiring(factoryFrom(engine.patched,{FHServicesRuntime:{statusFor:()=>({power:{powered:false}})}}));
 const physical={...lamp,service:{requiresPower:true}};
 assert.equal(create([floor([room,physical,panel])],{}).fixtureLit(0,room,physical),false);
 assert.equal(create([floor([room,lamp,panel])],{}).fixtureLit(0,room,lamp),true);
});
test('las lámparas con requiresPower reciben su circuito sin ocupar un enchufe',()=>{
 const {floors,lamps}=hallway();lamps[0].service={requiresPower:true,watts:40};
 floors[0].items.push({id:'socket',type:'power_outlet',zoneId:'a',x:1,y:0,slots:2});
 const runtime=Services.createRuntime({floors,units:{feetPerCell:5}},{});
 assert.equal(runtime.statusFor(0,lamps[0]).power.via,'hall-breaker');
 assert.equal(runtime.statusFor(0,lamps[0]).power.powered,true);
 assert.equal(runtime.statusFor(0,floors[0].items.at(-1)).usedSlots,0);
});

test('fuentes dinámicas de batería no dependen de circuitos y el mapa no se reescribe',()=>{
 const floors=[floor([room,lamp])],before=JSON.stringify(floors),runtime=shared.createLightingSystem(floors,{});
 const id='strict-breaker-battery';
 try{
  Lights.setDynamicSource(id,{floor:0,x:0,z:0,radius:3});
  assert.equal(Lights.sourcesNear([],runtime,0,0,0).length,1);
 }finally{Lights.removeDynamicSource(id)}
 assert.equal(JSON.stringify(floors),before);
});
