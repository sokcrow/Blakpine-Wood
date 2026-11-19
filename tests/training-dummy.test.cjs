'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const dummy=require('../juego/units/fh-training-dummy.js');

test('1/1 PG y 0 movimiento en los tres reglamentos',()=>{
 for(const rulesetId of dummy.rulesets){
  const u=dummy.create({id:'objetivo',rulesetId,customStats:{hp:999,PG:999,speed:25,MOV:25}});
  assert.equal(u.hp,1);assert.equal(u.maxHp,1);
  assert.equal(u.movement,0);assert.equal(u.immobile,true);assert.equal(u.indestructible,true);
  if(rulesetId==='legacy'){assert.equal(u.stats.PG,1);assert.equal(u.stats.PGMax,1);assert.equal(u.stats.MOV,0);}
  else{assert.equal(u.stats.hp,1);assert.equal(u.stats.maxHp,1);assert.equal(u.stats.speed,0);}
 }
});

test('No muere ni concede recompensa tras ataques repetidos',()=>{
 let u=dummy.create({id:'objetivo'});
 for(let n=0;n<1000;n++){
  const result=dummy.receiveHit(u,{damage:999,hit:true});u=result.unit;
  assert.equal(result.defeated,false);assert.equal(result.despawn,false);assert.equal(result.reward,false);
  assert.equal(result.damageApplied,0);assert.equal(result.incomingDamage,999);assert.equal(u.hp,1);
 }
 assert.equal(u.hitsReceived,1000);assert.equal(u.alive,true);
});

test('Fallos de ataque y daño inválido',()=>{
 const u=dummy.create({id:'objetivo'});
 const miss=dummy.receiveHit(u,{hit:false,damage:20});
 assert.equal(miss.unit.hitsReceived,0);assert.equal(miss.unit.hp,1);
 assert.throws(()=>dummy.receiveHit(u,{damage:-1}),/TRAINING_DUMMY_DAMAGE_INVALID/);
 assert.throws(()=>dummy.create({id:'a',rulesetId:'invalid'}),/TRAINING_DUMMY_RULESET_INVALID/);
});

test('Instala una sola vez el puente de motor sin cambiar su lógica',()=>{
 const anchor='DATA.floors.forEach((_,i)=>buildFloor(i));';
 const patched=dummy.patchEngineDoc('before\n'+anchor+'\nafter');
 assert.match(patched,/FHTrainingDummyRuntime/);
 assert.equal(patched.split(anchor).length,2);
 assert.throws(()=>dummy.patchEngineDoc('missing anchor'),/TRAINING_DUMMY_ENGINE_ANCHOR_MISSING/);
});

test('Una unidad por ítem de mapa y altura sin duplicación de piso',()=>{
 class Node {
  constructor(){this.children=[];this.rotation={};this.position={set:(x,y,z)=>{this.xyz=[x,y,z]}};}
  add(value){this.children.push(value);}
 }
 class Mesh extends Node{constructor(g,m){super();this.geometry=g;this.material=m;}}
 class Data{constructor(x){this.value=x;}}
 const THREE={Group:Node,Mesh,MeshLambertMaterial:Data,BoxGeometry:Data,
  CylinderGeometry:Data,TorusGeometry:Data,SphereGeometry:Data};
 const stories=[new Node(),new Node()];
 const project={floors:[{items:[]},{items:[{type:'training_dummy',id:'t1',x:2,y:3}]}]};
 const runtime=dummy.createRuntime({project,THREE,stories,floorElev:[0,3],cell:1.524,rulesetId:'dnd'});
 assert.equal(runtime.list().length,1);
 assert.deepEqual(runtime.position('t1'),{floor:1,x:3.048,z:4.572});
 assert.equal(runtime.position('missing'),null);assert.equal(stories[1].children.length,1);
 assert.deepEqual(stories[1].children[0].xyz,[3.048,0,4.572]);
 const received=runtime.receiveHit('t1',{hit:true,damage:18});
 assert.equal(received.unit.hp,1);assert.equal(runtime.get('t1').hitsReceived,1);
 assert.throws(()=>runtime.receiveHit('missing',{damage:3}),/TRAINING_DUMMY_NOT_FOUND/);
});
