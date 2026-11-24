/* Azoteas derivadas de las losas del perímetro rojo; coordenadas en tiles. */
(function(root,factory){
 const api=factory();
 if(root)root.FHRoof=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const EPS=1e-7;
 const DEFAULTS=Object.freeze({enabled:true,shape:'flat',ridgeAxis:'auto',riseFt:4,
  coverColor:'#A45B46',parapetHeightTiles:.25,
  floor:Object.freeze({preset:'concreto',color:'#969995',pattern:null}),
  wall:Object.freeze({preset:'ladrillo',color:'#A34D43',pattern:null})});
 const floors=['madera','baldosa','concreto','alfombra','azulejo','asfalto','callejon','banqueta','grava','adoquin','pasto','tierra'];
 const walls=['ladrillo','concreto','estuco','metal-corrugado','pintura-lisa','tapiz','lambrin','azulejo'];
 function finish(value,fallback,allowed){
  return {preset:allowed.includes(value?.preset)?value.preset:fallback.preset,
   color:/^#[\da-f]{6}$/i.test(value?.color)?value.color.toUpperCase():fallback.color,
   pattern:typeof value?.pattern==='string'&&/^[\w-]{1,48}$/.test(value.pattern)?value.pattern:null};
 }
 function settings(value,rulesetId='legacy'){
  const height=value?.parapetHeightTiles;
  return {enabled:value?.enabled!==false,
   shape:['flat','gable','auto'].includes(value?.shape)?value.shape:rulesetId==='dnd'?'auto':'flat',
   ridgeAxis:['x','z'].includes(value?.ridgeAxis)?value.ridgeAxis:'auto',
   riseFt:Number.isFinite(value?.riseFt)?Math.max(1,Math.min(30,value.riseFt)):4,
   coverColor:/^#[\da-f]{6}$/i.test(value?.coverColor)?value.coverColor.toUpperCase():DEFAULTS.coverColor,
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
 // Separar casas por contacto de arista; un contacto sólo de esquina no
 // une dos viviendas. Sólo se consulta al resolver una cubierta automática.
 function roofComponents(spans){
  const pending=new Set(spans.filter(valid)),result=[];
  const touches=(a,b)=>{
   const x=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x);
   const y=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
   return x>=-EPS&&y>=-EPS&&(x>EPS||y>EPS);
  };
  while(pending.size){
   const first=pending.values().next().value,group=[first];pending.delete(first);
   for(let i=0;i<group.length;i++)for(const other of pending)
    if(touches(group[i],other)){group.push(other);pending.delete(other);}
   result.push(group);
  }
  return result;
 }
 function roofEdges(spans,cover){
  return boundary(spans).filter(e=>{
   const x=(e.a.x+e.b.x)/2,y=(e.a.y+e.b.y)/2,d=.0001;
   return !contains(cover,x+d,y+d)&&!contains(cover,x-d,y-d);
  });
 }
 function rectangularCover(spans){
  if(!spans.length)return spans;
  let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity,area=0;
  for(const r of spans){x=Math.min(x,r.x);y=Math.min(y,r.y);
   right=Math.max(right,r.x+r.w);bottom=Math.max(bottom,r.y+r.h);area+=r.w*r.h;}
  const w=right-x,h=bottom-y;
  // Las losas son rectángulos sin solapamiento. Unificar sólo si no quedan
  // huecos: un patio o una planta en L conserva sus rectángulos originales.
  return Math.abs(w*h-area)<=EPS?[{x,y,w,h}]:spans;
 }
 function plan(slab,upperOutline,value,{rulesetId='legacy'}={}){
  if(value?.enabled===false||!slab?.enabled)return null;
  const config=settings(value,rulesetId),cover=upperOutline?.enabled?(upperOutline.spans||[]).filter(valid):[];
  const {spans,interiorSpans}=partition(slab,upperOutline);
  const edges=roofEdges(spans,cover);
  if(config.shape!=='auto')return {...config,spans,interiorSpans,edges};
  if(rulesetId!=='dnd')return {...config,shape:'flat',spans,interiorSpans,edges};
  const sections=roofComponents(slab.spans||[]).map(component=>{
   const exposed=difference(component,cover);
   // Si esta casa continúa arriba, el retranqueo es terraza/balcón plano.
   // Una casa vecina de una sola planta conserva su propio tejado a dos aguas.
   const upstairs=component.some(a=>cover.some(b=>
    Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>EPS&&
    Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>EPS));
   const surface=upstairs?exposed:rectangularCover(exposed);
   return {...config,shape:upstairs?'flat':'gable',spans:surface,
    edges:roofEdges(surface,cover)};
  }).filter(part=>part.spans.length);
  return {...config,spans,interiorSpans,edges,sections};
 }
 function plans(data,slabs){
  const main=Math.max(0,data.floors.findIndex(f=>f.id===data.mainFloorId));
  const rulesetId=data.__multimodeSave?.identity?.rulesetId||'legacy';
  return data.floors.map((f,i)=>i<=main?null:plan(slabs[i],data.roofSlabsByFloor?.[i]||slabs[i+1],data.floors[i-1]?.roof,{rulesetId}));
 }
 // Volúmenes a dos aguas: dos planos inclinados y dos tímpanos triangulares.
 // Pies -> metros en vertical; x/z mantienen exactamente la escala del motor.
 function gableTriangles(rect,config,cell=1.524,base=.021){
  if(!valid(rect)||!Number.isFinite(cell)||cell<=0)throw Error('ROOF_GABLE_DIMENSIONS');
  const roof=settings(config),axis=roof.ridgeAxis==='auto'?(rect.w>=rect.h?'x':'z'):roof.ridgeAxis;
  const eave=.14*cell;
  const x0=rect.x*cell-eave,x1=(rect.x+rect.w)*cell+eave;
  const z0=rect.y*cell-eave,z1=(rect.y+rect.h)*cell+eave;
  const xm=(x0+x1)/2,zm=(z0+z1)/2,rise=roof.riseFt*.3048,peak=base+rise;
  const positions=[],uvs=[],groups=[];
  function tri(a,b,c,uv,group){
   const start=positions.length/3;
   for(const p of [a,b,c])positions.push(...p);
   for(const q of uv)uvs.push(...q);
   groups.push({start,count:3,materialIndex:group});
  }
  function quad(a,b,c,d,width,depth){
   const u=width/.42,v=depth/.36;
   tri(a,c,b,[[0,0],[u,v],[u,0]],0);
   tri(a,d,c,[[0,0],[0,v],[u,v]],0);
  }
  if(axis==='x'){
   const slope=Math.hypot((z1-z0)/2,rise),length=x1-x0;
   quad([x0,base,z0],[x1,base,z0],[x1,peak,zm],[x0,peak,zm],length,slope);
   quad([x1,base,z1],[x0,base,z1],[x0,peak,zm],[x1,peak,zm],length,slope);
   tri([x0,base,z1],[x0,peak,zm],[x0,base,z0],[[0,0],[.5,1],[1,0]],1);
   tri([x1,base,z0],[x1,peak,zm],[x1,base,z1],[[0,0],[.5,1],[1,0]],1);
  }else{
   const slope=Math.hypot((x1-x0)/2,rise),length=z1-z0;
   quad([x0,base,z1],[x0,base,z0],[xm,peak,z0],[xm,peak,z1],length,slope);
   quad([x1,base,z0],[x1,base,z1],[xm,peak,z1],[xm,peak,z0],length,slope);
   tri([x0,base,z0],[xm,peak,z0],[x1,base,z0],[[0,0],[.5,1],[1,0]],1);
   tri([x1,base,z1],[xm,peak,z1],[x0,base,z1],[[0,0],[.5,1],[1,0]],1);
  }
  return {positions,uvs,groups,axis,peak};
 }
 function gableGeometry(THREE,rect,config,cell,base){
  const data=gableTriangles(rect,config,cell,base);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(data.uvs,2));
  for(const group of data.groups)geometry.addGroup(group.start,group.count,group.materialIndex);
  geometry.computeVertexNormals();return geometry;
 }
 function gableMaterials(THREE,config,doc){
  const roof=settings(config);
  const wall=new THREE.MeshLambertMaterial({color:roof.wall.color,side:THREE.DoubleSide});
  const canvas=doc?.createElement?.('canvas');
  if(!canvas)return [new THREE.MeshLambertMaterial({color:roof.coverColor,side:THREE.DoubleSide}),wall];
  canvas.width=32;canvas.height=32;
  const ctx=canvas.getContext('2d');
  if(!ctx)return [new THREE.MeshLambertMaterial({color:roof.coverColor,side:THREE.DoubleSide}),wall];
  const base=roof.coverColor;
  ctx.fillStyle=base;ctx.fillRect(0,0,32,32);
  // Tejas pixeladas en hileras desplazadas. Textura compartida por toda la planta.
  for(let row=0;row<4;row++)for(let col=-1;col<5;col++){
   const x=col*8+(row%2)*4,y=row*8;
   ctx.fillStyle=(row+col)%3===0?'#6F4035':(row+col)%3===1?'#B87354':base;
   ctx.fillRect(x+1,y+1,7,6);
   ctx.fillStyle='#3C302D';ctx.fillRect(x,y,8,1);
  }
  const tex=new THREE.CanvasTexture(canvas);
  tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.NearestMipmapNearestFilter;
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  return [new THREE.MeshLambertMaterial({map:tex,side:THREE.DoubleSide}),wall];
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
 return Object.freeze({DEFAULTS,settings,difference,boundary,partition,plan,plans,
  gableTriangles,gableGeometry,gableMaterials,prepareRuntime});
});
