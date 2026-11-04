/* Forest Horror: sueño gradual sobre la postura "lie" existente. */
(function(global){
 'use strict';
 const CONFIG=Object.freeze({delay:1.8,fallAsleep:8.2,wakeDelay:1.6});
 const clamp=x=>Math.min(1,Math.max(0,x));
 const ease=x=>x*x*(3-2*x);
 function createController(){
  let elapsed=0,depth=0,stage='awake',holdAwake=false,wakeLeft=0,wakeAction=null;
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
    if(phase==='standing'){elapsed=0;holdAwake=false;depth=0;stage='awake';}
   }
   if(stage!==previous&&bus?.emit)bus.emit('player:sleepState',status());
   return status();
  }
  function requestWake(action){
   if(typeof action!=='function')return {ok:false,reason:'missing_action'};
   if(wakeLeft>0)return {ok:true,waking:true};
   if(stage==='asleep'||depth>=.75){
    holdAwake=true;stage='waking';wakeLeft=CONFIG.wakeDelay;wakeAction=action;
    return {ok:true,waking:true};
   }
   holdAwake=true;return action();
  }
  function viewWeight(){return depth;}
  function renderMask(ctx,width,height,x,y){
   if(depth<.003)return false;
   const w=Math.max(1,width),h=Math.max(1,height),t=ease(clamp(depth));
   const start=Math.hypot(w,h)*1.3,end=Math.max(74,h*.19,Math.min(w,h)*.12);
   const radius=start+(end-start)*t,feather=Math.min(26,Math.max(7,radius*.06));
   ctx.fillStyle='rgba(0,0,0,'+clamp(t*1.08)+')';ctx.fillRect(0,0,w,h);
   const gradient=ctx.createRadialGradient(x,y,Math.max(0,radius-feather),x,y,radius+feather);
   gradient.addColorStop(0,'rgba(0,0,0,1)');gradient.addColorStop(1,'rgba(0,0,0,0)');
   ctx.save();ctx.globalCompositeOperation='destination-out';
   ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);ctx.restore();
   return true;
  }
  return Object.freeze({status,update,requestWake,viewWeight,renderMask});
 }
 global.FHSleep=global.FHSleep||createController();
 global.FHCreateSleepController=createController;
})(window);
