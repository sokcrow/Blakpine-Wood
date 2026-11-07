'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Courier=require('./fh-npc-courier.js');

function makeWorld({portals=[{id:'gate',floor:0,x:0,z:0}],walls=new Set(),floors=1,transitions=[]}={}){
 const seen=[],poses=[],arrivals=[],exits=[],blocked=[];
 const canWalk=(f,x,z)=>f>=0&&f<floors&&x>=0&&z>=0&&x<=6&&z<=6&&!walls.has(f+':'+Math.round(x)+':'+Math.round(z));
 const runtime=Courier.createRuntime({
  speed:10,step:1,portals:()=>portals,transitions:()=>transitions,canWalk,
  spawn:p=>seen.push({...p,spawn:true}),position:p=>seen.push({...p}),pose:p=>poses.push(p),
  arrived:id=>arrivals.push(id),exited:id=>exits.push(id),blocked:id=>blocked.push(id)
 });
 const advance=(ticks=100)=>{for(let i=0;i<ticks;i++)runtime.tick(.1)};
 return {runtime,advance,seen,poses,arrivals,exits,blocked};
}
test('Portal NPC: GOAP recorre hasta la puerta, espera al jugador y vuelve a salir',()=>{
 const w=makeWorld();
 assert.equal(w.runtime.start('pedido1',{floor:0,x:5,z:0}),true);
 assert.equal(w.runtime.stage,'incoming');
 assert.equal(w.runtime.snapshot.entregado,false);
 w.advance();
 assert.deepEqual(w.arrivals,['pedido1']);
 assert.equal(w.runtime.stage,'waiting');
 assert.equal(w.runtime.snapshot.entregado,false,'la ruta no entrega el pedido');
 assert.equal(w.runtime.delivered('pedido1'),true);
 w.advance();
 assert.deepEqual(w.exits,['pedido1']);
 assert.equal(w.runtime.active,false);
 assert.equal(w.poses.at(0),'walk');
 assert.ok(w.seen.some(p=>p.x>=5));
});
test('A* rodea una pared sin cruzar obstáculos',()=>{
 const walls=new Set(['0:2:0','0:2:1','0:2:2','0:2:3']);
 const w=makeWorld({walls});
 assert.equal(w.runtime.start('pedido2',{floor:0,x:4,z:0}),true);
 w.advance(140);
 assert.equal(w.runtime.stage,'waiting');
 for(const p of w.seen)assert.equal(walls.has(p.floor+':'+Math.round(p.x)+':'+Math.round(p.z)),false);
});
test('Sin entrada NPC conserva compatibilidad de mapas antiguos',()=>{
 const w=makeWorld({portals:[]});
 assert.equal(w.runtime.start('pedido3',{floor:0,x:3,z:3}),null);
 assert.equal(w.runtime.active,false);
});
test('Portal inválido o destino aislado no simula llegada',()=>{
 const w=makeWorld({portals:[{floor:0,x:-1,z:0}]});
 assert.equal(w.runtime.start('pedido4',{floor:0,x:3,z:3}),false);
 assert.deepEqual(w.arrivals,[]);assert.deepEqual(w.blocked,['pedido4']);
});
test('Dos pisos requieren una conexión explícita',()=>{
 const source={floor:0,x:1,z:1},target={floor:1,x:4,z:1};
 const missing=makeWorld({floors:2,portals:[source]});
 assert.equal(missing.runtime.start('pedido5',target),false);
 const w=makeWorld({floors:2,portals:[source],transitions:[{from:{floor:0,x:2,z:2},to:{floor:1,x:2,z:2}}]});
 assert.equal(w.runtime.start('pedido5',target),true);
 w.advance(120);
 assert.equal(w.runtime.stage,'waiting');assert.ok(w.seen.some(p=>p.floor===1));
 assert.equal(w.runtime.delivered('pedido5'),true);
 w.advance(120);assert.equal(w.runtime.active,false);assert.ok(w.seen.some(p=>p.floor===0&&p.x===1));
});

test('El repartidor abre dos puertas comunes del corredor en secuencia sin atravesarlas cerradas',()=>{
 const doors=new Map([[2,false],[4,false]]),opened=[],positions=[];
 const permitted=(f,x,z)=>f===0&&x>=0&&x<=6&&z>=0&&z<=1;
 const canWalk=(f,x,z)=>permitted(f,x,z)&&![...doors].some(([at,isOpen])=>!isOpen&&Math.abs(x-at)<.26);
 const courier=Courier.createRuntime({
  speed:3,step:.5,
  portals:()=>[{floor:0,x:.5,z:.5}],transitions:()=>[],
  canWalk,canPlanWalk:permitted,
  openDoor:({floor,x,from})=>{
   const entry=[...doors].find(([at,open])=>!open&&Math.abs(x-at)<.26&&Math.abs(from.x-at)<1.25);
   if(!entry||floor!==0)return false;
   doors.set(entry[0],true);opened.push(entry[0]);return true;
  },
  position:p=>{positions.push({...p});assert.equal(canWalk(p.floor,p.x,p.z),true,'no puede entrar a una puerta cerrada');},
  arrived:()=>{},exited:()=>{}
 });
 assert.equal(courier.start('pedido-puertas',{floor:0,x:5.5,z:.5}),true);
 for(let i=0;i<250&&courier.stage!=='waiting';i++)courier.tick(.1);
 assert.equal(courier.stage,'waiting');
 assert.deepEqual(opened,[2,4]);
 assert.ok(positions.some(p=>p.x>4));
 assert.equal(courier.delivered('pedido-puertas'),true);
 for(let i=0;i<250&&courier.active;i++)courier.tick(.1);
 assert.equal(courier.active,false);
 assert.deepEqual(opened,[2,4],'en el regreso usa las puertas abiertas');
});
test('Una puerta no autorizada sigue siendo obstáculo para la ruta del repartidor',()=>{
 const restricted=(f,x,z)=>f===0&&x>=0&&x<=6&&z===0&&Math.abs(x-2)>.26;
 let attempted=0;
 const courier=Courier.createRuntime({
  step:.5,portals:()=>[{floor:0,x:.5,z:0}],transitions:()=>[],canWalk:restricted,
  canPlanWalk:restricted,openDoor:()=>{attempted++;return true;}
 });
 assert.equal(courier.start('pedido-cerrado',{floor:0,x:5,z:0}),false);
 assert.equal(attempted,0);
});
