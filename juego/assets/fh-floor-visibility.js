/* Visibilidad de fachadas entre pisos; el motor conserva el FOW y la oclusión horizontal. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHFloorVisibility=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 function facadeCandidate(playerFloor,facadeFloor,inside,inCameraVolume,hasExteriorWindow=false){
  if(!Number.isInteger(playerFloor)||playerFloor<0||!Number.isInteger(facadeFloor)||facadeFloor<0||inCameraVolume!==true)return false;
  // Desde dentro, un piso superior requiere una ventana exterior del piso actual.
  // La visión 3D y la losa se comprueban después con los rayos compartidos.
  return inside!==true||facadeFloor<=playerFloor||hasExteriorWindow===true;
 }
 return Object.freeze({facadeCandidate});
});
