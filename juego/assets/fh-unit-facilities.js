/* Blakpine-Wood · Sanitarios accesibles para unidades, independiente del controlador.
 * Reutiliza la navegación del motor y el estado real de FHServices.
 * Sólo propone rutas; el control humano o IA mueve la unidad y confirma la llegada.
 */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHUnitFacilities=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const valid=v=>typeof v==='number'&&Number.isFinite(v);
 const pointOk=p=>!!p&&Number.isInteger(p.floor)&&valid(p.x)&&valid(p.z);
 function createRuntime(project,options={}){
  const cell=valid(options.cell)&&options.cell>0?options.cell:1;
  const step=valid(options.step)&&options.step>0?options.step:cell/2;
  const maxVisited=Number.isInteger(options.maxVisited)&&options.maxVisited>0?Math.min(12000,options.maxVisited):3500;
  const walk=options.canWalk;
  if(typeof walk!=='function')throw Error('Falta la comprobación de colisión del motor');
  const geometry=options.geometry||root?.FHStyleProperty;
  const audit=options.roomAudit||root?.FHConstructionRooms;
  const goap=options.goap||root?.FHNPCGOAP;
  const route=typeof options.route==='function'?options.route:goap?.route;
  if(!geometry?.roomInProperty||!geometry?.roomContains||!geometry?.inside||!audit?.inspectRoom||!route)
   throw Error('Faltan módulos de habitaciones o navegación NPC');
  const services=()=>typeof options.getServices==='function'?options.getServices():options.services;
  const construction=()=>typeof options.getConstruction==='function'?options.getConstruction():options.construction;
  const transitions=()=>typeof options.transitions==='function'?options.transitions():options.transitions||[];
  const getParcel=id=>(project?.properties||[]).find(p=>String(p?.id)===String(id)&&!!id)||null;
  // El controlador externo administra derechos. Esta API no abre puertas ni concede acceso.
  const hasPermission=(unitId,property)=>typeof options.canUseParcel!=='function'||
   options.canUseParcel({unitId,property})===true;
  function fixtureReady(floor,it){
   const current=services();
   if(typeof current?.statusFor!=='function')return false;
   try{
    const status=current.statusFor(floor,it);
    return status?.broken!==true&&status?.water?.water===true&&
     status?.water?.legacy!==true&&status?.drain?.draining===true;
   }catch{return false;}
  }
  function isComplete(property){
   if(property.construction?.simulated!==true)return true;
   return construction()?.status?.(property.id)?.finished===true;
  }
  function bathroom(property){
   const floor=(project?.floors||[]).findIndex(f=>String(f.id)===String(property.floorId));
   if(floor<0)return [];
   return (project.floors[floor].items||[]).filter(room=>room.type==='room'&&room.constructionRoom==='bano'
    &&geometry.roomInProperty(room,property)).map(room=>({room,floor})).filter(({room})=>
      audit.inspectRoom(project,property.floorId,room,{geometry,services:services()})?.status==='ready');
  }
  function fixtures(floor,room){
   return (project.floors[floor].items||[]).filter(it=>it!==room&&
     ((it.modelId==='inodoro_clasico'||it.modelId==='inodoro_antiguo'||it.type==='toilet')&&
      valid(it.x)&&valid(it.y)&&geometry.roomContains(room,{x:it.x,y:it.y})&&fixtureReady(floor,it)));
  }
  function candidates(floor,room,property,fixture){
   const result=[];
   // Puntos junto al inodoro, nunca dentro de él. No se añaden objetos o colisiones.
   const directions=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
   for(const radius of [.65,1.0]){
    for(const [dx,dz] of directions){
     const mag=Math.hypot(dx,dz),x=fixture.x+dx/mag*radius,z=fixture.y+dz/mag*radius;
     if(!geometry.roomContains(room,{x,y:z})||!geometry.inside({x,y:z},property.polygon))continue;
     if(!walk(floor,x*cell,z*cell))continue;
     result.push({floor,x:x*cell,z:z*cell});
    }
   }
   return result;
  }
  function findBathroom({parcelId,from,unitId=null}={}){
   if(!pointOk(from)||!walk(from.floor,from.x,from.z))return {ok:false,reason:'origen_invalido'};
   // La búsqueda se limita a la parcela indicada por el controlador.
   const property=getParcel(parcelId);
   if(!property)return {ok:false,reason:'sin_parcela'};
   if(!hasPermission(unitId,property))return {ok:false,reason:'sin_permiso'};
   if(!isComplete(property))return {ok:false,reason:'obra_pendiente'};
   const available=bathroom(property);
   if(!available.length)return {ok:false,reason:'sin_bano_funcional'};
   let best=null;
   for(const {room,floor} of available){
    const optionsForRoom=fixtures(floor,room).flatMap(it=>candidates(floor,room,property,it)
     .map(target=>({fixture:it,target})))
     .sort((a,b)=>Math.hypot(a.target.x-from.x,a.target.z-from.z)-
                     Math.hypot(b.target.x-from.x,b.target.z-from.z)).slice(0,8);
    for(const {fixture,target} of optionsForRoom){
     const path=route(from,target,{canWalk:options.canPlanWalk||walk,step,maxVisited,transitions:transitions()});
     if(!path?.length)continue;
     const last=path[path.length-1];
     // GOAP puede ajustar el destino a la rejilla. Nunca aceptar un punto fuera del baño.
     if(last.floor!==floor||!geometry.roomContains(room,{x:last.x/cell,y:last.z/cell})||
       !geometry.inside({x:last.x/cell,y:last.z/cell},property.polygon)||
       Math.hypot(last.x-fixture.x*cell,last.z-fixture.y*cell)>1.75*cell)continue;
     const distance=path.reduce((d,p,i)=>i?d+Math.hypot(p.x-path[i-1].x,p.z-path[i-1].z)+
       (p.floor===path[i-1].floor?0:step*2):0,0);
     if(!best||distance<best.distance){
      best={ok:true,unitId,parcelId:property.id,floorId:property.floorId,roomId:String(room.roomId||room.id||''),
       fixtureId:String(fixture.id||''),target:last,path,distance};
     }
    }
   }
   return best||{ok:false,reason:'sin_ruta'};
  }
  function verifyArrival(plan,position,{unitId=null}={}){
   if(!plan?.ok||!pointOk(position)||!pointOk(plan.target))return false;
   if(plan.unitId!==null&&plan.unitId!==unitId)return false;
   const property=getParcel(plan.parcelId);
   if(!property||!hasPermission(unitId,property)||!isComplete(property))return false;
   const floor=(project.floors||[]).findIndex(f=>String(f.id)===String(property.floorId));
   if(floor<0||floor!==position.floor||floor!==plan.target.floor)return false;
   const room=project.floors[floor].items.find(it=>it.type==='room'&&
    String(it.roomId||it.id)===String(plan.roomId)&&it.constructionRoom==='bano'&&geometry.roomInProperty(it,property));
   const fixture=project.floors[floor].items.find(it=>String(it.id)===String(plan.fixtureId)&&
    (it.type==='toilet'||it.modelId==='inodoro_clasico'||it.modelId==='inodoro_antiguo'));
   if(!room||!fixture||!geometry.roomContains(room,{x:fixture.x,y:fixture.y})||
    !fixtureReady(floor,fixture))return false;
   if(audit.inspectRoom(project,property.floorId,room,{geometry,services:services()})?.status!=='ready')return false;
   if(!walk(floor,position.x,position.z)||!geometry.roomContains(room,{x:position.x/cell,y:position.z/cell}))return false;
   return Math.hypot(position.x-plan.target.x,position.z-plan.target.z)<=step*.65 &&
    Math.hypot(position.x-fixture.x*cell,position.z-fixture.y*cell)<=1.75*cell;
  }
  return Object.freeze({findBathroom,verifyArrival});
 }
 return Object.freeze({createRuntime});
});
