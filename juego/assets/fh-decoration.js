/* Forest Horror — reglas puras del modo decoración runtime.
 * No renderiza ni guarda por sí mismo: valida una pose candidata y conserva compatibilidad.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.FHDecoration=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const normalizeDegrees=value=>{let n=finite(value)%360;if(n<0)n+=360;return n};

  function snapshot(item){
    return {x:finite(item?.x),y:finite(item?.y),rotation:normalizeDegrees(item?.rotation),support:clone(item?.support),wallId:item?.wallId||''};
  }
  function applyPose(item,pose){
    if(!item||!pose)return item;
    item.x=finite(pose.x,item.x);item.y=finite(pose.y,item.y);item.rotation=normalizeDegrees(pose.rotation??item.rotation);
    if(pose.support) item.support=clone(pose.support); else delete item.support;
    if(pose.wallId) item.wallId=pose.wallId; else delete item.wallId;
    return item;
  }
  function footprintPoints(item,cell=1.524,spacing=.22){
    const w=Math.max(.04,finite(item?.w,1)*cell),d=Math.max(.04,finite(item?.h,1)*cell);
    const cx=finite(item?.x)*cell,cz=finite(item?.y)*cell,rot=finite(item?.rotation)*Math.PI/180,c=Math.cos(rot),s=Math.sin(rot);
    const gap=Math.max(.08,finite(spacing,.22)),nx=Math.max(1,Math.ceil(w/gap)),nz=Math.max(1,Math.ceil(d/gap)),out=[];
    for(let ix=0;ix<=nx;ix++)for(let iz=0;iz<=nz;iz++){
      const lx=-w/2+w*ix/nx,lz=-d/2+d*iz/nz;
      out.push({x:cx+c*lx-s*lz,z:cz+s*lx+c*lz});
    }
    return out;
  }
  function candidate(item,items,options={}){
    if(!item)return {ok:false,reason:'invalid-item'};
    const next={...item,x:finite(options.x,item.x),y:finite(options.y,item.y),rotation:normalizeDegrees(options.rotation??item.rotation)};
    if(item.support)next.support=clone(item.support);
    const placement=String(next.placement||'floor');
    if(placement==='wall'){
      const mount=typeof options.wallMount==='function'?options.wallMount(next):null;
      if(!mount)return {ok:false,reason:'wall-required'};
      next.x=finite(mount.point?.x,next.x);next.y=finite(mount.point?.y,next.y);next.rotation=normalizeDegrees(mount.rotation??next.rotation);
      if(mount.wallId)next.wallId=mount.wallId;delete next.support;
      return {ok:true,item:next,wall:mount};
    }
    if(placement==='surface'||placement==='floor_or_surface'){
      const api=options.surfaceApi;
      if(api?.place){
        const placed=api.place(next,items,options.feetPerCell||5,options.surfaceProvider,{x:next.x,y:next.y});
        if(!placed?.ok)return {ok:false,reason:placed?.reason||'surface-required'};
        if(placed.supported)return {ok:true,item:next,supported:true,parentId:placed.candidate?.parent?.id||''};
      }else if(placement==='surface')return {ok:false,reason:'surface-required'};
    }else delete next.support;
    if(typeof options.floorFits==='function'&&!options.floorFits(next))return {ok:false,reason:'blocked'};
    return {ok:true,item:next,supported:false};
  }
  return {normalizeDegrees,snapshot,applyPose,footprintPoints,candidate};
});
