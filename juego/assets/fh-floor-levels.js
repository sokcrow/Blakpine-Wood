/* Orden vertical de edificios. Sin DOM ni Three.js; conserva IDs y datos del mapa v1. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHFloorLevels=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const STEP_FT=12;
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const valid=map=>Array.isArray(map?.floors)&&map.floors.length>0&&map.floors.every(f=>f&&typeof f.id==='string'&&finite(f.elevationFt));
 const ordered=map=>valid(map)&&map.floors.every((f,i)=>i===0||f.elevationFt>map.floors[i-1].elevationFt);
 const fail=reason=>({ok:false,reason});
 function mainId(map){
  if(!valid(map))return '';
  if(map.mainFloorId&&map.floors.some(f=>f.id===map.mainFloorId))return map.mainFloorId;
  return map.floors.find(f=>f.elevationFt===0)?.id||map.floors[0].id;
 }
 function mainIndex(map){return map?.floors?.findIndex(f=>f.id===mainId(map))??-1}
 function code(map,index){
  if(!valid(map)||!map.floors[index])return '';
  const offset=index-mainIndex(map);
  return offset===0?'PB':offset<0?'B'+(-offset):'P'+offset;
 }
 function rebase(map){
  const pivot=map.floors.find(f=>f.id===map.mainFloorId)?.elevationFt||0;
  for(const f of map.floors)f.elevationFt=Math.round((f.elevationFt-pivot)*1000)/1000;
 }
 function setMain(map,id){
  if(!ordered(map))return fail('Las elevaciones deben estar ordenadas y no repetirse.');
  if(!map.floors.some(f=>f.id===id))return fail('El piso seleccionado no existe.');
  map.mainFloorId=id;rebase(map);return {ok:true,index:map.floors.findIndex(f=>f.id===id)};
 }
 function connected(lower,upper){
  return !!(lower&&upper&&(
   (lower.items||[]).some(it=>it.type==='stairs'&&!it.autoLanding&&(!it.targetFloorId||it.targetFloorId===upper.id))||
   (upper.items||[]).some(it=>it.type==='stairs'&&it.autoLanding&&it.targetFloorId===lower.id)
  ));
 }
 function insert(map,selectedId,direction,floor){
  if(!ordered(map))return fail('Ordena primero las elevaciones existentes.');
  if(!['above','below'].includes(direction))return fail('Dirección inválida.');
  const at=map.floors.findIndex(f=>f.id===selectedId);
  if(at<0)return fail('El piso seleccionado no existe.');
  if(!floor||typeof floor.id!=='string'||!floor.id||map.floors.some(f=>f.id===floor.id))return fail('El nuevo ID debe ser único.');
  const pos=at+(direction==='above'?1:0);
  const lower=map.floors[pos-1],upper=map.floors[pos];
  if(connected(lower,upper))return fail('Hay escaleras conectadas entre esos pisos. No se puede intercalar un nivel sin rediseñarlas.');
  map.mainFloorId=mainId(map);
  const elevation=lower?lower.elevationFt+STEP_FT:upper.elevationFt-STEP_FT;
  if(lower&&upper)for(let i=pos;i<map.floors.length;i++)map.floors[i].elevationFt+=STEP_FT;
  floor.elevationFt=elevation;
  map.floors.splice(pos,0,floor);
  rebase(map);
  return {ok:true,index:pos,id:floor.id};
 }
 function reorder(map,selectedId,direction){
  if(!ordered(map))return fail('Las elevaciones existentes no están ordenadas.');
  if(!['up','down'].includes(direction))return fail('Dirección inválida.');
  const from=map.floors.findIndex(f=>f.id===selectedId);
  const to=from+(direction==='up'?1:-1);
  if(from<0||to<0||to>=map.floors.length)return fail('No hay otro piso en esa dirección.');
  const a=map.floors[from],b=map.floors[to];
  if(map.floors.some(f=>(f.items||[]).some(it=>it.type==='stairs'&&(
   f.id===a.id||f.id===b.id||it.targetFloorId===a.id||it.targetFloorId===b.id
  ))))return fail('Las escaleras enlazadas impiden mover ese piso. Ajusta primero sus conexiones.');
  const heights=map.floors.map(f=>f.elevationFt);
  map.mainFloorId=mainId(map);
  [map.floors[from],map.floors[to]]=[b,a];
  map.floors.forEach((f,i)=>{f.elevationFt=heights[i]});
  rebase(map);
  return {ok:true,index:to};
 }
 return Object.freeze({STEP_FT,ordered,mainId,mainIndex,code,setMain,insert,reorder});
});
