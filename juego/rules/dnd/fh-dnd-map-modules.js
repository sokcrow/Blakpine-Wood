/* Opciones del mapa D&D. Las proyecciones de juego nunca modifican el original. */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHDndMapModules=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const electricTypes=new Set(['breaker_panel','power_outlet','power_strip','light_switch',
  'generator','generator_ats','generator_tank','elevator','battery_pickup','phone_charger','utility_pole']);
 const modernTypes=new Set(['landline_phone','router','ethernet_port','tv','camera','car']);
 const modernModels=new Set(['escritorio_pc','monitor_crt','teclado_pc','mouse_pc','gabinete_pc',
  'camara_seguridad','telefono_fijo','telefono_pared']);
 const chargers=new Set(['cell_phone_charger','cell_phone_fast_charger']);
 const electricalTools=new Set(['light_fixture','light_strip','light_panel','light_wall','light_flood',
  'light_switch','breaker_panel','generator','generator_emergency','power_outlet','zone_assign','elevator']);
 function options(map){
  return {electricity:map?.dndModules?.electricity===true,modernity:map?.dndModules?.modernity===true};
 }
 function electricItem(item){
  if(item.type==='light_fixture')return !root.FHMedievalLighting?.isMedieval(item.lightKind);
  return electricTypes.has(item.type)||!!root.FHElectricCatalog?.modelFor(item);
 }
 function modernItem(item){
  return modernTypes.has(item.type)||modernModels.has(item.modelId)||item.pcTerminal===true||
   !!root.FHInternetCatalog?.models.some(model=>model.id===item.modelId);
 }
 function allowsItem(item,modules){
  return (modules.electricity||!electricItem(item))&&(modules.modernity||!modernItem(item));
 }
 function allowsInventory(id,modules){
  if(chargers.has(id))return modules.electricity&&modules.modernity;
  return modules.modernity||!['cell_phone','flashlight_battery'].includes(id);
 }
 function applyState(state,map,{starting=false}={}){
  const modules=options(map);
  if(Array.isArray(state.inventory))state.inventory=state.inventory.filter(id=>
   allowsInventory(id,modules)&&(!starting||id!=='cell_phone'&&!chargers.has(id)));
  if(!modules.electricity&&state.flags)state.flags.power_global=false;
  if(!modules.modernity)state.flashlight={enabled:false};
  if(starting||!modules.modernity){
   delete state.phone;
   if(state.equipment){
    for(const slot of ['rearLeft','rearRight'])if(state.equipment[slot]==='cell_phone')state.equipment[slot]='';
   }
  }
  for(const floor of state.decoration?.editorItems||[]){
   if(Array.isArray(floor.items))floor.items=floor.items.filter(item=>allowsItem(item,modules));
  }
  return state;
 }
 function prepareMap(map){
  const modules=options(map);
  map.itemDefs||=[];
  for(const [id,name,kind] of [
   ['yesquero','Yesquero','tool'],['resina_antorcha','Carga para antorcha','consumable'],
   ['cera_vela','Cera','consumable'],['aceite_lampara','Aceite de lámpara','consumable'],
   ['lena','Leña','consumable'],['piedra','Piedra','consumable']
  ]){
   if(!map.itemDefs.some(item=>item.id===id))map.itemDefs.push({id,name,kind,description:name,stackable:kind==='consumable'});
  }
  for(const floor of map.floors){
   floor.items=(floor.items||[]).filter(item=>allowsItem(item,modules));
   for(const item of floor.items){
    if((!modules.modernity||!modules.electricity)&&
        ['puerta_electronica_opaca','puerta_electronica_reja'].includes(item.architectureSkin)){
     delete item.architectureSkin;
     delete item.accessDevice;
     item.variant='wood';
    }
    if(Array.isArray(item.interact?.effects)){
     item.interact.effects=item.interact.effects.filter(effect=>
      effect.type!=='giveItem'||allowsInventory(effect.id,modules));
    }
   }
  }
  return map;
 }
 function allowsTool(category,id,modules){
  if(electricalTools.has(id))return modules.electricity;
  if(category==='lighting')return !!root.FHMedievalCatalog?.toolAllowed(category,id,'dnd');
  return modules.modernity||!!root.FHMedievalCatalog?.toolAllowed(category,id,'dnd');
 }
 return Object.freeze({options,electricItem,allowsItem,allowsInventory,applyState,prepareMap,allowsTool});
});
