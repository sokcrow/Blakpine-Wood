/* Azoteas derivadas de las losas del perímetro rojo; coordenadas en tiles. */
(function(root,factory){
 const api=factory();
 if(root)root.FHRoof=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const EPS=1e-7;
 const DEFAULTS=Object.freeze({enabled:true,parapetHeightTiles:.25,
  floor:Object.freeze({preset:'concreto',color:'#969995',pattern:null}),
  wall:Object.freeze({preset:'ladrillo',color:'#A34D43',pattern:null})});
 const floors=['madera','baldosa','concreto','alfombra','azulejo','asfalto','callejon','banqueta','grava','adoquin','pasto','tierra'];
 const walls=['ladrillo','concreto','estuco','metal-corrugado','pintura-lisa','tapiz','lambrin','azulejo'];
 function finish(value,fallback,allowed){
  return {preset:allowed.includes(value?.preset)?value.preset:fallback.preset,
   color:/^#[\da-f]{6}$/i.test(value?.color)?value.color.toUpperCase():fallback.color,
   pattern:typeof value?.pattern==='string'&&/^[\w-]{1,48}$/.test(value.pattern)?value.pattern:null};
 }
 function settings(value){
  const height=value?.parapetHeightTiles;
  return {enabled:value?.enabled!==false,
   parapetHeightTiles:typeof height==='number'&&Number.isFinite(height)?Math.max(0,Math.min(2,height)):.25,
   floor:finish(value?.floor,DEFAULTS.floor,floors),wall:finish(value?.wall,DEFAULTS.wall,walls)};
 }
 const valid=r=>r&&['x','y','w','h'].every(k=>Number.isFinite(r[k]))&&r.w>EPS&&r.h>EPS;
 const contains=(spans,x,y)=>spans.some(r=>x>r.x-EPS&&x<r.x+r.w+EPS&&y>r.y-EPS&&y<r.y+r.h+EPS);
 function subtract(rect,cut){
  const x=Math.max(rect.x,cut.x),y=Math.max(rect.y,cut.y),
   right=Math.min(rect.x+rect.w,cut.x+cut.w),bottom=Math.min(rect.y+rect.h,cut.y+cut.h);
  if(right-x<=EPS||bottom-y<=EPS)return [rect];
  return [{x:rect.x,y:rect.y,w:rect.w,h:y-rect.y},
   {x:rect.x,y:bottom,w:rect.w,h:rect.y+rect.h-bottom},
   {x:rect.x,y,w:x-rect.x,h:bottom-y},
   {x:right,y,w:rect.x+rect.w-right,h:bottom-y}].filter(valid);
 }
 function difference(spans,cuts){
  let out=spans.filter(valid).map(r=>({x:r.x,y:r.y,w:r.w,h:r.h}));
  for(const cut of cuts.filter(valid))out=out.flatMap(r=>subtract(r,cut));
  return out;
 }
 // Cancela bordes compartidos, incluso cuando un rectángulo termina a mitad
 // del siguiente. No crea pretiles en las uniones entre spans de la losa.
 function boundary(spans){
  const lines=new Map();
  const add=(axis,pos,start,end,sign)=>{
   const key=axis+':'+pos.toFixed(6);
   if(!lines.has(key))lines.set(key,{axis,pos,events:[]});
   lines.get(key).events.push([start,sign],[end,-sign]);
  };
  for(const r of spans.filter(valid)){
   add('x',r.y,r.x,r.x+r.w,1);add('x',r.y+r.h,r.x,r.x+r.w,-1);
   add('y',r.x,r.y,r.y+r.h,1);add('y',r.x+r.w,r.y,r.y+r.h,-1);
  }
  const result=[];
  for(const {axis,pos,events} of lines.values()){
   events.sort((a,b)=>a[0]-b[0]);let count=0,last=null;
   for(let i=0;i<events.length;){
    const at=events[i][0];
    if(last!==null&&at-last>EPS&&count!==0)result.push(axis==='x'?
     {a:{x:last,y:pos},b:{x:at,y:pos}}:{a:{x:pos,y:last},b:{x:pos,y:at}});
    while(i<events.length&&Math.abs(events[i][0]-at)<EPS)count+=events[i++][1];
    last=at;
   }
  }
  return result;
 }
 // La losa inferior da soporte; sólo el contorno rojo cerrado ARRIBA
 // separa interior de azotea. Habitaciones y rellenos no participan.
 function partition(slab,upperOutline){
  const supported=slab?.enabled?(slab.spans||[]).filter(valid):[];
  const enclosed=upperOutline?.enabled?(upperOutline.spans||[]).filter(valid):[];
  const spans=difference(supported,enclosed);
  return {spans,interiorSpans:difference(supported,spans)};
 }
 function plan(slab,upperOutline,value){
  if(value?.enabled===false||!slab?.enabled)return null;
  const config=settings(value),cover=upperOutline?.enabled?(upperOutline.spans||[]).filter(valid):[];
  const {spans,interiorSpans}=partition(slab,upperOutline);
  // Un encuentro con el edificio superior no necesita un segundo muro bajo.
  const edges=boundary(spans).filter(e=>{
   const x=(e.a.x+e.b.x)/2,y=(e.a.y+e.b.y)/2,d=.0001;
   return !contains(cover,x+d,y+d)&&!contains(cover,x-d,y-d);
  });
  return {...config,spans,interiorSpans,edges};
 }
 function plans(data,slabs){
  const main=Math.max(0,data.floors.findIndex(f=>f.id===data.mainFloorId));
  return data.floors.map((f,i)=>i<=main?null:plan(slabs[i],data.roofSlabsByFloor?.[i]||slabs[i+1],data.floors[i-1]?.roof));
 }
 // Sólo el mapa recibido por el motor obtiene la tapa final. No se añaden
 // pisos al editor ni al archivo del creador. La ausencia de roof usa defaults.
 function prepareRuntime(data,label){
  const last=data.floors.length-1,source=data.floors[last],cap=data.roofSlabsByFloor?.[last];
  const main=Math.max(0,data.floors.findIndex(f=>f.id===data.mainFloorId));
  if(source.__fhRoofCap||last<main||source.roof?.enabled===false||!cap?.enabled||!cap.spans?.length)return data;
  let id=source.id+'_roof';while(data.floors.some(f=>f.id===id))id+='_';
  data.floors.push({id,name:label,elevationFt:source.elevationFt+source.ceilingHeightFt,
   ceilingHeightFt:source.ceilingHeightFt,lightingManual:true,items:[],__fhRoofCap:true});
  data.slabsByLevel??=[];data.slabsByLevel[last]=cap;
  return data;
 }
 return Object.freeze({DEFAULTS,settings,difference,boundary,partition,plan,plans,prepareRuntime});
});
