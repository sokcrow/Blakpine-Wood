/* Safe Lock: un gesto de puntero produce un toque O una pulsación sostenida. */
(function (global) {
 'use strict';
 function bind(element, handlers, options={}) {
  const threshold=Number.isFinite(options.threshold)?options.threshold:350;
  const tolerance=Number.isFinite(options.tolerance)?options.tolerance:12;
  const clock=options.clock||{
   now:()=>global.performance.now(),
   setTimeout:(fn,ms)=>global.setTimeout(fn,ms),
   clearTimeout:id=>global.clearTimeout(id)
  };
  const pointers=new Set();
  let active=null;
  function clear() {
   if(active)clock.clearTimeout(active.timer);
   active=null;
  }
  function down(event) {
   if(event.button!==undefined&&event.button!==0)return;
   pointers.add(event.pointerId);
   if(pointers.size!==1){clear();return;}
   if(handlers.canStart?.(event)===false)return;
   const state={id:event.pointerId,x:event.clientX,y:event.clientY,time:clock.now(),held:false,timer:null};
   active=state;
   state.timer=clock.setTimeout(()=>{
    if(active!==state||pointers.size!==1)return;
    state.held=true;
    handlers.onHold?.(event);
   },threshold);
   // El canvas ya captura el puntero para mover la cámara.
   if(options.capture&&element.setPointerCapture){
    try{element.setPointerCapture(event.pointerId);}catch(_error){}
   }
  }
  function move(event) {
   if(!active||active.id!==event.pointerId)return;
   if(Math.hypot(event.clientX-active.x,event.clientY-active.y)>tolerance){
    const held=active.held;
    clear();
    if(held)handlers.onCancel?.(event);
   }
  }
  function up(event) {
   pointers.delete(event.pointerId);
   if(!active||active.id!==event.pointerId)return;
   const state=active;
   clear();
   if(Math.hypot(event.clientX-state.x,event.clientY-state.y)>tolerance)return;
   if(state.held)return; // Nunca ejecutar el toque al soltar después de Hold.
   if(clock.now()-state.time>=threshold)handlers.onHold?.(event);
   else handlers.onTap?.(event);
  }
  function cancel(event) {
   pointers.delete(event.pointerId);
   if(active?.id!==event.pointerId)return;
   const held=active.held;
   clear();
   if(held)handlers.onCancel?.(event);
  }
  element.addEventListener('pointerdown',down);
  element.addEventListener('pointermove',move);
  element.addEventListener('pointerup',up);
  element.addEventListener('pointercancel',cancel);
  // El foco puede perderse mientras se mantiene pulsado.
  global.addEventListener?.('blur',()=>{pointers.clear();clear();});
  return {cancel:()=>{pointers.clear();clear();}};
 }
 global.FHSafeLock=Object.freeze({bind});
})(typeof window!=='undefined'?window:globalThis);
