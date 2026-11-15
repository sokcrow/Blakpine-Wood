/* Trazado automático de drenajes. Solo genera piezas v1; no simula agua ni colisiones. */
(function(root,factory){
 'use strict';
 const drain=root.FHDrainage||(typeof require==='function'?require('./fh-drainage.js'):null);
 const api=factory(drain);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHDrainageDraw=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(D){
 'use strict';
 const SIDES=['n','e','s','w'],OPPOSITE={n:'s',e:'w',s:'n',w:'e'},EPS=1e-6;
 const isAuto=it=>D.isSection(it)&&it.drainage.autoDraw===true;
 const sizeOf=kind=>kind==='main'?10:kind==='small'?4:0;
 const prefix=size=>size===4?'small_':'';
 const piece=(size,kind)=>size===4?(kind==='straight'?'small':'small_'+kind):kind;
 const almost=(a,b)=>Math.abs(a-b)<EPS;
 const interval=(a,b,c,d)=>Math.min(b,d)-Math.max(a,c)>EPS;
 function cell(point,size,units){
  if(!point||![point.x,point.y].every(Number.isFinite))throw Error('Coordenadas de trazado inválidas');
  const columns=units?.columns,rows=units?.rows;
  if(!Number.isFinite(columns)||!Number.isFinite(rows)||columns<size||rows<size)throw Error('Mapa demasiado pequeño para este drenaje');
  const x=Math.floor(Math.min(Math.max(point.x,0),columns-EPS)/size)*size;
  const y=Math.floor(Math.min(Math.max(point.y,0),rows-EPS)/size)*size;
  if(x+size>columns||y+size>rows)throw Error('El tramo no cabe en el mapa');
  return {x,y};
 }
 function pathCells(from,to,size,units){
  const a=cell(from,size,units),b=cell(to,size,units);
  const axis=Math.abs(b.x-a.x)>=Math.abs(b.y-a.y)?'x':'y';
  const end=axis==='x'?b.x:b.y,start=a[axis],step=end>=start?size:-size;
  const result=[];
  for(let v=start;;v+=step){
   result.push(axis==='x'?{x:v,y:a.y}:{x:a.x,y:v});
   if(v===end)break;
  }
  return result;
 }
 function portStub(item,side){
  return {...item,rotation:(SIDES.indexOf(side)*90+270)%360,
   drainage:{...item.drainage,kind:prefix(item.w)+'dead_end'}};
 }
 function nearOnSide(a,b,side){
  return side==='e'?almost(a.x+a.w,b.x)&&interval(a.y,a.y+a.h,b.y,b.y+b.h):
   side==='w'?almost(a.x,b.x+b.w)&&interval(a.y,a.y+a.h,b.y,b.y+b.h):
   side==='s'?almost(a.y+a.h,b.y)&&interval(a.x,a.x+a.w,b.x,b.x+b.w):
   almost(a.y,b.y+b.h)&&interval(a.x,a.x+a.w,b.x,b.x+b.w);
 }
 function shape(sides,size){
  const has=s=>sides.includes(s),n=sides.length,base=prefix(size);
  if(n===4)return {kind:base+'cross',rotation:0};
  if(n===3){
   // La T base abre N, E y W; cada cuarto de vuelta mueve la salida cerrada.
   const missing=SIDES.find(s=>!has(s));
   return {kind:base+'tee',rotation:{s:0,w:90,n:180,e:270}[missing]};
  }
  if(n===2){
   if(has('e')&&has('w'))return {kind:piece(size,'straight'),rotation:0};
   if(has('n')&&has('s'))return {kind:piece(size,'straight'),rotation:90};
   const pair=SIDES.filter(has).join('');
   return {kind:base+'elbow',rotation:{ne:0,es:90,sw:180,nw:270}[pair]};
  }
  return {kind:base+'dead_end',rotation:{e:0,s:90,w:180,n:270}[sides[0]||'e']};
 }
 function rebuild(items){
  const result=items.map(it=>isAuto(it)?{...it,drainage:{...it.drainage}}:it);
  const sections=result.filter(D.isSection),updated=[];
  for(const it of sections){
   if(!isAuto(it))continue;
   const sides=SIDES.filter(side=>{
    const source=portStub(it,side);
    return sections.some(peer=>peer!==it&&nearOnSide(it,peer,side)&&
     D.touches(source,isAuto(peer)?portStub(peer,OPPOSITE[side]):peer));
   });
   const next=shape(sides,it.w);
   if(it.drainage.kind!==next.kind||it.rotation!==next.rotation){
    it.drainage.kind=next.kind;it.rotation=next.rotation;updated.push(it);
   }
  }
  for(const it of result){
   if(!isAuto(it)||!it.drainage.flowTo)continue;
   if(!sections.some(other=>String(other.id)===String(it.drainage.flowTo)&&D.touches(it,other))){
    if(!updated.includes(it))updated.push(it);
    it.drainage.flowTo=null;
   }
  }
  return {items:result,updated};
 }
 function applyPath(items,from,to,kind,units,newId){
  const size=sizeOf(kind);
  if(!size)throw Error('Perfil de drenaje desconocido');
  const cells=pathCells(from,to,size,units),future=items.slice(),added=[];
  for(const c of cells){
   const rect={...c,w:size,h:size};
   const overlaps=future.filter(it=>D.isSection(it)&&
    it.x<rect.x+size&&it.x+it.w>rect.x&&it.y<rect.y+size&&it.y+it.h>rect.y);
   if(overlaps.length){
    if(overlaps.length===1&&isAuto(overlaps[0])&&overlaps[0].w===size&&
     overlaps[0].x===c.x&&overlaps[0].y===c.y)continue;
    throw Error('El trazado se superpone a otra sección de drenaje');
   }
   const it=D.makeSection(prefix(size)+'dead_end',{x:c.x+size/2,y:c.y+size/2},units,newId());
   it.drainage.autoDraw=true;
   future.push(it);added.push(it);
  }
  const computed=rebuild(future);
  return {...computed,added};
 }
 return Object.freeze({isAuto,cell,pathCells,shape,rebuild,applyPath});
});