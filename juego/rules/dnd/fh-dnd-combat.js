/* DnD: evaluación pura del combate. Sin clases, niveles ni reglas de edición asumidas. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHDndCombat=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const defaults=Object.freeze({
  hitDie:20,damageDie:4,energyCost:1,playerHp:20,playerEnergy:6,
  creatureHp:8,creatureEnergy:4,defense:10,resistance:0,
  attackBonus:0,damageBonus:0,playerAttackCooldownMinutes:1
 });
 const integer=(n,lo,hi)=>Number.isSafeInteger(n)&&n>=lo&&n<=hi;
 const text=s=>typeof s==='string'&&s.trim().length>0;
 const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
 function combatant({hp,energy,defense=defaults.defense,resistance=defaults.resistance,
   attackBonus=0,damageBonus=0,damageDie=defaults.damageDie,hitDie=defaults.hitDie,
   energyCost=defaults.energyCost}={}){
  const value={hp,maxHp:hp,energy,maxEnergy:energy,defense,resistance,
   attackBonus,damageBonus,damageDie,hitDie,energyCost};
  if(!validCombatant(value))throw Error('DND_COMBATANT_INVALID');
  return value;
 }
 function validCombatant(v){
  return plain(v)&&Object.keys(v).sort().join(',')===
   ['hp','maxHp','energy','maxEnergy','defense','resistance','attackBonus',
    'damageBonus','damageDie','hitDie','energyCost'].sort().join(',')&&
   integer(v.hp,0,100000)&&integer(v.maxHp,1,100000)&&v.hp<=v.maxHp&&
   integer(v.energy,0,100000)&&integer(v.maxEnergy,1,100000)&&v.energy<=v.maxEnergy&&
   integer(v.defense,0,1000)&&integer(v.resistance,0,1000)&&
   integer(v.attackBonus,-1000,1000)&&integer(v.damageBonus,-1000,1000)&&
   integer(v.damageDie,2,100)&&integer(v.hitDie,2,100)&&integer(v.energyCost,0,100);
 }
 function initialState(){
  return {revision:0,actionSequence:0,lastPlayerMinute:-1,
   player:combatant({hp:defaults.playerHp,energy:defaults.playerEnergy}),
   actors:{}};
 }
 function validState(state){
  return plain(state)&&Object.keys(state).sort().join(',')===
   ['revision','actionSequence','lastPlayerMinute','player','actors'].sort().join(',')&&
   integer(state.revision,0,Number.MAX_SAFE_INTEGER)&&integer(state.actionSequence,0,Number.MAX_SAFE_INTEGER)&&
   Number.isFinite(state.lastPlayerMinute)&&validCombatant(state.player)&&plain(state.actors)&&
   Object.entries(state.actors).every(([id,actor])=>text(id)&&validCombatant(actor));
 }
 function rollDie(sides,random=Math.random){
  if(!integer(sides,2,100)||typeof random!=='function')throw Error('DND_DIE_INVALID');
  const value=random();
  if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>=1)throw Error('DND_RANDOM_INVALID');
  return 1+Math.floor(value*sides);
 }
 function evaluate(intent,world,state){
  if(!plain(intent)||intent.rulesetId!=='dnd'||intent.action!=='attack'||
   !text(intent.actionId)||!plain(intent.actor)||!plain(intent.target)||
   !['player','creature'].includes(intent.actor.kind)||
   !['player','creature'].includes(intent.target.kind)||
   intent.actor.kind===intent.target.kind||
   !text(intent.actor.id)||!text(intent.target.id)||
   !validState(state)||!plain(world)||!validCombatant(world.actor)||!validCombatant(world.target)||
   !plain(intent.dice))throw Error('DND_INTENT_INVALID');
  const attacker=world.actor,target=world.target;
  if(attacker.hp===0||target.hp===0||attacker.energy<attacker.energyCost)throw Error('DND_ACTION_UNAVAILABLE');
  if(!integer(intent.dice.hit,1,attacker.hitDie)||
    !integer(intent.dice.damage,1,attacker.damageDie))throw Error('DND_DICE_OUT_OF_RANGE');
  const total=intent.dice.hit+attacker.attackBonus;
  // Sin críticos automáticos, ventajas ni clases: decisiones pendientes de reglamento.
  const hit=total>=target.defense;
  const amount=hit?Math.min(target.hp,Math.max(0,intent.dice.damage+attacker.damageBonus-target.resistance)):0;
  return Object.freeze({
   rulesetId:'dnd',actionId:intent.actionId,actorId:intent.actor.id,targetId:intent.target.id,
   hit,roll:intent.dice.hit,total,defense:target.defense,damageRoll:intent.dice.damage,
   resistance:target.resistance,damage:amount,cost:attacker.energyCost,
   defeated:target.hp>0&&amount>=target.hp
  });
 }
 return Object.freeze({id:'combat.dnd',contract:'blakpine-combat-adapter-v1',
  status:'implemented',rulesetId:'dnd',defaults,combatant,initialState,validState,
  validCombatant,rollDie,evaluate});
});
