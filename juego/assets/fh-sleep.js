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
   global.document?.body?.classList?.toggle('fh-sleep-masking',depth>=.003);
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
  // Cámara cenital estricta: "up" horizontal evita la singularidad de lookAt
  // cuando el visor está exactamente encima del personaje.
  function cameraPose(x,z,ground,facing){
   const a=Number(facing)||0,base=Number(ground)||0;
   return {x:Number(x)||0,z:Number(z)||0,eyeY:base+6.5,focusY:base+.45,
    upX:-Math.sin(a),upZ:-Math.cos(a)};
  }
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
   const radius=Math.hypot(w,h)*1.25*(1-ease(clamp(depth)));
   ctx.save();
   ctx.globalCompositeOperation='source-over';
   ctx.clearRect(0,0,w,h);
   if(radius<=1){
    ctx.fillStyle='#000';
   }else{
    // Dibujar negro directamente: no depender de destination-out ni de la
    // transparencia acumulada del canvas del visor de mirilla.
    const inner=radius*.72;
    const gradient=ctx.createRadialGradient(x,y,inner,x,y,radius);
    gradient.addColorStop(0,'rgba(0,0,0,0)');
    gradient.addColorStop(1,'rgba(0,0,0,1)');
    ctx.fillStyle=gradient;
   }
   ctx.fillRect(0,0,w,h);
   drawBreathing(ctx,breathX,breathY);
   ctx.restore();
   return true;
  }
  return Object.freeze({status,update,requestWake,viewWeight,cameraPose,renderMask});
 }
 global.FHSleep=global.FHSleep||createController();
 global.FHCreateSleepController=createController;
})(window);
