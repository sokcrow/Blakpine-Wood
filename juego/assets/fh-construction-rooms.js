/* Blakpine-Wood · Construcción 02. Auditoría por habitación/parcela.
 * Datos opcionales: room.constructionRoom. No modifica colisión ni redes.
 * La disponibilidad para NPC requiere una futura comprobación de navegación.
 */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHConstructionRooms=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const ROOM_PRESETS=Object.freeze(['bano','cocina','dormitorio','oficina','descanso']);
 const REQUIRED=Object.freeze({
  bano:['toilet','bathSink'],cocina:['kitchenSink','cook','fridge'],
  dormitorio:['bed'],oficina:['desk'],descanso:['seat','table']
 });
 const BUILDINGS=Object.freeze({
  ayuntamiento:['bano','oficina'],apartamentos:['bano','cocina','dormitorio'],
  casas:['bano','cocina','dormitorio'],tienda:['bano'],personalizado:[]
 });
 const MODELS=Object.freeze({
  toilet:['inodoro_clasico','inodoro_antiguo'],
  bathSink:['lavabo_pedestal','lavabo_gabinete'],
  kitchenSink:['fregadero_mueble'],
  cook:['estufa_horno','microondas'],
  fridge:['refrigerador','refrigerador_vertical_bebidas_c02'],
  bed:['cama_individual'],
  desk:['escritorio_clasico','escritorio_l','escritorio_pc'],
  seat:['silla_madera','silla_comedor','silla_acolchada','silla_oficina','silla_plegable','sofa','banco_cocina'],
  table:['mesa_pequena','mesa_cocina_cuadrada','mesa_cocina_rectangular','mesa_cocina_redonda']
 });
 const TYPES=Object.freeze({toilet:['toilet'],bathSink:[],kitchenSink:[],
  cook:['kitchen'],fridge:[],bed:['bed'],desk:[],seat:['chair','sofa'],
  table:['table','dining']});
 const PLUMBING=new Set(['toilet','bathSink','kitchenSink']);
 const POWER=new Set(['cook','fridge']);
 const unique=value=>typeof value==='string'&&value.length>0;
 const tagged=(item,kind)=>MODELS[kind].includes(item?.modelId)||TYPES[kind].includes(item?.type);
 const at=(item)=>({x:Number(item?.x),y:Number(item?.y)});
 function planRoom(room,preset){
  if(room?.type!=='room')throw Error('Solo se pueden clasificar habitaciones');
  if(preset===''||preset===null){delete room.constructionRoom;return null;}
  if(!ROOM_PRESETS.includes(preset))throw Error('Función de habitación desconocida');
  room.constructionRoom=preset;return preset;
 }
 function floorOf(project,floorId){
  const floors=Array.isArray(project?.floors)?project.floors:[];
  const index=floors.findIndex(f=>String(f.id)===String(floorId));
  return {index,floor:floors[index]||null};
 }
 function furnitureInRoom(floor,room,geometry){
  return (floor?.items||[]).filter(it=>it!==room&&it?.type!=='room'
   &&Number.isFinite(it?.x)&&Number.isFinite(it?.y)
   &&geometry.roomContains(room,at(it)));
 }
 function verifyUtility(item,kind,floorIndex,services){
  const needsWater=PLUMBING.has(kind),needsPower=POWER.has(kind);
  if(!needsWater&&!needsPower)return {status:'ready',issues:[]};
  if(typeof services?.statusFor!=='function')return {status:'unverified',issues:[]};
  let status;
  try{status=services.statusFor(floorIndex,item);}catch{return {status:'unverified',issues:[]};}
  if(!status||typeof status!=='object')return {status:'unverified',issues:[]};
  const issues=[];
  if(needsWater){
   if(status.water?.legacy===true||!status.water) return {status:'unverified',issues:[]};
   if(status.water.water!==true)issues.push('agua');
   if(!status.drain) return {status:'unverified',issues:[]};
   if(status.drain.draining!==true)issues.push('drenaje');
  }
  if(needsPower){
   if(!status.power)return {status:'unverified',issues:[]};
   if(status.power.powered!==true)issues.push('electricidad');
  }
  return {status:issues.length?'incomplete':'ready',issues};
 }
 function inspectRoom(project,floorId,room,options={}){
  if(room?.type!=='room'||!ROOM_PRESETS.includes(room.constructionRoom))return null;
  const geometry=options.geometry||root?.FHStyleProperty;
  const {index,floor}=floorOf(project,floorId);
  if(!floor||!geometry?.roomContains)return null;
  const items=furnitureInRoom(floor,room,geometry),issues=[],unverified=[];
  for(const need of REQUIRED[room.constructionRoom]){
   const candidates=items.filter(it=>tagged(it,need));
   if(!candidates.length){issues.push({code:'falta_mueble',need});continue;}
   const checks=candidates.map(it=>({...verifyUtility(it,need,index,options.services),itemId:it.id||null}));
   if(checks.some(c=>c.status==='ready'))continue;
   const pending=checks.find(c=>c.status==='unverified');
   if(pending){unverified.push({code:'servicios_sin_verificar',need,itemId:pending.itemId});continue;}
   const problem=checks[0];
   for(const code of problem.issues)issues.push({code:'sin_'+code,need,itemId:problem.itemId});
  }
  return {roomId:String(room.roomId||room.id||''),preset:room.constructionRoom,
   status:issues.length?'incomplete':unverified.length?'unverified':'ready',
   issues,unverified,access:'no_verificado',npcUsable:null};
 }
 function itemsInProperty(floor,property,geometry){
  return (floor?.items||[]).filter(it=>it?.type!=='room'&&Number.isFinite(it?.x)&&Number.isFinite(it?.y)
   &&geometry.inside(at(it),property.polygon));
 }
 function inspectParcel(project,property,options={}){
  if(!property||!unique(property.id)||!Array.isArray(property.polygon))return null;
  const geometry=options.geometry||root?.FHStyleProperty;
  const {index,floor}=floorOf(project,property.floorId);
  if(!floor||!geometry?.roomInProperty||!geometry.inside)return null;
  const rooms=(floor.items||[]).filter(it=>it?.type==='room'&&geometry.roomInProperty(it,property)
   &&ROOM_PRESETS.includes(it.constructionRoom));
  const inspected=rooms.map(room=>inspectRoom(project,property.floorId,room,{...options,geometry})).filter(Boolean);
  const preset=property.construction?.preset||'personalizado';
  const required=BUILDINGS[preset]||[];
  const issues=[],unverified=[];
  for(const kind of required)if(!inspected.some(r=>r.preset===kind))
   issues.push({code:'falta_habitacion',need:kind});
  for(const r of inspected){
   issues.push(...r.issues.map(issue=>({...issue,roomId:r.roomId})));
   unverified.push(...r.unverified.map(issue=>({...issue,roomId:r.roomId})));
  }
  if(preset==='tienda'){
   const placed=itemsInProperty(floor,property,geometry);
   const registers=placed.filter(it=>it.shopRole==='register'||it.modelId==='caja_registradora_c02').length;
   const displays=placed.filter(it=>it.shopRole==='display'||['gondola_simple_c02','rack_snacks_c02'].includes(it.modelId)).length;
   if(registers<1)issues.push({code:'falta_registradora',need:'register',count:1-registers});
   if(displays<2)issues.push({code:'faltan_exhibidores',need:'display',count:2-displays});
  }
  const construction=options.construction?.status?.(property.id)||null;
  const inProgress=construction?construction.finished===false:property.construction?.simulated===true;
  if(inProgress)issues.push({code:'obra_pendiente'});
  return {parcelId:property.id,preset,rooms:inspected,issues,unverified,
   status:issues.length?'incomplete':unverified.length?'unverified':'ready',
   access:'no_verificado',npcUsable:null};
 }
 function createRuntime(project,options={}){
  return Object.freeze({
   inspectParcel:parcelId=>{
    const property=(project?.properties||[]).find(p=>p?.id===parcelId);
    return inspectParcel(project,property,options);
   },
   inspectRoom:(floorId,roomId)=>{
    const {floor}=floorOf(project,floorId);
    const room=(floor?.items||[]).find(it=>it.type==='room'&&String(it.roomId||it.id)===String(roomId));
    return inspectRoom(project,floorId,room,options);
   }
  });
 }
 return Object.freeze({ROOM_PRESETS,REQUIRED,BUILDINGS,planRoom,inspectRoom,inspectParcel,createRuntime});
});
