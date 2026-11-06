/* Parcelas sin geometría de muro. El JSON conserva forest-horror-map-v1. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHPropertyZones=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const EPS=1e-6;
 const round=n=>Math.round(n*10000)/10000;
 function inside(point,polygon){
  if(!Array.isArray(polygon)||polygon.length<3)return false;
  const x=Number(point.x),y=Number(point.y);let yes=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
   const a=polygon[j],b=polygon[i],cross=(b.x-a.x)*(y-a.y)-(b.y-a.y)*(x-a.x);
   if(Math.abs(cross)<EPS&&x>=Math.min(a.x,b.x)-EPS&&x<=Math.max(a.x,b.x)+EPS&&y>=Math.min(a.y,b.y)-EPS&&y<=Math.max(a.y,b.y)+EPS)return true;
   if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)yes=!yes;
  }
  return yes;
 }
 function rectangle(a,b,columns,rows){
  const width=Number(columns),height=Number(rows);
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return null;
  const x=round(Math.max(0,Math.min(width,Math.min(a.x,b.x)))),y=round(Math.max(0,Math.min(height,Math.min(a.y,b.y))));
  const right=round(Math.max(0,Math.min(width,Math.max(a.x,b.x)))),bottom=round(Math.max(0,Math.min(height,Math.max(a.y,b.y))));
  if(right-x<.25||bottom-y<.25)return null;
  return {x,y,w:round(right-x),h:round(bottom-y)};
 }
 function polygon(r){return [{x:r.x,y:r.y},{x:r.x+r.w,y:r.y},{x:r.x+r.w,y:r.y+r.h},{x:r.x,y:r.y+r.h}];}
 function intersectionArea(poly,rect){
  if(!Array.isArray(poly)||poly.length<3)return 0;
  let points=poly.map(p=>({x:p.x,y:p.y}));
  const edges=[
   {axis:'x',value:rect.x,keep:v=>v>=rect.x-EPS},
   {axis:'x',value:rect.x+rect.w,keep:v=>v<=rect.x+rect.w+EPS},
   {axis:'y',value:rect.y,keep:v=>v>=rect.y-EPS},
   {axis:'y',value:rect.y+rect.h,keep:v=>v<=rect.y+rect.h+EPS}
  ];
  for(const e of edges){
   const next=[];
   for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],av=e.keep(a[e.axis]),bv=e.keep(b[e.axis]);
    if(av!==bv){const span=b[e.axis]-a[e.axis],t=Math.abs(span)>EPS?(e.value-a[e.axis])/span:0;
     next.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}
    if(bv)next.push(b);
   }
   points=next;if(points.length<3)return 0;
  }
  let twice=0;
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];twice+=a.x*b.y-b.x*a.y;}
  return Math.abs(twice)*.5;
 }
 function conflicts(map,floorId,rect,ignoreId=''){
  return (map.properties||[]).filter(p=>p.floorId===floorId&&p.id!==ignoreId&&intersectionArea(p.polygon,rect)>EPS);
 }
 function at(map,floorId,point){
  const matching=(map.properties||[]).filter(p=>p.floorId===floorId&&inside(point,p.polygon));
  return matching.length===1?matching[0]:null;
 }
 function doorAt(map,floorId,door){
  if(!door?.a||!door?.b||!['door','peephole_door'].includes(door.type))return null;
  return at(map,floorId,{x:(door.a.x+door.b.x)/2,y:(door.a.y+door.b.y)/2});
 }
 function create(map,floorId,a,b,columns,rows,id){
  const rect=rectangle(a,b,columns,rows);
  if(!rect)return {ok:false,reason:'Dibuja un área de al menos ¼ de casilla de ancho y alto.'};
  if(conflicts(map,floorId,rect).length)return {ok:false,reason:'Esta parcela se superpone con otra propiedad. Ajusta sus límites.'};
  if(typeof id!=='string'||!id)return {ok:false,reason:'ID de parcela inválido.'};
  return {ok:true,zone:{id,floorId,source:'zone',name:'Parcela',claimable:true,ownerId:'',polygon:polygon(rect)}};
 }
 const ZONE_COLORS=Object.freeze(['#82C9AE','#8BBCF0','#D8AC74','#BCA0E1','#E39499','#8AB9BF','#D0C16D','#9DBE88','#D89BC0','#8499D6','#E1A875','#8BCDBF']);
 const HEX=/^#[0-9a-fA-F]{6}$/;
 const colorOf=zone=>HEX.test(zone?.color||'')?zone.color.toUpperCase():(zone?.kind==='common'?'#8BBCF0':'#82C9AE');
 function nextColor(map,floorId){
  const used=new Set(locations(map,floorId).map(colorOf));
  const available=ZONE_COLORS.find(c=>!used.has(c));
  if(available)return available;
  // Permutación biyectiva de colores RGB: multiplicador impar sobre 24 bits.
  // Cada candidato es diferente; nunca reciclar un color, ya que equivale a fusionar zonas.
  for(let i=0;i<0x1000000;i++){
   const rgb=(Math.imul(i,0x9E3779B1)+0x8C9AAD)&0xFFFFFF;
   const r=(rgb>>>16)&255,g=(rgb>>>8)&255,b=rgb&255;
   // Evitar colores muy oscuros, pálidos o grises poco visibles en el editor.
   if(Math.max(r,g,b)<110||Math.min(r,g,b)>226||Math.max(r,g,b)-Math.min(r,g,b)<30)continue;
   const color='#'+rgb.toString(16).padStart(6,'0').toUpperCase();
   if(!used.has(color))return color;
  }
  throw Error('No quedan colores distintos disponibles para este piso.');
 }
 function pieces(zone){
  if(Array.isArray(zone?.polygons)&&zone.polygons.length)return zone.polygons;
  return Array.isArray(zone?.polygon)?[zone.polygon]:[];
 }
 function zoneContains(zone,p){return pieces(zone).some(poly=>inside(p,poly));}
 function locations(map,floorId){
  return (map.locationZones||[]).filter(z=>z.floorId===floorId&&['exterior','common'].includes(z.kind)&&pieces(z).length>0);
 }
 function locationAt(map,floorId,point){
  const matches=locations(map,floorId).filter(z=>zoneContains(z,point));
  return matches.length===1?matches[0]:null;
 }
 // Rectángulos dibujados con la herramienta Zonas. Los tramos de un mismo ID
 // permanecen separados en el JSON pero forman una única ubicación lógica.
 function rectFor(poly){
  if(!Array.isArray(poly)||!poly.length)return null;
  const xs=poly.map(p=>Number(p.x)),ys=poly.map(p=>Number(p.y));
  if(xs.some(v=>!Number.isFinite(v))||ys.some(v=>!Number.isFinite(v)))return null;
  return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
 }
 // Geometría real para polígonos importados (triángulos, concavidades, etc.).
 // El contacto por esquina NO fusiona; un borde compartido de longitud positiva sí.
 const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 function onSegment(p,a,b){
  return Math.abs(cross(a,b,p))<=EPS*Math.max(1,Math.hypot(b.x-a.x,b.y-a.y))&&
   p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&
   p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;
 }
 function strictInside(p,poly){
  return inside(p,poly)&&!poly.some((a,i)=>onSegment(p,a,poly[(i+1)%poly.length]));
 }
 function edges(poly){return poly.map((a,i)=>[a,poly[(i+1)%poly.length]]);}
 function properIntersection(a,b,c,d){
  const dx=b.x-a.x,dy=b.y-a.y,ex=d.x-c.x,ey=d.y-c.y;
  const den=dx*ey-dy*ex;
  if(Math.abs(den)<=EPS*Math.max(1,Math.hypot(dx,dy)*Math.hypot(ex,ey)))return false;
  const cx=c.x-a.x,cy=c.y-a.y;
  const t=(cx*ey-cy*ex)/den,u=(cx*dy-cy*dx)/den;
  return t>EPS&&t<1-EPS&&u>EPS&&u<1-EPS;
 }
 function sharedEdge(a,b,c,d){
  const ax=b.x-a.x,ay=b.y-a.y,bx=d.x-c.x,by=d.y-c.y;
  if(Math.abs(ax*by-ay*bx)>EPS*Math.max(1,Math.hypot(ax,ay)*Math.hypot(bx,by))||
     Math.abs(cross(a,b,c))>EPS*Math.max(1,Math.hypot(ax,ay)))return false;
  const useX=Math.abs(ax)>=Math.abs(ay),axis=useX?'x':'y';
  return Math.min(Math.max(a[axis],b[axis]),Math.max(c[axis],d[axis]))-
   Math.max(Math.min(a[axis],b[axis]),Math.min(c[axis],d[axis]))>EPS;
 }
 function interiorSampleInside(a,b){
  let signedArea=0;
  for(const [p,q] of edges(a))signedArea+=p.x*q.y-q.x*p.y;
  const side=signedArea>=0?1:-1;
  for(const [p,q] of edges(a)){
   const dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy);
   if(len<=EPS)continue;
   const step=Math.min(0.0001,len*0.01);
   const point={x:(p.x+q.x)/2-side*dy/len*step,
                y:(p.y+q.y)/2+side*dx/len*step};
   if(strictInside(point,a)&&strictInside(point,b))return true;
  }
  return false;
 }
 function polygonsOverlap(a,b){
  if(!Array.isArray(a)||!Array.isArray(b)||a.length<3||b.length<3)return false;
  if(a.some(p=>strictInside(p,b))||b.some(p=>strictInside(p,a)))return true;
  for(const [p,q] of edges(a))for(const [u,v] of edges(b))
   if(properIntersection(p,q,u,v))return true;
  return interiorSampleInside(a,b)||interiorSampleInside(b,a);
 }
 function polygonsTouch(a,b){
  if(polygonsOverlap(a,b))return true;
  for(const [p,q] of edges(a))for(const [u,v] of edges(b))
   if(sharedEdge(p,q,u,v))return true;
  return false;
 }
 function overlaps(zone,rect){return pieces(zone).some(poly=>intersectionArea(poly,rect)>EPS);}
 function touches(zone,rect){const poly=polygon(rect);return pieces(zone).some(p=>polygonsTouch(p,poly));}
 function tooManyParts(parts){return parts.length>128;}
 function createLocation(map,floorId,a,b,columns,rows,id,kind,color=undefined,extendId=''){
  if(!['exterior','common'].includes(kind))return {ok:false,reason:'Tipo de zona inválido.'};
  const rect=rectangle(a,b,columns,rows);
  if(!rect)return {ok:false,reason:'Dibuja un área de al menos ¼ de casilla de ancho y alto.'};
  if(!id||typeof id!=='string')return {ok:false,reason:'ID de zona inválido.'};
  const normalizedColor=color===undefined?nextColor(map,floorId):String(color).toUpperCase();
  if(!HEX.test(normalizedColor))return {ok:false,reason:'Color de zona inválido.'};
  const current=locations(map,floorId);
  // Nada puede solaparse con otra zona, ni siquiera si una es exterior y la otra común.
  // Solo aceptamos la superposición al añadir un tramo al MISMO nombre/color/tipo.
  const blocked=current.find(z=>overlaps(z,rect)&&(z.kind!==kind||colorOf(z)!==normalizedColor));
  if(blocked)return {ok:false,reason:'El área se superpone con «'+(blocked.name||'Zona')+'». Usa la misma zona o dibuja fuera de sus límites.'};
  const merge=current.filter(z=>z.kind===kind&&colorOf(z)===normalizedColor&&touches(z,rect));
  const target=extendId?current.find(z=>z.id===extendId):merge[0];
  if(extendId&&(!target||target.kind!==kind||colorOf(target)!==normalizedColor))
   return {ok:false,reason:'La zona que intentas ampliar ya no existe o cambió de color.'};
  if(extendId&&!merge.includes(target))
   return {ok:false,reason:'Para ampliar una zona, el nuevo tramo debe tocar el anterior (no solo una esquina).'};
  if(!target){
   const poly=polygon(rect);
   return {ok:true,created:true,zone:{id,floorId,kind,color:normalizedColor,name:kind==='exterior'?'Exterior':'Zona común',polygon:poly},removeIds:[]};
  }
  const members=[target,...merge.filter(z=>z.id!==target.id)];
  const polygons=members.flatMap(pieces).concat([polygon(rect)]);
  if(tooManyParts(polygons))return {ok:false,reason:'La zona llegó al límite de 128 tramos.'};
  const updated={...target,color:normalizedColor,polygon:polygons[0],polygons};
  return {ok:true,created:false,zone:updated,removeIds:members.slice(1).map(z=>z.id),merged:members.length>1};
 }
 function recolorLocation(map,zone,options){
  const existing=locations(map,zone.floorId).filter(z=>z.id!==zone.id);
  const kind=options.kind,color=String(options.color||'').toUpperCase();
  if(!['common','exterior'].includes(kind)||!HEX.test(color))return {ok:false,reason:'Tipo o color inválido.'};
  const other=existing.find(z=>pieces(zone).some(poly=>{
   return pieces(z).some(other=>polygonsOverlap(poly,other));
  }));
  if(other)return {ok:false,reason:'No se puede modificar esta zona: se superpone con «'+(other.name||'Zona')+'».'};
  let list=[{...zone,kind,color,name:String(options.name||'').trim().slice(0,80)}],merged=[];
  // Color y categoría iguales + contacto por un borde: una sola zona.
  for(let changed=true;changed;){
   changed=false;
   for(const otherZone of existing){
    if(merged.includes(otherZone.id)||otherZone.kind!==kind||colorOf(otherZone)!==color)continue;
    if(!pieces(otherZone).some(poly=>list.some(base=>pieces(base).some(q=>polygonsTouch(q,poly)))))continue;
    list.push(otherZone);merged.push(otherZone.id);changed=true;
   }
  }
  const all=list.flatMap(pieces);
  if(tooManyParts(all))return {ok:false,reason:'La zona llegaría al límite de 128 tramos.'};
  const updated={...list[0],polygons:all,polygon:all[0]};
  return {ok:true,zone:updated,removeIds:merged};
 }
 // Bordes exteriores únicamente: oculta las costuras entre tramos unidos.
 function boundarySegments(zone){
  // El contorno debe seguir los bordes reales, incluso en polígonos importados
  // no rectangulares. Se parten en cada intersección y se descartan las
  // porciones con superficie de la zona a AMBOS lados.
  const polygons=pieces(zone).filter(poly=>Array.isArray(poly)&&poly.length>=3);
  const segments=polygons.flatMap(poly=>edges(poly)
   .filter(([a,b])=>Math.hypot(b.x-a.x,b.y-a.y)>EPS)
   .map(([a,b])=>({a,b})));
  const unionContains=p=>polygons.some(poly=>inside(p,poly));
  const output=[],seen=new Set();
  const pointKey=p=>p.x.toFixed(7)+','+p.y.toFixed(7);
  for(let i=0;i<segments.length;i++){
   const {a,b}=segments[i],dx=b.x-a.x,dy=b.y-a.y;
   const len2=dx*dx+dy*dy,len=Math.sqrt(len2);
   const cuts=[0,1];
   const addCut=t=>{if(t>EPS&&t<1-EPS)cuts.push(t);};
   for(let j=0;j<segments.length;j++){
    if(i===j)continue;
    const {a:c,b:d}=segments[j],ex=d.x-c.x,ey=d.y-c.y;
    const den=dx*ey-dy*ex,rx=c.x-a.x,ry=c.y-a.y;
    const tolerance=EPS*Math.max(1,len*Math.hypot(ex,ey));
    if(Math.abs(den)>tolerance){
     const t=(rx*ey-ry*ex)/den;
     const u=(rx*dy-ry*dx)/den;
     if(t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS)
      addCut(Math.max(0,Math.min(1,t)));
    }else if(Math.abs(cross(a,b,c))<=EPS*Math.max(1,len)&&
      Math.abs(cross(a,b,d))<=EPS*Math.max(1,len)){
     // Bordes colineales: dividir también en los extremos del tramo vecino.
     addCut((rx*dx+ry*dy)/len2);
     addCut(((d.x-a.x)*dx+(d.y-a.y)*dy)/len2);
    }
   }
   cuts.sort((x,y)=>x-y);
   for(let j=1;j<cuts.length;j++){
    const t0=cuts[j-1],t1=cuts[j];
    if((t1-t0)*len<=EPS)continue;
    const p={x:a.x+dx*t0,y:a.y+dy*t0};
    const q={x:a.x+dx*t1,y:a.y+dy*t1};
    const mid={x:(p.x+q.x)/2,y:(p.y+q.y)/2};
    const delta=Math.min(0.0001,(t1-t0)*len*0.01);
    const normal={x:-dy/len*delta,y:dx/len*delta};
    const left=unionContains({x:mid.x+normal.x,y:mid.y+normal.y});
    const right=unionContains({x:mid.x-normal.x,y:mid.y-normal.y});
    if(left===right)continue;
    const k1=pointKey(p),k2=pointKey(q);
    const key=k1<k2?k1+'|'+k2:k2+'|'+k1;
    if(seen.has(key))continue;
    seen.add(key);output.push({a:p,b:q});
   }
  }
  return output;
 }
 function counts(floor,prop){
  const items=floor?.items||[],wallTypes=new Set(['wall','red_wall','half_wall','fence','property_wall']);
  let walls=0,areas=0,objects=0,doors=0;
  for(const item of items){
   if(item.a&&item.b){
    const midpoint={x:(item.a.x+item.b.x)/2,y:(item.a.y+item.b.y)/2};
    if(![item.a,item.b,midpoint].every(pt=>inside(pt,prop.polygon)))continue;
    if(wallTypes.has(item.type))walls++;
    else if(['door','peephole_door'].includes(item.type))doors++;
   }else if(Number.isFinite(item.x)&&Number.isFinite(item.y)){
    if(item.spans?.length){
     if(!item.spans.every(s=>polygon({x:s.x,y:s.y,w:s.w,h:s.h}).every(pt=>inside(pt,prop.polygon))))continue;
    }else if(Number.isFinite(item.w)&&Number.isFinite(item.h)&&['room','hall','outside','building','pavement','parking','asphalt','alley','sidewalk','concrete','gravel','cobblestone','tile_floor','carpet','wood_floor','grass','dirt'].includes(item.type)){
     if(!polygon(item).every(pt=>inside(pt,prop.polygon)))continue;
    }else if(!inside({x:item.x,y:item.y},prop.polygon))continue;
    if(['room','hall','outside','building','pavement','parking','asphalt','alley','sidewalk','concrete','gravel','cobblestone','tile_floor','carpet','wood_floor','grass','dirt'].includes(item.type))areas++;else objects++;
   }
  }
  return {walls,areas,objects,doors};
 }
 return Object.freeze({rectangle,polygon,inside,intersectionArea,conflicts,at,doorAt,create,counts,locations,locationAt,createLocation,recolorLocation,pieces,zoneContains,colorOf,nextColor,boundarySegments,ZONE_COLORS});
});
