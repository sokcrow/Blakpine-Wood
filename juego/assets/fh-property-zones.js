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
 return Object.freeze({rectangle,polygon,inside,intersectionArea,conflicts,at,doorAt,create,counts});
});
