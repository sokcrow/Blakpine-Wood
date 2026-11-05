/* Forest Horror — estaciones PC por piezas físicas, sin escritorio obligatorio.
 * Distancias en casillas del JSON (cada casilla = feetPerCell); no modifica mapas.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHPcAssembly=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const PARTS=Object.freeze({monitor:'monitor_crt',keyboard:'teclado_pc',mouse:'mouse_pc',cabinet:'gabinete_pc'});
 const MODEL_PARTS=new Set(Object.values(PARTS));
 const TABLE_MODELS=new Set([
  'escritorio_pc','escritorio_clasico','escritorio_l',
  'mesa_pequena','mesa_cocina_cuadrada','mesa_cocina_redonda','mesa_cocina_rectangular',
  'barra_cocina','encimera_simple'
 ]);
 const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
 const hasPosition=item=>!!item&&Number.isFinite(Number(item.x))&&Number.isFinite(Number(item.y));
 const distanceFt=(a,b,cell)=>Math.hypot((Number(a.x)-Number(b.x))*cell,(Number(a.y)-Number(b.y))*cell);
 function isWorkSurface(item){
  if(!item||MODEL_PARTS.has(item.modelId)||item.type==='chair'||item.type==='sofa')return false;
  return TABLE_MODELS.has(item.modelId)||item.type==='table'||item.type==='dining'||
   (item.pcWorkSurface===true);
 }
 function nearAnchor(item,anchor,feetPerCell=5){
  if(!hasPosition(item)||!hasPosition(anchor))return false;
  const cell=Math.max(.01,finite(feetPerCell,5));
  const w=Math.max(0,finite(anchor.w,0))*cell,d=Math.max(0,finite(anchor.h,0))*cell;
  const maxDistance=Math.max(cell*1.10,Math.hypot(w,d)*.5+1.25);
  return distanceFt(item,anchor,cell)<=maxDistance;
 }
 function sameApartment(a,b){
  return !a?.apartmentId||!b?.apartmentId||a.apartmentId===b.apartmentId;
 }
 function nearestSurfaceFor(part,items,cell){
  const surfaces=items.filter(isWorkSurface).filter(host=>host.id!==part.id&&sameApartment(part,host)&&nearAnchor(part,host,cell));
  const explicit=surfaces.find(host=>host.id&&part.support?.parentItemId===host.id);
  if(explicit)return explicit;
  // Una pieza fijada a OTRA mesa no debe saltar de estación por proximidad.
  if(part.support?.parentItemId&&items.some(host=>host.id===part.support.parentItemId&&isWorkSurface(host)))return null;
  return surfaces.sort((a,b)=>distanceFt(a,part,cell)-distanceFt(b,part,cell))[0]||null;
 }
 function belongsTo(part,host,items,cell){
  if(!part||!host||!sameApartment(part,host)||!nearAnchor(part,host,cell))return false;
  if(isWorkSurface(host))return nearestSurfaceFor(part,items,cell)?.id===host.id;
  // Sin mesa: el monitor se convierte en el punto de interacción de la PC.
  if(host.modelId!=='monitor_crt')return false;
  if(part===host)return true;
  return !nearestSurfaceFor(part,items,cell);
 }
 function cabinetNearDesk(cabinet,desk,feetPerCell=5){
  return !!cabinet&&!!desk&&(!cabinet.support||cabinet.support.parentItemId===desk.id)&&
   nearAnchor(cabinet,desk,feetPerCell);
 }
 function inspect(host,items,feetPerCell=5){
  const list=Array.isArray(items)?items:[],cell=Math.max(.01,finite(feetPerCell,5));
  const components={},missing=[];
  for(const [key,modelId] of Object.entries(PARTS)){
   components[key]=list.find(part=>part&&part.modelId===modelId&&part.id!==host?.id&&
    belongsTo(part,host,list,cell))||null;
   if(key==='monitor'&&host?.modelId==='monitor_crt')components[key]=host;
   if(!components[key])missing.push(key);
  }
  return {ready:!!host&&missing.length===0,missing,components};
 }
 function isTerminalCandidate(item,items,feetPerCell=5){
  if(!item)return false;
  if(item.pcTerminal===true||item.modelId==='escritorio_pc')return true;
  const list=Array.isArray(items)?items:[];
  if(isWorkSurface(item))
   return list.some(part=>part&&MODEL_PARTS.has(part.modelId)&&belongsTo(part,item,list,feetPerCell));
  if(item.modelId==='monitor_crt'){
   // No crear una segunda interacción sobre el monitor de una mesa usable.
   if(nearestSurfaceFor(item,list,feetPerCell))return false;
   return list.some(part=>part&&part!==item&&MODEL_PARTS.has(part.modelId)&&
    belongsTo(part,item,list,feetPerCell));
  }
  return false;
 }
 function frontTarget(seat,items,options={}){
  if(!seat||!['chair','sofa'].includes(seat.type)||!Array.isArray(items))return null;
  const cell=Math.max(.01,finite(options.cell,1.524)),r=finite(seat.rotation)*Math.PI/180;
  const fx=-Math.sin(r),fz=Math.cos(r);
  let best=null;
  for(const item of items){
   if(!item||item.id===seat.id||['chair','sofa','bed','tv'].includes(item.type))continue;
   const pc=!!options.isPc?.(item);
   if(!pc&&MODEL_PARTS.has(item.modelId))continue;
   if(!pc&&!item.interact)continue;
   if(!pc&&!['use','read','open','search','take','examine'].includes(item.interact?.verb))continue;
   const dx=(finite(item.x)-finite(seat.x))*cell,dz=(finite(item.y)-finite(seat.y))*cell;
   const dist=Math.hypot(dx,dz),range=pc?3.5:2.5;
   if(dist<.35||dist>range||(dx*fx+dz*fz)/dist<.65)continue;
   const from={x:finite(seat.x)*cell+fx*.15,z:finite(seat.y)*cell+fz*.15};
   const to={x:finite(item.x)*cell-fx*.15,z:finite(item.y)*cell-fz*.15};
   if(typeof options.isClear==='function'&&!options.isClear(from,to,seat,item))continue;
   if(!best||dist<best.dist)best={item,dist};
  }
  return best;
 }
 return {PARTS,isWorkSurface,nearAnchor,cabinetNearDesk,inspect,isTerminalCandidate,frontTarget};
});
