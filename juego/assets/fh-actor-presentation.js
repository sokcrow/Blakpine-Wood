/* Presentación compartida de actores: NO modifica colisiones, rutas ni la fuente de visión. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHActorPresentation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const WALK_INTERVAL_SECONDS=0.5;
 function createCycle(seconds=WALK_INTERVAL_SECONDS){
  const interval=Number.isFinite(seconds)&&seconds>0?seconds:WALK_INTERVAL_SECONDS;
  let elapsed=0,wasWalking=false;
  return Object.freeze({
   tick(walking,dt=0){
    if(!walking){elapsed=0;wasWalking=false;return 'idle'}
    if(!wasWalking){wasWalking=true;elapsed=0;return 'walk'}
    elapsed+=Number.isFinite(dt)?Math.max(0,dt):0;
    return Math.floor(elapsed/interval)%2===0?'walk':'idle';
   },
   reset(){elapsed=0;wasWalking=false}
  });
 }
 // canSeePoint lo proporciona drawSight() del motor, nunca otro cálculo de FOW.
 function visibleOtherActor(actorFloor,currentFloor,x,z,canSeePoint){
  return Number.isInteger(actorFloor)&&actorFloor===currentFloor&&
   Number.isFinite(x)&&Number.isFinite(z)&&
   typeof canSeePoint==='function'&&!!canSeePoint(x,z);
 }
 return Object.freeze({createCycle,visibleOtherActor,WALK_INTERVAL_SECONDS});
});
