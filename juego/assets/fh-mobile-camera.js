/* Distancia de cámara exclusiva del gameplay de celular.
 * No cambia FOV, cámaras de PC/tablet ni la vista cenital al dormir.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHMobileCamera=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const PHONE_SCALE=0.70;
 const MAX_PHONE_SHORT_SIDE=600;
 function isPhone(width,height,coarsePointer){
  return coarsePointer===true&&Number.isFinite(width)&&Number.isFinite(height)
   &&width>0&&height>0&&Math.min(width,height)<=MAX_PHONE_SHORT_SIDE;
 }
 function distance(base,width,height,coarsePointer){
  // El motor determina la distancia (incluido el bono de luz), aquí solo se escala.
  if(!Number.isFinite(base)||base<=0)return base;
  return isPhone(width,height,coarsePointer)?base*PHONE_SCALE:base;
 }
 return Object.freeze({PHONE_SCALE,MAX_PHONE_SHORT_SIDE,isPhone,distance});
});
