'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Services=require('./fh-services-core.js');
const editor=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const start=editor.indexOf('const ForestShared=(()=>{'),end=editor.indexOf("\n'use strict';",start);
const context={window:{},console,structuredClone};vm.runInNewContext(editor.slice(start,end)+'\nthis.shared=ForestShared;',context);
const shared=context.shared;
function prepareEngine(){
 const document={baseURI:'https://example.test/',currentScript:null},window={document,__FOREST_EMBEDDED_ENGINE__:''};
 const ctx=vm.createContext({window,document,URL,console});vm.runInContext(editor.slice(start,end),ctx);
 for(let i=0;i<13;i++)vm.runInContext(fs.readFileSync(path.join(__dirname,'engine-'+String(i).padStart(2,'0')+'.js'),'utf8'),ctx);
 for(const file of ['fh-architecture-skins.js','fh-comic-action-engine-hook.js','fh-context-engine-hook.js','fh-structure-engine-hook.js','fh-services-engine-hook.js']){
  document.currentScript={src:new URL('juego/assets/'+file,document.baseURI).href};vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),ctx);
 }
 const a=editor.indexOf('function addLiveTextToEngine('),b=editor.indexOf('\nlet fhCharacterLaunchPending=false;',a);
 vm.runInContext(editor.slice(a,b),ctx);
 const doc=ctx.prepareGLBEngineDoc(Buffer.from(window.__FOREST_EMBEDDED_ENGINE__,'base64').toString('utf8'));
 return {prepared:doc,patched:window.FHServicesEngine.patch(doc)};
}
const engine=prepareEngine();
function factory(doc){
 const a=doc.indexOf('// shared/elevators.js'),b=doc.indexOf('// shared/lighting.js',a);assert.ok(a>=0&&b>a);
 return vm.runInNewContext('(()=>{'+doc.slice(a,b)+'\nreturn createElevatorMachine;})()',{structuredClone});
}
function fixture(create=shared.createElevatorMachine,{backup=false,ats=false}={}){
 const floors=[0,1].map(f=>({id:'f'+f,elevationFt:f*12,items:[
  {id:'room'+f,type:'room',roomId:'r'+f,zoneId:'a'+f,x:0,y:0,w:8,h:8},
  {id:'wall'+f,type:'wall',a:{x:0,y:0},b:{x:10,y:0}},
  {id:'panel'+f,type:'breaker_panel',x:0,y:0,powerSource:{kind:'utility'},circuits:[{id:'a'+f,zoneId:'a'+f,rangeFt:90}]},
  {id:'lift'+f,type:'elevator',shaftId:'lift',enabled:true,requiresPower:false,powerFlag:'breaker_on',zoneId:'main',x:2,y:2,w:1.5,h:1.5,watts:100}
 ]}));
 if(backup){
  floors[0].items.push({id:'generator',type:'generator',generatorKind:'emergency',enabled:true,capacityWatts:1000,autonomyHours:10,
   ...(ats?{atsId:'ats',atsFloorId:'f0'}:{})});
  for(const floor of floors)floor.items.find(it=>it.type==='breaker_panel').backupSource={kind:'generator',floorId:'f0',itemId:'generator'};
  if(ats)floors[0].items.push({id:'ats',type:'generator_ats'});
 }
 const state={flags:{breaker_on:false}},project={schema:'forest-horror-map-v1',units:{feetPerCell:5},floors};
 const service=Services.createRuntime(project,state,{random:()=>0}),events=[];
 const machine=create(floors,state,{secondsPerFloor:2,maxHoldSec:1},type=>events.push(type),(shaft,f)=>{
  const stop=shaft.stops.find(s=>s.f===f);return !!stop&&service.statusFor(f,stop.item).power.powered===true;
 });
 return {floors,state,service,machine,events};
}
function board(f){assert.equal(f.machine.call('lift',0).ok,true);f.machine.update(1);assert.equal(f.machine.board('lift',0).ok,true);}
for(const [name,create] of [['compartido',shared.createElevatorMachine],['motor preparado',factory(engine.prepared)],['motor con servicios',factory(engine.patched)]]){
 test(name+': elevador antiguo requiere suministro real sin activar breaker_on',()=>{
  const f=fixture(create);assert.equal(f.machine.get('lift').requiresPower,true);assert.equal(f.machine.powered('lift'),true);
  assert.equal(f.machine.call('lift',1).ok,true);f.service.setService('electricity',false);
  assert.equal(f.machine.call('lift',1).reason,'noPower');assert.equal(f.machine.powered('lift'),false);
 });
 test(name+': sin proveedor, o con proveedor indefinido, no arranca aunque requiresPower sea false',()=>{
  const f=fixture(create);const machine=create(f.floors,{flags:{breaker_on:true}});
  assert.equal(machine.call('lift',1).reason,'noPower');
  const unknown=create(f.floors,{}, {},()=>{},()=>undefined);assert.equal(unknown.call('lift',0).reason,'noPower');
 });
 test(name+': un corte antes del arranque con pasajero no inicia viaje',()=>{
  const f=fixture(create);board(f);assert.equal(f.machine.destination('lift',1).ok,true);
  f.state.flags.power_global=false;f.machine.update(2);f.machine.update(2);
  assert.equal(f.machine.get('lift').cabin.position,0);assert.equal(f.events.includes('elevator:departure'),false);
 });
 test(name+': corte durante viaje detiene la cabina y restauración permite reanudar',()=>{
  const f=fixture(create);board(f);f.machine.destination('lift',1);f.machine.update(1);
  const before=f.machine.get('lift').cabin.position;assert.ok(before>0&&before<1);
  f.state.flags.power_global=false;f.machine.update(.1);assert.equal(f.machine.get('lift').cabin.phase,'stalled');
  assert.equal(f.machine.get('lift').cabin.position,before);
  f.state.flags.power_global=true;f.machine.update(1.1);assert.ok(f.events.includes('elevator:resumed'));
 });
 test(name+': respaldo alimenta el elevador y un ATS fallido exige transferencia manual',()=>{
  const f=fixture(create,{backup:true});f.state.flags.power_global=false;assert.equal(f.machine.call('lift',1).ok,true);
  const failed=fixture(create,{backup:true,ats:true});failed.state.flags.power_global=false;
  assert.equal(failed.machine.call('lift',1).reason,'noPower');assert.equal(failed.service.activateATSManual(0,'ats'),true);
  assert.equal(failed.machine.call('lift',1).ok,true);
 });
 test(name+': un corte adicional explícito sigue bloqueando el motor',()=>{
  const f=fixture(create);f.floors[0].items[3].powerFlag='maintenance';f.state.flags.maintenance=false;
  const machine=create(f.floors,f.state,{},()=>{},(shaft,floor)=>f.service.statusFor(floor,shaft.stops.find(s=>s.f===floor).item).power.powered);
  assert.equal(machine.call('lift',1).reason,'noPower');f.state.flags.maintenance=true;assert.equal(machine.call('lift',1).ok,true);
 });
 test(name+': un corte prolongado conserva salida mecánica sin autorizar viajes',()=>{
  const f=fixture(create);board(f);f.machine.destination('lift',1);f.machine.update(1);
  f.state.flags.power_global=false;f.machine.update(3);
  assert.ok(f.events.includes('elevator:rescue'));assert.equal(f.machine.powered('lift'),false);
  const c=f.machine.get('lift').cabin;assert.equal(c.position,c.floor);assert.equal(c.phase,'open');
  assert.equal(f.machine.exit('lift',c.floor).ok,true);assert.equal(f.machine.call('lift',1).reason,'noPower');
 });
 test(name+': guardado de cabina no autoriza continuar sin electricidad',()=>{
  const f=fixture(create);board(f);f.machine.destination('lift',1);f.machine.update(1);
  f.state.flags.power_global=false;const state=JSON.parse(JSON.stringify(f.state));
  const restored=create(f.floors,state,{},()=>{},()=>false);restored.update(.1);
  assert.equal(restored.get('lift').cabin.phase,'stalled');assert.equal(restored.powered('lift'),false);
 });
}
test('asignación de habitación conecta también elevadores y conserva cortes y alcance',()=>{
 const f=fixture(),room=f.floors[0].items[0],lift=f.floors[0].items[3];
 delete lift.zoneId;assert.equal(f.service.zoneFor(0,lift),'a0');assert.equal(f.service.statusFor(0,lift).power.powered,true);
 shared.roomCircuitAssignments(f.floors[0].items,room,'otro');assert.equal(lift.zoneId,'otro');assert.equal(lift.roomId,room.roomId);
 assert.equal(f.service.statusFor(0,lift).power.powered,false);
 lift.zoneId='a0';f.state.flags['power_breaker:panel0:a0']=false;assert.equal(f.service.statusFor(0,lift).power.powered,false);
});
test('elevador no recibe energía si falta circuito, breaker o alcance; tampoco estando deshabilitado',()=>{
 for(const mutate of [f=>f.floors[0].items.splice(2,1),f=>f.floors[0].items[2].circuits[0].rangeFt=1,
  f=>{f.floors[0].items[0].zoneId='';f.floors[0].items[3].zoneId='';},f=>f.floors[0].items[3].enabled=false]){
  const f=fixture();mutate(f);const service=Services.createRuntime({floors:f.floors,units:{feetPerCell:5}},f.state);
  assert.equal(service.statusFor(0,f.floors[0].items.find(it=>it.type==='elevator')).power.powered,false);
 }
});
test('un circuito main declarado sigue siendo una asignación válida del elevador',()=>{
 const f=fixture();f.floors[0].items[2].circuits[0].zoneId='main';
 const service=Services.createRuntime({floors:f.floors,units:{feetPerCell:5}},f.state);assert.equal(service.zoneFor(0,f.floors[0].items[3]),'main');
 assert.equal(service.statusFor(0,f.floors[0].items[3]).power.powered,true);
});
test('creación del elevador hereda circuito de habitación o selección y no crea flag genérico',()=>{
 const a=editor.indexOf('function createObject(type,p){'),b=editor.indexOf('\nfunction sanitizeId',a);
 const room={type:'room',roomId:'r',zoneId:'a'},floor={items:[room]};
 const ctx={window:{FHLights:{kindForTool:()=>null}},project:{units:{feetPerCell:5}},current:()=>floor,roomHasPosition:()=>true,
  OBJECT_SIZES:{},numId:()=> 'lift',selectedCircuit:()=> 'selected',availableCircuits:()=>[{zoneId:'main'}],ForestShared:{PROP_ACTIONS:{}}};
 vm.runInNewContext(editor.slice(a,b),ctx);const item=ctx.createObject('elevator',{x:1,y:1});
 assert.equal(item.requiresPower,true);assert.equal(item.zoneId,'a');assert.equal(item.powerFlag,undefined);
 room.zoneId='main';assert.equal(ctx.createObject('elevator',{x:1,y:1}).zoneId,'main');
 ctx.availableCircuits=()=>[];assert.equal(ctx.createObject('elevator',{x:1,y:1}).zoneId,'selected');
 floor.items=[];assert.equal(ctx.createObject('elevator',{x:1,y:1}).zoneId,'selected');
});
test('inspector ya no ofrece funcionamiento sin energía ni circuito opcional',()=>{
 const a=editor.indexOf("if(it.type==='parking_decal')window.FHParkingEditor?.attachInspector"),b=editor.indexOf('\n',a),slice=editor.slice(a,b);
 assert.equal(slice.includes("put('Necesita energía'"),false);assert.equal(slice.includes('Zona eléctrica (opcional)'),false);
 assert.ok(slice.includes('EP.mandatory'));assert.ok(slice.includes('EP.circuit'));
});
