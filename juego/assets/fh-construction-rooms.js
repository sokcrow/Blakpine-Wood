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
  const inspected=[],preset=property.construction?.preset||property.generatedPrefab?.preset||'personalizado',required=BUILDINGS[preset]||[];
  const issues=[],unverified=[];
  const grouped=preset==='apartamentos'&&Array.isArray(property.generatedPrefab?.apartments)
   &&property.generatedPrefab.apartments.length>0;
  const inspect=(room,floorId,apartmentId='')=>{
   const result=inspectRoom(project,floorId,room,{...options,geometry});
   if(!result)return;
   inspected.push({...result,...(apartmentId?{apartmentId,floorId}:{})});
   issues.push(...result.issues.map(issue=>({...issue,roomId:result.roomId,...(apartmentId?{apartmentId,floorId}:{})})));
   unverified.push(...result.unverified.map(issue=>({...issue,roomId:result.roomId,...(apartmentId?{apartmentId,floorId}:{})})));
  };
  if(grouped){
   const seen=new Set();
   for(const unit of property.generatedPrefab.apartments){
    if(!unit?.id||!unit.floorId||seen.has(unit.id)){
     issues.push({code:'departamento_invalido'});continue;
    }
    seen.add(unit.id);
    const f=(project.floors||[]).find(floor=>String(floor.id)===String(unit.floorId));
    if(!f){issues.push({code:'departamento_invalido',apartmentId:unit.id});continue;}
    const privateRooms=(f.items||[]).filter(it=>it.type==='room'&&it.apartmentId===unit.id
     &&ROOM_PRESETS.includes(it.constructionRoom));
    for(const kind of ['bano','dormitorio','cocina'])if(!privateRooms.some(it=>it.constructionRoom===kind))
     issues.push({code:'falta_habitacion',need:kind,apartmentId:unit.id,floorId:f.id});
    for(const room of privateRooms){
     if((room.constructionRoom==='bano'&&(!room.privateRoom||!room.requiresClosedDoor||
      room.w>3||room.h>3))||(room.constructionRoom==='dormitorio'&&!room.privateRoom))
      issues.push({code:'sin_privacidad',roomId:room.roomId,apartmentId:unit.id,floorId:f.id});
     inspect(room,f.id,unit.id);
    }
    const entrances=(f.items||[]).filter(it=>['door','peephole_door'].includes(it.type)
     &&it.apartmentId===unit.id&&it.doorRole==='entrance');
    const interior=(f.items||[]).filter(it=>['door','peephole_door'].includes(it.type)
     &&it.apartmentId===unit.id&&it.doorRole==='interior');
    const common=(f.items||[]).find(it=>it.type==='room'&&it.commonArea===true);
    const bath=privateRooms.find(it=>it.constructionRoom==='bano');
    const bedroom=privateRooms.find(it=>it.constructionRoom==='dormitorio');
    const living=privateRooms.find(it=>it.constructionRoom==='cocina');
    const connects=(door,first,second)=>{
     if(!door?.a||!door?.b||!first||!second||!geometry.roomContains)return false;
     const x=(door.a.x+door.b.x)/2,y=(door.a.y+door.b.y)/2;
     const dx=door.b.x-door.a.x,dy=door.b.y-door.a.y,length=Math.hypot(dx,dy);
     if(length<.8)return false;
     const normal={x:-dy/length*.15,y:dx/length*.15};
     const a={x:x+normal.x,y:y+normal.y},b={x:x-normal.x,y:y-normal.y};
     return geometry.roomContains(first,a)&&geometry.roomContains(second,b)||
      geometry.roomContains(first,b)&&geometry.roomContains(second,a);
    };
    if(entrances.length!==1||interior.length<2||
     !entrances.some(d=>connects(d,common,living))||
     !interior.some(d=>connects(d,bath,living))||
     !interior.some(d=>connects(d,bedroom,living)))
     issues.push({code:'sin_acceso_privado',apartmentId:unit.id,floorId:f.id});
    if(!common)issues.push({code:'falta_zona_comun',floorId:f.id});
   }
    const floors=property.generatedPrefab.floorIds||[];
    for(let i=0;i<floors.length-1;i++){
     const from=(project.floors||[]).find(f=>f.id===floors[i]);
     if(!from?.items?.some(it=>it.type==='stairs'&&it.targetFloorId===floors[i+1]))
      issues.push({code:'sin_escalera',floorId:floors[i]});
    }
  }else{
   for(const kind of required)if(!rooms.some(room=>room.constructionRoom===kind))
    issues.push({code:'falta_habitacion',need:kind});
   for(const room of rooms)inspect(room,property.floorId);
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
  const unconfigured=!required.length&&!inspected.length;
  return {parcelId:property.id,preset,rooms:inspected,issues,unverified,
   status:issues.length?'incomplete':unverified.length?'unverified':unconfigured?'unconfigured':'ready',
   access:'no_verificado',npcUsable:null};
 }
 function createRuntime(project,options={}){
  const current=()=>({...options,
   services:typeof options.getServices==='function'?options.getServices():options.services,
   construction:typeof options.getConstruction==='function'?options.getConstruction():options.construction});
  return Object.freeze({
   inspectParcel:parcelId=>{
    const property=(project?.properties||[]).find(p=>p?.id===parcelId);
    return inspectParcel(project,property,current());
   },
   inspectRoom:(floorId,roomId)=>{
    const {floor}=floorOf(project,floorId);
    const room=(floor?.items||[]).find(it=>it.type==='room'&&String(it.roomId||it.id)===String(roomId));
    return inspectRoom(project,floorId,room,current());
   }
  });
 }
 return Object.freeze({ROOM_PRESETS,REQUIRED,BUILDINGS,planRoom,inspectRoom,inspectParcel,createRuntime});
});
