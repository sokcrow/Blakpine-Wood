/* Agua 02 · Contrato de los ocho GLB originales del ZIP suministrado.
 * Unidades: pies. El archivo .glb contiene malla, material y textura pixelada.
 */
(function(root){'use strict';
 const src=[
  ['calentador_domestico_vertical','Calentador doméstico vertical','heater','floor',2,5,2,0,80],
  ['calentador_domestico_horizontal','Calentador doméstico horizontal','heater','floor',3.5,2.5,2.25,0,110],
  ['caldera_residencial_mediana','Caldera residencial mediana','heater','floor',3.25,5,2.75,0,280],
  ['caldera_industrial_grande','Caldera industrial grande','heater','floor',5.5,7.5,4.5,0,600],
  ['tanque_expansion','Tanque de expansión','auxiliary','floor',1.75,3,1.75,0,0],
  ['bomba_recirculacion','Bomba de recirculación','auxiliary','floor',2.5,1.75,1.5,0,0],
  ['colector_tuberias','Colector de tuberías','auxiliary','wall',4,3,.75,3,0],
  ['panel_control_caldera','Panel de control de caldera','auxiliary','wall',1.75,2.25,.75,4,0]
 ];
 const models=Object.freeze(src.map(([id,name,kind,mount,widthFt,heightFt,depthFt,mountHeightFt,capacityLiters])=>
  Object.freeze({id,name,kind,type:kind==='heater'?'water_boiler':'water_boiler_aux',
   placement:mount,mount,widthFt,heightFt,depthFt,mountHeightFt,
   blocksMovement:mount==='floor',capacityLiters,
   glb:'calderas/modelos_glb/'+id+'.glb',
   thumbnail:'calderas/miniaturas/'+id+'.png',front:'+Z',metersPerFoot:.3048})));
 const byId=new Map(models.map(m=>[m.id,m]));
 const api=Object.freeze({models,byId:id=>byId.get(id)||null,has:id=>byId.has(id),
  assetsReady:true});
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHBoilersCatalog=api;
})(typeof window!=='undefined'?window:globalThis);
