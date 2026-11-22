/* D&D 2024 · resolución de ataques con d20, CA, críticos y tipos de daño.
 * Adaptador puro; ninguna reserva general de PE ni fórmulas de Legacy.
 * Reglas SRD 5.2.1, CC BY 4.0: https://www.dndbeyond.com/srd
 */
(function(root,factory){
 'use strict';
 const sheet=typeof module==='object'&&module.exports?require('./fh-dnd-sheet.js'):root.FHDndSheet;
 const api=factory(sheet);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHDndCombat=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(sheet){
 'use strict';
 const integer=(n,lo,hi)=>Number.isSafeInteger(n)&&n>=lo&&n<=hi;
 const nonempty=v=>typeof v==='string'&&v.trim().length>0;
 const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
 const damageTypes=Object.freeze(['acid','bludgeoning','cold','fire','force','lightning','necrotic',
  'piercing','poison','psychic','radiant','slashing','thunder']);
 const defaults=Object.freeze({trainingAc:10,damageDie:8,hitDie:20});
 function combatant({hp=8,armorClass=10,abilities={str:10,dex:10,con:10,int:10,wis:10,cha:10},
  speedFt=30,attackBonus=0,damageBonus=0,damageDie=6,damageCount=1,
  damageType='bludgeoning',resistances=[],vulnerabilities=[],immunities=[]}={}){
  const obj={kind:'dnd-monster-v1',hp,maxHp:hp,armorClass,abilities:{...abilities},
   speedFt,attackBonus,damageBonus,damageDie,damageCount,damageType,
   resistances:[...resistances],vulnerabilities:[...vulnerabilities],immunities:[...immunities]};
  if(!validCombatant(obj))throw Error('DND_COMBATANT_INVALID');
  return obj;
 }
 function validCombatant(v){
  return plain(v)&&v.kind==='dnd-monster-v1'&&integer(v.hp,0,100000)&&
   integer(v.maxHp,1,100000)&&v.hp<=v.maxHp&&
   integer(v.armorClass,1,100)&&integer(v.speedFt,0,1000)&&
   plain(v.abilities)&&sheet.ABILITIES.every(k=>integer(v.abilities[k],1,30))&&
   integer(v.attackBonus,-100,100)&&integer(v.damageBonus,-100,100)&&
   integer(v.damageDie,2,100)&&integer(v.damageCount,1,20)&&damageTypes.includes(v.damageType)&&
   ['resistances','vulnerabilities','immunities'].every(key=>Array.isArray(v[key])&&
    v[key].every(x=>damageTypes.includes(x)));
 }
 function initialState(player=null){
  const chosen=player===null?sheet.createUnassigned():player;
  if(!sheet.valid(chosen))throw Error('DND_CHARACTER_INVALID');
  return {revision:0,actionSequence:0,lastPlayerMinute:-1,
   player:JSON.parse(JSON.stringify(chosen)),actors:{}};
 }
 function validState(state){
  return plain(state)&&integer(state.revision,0,Number.MAX_SAFE_INTEGER)&&
   integer(state.actionSequence,0,Number.MAX_SAFE_INTEGER)&&
   Number.isFinite(state.lastPlayerMinute)&&sheet.valid(state.player)&&
   plain(state.actors)&&Object.entries(state.actors).every(([id,actor])=>nonempty(id)&&
    (validCombatant(actor)||sheet.valid(actor)));
 }
 function validTrainingTarget(v){
  return plain(v)&&v.type==='training_dummy'&&v.hp===1&&v.maxHp===1&&
   integer(v.armorClass,1,100)&&Array.isArray(v.resistances)&&
   Array.isArray(v.immunities)&&Array.isArray(v.vulnerabilities);
 }
 function rollDie(sides,random=Math.random){
  if(!integer(sides,2,100)||typeof random!=='function')throw Error('DND_DIE_INVALID');
  const v=random();if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>=1)throw Error('DND_RANDOM_INVALID');
  return 1+Math.floor(v*sides);
 }
 function attackProfile(actor){
  if(sheet.valid(actor))return sheet.attack(actor);
  if(validCombatant(actor))return {hitDie:20,attackBonus:actor.attackBonus,damageBonus:actor.damageBonus,
   damageDie:actor.damageDie,damageCount:actor.damageCount,damageType:actor.damageType};
  throw Error('DND_ACTOR_INVALID');
 }
 function armorClass(target){
  if(sheet.valid(target)||validCombatant(target)||validTrainingTarget(target))return target.armorClass;
  throw Error('DND_TARGET_INVALID');
 }
 function validRolls(values,number,sides){
  return Array.isArray(values)&&values.length===number&&values.every(n=>integer(n,1,sides));
 }
 // Resolución pura: los dados ya fueron proporcionados por el coordinador.
 function evaluate(intent,world,state){
  if(!plain(intent)||intent.rulesetId!=='dnd'||intent.action!=='attack'||
   !nonempty(intent.actionId)||!plain(intent.actor)||!plain(intent.target)||
   !['player','creature'].includes(intent.actor.kind)||
   !['player','creature','training_dummy'].includes(intent.target.kind)||
   intent.actor.kind===intent.target.kind||
   (intent.target.kind==='training_dummy'&&intent.actor.kind!=='player')||
   !nonempty(intent.actor.id)||!nonempty(intent.target.id)||!validState(state)||
   !plain(world)||!plain(intent.dice))throw Error('DND_INTENT_INVALID');
  const actor=world.actor,target=world.target,dummy=intent.target.kind==='training_dummy';
  const profile=attackProfile(actor),ac=armorClass(target);
  if(!integer(actor.hp,0,100000)||actor.hp===0||target.hp===0)throw Error('DND_ACTION_UNAVAILABLE');
  if(dummy&&!validTrainingTarget(target))throw Error('DND_TARGET_INVALID');
  if(intent.actor.kind==='player'&&!sheet.valid(actor)||
   intent.target.kind==='player'&&!sheet.valid(target))throw Error('DND_ACTOR_INVALID');
  const roll=intent.dice.hit;
  const damage=intent.dice.damage,critical=intent.dice.criticalDamage;
  if(!integer(roll,1,20)||!validRolls(damage,profile.damageCount,profile.damageDie)||
   (roll===20?!validRolls(critical,profile.damageCount,profile.damageDie):
    !Array.isArray(critical)||critical.length!==0))throw Error('DND_DICE_OUT_OF_RANGE');
  const total=roll+profile.attackBonus,crit=roll===20;
  const hit=crit||(roll!==1&&total>=ac);
  const raw=hit?Math.max(0,damage.reduce((a,b)=>a+b,0)+
   (crit?critical.reduce((a,b)=>a+b,0):0)+profile.damageBonus):0;
  const immunities=target.immunities||[],resistances=target.resistances||[],
   vulnerabilities=target.vulnerabilities||[];
  let amount=immunities.includes(profile.damageType)?0:raw;
  if(resistances.includes(profile.damageType))amount=Math.floor(amount/2);
  if(vulnerabilities.includes(profile.damageType))amount*=2;
  if(!dummy)amount=Math.min(target.hp,amount);
  return Object.freeze({rulesetId:'dnd',actionId:intent.actionId,actorId:intent.actor.id,
   targetId:intent.target.id,hit,critical:hit&&crit,roll,total,armorClass:ac,
   damageRolls:[...damage,...(crit?critical:[])],damageType:profile.damageType,
   damage:amount,defeated:!dummy&&target.hp>0&&amount>=target.hp});
 }
 return Object.freeze({id:'combat.dnd',contract:'blakpine-combat-adapter-v1',
  status:'implemented',rulesetId:'dnd',defaults,combatant,initialState,validState,
  validCombatant,validTrainingTarget,rollDie,attackProfile,evaluate});
});
