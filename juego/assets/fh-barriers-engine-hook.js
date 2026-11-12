/* Adaptador de barreras para el documento 3D embebido.
 * Se inyecta después de arquitectura/PG; no modifica los 13 trozos Base64.
 */
(function(root){
 'use strict';
 const scriptUrl=new URL(document.currentScript?.src||'./juego/assets/fh-barriers-engine-hook.js',document.baseURI);
 function once(source,needle,replacement){
  const matches=source.split(needle).length-1;
  if(matches!==1)throw Error('Hook de barreras incompatible ('+matches+'): '+needle.slice(0,90));
  return source.replace(needle,replacement);
 }
 function patch(source){
  if(typeof source!=='string')throw TypeError('Falta el documento 3D');
  let doc=source;
  // Los fence históricos continúan con sus barras y altura de mapa intactas.
  doc=once(doc,"if(it.type==='fence'){const a=world(it.a)",
   "if(it.type==='fence'&&!window.FHBarriers.isBarrier(it)){const a=world(it.a)");
  doc=once(doc,"  if(it.type==='window')windowModel(f,it);",
   `  // Las variantes modernas usan el mismo contrato de colisión del motor, no sightWalls.
  if(window.FHBarriers.isBarrier(it)){
   const mounted=window.FHBarriers.mount(THREE,stories[f],it,CELL,MAT.fence,
    mesh=>{trackSegmentSight(f,mesh,it.a,it.b);registerCutaway(f,mesh);});
   if(mounted)blockers[f].push({...segment(it.a,it.b),thickness:.08,fhBarrierId:it.id});
  }
  if(it.type==='window')windowModel(f,it);`);
  const traversal=`
let fhBarrierTravel=null,fhBarrierLift=0;
function fhBarrierAttempt(){
 const option=window.FHBarriers.nearest(DATA.floors[currentFloor].items,user.x,user.z,CELL);
 if(!option)return false;
 const index=blockers[currentFloor].findIndex(b=>b.fhBarrierId===option.item.id);
 if(index<0){notice(window.FH_BARRIER_TEXT.unavailable);return true;}
 const removed=blockers[currentFloor].splice(index,1)[0];
 let safe=true;
 try{
  // La misma canWalk valida paredes, otras bardas, muebles y losa superior.
  const steps=Math.max(12,Math.ceil(Math.hypot(option.goal.x-user.x,option.goal.z-user.z)/.065));
  for(let i=1;i<=steps;i++){
   const x=user.x+(option.goal.x-user.x)*i/steps;
   const z=user.z+(option.goal.z-user.z)*i/steps;
   if(!canWalk(x,z)){safe=false;break;}
  }
 }finally{blockers[currentFloor].splice(index,0,removed);}
 if(!safe){notice(window.FH_BARRIER_TEXT.blocked);return true;}
 fhBarrierTravel={fromX:user.x,fromZ:user.z,toX:option.goal.x,toZ:option.goal.z,
  elapsed:0,seconds:option.seconds,lift:option.lift};
 user.vx=0;user.vz=0;user.walking=false;
 notice(option.action==='jump'?window.FH_BARRIER_TEXT.jumping:window.FH_BARRIER_TEXT.climbing,1100);
 return true;
}
function fhBarrierAdvance(dt){
 if(!fhBarrierTravel)return false;
 const travel=fhBarrierTravel;
 travel.elapsed=Math.min(travel.seconds,travel.elapsed+Math.max(0,Math.min(.1,dt)));
 const t=Math.min(1,travel.elapsed/travel.seconds);
 const smooth=t*t*(3-2*t);
 user.x=travel.fromX+(travel.toX-travel.fromX)*smooth;
 user.z=travel.fromZ+(travel.toZ-travel.fromZ)*smooth;
 fhBarrierLift=Math.sin(Math.PI*t)*travel.lift;
 visibilityDirty=true;
 if(t>=1){
  fhBarrierTravel=null;fhBarrierLift=0;
  GameState.player={floorId:DATA.floors[currentFloor].id,x:user.x,z:user.z};
  saveProgress();
 }
 return true;
}
`;
  // Los adaptadores previos añaden bloqueos de entregas y almacenamiento.
  doc=once(doc,"function toggleDoor(){",
   traversal+"\nfunction toggleDoor(){if(fhBarrierTravel)return;");
  doc=once(doc,"if(!d)return nearDisabledElevator()?notice(ELEVATOR_TEXT.disabled):notice('No hay una puerta ni escalera cerca.');",
   "if(!d){if(fhBarrierAttempt())return;return nearDisabledElevator()?notice(ELEVATOR_TEXT.disabled):notice('No hay una puerta ni escalera cerca.');}");
  // Un bloque conserva el if/else de movimiento instalado por otros adaptadores.
  doc=once(doc,"moveUpdate(dt);","{if(!fhBarrierAdvance(dt))moveUpdate(dt);}");
  doc=once(doc,"hero.position.set(user.x,visualBase+travelRise,user.z);",
   "hero.position.set(user.x,visualBase+travelRise+fhBarrierLift,user.z);");
  doc=once(doc," if(!interactableItems[currentFloor].length){const s=nearestStairs(),e=nearElevator();",
   ` // Prioridad: puertas, escaleras, ascensor y muebles mantienen su interacción.
 const nearBarrier=window.FHBarriers.nearest(DATA.floors[currentFloor].items,user.x,user.z,CELL);
 if(nearBarrier&&!d&&!nearElevator()&&!nearestStairs()&&useTarget()?.kind!=='furniture'){
  $('use').textContent=nearBarrier.action==='jump'?window.FH_BARRIER_TEXT.jump:window.FH_BARRIER_TEXT.climb;
  return;
 }
 if(!interactableItems[currentFloor].length){const s=nearestStairs(),e=nearElevator();`);
  const base=new URL('../../',scriptUrl);
  const tags='<script src="'+new URL('juego/assets/fh-barriers.js?v=20261111-metal1',base).href+'"></scr'+'ipt>'+
   '<script src="'+new URL('juego/assets/fh-barriers-strings.js?v=20261111-metal1',base).href+'"></scr'+'ipt>';
  const headEnd=doc.indexOf('</head>');
  if(headEnd<0)throw Error('El motor 3D no tiene encabezado');
  doc=doc.slice(0,headEnd)+tags+doc.slice(headEnd);
  return doc;
 }
 root.FHBarriersEngine=Object.freeze({patch});
})(window);
