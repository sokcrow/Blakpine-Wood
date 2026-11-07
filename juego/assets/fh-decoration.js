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
  const SNAP_MODES=Object.freeze({corner:1,half:.5,quarter:.25,free:0});
  function snapStep(mode='half'){return Object.prototype.hasOwnProperty.call(SNAP_MODES,mode)?SNAP_MODES[mode]:SNAP_MODES.half}
  function snapPoint(x,y,mode='half'){
    const step=snapStep(mode),round=v=>Math.round(v*1000)/1000;
    return {x:round(step?Math.round(finite(x)/step)*step:finite(x)),
      y:round(step?Math.round(finite(y)/step)*step:finite(y))};
  }
  // Los muebles del mapa son editables; arquitectura, controles fijos y accesos no lo son.
  const FIXED_TYPES=new Set(['wall','red_wall','half_wall','fence','window','door','peephole_door','room','hall','outside','building','pavement','parking','grass','dirt','opening','spawn','stairs','elevator','light_switch','light_fixture','breaker_panel','battery_pickup','camera','security_camera']);
  const FURNITURE_TYPES=new Set(['chair','sofa','bed','tv','table','dining','kitchen','bath','toilet','desk','cabinet','shelf','plant','furniture','misc']);
  function isMovable(item){
    if(!item||typeof item.id!=='string'||!item.id||item.decoratable===false||FIXED_TYPES.has(item.type))return false;
    if(item.runtimeDecoratable===true)return true;
    if(item.modelId&&/^(puerta_|pinpad|lector_|cerradura_|camara_seguridad|panel_electrico)/i.test(item.modelId))return false;
    return FURNITURE_TYPES.has(item.type)||!!item.modelId;
  }
  // Un bloqueo invalida la confirmación, no el arrastre visual.
  function preview(item,items,options={}){
    const result=candidate(item,items,options);
    const requested={...item,x:finite(options.x,item?.x),y:finite(options.y,item?.y),
      rotation:normalizeDegrees(options.rotation??item?.rotation)};
    delete requested.support;delete requested.wallId;
    const pose=snapshot(result.ok?result.item:requested);
    return {ok:result.ok,reason:result.reason||'',pose,result};
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
  return {normalizeDegrees,snapshot,applyPose,footprintPoints,candidate,preview,isMovable,snapPoint,snapStep};
});
