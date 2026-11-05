/* Ejecutar: node juego/assets/fh-surface-editor.test.js */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const S=require('./fh-surface-placement.js');
const source=fs.readFileSync(path.join(__dirname,'fh-surface-editor.js'),'utf8');
function setup(){
 const desk={id:'desk',type:'misc',modelId:'escritorio_pc',x:10,y:10,rotation:0,
  supportSurfaces:[{id:'desktop',widthFt:4,depthFt:2,heightFt:2.75}]};
 const items=[desk];
 const context={
  window:{FHSurfacePlacement:S,FHFurnitureRules:{
   supportSurfacesFor:item=>item.supportSurfaces||[],normalizePlacement:()=>false
  },FH_CATALOG_TEXT:{}},
  project:{units:{feetPerCell:5}},current:()=>({items}),
  createObject:(type,pos)=>({id:'new',type,...pos,w:.1,h:.1,rotation:0,placement:'surface'}),
  moveItem:(item,delta,original)=>{item.x=Math.round(original.x+delta.x);item.y=Math.round(original.y+delta.y)},
  changeFloor:()=>{},toast:()=>{},clone:value=>JSON.parse(JSON.stringify(value))
 };
 vm.runInNewContext(source,context,{filename:'fh-surface-editor.js'});
 return {items,desk,editor:context};
}
let checks=0;
function test(name,fn){fn();checks++;console.log('OK',name)}
test('Movimiento fino del mouse pese al snap por casilla del editor',()=>{
 const {items,editor}=setup();
 const mouse={id:'mouse',type:'misc',placement:'surface',x:10,y:10,w:.1,h:.1,rotation:0};
 items.push(mouse);
 editor.moveItem(mouse,{x:.10,y:.06},{...mouse});
 assert.ok(Math.abs(mouse.x-10.1)<1e-6);
 assert.ok(Math.abs(mouse.y-10.06)<1e-6);
 assert.equal(mouse.support.parentItemId,'desk');
});
test('Mover al borde ajusta el centro para no atravesar el tablero',()=>{
 const {items,editor}=setup();
 const keyboard={id:'keyboard',type:'misc',placement:'surface',x:10,y:10,w:.3,h:.1,rotation:0};
 items.push(keyboard);
 editor.moveItem(keyboard,{x:.39,y:.18},{...keyboard});
 assert.ok(Math.abs(keyboard.x-10.25)<1e-6);
 assert.ok(Math.abs(keyboard.y-10.15)<1e-6);
});
test('Si se arrastra fuera del escritorio, surface conserva su posición válida',()=>{
 const {items,editor}=setup();
 const mouse={id:'mouse',type:'misc',placement:'surface',x:10,y:10,w:.1,h:.1,rotation:0};
 items.push(mouse);
 const original={...mouse};
 editor.moveItem(mouse,{x:1.2,y:0},original);
 assert.equal(mouse.x,original.x);
 assert.equal(mouse.y,original.y);
});
test('Un objeto floor_or_surface usa el snap del suelo al despegarse',()=>{
 const {items,editor}=setup();
 const tv={id:'tv',type:'tv',placement:'floor_or_surface',x:10,y:10,w:.2,h:.1,rotation:0,
  support:{parentItemId:'desk',surfaceId:'desktop',offsetXFt:0,offsetZFt:0,rotationOffsetDeg:0}};
 items.push(tv);
 editor.moveItem(tv,{x:1.4,y:0},JSON.parse(JSON.stringify(tv)));
 assert.equal(tv.x,11);
 assert.equal(tv.support,undefined);
});
test('Crear objeto de superficie registra el soporte y la altura 3D',()=>{
 const {items,editor}=setup();
 const object=editor.createObject('misc',{x:10.11,y:10.05});
 assert.equal(object.support.parentItemId,'desk');
 const pose=S.worldPose([...items,object],object,5,i=>i.supportSurfaces||[]);
 assert.equal(pose.heightFt,2.75);
});
console.log(checks+' pruebas correctas');
