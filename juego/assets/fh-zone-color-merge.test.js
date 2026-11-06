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
  Math.min(e.a.y,e.b.y)<7-1e-6&&Math.max(e.a.y,e.b.y)>5+1e-6);
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
test('Colores automáticos siguen siendo únicos tras agotar los 18 iniciales',()=>{
 const world={floors:[{id:'p1',items:[]}],locationZones:[],properties:[]};
 const colors=new Set();
 for(let i=0;i<64;i++){
  const chosen=Z.nextColor(world,'p1');
  assert.equal(colors.has(chosen),false,'Color duplicado en zona '+(i+1));
  const result=Z.createLocation(world,'p1',{x:i,y:0},{x:i+1,y:2},100,10,
   'auto_'+i,'exterior',chosen);
  assert.equal(result.ok,true);
  assert.equal(result.created,true,'La zona '+(i+1)+' se fusionó accidentalmente');
  world.locationZones.push(result.zone);
  colors.add(chosen);
 }
 assert.equal(world.locationZones.length,64);
 assert.equal(colors.size,64);
});
test('Triángulo importado no se amplía por contacto falso con su caja exterior',()=>{
 const old={floors,locationZones:[{id:'triangle',floorId:'p1',kind:'exterior',
  color:'#AABBCC',name:'Triángulo',polygon:[{x:0,y:0},{x:4,y:0},{x:0,y:4}]}]};
 const result=Z.createLocation(old,'p1',{x:3,y:3},{x:4,y:4},30,30,
  'new','exterior','#AABBCC','triangle');
 assert.equal(result.ok,false);
 assert.equal(Z.zoneContains(old.locationZones[0],{x:3.5,y:3.5}),false);
});
test('Triángulo importado sí se amplía con una extensión que toca su borde real',()=>{
 const old={floors,locationZones:[{id:'triangle',floorId:'p1',kind:'exterior',
  color:'#AABBCC',name:'Triángulo',polygon:[{x:0,y:0},{x:4,y:0},{x:0,y:4}]}]};
 const result=Z.createLocation(old,'p1',{x:0,y:1},{x:1,y:3},30,30,
  'new','exterior','#AABBCC','triangle');
 assert.equal(result.ok,true);
 assert.equal(result.created,false);
 assert.equal(result.zone.id,'triangle');
});
test('Recoloración respeta contorno importado en lugar de su rectángulo envolvente',()=>{
 const first={id:'triangle',floorId:'p1',kind:'exterior',
  color:'#AABBCC',name:'Triángulo',polygon:[{x:0,y:0},{x:4,y:0},{x:0,y:4}]};
 const other={id:'out',floorId:'p1',kind:'exterior',
  color:'#99AA44',name:'Otro',polygon:Z.polygon({x:3,y:3,w:1,h:1})};
 const world={floors,locationZones:[first,other]};
 const edited=Z.recolorLocation(world,other,{kind:'exterior',color:'#AABBCC',name:'Otro'});
 assert.equal(edited.ok,true);
 assert.deepEqual(edited.removeIds,[]);
});
test('Recoloración sigue rechazando superposición geométrica verdadera',()=>{
 const tri={id:'triangle',floorId:'p1',kind:'exterior',
  color:'#AABBCC',name:'Triángulo',polygon:[{x:0,y:0},{x:4,y:0},{x:0,y:4}]};
 const inside={id:'inside',floorId:'p1',kind:'exterior',
  color:'#99AA44',name:'Otro',polygon:Z.polygon({x:1,y:1,w:1,h:1})};
 const world={floors,locationZones:[tri,inside]};
 const edited=Z.recolorLocation(world,inside,{kind:'exterior',color:'#AABBCC',name:'Otro'});
 assert.equal(edited.ok,false);
});
test('Zona triangular importada conserva diagonal en el contorno',()=>{
 const triangle={polygon:[{x:0,y:0},{x:4,y:0},{x:0,y:4}]};
 const edges=Z.boundarySegments(triangle);
 assert.equal(edges.length,3);
 const diagonal=edges.some(({a,b})=>
  (Math.abs(a.x-4)<1e-6&&Math.abs(a.y)<1e-6&&Math.abs(b.x)<1e-6&&Math.abs(b.y-4)<1e-6)||
  (Math.abs(b.x-4)<1e-6&&Math.abs(b.y)<1e-6&&Math.abs(a.x)<1e-6&&Math.abs(a.y-4)<1e-6));
 assert.equal(diagonal,true);
 assert.equal(edges.some(e=>e.a.x===4&&e.b.x===4),false);
 assert.equal(edges.some(e=>e.a.y===4&&e.b.y===4),false);
});
test('Polígono irregular importado mantiene sus aristas inclinadas',()=>{
 const poly={polygon:[{x:0,y:0},{x:5,y:0},{x:5,y:2},{x:3,y:4},{x:0,y:4}]};
 const edges=Z.boundarySegments(poly);
 assert.equal(edges.length,5);
 assert.equal(edges.some(e=>
  (e.a.x===5&&e.a.y===2&&e.b.x===3&&e.b.y===4)||
  (e.b.x===5&&e.b.y===2&&e.a.x===3&&e.a.y===4)),true);
});
test('Dos rectángulos compartiendo borde no generan costuras interiores',()=>{
 const zone={polygons:[Z.polygon({x:0,y:0,w:2,h:2}),Z.polygon({x:2,y:0,w:3,h:2})]};
 const edges=Z.boundarySegments(zone);
 const seam=edges.some(({a,b})=>Math.abs(a.x-2)<1e-6&&Math.abs(b.x-2)<1e-6);
 assert.equal(seam,false);
});
test('Dos triángulos importados con lado diagonal compartido eliminan la costura',()=>{
 const zone={polygons:[
  [{x:0,y:0},{x:4,y:0},{x:0,y:4}],
  [{x:4,y:0},{x:4,y:4},{x:0,y:4}]
 ]};
 const edges=Z.boundarySegments(zone);
 assert.equal(edges.some(e=>Math.abs(e.a.x+e.a.y-4)<1e-6&&
  Math.abs(e.b.x+e.b.y-4)<1e-6&&
  Math.hypot(e.a.x-e.b.x,e.a.y-e.b.y)>1),false);
});
test('Orientación mixta importada no cancela el relleno de un tramo solapado',()=>{
 const reverseTriangle=[{x:0,y:4},{x:4,y:0},{x:0,y:0}];
 const rect=Z.polygon({x:0,y:1,w:2,h:2});
 const zone={id:'mix',floorId:'p1',kind:'exterior',
  name:'Callejón',polygons:[reverseTriangle,rect],polygon:reverseTriangle};
 const untouched=JSON.stringify(zone.polygons);
 const area2=poly=>poly.reduce((sum,a,i)=>{
  const b=poly[(i+1)%poly.length];return sum+a.x*b.y-b.x*a.y;
 },0);
 const windingAt=(poly,pt)=>{
  let winding=0;
  for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length];
   const cross=(b.x-a.x)*(pt.y-a.y)-(b.y-a.y)*(pt.x-a.x);
   if(a.y<=pt.y&&b.y>pt.y&&cross>0)winding++;
   if(a.y>pt.y&&b.y<=pt.y&&cross<0)winding--;
  }
  return winding;
 };
 const point={x:0.5,y:1.5};
 assert.equal(zone.polygons.reduce((n,p)=>n+windingAt(p,point),0),0,
  'Este caso debe reproducir la cancelación previa del Canvas no-zero winding');
 const oriented=Z.orientedPieces(zone);
 assert(oriented.every(poly=>area2(poly)>0));
 assert.notEqual(oriented.reduce((n,p)=>n+windingAt(p,point),0),0);
 assert.equal(JSON.stringify(zone.polygons),untouched,'No debe modificar los datos del mapa');
 assert.equal(Z.zoneContains(zone,point),true);
});
test('Normalización preserva la geometría y el orden almacenado del polígono legado',()=>{
 const imported=[{x:0,y:4},{x:4,y:0},{x:0,y:0}];
 const zone={polygon:imported};
 const oriented=Z.orientedPieces(zone);
 assert.equal(oriented.length,1);
 assert.deepEqual(oriented[0],[...imported].reverse());
 assert.notStrictEqual(oriented[0],imported);
 assert.deepEqual(zone.polygon,imported);
});
console.log(passed+' pruebas correctas');
