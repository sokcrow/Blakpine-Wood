'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Geometry=require('./fh-style-property.js');
const Audit=require('./fh-construction-rooms.js');
const C=require('./fh-construction.js');
function map(preset='casas'){
 const p={id:'parcel_a',floorId:'f1',polygon:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}]};
 C.plan(p,preset,false);
 return {schema:'forest-horror-map-v1',properties:[p],floors:[{id:'f1',items:[]}]};
}
function room(id,preset,x=0,y=0,w=4,h=4){return {type:'room',id,roomId:id,constructionRoom:preset,x,y,w,h};}
function item(id,modelId,x,y,shopRole){return {type:'misc',id,modelId,x,y,shopRole};}
function services({water=true,drain=true,power=true}={}){
 return {statusFor:()=>({water:{water},drain:{draining:drain},power:{powered:power}})};
}
test('mapa antiguo y habitación sin preset conservan funcionamiento anterior',()=>{
 const project=map('personalizado'),original=JSON.stringify(project);
 project.floors[0].items.push({id:'r0',type:'room',x:0,y:0,w:4,h:4});
 assert.equal(Audit.inspectRoom(project,'f1',project.floors[0].items[0]),null);
 assert.equal(Audit.inspectParcel(project,project.properties[0]).status,'ready');
 assert.equal(project.properties[0].construction.preset,'personalizado');
 assert.equal(JSON.stringify(project).startsWith(original.slice(0,70)),true);
});
test('baño sin piezas no aprueba y explica faltantes',()=>{
 const project=map('personalizado');
 const r=room('bath','bano');project.floors[0].items.push(r);
 const result=Audit.inspectRoom(project,'f1',r,{services:services()});
 assert.deepEqual(result.issues.map(i=>i.need),['toilet','bathSink']);
 assert.equal(result.status,'incomplete');
});
test('baño conectado y equipado cumple instalaciones pero no certifica acceso NPC',()=>{
 const project=map('personalizado'),r=room('bath','bano');
 project.floors[0].items.push(r,item('wc','inodoro_clasico',1,1),item('sink','lavabo_pedestal',2,2));
 const result=Audit.inspectRoom(project,'f1',r,{services:services()});
 assert.equal(result.status,'ready');
 assert.equal(result.npcUsable,null);
});
test('un drenaje sin conexión impide aprobar baño',()=>{
 const project=map('personalizado'),r=room('bath','bano');
 project.floors[0].items.push(r,item('wc','inodoro_clasico',1,1),item('sink','lavabo_pedestal',2,2));
 const result=Audit.inspectRoom(project,'f1',r,{services:services({drain:false})});
 assert.equal(result.status,'incomplete');
 assert.ok(result.issues.some(i=>i.code==='sin_drenaje'));
});
test('sin servicio disponible el diagnóstico no inventa conexiones',()=>{
 const project=map('personalizado'),r=room('bath','bano');
 project.floors[0].items.push(r,item('wc','inodoro_clasico',1,1),item('sink','lavabo_pedestal',2,2));
 assert.equal(Audit.inspectRoom(project,'f1',r).status,'unverified');
});
test('tienda necesita baño, registradora y dos góndolas',()=>{
 const project=map('tienda');
 let result=Audit.inspectParcel(project,project.properties[0]);
 assert.deepEqual(result.issues.map(i=>i.code),['falta_habitacion','falta_registradora','faltan_exhibidores']);
 project.floors[0].items.push(room('bath','bano',0,0,3,3),item('wc','inodoro_clasico',1,1),
  item('sink','lavabo_pedestal',2,2),item('register','caja_registradora_c02',5,5,'register'),
  item('display1','gondola_simple_c02',6,5,'display'),item('display2','rack_snacks_c02',7,5,'display'));
 result=Audit.inspectParcel(project,project.properties[0],{services:services()});
 assert.equal(result.status,'ready');
});
test('una habitación fuera de la parcela no cubre requisitos',()=>{
 const project=map('tienda');
 project.floors[0].items.push(room('outside','bano',11,11,3,3));
 assert.ok(Audit.inspectParcel(project,project.properties[0]).issues.some(i=>i.code==='falta_habitacion'));
});
test('obras no terminadas no habilitan el proyecto',()=>{
 const project=map('tienda');C.plan(project.properties[0],'tienda',true);
 const report=Audit.inspectParcel(project,project.properties[0]);
 assert.ok(report.issues.some(i=>i.code==='obra_pendiente'));
});
test('clasificar habitaciones no modifica la geometría ni permite tipos desconocidos',()=>{
 const r={id:'room',type:'room',x:1,y:2,w:3,h:4};
 Audit.planRoom(r,'dormitorio');assert.equal(r.constructionRoom,'dormitorio');
 assert.deepEqual([r.x,r.y,r.w,r.h],[1,2,3,4]);
 Audit.planRoom(r,'');assert.equal(r.constructionRoom,undefined);
 assert.throws(()=>Audit.planRoom(r,'bodega'),/desconocida/);
 assert.throws(()=>Audit.planRoom({type:'wall'},'bano'),/Solo/);
});
