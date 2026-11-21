/* Definiciones de catálogo para futuros modelos y fuentes del motor común. */
(function(root){
 'use strict';
 const text=root.FH_LIGHT_TEXT;
 const compatibility=Object.freeze({settings:Object.freeze(['medieval-fantasy']),technology:'preindustrial'});
 const magic=Object.freeze({settings:compatibility.settings,technology:'magic'});
 const defaults=Object.freeze({
  lightOn:false,fuel:null,durationSeconds:null,beamAngleDeg:360,
  lightRadiusFt:5,lightDimFalloffFt:0
 });

 function source(id,category,lightRadiusFt,lightDimFalloffFt,fuelKind=null,availability=compatibility){
  return Object.freeze({
   id,category,label:text.medievalSources[id],compatibility:availability,glb:null,
   defaults:Object.freeze({
    ...defaults,lightRadiusFt,lightDimFalloffFt,
    fuel:fuelKind?Object.freeze({kind:fuelKind,remaining:null}):defaults.fuel
   })
  });
 }

 const sources=Object.freeze([
  source('torch','torches',20,20,'torch'),
  source('candle','candles',5,5,'wax'),
  source('oil_lantern','oilLanterns',15,15,'oil'),
  source('brazier','braziers',20,20,'charcoal'),
  source('campfire','campfires',20,20,'wood'),
  source('fireplace','fireplaces',15,15,'wood'),
  source('magic_stone','magicLights',10,10,null,magic),
  source('magic_crystal','magicLights',10,10,null,magic)
 ]);

 root.FHMedievalLightCatalog=Object.freeze({categories:text.medievalCategories,sources});
})(globalThis);
