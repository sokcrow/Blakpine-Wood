'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const potable=require('./fh-water-potable.js');
const services=require('./fh-services-core.js');
function build({twoFloors=true,aligned=true,withTank=false,enabled=true,propertyMismatch=false}={}){
 const wall=y=>({id:'wall-'+y,type:'wall',a:{x:0,y},b:{x:12,y}});
 const f0={id:'p0',elevationFt:0,items:[wall(0),{id:'main',type:'water_main',networkId:'main',x:1,y:0,rangeFt:140}]};
 if(withTank)f0.items.push({id:'tank',type:'water_cistern',networkId:'main',x:3,y:0,
  initialLiters:0,capacityLiters:100,fillLpm:20,rangeFt:140});
 const f1={id:'p1',elevationFt:12,items:[wall(aligned?0:4),
  {id:'port',type:'water_outlet',networkId:'main',x:8,y:aligned?0:4,radiusFt:5},
  {id:'sink',type:'misc',modelId:'lavabo_pedestal',x:8,y:aligned?.3:4.3,
   buildingId:propertyMismatch?'b':'a'}]};
 f0.items.find(x=>x.id==='main').buildingId='a';
 const floors=twoFloors?[f0,f1]:[{
  id:'p0',elevationFt:0,items:[...f0.items,
   {...f1.items.find(x=>x.id==='port'),y:0},{...f1.items.find(x=>x.id==='sink'),y:.3}]
 }];
 return {schema:'forest-horror-map-v1',units:{feetPerCell:5},
  plumbing:{enabled},floors};
}
function runtime(map){
 const state={services:{contracts:{water:'active',electricity:'active'}}};
 return {state,runtime:services.createRuntime(map,state)};
}
test('modo opcional: mapas antiguos no entran en red automática',()=>{
 const map=build({twoFloors:false,enabled:false,withTank:false});
 const {runtime:r}=runtime(map);assert.equal(r.waterNetwork?.enabled,false);
 assert.equal(r.statusFor(0,map.floors[0].items.find(x=>x.id==='sink')).water.legacy,true);
});
test('un lavabo recibe agua fría por pared y montante alineado',()=>{
 const map=build();const {runtime:r}=runtime(map);
 const sink=map.floors[1].items.find(x=>x.id==='sink');
 const result=r.waterStatus(1,sink);
 assert.equal(result.water,true);assert.equal(result.sourceId,'main');
 assert.ok(result.feet>=12);assert.ok(result.feet<140);
 const report=r.waterNetwork.diagnostics();
 assert.equal(report.routes.filter(x=>x.itemId==='port').length,1);
 assert.ok(report.coldFeet>12);
});
test('paredes de pisos no alineadas impiden el paso vertical',()=>{
 const map=build({aligned:false});const {runtime:r}=runtime(map);
 assert.equal(r.waterStatus(1,map.floors[1].items.find(x=>x.id==='sink')).water,false);
});
test('edificios con IDs diferentes no comparten suministro',()=>{
 const map=build({propertyMismatch:true});const {runtime:r}=runtime(map);
 assert.equal(r.waterStatus(1,map.floors[1].items.find(x=>x.id==='sink')).water,false);
});
test('válvula cerrada y contrato suspendido cortan el agua',()=>{
 const map=build();map.floors[0].items.push({id:'valve',type:'water_valve',networkId:'main',opened:false});
 const {runtime:r,state}=runtime(map);const fixture=map.floors[1].items.find(x=>x.id==='sink');
 assert.equal(r.waterStatus(1,fixture).water,false);
 r.state.enabled.valve=true;assert.equal(r.waterStatus(1,fixture).water,true);
 r.setService('water',false);assert.equal(r.waterStatus(1,fixture).water,false);
});
test('cisterna se llena solo con red pública conectada y conserva litros',()=>{
 const map=build({withTank:true});
 const {runtime:r,state}=runtime(map);const tank=map.floors[0].items.find(x=>x.id==='tank');
 const fixture=map.floors[1].items.find(x=>x.id==='sink');
 assert.equal(r.waterStatus(0,tank).liters,0);
 r.waterNetwork.tick(2);
 assert.equal(r.waterStatus(0,tank).liters,40);
 r.setService('water',false);
 assert.equal(r.waterStatus(1,fixture).water,true);
 assert.equal(r.waterNetwork.consume(1,fixture,12,true),12);
 assert.equal(r.waterStatus(0,tank).liters,28);
 assert.equal(r.waterNetwork.consume(1,fixture,30,true),0);
 assert.equal(r.waterStatus(0,tank).liters,28);
 assert.equal(state.services.waterTanks['p0:tank'].liters,28);
 r.waterNetwork.tick(2);assert.equal(r.waterStatus(0,tank).liters,28);
});
test('sin salida de pared no se conectan muebles por simple cercanía',()=>{
 const map=build({twoFloors:false});
 map.floors[0].items=map.floors[0].items.filter(x=>x.type!=='water_outlet');
 const {runtime:r}=runtime(map);
 assert.equal(r.waterStatus(0,map.floors[0].items.find(x=>x.id==='sink')).water,false);
});
test('catálogo sanitario cubierto y sin incluir decoración',()=>{
 for(const id of ['inodoro_clasico','inodoro_antiguo','lavabo_pedestal','lavabo_gabinete',
 'fregadero_mueble','mingitorio_pared','banera_clasica','banera_patas','plato_ducha',
 'cabina_ducha','regadera_pared'])assert.equal(potable.isFixture({modelId:id}),true,id);
 assert.equal(potable.isFixture({modelId:'espejo_rectangular'}),false);
});
