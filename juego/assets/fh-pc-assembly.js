/* Forest Horror — armado de computadoras y objetivos frente a un asiento.
 * Reglas puras: el JSON mantiene sus campos anteriores; pcAssemblyRequired es opcional.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHPcAssembly=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const PARTS=Object.freeze({monitor:'monitor_crt',keyboard:'teclado_pc',mouse:'mouse_pc',cabinet:'gabinete_pc'});
 const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
 function cabinetNearDesk(cabinet,desk,feetPerCell=5){
  if(!cabinet||!desk||cabinet.support)return false;
  const cell=Math.max(.01,finite(feetPerCell,5));
  const dx=(finite(cabinet.x)-finite(desk.x))*cell,dz=(finite(cabinet.y)-finite(desk.y))*cell;
  const rad=-finite(desk.rotation)*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad);
  const x=c*dx-s*dz,z=s*dx+c*dz;
  const width=Math.max(.5,finite(desk.w,1)*cell),depth=Math.max(.5,finite(desk.h,1)*cell);
  // La torre puede estar debajo o junto al escritorio, pero no lejos.
  return Math.abs(x)<=width/2+1.25&&Math.abs(z)<=depth/2+1.75;
 }
 function inspect(desk,items,feetPerCell=5){
  const components={},missing=[],list=Array.isArray(items)?items:[];
  for(const [key,modelId] of Object.entries(PARTS)){
   components[key]=list.find(item=>{
    if(!item||item.modelId!==modelId||item.id===desk?.id)return false;
    if(desk?.apartmentId&&item.apartmentId&&item.apartmentId!==desk.apartmentId)return false;
    if(key==='cabinet')
     return item.support?.parentItemId===desk?.id||cabinetNearDesk(item,desk,feetPerCell);
    return !!desk?.id&&item.support?.parentItemId===desk.id;
   })||null;
   if(!components[key])missing.push(key);
  }
  return {ready:!!desk&&missing.length===0,missing,components};
 }
 function frontTarget(seat,items,options={}){
  if(!seat||!['chair','sofa'].includes(seat.type)||!Array.isArray(items))return null;
  const cell=Math.max(.01,finite(options.cell,1.524)),r=finite(seat.rotation)*Math.PI/180;
  const fx=-Math.sin(r),fz=Math.cos(r);
  let best=null;
  for(const item of items){
   if(!item||item.id===seat.id||['chair','sofa','bed','tv'].includes(item.type))continue;
   const pc=!!options.isPc?.(item);
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
 return {PARTS,cabinetNearDesk,inspect,frontTarget};
});
