/* Persistencia DnD v1: recursos y defensas nunca se leen desde character/stats Legacy. */
(function(root,factory){
 'use strict';
 const combat=typeof module==='object'&&module.exports
  ?require('./fh-dnd-combat.js'):root.FHDndCombat;
 const api=factory(combat);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHDndSaveAdapter=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(combat){
 'use strict';
 const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
 // Conserva estado del mundo, no identidad, puntuaciones ni recursos del reglamento Legacy.
 const excluded=new Set(['dnd','character','characterId','stats','resources','skills','scores']);
 function copy(v){return JSON.parse(JSON.stringify(v));}
 function worldRuntime(value){
  if(!plain(value))throw Error('DND_WORLD_INVALID');
  const result={};
  for(const [key,item] of Object.entries(value)){
   if(excluded.has(key)||key==='horror'||key==='__proto__')continue;
   if(item!==undefined)result[key]=copy(item);
  }
  return result;
 }
 function validateWorldState(world){
  return plain(world)&&Object.keys(world).length===1&&plain(world.runtime)&&
   Object.keys(world.runtime).every(key=>!excluded.has(key)&&key!=='__proto__');
 }
 function validateRulesetState(data){return combat.validState(data);}
  // Los antiguos adversarios DnD eran actores de FHShadowAI, no bestiario DnD.
  function cleanRulesetState(data){
   const next=copy(data);
   for(const id of Object.keys(next.actors)){
    if(id.startsWith('fh-shadow-'))delete next.actors[id];
   }
   return next;
  }
 function initial(map){
  return {...worldRuntime(plain(map?.initialGameState)?map.initialGameState:{}),
   dnd:combat.initialState()};
 }
 function restore(world,rules,map){
  if(!validateWorldState(world)||!validateRulesetState(rules))throw Error('DND_SAVE_INVALID');
  // Leer guardados DnD v1 antiguos sin conservar el estado de Sombras Legacy.
   return {...initial(map),...worldRuntime(world.runtime),dnd:cleanRulesetState(rules)};
 }
 function capture(gameState){
  if(!plain(gameState)||!validateRulesetState(gameState.dnd))throw Error('DND_SAVE_INVALID');
  return {world:{runtime:worldRuntime(gameState)},
   rules:{rulesetId:'dnd',rulesetVersion:1,data:cleanRulesetState(gameState.dnd)}};
 }
 return Object.freeze({status:'implemented',contract:'blakpine-save-adapter-v1',
  rulesetId:'dnd',validateWorldState,validateRulesetState,initial,restore,capture});
});
