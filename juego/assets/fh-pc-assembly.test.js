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
test('Cualquier mesa de comedor sirve como estación con piezas en la misma casilla',()=>{
 const table={id:'mesa',type:'dining',modelId:'mesa_cocina_rectangular',x:10,y:10,w:1.1,h:.6};
 const loose=[
  {id:'m',modelId:'monitor_crt',x:10.05,y:10.04},
  {id:'k',modelId:'teclado_pc',x:10.06,y:10.12},
  {id:'r',modelId:'mouse_pc',x:10.22,y:10.10},
  {id:'c',modelId:'gabinete_pc',x:10.70,y:10.40}
 ];
 assert.equal(PC.isTerminalCandidate(table,[table,...loose],5),true);
 assert.equal(PC.inspect(table,[table,...loose],5).ready,true);
});
test('Un escritorio clásico y un escritorio en L sirven sin marcar pcTerminal',()=>{
 for(const modelId of ['escritorio_clasico','escritorio_l']){
  const table={id:'mesa',modelId,x:5,y:7,w:1.2,h:1};
  const parts=['monitor_crt','teclado_pc','mouse_pc','gabinete_pc'].map((id,i)=>({id:String(i),modelId:id,x:5.1,y:7.1}));
  assert.equal(PC.inspect(table,[table,...parts],5).ready,true);
  assert.equal(PC.isTerminalCandidate(table,[table,...parts],5),true);
 }
});
test('Se admiten componentes mezclados: soporte explícito y proximidad',()=>{
 const table={id:'mesa',type:'table',x:8,y:8,w:1,h:1};
 const parts=[
  {id:'monitor',modelId:'monitor_crt',x:8,y:8,support:{parentItemId:'mesa',surfaceId:'top'}},
  {id:'keyboard',modelId:'teclado_pc',x:8.2,y:8.1},
  {id:'mouse',modelId:'mouse_pc',x:8.4,y:8.1},
  {id:'cabinet',modelId:'gabinete_pc',x:8.2,y:8.9}
 ];
 assert.equal(PC.inspect(table,[table,...parts],5).ready,true);
});
test('El equipo no roba piezas vinculadas a otra mesa cercana',()=>{
 const left={id:'left',modelId:'escritorio_clasico',x:10,y:10,w:1,h:1};
 const right={id:'right',modelId:'mesa_pequena',x:10.8,y:10,w:.55,h:.55};
 const parts=[
  {id:'m',modelId:'monitor_crt',x:10.8,y:10,support:{parentItemId:'right',surfaceId:'top'}},
  {id:'k',modelId:'teclado_pc',x:10.8,y:10,support:{parentItemId:'right',surfaceId:'top'}},
  {id:'r',modelId:'mouse_pc',x:10.8,y:10,support:{parentItemId:'right',surfaceId:'top'}},
  {id:'c',modelId:'gabinete_pc',x:10.8,y:10.2}
 ];
 assert.deepEqual(PC.inspect(left,[left,right,...parts],5).missing.slice(0,3),['monitor','keyboard','mouse']);
 assert.equal(PC.inspect(right,[left,right,...parts],5).ready,true);
});
test('El monitor también funciona como terminal si no existe mesa y las piezas están cerca',()=>{
 const monitor={id:'m',modelId:'monitor_crt',x:2,y:2};
 const parts=[
  {id:'k',modelId:'teclado_pc',x:2.1,y:2.1},
  {id:'r',modelId:'mouse_pc',x:2.2,y:2.1},
  {id:'c',modelId:'gabinete_pc',x:2.2,y:2.3}
 ];
 assert.equal(PC.isTerminalCandidate(monitor,[monitor,...parts],5),true);
 assert.equal(PC.inspect(monitor,[monitor,...parts],5).ready,true);
});
test('Una pieza lejana no cuenta aunque esté en el mismo piso',()=>{
 const table={id:'mesa',type:'table',x:8,y:8,w:1,h:1};
 const parts=[
  {modelId:'monitor_crt',x:8,y:8},
  {modelId:'teclado_pc',x:8,y:8},
  {modelId:'mouse_pc',x:8,y:8},
  {modelId:'gabinete_pc',x:20,y:20}
 ];
 assert.deepEqual(PC.inspect(table,[table,...parts],5).missing,['cabinet']);
});
console.log(checks+' pruebas correctas');
