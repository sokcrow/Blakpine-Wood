/* Forest Horror — lámparas del mapa y alcance luminoso.
 * Un solo modelo de datos para el editor y el motor. La geometría/colisiones
 * y la oclusión siguen siendo propiedad del motor existente.
 */
(function(global){
'use strict';
const PRESETS=Object.freeze({
 bulb:Object.freeze({label:'Foco de techo',radiusFt:16,beamAngleDeg:360,w:.4,h:.4,mount:'ceiling'}),
 strip:Object.freeze({label:'Tubo fluorescente largo',radiusFt:27,beamAngleDeg:360,w:1.25,h:.28,mount:'ceiling'}),
 panel:Object.freeze({label:'Panel de techo',radiusFt:22,beamAngleDeg:360,w:.8,h:.8,mount:'ceiling'}),
 wall_sconce:Object.freeze({label:'Aplique de pared',radiusFt:15,beamAngleDeg:160,w:.35,h:.25,mount:'wall'}),
 wall_flood:Object.freeze({label:'Reflector de pared',radiusFt:29,beamAngleDeg:110,w:.45,h:.3,mount:'wall'})
});
const TOOL_PRESET=Object.freeze({light_fixture:'bulb',light_strip:'strip',light_panel:'panel',light_wall:'wall_sconce',light_flood:'wall_flood'});
// Punto de integración para linternas/luces de jugadores remotos (el transporte de red vendrá después).
const DYNAMIC_SOURCES=new Map();
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const finite=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
const presetFor=kind=>PRESETS[Object.prototype.hasOwnProperty.call(PRESETS,kind)?kind:'bulb'];
const kindForTool=tool=>Object.prototype.hasOwnProperty.call(TOOL_PRESET,tool)?TOOL_PRESET[tool]:null;
const isWall=kind=>presetFor(kind).mount==='wall';
function presetFields(kind){
 const p=presetFor(kind);return {lightKind:Object.prototype.hasOwnProperty.call(PRESETS,kind)?kind:'bulb',
   lightRadiusFt:p.radiusFt,beamAngleDeg:p.beamAngleDeg,w:p.w,h:p.h,heightFt:p.mount==='wall'?6.5:8.4,
   blocksMovement:false,label:p.label};
}
// Compatibilidad con llamadas antiguas: generación automática desactivada.
// Ni crea elementos ni modifica lightingManual en mapas existentes.
function recommended(){return []}
function materialize(){return 0}
function resolve(floorIndex,floor,rooms,roomAtGrid,cell){
 const result=[],items=floor.items||[],authored=items.filter(i=>i.type==='light_fixture');
 const byId=new Map(rooms.map(r=>[r.roomId||r.id,r]));
 function emit(lamp,room){
  const preset=presetFor(lamp.lightKind),kind=preset.mount==='wall'?presetFor(lamp.lightKind)===PRESETS.wall_flood?'wall_flood':'wall_sconce':Object.prototype.hasOwnProperty.call(PRESETS,lamp.lightKind)?lamp.lightKind:'bulb';
  const radiusFt=clamp(finite(lamp.lightRadiusFt,preset.radiusFt),5,80);
  const beamAngleDeg=clamp(finite(lamp.beamAngleDeg,preset.beamAngleDeg),20,360);
  let x=Number(lamp.x)*cell,z=Number(lamp.y)*cell;
  if(!Number.isFinite(x)||!Number.isFinite(z))return;
  const rotation=finite(lamp.rotation,0);
  // El origen no puede estar dentro del segmento opaco que sostiene el aplique.
  if(preset.mount==='wall'){const angle=rotation*Math.PI/180;x-=Math.sin(angle)*.15;z+=Math.cos(angle)*.15;}
  result.push({floor:floorIndex,room:room||null,lamp:lamp.id?lamp:null,
    x,z,radius:radiusFt*.3048,kind,angleDeg:beamAngleDeg,
    rotation,heightFt:finite(lamp.heightFt,kind.startsWith('wall')?6.5:8.4)});
 }
 for(const lamp of authored){
  const room=byId.get(lamp.roomId)||roomAtGrid(floorIndex,lamp.x,lamp.y);
  emit(lamp,room||null);
 }
 return result;
}
function setDynamicSource(id,source){
 if(typeof id!=='string'||!id||!source||!Number.isInteger(source.floor))return false;
 if(![source.x,source.z,source.radius].every(Number.isFinite)||source.radius<=0)return false;
 DYNAMIC_SOURCES.set(id,{floor:source.floor,x:source.x,z:source.z,
  radius:clamp(source.radius,.5,24),rotation:finite(source.rotation,0),
  angleDeg:clamp(finite(source.angleDeg,90),20,360),dynamic:true});
 return true;
}
function removeDynamicSource(id){return DYNAMIC_SOURCES.delete(id)}
function sourcesNear(entries,lighting,floor,x,z,viewRange=19,maxSources=12){
 return entries.filter(e=>e.floor===floor&&lighting.fixtureLit(e.floor,e.room,e.lamp))
  .concat([...DYNAMIC_SOURCES.values()].filter(e=>e.floor===floor))
  .filter(e=>(e.x-x)**2+(e.z-z)**2<=(viewRange+e.radius)**2)
  .sort((a,b)=>(a.x-x)**2+(a.z-z)**2-((b.x-x)**2+(b.z-z)**2))
  .slice(0,maxSources);
}
function coneAllows(entry,x,z){
 if(!entry||entry.angleDeg>=359.5)return true;
 const dx=x-entry.x,dz=z-entry.z,d=Math.hypot(dx,dz);
 if(d<.04)return true;
 const a=entry.rotation*Math.PI/180,fx=-Math.sin(a),fz=Math.cos(a);
 return (dx*fx+dz*fz)/d>=Math.cos(entry.angleDeg*Math.PI/360);
}
function lightReachesPoint(entry,x,z,opaque,pointInSight){
 if(!entry||!coneAllows(entry,x,z)||Math.hypot(x-entry.x,z-entry.z)>entry.radius+.03)return false;
 return pointInSight(x,z,{x:entry.x,z:entry.z},opaque,entry.radius);
}
// Una única consulta de cobertura: la superposición no crea un segundo radio.
function sourcesIlluminate(entries,x,z,opaque,pointInSight){
 return Array.isArray(entries)&&entries.some(source=>lightReachesPoint(source,x,z,opaque,pointInSight));
}
function cameraBonus(entries,lighting,floor,x,z){
 const sources=sourcesNear(entries,lighting,floor,x,z,1,6);
 let bonus=0;
 for(const s of sources)if(Math.hypot(x-s.x,z-s.z)<s.radius)
  bonus=Math.max(bonus,clamp((s.radius-4.8)*.24,0,1.4));
 return bonus;
}
global.FHLights=Object.freeze({PRESETS,presetFor,kindForTool,isWall,presetFields,recommended,materialize,resolve,sourcesNear,coneAllows,lightReachesPoint,cameraBonus,sourcesIlluminate,setDynamicSource,removeDynamicSource});
})(window);
