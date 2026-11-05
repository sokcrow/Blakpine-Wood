/* Ejecutar: node juego/assets/fh-pc-assembly.test.js */
const assert=require('node:assert/strict');
const PC=require('./fh-pc-assembly.js');
const desk={id:'desk',modelId:'escritorio_pc',x:10,y:10,w:.85,h:.5,rotation:0,pcAssemblyRequired:true};
const part=(id,parent='desk')=>({id,modelId:id,support:{parentItemId:parent,surfaceId:'desktop'}});
const monitor=part('monitor_crt'),keyboard=part('teclado_pc'),mouse=part('mouse_pc');
const floorCabinet={id:'tower',modelId:'gabinete_pc',placement:'floor',x:10.2,y:10.35};
const assembled=[desk,monitor,keyboard,mouse,floorCabinet];
let checks=0;
function test(label,fn){fn();checks++;console.log('OK',label)}
test('La PC reconoce pantalla, teclado y ratón sobre su escritorio y gabinete en el suelo',()=>{
 assert.equal(PC.inspect(desk,assembled,5).ready,true);
});
test('Un gabinete bajo el escritorio no necesita support ni estar encima',()=>{
 assert.equal(PC.cabinetNearDesk(floorCabinet,desk,5),true);
});
test('El gabinete también funciona sobre la superficie del escritorio',()=>{
 assert.equal(PC.inspect(desk,[desk,monitor,keyboard,mouse,part('gabinete_pc')],5).ready,true);
});
test('No cuenta un gabinete colocado lejos',()=>{
 const other={...floorCabinet,x:17,y:17};
 assert.deepEqual(PC.inspect(desk,[desk,monitor,keyboard,mouse,other],5).missing,['cabinet']);
});
test('No acepta piezas en el escritorio de otra computadora',()=>{
 const wrong=part('mouse_pc','other');
 assert.deepEqual(PC.inspect(desk,[desk,monitor,keyboard,wrong,floorCabinet],5).missing,['mouse']);
});
test('No confunde componentes de apartamentos distintos',()=>{
 const a={...desk,apartmentId:'casa_A'};
 const wrong={...monitor,apartmentId:'casa_B'};
 assert.deepEqual(PC.inspect(a,[a,wrong,keyboard,mouse,floorCabinet],5).missing,['monitor']);
});
test('La interacción sentada respeta frente y línea de visión',()=>{
 const seat={id:'chair',type:'chair',x:10,y:9,rotation:0};
 const pc={...desk,interact:{verb:'use'}};
 assert.equal(PC.frontTarget(seat,[pc],{cell:1.524,isPc:i=>i.modelId==='escritorio_pc',isClear:()=>true})?.item.id,'desk');
 assert.equal(PC.frontTarget({...seat,rotation:180},[pc],{cell:1.524,isPc:()=>true}),null);
 assert.equal(PC.frontTarget(seat,[pc],{cell:1.524,isPc:()=>true,isClear:()=>false}),null);
});
console.log(checks+' pruebas correctas');
