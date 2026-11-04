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
function footprint(room){
 const spans=Array.isArray(room.spans)&&room.spans.length?room.spans:
  [{x:finite(room.x,0),y:finite(room.y,0),w:Math.max(.25,finite(room.w,1)),h:Math.max(.25,finite(room.h,1))}];
 return spans.filter(s=>s&&Number.isFinite(s.x)&&Number.isFinite(s.y)&&s.w>0&&s.h>0);
}
function recommended(room){
 const spans=footprint(room),areas=spans.map(s=>s.w*s.h),total=areas.reduce((a,b)=>a+b,0);
 if(!total)return [];
 const long=spans.some(s=>Math.max(s.w,s.h)>=5&&Math.min(s.w,s.h)<=3);
 const kind=long?'strip':'bulb';
 const candidates=[];
 for(const span of spans){
  const major=Math.max(span.w,span.h),vertical=span.h>=span.w;
  const count=major>=5&&Math.min(span.w,span.h)<=3?Math.min(12,Math.ceil(major/4)):1;
  for(let i=0;i<count;i++){
   const u=(i+.5)/count;
   candidates.push({x:vertical?span.x+span.w*.5:span.x+span.w*u,
    y:vertical?span.y+span.h*u:span.y+span.h*.5,kind,weight:span.w*span.h});
  }
 }
 candidates.sort((a,b)=>b.weight-a.weight);
 const selected=[];
 for(const p of candidates){
  if(selected.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<1.6))continue;
  selected.push(p);
  if(selected.length>=12)break;
 }
 if(!selected.length){
  const largest=spans[areas.indexOf(Math.max(...areas))];
  selected.push({x:largest.x+largest.w/2,y:largest.y+largest.h/2,kind});
 }
 return selected;
}
function isInsideRoom(room,x,y){
 return footprint(room).some(s=>x>=s.x&&x<=s.x+s.w&&y>=s.y&&y<=s.y+s.h);
}
// Explicit conversion is invoked only when the author visits the lighting
// layer. No invisible lights come back after the last one is deleted.
function materialize(floor,makeId){
 if(!floor||floor.lightingManual)return 0;
 const rooms=(floor.items||[]).filter(i=>i.type==='room');
 if(!rooms.length)return 0;
 const placed=(floor.items||[]).filter(i=>i.type==='light_fixture');
 let added=0;
 for(const room of rooms){
  const roomId=room.roomId||room.id;
  if(placed.some(i=>i.roomId===roomId||(!i.roomId&&isInsideRoom(room,i.x,i.y))))continue;
  for(const pos of recommended(room)){
   const lamp={id:makeId(),type:'light_fixture',x:pos.x,y:pos.y,rotation:0,
    ...presetFields(pos.kind),roomId,apartmentId:room.apartmentId||'',zoneId:room.zoneId||'main'};
   floor.items.push(lamp);placed.push(lamp);added++;
  }
 }
 floor.lightingManual=true;
 return added;
}
function resolve(floorIndex,floor,rooms,roomAtGrid,cell){
 const result=[],items=floor.items||[],authored=items.filter(i=>i.type==='light_fixture');
 const byId=new Map(rooms.map(r=>[r.roomId||r.id,r]));
 function emit(lamp,room){
  const preset=presetFor(lamp.lightKind),kind=preset.mount==='wall'?presetFor(lamp.lightKind)===PRESETS.wall_flood?'wall_flood':'wall_sconce':Object.prototype.hasOwnProperty.call(PRESETS,lamp.lightKind)?lamp.lightKind:'bulb';
  const radiusFt=clamp(finite(lamp.lightRadiusFt,preset.radiusFt),5,80);
  const beamAngleDeg=clamp(finite(lamp.beamAngleDeg,preset.beamAngleDeg),20,360);
  const x=Number(lamp.x),z=Number(lamp.y);
  if(!Number.isFinite(x)||!Number.isFinite(z))return;
  result.push({floor:floorIndex,room:room||null,lamp:lamp.id?lamp:null,
    x:x*cell,z:z*cell,radius:radiusFt*.3048,kind,angleDeg:beamAngleDeg,
    rotation:finite(lamp.rotation,0),heightFt:finite(lamp.heightFt,kind.startsWith('wall')?6.5:8.4)});
 }
 for(const lamp of authored){
  const room=byId.get(lamp.roomId)||roomAtGrid(floorIndex,lamp.x,lamp.y);
  emit(lamp,room||null);
 }
 if(!floor.lightingManual)for(const room of rooms){
  const roomId=room.roomId||room.id;
  if(authored.some(i=>i.roomId===roomId||(!i.roomId&&isInsideRoom(room,i.x,i.y))))continue;
  for(const pos of recommended(room)){
   emit({x:pos.x,y:pos.y,lightKind:pos.kind,rotation:0},room);
  }
 }
 return result;
}
function sourcesNear(entries,lighting,floor,x,z,viewRange=19,maxSources=12){
 return entries.filter(e=>e.floor===floor&&lighting.fixtureLit(e.floor,e.room,e.lamp)&&
  (e.x-x)**2+(e.z-z)**2<=(viewRange+e.radius)**2)
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
function cameraBonus(entries,lighting,floor,x,z){
 const sources=sourcesNear(entries,lighting,floor,x,z,1,6);
 let bonus=0;
 for(const s of sources)if(Math.hypot(x-s.x,z-s.z)<s.radius)
  bonus=Math.max(bonus,clamp((s.radius-4.8)*.24,0,1.4));
 return bonus;
}
global.FHLights=Object.freeze({PRESETS,presetFor,kindForTool,isWall,presetFields,recommended,materialize,resolve,sourcesNear,coneAllows,lightReachesPoint,cameraBonus});
})(window);
