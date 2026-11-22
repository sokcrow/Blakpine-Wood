/* Catálogo común: DnD filtra por ambientación, Legacy/Moon conservan todos los modelos. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHMedievalCatalog=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function compatible(item,rulesetId){
  return rulesetId!=='dnd'||(Array.isArray(item?.ambientations)&&item.ambientations.includes('medieval'));
 }
 const tools=Object.freeze({
  structure:new Set(['select','pan','wall','red_wall','paint_wall','half_wall','fence','door','peephole_door','window','opening','erase']),
  furniture:new Set(['select','misc']),
  lighting:new Set(['select','pan','light_medieval_wall_torch','light_medieval_hand_torch','light_medieval_candle',
   'light_medieval_candelabrum','light_medieval_oil_lantern','light_medieval_brazier','light_medieval_campfire',
   'light_medieval_fireplace','light_medieval_magic_crystal']),
  network:new Set(['select','pan']),
  water:new Set(['select','pan']),
  areas:new Set(['courtyard','room_fill','room','hall','outside','building','alley','gravel','cobblestone','tile_floor','wood_floor','grass','dirt','stairs','spawn','npc_portal','training_dummy','select','pan']),
  roads:new Set(['select','pan','erase']),
  parking_marks:new Set(['select','pan','erase']),
  navigate:new Set(['select','pan','erase','wall','red_wall','paint_wall','half_wall','fence','door','peephole_door','window'])
 });
 function toolAllowed(category,id,rulesetId){
  if(category==='lighting'&&id.startsWith('light_medieval_')&&rulesetId!=='dnd')return false;
  return rulesetId!=='dnd'||Boolean(tools[category]?.has(id));
 }
 function entries(items,rulesetId){return items.filter(item=>compatible(item,rulesetId)&&!(rulesetId==='dnd'&&item.lightKind));}
 return Object.freeze({compatible,toolAllowed,entries});
});
