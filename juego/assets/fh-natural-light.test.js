'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Natural=require('./fh-natural-light.js');

const units={columns:12,rows:12,feetPerCell:5};
const line=(type,x1,y1,x2,y2,id)=>({type,id,a:{x:x1,y:y1},b:{x:x2,y:y2}});
const roomWithWestWindow=(kind='window')=>[
 line('red_wall',3,3,7,3),line('red_wall',7,3,7,7),
 line('red_wall',7,7,3,7),line('red_wall',3,3,3,4),
 line(kind,3,4,3,5,'portal'),line('red_wall',3,5,3,7)
];
function level(items,name='F1',elevationFt=0){return {name,elevationFt,items}}
function sample(result,x,y){
 const i=Math.floor(y*result.scale)*result.width+Math.floor(x*result.scale);
 return result.access[i]||0;
}
test('el sol domina al mediodía, cae al anochecer y la luna es un porcentaje pequeño',()=>{
 const noon=Natural.lightAt(720),night=Natural.lightAt(0),sunset=Natural.lightAt(1080);
 assert.ok(noon.sun>.9);
 assert.equal(noon.moon,0);
 assert.equal(night.sun,0);
 assert.ok(night.moon>0&&night.moon<=.13);
 assert.ok(sunset.sun<noon.sun);
 assert.deepEqual(Natural.lightAt(720),Natural.lightAt(720+1440));
});
test('un exterior sin barreras recibe luz natural de cobertura total',()=>{
 const m=Natural.computeAccess(level([]),units);
 assert.equal(m.exterior,m.width*m.height);
 assert.equal(sample(m,1,1),255);
});
test('una habitación cerrada no recibe sol ni luna en su interior',()=>{
 const items=roomWithWestWindow().map(it=>it.type==='window'?{...it,type:'red_wall'}:it);
 const m=Natural.computeAccess(level(items),units);
 assert.equal(sample(m,4,4.5),0);
 assert.equal(sample(m,2,4.5),255);
});
test('la ventana conectada al exterior permite una luz decreciente en el interior',()=>{
 const m=Natural.computeAccess(level(roomWithWestWindow()),units);
 assert.ok(sample(m,3.6,4.5)>0);
 assert.ok(sample(m,3.6,4.5)>sample(m,5.9,5.5));
 assert.equal(sample(m,2.5,4.5),255);
});
test('la luz que entra por ventana no atraviesa una pared interior',()=>{
 const items=[...roomWithWestWindow(),line('wall',5,3,5,7)];
 const m=Natural.computeAccess(level(items),units);
 assert.ok(sample(m,4,4.5)>0);
 assert.equal(sample(m,6,4.5),0);
});
test('las puertas cerradas no permiten luz natural, y las abiertas sí',()=>{
 const floor=level(roomWithWestWindow('door'));
 const closed=Natural.computeAccess(floor,units,{doorOpen:()=>false});
 const opened=Natural.computeAccess(floor,units,{doorOpen:()=>true});
 assert.equal(sample(closed,3.6,4.5),0);
 assert.ok(sample(opened,3.6,4.5)>0);
});
test('B1, Sótano y elevaciones negativas quedan completamente sin luz natural',()=>{
 for(const f of [
  level(roomWithWestWindow(),'B1',0),
  level(roomWithWestWindow(),'Sótano 2',0),
  level(roomWithWestWindow(),'F1',-12)
 ]){
  assert.equal(Natural.isBasement(f),true);
  const mask=Natural.computeAccess(f,units);
  assert.equal(mask.access.some(Boolean),false);
 }
 assert.equal(Natural.isBasement(level([],'F1',0)),false);
 assert.equal(Natural.isBasement(level([],'F2',12)),false);
});
test('calcular la máscara no altera objetos ni crea luminarias',()=>{
 const floor=level(roomWithWestWindow()),original=JSON.stringify(floor);
 Natural.computeAccess(floor,units);
 assert.equal(JSON.stringify(floor),original);
});
test('el adaptador 3D registra el módulo sin modificar los fragmentos Base64',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
 assert.match(html,/function addNaturalLightToEngine\(doc\)/);
 assert.match(html,/const assembled=\(window\.FHContextEngine/);
 assert.match(html,/return addNaturalLightToEngine\(assembled\)/);
 assert.match(html,/fhNatural\?\.update\(\)/);
 assert.match(html,/fh-natural-light\.js/);
});
