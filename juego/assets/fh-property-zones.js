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
  for(let i=0;i<360;i++){
   const h=(i*137.508)%360,k=Math.round(h/60)%6,t=60;
   const hues=[[208,132,132],[208,170,132],[208,208,132],[132,208,132],[132,171,208],[168,132,208]];
   const rgb=hues[k],c='#'+rgb.map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();
   if(!used.has(c))return c;
  }
  return '#82C9AE';
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
 function touchingRect(a,b){
  const r=rectFor(a);if(!r)return false;
  const xOverlap=Math.min(r.x+r.w,b.x+b.w)-Math.max(r.x,b.x);
  const yOverlap=Math.min(r.y+r.h,b.y+b.h)-Math.max(r.y,b.y);
  return (xOverlap>EPS&&yOverlap>=-EPS)||(yOverlap>EPS&&xOverlap>=-EPS);
 }
 function overlaps(zone,rect){return pieces(zone).some(poly=>intersectionArea(poly,rect)>EPS);}
 function touches(zone,rect){return pieces(zone).some(poly=>touchingRect(poly,rect));}
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
   const r=rectFor(poly);
   return r&&overlaps(z,r);
  }));
  if(other)return {ok:false,reason:'No se puede modificar esta zona: se superpone con «'+(other.name||'Zona')+'».'};
  let list=[{...zone,kind,color,name:String(options.name||'').trim().slice(0,80)}],merged=[];
  // Color y categoría iguales + contacto por un borde: una sola zona.
  for(let changed=true;changed;){
   changed=false;
   for(const otherZone of existing){
    if(merged.includes(otherZone.id)||otherZone.kind!==kind||colorOf(otherZone)!==color)continue;
    if(!pieces(otherZone).some(poly=>list.some(base=>pieces(base).some(q=>touchingRect(q,rectFor(poly))))))continue;
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
  const rects=pieces(zone).map(rectFor).filter(Boolean),edges=[];
  const contains=(x,y)=>rects.some(r=>x>r.x+EPS&&x<r.x+r.w-EPS&&y>r.y+EPS&&y<r.y+r.h-EPS);
  for(const r of rects){
   for(const side of ['top','right','bottom','left']){
    const vertical=side==='left'||side==='right';
    const fixed=vertical?(side==='left'?r.x:r.x+r.w):(side==='top'?r.y:r.y+r.h);
    const lo=vertical?r.y:r.x,hi=vertical?r.y+r.h:r.x+r.w;
    const cut=[lo,hi];
    for(const other of rects){
     const oLo=vertical?other.y:other.x,oHi=vertical?other.y+other.h:other.x+other.w;
     if(oLo>lo+EPS&&oLo<hi-EPS)cut.push(oLo);
     if(oHi>lo+EPS&&oHi<hi-EPS)cut.push(oHi);
    }
    cut.sort((a,b)=>a-b);
    for(let i=1;i<cut.length;i++){
     const one=cut[i-1],two=cut[i],mid=(one+two)/2;
     if(two-one<=EPS)continue;
     // Solo ocultar el borde si el exterior de este tramo está cubierto por otro.
     const n=.00005;
     const x=vertical?fixed+(side==='left'?-n:n):mid;
     const y=vertical?mid:fixed+(side==='top'?-n:n);
     if(contains(x,y))continue;
     edges.push(vertical?{a:{x:fixed,y:one},b:{x:fixed,y:two}}:
      {a:{x:one,y:fixed},b:{x:two,y:fixed}});
    }
   }
  }
  return edges;
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
