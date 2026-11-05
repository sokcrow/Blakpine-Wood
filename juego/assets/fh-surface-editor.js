/* Forest Horror — integración del editor con FHSurfacePlacement. */
(function(global){
 'use strict';
 const S=global.FHSurfacePlacement,R=global.FHFurnitureRules,T=global.FH_CATALOG_TEXT||{};
 if(!S||!R)return;
 const feetPerCell=()=>Number(project.units?.feetPerCell)>0?Number(project.units.feetPerCell):5;
 const surfaces=(item,cell)=>R.supportSurfacesFor(item,cell);
 const items=()=>current().items;
 const normalize=item=>{R.normalizePlacement?.(item);return item;};
 function place(item,notify=true){
  normalize(item);
  if(!item||!S.supportedPlacement(item))return {ok:true,supported:false};
  const result=S.place(item,items().filter(other=>other!==item),feetPerCell(),surfaces);
  if(!result.ok&&notify)toast(T.surfaceRequired||'Este objeto necesita una superficie compatible.');
  return result;
 }
 function syncCurrent(){for(const item of items())normalize(item);return S.syncAll(items(),feetPerCell(),surfaces);}
 function afterRotate(item,previousRotation){
  normalize(item);if(!item)return true;
  if(S.supportedPlacement(item)){
   const result=place(item,false);
   if(!result.ok){
    item.rotation=Number(previousRotation)||0;
    place(item,false);
    toast(T.surfaceRotationInvalid||'No cabe sobre esa superficie con esa orientación.');
    return false;
   }
  }
  S.syncChildren(items(),item.id,feetPerCell(),surfaces);
  return true;
 }
 function prepareDuplicate(item){
  normalize(item);if(!item)return false;
  if(S.supportedPlacement(item)){
   S.detach(item);
   const result=place(item,false);
   if(!result.ok){toast(T.surfaceRequired||'Este objeto necesita una superficie compatible.');return false;}
  }
  return true;
 }
 function beforeRemove(parentId){
  if(!parentId)return 0;
  let count=0;
  for(const child of items()){
   if(child?.support?.parentItemId!==parentId)continue;
   S.syncItem(items(),child,feetPerCell(),surfaces);
   S.detach(child);
   S.syncChildren(items(),child.id,feetPerCell(),surfaces);
   count++;
  }
  return count;
 }
 const oldCreate=createObject;
 createObject=function(type,pos){
  const item=oldCreate(type,pos);
  if(!item)return null;
  const result=place(item,false);
  if(!result.ok){toast(T.surfaceRequired||'Este objeto necesita una superficie compatible.');return null;}
  if(item.placement==='floor_or_surface'&&!result.supported){
   // Se intentó usar la posición exacta para detectar una mesa, pero si
   // termina en el suelo recupera el snap original del editor.
   item.x=normalizeGrid(item.x);
   item.y=normalizeGrid(item.y);
  }
  return item;
 };
 const oldMove=moveItem;
 moveItem=function(item,delta,original){
  const fine=!!item&&S.supportedPlacement(item)&&(item.placement==='surface'||!!item.support);
  oldMove(item,delta,original);
  normalize(item);if(!item)return;
  if(fine){
   // Sin snap por casilla para props pequeños sobre superficies.
   item.x=Number((Number(original.x)+Number(delta.x)).toFixed(6));
   item.y=Number((Number(original.y)+Number(delta.y)).toFixed(6));
  }
  if(S.supportedPlacement(item)){
   const result=place(item,false);
   if(!result.ok){Object.assign(item,clone(original));return;}
   if(fine&&item.placement==='floor_or_surface'&&!result.supported){
    oldMove(item,delta,original);place(item,false);
   }
  }
  S.syncChildren(items(),item.id,feetPerCell(),surfaces);
 };
 const oldChangeFloor=changeFloor;
 changeFloor=function(index){oldChangeFloor(index);syncCurrent();};
 syncCurrent();
 global.FHSurfaceEditor=Object.freeze({place,syncCurrent,afterRotate,prepareDuplicate,beforeRemove});
})(window);
