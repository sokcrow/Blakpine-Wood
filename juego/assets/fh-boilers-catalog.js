/* Agua 02 · Catálogo técnico de calderas. Datos de Forest_Horror_Agua_02_Calderas.zip.
 * Los GLB no quedan disponibles hasta que se incorporen al repositorio.
 */
(function(root){'use strict';
 const models=[
  {id:'calentador_domestico_vertical',name:'Calentador doméstico vertical',kind:'heater',placement:'floor',widthFt:2,heightFt:5,depthFt:2,capacityLiters:80},
  {id:'calentador_domestico_horizontal',name:'Calentador doméstico horizontal',kind:'heater',placement:'floor',widthFt:3.5,heightFt:2.5,depthFt:2.25,capacityLiters:110},
  {id:'caldera_residencial_mediana',name:'Caldera residencial mediana',kind:'heater',placement:'floor',widthFt:3.25,heightFt:5,depthFt:2.75,capacityLiters:280},
  {id:'caldera_industrial_grande',name:'Caldera industrial grande',kind:'heater',placement:'floor',widthFt:5.5,heightFt:7.5,depthFt:4.5,capacityLiters:600},
  {id:'tanque_expansion',name:'Tanque de expansión',kind:'auxiliary',placement:'floor',widthFt:1.75,heightFt:3,depthFt:1.75},
  {id:'bomba_recirculacion',name:'Bomba de recirculación',kind:'auxiliary',placement:'floor',widthFt:2.5,heightFt:1.75,depthFt:1.5},
  {id:'colector_tuberias',name:'Colector de tuberías',kind:'auxiliary',placement:'wall',widthFt:4,heightFt:3,depthFt:.75,mountHeightFt:3},
  {id:'panel_control_caldera',name:'Panel de control de caldera',kind:'auxiliary',placement:'wall',widthFt:1.75,heightFt:2.25,depthFt:.75,mountHeightFt:4}
 ];
 const ids=new Map(models.map(m=>[m.id,m]));
 root.FHBoilersCatalog=Object.freeze({models:Object.freeze(models),byId:id=>ids.get(id)||null,has:id=>ids.has(id),assetsReady:false});
})(typeof window!=='undefined'?window:globalThis);
