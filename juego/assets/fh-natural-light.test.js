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
test('visión: día sin filtro exterior y noche con oscuridad parcialmente translúcida',()=>{
 const midday=Natural.sightStrength(12*60),morning=Natural.sightStrength(8*60),night=Natural.sightStrength(0);
 assert.equal(midday,1,'el mediodía no oscurece el exterior');
 assert.equal(morning,1,'durante el día normal no se impone un filtro');
 assert.ok(night>=.20&&night<=.32,'la noche mantiene oscuridad, pero no negro total');
 assert.ok(night<midday*.5,'la luna no equivale a la iluminación solar');
 assert.ok(Natural.sightStrength(18*60)<midday);
});
test('la luz natural se suma a la linterna y se atenúa de forma espacial',()=>{
 const THREE={
  Color:class {setRGB(r,g,b){this.rgb=[r,g,b]}},
  DataTexture:class{constructor(data,w,h){this.image={data,width:w,height:h}}dispose(){}},
  RGBAFormat:1,LinearFilter:2
 };
 const backup=global.document,frames=[];
 global.document={createElement:()=>({
  width:0,height:0,
  getContext(){
   return {createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)}},
    putImageData(image){frames.push(Uint8ClampedArray.from(image.data))}};
  }
 })};
 const mins={value:720};
 const room=level(roomWithWestWindow()),floors=[room];
 try{
  const runtime=Natural.createRuntime({THREE,DATA:{floors,units},CELL:1,
   scene:{traverse(){}},floor:()=>0,clock:()=>mins.value});
  const scale=2,width=units.columns*scale;
  const pixel=(frame,x,y)=>frame[(Math.floor(y*scale)*width+Math.floor(x*scale))*4];
  assert.equal(pixel(frames.at(-1),2,4.5),255,'día exterior sin filtro');
  assert.ok(pixel(frames.at(-1),3.6,4.5)>0&&pixel(frames.at(-1),3.6,4.5)<255,
   'la luz de ventana es tenue, no una luz blanca total');
  assert.equal(pixel(frames.at(-1),8,4.5),255,'otro exterior sigue a plena luz');
  let mode='source-over',sampledMode='',draws=0;
  const ctx={save(){},restore(){},get globalCompositeOperation(){return mode},
   set globalCompositeOperation(value){mode=value},
   drawImage(){sampledMode=mode;draws++}};
  runtime.paintSight(ctx,300,400);
  assert.equal(sampledMode,'lighten','la máscara solar se suma a lámparas/linterna');
  assert.equal(mode,'source-over','el modo de mezcla anterior se restaura');
  mins.value=0;assert.equal(runtime.update(),true);
  assert.ok(pixel(frames.at(-1),2,4.5)>=45&&pixel(frames.at(-1),2,4.5)<=85,
   'por la noche el exterior conserva luz lunar tenue');
  assert.ok(pixel(frames.at(-1),3.6,4.5)<pixel(frames.at(-1),2,4.5),
   'la luz lunar también pierde intensidad al entrar');
  assert.equal(draws,1);
  runtime.dispose();
 }finally{if(backup===undefined)delete global.document;else global.document=backup}
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

test('P2: una habitación cerrada sobre el límite de la cuadrícula NO es exterior',()=>{
 const walls=[line('red_wall',0,0,4,0),line('red_wall',4,0,4,4),
  line('red_wall',4,4,0,4),line('red_wall',0,4,0,0)];
 const mask=Natural.computeAccess(level(walls),units);
 assert.equal(sample(mask,2,2),0);
 assert.equal(sample(mask,5,5),255);
});
test('P2: las ventanas y puertas transparentes del borde dejan pasar la luz',()=>{
 const frame=[line('red_wall',0,0,4,0),line('red_wall',4,0,4,4),
  line('red_wall',4,4,0,4)];
 for(const entry of [
  {...line('window',0,4,0,0,'border')},
  {...line('door',0,4,0,0,'border'),variant:'glass'},
  {...line('door',0,4,0,0,'border'),variant:'storefront'}
 ]){
  const mask=Natural.computeAccess(level([...frame,entry]),units,{doorOpen:()=>false});
  assert.ok(sample(mask,1,2)>0,'debe transmitir luz: '+entry.type+'/'+entry.variant);
  assert.equal(sample(mask,5,5),255);
 }
 const closed=Natural.computeAccess(level([...frame,line('door',0,4,0,0,'border')]),units,{doorOpen:()=>false});
 assert.equal(sample(closed,1,2),0);
});
test('P1: consulta de luz natural mantiene interiores oscuros y respeta sótanos',()=>{
 const THREE={
  Color:class {setRGB(r,g,b){this.rgb=[r,g,b]}},
  DataTexture:class{constructor(data,w,h){this.image={data,width:w,height:h}}dispose(){}},
  RGBAFormat:1,LinearFilter:2
 };
 const originalDocument=global.document;
 let painted=0;
 global.document={createElement:()=>({
  width:0,height:0,getContext(){return {
   createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)}},
   putImageData(){painted++}
  }}
 })};
 try{
  const floors=[level(roomWithWestWindow(),'F1',0),level(roomWithWestWindow(),'B1',-12)];
  let floorIndex=0,minutes=720;
  const runtime=Natural.createRuntime({THREE,DATA:{floors,units},CELL:1,scene:{traverse(){}},
   ambient:{intensity:.26},floor:()=>floorIndex,clock:()=>minutes});
  assert.equal(runtime.hasLight(),true);
  assert.equal(runtime.illuminates(2,2),true);
  assert.equal(runtime.illuminates(3.6,4.5),true);
  assert.equal(runtime.illuminates(5,8),true);
  assert.equal(runtime.illuminates(5,5),true);
  // Cuarto cerrado para verificar el predicado que se usa al dibujar FOW.
  const opaque=Natural.createRuntime({THREE,DATA:{floors:[level(
   roomWithWestWindow().map(it=>it.type==='window'?{...it,type:'red_wall'}:it)
   )],units},CELL:1,scene:{traverse(){}},floor:()=>0,clock:()=>minutes});
  assert.equal(opaque.illuminates(4,4.5),false);
  opaque.dispose();
  assert.ok(painted>=2,'la máscara 2D se creó para la textura de visibilidad');
  let drawCount=0;
  runtime.paintSight({drawImage(){drawCount++}},300,400);
  assert.equal(drawCount,1);
  floorIndex=1;assert.equal(runtime.update(),true);
  assert.equal(runtime.hasLight(),false);
  assert.equal(runtime.illuminates(2,2),false);
  runtime.paintSight({drawImage(){drawCount++}},300,400);
  assert.equal(drawCount,1,'los sótanos no pintan luz natural en FOW');
  runtime.dispose();
 }finally{if(originalDocument===undefined)delete global.document;else global.document=originalDocument}
});
test('P1: el motor conecta la visión de objetos, FOW y la luz natural',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
 assert.match(html,/fhNatural\?\.illuminates\(x,z\)/);
 assert.match(html,/fhNatural\?\.paintSight\(q,sightCanvas\.width,sightCanvas\.height\)/);
 assert.match(html,/fhNatural\?\.hasLight\(\)/);
 assert.match(html,/if\(fhNatural\?\.update\(\)\)visibilityDirty=true/);
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
