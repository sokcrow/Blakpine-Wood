/* Blakpine-Wood — reglas de CCTV; sin dependencias de Three.js. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHCCTV=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const LIMIT=45;
 const MODES=Object.freeze(['manual','automatic','fixed']);
 const SWEEP_MOVE_MS=9000,SWEEP_PAUSE_MS=1000;
 const SWEEP_CYCLE_MS=2*(SWEEP_MOVE_MS+SWEEP_PAUSE_MS);
 const MANUAL_SPEED_DEG_PER_SEC=30;
 const clamp=value=>Math.max(-LIMIT,Math.min(LIMIT,value));
 const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
 function isCamera(item){
  return !!item&&(item.modelId==='camara_seguridad'||item.type==='camera');
 }
 function modeFor(item){
  const mode=item?.cameraMode;
  return MODES.includes(mode)?mode:(item?.modelId==='camara_seguridad'?'automatic':'fixed');
 }
 function sweepAngle(ms,periodMs=SWEEP_CYCLE_MS){
  // Cada ida dura 9 s, cada extremo espera 1 s (ciclo 20 s).
  // Un periodo opcional ajusta el ciclo completo conservando las proporciones.
  const period=Math.max(4000,finite(periodMs,SWEEP_CYCLE_MS));
  const phase=((finite(ms,0)%period)+period)%period/period;
  const move=SWEEP_MOVE_MS/SWEEP_CYCLE_MS;
  const pause=SWEEP_PAUSE_MS/SWEEP_CYCLE_MS;
  const eased=t=>(1-Math.cos(Math.PI*t))/2;
  if(phase<move)return -LIMIT+2*LIMIT*eased(phase/move);
  if(phase<move+pause)return LIMIT;
  if(phase<2*move+pause)return LIMIT-2*LIMIT*eased((phase-move-pause)/move);
  return -LIMIT;
 }
 function createRuntime(floors=[]){
  const entries=new Map();
  (Array.isArray(floors)?floors:[]).forEach((floor,index)=>{
   for(const item of floor?.items||[]){
    if(!isCamera(item)||typeof item.id!=='string'||!item.id||entries.has(item.id))continue;
    entries.set(item.id,{
     item,floor:index,mode:modeFor(item),
     manualDeg:clamp(finite(item.cameraManualDeg,0)),
     targetDeg:clamp(finite(item.cameraManualDeg,0)),manualAtMs:0
    });
   }
  });
  function entry(id){return entries.get(String(id||''))||null;}
  function angleFor(id,nowMs=0){
   const cam=entry(id);
   if(!cam)return null;
   if(cam.mode==='fixed')return 0;
   if(cam.mode==='manual'){
    const delta=cam.targetDeg-cam.manualDeg;
    const elapsed=Math.max(0,finite(nowMs,0)-cam.manualAtMs);
    const step=MANUAL_SPEED_DEG_PER_SEC*elapsed/1000;
    return cam.manualDeg+Math.sign(delta)*Math.min(Math.abs(delta),step);
   }
   return sweepAngle(nowMs,finite(cam.item.cameraSweepMs,SWEEP_CYCLE_MS));
  }
  function setManualAngle(id,angle,nowMs=0){
   const cam=entry(id);
   if(!cam||cam.mode!=='manual'||!Number.isFinite(Number(angle)))return false;
   const time=Math.max(0,finite(nowMs,0));
   cam.manualDeg=angleFor(id,time);
   cam.targetDeg=clamp(Number(angle));
   cam.manualAtMs=time;
   return true;
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
   // Un montaje sobre pared sitúa el origen en su superficie. La lente debe
   // quedar delante del muro, no en medio del espesor ni del plano de corte.
   const baseBearing=finite(item.rotation,0)*Math.PI/180;
   const forward=typeof item.wallId==='string'&&item.wallId?0.20:0;
   const x=finite(item.x)*cell-Math.sin(baseBearing)*forward;
   const z=finite(item.y)*cell+Math.cos(baseBearing)*forward;
   return {id:item.id,floor:cam.floor,x,y:base+mount,z,
    bearing,angleDeg:angleFor(id,nowMs),mode:cam.mode,
    fovDeg:Math.max(25,Math.min(100,finite(item.cameraFovDeg,48)))};
  }
  return Object.freeze({list,view,angleFor,setManualAngle,has:id=>!!entry(id)});
 }
 return Object.freeze({LIMIT,MODES,isCamera,modeFor,sweepAngle,createRuntime});
});
