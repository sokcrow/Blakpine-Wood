'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const potable=require('./fh-water-potable.js');
const hotCore=require('./fh-water-hot.js');
const servicesCore=require('./fh-services-core.js');
function map({floors=2,aligned=true,boiler=true,active=true,hotPort=true,
 building='a',otherBuilding='',network='main'}={}){
 const wall=(y,f)=>({id:'wall'+f,type:'red_wall',a:{x:0,y},b:{x:12,y},
  buildingId:f===1&&otherBuilding?otherBuilding:building});
 const boilerIt={id:'boiler',type:'misc',modelId:'calentador_domestico_vertical',
  x:3.2,y:.25,buildingId:building,networkId:network,hotNetworkId:'main',
  pipeLeadFt:10,hotRangeFt:160,service:{waterHeating:active,requiresPower:true,
   requiresWater:true,onDemand:true,watts:1200},boilerCapacityLiters:80,
  initialHotLiters:0,targetTemperatureC:55,heatCPerMinute:2,fillLpm:12};
 const ground={id:'planta',elevationFt:0,items:[wall(0,0),
  {id:'public',type:'water_main',x:1,y:0,networkId:network,rangeFt:150,buildingId:building},
  {id:'inlet',type:'water_outlet',x:3,y:0,networkId:network,radiusFt:5,buildingId:building},
  ...(boiler?[boilerIt]:[])]};
 const level={id:'alto',elevationFt:12,items:[
  wall(aligned?0:4,1),
  {id:'outlet',type:'water_outlet',x:9,y:aligned?0:4,
   networkId:network,hotNetworkId:'main',hotWaterEnabled:hotPort,radiusFt:5,
   buildingId:otherBuilding||building},
  {id:'sink',type:'misc',modelId:'lavabo_pedestal',
   x:9,y:aligned?.25:4.25,buildingId:otherBuilding||building,
   networkId:network,hotNetworkId:'main'}]};
 const allFloors=floors===1?[ground]:[ground,level];
 if(floors===1){
  ground.items.push({...level.items[1],x:9,y:0},{...level.items[2],x:9,y:.25});
 }
 return {schema:'forest-horror-map-v1',units:{feetPerCell:5},
  plumbing:{enabled:true},floors:allFloors};
}
function setup(m,hasPower=true,restored){
 const game=restored||{services:{contracts:{water:'active',electricity:'active'}}};
 const s=servicesCore.ensureState(game);
 const cold=potable.createRuntime(m,s,servicesCore.wallGraph);
 const hot=hotCore.createRuntime(m,s,cold,()=>hasPower);
 const floor=m.floors.length-1;
 const sink=m.floors[floor].items.find(i=>i.id==='sink');
 const boiler=m.floors[0].items.find(i=>i.id==='boiler');
 const outlet=m.floors[floor].items.find(i=>i.id==='outlet');
 return {game,s,cold,hot,sink,boiler,outlet,floor};
}
test('sin caldera funcional no existe circuito caliente; mapas antiguos quedan intactos',()=>{
 const no=setup(map({boiler:false}));
 assert.equal(no.hot.enabled,false);
 const visual=setup(map({active:false}));
 assert.equal(visual.hot.enabled,false);
 const old=map();delete old.plumbing;
 old.floors[0].items=old.floors[0].items.filter(x=>x.id!=='boiler');
 const state={services:{contracts:{water:'active'}}};
 assert.equal(potable.createRuntime(old,servicesCore.ensureState(state),
  servicesCore.wallGraph).enabled,false);
});
test('caldera sin entrada fría jamás fabrica agua',()=>{
 const m=map();m.floors[0].items=m.floors[0].items.filter(i=>i.id!=='inlet');
 const x=setup(m);x.hot.tick(30);
 assert.equal(x.hot.status(0,x.boiler).liters,0);
 assert.equal(x.hot.status(x.floor,x.sink).hotWater,false);
});
test('una caldera sin electricidad puede llenarse, pero no calienta',()=>{
 const x=setup(map(),false);x.hot.tick(30);
 assert.equal(x.hot.status(0,x.boiler).liters,80);
 assert.equal(x.hot.status(0,x.boiler).powered,false);
 assert.equal(x.hot.status(x.floor,x.sink).hotWater,false);
});
test('el agua caliente llega del sótano al piso de arriba por tubería',()=>{
 const x=setup(map());x.hot.tick(30);
 const status=x.hot.status(x.floor,x.sink);
 assert.equal(status.connected,true);
 assert.equal(status.hotWater,true);
 assert.equal(status.sourceId,'boiler');
 assert.ok(status.feet>=12);
 assert.equal(x.hot.status(0,x.boiler).temperatureC,55);
 assert.ok(x.hot.diagnostics().hotFeet>0);
});
test('sin alineación de paredes no hay conexión vertical',()=>{
 const x=setup(map({aligned:false}));x.hot.tick(30);
 assert.equal(x.hot.status(x.floor,x.sink).hotWater,false);
});
test('la tubería fría no se convierte en caliente automáticamente',()=>{
 const x=setup(map({hotPort:false}));x.hot.tick(30);
 assert.equal(x.cold.status(x.floor,x.sink).water,true);
 assert.equal(x.hot.status(x.floor,x.sink).hotWater,false);
});
test('inodoro y mingitorio nunca necesitan circuito caliente',()=>{
 const x=setup(map());x.hot.tick(30);
 for(const modelId of ['inodoro_clasico','inodoro_antiguo','mingitorio_pared']){
  assert.equal(x.hot.status(x.floor,{...x.sink,modelId}).hotWater,false);
 }
});
test('dos edificios diferentes no comparten la caldera',()=>{
 const x=setup(map({otherBuilding:'b'}));x.hot.tick(30);
 assert.equal(x.hot.status(x.floor,x.sink).hotWater,false);
});
test('IDs de redes calientes distintos no se cruzan',()=>{
 const m=map(),out=m.floors[1].items.find(x=>x.id==='outlet');
 out.hotNetworkId='vecino';
 const x=setup(m);x.hot.tick(30);
 assert.equal(x.hot.status(x.floor,x.sink).hotWater,false);
});
test('consumo exacto y rechazo atómico si la reserva es insuficiente',()=>{
 const x=setup(map());x.hot.tick(30);
 const original=x.hot.status(0,x.boiler).liters;
 assert.equal(x.hot.draw(x.floor,x.sink,original+1,true),0);
 assert.equal(x.hot.status(0,x.boiler).liters,original);
 assert.equal(x.hot.draw(x.floor,x.sink,15,true),15);
 assert.equal(x.hot.status(0,x.boiler).liters,original-15);
 assert.equal(x.s.meters.waterLiters,15);
});
test('agua caliente ya producida sigue caliente un rato sin luz',()=>{
 let power=true;
 const m=map(),game={services:{contracts:{water:'active'}}};
 const s=servicesCore.ensureState(game),cold=potable.createRuntime(m,s,servicesCore.wallGraph);
 const hot=hotCore.createRuntime(m,s,cold,()=>power);
 const sink=m.floors[1].items.find(x=>x.id==='sink');
 hot.tick(30);assert.equal(hot.status(1,sink).hotWater,true);
 power=false;hot.tick(1);
 assert.equal(hot.status(1,sink).hotWater,true);
 hot.tick(60);hot.tick(60);hot.tick(60);hot.tick(60);hot.tick(60);
 assert.equal(hot.status(1,sink).hotWater,false);
});
test('estado de caldera persiste y no se reinicia al crear otro runtime',()=>{
 const x=setup(map());x.hot.tick(30);x.hot.draw(x.floor,x.sink,12);
 const cached=x.s.hotWater['planta:boiler'].liters;
 const next=setup(map(),true,x.game);
 assert.equal(next.hot.status(0,next.boiler).liters,cached);
});
test('medición de tuberías compartidas no duplica tramos',()=>{
 const m=map(),top=m.floors[1];
 top.items.push({id:'outlet2',type:'water_outlet',x:11,y:0,networkId:'main',
  hotNetworkId:'main',hotWaterEnabled:true,radiusFt:5,buildingId:'a'});
 const x=setup(m);x.hot.tick(30);
 const d=x.hot.diagnostics();
 assert.equal(d.routes.length,2);
 assert.ok(d.hotFeet<d.routes.reduce((sum,r)=>sum+(r.feet||0),0));
});
test('FHServices integra el estado sin habilitar acciones de higiene',()=>{
 const m=map();
 const state={services:{contracts:{water:'active',electricity:'active'}}};
 const runtime=servicesCore.createRuntime(m,state,{waterCore:potable,hotCore});
 assert.equal(runtime.hotWater.enabled,true);
 assert.equal(runtime.hotWaterStatus(1,m.floors[1].items.find(x=>x.id==='sink')).hotWater,false);
 runtime.tick(1,1);
 assert.equal(runtime.hotWaterStatus(0,m.floors[0].items.find(x=>x.id==='boiler')).powered,false);
 assert.ok(state.services.hotWater['planta:boiler'].liters>0);
 assert.equal(state.character?.resources?.sp,undefined);
});
