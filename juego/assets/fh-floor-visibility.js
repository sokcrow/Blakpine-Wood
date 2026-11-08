/* Visibilidad de fachadas entre pisos; el motor conserva el FOW y la oclusión horizontal. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHFloorVisibility=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 function facadeCandidate(playerFloor,facadeFloor,inside,inCameraVolume){
  if(!Number.isInteger(playerFloor)||playerFloor<0||!Number.isInteger(facadeFloor)||facadeFloor<0||inCameraVolume!==true)return false;
  // Desde dentro, los pisos superiores no atraviesan el techo. Desde fuera,
  // el FOW y la proyección de cámara siguen decidiendo qué fachada se ve.
  return inside!==true||facadeFloor<=playerFloor;
 }
 return Object.freeze({facadeCandidate});
});
