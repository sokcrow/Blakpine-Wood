/* HUD contextual: el JSON v1 conserva propiedades y añade zonas de lectura opcionales. */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHLocationHUD=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
 'use strict';
 const label=v=>typeof v==='string'?v.trim().slice(0,80):'';
 const text=(key,fallback)=>root.FH_LOCATION_TEXT?.[key]||fallback;
 const scope=(...parts)=>parts.map(part=>encodeURIComponent(String(part??''))).join('|');
 const DISPLAY_MS=2800;
 const now=()=>root.performance?.now?.()??Date.now();
 function createVisibilityState(duration=DISPLAY_MS){
  let previous=null,until=-Infinity;
  return Object.freeze({
   update(key,time){
    if(key!==previous){previous=key;until=time+duration;}
    return time<until;
   },
   peek(time){if(previous===null)return false;until=time+duration;return true;},
   visible(time){return time<until;}
  });
 }
 function inPolygon(p,polygon){
  if(!p||!Array.isArray(polygon)||polygon.length<3)return false;
  const x=Number(p.x),y=Number(p.y);if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
   const a=polygon[j],b=polygon[i],cross=(b.x-a.x)*(y-a.y)-(b.y-a.y)*(x-a.x);
   if(Math.abs(cross)<1e-6&&x>=Math.min(a.x,b.x)-1e-6&&x<=Math.max(a.x,b.x)+1e-6&&y>=Math.min(a.y,b.y)-1e-6&&y<=Math.max(a.y,b.y)+1e-6)return true;
   if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
 }
 function inArea(p,a){
  if(!a||!Number.isFinite(p?.x)||!Number.isFinite(p?.y))return false;
  if(a.spans?.length)return a.spans.some(s=>p.x>=s.x&&p.x<s.x+s.w&&p.y>=s.y&&p.y<s.y+s.h);
  if(a.cells?.length)return a.cells.some(c=>Math.floor(p.x)===c.x&&Math.floor(p.y)===c.y);
  return Number.isFinite(a.x)&&Number.isFinite(a.y)&&Number.isFinite(a.w)&&Number.isFinite(a.h)&&
   p.x>=a.x&&p.y>=a.y&&p.x<a.x+a.w&&p.y<a.y+a.h;
 }
 function codeForFloor(floors,index,mainFloorId){
  const floor=floors?.[index];if(!floor)return '';
  if(mainFloorId&&floors.some(f=>f.id===mainFloorId)){
   const main=floors.findIndex(f=>f.id===mainFloorId),diff=index-main;
   return diff===0?'PB':diff<0?'B'+(-diff):'F'+diff;
  }
  // Los mapas sin planta principal explícita conservan los códigos de siempre.
  const elev=f=>Number.isFinite(Number(f.elevationFt))?Number(f.elevationFt):0;
  const basement=elev(floor)<0;
  const levels=floors.map((f,i)=>({i,v:elev(f)})).filter(x=>(x.v<0)===basement);
  levels.sort((a,b)=>basement?b.v-a.v||a.i-b.i:a.v-b.v||a.i-b.i);
  return (basement?'B':'F')+(levels.findIndex(x=>x.i===index)+1);
 }
 function resolve(map,floorIndex,point,propertyApi=root.FHStyleProperty,roofPlan){
  const floor=map?.floors?.[floorIndex],floorId=floor?.id;
  if(!floor)return {kind:'exterior',floorCode:'',primary:text('exterior','EXTERIOR'),secondary:'',scopeKey:'missing-floor'};
  const properties=(map.properties||[]).filter(p=>p.floorId===floorId&&inPolygon(point,p.polygon));
  const property=properties.length===1?properties[0]:null;
  const buildings=typeof propertyApi?.buildings==='function'?propertyApi.buildings(map,floorId):[];
  const building=buildings.find(b=>inPolygon(point,b.polygon));
  const areas=(floor.items||[]).filter(it=>inArea(point,it));
  const find=(types)=>areas.find(it=>types.includes(it.type));
  const room=find(['room']),hall=find(['hall']),buildingArea=find(['building']);
  // Los tipos "parking" y "outside" sí son áreas de ubicación para el HUD;
  // el asfalto/pasto solamente se muestra si el DM le dio un nombre distinto del material.
  const outsideArea=find(['outside']);
  const parkingArea=find(['parking']);
  const materialDefaults={
   pavement:'Banqueta / piso',asphalt:'Asfalto',alley:'Callejón manchado',
   sidewalk:'Banqueta',concrete:'Concreto',gravel:'Grava',cobblestone:'Adoquín',
   grass:'Pasto',dirt:'Tierra'
  };
  const namedSurface=areas.find(it=>Object.hasOwn(materialDefaults,it.type)&&
   label(it.label)&&label(it.label)!==materialDefaults[it.type]);
  const outdoorName=()=>label(parkingArea?.label)|| (parkingArea?'ESTACIONAMIENTO':'')||
   (label(outsideArea?.label).toUpperCase()==='EXTERIOR'?'':label(outsideArea?.label))||
   label(namedSurface?.label);
  const regionContains=z=>(Array.isArray(z.polygons)&&z.polygons.length?z.polygons:[z.polygon]).some(poly=>inPolygon(point,poly));
  const regions=(map.locationZones||[]).filter(z=>z.floorId===floorId&&regionContains(z));
  const common=regions.find(z=>z.kind==='common');
  const exterior=regions.find(z=>z.kind==='exterior');
  const courtyard=areas.find(it=>it.courtyard===true);
  if(roofPlan?.spans?.some(sp=>inArea(point,sp))){
    return {kind:'exterior',floorCode:'',primary:text('exterior','EXTERIOR'),
     secondary:text('roof','AZOTEA'),scopeKey:scope(floorId,'roof')};
   }
   if(courtyard){
   return {kind:'exterior',floorCode:'',primary:text('exterior','EXTERIOR'),
    secondary:label(courtyard.label),scopeKey:scope(floorId,'courtyard',courtyard.id)};
  }
  if(property){
   return {kind:'property',floorCode:codeForFloor(map.floors,floorIndex,map.mainFloorId),
    primary:label(property.name)||text('property','PROPIEDAD'),
    secondary:label(room?.label),scopeKey:scope(floorId,'property',property.id||property.name,room?.id||room?.label)};
  }
  // Una zona que el DM marca explícitamente como exterior debe ganar a las
  // áreas de edificio o pasillo que puedan quedar solapadas visualmente.
  if(exterior){
   const ownName=label(exterior.name);
   return {kind:'exterior',floorCode:'',primary:text('exterior','EXTERIOR'),
    secondary:ownName.toUpperCase()==='EXTERIOR'?outdoorName():ownName||outdoorName(),
    scopeKey:scope(floorId,'exterior-zone',exterior.id||exterior.name,parkingArea?.id||parkingArea?.label,outsideArea?.id||outsideArea?.label)};
  }
  if(building||common||buildingArea||hall||room){
   return {kind:'building',floorCode:codeForFloor(map.floors,floorIndex,map.mainFloorId),
    primary:label(map.buildingNames?.[building?.id])||label(buildingArea?.label)||
     label(map.title)||text('building','EDIFICIO'),
    secondary:label(common?.name)||label(hall?.label)||label(room?.label),
    scopeKey:scope(floorId,'building',building?.id||buildingArea?.id||map.title,common?.id||common?.name,hall?.id||hall?.label,room?.id||room?.label)};
  }
  return {kind:'exterior',floorCode:'',primary:text('exterior','EXTERIOR'),
   secondary:outdoorName(),scopeKey:scope(floorId,'open-area',parkingArea?.id||parkingArea?.label,outsideArea?.id||outsideArea?.label,namedSurface?.id||namedSurface?.label)};
 }
 let host=null,code=null,first=null,second=null,last='',visible=null;
 const visibility=createVisibilityState();
 function showIf(shouldShow){
  if(!host||visible===shouldShow)return;
  visible=shouldShow;
  host.classList.toggle('fh-location-hidden',!shouldShow);
  host.setAttribute('aria-hidden',String(!shouldShow));
 }
 function peek(){
  if(!ensure()||!visibility.peek(now()))return false;
  showIf(true);
  return true;
 }
 function ensure(){
  const h=root.document?.getElementById('hud');if(!h)return false;
  if(h===host&&code?.isConnected)return true;
  first=root.document.getElementById('floorLabel');
  second=root.document.getElementById('regionLabel');
  if(!first||!second)return false;
  code=root.document.createElement('span');
  code.id='fhFloorCode';code.setAttribute('aria-hidden','true');
  const content=root.document.createElement('div');
  content.className='fh-location-text';
  content.append(first,second);
  h.replaceChildren(code,content);
  h.classList.add('fh-location-hud');
  h.setAttribute('role','status');h.setAttribute('aria-live','off');
  host=h;last='';visible=null;
  return true;
 }
 function update(map,floorIndex,point,roofPlan){
  const value=resolve(map,floorIndex,point,root.FHStyleProperty,roofPlan);
  if(!ensure())return value;
  const key=[value.scopeKey,value.kind,value.floorCode,value.primary,value.secondary].join('\u0000');
  // El motor heredado puede escribir en regionLabel durante hudUpdate().
  if(last!==key||first.textContent!==value.primary||second.textContent!==value.secondary){
   first.textContent=value.primary;second.textContent=value.secondary;
   code.textContent=value.floorCode;code.hidden=value.kind==='exterior';
   host.classList.toggle('fh-location-exterior',value.kind==='exterior');
   host.classList.toggle('fh-location-has-secondary',Boolean(value.secondary));
   second.hidden=!value.secondary;
   last=key;
  }
  showIf(visibility.update(key,now()));
  return value;
 }
 return Object.freeze({resolve,codeForFloor,inPolygon,inArea,createVisibilityState,update,peek});
});
