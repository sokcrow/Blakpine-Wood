'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const FH=require('./fh-services-core.js');
const assembly=require('./fh-pc-assembly.js');
const surfacePlacement=require('./fh-surface-placement.js');

function fixture({hostId='z_desk',withDesk=true}={}){
 const wall={id:'wall',type:'wall',a:{x:0,y:0},b:{x:10,y:0}};
 const panel={id:'panel',type:'breaker_panel',x:0,y:0,circuits:[{zoneId:'a',rangeFt:90}]};
 const plug={id:'plug',type:'power_outlet',x:2,y:0,zoneId:'a'};
 const desk={id:hostId,type:'table',x:2,y:.2,w:1,h:1,zoneId:'a',service:{watts:999,rayos:9},
  supportSurfaces:[{id:'top',widthFt:5,depthFt:5,heightFt:2.5}]};
 const parts={};
 for(const [name,modelId] of Object.entries(assembly.PARTS))parts[name]={
  id:'component_'+name,type:'misc',modelId,x:2,y:.2,zoneId:'a',
  service:{watts:name==='cabinet'?200:name==='monitor'?80:5,rayos:1},
  ...(withDesk?{support:{parentItemId:desk.id,surfaceId:'top',offsetXFt:0,offsetZFt:0}}:{})
 };
 const items=[wall,panel,plug,...(withDesk?[desk]:[]),...Object.values(parts)];
 const project={schema:'forest-horror-map-v1',units:{feetPerCell:5},floors:[{id:'f',items}]};
 const state={flags:{}};
 const create=()=>FH.createRuntime(project,state,{pcAssembly:assembly,surfacePlacement});
 return {project,state,items,parts,desk,plug,panel,create};
}
test('PC completa se conecta automáticamente al enchufe doble sin outletId y sin depender del ID de la mesa',()=>{
 for(const hostId of ['a_desk','z_desk']){
  const fx=fixture({hostId}),sys=fx.create();
  assert.equal(assembly.inspect(fx.desk,fx.items).ready,true);
  assert.equal(sys.statusFor(0,fx.desk).power.powered,true);
  assert.equal(sys.statusFor(0,fx.plug).usedSlots,2);
  const bindings=sys.electrical().bindings;
  assert.ok(!bindings.has('0:'+hostId));
  for(const name of ['keyboard','mouse']){
   assert.ok(!bindings.has('0:'+fx.parts[name].id));
   assert.equal(sys.statusFor(0,fx.parts[name]).power.powered,true);
  }
  sys.tick(60,1);
  assert.ok(Math.abs(sys.state.meters.kwh-.28)<1e-9,'solo 200 W gabinete + 80 W monitor');
 }
});
test('el tercer aparato sigue sin caber en las dos tomas reales',()=>{
 const fx=fixture();fx.items.push({id:'z_extra',type:'tv',x:2,y:.2,zoneId:'a'});
 const sys=fx.create();
 assert.equal(sys.statusFor(0,fx.desk).power.powered,true);
 assert.equal(sys.statusFor(0,fx.items.at(-1)).power.powered,false);
});
test('monitor, gabinete y estación leen el enchufe doble después de retirar un multiconector antiguo',()=>{
 const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),window={};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'fh-electric-catalog.js'),'utf8'),{window});
 const fx=fixture(),strip={id:'old-strip',type:'power_strip',x:2,y:.1,outletId:fx.plug.id};
 fx.items.push(strip);for(const part of Object.values(fx.parts))part.outletId=strip.id;
 const sys=FH.createRuntime(fx.project,fx.state,{pcAssembly:assembly,surfacePlacement,electricCatalog:window.FHElectricCatalog});
 for(const item of [fx.parts.monitor,fx.parts.cabinet,fx.desk]){
  const status=sys.statusFor(0,item).power;assert.equal(status.powered,true);assert.equal(status.via,fx.plug.id);
 }
 assert.equal(sys.statusFor(0,fx.plug).usedSlots,2);
 assert.ok(!fx.project.floors[0].items.some(item=>item.type==='power_strip'));
 fx.state.flags.power_global=false;
 for(const item of [fx.parts.monitor,fx.parts.cabinet,fx.desk])assert.equal(sys.statusFor(0,item).power.powered,false);
});
test('un generador reserva la potencia de las piezas sin volver a contar la mesa ni los periféricos',()=>{
 const fx=fixture();
 fx.panel.powerSource={kind:'generator',floorId:'f',itemId:'generator'};
 const generator={id:'generator',type:'generator',x:0,y:0,enabled:true,capacityWatts:300,autonomyHours:2};
 fx.items.push(generator);
 const sys=fx.create();
 assert.equal(sys.statusFor(0,fx.desk).power.powered,true);
 assert.equal(sys.generatorStatus(0,generator).watts,280);
 sys.tick(60,1);
 assert.ok(Math.abs(sys.state.meters.kwh-.28)<1e-9);
});
test('sin suministro o con gabinete/monitor dañado la estación no puede encenderse',()=>{
 for(const kind of ['cut','cabinet','monitor']){
  const fx=fixture(),sys=fx.create();
  if(kind==='cut')fx.state.flags.power_global=false;
  else sys.state.damage[fx.parts[kind].id]=100;
  assert.equal(sys.statusFor(0,fx.desk).power.powered,false);
  if(kind==='cut'||kind==='cabinet')assert.equal(sys.statusFor(0,fx.parts.keyboard).power.powered,false);
 }
});
test('el cable conserva su alcance y no atraviesa paredes',()=>{
 for(const obstruction of ['distance','wall']){
  const fx=fixture();
  if(obstruction==='distance')fx.plug.x=8;
  else {fx.desk.y=.6;fx.items.push({id:'partition',type:'wall',a:{x:1,y:.3},b:{x:3,y:.3}});}
  assert.equal(fx.create().statusFor(0,fx.desk).power.powered,false);
 }
});
test('usa la posición visible y la zona del soporte aunque x/y del prop estén desactualizados',()=>{
 const fx=fixture();
 for(const part of Object.values(fx.parts)){part.x=100;part.y=100;delete part.zoneId;}
 const sys=fx.create();
 assert.equal(sys.statusFor(0,fx.desk).power.powered,true);
 assert.equal(sys.statusFor(0,fx.plug).usedSlots,2);
});
test('sin mesa, el monitor consulta también el suministro del gabinete',()=>{
 const fx=fixture({withDesk:false}),sys=fx.create();
 assert.equal(sys.statusFor(0,fx.parts.monitor).power.powered,true);
 sys.state.damage[fx.parts.cabinet.id]=100;
 assert.equal(sys.statusFor(0,fx.parts.monitor).power.powered,false);
 sys.tick(60,1);
 assert.ok(Math.abs(sys.state.meters.kwh-.08)<1e-9,'el monitor alimentado sigue consumiendo aunque la PC no funcione');
});
test('las piezas de otra mesa no completan ni alimentan una PC incompleta',()=>{
 const fx=fixture();fx.parts.cabinet.support.parentItemId='other';
 fx.items.push({id:'other',type:'table',x:2.5,y:.2,w:1,h:1,zoneId:'a'});
 const sys=fx.create();
 assert.equal(assembly.inspect(fx.desk,fx.items).ready,false);
 assert.equal(sys.statusFor(0,fx.desk).power.powered,false);
});
test('PC integrada antigua conserva una sola toma y las referencias explícitas siguen respetándose',()=>{
 const fx=fixture();fx.items.splice(3);
 const pc={id:'legacy',type:'table',pcTerminal:true,x:2,y:.2,zoneId:'a'};
 fx.items.push(pc);
 let sys=fx.create();assert.equal(sys.statusFor(0,pc).power.powered,true);
 assert.equal(sys.statusFor(0,fx.plug).usedSlots,1);
 fx.items.push({id:'keyboard',type:'misc',modelId:'teclado_pc',x:2,y:.2,zoneId:'a'});
 sys=fx.create();assert.equal(sys.statusFor(0,pc).power.powered,true);
 assert.equal(sys.statusFor(0,fx.plug).usedSlots,1,'una pieza suelta no convierte una PC integrada antigua en montaje obligatorio');
 pc.outletId='missing';sys=fx.create();assert.equal(sys.statusFor(0,pc).power.powered,false);
});
