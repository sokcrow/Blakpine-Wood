/* Forest Horror: sueño gradual sobre la postura "lie" existente. */
(function(global){
 'use strict';
 const CONFIG=Object.freeze({delay:1.8,comfortDelay:3,fallAsleep:8.2,wakeDelay:1.6,breathDelay:2.2,breathCycle:3.8});
 const clamp=x=>Math.min(1,Math.max(0,x));
 const ease=x=>x*x*(3-2*x);
 function createController(){
  let elapsed=0,depth=0,stage='awake',holdAwake=false,wakeLeft=0,wakeAction=null,asleepTime=0,nextBreath=CONFIG.breathDelay,comfortShown=false;
  function status(){return {stage,depth,vulnerable:stage==='asleep',
   vulnerability:stage==='asleep'?2.5:stage==='waking'?1.75:stage==='drowsy'?1+depth*.9:stage==='resting'?1.2:1,
   wakeDelayRemaining:wakeLeft};}
  function update(dt,phase,verb,type,bus){
   const active=type==='bed'&&verb==='lie'&&phase==='lying';
   const previous=stage,step=Math.max(0,Math.min(.1,Number(dt)||0));
   if(active){
    if(wakeLeft>0){
     stage='waking';wakeLeft=Math.max(0,wakeLeft-step);
     depth=Math.max(0,depth-step/CONFIG.wakeDelay);
     if(wakeLeft===0&&wakeAction){const action=wakeAction;wakeAction=null;action();}
    }else if(holdAwake){
     stage='waking';depth=Math.max(0,depth-step/CONFIG.wakeDelay);
    }else{
     elapsed+=step;depth=clamp((elapsed-CONFIG.delay)/CONFIG.fallAsleep);
     stage=depth>=1?'asleep':depth>0?'drowsy':'resting';
    }
   }else{
    depth=Math.max(0,depth-step/CONFIG.wakeDelay);
    stage=depth>0?'waking':'awake';wakeLeft=0;wakeAction=null;
    if(phase==='standing'){elapsed=0;comfortShown=false;holdAwake=false;depth=0;stage='awake';}
   }
   asleepTime=stage==='asleep'?asleepTime+step:0;
   if(stage!=='asleep')nextBreath=CONFIG.breathDelay;
   global.document?.body?.classList?.toggle('fh-sleep-masking',depth>=.003);
   syncIris();
   if(stage!==previous){
    if(previous==='asleep'||(!active&&comfortShown))global.FHLiveText?.clearKind?.('sleep');
    global.document?.body?.classList?.toggle('fh-sleeping',stage==='asleep');
    if(bus?.emit)bus.emit('player:sleepState',status());
   }
   return status();
  }
  function requestWake(action){
   if(typeof action!=='function')return {ok:false,reason:'missing_action'};
   if(wakeLeft>0)return {ok:true,waking:true};
   if(stage==='asleep'||depth>=.75){
    holdAwake=true;stage='waking';wakeLeft=CONFIG.wakeDelay;wakeAction=action;
    global.document?.body?.classList?.remove('fh-sleeping');
    global.FHLiveText?.clearKind?.('sleep');
    return {ok:true,waking:true};
   }
   holdAwake=true;return action();
  }
  // Velo propio: la oclusión ya no depende de #mist ni del render de mirilla.
  let veil=null;
  function irisRadius(width,height,progress=depth){
   const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1);
   const start=Math.hypot(w,h)*.70;
   // Mantener el centro visible, como un ojo entreabierto: no cerrar a negro.
   const minimum=Math.min(w,h)*.24;
   return start+(minimum-start)*ease(clamp(progress));
  }
  function syncIris(){
   const doc=global.document;
   if(!doc?.body)return;
   if(!veil&&depth>=.003&&typeof doc.createElement==='function'){
    veil=doc.getElementById?.('fhSleepVeil')||doc.createElement('div');
    veil.id='fhSleepVeil';
    veil.setAttribute?.('aria-hidden','true');
    if(!veil.parentNode)doc.body.appendChild?.(veil);
   }
   if(!veil)return;
   if(depth<.003){veil.style.display='none';return;}
   const w=Math.max(1,Number(global.innerWidth)||doc.documentElement?.clientWidth||800);
   const h=Math.max(1,Number(global.innerHeight)||doc.documentElement?.clientHeight||600);
   const radius=irisRadius(w,h);
   veil.style.display='block';
   veil.style.background='radial-gradient(circle '+radius.toFixed(1)+'px at 50% 50%, transparent '+(radius*.80).toFixed(1)+'px, #000 '+radius.toFixed(1)+'px)';
  }
  function viewWeight(){return depth;}
  // Cámara cenital estricta: "up" horizontal evita la singularidad de lookAt
  // cuando el visor está exactamente encima del personaje.
  function cameraPose(x,z,ground,facing){
   const a=Number(facing)||0,base=Number(ground)||0;
   return {x:Number(x)||0,z:Number(z)||0,eyeY:base+6.5,focusY:base+.45,
    upX:-Math.sin(a),upZ:-Math.cos(a)};
  }
  function needsComfort(){
   return !comfortShown&&elapsed>=CONFIG.comfortDelay&&(stage==='resting'||stage==='drowsy');
  }
  function emitComfort(point){
   if(!needsComfort()||!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)||!Number.isFinite(point.z))return false;
   const emitted=global.FHLiveText?.soundAt?.({
    kind:'sleep',text:String(global.FH_SLEEP_TEXT?.comfort||'Qué cómodo...'),
    x:point.x,y:point.y,z:point.z,floor:point.floor,self:true,level:1,
    screenX:point.screenX,screenY:point.screenY
   })===true;
   if(emitted)comfortShown=true;
   return emitted;
  }
  function needsBreath(){
   return stage==='asleep' && asleepTime+1e-6>=nextBreath;
  }
  function emitBreath(point){
   if(!needsBreath()||!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)||!Number.isFinite(point.z))return false;
   const emitted=global.FHLiveText?.soundAt?.({
    kind:'sleep',text:String(global.FH_SLEEP_TEXT?.breath||'Zzz'),
    x:point.x,y:point.y,z:point.z,floor:point.floor,self:true,level:1,
    screenX:point.screenX,screenY:point.screenY
   })===true;
   if(emitted)nextBreath=asleepTime+CONFIG.breathCycle;
   return emitted;
  }
  return Object.freeze({status,update,requestWake,viewWeight,cameraPose,irisRadius,needsComfort,emitComfort,needsBreath,emitBreath});
 }
 global.FHSleep=global.FHSleep||createController();
 global.FHCreateSleepController=createController;
})(window);
