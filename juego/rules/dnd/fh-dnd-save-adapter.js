/* Guardado DnD independiente de character/stats Legacy.
 * La ficha activa es D&D 2024. Los antiguos guardados del prototipo
 * de 20 PG/6 PE se migran: la energía ficticia se descarta para siempre.
 */
(function(root,factory){
 'use strict';
 const combat=typeof module==='object'&&module.exports
  ?require('./fh-dnd-combat.js'):root.FHDndCombat;
 const api=factory(combat);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHDndSaveAdapter=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(combat){
 'use strict';
 const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
 const excluded=new Set(['dnd','character','characterId','stats','resources','skills','scores','horror']);
 const copy=v=>JSON.parse(JSON.stringify(v));
 function worldRuntime(value){
  if(!plain(value))throw Error('DND_WORLD_INVALID');
  const result={};
  for(const [key,item] of Object.entries(value)){
   if(excluded.has(key)||key==='__proto__')continue;
   if(item!==undefined)result[key]=copy(item);
  }
  return result;
 }
 const validateWorldState=world=>plain(world)&&Object.keys(world).length===1&&
  plain(world.runtime)&&Object.keys(world.runtime).every(k=>(k==='horror'||!excluded.has(k))&&k!=='__proto__');
 // Lectura de v1: nunca se interpretan "energy"/"energyCost" como regla de DnD.
 function legacyState(state){
  const p=state?.player;
  return plain(state)&&Number.isSafeInteger(state.revision)&&state.revision>=0&&
   Number.isSafeInteger(state.actionSequence)&&state.actionSequence>=0&&
   Number.isFinite(state.lastPlayerMinute)&&plain(p)&&
   Number.isSafeInteger(p.hp)&&p.hp>=0&&
   Number.isSafeInteger(p.maxHp)&&p.maxHp>0&&p.hp<=p.maxHp&&
   Number.isSafeInteger(p.energy)&&p.energy>=0&&
   plain(state.actors)&&Object.entries(state.actors).every(([id,a])=>
    id!==''&&plain(a)&&Number.isSafeInteger(a.hp)&&a.hp>=0&&
    Number.isSafeInteger(a.maxHp)&&a.maxHp>=a.hp);
 }
 const validateRulesetState=data=>combat.validState(data)||legacyState(data);
 function migrate(state,character=null){
  if(combat.validState(state)){
   const next=copy(state);
   for(const id of Object.keys(next.actors))if(id.startsWith('fh-shadow-'))delete next.actors[id];
   return next;
  }
  if(!legacyState(state))throw Error('DND_SAVE_INVALID');
  const migrated=combat.initialState(character);
  migrated.revision=state.revision;
  migrated.actionSequence=state.actionSequence;
  migrated.lastPlayerMinute=state.lastPlayerMinute;
  migrated.player.hp=Math.min(migrated.player.maxHp,state.player.hp);
  for(const [id,old] of Object.entries(state.actors)){
   if(id.startsWith('fh-shadow-'))continue;
   migrated.actors[id]=combat.combatant({
    hp:Math.max(1,old.maxHp),armorClass:Math.max(1,old.defense||10),
    damageDie:Math.max(2,old.damageDie||6),attackBonus:old.attackBonus||0,
    damageBonus:old.damageBonus||0
   });
   migrated.actors[id].hp=Math.min(migrated.actors[id].maxHp,old.hp);
  }
  return migrated;
 }
 function configuredPlayer(map){
  const selected=map?.__dndCharacter?.sheet||map?.initialGameState?.dnd?.player||null;
  if(selected===null)return null;
  // La ficha viene del selector DnD, nunca de GameState.character (Legacy).
  const base=combat.initialState(selected);
  return base.player;
 }
 function initial(map){
  return {...worldRuntime(plain(map?.initialGameState)?map.initialGameState:{}),
   dnd:combat.initialState(configuredPlayer(map))};
 }
 function restore(world,rules,map){
  if(!validateWorldState(world)||!validateRulesetState(rules))throw Error('DND_SAVE_INVALID');
  return {...initial(map),...worldRuntime(world.runtime),
   dnd:migrate(rules,configuredPlayer(map))};
 }
 function capture(gameState){
  if(!plain(gameState)||!combat.validState(gameState.dnd))throw Error('DND_SAVE_INVALID');
  return {world:{runtime:worldRuntime(gameState)},
   rules:{rulesetId:'dnd',rulesetVersion:1,data:migrate(gameState.dnd)}};
 }
 return Object.freeze({status:'implemented',contract:'blakpine-save-adapter-v1',
  rulesetId:'dnd',validateWorldState,validateRulesetState,initial,restore,capture,migrate});
});
