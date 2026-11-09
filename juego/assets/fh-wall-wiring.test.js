'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const FH=require('./fh-services-core.js');
const editor=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const segment=(type,x1,y1,x2,y2,id=type)=>({id,type,a:{x:x1,y:y1},b:{x:x2,y:y2}});
const origin={x:0,y:0},target={x:3,y:2};
function wallRun(type='window',length=.66){
 return [segment('wall',0,0,1,0,'left'),segment(type,1,0,1+length,0,'portal'),
  segment('red_wall',1+length,0,3,0,'right'),segment('wall',3,0,3,2,'corner')];
}
function network(type='window'){
 const breaker={id:'breaker',type:'breaker_panel',...origin,circuits:[{zoneId:'a',rangeFt:30}]};
 const socket={id:'socket',type:'power_outlet',...target,zoneId:'a'};
 const router={id:'router',type:'router',...origin,ethernetLengthFt:30,ethernetLeadFt:0};
 const port={id:'port',type:'ethernet_port',...target};
 const project={units:{feetPerCell:5},floors:[{id:'f0',items:[...wallRun(type),breaker,socket,router,port]}]};
 return {project,breaker,socket,router,port};
}

for(const type of ['window']){
 test(type+': el recorrido continúa por el tramo recortado y gira en la esquina',()=>{
  const items=wallRun(type),before=JSON.stringify(items),graph=FH.wallGraph(items);
  const route=graph.routeDetailed(origin,target,0);
  assert.ok(route,'el hueco del muro no debe cortar la instalación');
  assert.equal(route.length,5);
  assert.ok(route.points.some(p=>Math.abs(p.x-1.66)<1e-6&&p.y===0),'incluye el extremo del portal de 0.66');
  for(let i=1;i<route.points.length;i++){
   const a=route.points[i-1],b=route.points[i];
   assert.ok(a.y===0&&b.y===0||a.x===3&&b.x===3,'no tomar una diagonal por el cuarto');
  }
  assert.equal(JSON.stringify(items),before,'no ensanchar ni editar ventanas/puertas');
 });
 test(type+': la conexión efectiva y el dibujo comparten el mismo recorrido',()=>{
  const {project,breaker,socket,router,port}=network(type),state={};
  const runtime=FH.createRuntime(project,state),graph=runtime.graphs[0];
  assert.equal(runtime.sourceFor(0,socket,'a').panel.id,breaker.id);
  assert.equal(runtime.statusFor(0,socket).power.powered,true);
  assert.deepEqual(runtime.wiredRoute(0,router,port,30).points,graph.routeDetailed(origin,target,0).points);
  breaker.circuits[0].rangeFt=24.9;
  assert.equal(FH.createRuntime(project,{}).statusFor(0,socket).power.powered,false,'se conserva el alcance por pared');
  state.flags={'power_zone:a':false};
  assert.equal(runtime.statusFor(0,socket).power.powered,false,'se conserva el apagado del breaker');
 });
}

for(const type of ['door','peephole_door','opening']){
 test(type+': el hueco corta el recorrido sin fabricar una conexión',()=>{
  const graph=FH.wallGraph(wallRun(type));
  assert.equal(graph.routeDetailed(origin,target,0),null);
 });
 test(type+': la puerta no interfiere con electricidad; las otras redes conservan su trazado',()=>{
  const {project,socket,router,port}=network(type),runtime=FH.createRuntime(project,{});
  assert.ok(runtime.sourceFor(0,socket,'a'));
  assert.equal(runtime.statusFor(0,socket).power.powered,true);
  assert.equal(runtime.wiredRoute(0,router,port,30),null);
 });
}

test('las puertas abiertas o cerradas cortan el tramo de cableado',()=>{
 for(const type of ['door','peephole_door'])for(const open of [false,true]){
  const items=wallRun(type,1),door=items.find(it=>it.id==='portal');
  Object.assign(door,{open,locked:true,variant:'metal',partialOpen:.5});
  assert.equal(FH.wallGraph(items).routeDetailed(origin,target,0),null);
 }
});
test('una puerta obliga a rodear por otras paredes cuando existe un recorrido alternativo',()=>{
 const items=[...wallRun('door',1),segment('wall',0,0,0,3),
  segment('wall',0,3,3,3),segment('wall',3,3,3,2)];
 const route=FH.wallGraph(items).routeDetailed(origin,target,0);
 assert.ok(route);assert.equal(route.length,7);
 assert.ok(route.points.some(p=>p.y===3),'recorre la pared alternativa, no el hueco de puerta');
});
test('ventanas verticales, diagonales e invertidas conservan sus extremos reales',()=>{
 for(const mapPoint of [p=>({x:p.x,y:p.y}),p=>({x:p.y,y:p.x}),p=>({x:p.x,y:p.x})]){
  const items=[segment('wall',0,0,1,0),segment('window',1.66,0,1,0),segment('wall',1.66,0,3,0)];
  for(const it of items){it.a=mapPoint(it.a);it.b=mapPoint(it.b)}
  const a=mapPoint(origin),b=mapPoint({x:3,y:0});
  assert.ok(Math.abs(FH.wallGraph(items).route(a,b,0)-Math.hypot(b.x-a.x,b.y-a.y))<1e-6);
 }
});
test('un hueco sin portal sigue desconectado y los portales aislados no unen paredes lejanas',()=>{
 const items=wallRun().filter(it=>it.id!=='portal');
 assert.equal(FH.wallGraph(items).routeDetailed(origin,target,0),null);
 items.push(segment('window',1,1,1.66,1));
 assert.equal(FH.wallGraph(items).routeDetailed(origin,target,0),null);
});
test('los portales no se convierten en paredes opacas ni alteran los contadores de barreras',()=>{
 for(const type of ['window','door','peephole_door','opening']){
  const graph=FH.wallGraph(wallRun(type));
  assert.equal(graph.wallCount,3);
  assert.equal(graph.wallsBetween({x:1.3,y:-1},{x:1.3,y:1}),0);
  assert.equal(graph.wallsBetween({x:.5,y:-1},{x:.5,y:1}),1);
 }
});

function overlayEnvironment(project){
 const context=vm.createContext({window:{FHServices:FH},project,floorIndex:0,
  current:()=>project.floors[0],selectedCircuit:()=> 'a',
  availableCircuits:()=>[{zoneId:'a',panelId:'breaker',circuitColor:'#ff0000'}],
  $:()=>({checked:false}),toPixel:p=>({...p})});
 const from=editor.indexOf('const utilityVisualCache='),to=editor.indexOf('function drawUtilityNetworkOverlay(',from);
 assert.ok(from>=0&&to>from);
 vm.runInContext(editor.slice(from,to),context);
 return context;
}
test('la caché se reconstruye al editar una ventana o convertirla en puerta/abertura',()=>{
 for(const type of ['window']){
  const {project}=network(type),ctx=overlayEnvironment(project);
  const route=()=>ctx.utilityVisual().graph.routeDetailed(origin,target,0);
  assert.ok(route());
  const items=project.floors[0].items,index=items.findIndex(it=>it.id==='portal');
  const [portal]=items.splice(index,1);assert.equal(route(),null);
  items.push(portal);assert.ok(route());
  portal.a.y=1;portal.b.y=1;assert.equal(route(),null);
  portal.a.y=0;portal.b.y=0;assert.ok(route());
  for(const blockedType of ['door','peephole_door','opening']){
   portal.type=blockedType;assert.ok(route());
   portal.type='window';assert.ok(route());
  }
 }
});
test('el overlay eléctrico continúa por ventanas, puertas y aberturas',()=>{
 for(const type of ['window','door','peephole_door','opening']){
  const {project}=network(type),ctx=overlayEnvironment(project),lines=[];
  let from=null,to=null;
  const canvas={save(){},restore(){},beginPath(){from=to=null},
   moveTo(x,y){from={x,y}},lineTo(x,y){to={x,y}},stroke(){if(from&&to)lines.push({from,to})},arc(){},fill(){}};
  ctx.drawLightingOverlay(canvas,1);
  assert.ok(lines.some(l=>l.from.x===1&&Math.abs(l.to.x-1.66)<1e-6&&l.from.y===0&&l.to.y===0));
  assert.equal(lines.reduce((sum,l)=>sum+Math.hypot(l.to.x-l.from.x,l.to.y-l.from.y),0),5);
 }
});
test('editor y motor 3D cargan la misma versión corregida del grafo',()=>{
 const hook=fs.readFileSync(path.join(__dirname,'fh-services-engine-hook.js'),'utf8');
 const version='fh-services-core.js?v=20261109-cable-length-6';
 assert.ok(editor.includes(version));assert.ok(hook.includes(version));
 assert.ok(editor.includes('fh-services-engine-hook.js?v=20261109-cable-length-6'));
});
test('el plano omite las lámparas del otro tramo y las que superan el alcance',()=>{
 const {project,breaker}=network('door');
 breaker.circuits[0].rangeFt=8;
 project.floors[0].items.push(...[.3,.7,2,2.5].map((x,i)=>({id:'lamp-'+i,type:'light_fixture',zoneId:'a',x,y:.2})));
 const ctx=overlayEnvironment(project),lines=[];
 let from=null,to=null;
 const canvas={save(){},restore(){},beginPath(){from=to=null},
  moveTo(x,y){from={x,y}},lineTo(x,y){to={x,y}},stroke(){if(from&&to)lines.push({from,to})},arc(){},fill(){}};
 ctx.drawLightingOverlay(canvas,1);
 assert.equal(lines.length,4);
 assert.ok(lines.every(l=>l.to.x<=1&&l.to.y<=.2));
 breaker.circuits[0].rangeFt=3;
 lines.length=0;ctx.drawLightingOverlay(canvas,1);
 assert.equal(lines.length,2);assert.equal(lines[0].to.x,.3);
});
