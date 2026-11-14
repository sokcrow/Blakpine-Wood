'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
require('./fh-character-core.js');
const Units=require('./fh-unit-core.js');
const Courier=require('./fh-npc-courier.js');
test('El repartidor GOAP usa un cuerpo de Unidad sin segundo estado de PG/PS/PE ni posición',()=>{
 const game={clock:{minutes:540},character:null};
 const registry=Units.createRuntime(game,{characterRules:globalThis.FHCharacterCore});
 const positionEvents=[],canWalk=(f,x,z)=>f===0&&x>=0&&z>=0&&x<=6&&z<=4;
 const courier=Courier.createRuntime({speed:10,step:1,canWalk,portals:()=>[{floor:0,x:0,z:0}],
  unitFor:orderId=>{
   const unit=registry.ensure('courier:'+orderId,{name:'Repartidor'});
   registry.assignController(unit.id,{type:'ai',ownerId:'delivery'});
   return unit;
  },
  position:p=>positionEvents.push({...p})
 });
 assert.equal(courier.start('order_a',{floor:0,x:4,z:0}),true);
 const body=registry.get('courier:order_a').body;
 assert.strictEqual(courier.unit.body,body);
 assert.equal(courier.unit.controller.type,'ai');
 assert.deepEqual(courier.position,{floor:0,x:0,z:0});
 for(let i=0;i<70&&courier.stage!=='waiting';i++)courier.tick(.1);
 assert.equal(courier.stage,'waiting');
 assert.deepEqual(courier.position,registry.get('courier:order_a').position);
 assert.ok(positionEvents.some(p=>p.x>=4));
 body.resources.pg-=3;
 assert.equal(registry.get('courier:order_a').resources.pg,body.resources.pg);
 assert.equal(courier.delivered('order_a'),true);
 for(let i=0;i<70&&courier.active;i++)courier.tick(.1);
 assert.equal(courier.active,false);
 assert.strictEqual(registry.get('courier:order_a').body,body,'desaparece el sprite, no el cuerpo');
});
test('La API del repartidor sigue funcionando sin registro de Unidades',()=>{
 const courier=Courier.createRuntime({canWalk:(f,x,z)=>f===0&&x>=0&&z>=0&&x<=3&&z<=3,
  portals:()=>[{floor:0,x:0,z:0}],step:1,speed:10});
 assert.equal(courier.start('legacy',{floor:0,x:2,z:1}),true);
 assert.equal(courier.unit,null);
 for(let i=0;i<50&&courier.stage!=='waiting';i++)courier.tick(.1);
 assert.equal(courier.stage,'waiting');
});
