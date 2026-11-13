'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const potable=require('./fh-water-potable.js');
const hotCore=require('./fh-water-hot.js');
const services=require('./fh-services-core.js');
function map({pump=true,topCold='main'}={}){
 const wall=(id,y)=>({id,type:'wall',a:{x:0,y},b:{x:12,y},buildingId:'casa'});
 const port=(id,y,cold='main')=>({id,type:'water_outlet',x:3,y,networkId:cold,
  hotNetworkId:'caliente',buildingId:'casa',verticalRiserId:'shaft',hotWaterEnabled:true});
 return {schema:'forest-horror-map-v1',units:{feetPerCell:5},
  plumbing:{enabled:true,requireLiftPump:true},floors:[
  {id:'sotano',elevationFt:-12,items:[wall('w0',0),
   {id:'city',type:'water_main',networkId:'main',buildingId:'casa',x:1,y:0,rangeFt:300},
   {id:'cis',type:'water_cistern',networkId:'main',buildingId:'casa',x:3,y:0,
    initialLiters:90,capacityLiters:100,rangeFt:300},port('p0',0),
   {id:'heater',type:'water_boiler',modelId:'calentador_domestico_vertical',
    networkId:'main',hotNetworkId:'caliente',buildingId:'casa',x:3,y:.2,pipeLeadFt:10,
    service:{waterHeating:true},initialHotLiters:0,boilerCapacityLiters:80,heatCPerMinute:5},
   ...(pump?[{id:'pump',type:'water_boiler_aux',modelId:'bomba_recirculacion',
    networkId:'main',buildingId:'casa',x:3,y:.2,pumpFlowLpm:10,pumpRangeFt:300,
    service:{requiresPower:true,waterLiftPump:true,onDemand:true}}]:[])]},
  {id:'planta',elevationFt:0,items:[wall('w1',1),port('p1',1)]},
  {id:'alto',elevationFt:12,items:[wall('w2',2),port('p2',2,topCold),
   {id:'sink',modelId:'lavabo_pedestal',networkId:topCold,hotNetworkId:'caliente',
    buildingId:'casa',x:3,y:2.2},
   {id:'tin',type:'water_tinaco',networkId:'main',buildingId:'casa',x:6,y:2,
    initialLiters:0,capacityLiters:70,rangeFt:300}]}
 ]};
}
const obj=(m,f,id)=>m.floors[f].items.find(x=>x.id===id);
function setup(m,water='active',power=()=>true){
 const state=services.ensureState({services:{contracts:{water,electricity:'active'}}});
 const cold=potable.createRuntime(m,state,services.wallGraph,power);
 const hot=hotCore.createRuntime(m,state,cold,()=>true);
 return {state,cold,hot};
}
test('montante manual sube tres pisos aunque las paredes estén desplazadas',()=>{
 const m=map(),r=setup(m);
 assert.equal(r.cold.status(2,obj(m,2,'sink')).water,true);
 const route=r.cold.diagnostics().routes.find(x=>x.itemId==='p2');
 assert.equal(route.sections.filter(x=>x.vertical).length,2);
});
test('los IDs de montante y edificio impiden conexiones indebidas',()=>{
 const m=map();obj(m,1,'p1').verticalRiserId='diferente';
 assert.equal(setup(m).cold.status(2,obj(m,2,'sink')).water,false);
 const other=map();obj(other,2,'p2').buildingId='otra-casa';
 assert.equal(setup(other).cold.status(2,obj(other,2,'sink')).water,false);
});
test('caliente independiente no necesita el mismo identificador de red fría',()=>{
 const m=map({topCold:'fria-superior'}),r=setup(m);
 assert.equal(r.cold.status(2,obj(m,2,'sink')).water,false);
 r.hot.tick(30);
 assert.equal(r.hot.status(2,obj(m,2,'sink')).hotWater,true);
});
test('bomba mueve litros con luz, detiene transferencia en apagón y persiste reserva',()=>{
 const m=map(),r=setup(m,'suspended',()=>false),sink=obj(m,2,'sink');
 assert.equal(r.cold.status(2,sink).water,false);
 r.cold.tick(3);assert.equal(r.cold.status(2,obj(m,2,'tin')).liters,0);
 const on=potable.createRuntime(m,r.state,services.wallGraph,()=>true);
 on.tick(3);
 assert.equal(on.status(2,obj(m,2,'tin')).liters,30);
 assert.equal(on.status(0,obj(m,0,'cis')).liters,60);
 assert.equal(r.state.usage.pump,true);
 const off=potable.createRuntime(m,r.state,services.wallGraph,()=>false);
 off.tick(3);
 assert.equal(off.status(2,obj(m,2,'tin')).liters,30);
 assert.equal(off.status(2,sink).water,true,'tinaco mantiene agua por gravedad');
 assert.equal(r.state.usage.pump,false);
 assert.equal(potable.createRuntime(m,r.state,services.wallGraph,()=>false)
  .status(2,obj(m,2,'tin')).liters,30);
});
test('municipio ilimitado rellena cisterna gradualmente pero no salta bomba del tinaco',()=>{
 const m=map({pump:false}),r=setup(m);
 const sink=obj(m,2,'sink'),tin=obj(m,2,'tin'),cis=obj(m,0,'cis');
 assert.equal(r.cold.consume(2,sink,50000,true),50000);
 r.cold.tick(2);
 assert.equal(r.cold.status(2,tin).liters,0);
 assert.equal(r.cold.status(0,cis).liters,100);
});

test('bomba integrada consume electricidad del breaker y se detiene en un apagón',()=>{
 const m=map();
 m.floors[0].items.push({id:'breaker',type:'breaker_panel',x:0,y:0,
  circuits:[{zoneId:'main',rangeFt:300}]});
 const pump=obj(m,0,'pump');pump.zoneId='main';
 pump.service.watts=150;pump.service.rayos=1;
 const game={services:{contracts:{water:'suspended',electricity:'active'}}};
 const r=services.createRuntime(m,game,{waterCore:potable,hotCore:hotCore});
 assert.equal(r.statusFor(0,pump).power.powered,true);
 r.tick(1,1);r.tick(1,1);
 assert.equal(r.waterStatus(2,obj(m,2,'tin')).liters,20);
 assert.ok(game.services.meters.kwh>0,'bomba funcionando consume energía eléctrica');
 r.setService('electricity',false);
 assert.equal(r.statusFor(0,pump).power.powered,false);
 r.tick(1,1);
 assert.equal(r.waterStatus(2,obj(m,2,'tin')).liters,20);
});
