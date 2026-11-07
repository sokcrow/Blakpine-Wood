/* Forest Horror: sueño gradual sobre la postura "lie" existente. */
(function(global){
 'use strict';
 const CONFIG=Object.freeze({delay:1.8,fallAsleep:8.2,wakeDelay:1.6,breathDelay:2.2,breathCycle:3.8});
 const clamp=x=>Math.min(1,Math.max(0,x));
 const ease=x=>x*x*(3-2*x);
 function createController(){
  let elapsed=0,depth=0,stage='awake',holdAwake=false,wakeLeft=0,wakeAction=null,asleepTime=0;
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
   asleepTime=stage==='asleep'?asleepTime+step:0;
   if(stage!==previous){
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
    return {ok:true,waking:true};
   }
   holdAwake=true;return action();
  }
  function viewWeight(){return depth;}
  function drawBreathing(ctx,x,y){
   if(stage!=='asleep'||asleepTime<CONFIG.breathDelay||!Number.isFinite(x)||!Number.isFinite(y))return;
   const t=((asleepTime-CONFIG.breathDelay)%CONFIG.breathCycle)/CONFIG.breathCycle;
   const alpha=Math.pow(Math.sin(Math.PI*t),1.5)*.82;
   if(alpha<.012)return;
   const label=String(global.FH_SLEEP_TEXT?.breath||'Zzz');
   const letters=Math.max(1,Math.min(label.length,Math.ceil(t*label.length*2.8)));
   ctx.save();
   ctx.globalAlpha=alpha;
   ctx.font='italic 21px Georgia, serif';
   ctx.textBaseline='middle';
   ctx.textAlign='left';
   ctx.lineWidth=3;
   ctx.strokeStyle='rgba(0,0,0,.78)';
   ctx.fillStyle='#f3efe6';
   const bx=x+14+t*9,by=y-18-t*24;
   ctx.strokeText(label.slice(0,letters),bx,by);
   ctx.fillText(label.slice(0,letters),bx,by);
   ctx.restore();
  }
  function renderMask(ctx,width,height,x,y,breathX=x,breathY=y){
   if(depth<.003)return false;
   const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1);
   const t=ease(clamp(depth)),radius=Math.hypot(w,h)*1.1*Math.pow(1-t,1.1);
   ctx.save();
   ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
   if(radius>1){
    const feather=Math.min(90,Math.max(12,radius*.14));
    const gradient=ctx.createRadialGradient(x,y,Math.max(0,radius-feather),x,y,radius+feather);
    gradient.addColorStop(0,'rgba(0,0,0,1)');gradient.addColorStop(1,'rgba(0,0,0,0)');
    ctx.globalCompositeOperation='destination-out';
    ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
    ctx.globalCompositeOperation='source-over';
   }
   drawBreathing(ctx,breathX,breathY);
   ctx.restore();
   return true;
  }
  return Object.freeze({status,update,requestWake,viewWeight,renderMask});
 }
 global.FHSleep=global.FHSleep||createController();
 global.FHCreateSleepController=createController;
})(window);
