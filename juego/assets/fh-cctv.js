/* Blakpine-Wood — reglas de CCTV; sin dependencias de Three.js. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHCCTV=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const LIMIT=45;
 const MODES=Object.freeze(['manual','automatic','fixed']);
 const clamp=value=>Math.max(-LIMIT,Math.min(LIMIT,value));
 const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
 function isCamera(item){
  return !!item&&(item.modelId==='camara_seguridad'||item.type==='camera');
 }
 function modeFor(item){
  const mode=item?.cameraMode;
  return MODES.includes(mode)?mode:(item?.modelId==='camara_seguridad'?'automatic':'fixed');
 }
 function sweepAngle(ms,periodMs=7200){
  const period=Math.max(1000,finite(periodMs,7200));
  return LIMIT*Math.sin(2*Math.PI*((finite(ms,0)%period+period)%period)/period);
 }
 function createRuntime(floors=[]){
  const entries=new Map();
  (Array.isArray(floors)?floors:[]).forEach((floor,index)=>{
   for(const item of floor?.items||[]){
    if(!isCamera(item)||typeof item.id!=='string'||!item.id||entries.has(item.id))continue;
    entries.set(item.id,{
     item,floor:index,mode:modeFor(item),
     manualDeg:clamp(finite(item.cameraManualDeg,0))
    });
   }
  });
  function entry(id){return entries.get(String(id||''))||null;}
  function angleFor(id,nowMs=0){
   const cam=entry(id);
   if(!cam)return null;
   if(cam.mode==='fixed')return 0;
   if(cam.mode==='manual')return cam.manualDeg;
   return sweepAngle(nowMs,finite(cam.item.cameraSweepMs,7200));
  }
  function setManualAngle(id,angle){
   const cam=entry(id);
   if(!cam||cam.mode!=='manual'||!Number.isFinite(Number(angle)))return false;
   cam.manualDeg=clamp(Number(angle));return true;
  }
  function list(nowMs=0){
   return [...entries].map(([id,cam])=>({
    id,place:String(cam.item.label||id).slice(0,100),
    online:cam.item.cameraOnline!==false,
    mode:cam.mode,angleDeg:angleFor(id,nowMs),floor:cam.floor
   }));
  }
  function view(id,nowMs=0,cell=1.524,elevations=[]){
   const cam=entry(id);
   if(!cam||cam.item.cameraOnline===false)return null;
   const item=cam.item;
   const base=finite(elevations[cam.floor],0);
   const bearing=(finite(item.rotation,0)+angleFor(id,nowMs))*Math.PI/180;
   const mount=Math.max(.5,finite(item.mountHeightFt,7))*.3048;
   const x=finite(item.x)*cell,z=finite(item.y)*cell;
   return {id:item.id,floor:cam.floor,x,y:base+mount,z,
    bearing,angleDeg:angleFor(id,nowMs),mode:cam.mode,
    fovDeg:Math.max(25,Math.min(100,finite(item.cameraFovDeg,65)))};
  }
  return Object.freeze({list,view,angleFor,setManualAngle,has:id=>!!entry(id)});
 }
 return Object.freeze({LIMIT,MODES,isCamera,modeFor,sweepAngle,createRuntime});
});
