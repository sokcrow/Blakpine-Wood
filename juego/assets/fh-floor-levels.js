/* Niveles físicos: alturas persistidas; PB sólo define la referencia del suelo. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHFloorLevels=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const STEP_FT=10;
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const valid=map=>Array.isArray(map?.floors)&&map.floors.length>0&&map.floors.every(f=>f&&typeof f.id==='string'&&finite(f.elevationFt));
 const ordered=map=>valid(map)&&map.floors.every((f,i)=>i===0||f.elevationFt>map.floors[i-1].elevationFt);
 const fail=reason=>({ok:false,reason});
 const sorted=floors=>[...floors].sort((a,b)=>a.elevationFt-b.elevationFt);
 const distinct=floors=>new Set(floors.map(f=>f.elevationFt)).size===floors.length;
 function mainId(map){
  if(!valid(map))return '';
  if(map.mainFloorId&&map.floors.some(f=>f.id===map.mainFloorId))return map.mainFloorId;
  return map.floors.find(f=>f.elevationFt===0)?.id||map.floors[0].id;
 }
 function mainIndex(map){return map?.floors?.findIndex(f=>f.id===mainId(map))??-1}
 function code(map,index){
  if(!valid(map)||!map.floors[index])return '';
  const elevation=map.floors[index].elevationFt;
  const offset=map.floors.filter(f=>f.elevationFt<elevation).length-
   map.floors.filter(f=>f.elevationFt<map.floors.find(f=>f.id===mainId(map)).elevationFt).length;
  return offset===0?'PB':offset<0?'B'+(-offset):'P'+offset;
 }
 // Conexiones automáticas: una escalera en el inferior debe conservar su destino superior.
 // No reordenar plantas pasando por escaleras: cambiaría sus destinos sin consentimiento.
 function linksIntact(before,after){
  const oldIndex=new Map(before.map((f,i)=>[f.id,i]));
  const newIndex=new Map(after.map((f,i)=>[f.id,i]));
  for(const floor of before)for(const it of floor.items||[]){
   if(it.type!=='stairs')continue;
   const oldPos=oldIndex.get(floor.id),newPos=newIndex.get(floor.id);
   if(it.autoLanding){
    if(it.targetFloorId&&after[newPos-1]?.id!==it.targetFloorId)return false;
   }else{
    const destination=it.targetFloorId||before[oldPos+1]?.id;
    if(destination&&after[newPos+1]?.id!==destination)return false;
   }
  }
  return true;
 }
 function setMain(map,id){
  if(!valid(map))return fail('No se pueden leer las elevaciones del mapa.');
  const index=map.floors.findIndex(f=>f.id===id);
  if(index<0)return fail('El piso seleccionado no existe.');
  map.mainFloorId=id;
  return {ok:true,index};
 }
 function insert(map,selectedId,direction,floor){
  if(!valid(map)||!distinct(map.floors))return fail('Hay elevaciones duplicadas o inválidas. Corrígelas antes de crear otro piso.');
  if(!['above','below'].includes(direction))return fail('Dirección inválida.');
  if(!floor||typeof floor.id!=='string'||!floor.id||map.floors.some(f=>f.id===floor.id))return fail('El nuevo ID debe ser único.');
  const main=mainId(map),original=map.floors,levels=sorted(original);
  const at=levels.findIndex(f=>f.id===selectedId);
  if(at<0)return fail('El piso seleccionado no existe.');
  const pos=at+(direction==='above'?1:0);
  const lower=levels[pos-1],upper=levels[pos];
  const elevation=lower?lower.elevationFt+STEP_FT:upper.elevationFt-STEP_FT;
  if(upper&&elevation>=upper.elevationFt)
   return fail('No caben 10 pies entre esos niveles. Cambia su elevación manualmente o crea el piso desde otro nivel.');
  const proposed={...floor,elevationFt:Math.round(elevation*1000)/1000};
  const candidate=[...levels.slice(0,pos),proposed,...levels.slice(pos)];
  if(!linksIntact(original,candidate))
   return fail('Hay escaleras conectadas en ese tramo. Ajusta sus conexiones antes de intercalar pisos.');
  floor.elevationFt=proposed.elevationFt;
  candidate[pos]=floor;
  map.floors=candidate;
  map.mainFloorId=main;
  return {ok:true,index:pos,id:floor.id};
 }
 function reorder(map,selectedId,direction){
  if(!valid(map)||!distinct(map.floors))return fail('Hay elevaciones duplicadas o inválidas. Corrígelas antes de mover pisos.');
  if(!['up','down'].includes(direction))return fail('Dirección inválida.');
  const main=mainId(map),original=map.floors,levels=sorted(original);
  const from=levels.findIndex(f=>f.id===selectedId),to=from+(direction==='up'?1:-1);
  if(from<0||to<0||to>=levels.length)return fail('No hay otro piso en esa dirección.');
  const a=levels[from],b=levels[to],candidate=levels.slice();
  const originalA=a.elevationFt,originalB=b.elevationFt;
  // Mover intercambia las dos alturas elegidas; los otros pisos nunca se desplazan.
  candidate[from]={...b,elevationFt:originalA};
  candidate[to]={...a,elevationFt:originalB};
  if(!linksIntact(original,candidate))
   return fail('Las escaleras vinculadas impiden intercambiar esas elevaciones. Ajusta primero sus conexiones.');
  b.elevationFt=originalA;
  a.elevationFt=originalB;
  map.floors=sorted(levels);
  map.mainFloorId=main;
  return {ok:true,index:map.floors.findIndex(f=>f.id===selectedId)};
 }
 function setElevation(map,id,elevationFt){
  if(!valid(map)||!finite(elevationFt))return fail('Introduce una elevación numérica válida.');
  const source=map.floors.find(f=>f.id===id);
  if(!source)return fail('El piso seleccionado no existe.');
  if(map.floors.some(f=>f.id!==id&&f.elevationFt===elevationFt))
   return fail('Ya existe un piso con esa elevación. Usa otra altura.');
  const before=map.floors,after=sorted(before.map(f=>f.id===id?{...f,elevationFt}:f));
  if(!linksIntact(before,after))
   return fail('Esa elevación cambia la conexión de escaleras. Ajusta sus conexiones primero.');
  const main=mainId(map);
  source.elevationFt=elevationFt;
  map.floors=sorted(before);
  map.mainFloorId=main;
  return {ok:true,index:map.floors.findIndex(f=>f.id===id)};
 }
 return Object.freeze({STEP_FT,ordered,mainId,mainIndex,code,setMain,insert,reorder,setElevation});
});