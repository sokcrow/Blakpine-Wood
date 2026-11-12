/* Blakpine-Wood · Agua 03: tinaco y cisterna (pack original).
 * Los datos geométricos provienen de catalogo_almacenamiento_agua.json.
 * Los tipos FHServices existentes son la fuente de verdad funcional.
 */
(function(root){
 'use strict';
 const models=Object.freeze([
  Object.freeze({
   id:'cisterna_principal',type:'water_cistern',name:'Cisterna principal',
   category:'Almacenamiento de agua',mount:'floor',placement:'floor',
   widthFt:8,heightFt:4.5,depthFt:5,mountHeightFt:0,
   waterRole:'main_reservoir',blocksMovement:true,
   // GLB original publicado en la biblioteca del proyecto.
   glbAvailable:true,
   glb:'almacenamiento/modelos_glb/cisterna_principal.glb',
   thumbnail:'almacenamiento/miniaturas/cisterna_principal.png'
  }),
  Object.freeze({
   id:'tinaco_elevado',type:'water_tinaco',name:'Tinaco elevado',
   category:'Almacenamiento de agua',mount:'floor',placement:'floor',
   widthFt:4,heightFt:6,depthFt:4,mountHeightFt:0,
   waterRole:'elevated_reservoir',blocksMovement:true,
   glbAvailable:true,
   glb:'almacenamiento/modelos_glb/tinaco_elevado.glb',
   thumbnail:'almacenamiento/miniaturas/tinaco_elevado.png'
  })
 ]);
 const byId=new Map(models.map(m=>[m.id,m]));
 const byType=new Map(models.map(m=>[m.type,m]));
 const api=Object.freeze({models,byId:id=>byId.get(id)||null,
  byType:type=>byType.get(type)||null});
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHWaterStorageCatalog=api;
})(typeof window!=='undefined'?window:globalThis);
