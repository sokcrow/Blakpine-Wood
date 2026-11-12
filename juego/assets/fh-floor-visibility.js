/* Visibilidad de fachadas entre pisos; el motor conserva el FOW y la oclusión horizontal. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHFloorVisibility=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 // Las fachadas superiores son copias exteriores, no agujeros en la losa.
 // Bajo PB se muestra solo la planta activa; las rejillas iluminan aparte.
 function undergroundMask(playerFloor,mainFloor){
  return Number.isInteger(playerFloor)&&playerFloor>=0&&
   Number.isInteger(mainFloor)&&mainFloor>=0&&playerFloor<mainFloor;
 }
 function facadeCandidate(playerFloor,facadeFloor,inside,inCameraVolume,hasExteriorWindow=false,mainFloor=0){
  if(!Number.isInteger(playerFloor)||playerFloor<0||!Number.isInteger(facadeFloor)||facadeFloor<0||inCameraVolume!==true)return false;
  if(!Number.isInteger(mainFloor)||mainFloor<0||facadeFloor<mainFloor||
   undergroundMask(playerFloor,mainFloor))return false;
  // Las fachadas no son interiores de sótanos. Desde dentro, tanto arriba
  // como abajo requieren una abertura; después se comprueban rayo y losa.
  return inside!==true||facadeFloor===playerFloor||hasExteriorWindow===true;
 }
 return Object.freeze({facadeCandidate,undergroundMask});
});
