'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const goap=require('./fh-npc-goap.js');

test('GOAP planea entrada, entrega y retorno antes de salir',()=>{
 assert.deepEqual(goap.planCourier(),['entrar','ir_a_puerta','esperar_receptor','entregar','volver_a_salida','salir']);
});
test('GOAP no inventa recursos ni ignora una acción bloqueada',()=>{
 assert.equal(goap.planCourier({paquete:false}),null);
 assert.equal(goap.planCourier({}, {blocked:['ir_a_puerta']}),null);
 assert.deepEqual(goap.plan({a:false},{a:true},[{id:'lento',pre:{a:false},effects:{a:true},cost:5},{id:'rapido',pre:{a:false},effects:{a:true},cost:1}]),['rapido']);
});
test('Ruta A* evita muro y no atraviesa esquinas',()=>{
 const walls=new Set(['2,0','2,1','2,2','2,3']);
 const path=goap.route({floor:0,x:0,z:0},{floor:0,x:4,z:0},{step:1,canWalk:(f,x,z)=>f===0&&x>=0&&z>=0&&x<=5&&z<=6&&!walls.has(x+','+z)});
 assert.ok(path);assert.ok(path.length>6);
 for(const p of path)assert.equal(walls.has(p.x+','+p.z),false);
});
test('Ruta requiere conexión real entre pisos',()=>{
 const options={step:1,canWalk:(f,x,z)=>f>=0&&f<=1&&x>=0&&x<=5&&z>=0&&z<=5};
 const s={floor:0,x:1,z:1},e={floor:1,x:4,z:4};
 assert.equal(goap.route(s,e,options),null);
 const path=goap.route(s,e,{...options,transitions:[{from:{floor:0,x:4,z:1},to:{floor:1,x:4,z:1}}]});
 assert.ok(path);assert.equal(path[0].floor,0);assert.equal(path.at(-1).floor,1);
 assert.equal(path.filter((p,i)=>i>0&&p.floor!==path[i-1].floor).length,1);
});
test('Ruta bloqueada no simula una entrega',()=>{
 const path=goap.route({floor:0,x:0,z:0},{floor:0,x:4,z:4},{step:1,canWalk:(_f,x,z)=>x===0&&z===0});
 assert.equal(path,null);
});
test('Un agente confirma acciones, sin entregar si el mundo indica bloqueado',()=>{
 const agent=goap.createAgent({initial:{presente:false,enSalida:false,enPuerta:false,esperando:false,entregado:false,paquete:true},goal:{entregado:true,presente:false},actions:goap.courierActions});
 assert.equal(agent.tick(()=> 'running').status,'running');
 assert.equal(agent.snapshot().presente,false);
 assert.equal(agent.tick(()=> 'done').action,'entrar');
 assert.equal(agent.tick(()=> 'blocked').action,'ir_a_puerta');
 assert.equal(agent.snapshot().entregado,false);
 assert.equal(agent.tick(()=> 'done').status,'blocked');
 agent.observe({puertaAbierta:true});
 assert.equal(agent.tick(()=> 'done').action,'ir_a_puerta');
 for(let i=0;i<4;i++)agent.tick(()=> 'done');
 assert.equal(agent.complete,true);
});
test('Un NPC puede elegir metas según prioridad y factibilidad',()=>{
 const actions=[{id:'entregar',pre:{hayPaquete:true},effects:{entregado:true},cost:3},{id:'refugio',pre:{enCasa:true},effects:{seguro:true},cost:1}];
 const choice=goap.chooseGoal({hayPaquete:true,enCasa:true},[{id:'entrega',priority:10,desired:{entregado:true}},{id:'seguridad',priority:20,desired:{seguro:true}}],actions);
 assert.equal(choice.id,'seguridad');
});
