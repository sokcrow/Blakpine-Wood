/* Ejecutar: node juego/assets/fh-location-hud.test.js */
'use strict';
const assert=require('node:assert/strict');
const H=require('./fh-location-hud.js');
const P=require('./fh-style-property.js');
const Z=require('./fh-property-zones.js');
const poly=(x,y,w,h)=>Z.polygon({x,y,w,h});
const redBox=(x=0,y=0,w=10,h=10)=>{
 const a={x,y},b={x:x+w,y},c={x:x+w,y:y+h},d={x,y:y+h};
 return [[a,b],[b,c],[c,d],[d,a]].map(([u,v],i)=>({id:'red'+i,type:'red_wall',a:u,b:v}));
};
const floors=[
 {id:'s2',name:'Sótano 2',elevationFt:-24,items:[]},
 {id:'s1',name:'Sótano 1',elevationFt:-12,items:[]},
 {id:'p1',name:'Piso 1',elevationFt:0,items:[...redBox(),
  {id:'garden',type:'outside',x:11,y:1,w:5,h:4,label:'Jardines'}]},
 {id:'p2',name:'Piso 2',elevationFt:12,items:[...redBox(),
  {id:'bath',type:'room',x:1,y:1,w:2,h:2,label:'Baño'},
  {id:'hall',type:'hall',x:5,y:5,w:3,h:2,label:'Pasillo Este'}]}
];
const map={schema:'forest-horror-map-v1',version:2,title:'Blakpine Wood',floors,
 properties:[{id:'apartment',floorId:'p2',source:'zone',name:'Departamento 203',
  ownerId:'ana',polygon:poly(1,1,3,3)}],
 locationZones:[
  {id:'patio',floorId:'p1',kind:'exterior',name:'Patio Oeste',polygon:poly(11,1,5,4)},
  {id:'pasillo',floorId:'p2',kind:'common',name:'Pasillo Este',polygon:poly(5,5,3,2)}
 ],
 buildingNames:{p2_building_1:'Apartamentos'}
};
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name)}
test('Identificador F1 y F2',()=>{
 assert.equal(H.codeForFloor(floors,2),'F1');
 assert.equal(H.codeForFloor(floors,3),'F2');
});
test('Identificador B1 y B2 por elevación',()=>{
 assert.equal(H.codeForFloor(floors,1),'B1');
 assert.equal(H.codeForFloor(floors,0),'B2');
});
test('Propiedad: nombre y habitación sin piso en el texto',()=>{
 const r=H.resolve(map,3,{x:2,y:2},P);
 assert.deepEqual([r.kind,r.floorCode,r.primary,r.secondary],
  ['property','F2','Departamento 203','Baño']);
});
test('Edificio: nombre propio y pasillo del DM',()=>{
 const r=H.resolve(map,3,{x:6,y:6},P);
 assert.deepEqual([r.kind,r.floorCode,r.primary,r.secondary],
  ['building','F2','Apartamentos','Pasillo Este']);
});
test('Exterior: sin indicador, segunda línea con nombre de zona',()=>{
 const r=H.resolve(map,2,{x:12,y:2},P);
 assert.deepEqual([r.kind,r.floorCode,r.primary,r.secondary],
  ['exterior','','EXTERIOR','Patio Oeste']);
});
test('Exterior sin zona: segunda línea vacía',()=>{
 const r=H.resolve(map,2,{x:19,y:17},P);
 assert.deepEqual([r.kind,r.floorCode,r.primary,r.secondary],
  ['exterior','','EXTERIOR','']);
});
test('Propiedad sin habitación: segunda línea vacía',()=>{
 const r=H.resolve(map,3,{x:3.5,y:3.5},P);
 assert.equal(r.kind,'property');assert.equal(r.secondary,'');
});
test('Mapa heredado v1 sin campos de ubicación',()=>{
 const old={title:'Hospital',floors:[{id:'f1',elevationFt:0,items:[...redBox()]}]};
 assert.deepEqual(
  [H.resolve(old,0,{x:2,y:2},P).primary,H.resolve(old,0,{x:11,y:11},P).floorCode],
  ['Hospital','']);
});
test('Crear zona exterior sin alterar propiedades ni paredes',()=>{
 const oldCount=map.properties.length,oldItems=map.floors[2].items.length;
 const result=Z.createLocation(map,'p1',{x:16,y:1},{x:19,y:3},22,22,'new','exterior');
 assert.equal(result.ok,true);assert.equal(map.properties.length,oldCount);
 assert.equal(map.floors[2].items.length,oldItems);
});
test('Rechazar zonas exteriores solapadas, permitir otras categorías',()=>{
 const overlapping=Z.createLocation(map,'p1',{x:12,y:2},{x:13,y:3},22,22,'other','exterior');
 assert.equal(overlapping.ok,false);
 const common=Z.createLocation(map,'p1',{x:12,y:2},{x:13,y:3},22,22,'other','common');
 assert.equal(common.ok,true);
});
test('Área Estacionamiento sin zona extra muestra EXTERIOR / ESTACIONAMIENTO',()=>{
 const m={title:'Complejo',floors:[{id:'f1',elevationFt:0,items:[
  {type:'parking',label:'Estacionamiento',x:1,y:1,w:8,h:6}]}]};
 const r=H.resolve(m,0,{x:2,y:2},P);
 assert.deepEqual([r.kind,r.floorCode,r.primary,r.secondary],
  ['exterior','','EXTERIOR','Estacionamiento']);
});
test('Zona exterior explícita tiene prioridad sobre contorno de edificio',()=>{
 const m=JSON.parse(JSON.stringify(map));
 m.locationZones.push({id:'park',floorId:'p2',kind:'exterior',
  name:'Estacionamiento',polygon:poly(5,5,3,2)});
 const r=H.resolve(m,3,{x:6,y:6},P);
 assert.deepEqual([r.kind,r.floorCode,r.primary,r.secondary],
  ['exterior','','EXTERIOR','Estacionamiento']);
});
test('Zona exterior explícita tiene prioridad sobre zona común solapada',()=>{
 const m=JSON.parse(JSON.stringify(map));
 m.locationZones.push({id:'park',floorId:'p2',kind:'exterior',
  name:'Patio Norte',polygon:poly(5,5,3,2)});
 const r=H.resolve(m,3,{x:6,y:6},P);
 assert.equal(r.kind,'exterior');assert.equal(r.secondary,'Patio Norte');
});
test('Una propiedad tiene prioridad sobre zona exterior accidentalmente solapada',()=>{
 const m=JSON.parse(JSON.stringify(map));
 m.locationZones.push({id:'park',floorId:'p2',kind:'exterior',
  name:'Patio Norte',polygon:poly(1,1,3,3)});
 const r=H.resolve(m,3,{x:2,y:2},P);
 assert.equal(r.kind,'property');assert.equal(r.primary,'Departamento 203');
});
test('Estacionamiento sobre un área Exterior genérica usa nombre del estacionamiento',()=>{
 const m={title:'Complejo',floors:[{id:'f1',elevationFt:0,items:[
  {type:'outside',label:'Exterior',x:0,y:0,w:10,h:10},
  {type:'parking',label:'Estacionamiento',x:1,y:1,w:6,h:6}]}]};
 const r=H.resolve(m,0,{x:2,y:2},P);
 assert.deepEqual([r.primary,r.secondary],['EXTERIOR','Estacionamiento']);
});
test('La superficie Pasto se ignora por defecto pero acepta un nombre del DM',()=>{
 const m={title:'Complejo',floors:[{id:'f1',elevationFt:0,items:[
  {type:'grass',label:'Pasto',x:0,y:0,w:7,h:7}]}]};
 assert.equal(H.resolve(m,0,{x:2,y:2},P).secondary,'');
 m.floors[0].items[0].label='Jardines';
 assert.equal(H.resolve(m,0,{x:2,y:2},P).secondary,'Jardines');
});
test('Estacionamiento dentro de un edificio sigue indicando planta',()=>{
 const m={title:'Hospital',floors:[{id:'f1',elevationFt:0,items:[
  ...redBox(),{type:'parking',label:'Estacionamiento',x:1,y:1,w:6,h:6}]}]};
 const r=H.resolve(m,0,{x:2,y:2},P);
 assert.equal(r.kind,'building');assert.equal(r.floorCode,'F1');
});
console.log(passed+' pruebas correctas');
