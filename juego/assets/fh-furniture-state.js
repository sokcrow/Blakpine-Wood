/* Puente de datos entre mobiliario del mapa, partida y editor. Sin geometría propia. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHFurnitureState=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const copy=value=>JSON.parse(JSON.stringify(value));
 const fixed=new Set(['spawn','npc_portal','stairs','elevator','light_fixture','light_switch','breaker_panel','battery_pickup','parking_decal','water_main','water_valve','water_outlet','drain_main','drain_outlet','power_outlet','power_strip','phone_charger','router','ethernet_port','landline_phone','room','hall','outside','building','pavement','parking','grass','dirt','asphalt','alley','sidewalk','concrete','gravel','cobblestone','tile_floor','carpet','wood_floor']);
 function editable(item){
  // Incluye modelos Legacy y decoratable:false: esa restricción es del jugador, no del creador.
  return !!item&&typeof item.id==='string'&&!!item.id&&!item.runtimePackage&&!fixed.has(item.type)&&!item.a&&!item.b&&Number.isFinite(item.x)&&Number.isFinite(item.y);
 }
 function capture(map){
  return (map.floors||[]).map(floor=>({id:floor.id,items:(floor.items||[]).filter(editable).map(copy)}));
 }
 function pose(item,record){
  for(const key of ['x','y','rotation'])if(Number.isFinite(record?.[key]))item[key]=record[key];
  for(const key of ['support','wallId']){if(record?.[key])item[key]=copy(record[key]);else delete item[key];}
  return item;
 }
 function hydrate(map,state,products=[],applyModel=()=>{}){
  if(!state||typeof state!=='object')return 0;
  const records=state.delivery?.furnishings||[],snapshots=state.decoration?.editorItems||[];
  let changed=0;
  for(const [f,floor]of map.floors.entries()){
   const snapshot=snapshots.find(entry=>entry.id===floor.id)?.items||[];
   const byId=new Map(snapshot.filter(editable).map(item=>[item.id,copy(item)]));
   for(const saved of snapshot){
    if(!editable(saved)||records.some(record=>record.id===saved.id)||floor.items.some(item=>item.id===saved.id))continue;
    const item=copy(saved);
    item.editorRuntimeSource={kind:'snapshot',characterId:state.characterId||''};
    floor.items.push(item);changed++;
   }
   for(const item of floor.items||[])if(editable(item)&&!item.editorRuntimeSource){
    const savedPose=state.decoration?.poses?.[f+':'+item.id];
    if(savedPose){const before=JSON.stringify(item);pose(item,savedPose);if(before!==JSON.stringify(item))changed++;}
   }
   for(const record of records){
    if(record.stored||(Number.isInteger(record.floor)?record.floor:0)!==f)continue;
    const order=state.delivery?.orders?.find(order=>order.id===record.orderId);
    const product=products.find(product=>product.id===(record.productId||order?.productId));
    let item=byId.get(record.id)||copy(floor.items.find(item=>item.id===record.id)||null);
    if(!item&&product){
     item={id:record.id,type:'misc',x:record.x,y:record.y,rotation:record.rotation||0,runtimeDecoratable:true,runtimeDeliveryFurniture:{orderId:record.orderId,productId:record.productId||order?.productId}};
     applyModel(item,product);
    }
    // Aunque el catálogo antiguo ya no exista, conservar un objeto seleccionable y borrable.
    if(!item)item={id:record.id,type:'misc',label:order?.name||record.productId||record.id,w:1,h:1,heightFt:2,blocksMovement:true,runtimeDecoratable:true,runtimeDeliveryFurniture:{orderId:record.orderId,productId:record.productId||order?.productId}};
    pose(item,record);
    item.editorRuntimeSource={characterId:state.characterId||'',record:copy(record)};
    const index=floor.items.findIndex(value=>value.id===item.id);
    if(index<0){floor.items.push(item);changed++;}
    else if(JSON.stringify(floor.items[index])!==JSON.stringify(item)){floor.items[index]=item;changed++;}
   }
  }
  return changed;
 }
 function syncEdits(before,map,state){
  if(!state||typeof state!=='object')return false;
  let changed=false;
  for(const [f,floor]of map.floors.entries()){
   const old=before.floors?.find(value=>value.id===floor.id)?.items||[];
   const ids=new Set([...old,...floor.items].filter(editable).map(item=>item.id));
   for(const id of ids){
    const previous=old.find(item=>item.id===id),item=floor.items.find(item=>item.id===id);
    if(JSON.stringify(previous)===JSON.stringify(item))continue;
    const source=item?.editorRuntimeSource||previous?.editorRuntimeSource;
    if(source&&source.characterId!==(state.characterId||''))continue;
    changed=true;
    // Una pose vieja no debe deshacer una corrección del creador.
    if(state.decoration?.poses)delete state.decoration.poses[f+':'+id];
    if(state.decoration?.editorItems){
     for(const entry of state.decoration.editorItems)entry.items=entry.items.filter(value=>value.id!==id||entry.id!==floor.id);
    }
    if(source?.kind==='snapshot'){
     if(item){
      state.decoration??={};state.decoration.editorItems??=[];
      let entry=state.decoration.editorItems.find(entry=>entry.id===floor.id);
      if(!entry){entry={id:floor.id,items:[]};state.decoration.editorItems.push(entry);}
      entry.items.push(copy(item));
     }
    }else if(source){
     state.delivery??={};state.delivery.furnishings??=[];
     const records=state.delivery.furnishings,index=records.findIndex(value=>value.id===id);
     if(!item){if(index>=0)records.splice(index,1);}
     else{
      const record={...(index>=0?records[index]:copy(source.record)),id,floor:f,stored:false};
      pose(record,item);
      if(index>=0)records[index]=record;else records.push(record);
     }
    }
   }
  }
  return changed;
 }
 function runtimeItems(items,state){
  return items.flatMap(item=>{
   const source=item.editorRuntimeSource;
   if(!source)return [copy(item)];
   if(!state||source.characterId!==(state.characterId||''))return [];
   if(source.kind==='snapshot')return [copy(item)];
   const record=state.delivery?.furnishings?.find(value=>value.id===item.id);
   if(!record||record.stored)return [];
   return [pose(copy(item),record)];
  });
 }
 return {editable,capture,hydrate,syncEdits,runtimeItems};
});
