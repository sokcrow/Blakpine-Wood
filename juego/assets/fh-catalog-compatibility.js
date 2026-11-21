/* Metadatos de ambientación para las opciones de colocación del editor. */
(function(root){
 'use strict';
 const settings=Object.freeze({legacy:'modern',dnd:'medieval-fantasy','moon-system':'modern'});
 const restrictedTechnologies=new Set(['electrical','electronics','modern-plumbing','industrial','motorized']);
 const electrical=Object.freeze({technology:'electrical'});
 const electronics=Object.freeze({technology:'electronics'});
 const plumbing=Object.freeze({technology:'modern-plumbing'});
 const industrial=Object.freeze({technology:'industrial'});
 const motorized=Object.freeze({technology:'motorized'});
 const tools=Object.freeze({
  tv:electronics,kitchen:industrial,bath:plumbing,toilet:plumbing,car:motorized,
  battery_pickup:electrical,elevator:electrical,peephole_door:industrial,
  zone_assign:electrical,light_fixture:electrical,light_strip:electrical,light_panel:electrical,
  light_wall:electrical,light_flood:electrical,light_switch:electrical,breaker_panel:electrical,
  generator:electrical,generator_emergency:electrical,power_outlet:electrical,
  router:electronics,ethernet_port:electronics,landline_phone:electronics,
  water_main:plumbing,water_valve:plumbing,water_outlet:plumbing,water_cistern:plumbing,
  water_tinaco:plumbing,water_boiler:plumbing,water_boiler_aux:plumbing,
  parking:motorized,asphalt:motorized
 });
 const categories=Object.freeze({network:electronics,roads:motorized,parking_marks:motorized});

 function allows(compatibility,{mode='legacy',technologyExceptions=[]}={}){
  const setting=Object.hasOwn(settings,mode)?settings[mode]:null;
  if(!compatibility||!setting)return true;
  const {settings:allowedSettings,technology}=compatibility;
  if(Array.isArray(allowedSettings)&&!allowedSettings.includes(setting))return false;
  return mode!=='dnd'||!restrictedTechnologies.has(technology)||
   (Array.isArray(technologyExceptions)&&technologyExceptions.includes(technology));
 }

 const api=Object.freeze({allows,tools,categories});
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHCatalogCompatibility=api;
})(globalThis);
