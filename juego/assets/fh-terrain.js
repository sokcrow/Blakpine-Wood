/* Terreno procedural v1. Coordenadas públicas en metros; datos del mapa en casillas. */
(function(root,factory){
 const api=factory(root.FH_FOREST_TEXT||(typeof require==='function'?require('./fh-forest-strings.js'):null));
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHTerrain=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Text){
 'use strict';
 const clamp=(n,a,b,d)=>Number.isFinite(Number(n))?Math.max(a,Math.min(b,Number(n))):d;
 const smooth=t=>t*t*(3-2*t);
 const RELIEF_CLEARANCE_FT=15,RELIEF_CLEARANCE_M=RELIEF_CLEARANCE_FT*.3048;
 const constructionTypes=new Set(['building','room','hall','stairs','asphalt','alley','pavement','sidewalk','concrete','cobblestone','parking']);
 function seed(value){let h=2166136261;for(const c of String(value)){h=Math.imul(h^c.charCodeAt(0),16777619);}return h>>>0;}
 function random(s,x,z,channel=0){let h=seed(s)^Math.imul(x,374761393)^Math.imul(z,668265263)^Math.imul(channel,1274126177);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
 function noise(s,x,z){const a=Math.floor(x),b=Math.floor(z),u=smooth(x-a),v=smooth(z-b);const mix=(p,q,t)=>p+(q-p)*t;return mix(mix(random(s,a,b),random(s,a+1,b),u),mix(random(s,a,b+1),random(s,a+1,b+1),u),v);}
 function config(raw={}){
  raw=raw&&typeof raw==='object'?raw:{};
  if(raw.version!==undefined&&raw.version!==1)throw Error(Text.versionError);
  const t=raw.terrain||{},f=raw.forest||{};
  return {enabled:raw.enabled===true,version:1,
   terrain:{seed:String(t.seed??'blakpine-relieve-1').slice(0,120),amplitudeM:clamp(t.amplitudeM,0,6,1.2),wavelengthM:clamp(t.wavelengthM,20,300,65),transitionM:clamp(t.transitionM,2,30,8),meshStepM:clamp(t.meshStepM,.5,3,1.5)},
   forest:{seed:String(f.seed??'blakpine-bosque-1').slice(0,120),density:clamp(f.density,0,1,.65),spacingM:clamp(f.spacingM,2.5,20,5),sectorM:clamp(f.sectorM,12,64,24),snow:f.snow===true,
    exclusions:[...new Set((Array.isArray(f.exclusions)?f.exclusions:[]).filter(id=>typeof id==='string'))]}};
 }
 const distanceSegment=(x,z,a,b)=>{const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/l)):0;return Math.hypot(x-a.x-t*dx,z-a.z-t*dz);};
 function inside(x,z,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)yes=!yes;}return yes;}
 function polygonDistance(x,z,poly){if(inside(x,z,poly))return 0;return Math.min(...poly.map((a,i)=>distanceSegment(x,z,a,poly[(i+1)%poly.length])));}
 function create(map){
  const cfg=config(map.environment),cell=clamp(map.units?.metersPerCell,.01,100,1.524);
  const main=Math.max(0,(map.floors||[]).findIndex(f=>f.id===map.mainFloorId)),floor=map.floors?.[main];
  const width=clamp(map.units?.columns,1,500,40)*cell,depth=clamp(map.units?.rows,1,500,40)*cell;
  const nx=Math.ceil(width/cfg.terrain.meshStepM),nz=Math.ceil(depth/cfg.terrain.meshStepM),sx=width/nx,sz=depth/nz;
  if(cfg.enabled&&nx*nz>1000000)throw Error(Text.terrainLimit);
  const shapes=[],buckets=new Map(),bucketSize=24;
  function add(poly,pad=0,reliefPad=0){
   if(!poly||poly.length<1||!poly.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)))return;
   const shape={poly,pad,reliefPad,minX:Math.min(...poly.map(p=>p.x))-pad,maxX:Math.max(...poly.map(p=>p.x))+pad,minZ:Math.min(...poly.map(p=>p.z))-pad,maxZ:Math.max(...poly.map(p=>p.z))+pad};
   shapes.push(shape);
   const margin=Math.max(0,reliefPad-pad)+cfg.terrain.transitionM+Math.hypot(sx,sz);
   for(let x=Math.floor((shape.minX-margin)/bucketSize);x<=Math.floor((shape.maxX+margin)/bucketSize);x++)for(let z=Math.floor((shape.minZ-margin)/bucketSize);z<=Math.floor((shape.maxZ+margin)/bucketSize);z++){
    const key=x+':'+z;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(shape);
   }
  }
  const poly=points=>(points||[]).map(p=>({x:Number(p.x)*cell,z:Number(p.y)*cell}));
  function rect(r,centered=false,pad=0,reliefPad=0){
   if(![r.x,r.y,r.w,r.h].every(v=>Number.isFinite(Number(v))))return;
   const w=Number(r.w)*cell,h=Number(r.h)*cell,a=(Number(r.rotation)||0)*Math.PI/180;
   const cx=Number(r.x)*cell+(centered?0:w/2),cz=Number(r.y)*cell+(centered?0:h/2);
   add([[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,z])=>({x:cx+x*Math.cos(a)-z*Math.sin(a),z:cz+x*Math.sin(a)+z*Math.cos(a)})),pad,reliefPad);
  }
  const floorId=floor?.id;
  for(const zone of [...(map.properties||[]),...(map.locationZones||[])])if(!zone.floorId||zone.floorId===floorId){
   for(const p of zone.polygons?.length?zone.polygons:[zone.polygon])if(p?.length>=3)add(poly(p),0,zone.construction?RELIEF_CLEARANCE_M:0);
  }
  const areaTypes=new Set(['room','hall','outside','building','pavement','parking','grass','dirt','asphalt','alley','sidewalk','concrete','gravel','cobblestone','courtyard']);
  for(let fi=0;fi<(map.floors||[]).length;fi++)for(const it of map.floors[fi].items||[]){
   if(fi!==main&&!['room','building','hall','stairs'].includes(it.type))continue;
   const reliefPad=constructionTypes.has(it.type)||it.road?RELIEF_CLEARANCE_M:0;
   if(it.a&&it.b){const halfThickness=Math.max(.4,(Number(it.thicknessFt)||1)*.3048/2);add(poly([it.a,it.b]),halfThickness,halfThickness+RELIEF_CLEARANCE_M);continue;}
   if(it.type==='spawn'){add(poly([it]),2);continue;}
   if(it.spans?.length){for(const r of it.spans)rect(r,false,.25,reliefPad);continue;}
   if(it.cells?.length){for(const p of it.cells)rect({...p,w:1,h:1},false,.25,reliefPad);continue;}
   if(it.road){const s=(Number(it.road.sidewalkFt)||0)*.3048;rect(it,false,s+.25,s+RELIEF_CLEARANCE_M);continue;}
   if(areaTypes.has(it.type))rect(it,false,.25,reliefPad);
   else rect({...it,w:it.w??1,h:it.h??1},true,.5);
  }
  function distance(x,z,relief=false){let result=Infinity;for(const s of buckets.get(Math.floor(x/bucketSize)+':'+Math.floor(z/bucketSize))||[]){const d=s.poly.length===1?Math.hypot(x-s.poly[0].x,z-s.poly[0].z):s.poly.length===2?distanceSegment(x,z,...s.poly):polygonDistance(x,z,s.poly);result=Math.min(result,Math.max(0,d-(relief?Math.max(s.pad,s.reliefPad):s.pad)));}return result;}
  const reservedAt=(x,z,r=0)=>x-r<0||z-r<0||x+r>width||z+r>depth||distance(x,z)<=r+1e-8;
  const heights=new Map();
  function vertex(ix,iz){
   const key=ix+iz*(nx+1);if(heights.has(key))return heights.get(key);
   const x=ix*sx,z=iz*sz,t=cfg.terrain;
   const feather=smooth(Math.max(0,Math.min(1,(distance(x,z,true)-Math.hypot(sx,sz))/t.transitionM)));
   const n=(noise(t.seed,x/t.wavelengthM,z/t.wavelengthM)-.5)*1.6+(noise(t.seed+':detail',x/t.wavelengthM*2,z/t.wavelengthM*2)-.5)*.4;
   const h=cfg.enabled?n*t.amplitudeM*feather:0;heights.set(key,h);return h;
  }
  // El margen de una diagonal mantiene los 15 ft planos también entre vértices.
  // Misma diagonal y plano triangular que la malla visible, incluso en depresiones.
  function heightAt(x,z){
   if(!cfg.enabled)return 0;
   x=Math.max(0,Math.min(width,x));z=Math.max(0,Math.min(depth,z));
   const ix=Math.min(nx-1,Math.floor(x/sx)),iz=Math.min(nz-1,Math.floor(z/sz)),u=x/sx-ix,v=z/sz-iz;
   const a=vertex(ix,iz),b=vertex(ix+1,iz),c=vertex(ix,iz+1),d=vertex(ix+1,iz+1);
   return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
  }
  function slopeAt(x,z){const e=.1;return Math.atan(Math.hypot((heightAt(x+e,z)-heightAt(x-e,z))/(2*e),(heightAt(x,z+e)-heightAt(x,z-e))/(2*e)))*180/Math.PI;}
  function reservedRect(r){
   const p=[{x:r.x,z:r.z},{x:r.x+r.w,z:r.z},{x:r.x+r.w,z:r.z+r.d},{x:r.x,z:r.z+r.d}];
   if(p.some(v=>reservedAt(v.x,v.z)))return true;
   return shapes.some(s=>{
    if(s.maxX<r.x||s.minX>r.x+r.w||s.maxZ<r.z||s.minZ>r.z+r.d)return false;
    if(s.poly.some(v=>v.x>=r.x&&v.x<=r.x+r.w&&v.z>=r.z&&v.z<=r.z+r.d))return true;
    for(const a of p)if((s.poly.length>=3?polygonDistance(a.x,a.z,s.poly):distanceSegment(a.x,a.z,s.poly[0],s.poly.at(-1)))<=s.pad)return true;
    // Rectángulos convexos: comprobar cruces de aristas, incluidas reservas estrechas.
    for(let i=0;i<s.poly.length;i++)for(let j=0;j<4;j++){
     const a=s.poly[i],b=s.poly[(i+1)%s.poly.length],c=p[j],d=p[(j+1)%4];
     const cross=(u,v,w)=>(v.x-u.x)*(w.z-u.z)-(v.z-u.z)*(w.x-u.x);
     if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return true;
     if(Math.min(distanceSegment(a.x,a.z,c,d),distanceSegment(b.x,b.z,c,d),distanceSegment(c.x,c.z,a,b),distanceSegment(d.x,d.z,a,b))<=s.pad+1e-8)return true;
    }
    return false;
   });
  }
  return {config:cfg,mainFloor:main,cell,width,depth,nx,nz,sx,sz,vertex,heightAt,slopeAt,reservedAt,reservedRect,protectionDistance:distance};
 }
 return Object.freeze({RELIEF_CLEARANCE_FT,config,create,seed,random,noise});
});
