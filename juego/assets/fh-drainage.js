/* Blakpine-Wood · Drenajes transitables, piezas de mapa y topología v1.
 * Sin nuevas dependencias. No modifica la red de agua potable.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHDrainage=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // 'small' es el alias estable usado por los mapas anteriores (recta secundaria).
 const SIZES=Object.freeze({straight:10,elbow:10,tee:10,cross:10,dead_end:10,
  small:4,small_elbow:4,small_tee:4,small_cross:4,small_dead_end:4,outfall:20});
 const BASE_PORTS=Object.freeze({
  straight:['e','w'],elbow:['n','e'],tee:['n','e','w'],cross:['n','e','s','w'],dead_end:['e'],
  small:['e','w'],small_elbow:['n','e'],small_tee:['n','e','w'],
  small_cross:['n','e','s','w'],small_dead_end:['e'],outfall:['n','e','s','w']
 });
 const SIDE=['n','e','s','w'],OPPOSITE={n:'s',e:'w',s:'n',w:'e'};
 // Alturas relativas al tile: superficie -0.2, fondo -0.42, flotación ligera.
 const WATER_LEVEL=-.2,CHANNEL_BOTTOM=-.42;
 const safe=n=>Number.isFinite(Number(n))?Number(n):0;
 const round=n=>Math.round(n*10000)/10000;
 const isSection=it=>!!it&&it.type==='hall'&&!!it.drainage&&Object.hasOwn(SIZES,it.drainage.kind);
 const isBridge=it=>!!it&&it.type==='concrete'&&it.drainageBridge?.version===1;
 const pieces=items=>(items||[]).filter(isSection);
 const degrees=n=>((Math.round(safe(n)/90)*90)%360+360)%360;
 function ports(it){
  const steps=degrees(it.rotation)/90;
  return BASE_PORTS[it.drainage.kind].map(d=>SIDE[(SIDE.indexOf(d)+steps)%4]);
 }
 function makeSection(kind,at,units,id,rotation=0){
  if(!Object.hasOwn(SIZES,kind))throw Error('Pieza de drenaje desconocida');
  const size=SIZES[kind],x=Math.floor(safe(at.x)-size/2),y=Math.floor(safe(at.y)-size/2);
  const it={id,type:'hall',x,y,w:size,h:size,rotation:degrees(rotation),heightFt:0,
   blocksMovement:false,label:kind==='outfall'?'Desagüe principal':size===4?'Conducto secundario':'Drenaje principal',
   drainage:{version:1,kind,flowTo:null}};
  validate(it,units);return it;
 }
 function makeBridge(at,units,id,horizontal=false){
  const w=horizontal?6:2,h=horizontal?2:6;
  const it={id,type:'concrete',x:Math.floor(safe(at.x)-w/2),y:Math.floor(safe(at.y)-h/2),w,h,rotation:0,
   heightFt:0,blocksMovement:false,label:'Puente de reja',drainageBridge:{version:1}};
  validate(it,units);return it;
 }
 function validate(it,units){
  if(!isSection(it)&&!isBridge(it))throw Error('Elemento de drenaje inválido');
  if(![it.x,it.y,it.w,it.h,it.rotation].every(Number.isFinite))throw Error('Coordenadas de drenaje inválidas');
  if(it.x<0||it.y<0||it.x+it.w>(units?.columns||120)||it.y+it.h>(units?.rows||120))throw Error('La pieza no cabe en el mapa');
  if(it.blocksMovement!==false)throw Error('El drenaje no debe bloquear toda la superficie');
  if(isSection(it)&&(it.w!==SIZES[it.drainage.kind]||it.h!==it.w||degrees(it.rotation)!==it.rotation||it.drainage.version!==1))
   throw Error('Tamaño, orientación o versión de drenaje incorrectos');
  if(isBridge(it)&&!((it.w===2&&it.h===6)||(it.w===6&&it.h===2)))throw Error('Dimensiones del puente inválidas');
  return true;
 }
 function validateProject(project){
  for(const floor of project?.floors||[])for(const it of floor.items||[])if(isSection(it)||isBridge(it))validate(it,project.units);
  return true;
 }
 function rects(it){
  const size=SIZES[it.drainage.kind],kind=it.drainage.kind;
  if(kind==='outfall')return [{x:it.x+8,y:it.y,w:4,h:20},{x:it.x,y:it.y+8,w:20,h:4}];
  const small=size===4,width=small?1:4,half=size/2,lo=half-width/2;
  const shape=kind.replace(/^small(?:_)?/,'')||'straight';
  const base=shape==='straight'?[{x:0,y:lo,w:size,h:width}]:
   shape==='elbow'?[{x:lo,y:0,w:width,h:half},{x:half,y:lo,w:half,h:width}]:
   shape==='dead_end'?[{x:lo,y:lo,w:size-lo,h:width}]:
   shape==='tee'?[{x:0,y:lo,w:size,h:width},{x:lo,y:0,w:width,h:half}]:
   [{x:0,y:lo,w:size,h:width},{x:lo,y:0,w:width,h:size}];
  const steps=degrees(it.rotation)/90;
  return base.map(r=>{let q={...r};for(let i=0;i<steps;i++)q={x:size-q.y-q.h,y:q.x,w:q.h,h:q.w};
   return {x:it.x+q.x,y:it.y+q.y,w:q.w,h:q.h};});
 }
 // Una única descripción de canales sirve para el suelo, el agua y la colisión del jugador.
 function channelRects(it){
  const out=rects(it);
  if(it.drainage.kind!=='outfall')return out.reduce((all,r)=>all.concat(carve([r],all)),[]);
  const c=center(it);
  for(let y=it.y+3;y<it.y+17;y++){
   let start=null;
   for(let x=it.x+3;x<=it.x+17;x++){
    const wet=x<it.x+17&&Math.hypot(x+.5-c.x,y+.5-c.y)<=7;
    if(wet&&start===null)start=x;
    if(!wet&&start!==null){out.push({x:start,y,w:x-start,h:1});start=null;}
   }
  }
  return out.reduce((all,r)=>all.concat(carve([r],all)),[]);
 }
 function subtractRect(base,cut){
  const x=Math.max(base.x,cut.x),y=Math.max(base.y,cut.y);
  const right=Math.min(base.x+base.w,cut.x+cut.w),bottom=Math.min(base.y+base.h,cut.y+cut.h);
  if(right<=x||bottom<=y)return [base];
  const out=[];
  if(y>base.y)out.push({x:base.x,y:base.y,w:base.w,h:y-base.y});
  if(bottom<base.y+base.h)out.push({x:base.x,y:bottom,w:base.w,h:base.y+base.h-bottom});
  if(x>base.x)out.push({x:base.x,y,w:x-base.x,h:bottom-y});
  if(right<base.x+base.w)out.push({x:right,y,w:base.x+base.w-right,h:bottom-y});
  return out;
 }
 function carve(rectangles,cuts){
  let remaining=rectangles;
  for(const cut of cuts)remaining=remaining.flatMap(rect=>subtractRect(rect,cut));
  return remaining;
 }
 // El motor carga un mapa inmutable por partida: cachear cortes evita recalcular
 // cientos de rectángulos al construir suelos, habitaciones y losas por planta.
 // El editor mantiene la ruta sin caché para reflejar modificaciones en vivo.
 const cachedFloorCuts=new WeakMap();
 function cutFloorRects(project,floorIndex,rectangles,useRuntimeCache=false){
  const floor=project?.floors?.[floorIndex];
  if(!floor||!Array.isArray(rectangles)||!rectangles.length)return rectangles||[];
  let channels;
  const cached=useRuntimeCache?cachedFloorCuts.get(floor):null;
  if(cached&&cached.items===floor.items)channels=cached.channels;
  else {
   channels=pieces(floor.items).flatMap(channelRects);
   if(useRuntimeCache)cachedFloorCuts.set(floor,{items:floor.items,channels});
  }
  if(!channels.length)return rectangles;
  const relevant=channels.filter(cut=>rectangles.some(r=>
   cut.x<r.x+r.w&&cut.x+cut.w>r.x&&cut.y<r.y+r.h&&cut.y+cut.h>r.y));
  return relevant.length?carve(rectangles,relevant):rectangles;
 }
 function touches(a,b){
  const A=ports(a),B=ports(b),eps=.001;
  for(const side of A){
   if(!B.includes(OPPOSITE[side]))continue;
   const adjacent=side==='e'?Math.abs(a.x+a.w-b.x)<eps:
    side==='w'?Math.abs(b.x+b.w-a.x)<eps:
    side==='s'?Math.abs(a.y+a.h-b.y)<eps:Math.abs(b.y+b.h-a.y)<eps;
   if(!adjacent)continue;
   const widthA=SIZES[a.drainage.kind]===4?1:4,widthB=SIZES[b.drainage.kind]===4?1:4;
   const middleA=(side==='e'||side==='w')?a.y+a.h/2:a.x+a.w/2;
   const middleB=(side==='e'||side==='w')?b.y+b.h/2:b.x+b.w/2;
   const shared=Math.max(0,Math.min(middleA+widthA/2,middleB+widthB/2)-
     Math.max(middleA-widthA/2,middleB-widthB/2));
   // Una salida geométrica no conecta si los canales de agua no coinciden.
   if(shared>=Math.min(widthA,widthB)*.95)return true;
  }
  return false;
 }
 function topology(project){
  const nodes=[];
  (project?.floors||[]).forEach((floor,floorIndex)=>(floor.items||[]).forEach(item=>{
   if(isSection(item))nodes.push({floorIndex,item,id:String(floor.id)+':'+String(item.id)});
  }));
  const links=new Map(nodes.map(n=>[n.id,[]])),warnings=[];
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
   const a=nodes[i],b=nodes[j];
   if(a.floorIndex!==b.floorIndex||!touches(a.item,b.item))continue;
   links.get(a.id).push(b.id);links.get(b.id).push(a.id);
  }
  for(const n of nodes){
   const dest=n.item.drainage.flowTo;
   if(dest!=null&&dest!==''&&!links.get(n.id).some(id=>nodes.find(x=>x.id===id)?.item.id===dest))
    warnings.push({code:'flowToInvalid',floorIndex:n.floorIndex,itemId:n.item.id});
   if(n.item.drainage.kind!=='outfall'&&!links.get(n.id).length)
    warnings.push({code:'isolated',floorIndex:n.floorIndex,itemId:n.item.id});
  }
  return {nodes,links,warnings};
 }
 function downstream(project,floorIndex,itemId,graph=topology(project)){
  const source=graph.nodes.find(n=>n.floorIndex===floorIndex&&String(n.item.id)===String(itemId));
  if(!source)return null;
  const direct=source.item.drainage.flowTo;
  if(direct!=null&&direct!==''){
   const linked=graph.links.get(source.id).map(id=>graph.nodes.find(n=>n.id===id));
   const target=linked.find(n=>String(n.item.id)===String(direct));
   if(target)return {floorIndex:target.floorIndex,itemId:target.item.id};
  }
  const queue=[[source.id,null]],visited=new Set([source.id]);
  while(queue.length){
   const [id,first]=queue.shift(),here=graph.nodes.find(n=>n.id===id);
   if(id!==source.id&&here.item.drainage.kind==='outfall'){
    const chosen=graph.nodes.find(n=>n.id===first);
    return chosen?{floorIndex:chosen.floorIndex,itemId:chosen.item.id}:null;
   }
   for(const next of graph.links.get(id)||[])if(!visited.has(next)){visited.add(next);queue.push([next,first||next]);}
  }
  return null;
 }
 function nearest(project,floorIndex,at){
  const nodes=topology(project).nodes, floors=project.floors||[];
  const currentElevation=safe(floors[floorIndex]?.elevationFt);
  return nodes.map(n=>{
   const {x,y,w,h}=n.item;
   const dx=Math.max(x-safe(at.x),0,safe(at.x)-(x+w)),dy=Math.max(y-safe(at.y),0,safe(at.y)-(y+h));
   const dz=Math.abs(safe(floors[n.floorIndex]?.elevationFt)-currentElevation)/Math.max(.1,safe(project.units?.feetPerCell)||5);
   return {floorIndex:n.floorIndex,itemId:n.item.id,distance:Math.hypot(dx,dy,dz)};
  }).sort((a,b)=>a.distance-b.distance||String(a.itemId).localeCompare(String(b.itemId)))[0]||null;
 }
 function weatherState(it,rain=0){
  const intensity=Math.max(0,Math.min(1,safe(rain)));
  const small=!!it?.drainage&&SIZES[it.drainage.kind]===4;
  return {flooded:small&&intensity>0,waterWidth:small?(intensity>0?4:1):4,
   currentFactor:1+intensity,walkingFactor:small&&intensity>0?.5:1};
 }
 function randomExit(project,fromFloorIndex,fromItemId,rng=Math.random){
  const candidates=topology(project).nodes.filter(n=>!(n.floorIndex===fromFloorIndex&&String(n.item.id)===String(fromItemId)));
  if(!candidates.length)return null;
  const value=Math.max(0,Math.min(.999999999,Number(rng())||0)),choice=candidates[Math.floor(value*candidates.length)];
  // Una zona de paseo, nunca el agujero ni un canal de corriente.
  const item=choice.item;
  return {floorIndex:choice.floorIndex,itemId:item.id,x:round(item.x+1),y:round(item.y+1)};
 }
 // Componentes de arquitectura nativos: los mismos 'room', 'wall' y 'opening'
 // que procesa buildFloor(). Solo se expanden en el motor, no en el JSON guardado.
 function nativeComponents(it,neighbors=[],surroundings=[]){
  if(!isSection(it))return [];
  const {x,y,w,h,id}=it,open=new Set(ports(it)),eps=.001;
  const parts=[{id:'fh_drain_room_'+id,type:'room',x,y,w,h,
   roomId:'fh_drain_room_'+id,label:it.label||'',zoneId:it.zoneId||'main',
   spans:carve([{x,y,w,h}],channelRects(it)),
   autoGenerated:true,drainageGenerated:true,drainageOwnerId:id,blocksMovement:false}];
  const point=(side,along)=>side==='n'?{x:x+along,y}:
   side==='s'?{x:x+along,y:y+h}:side==='w'?{x,y:y+along}:{x:x+w,y:y+along};
  for(const side of SIDE){
   const len=(side==='n'||side==='s')?w:h;
   const push=(type,lo,hi,index)=>{
    if(hi-lo<eps)return;
    // Los segmentos ya construidos (pared, ventana, puerta o hueco) mandan.
    // Nunca superponemos otro collider ni rellenamos el vano de una puerta.
    const horizontal=side==='n'||side==='s',at=horizontal?(side==='n'?y:y+h):(side==='w'?x:x+w);
    let free=[[lo,hi]];
    for(const authored of surroundings){
     if(!['wall','red_wall','property_wall','half_wall','fence','window','door','peephole_door','opening'].includes(authored?.type)||!authored.a||!authored.b)continue;
     const a=authored.a,b=authored.b;
     if(horizontal){
      if(Math.abs(a.y-at)>eps||Math.abs(b.y-at)>eps)continue;
     }else if(Math.abs(a.x-at)>eps||Math.abs(b.x-at)>eps)continue;
     const p=(horizontal?Math.min(a.x,b.x):Math.min(a.y,b.y))-(horizontal?x:y);
     const q=(horizontal?Math.max(a.x,b.x):Math.max(a.y,b.y))-(horizontal?x:y);
     free=free.flatMap(([start,end])=>start>=q-eps||end<=p+eps?[[start,end]]:
      [[start,Math.max(start,p)],[Math.min(end,q),end]].filter(pair=>pair[1]-pair[0]>eps));
    }
    let n=0;
    for(const [start,end] of free)parts.push({id:'fh_drain_'+id+'_'+side+'_'+index+'_'+n++,type,
     a:point(side,start),b:point(side,end),
     heightFt:it.heightFt>0?it.heightFt:9,blocksMovement:type==='wall',
     drainageGenerated:true,drainageOwnerId:id});
   };
   if(!open.has(side)){push('wall',0,len,0);continue;}
   const candidate=neighbors.filter(peer=>{
    if(!isSection(peer)||!ports(peer).includes(OPPOSITE[side])||!touches(it,peer))return false;
    if(side==='n')return Math.abs(peer.y+peer.h-y)<eps;
    if(side==='s')return Math.abs(y+h-peer.y)<eps;
    if(side==='w')return Math.abs(peer.x+peer.w-x)<eps;
    return Math.abs(x+w-peer.x)<eps;
   });
   const start=(side==='n'||side==='s')?x:y;
   const ranges=candidate.length?candidate.map(peer=>{
    const p=(side==='n'||side==='s')?peer.x:peer.y,pLen=(side==='n'||side==='s')?peer.w:peer.h;
    return [Math.max(0,p-start),Math.min(len,p+pLen-start)];
   }).filter(([lo,hi])=>hi-lo>=eps).sort((a,b)=>a[0]-b[0]):[[0,len]];
   let last=0,k=0;
   for(const [lo,hi] of ranges){
    if(hi<=last+eps)continue;
    if(lo>last+eps)push('wall',last,lo,k++);
    push('opening',Math.max(last,lo),hi,k++);last=hi;
   }
   if(last<len-eps)push('wall',last,len,k++);
  }
  return parts;
 }
 function expandProject(project){
  if(!project||!Array.isArray(project.floors))return project;
  for(const floor of project.floors){
   const authored=(floor.items||[]).filter(it=>it.drainageGenerated!==true);
   const sections=authored.filter(isSection);
   const generated=sections.flatMap(it=>nativeComponents(it,sections.filter(peer=>peer!==it&&touches(it,peer)),authored));
   floor.items=generated.length?[...authored,...generated]:authored;
  }
  return project;
 }
 // Estado de contacto real con agua. La geometría es de casillas; el motor
 // conserva la responsabilidad exclusiva de resolver colisiones con muros.
 const within=(r,p)=>p.x>=r.x&&p.y>=r.y&&p.x<r.x+r.w&&p.y<r.y+r.h;
 const center=it=>({x:it.x+it.w/2,y:it.y+it.h/2});
 function sectionAt(project,floorIndex,point){
  return (project?.floors?.[floorIndex]?.items||[]).find(it=>isSection(it)&&within(it,point))||null;
 }
 function bridgeAt(project,floorIndex,point){
  return (project?.floors?.[floorIndex]?.items||[]).some(it=>isBridge(it)&&within(it,point));
 }
 function waterAt(project,floorIndex,point,rain=0){
  const item=sectionAt(project,floorIndex,point);
  if(!item||bridgeAt(project,floorIndex,point))return null;
  const state=weatherState(item,rain),c=center(item),dx=point.x-c.x,dy=point.y-c.y;
  const wet=state.flooded||(item.drainage.kind==='outfall'&&Math.hypot(dx,dy)<=7)||
   rects(item).some(r=>within(r,point));
  return wet?{item,state}:null;
 }
 function walkFactor(project,floorIndex,point,rain=0){
  const contact=waterAt(project,floorIndex,point,rain);
  return contact?.state.walkingFactor??1;
 }
 // La corriente sigue el eje real de la rama hasta llegar al nodo de la T.
 function flowDirection(it,point,next){
  if(!next)return {x:0,y:0};
  const side=ports(it).find(s=>ports(next).includes(OPPOSITE[s])&&
   (s==='e'?Math.abs(it.x+it.w-next.x)<.001:
    s==='w'?Math.abs(next.x+next.w-it.x)<.001:
    s==='s'?Math.abs(it.y+it.h-next.y)<.001:Math.abs(next.y+next.h-it.y)<.001));
  if(!side)return {x:0,y:0};
  const direction={n:{x:0,y:-1},e:{x:1,y:0},s:{x:0,y:1},w:{x:-1,y:0}};
  const c=center(it),width=SIZES[it.drainage.kind]===4?1:4;
  const incoming=ports(it).filter(s=>s!==side).map(s=>{
   const d=direction[s],along=(point.x-c.x)*d.x+(point.y-c.y)*d.y;
   const across=Math.abs((point.x-c.x)*d.y-(point.y-c.y)*d.x);
   return {side:s,along,across};
  }).filter(entry=>entry.along>width*.4&&entry.across<=width*.55)
   .sort((a,b)=>b.along-a.along)[0];
  return incoming?direction[OPPOSITE[incoming.side]]:direction[side];
 }
 function currentAt(project,floorIndex,point,rain=0,target){
  const contact=waterAt(project,floorIndex,point,rain);
  if(!contact)return null;
  const {item,state}=contact,c=center(item);
  if(item.drainage.kind==='outfall'){
   const dx=c.x-point.x,dy=c.y-point.y,d=Math.hypot(dx,dy);
   return {itemId:item.id,x:d>.01?dx/d:0,y:d>.01?dy/d:0,
    speed:(.16+.65*Math.max(0,Math.min(1,safe(rain))))*state.currentFactor};
  }
  const downstreamRef=target===undefined?downstream(project,floorIndex,item.id):target;
  const next=downstreamRef&&(project?.floors?.[downstreamRef.floorIndex]?.items||[])
   .find(it=>String(it.id)===String(downstreamRef.itemId));
  const vector=flowDirection(item,point,next);
  return {itemId:item.id,x:vector.x,y:vector.y,
   speed:next?(.12+.42*Math.max(0,Math.min(1,safe(rain))))*state.currentFactor:0};
 }
 function depthAt(project,floorIndex,point,seconds=0){
  // Desnivel jugable ligero: el agua sostiene al personaje sin usar fluidos reales.
  return waterAt(project,floorIndex,point,0)?WATER_LEVEL-.045+.012*Math.sin(safe(seconds)*1.8):0;
 }
 function whirlpoolAt(project,floorIndex,point){
  const item=sectionAt(project,floorIndex,point);
  if(!item||item.drainage.kind!=='outfall'||bridgeAt(project,floorIndex,point))return null;
  const c=center(item);
  return Math.hypot(point.x-c.x,point.y-c.y)<=2.4?item:null;
 }
 // Su bucle nunca modifica la posición directamente: move() delega en walk()
 // del motor, que aplica blockers/doors/canWalk y evita atravesar paredes.
 function createRuntime({project,position,move,teleport}={}){
  let cooldown=0,elapsed=0;
  const cachedRoutes=new Map();
  function route(f,it){
   const key=f+':'+it.id;
   if(!cachedRoutes.has(key))cachedRoutes.set(key,downstream(project,f,it.id));
   return cachedRoutes.get(key);
  }
  function update(dt,weather){
   const delta=Math.max(0,Math.min(.075,safe(dt)));
   const rain=weather?.phase==='lluvia'?Math.max(0,Math.min(1,safe(weather?.intensity))):0;
   updateVisuals(delta,rain,position?.()?.floorIndex);
   cooldown=Math.max(0,cooldown-delta);elapsed+=delta;
   if(!delta||!position)return null;
   const p=position(),f=p.floorIndex,point={x:p.x,y:p.y};
   const hole=whirlpoolAt(project,f,point);
   if(hole&&!cooldown){
    const exit=randomExit(project,f,hole.id);
    if(exit&&typeof teleport==='function'&&teleport(exit)===true){cooldown=4;return {type:'whirlpool',exit};}
   }
   const contact=waterAt(project,f,point,rain);
   if(!contact||typeof move!=='function')return null;
   const v=currentAt(project,f,point,rain,route(f,contact.item));
   // Limita el arrastre por tick y usa la colisión del motor.
   const speed=Math.min(1.65,v.speed),deltaMove=Math.min(speed*delta,.115);
   if(!speed)return null;
   move(v.x*deltaMove,v.y*deltaMove);
   return {type:'current',itemId:v.itemId,speed};
  }
  return {update,waterAt:(f,p,rain)=>waterAt(project,f,p,rain)};
 }
 function draw2D(ctx,items,units,toPixel,gx,gy,selection){
  const drawRect=(r,color)=>{const p=toPixel(r);ctx.fillStyle=color;ctx.fillRect(p.x,p.y,r.w*gx,r.h*gy);};
  for(const it of items||[])if(isSection(it)){
   drawRect(it,'#384347');
   ctx.save();
   for(const r of rects(it))drawRect(r,'#376f80');
   if(it.drainage.kind==='outfall'){
    const p=toPixel({x:it.x+10,y:it.y+10}),radius=Math.min(gx,gy);
    ctx.beginPath();ctx.arc(p.x,p.y,7*radius,0,Math.PI*2);ctx.fillStyle='#376f80';ctx.fill();
    ctx.beginPath();ctx.arc(p.x,p.y,3*radius,0,Math.PI*2);ctx.fillStyle='#07131c';ctx.fill();
    ctx.beginPath();ctx.arc(p.x,p.y,5*radius,0,Math.PI*1.6);ctx.strokeStyle='#85b9c2';ctx.lineWidth=radius*.25;ctx.stroke();
   }
   // Vista 2D de las mismas barreras que el motor genera con wallModel.
   ctx.strokeStyle='#bdc5be';ctx.lineWidth=Math.max(1,gx*.10);
   for(const wall of nativeComponents(it,(items||[]).filter(peer=>peer!==it&&isSection(peer)&&touches(it,peer)),items))if(wall.type==='wall'){
    const a=toPixel(wall.a),b=toPixel(wall.b);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
   }
   ctx.strokeStyle=it.id===selection?'#ffe6a5':'#647477';ctx.lineWidth=it.id===selection?2:1;
   const p=toPixel(it);ctx.strokeRect(p.x,p.y,it.w*gx,it.h*gy);
   ctx.restore();
  }
  for(const it of items||[])if(isBridge(it)){
   const p=toPixel(it);ctx.save();ctx.fillStyle='#798c88';ctx.fillRect(p.x,p.y,it.w*gx,it.h*gy);
   ctx.strokeStyle='#172a30';ctx.lineWidth=Math.max(1,gx*.07);
   const count=7;
   for(let k=1;k<count;k++){const t=k/count;ctx.beginPath();
    if(it.w<it.h){ctx.moveTo(p.x,p.y+it.h*gy*t);ctx.lineTo(p.x+it.w*gx,p.y+it.h*gy*t);}
    else{ctx.moveTo(p.x+it.w*gx*t,p.y);ctx.lineTo(p.x+it.w*gx*t,p.y+it.h*gy);}
    ctx.stroke();}
   ctx.strokeStyle=it.id===selection?'#ffe6a5':'#9fb8a8';ctx.strokeRect(p.x,p.y,it.w*gx,it.h*gy);ctx.restore();
  }
 }
 // Una malla por tramo: las máscaras se calculan en vértices, no por píxel.
 // La superficie es opaca para evitar transparencia, sobrepintado y fragmentos
 // caros en equipos móviles. No hay simulación de fluidos ni texturas en CPU.
 const visuals=[];
 let sharedWater=null,visualProject=null,visualGraph=null;
 function waterMaterial(THREE,CELL){
  if(sharedWater)return sharedWater;
  const noise=[
   'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
   'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
   'return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),',
   'mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}'
  ].join('\n');
  sharedWater=new THREE.ShaderMaterial({
   transparent:false,depthWrite:true,side:THREE.FrontSide,
   uniforms:{uTime:{value:0},uRain:{value:0},uCell:{value:CELL},uWave:{value:.032*CELL}},
   vertexShader:[
    'attribute vec2 aFlow;',
    'varying float vMaskA,vMaskB;',
    'uniform float uTime,uCell,uWave,uRain;',noise,
    'void main(){',
    ' vec2 p=(modelMatrix*vec4(position,1.0)).xz/uCell;',
    ' float heightMask=noise(p*3.0+vec2(uTime*.04,uTime*.02));',
    ' vMaskA=noise(p*5.0-aFlow*uTime*(.3+.4*uRain));',
    ' vMaskB=noise(p*12.0-aFlow.yx*uTime*.21+vec2(uTime*.07,-uTime*.05));',
    ' vec3 vertex=position;vertex.z+=uWave*heightMask;',
    ' gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(vertex,1.0);',
    '}'
   ].join('\n'),
   fragmentShader:[
    'varying float vMaskA,vMaskB;',
    'void main(){',
    ' float darkness=.16+.23*vMaskA+.08*vMaskB;',
    ' vec3 deep=vec3(.009,.031,.043);',
    ' vec3 lit=vec3(.045,.15,.17);',
    ' vec3 rgb=mix(deep,lit,darkness*1.8);',
    ' float foam=smoothstep(.77,.91,vMaskA*.55+vMaskB*.45);',
    ' rgb+=foam*vec3(.07,.12,.13);',
    ' gl_FragColor=vec4(rgb,1.0);',
    '}'
   ].join('\n')
  });
  return sharedWater;
 }
 function updateVisuals(dt,rain=0,floorIndex){
  const delta=Math.max(0,Math.min(.075,safe(dt))),r=Math.max(0,Math.min(1,safe(rain)));
  if(sharedWater){sharedWater.uniforms.uTime.value+=delta;sharedWater.uniforms.uRain.value=r;}
  for(const entry of visuals){
   if(floorIndex!==undefined&&entry.floorIndex!==floorIndex)continue;
   if(entry.flood)entry.flood.visible=r>0;
   if(entry.ring&&delta)entry.ring.rotation.z+=delta*(.15+.9*r);
  }
 }
 function attachFloor(THREE,map,story,index,CELL){
  const sections=pieces(map.floors[index]?.items),bridges=(map.floors[index]?.items||[]).filter(isBridge);
  if(!sections.length&&!bridges.length)return;
  if(visualProject!==map){
   visualProject=map;visuals.length=0;visualGraph=topology(map);
   if(sharedWater){sharedWater.dispose?.();sharedWater=null;}
  }
  const hole=new THREE.MeshBasicMaterial({color:0x02070b});
  const metal=new THREE.MeshLambertMaterial({color:0x74847f});
  const water=sections.length?waterMaterial(THREE,CELL):null;
  const box=(mat,x,y,z,w,h,d)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);story.add(mesh);return mesh;};
  // Se combinan todos los polígonos de un mismo tramo en un BufferGeometry.
  // El desagüe 20×20 ya no crea decenas de draw calls por sus rectángulos.
  function sheet(rectangles,it,flood=false,next=null){
   const centerX=it.x+it.w/2,centerY=it.y+it.h/2;
   const vertices=[],flows=[],indices=[];
   const target=next&&(map.floors[next.floorIndex]?.items||[])
    .find(q=>String(q.id)===String(next.itemId));
   for(const r of rectangles){
    const nx=Math.max(1,Math.ceil(r.w)),ny=Math.max(1,Math.ceil(r.h));
    const start=vertices.length/3,stride=nx+1;
    for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
     const px=r.x+r.w*x/nx,py=r.y+r.h*y/ny;
     vertices.push((px-centerX)*CELL,(centerY-py)*CELL,0);
     const d=it.drainage.kind==='outfall'?{x:0,y:0}:flowDirection(it,{x:px,y:py},target);
     flows.push(d.x,d.y);
    }
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
     const a=start+y*stride+x,b=a+1,c=a+stride,d=c+1;
     indices.push(a,c,b,b,c,d);
    }
   }
   const geo=new THREE.BufferGeometry();
   geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
   geo.setAttribute('aFlow',new THREE.Float32BufferAttribute(flows,2));
   geo.setIndex(indices);
   const mesh=new THREE.Mesh(geo,water);
   mesh.rotation.x=-Math.PI/2;
   mesh.position.set(centerX*CELL,(flood ? .025 : WATER_LEVEL)*CELL,centerY*CELL);
   mesh.visible=!flood;
   story.add(mesh);return mesh;
  }
  for(const it of sections){
   const next=downstream(map,index,it.id,visualGraph);
   const surface=sheet(channelRects(it),it,false,next);
   let flood=null,ring=null;
   if(SIZES[it.drainage.kind]===4)
    flood=sheet([{x:it.x,y:it.y,w:it.w,h:it.h}],it,true,next);
   if(it.drainage.kind==='outfall'){
    const cx=(it.x+it.w/2)*CELL,cz=(it.y+it.h/2)*CELL;
    const ringMat=new THREE.MeshBasicMaterial({color:0x1b4b57,transparent:true,opacity:.55,depthWrite:false,side:THREE.DoubleSide});
    ring=new THREE.Mesh(new THREE.RingGeometry(3*CELL,7*CELL,40),ringMat);
    ring.rotation.x=-Math.PI/2;ring.position.set(cx,WATER_LEVEL*CELL+.012,cz);story.add(ring);
    const abyss=new THREE.Mesh(new THREE.CircleGeometry(3*CELL,40),hole);
    abyss.rotation.x=-Math.PI/2;abyss.position.set(cx,WATER_LEVEL*CELL+.02,cz);story.add(abyss);
   }
   visuals.push({floorIndex:index,itemId:it.id,surface,ring,flood});
  }
  for(const it of bridges){
   const cx=(it.x+it.w/2)*CELL,cz=(it.y+it.h/2)*CELL,w=it.w*CELL,d=it.h*CELL;
   box(metal,cx,.23,cz,w,.13,d);
   const across=it.w<it.h;
   for(let n=1;n<7;n++){
    const t=n/7-.5;
    if(across)box(hole,cx,.305,cz+t*d,w*.95,.024,.055*CELL);
    else box(hole,cx+t*w,.305,cz,.055*CELL,.024,d*.95);
   }
  }
 }
 return Object.freeze({SIZES,WATER_LEVEL,CHANNEL_BOTTOM,isSection,isBridge,pieces,ports,rects,channelRects,cutFloorRects,touches,makeSection,makeBridge,validate,
  validateProject,topology,downstream,nearest,weatherState,randomExit,nativeComponents,expandProject,sectionAt,bridgeAt,waterAt,walkFactor,currentAt,depthAt,whirlpoolAt,createRuntime,updateVisuals,draw2D,attachFloor});
});
