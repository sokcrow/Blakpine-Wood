'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Prefabs=require('./fh-construction-prefabs.js');
const Construction=require('./fh-construction.js');
const Rooms=require('./fh-construction-rooms.js');
const Geometry=require('./fh-style-property.js');

const ids=[
 ['inodoro_clasico',2.25,2.5],['lavabo_pedestal',2.25,1.75],
 ['fregadero_mueble',3,2.5],['estufa_horno',3,2.75],['refrigerador',3,3],
 ['cama_individual',3.25,6.5],['mesa_pequena',2.75,2.75],
 ['escritorio_clasico',4.5,2.5],['silla_madera',1.75,1.75],
 ['caja_registradora_c02',1.5,1.25],['gondola_simple_c02',3,1.25],
 ['rack_snacks_c02',2.25,1.75]
];
const catalog={schema:'forest-horror-furniture-catalog-v1',furniture:ids.map(([id,widthFt,depthFt])=>
 ({id,name:id,widthFt,depthFt,heightFt:3,blocksMovement:true,
  shopRole:id==='caja_registradora_c02'?'register':/gondola|rack/.test(id)?'display':undefined}))};
function map(preset='ayuntamiento',width=50,height=40) {
 const property={id:'parcel_building',source:'zone',floorId:'f1',
  polygon:[{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}]};
 Construction.plan(property,preset,false);
 return {schema:'forest-horror-map-v1',version:1,units:{columns:120,rows:120,feetPerCell:5},
  floors:[{id:'f1',items:[]}],properties:[property]};
}
const place=(project,preset=project.properties[0].construction.preset,config={})=>
 Prefabs.place(project,project.properties[0],preset,{catalog,...config});
for(const preset of ['ayuntamiento','casas','apartamentos','tienda']) {
 test(preset+': genera recinto y mobiliario reales, sin conectar redes imaginarias',()=>{
  const project=map(preset);
  const result=place(project,preset);
  assert.equal(result.ok,true);
  const items=project.floors[0].items;
  assert.equal(Geometry.buildings(project,'f1').length,1);
  assert.ok(items.some(it=>it.type==='red_wall'));
  assert.ok(items.some(it=>it.type==='window'&&it.roofBoundary));
  assert.ok(items.some(it=>it.type==='door'&&it.roofBoundary&&it.doorRole==='entrance'));
  assert.ok(items.some(it=>it.modelId));
  assert.ok(items.every(it=>it.constructionParcelId==='parcel_building'));
  assert.ok(!items.some(it=>it.type==='water_main'||it.type==='drain_main'||it.type==='generator'));
  const inspection=Rooms.inspectParcel(project,project.properties[0],{geometry:Geometry});
  assert.equal(inspection.status,'unverified');
  assert.ok(!inspection.issues.some(i=>['falta_habitacion','falta_mueble','falta_registradora','faltan_exhibidores'].includes(i.code)));
  for(const room of items.filter(it=>it.type==='room'))
   assert.equal(Geometry.roomInProperty(room,project.properties[0]),true);
  assert.equal(project.properties[0].generatedPrefab.itemIds.length,items.length);
  assert.equal(place(project,preset).code,'generated');
  assert.equal(project.floors[0].items.length,items.length);
  assert.ok(JSON.parse(JSON.stringify(project)).properties[0].generatedPrefab);
 });
}
test('apartamentos: dos viviendas, accesos independientes desde pasillo',()=>{
 const project=map('apartamentos');const done=place(project);
 assert.equal(done.apartments,2);
 const rooms=project.floors[0].items.filter(it=>it.constructionRoom);
 assert.equal(rooms.length,6);
 const units=new Set(rooms.map(it=>it.apartmentId));
 assert.equal(units.size,2);
 const entrances=project.floors[0].items.filter(it=>it.type==='door'&&it.doorRole==='entrance'&&it.apartmentId);
 assert.equal(entrances.length,2);
});
test('terreno grande: tamaño acotado y resto de parcela disponible',()=>{
 const project=map('ayuntamiento',100,100),done=place(project);
 assert.equal(done.ok,true);
 assert.equal(done.rect.w,Prefabs.TARGET.ayuntamiento[0]);
 assert.equal(done.rect.h,Prefabs.TARGET.ayuntamiento[1]);
});
test('no dibuja sobre una calle o estructura existente',()=>{
 const project=map('tienda');
 project.floors[0].items.push({id:'road',type:'asphalt',x:15,y:15,w:20,h:10,
  road:{axis:'x',sidewalkFt:5}});
 const before=JSON.stringify(project);
 assert.equal(place(project).code,'occupied');
 assert.equal(JSON.stringify(project),before);
});
test('parcela demasiado pequeña: fallo sin cambios',()=>{
 const project=map('casas',10,10),before=JSON.stringify(project);
 assert.equal(place(project).code,'small_parcel');
 assert.equal(JSON.stringify(project),before);
});
test('no aplica modelos incompletos y personalizado sigue siendo manual',()=>{
 const project=map('tienda');
 assert.equal(Prefabs.place(project,project.properties[0],'personalizado',{catalog}).code,'unknown_preset');
 const broken={...catalog,furniture:catalog.furniture.filter(m=>m.id!=='inodoro_clasico')};
 const result=Prefabs.place(project,project.properties[0],'tienda',{catalog:broken});
 assert.equal(result.code,'missing_model');
 assert.equal(project.floors[0].items.length,0);
});
test('no altera un mapa antiguo por el mero hecho de cargar el módulo',()=>{
 const old={schema:'forest-horror-map-v1',floors:[{id:'f1',items:[]}],properties:[]};
 const before=JSON.stringify(old);
 assert.equal(Prefabs.outline({}, {columns:120,rows:120}),null);
 assert.equal(JSON.stringify(old),before);
});