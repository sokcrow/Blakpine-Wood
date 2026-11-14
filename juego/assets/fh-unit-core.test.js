'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
require('./fh-character-core.js');
const U=require('./fh-unit-core.js');
const Survival=require('./fh-survival-core.js');
const MoodFear=require('./fh-mood-fear-core.js');
const baseline={FOR:3,AGI:3,VOL:3,PRU:3,ING:3,ARC:3,SOC:3};
function create(){
 const caps=globalThis.FHCharacterCore.resources(baseline);
 const game={clock:{minutes:0},character:{id:'player_01',name:'Persona',
  life:'alive',scores:{...baseline},resources:{...caps,pg:caps.pgMax,sp:caps.spMax,pe:caps.peMax},
  inventory:['linterna'],skills:{}},survival:{version:2,lastMinute:0,mode:'awake'}};
 let playerPosition={floor:0,x:2,z:4};
 const make=(gameState=game)=>U.createRuntime(gameState,{characterRules:globalThis.FHCharacterCore,
  survivalCore:Survival,moodCore:MoodFear,playerPosition:()=>playerPosition,
  playerSurvival:()=>null,playerMood:()=>null});
 return {game,make,get position(){return playerPosition},set position(v){playerPosition=v}};
}
test('Jugador: la Unidad reutiliza exactamente el mismo cuerpo y recursos, sin clonarlos',()=>{
 const {game,make}=create(),units=make(),player=units.player;
 assert.strictEqual(player.body,game.character);
 assert.strictEqual(player.resources,game.character.resources);
 assert.equal(player.id,'player_01');
 assert.equal(units.list().length,1);
 assert.equal(Object.keys(game.units).length,0);
 player.resources.pg-=5;
 assert.equal(game.character.resources.pg,game.character.resources.pgMax-5);
 assert.deepEqual(player.inventory,['linterna']);
});
test('Control humano e IA se cambian sin cambiar el cuerpo o sus recursos',()=>{
 const {game,make}=create(),units=make(),player=units.player;
 const first=player.body,resources=player.resources;
 assert.equal(units.assignController('player_01',{type:'ai',ownerId:'goap'}),true);
 assert.strictEqual(units.player.body,first);
 assert.strictEqual(units.player.resources,resources);
 assert.equal(units.player.controller.type,'ai');
 assert.equal(units.assignController('player_01',{type:'human',ownerId:'session'}),true);
 assert.strictEqual(units.player.body,first);
 const courier=units.ensure('courier:order_1',{name:'Repartidor'});
 assert.equal(units.assignController(courier.id,{type:'human'}),false,'no autorizar secuestro local de NPC');
 assert.equal(units.assignController(courier.id,{type:'ai',ownerId:'delivery'}),true);
 assert.equal(courier.controller.type,'ai');
 assert.equal(courier.body.controller,undefined,'controlador no forma parte del cuerpo');
 assert.equal(game.units[courier.id],courier.body);
});
test('Unidad IA tiene scores, PG, PS, PE, skills, inventario y estado propios con mismas fórmulas',()=>{
 const {game,make}=create(),units=make(),npc=units.ensure('courier:order_2');
 const expected=globalThis.FHCharacterCore.resources(baseline);
 for(const key of ['pgMax','spMax','peMax'])assert.equal(npc.resources[key],expected[key]);
 assert.equal(npc.resources.pg,npc.resources.pgMax);
 npc.resources.pg-=4;npc.inventory.push('paquete');
 assert.equal(game.character.resources.pg,game.character.resources.pgMax);
 assert.deepEqual(game.character.inventory,['linterna']);
 assert.equal(units.ensure('courier:order_2'),npc);
});
test('Posición del jugador viene del motor; posición del NPC vive en su Unidad',()=>{
 const setup=create(),units=setup.make(),npc=units.ensure('courier:coords');
 assert.deepEqual(units.player.position,{floor:0,x:2,z:4});
 setup.position={floor:1,x:7,z:9};
 assert.deepEqual(units.player.position,{floor:1,x:7,z:9});
 assert.equal(units.player.setPosition({floor:0,x:5,z:5}),false);
 assert.equal(npc.setPosition({floor:0,x:3,z:1}),true);
 assert.deepEqual(npc.position,{floor:0,x:3,z:1});
 assert.equal(npc.setPosition({floor:0,x:NaN,z:1}),false);
});
test('Supervivencia utiliza el mismo cuerpo; el NPC no sobrescribe el estado del jugador',()=>{
 const {game,make}=create(),units=make(),npc=units.ensure('courier:sleep');
 const original=game.survival;
 const life=units.createSurvival(npc.id,{},0);
 assert.strictEqual(life.resources,npc.resources);
 life.damagePG(5);
 assert.equal(npc.resources.pg,npc.resources.pgMax-5);
 life.update(0,{mode:'sleeping'});life.update(360,{mode:'sleeping'});
 assert.equal(game.survival,original);
 assert.strictEqual(npc.body.survival,life.state);
 assert.ok(npc.body.survival.sleepMinutes>=360);
});
test('Mood y Fear utilizan directamente el mismo cuerpo en jugador y NPC',()=>{
 const {game,make}=create(),units=make(),npc=units.ensure('courier:mood');
 const mood=units.createMoodFear(npc.id);
 assert.equal(mood.setMood('malo'),true);
 assert.strictEqual(npc.body.mental,mood.state);
 assert.equal(npc.mental.mood,'malo');
 assert.equal(game.character.mental,undefined);
});
test('Persistencia del cuerpo de NPC sin duplicar personaje del jugador',()=>{
 const {game,make}=create(),units=make(),npc=units.ensure('courier:save');
 npc.setPosition({floor:0,x:9,z:5});npc.resources.sp-=2;
 const before=game.character.resources,backup=JSON.parse(JSON.stringify(game));
 const reloaded=make(backup),restored=reloaded.get(npc.id);
 assert.deepEqual(restored.position,{floor:0,x:9,z:5});
 assert.equal(restored.resources.sp,npc.resources.sp);
 assert.strictEqual(reloaded.player.body,backup.character);
 assert.deepEqual(game.character.resources,before);
 assert.equal(Object.keys(backup.units).length,1);
});
test('IDs no seguros y recursos sin reglas comunes no crean unidades inválidas',()=>{
 const {make}=create(),units=make();
 assert.equal(units.ensure('__proto__'),null);
 assert.equal(units.get('constructor'),null);
 assert.throws(()=>U.makeBody('courier:invalid',{},{}),/reglas comunes/);
});

test('Cada unidad conserva una sola instancia de supervivencia y sanidad mental',()=>{
 const {make}=create(),units=make(),npc=units.ensure('citizen:shared');
 const survivalA=units.createSurvival(npc.id,{},0),survivalB=units.createSurvival(npc.id,{},15);
 const moodA=units.createMoodFear(npc.id),moodB=units.createMoodFear(npc.id);
 assert.strictEqual(survivalA,survivalB);
 assert.strictEqual(moodA,moodB);
 assert.strictEqual(survivalA.resources,npc.resources);
 assert.strictEqual(moodA.state,npc.mental);
});
test('La muerte se registra en el cuerpo NPC, sin afectar al jugador',()=>{
 const {game,make}=create(),units=make(),npc=units.ensure('citizen:mortal');
 const survival=units.createSurvival(npc.id,{},0);
 survival.damagePG(npc.resources.pg);
 assert.equal(survival.state.critical.status,'critical');
 for(let i=0;i<3;i++)survival.deathSave(1,()=>.9);
 assert.equal(npc.body.life,'dead');
 assert.equal(game.character.life,'alive');
});
