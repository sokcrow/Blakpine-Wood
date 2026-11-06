/* Regresión de Zonas · color + fusión de rectángulos (incluye T). */
'use strict';
const assert=require('node:assert/strict');
const Z=require('./fh-property-zones.js'),H=require('./fh-location-hud.js');
const P=require('./fh-style-property.js');
const floors=[{id:'p1',elevationFt:0,items:[]}];
const project={title:'Complejo',floors,properties:[],locationZones:[]};
const draw=(x1,y1,x2,y2,id,kind,color,extendId='')=>{
 const result=Z.createLocation(project,'p1',{x:x1,y:y1},{x:x2,y:y2},30,30,id,kind,color,extendId);
 if(result.ok){
  project.locationZones=project.locationZones.filter(z=>!result.removeIds.includes(z.id))
   .map(z=>z.id===result.zone.id?result.zone:z);
  if(result.created)project.locationZones.push(result.zone);
 }
 return result;
};
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS '+name)};
test('Primera zona exterior tiene nombre, identidad y color propios',()=>{
 const a=draw(2,2,5,10,'alley','exterior','#AABBCC');
 assert.equal(a.ok,true);assert.equal(a.created,true);
 assert.equal(a.zone.color,'#AABBCC');
 project.locationZones[0].name='Callejón';
});
test('Tramo del mismo color y tipo se une en T con el mismo ID',()=>{
 const b=draw(0,5,8,7,'ignored','exterior','#AABBCC','alley');
 assert.equal(b.ok,true);assert.equal(b.created,false);
 assert.equal(b.zone.id,'alley');
 assert.equal(project.locationZones.length,1);
 assert.equal(project.locationZones[0].name,'Callejón');
 assert.equal(Z.pieces(b.zone).length,2);
});
test('HUD exterior encuentra todos los brazos y no el espacio fuera de la T',()=>{
 for(const p of [{x:3,y:3},{x:1,y:6},{x:7,y:6}]){
  const v=H.resolve(project,0,p,P);
  assert.deepEqual([v.kind,v.primary,v.secondary,v.floorCode],['exterior','EXTERIOR','Callejón','']);
 }
 assert.equal(Z.zoneContains(project.locationZones[0],{x:1,y:3}),false);
});
test('El contorno no incluye bordes internos de los tramos unidos',()=>{
 const edges=Z.boundarySegments(project.locationZones[0]);
 assert(edges.length>=8);
 const onJoinedSeam=edges.some(e=>Math.abs(e.a.x-2)<1e-6&&Math.abs(e.b.x-2)<1e-6&&
  e.a.y>=5&&e.b.y<=7);
 assert.equal(onJoinedSeam,false);
});
test('Zona de distinto color no puede solaparse con la T',()=>{
 const other=draw(4,4,6,9,'other','exterior','#DDAABB');
 assert.equal(other.ok,false);
 assert.equal(project.locationZones.length,1);
});
test('Zona común tampoco puede solaparse con zona exterior',()=>{
 const other=draw(3,8,5,12,'common','common','#CCCCAA');
 assert.equal(other.ok,false);
});
test('Colores diferentes y zona contigua: entidades separadas',()=>{
 const a=draw(8,5,10,7,'new','common','#CCDDAA');
 assert.equal(a.ok,true);
 assert.equal(project.locationZones.length,2);
});
test('Ampliar una zona exige contacto real, no punto aislado',()=>{
 const disjoint=draw(20,20,22,22,'fake','exterior','#AABBCC','alley');
 assert.equal(disjoint.ok,false);
 const cornerOnly=draw(8,7,11,10,'fake','exterior','#AABBCC','alley');
 assert.equal(cornerOnly.ok,false);
});
test('Cambiar color a uno que toca zona de su tipo fusiona IDs',()=>{
 const rect=draw(10,5,12,7,'second','common','#8899AA');
 assert.equal(rect.ok,true);
 const zone=project.locationZones.find(z=>z.id==='second');
 const edited=Z.recolorLocation(project,zone,{kind:'common',color:'#CCDDAA',name:'Pasillo Este'});
 assert.equal(edited.ok,true);
 assert.deepEqual(edited.removeIds,['new']);
 assert.equal(edited.zone.id,'second');
 assert.equal(edited.zone.name,'Pasillo Este');
});
test('Colores por defecto evitan fusión accidental entre zonas nuevas',()=>{
 const a=Z.nextColor(project,'p1');
 const built=Z.createLocation(project,'p1',{x:15,y:1},{x:18,y:3},30,30,'other1','exterior',a);
 assert.equal(built.ok,true);
 assert(!project.locationZones.some(z=>Z.colorOf(z)===a));
});
test('Datos antiguos con polygon sin polygons siguen funcionando',()=>{
 const old={id:'legacy',floorId:'p1',kind:'exterior',name:'Patio',polygon:[
  {x:22,y:0},{x:25,y:0},{x:25,y:2},{x:22,y:2}]};
 assert.equal(Z.zoneContains(old,{x:23,y:1}),true);
 assert.equal(Z.pieces(old).length,1);
});
console.log(passed+' pruebas correctas');
