/* Electricidad 01 - datos del kit. Sin dependencias y sin nueva simulación. */
(function(root){'use strict';const catalog={"schema":"forest-horror-utilities-catalog-v1","kit":"electricidad-01-redisenado","models":[{"id":"breaker_pequeno","name":"Breaker compacto · 2 circuitos","type":"breaker_panel","category":"Electricidad","mount":"wall","widthFt":1.0,"heightFt":1.5,"depthFt":0.5,"mountHeightFt":5.25,"glb":"modelos_glb/breaker_pequeno.glb","thumbnail":"miniaturas/breaker_pequeno.png","triangles":72,"front":"+Z","backPlaneMeters":0,"wallGapMeters":0.012,"behaviour":"breaker","defaults":{"breakerType":"small","rangeFt":30,"capacityWatts":1200},"blocksMovement":false},{"id":"breaker_grande","name":"Tablero eléctrico · 8 circuitos","type":"breaker_panel","category":"Electricidad","mount":"wall","widthFt":1.5,"heightFt":2.25,"depthFt":0.5,"mountHeightFt":5.5,"glb":"modelos_glb/breaker_grande.glb","thumbnail":"miniaturas/breaker_grande.png","triangles":168,"front":"+Z","backPlaneMeters":0,"wallGapMeters":0.012,"behaviour":"breaker","defaults":{"breakerType":"large","rangeFt":120,"capacityWatts":4800},"blocksMovement":false},{"id":"enchufe_doble","name":"Tomacorriente doble · 120 V","type":"power_outlet","category":"Electricidad","mount":"wall","widthFt":0.75,"heightFt":0.75,"depthFt":0.25,"mountHeightFt":1.5,"glb":"modelos_glb/enchufe_doble.glb","thumbnail":"miniaturas/enchufe_doble.png","triangles":48,"front":"+Z","backPlaneMeters":0,"wallGapMeters":0.012,"behaviour":"outlet","defaults":{"slots":2,"capacityRayos":6,"radiusFt":5},"blocksMovement":false},{"id":"interruptor_pared","name":"Interruptor de pared · balancín","type":"light_switch","category":"Electricidad","mount":"wall","widthFt":0.75,"heightFt":0.75,"depthFt":0.25,"mountHeightFt":4.25,"glb":"modelos_glb/interruptor_pared.glb","thumbnail":"miniaturas/interruptor_pared.png","triangles":36,"front":"+Z","backPlaneMeters":0,"wallGapMeters":0.012,"behaviour":"switch","defaults":{},"blocksMovement":false},{"id":"caja_conexiones","name":"Caja de conexiones galvanizada","type":"misc","category":"Electricidad","mount":"wall","widthFt":1.0,"heightFt":1.0,"depthFt":0.5,"mountHeightFt":7.0,"glb":"modelos_glb/caja_conexiones.glb","thumbnail":"miniaturas/caja_conexiones.png","triangles":48,"front":"+Z","backPlaneMeters":0,"wallGapMeters":0.012,"behaviour":"decorative","defaults":{},"blocksMovement":false},{"id":"salida_techo_electrica","name":"Salida eléctrica de techo","type":"light_fixture","category":"Electricidad","mount":"ceiling","widthFt":1.0,"heightFt":0.5,"depthFt":1.0,"mountHeightFt":0,"glb":"modelos_glb/salida_techo_electrica.glb","thumbnail":"miniaturas/salida_techo_electrica.png","triangles":96,"front":"-Y","backPlaneMeters":0,"wallGapMeters":0,"behaviour":"lighting","defaults":{},"blocksMovement":false},{"id":"medidor_electrico","name":"Medidor eléctrico de consumo","type":"misc","category":"Electricidad","mount":"wall","widthFt":1.25,"heightFt":2.0,"depthFt":0.5,"mountHeightFt":5.5,"glb":"modelos_glb/medidor_electrico.glb","thumbnail":"miniaturas/medidor_electrico.png","triangles":76,"front":"+Z","backPlaneMeters":0,"wallGapMeters":0.012,"behaviour":"meter","defaults":{},"blocksMovement":false},{"id":"conduit_pared","name":"Conduit industrial en L","type":"misc","category":"Electricidad","mount":"wall","widthFt":2.0,"heightFt":1.0,"depthFt":0.25,"mountHeightFt":7.25,"glb":"modelos_glb/conduit_pared.glb","thumbnail":"miniaturas/conduit_pared.png","triangles":60,"front":"+Z","backPlaneMeters":0,"wallGapMeters":0.012,"behaviour":"decorative","defaults":{},"blocksMovement":false}]};
 const DEFAULT=Object.freeze({power_outlet:'enchufe_doble',light_switch:'interruptor_pared',breaker_panel:'breaker_pequeno'});
 const byId=id=>catalog.models.find(model=>model.id===id)||null;
 function modelFor(item){
  if(!item)return null;
  if(item.type==='breaker_panel')return byId(item.breakerType==='medium'||item.breakerType==='large'?'breaker_grande':'breaker_pequeno');
  const explicit=byId(item.utilitySkin)||byId(item.modelId);
  if(explicit&&[explicit.type,'misc','furniture'].includes(item.type))return explicit;
  return byId(DEFAULT[item.type]);
 }
 function normalizeItem(item,feetPerCell=5){
  const meta=modelFor(item);if(!meta)return false;
  const originalType=item.type,before=JSON.stringify(item),cell=Math.max(.1,Number(feetPerCell)||5);
  item.type=meta.type;item.utilitySkin=meta.id;
  if(originalType!==meta.type&&meta.type!=='misc')item.interact={id:'utility_'+item.id,verb:'use',label:meta.name,effects:[]};
  // Estos modelos los carga el adaptador eléctrico, nunca el de muebles.
  if(byId(item.modelId))delete item.modelId;
  if(!item.label)item.label=meta.name;
  item.placement=meta.mount;item.blocksMovement=false;
  item.w=meta.widthFt/cell;item.h=meta.depthFt/cell;item.heightFt=meta.heightFt;
  if(item.utilityMountHeightFt==null)item.utilityMountHeightFt=meta.mount==='ceiling'?0:meta.mountHeightFt;
  if(meta.type!=='breaker_panel'||originalType!==meta.type)
   for(const [key,value] of Object.entries(meta.defaults||{}))if(item[key]===undefined)item[key]=value;
  return before!==JSON.stringify(item);
 }
 function upgradeMap(map){
  let count=0;
  for(const floor of map?.floors||[]){
   const strips=new Map((floor.items||[]).filter(item=>item.type==='power_strip').map(item=>[item.id,item]));
   if(strips.size){
    floor.items=floor.items.filter(item=>!strips.has(item.id));count+=strips.size;
    for(const item of floor.items){
     const removed=strips.get(item.outletId);if(!removed)continue;
     // Una referencia antigua puede conservar su enchufe de pared real.
     // Sin un padre válido, volver a la detección automática por alcance.
     if(floor.items.some(source=>source.type==='power_outlet'&&source.id===removed.outletId))item.outletId=removed.outletId;
     else delete item.outletId;
     count++;
    }
   }
   for(const item of floor.items||[])if(normalizeItem(item,map.units?.feetPerCell))count++;
  }
  return count;
 }
 root.FHElectricCatalog=Object.freeze({...catalog,DEFAULT,byId,modelFor,normalizeItem,upgradeMap});
})(typeof window!=='undefined'?window:globalThis);

