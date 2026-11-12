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
 const SIZES=Object.freeze({straight:10,tee:10,cross:10,small:4,outfall:20});
 const BASE_PORTS=Object.freeze({straight:['e','w'],tee:['n','e','w'],cross:['n','e','s','w'],small:['e','w'],outfall:['n','e','s','w']});
 const SIDE=['n','e','s','w'],OPPOSITE={n:'s',e:'w',s:'n',w:'e'};
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
   blocksMovement:false,label:kind==='outfall'?'Desagüe principal':kind==='small'?'Conducto secundario':'Drenaje principal',
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
  const kind=it.drainage.kind,size=SIZES[kind];
  if(kind==='outfall')return [];
  const base=kind==='small'?[{x:0,y:1.5,w:4,h:1}]:
   [{x:0,y:3,w:10,h:4},...(kind==='tee'?[{x:3,y:0,w:4,h:7}]:kind==='cross'?[{x:3,y:0,w:4,h:10}]:[])];
  const steps=degrees(it.rotation)/90;
  return base.map(r=>{let q={...r};for(let i=0;i<steps;i++)q={x:size-q.y-q.h,y:q.x,w:q.h,h:q.w};
   return {x:it.x+q.x,y:it.y+q.y,w:q.w,h:q.h};});
 }
 function touches(a,b){
  const A=ports(a),B=ports(b),eps=.001,edge=(x,y,side)=>{
   const axis=(side==='n'||side==='s')?'x':'y';
   const lo=axis==='x'?x.x:x.y,width=axis==='x'?x.w:x.h;
   const other=axis==='x'?y.x:y.y,otherWidth=axis==='x'?y.w:y.h;
   return Math.max(0,Math.min(lo+width,other+otherWidth)-Math.max(lo,other));
  };
  for(const side of A){
   if(!B.includes(OPPOSITE[side]))continue;
   const adjacent=side==='e'?Math.abs(a.x+a.w-b.x)<eps:
    side==='w'?Math.abs(b.x+b.w-a.x)<eps:
    side==='s'?Math.abs(a.y+a.h-b.y)<eps:Math.abs(b.y+b.h-a.y)<eps;
   if(!adjacent)continue;
   const length=edge(a,b,side),width=Math.min(a.drainage.kind==='small'?1:4,b.drainage.kind==='small'?1:4);
   const middleA=(side==='e'||side==='w')?a.y+a.h/2:a.x+a.w/2;
   const middleB=(side==='e'||side==='w')?b.y+b.h/2:b.x+b.w/2;
   if(length>=width-.001&&Math.abs(middleA-middleB)<=Math.max(a.w,b.w)/2)return true;
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
 function downstream(project,floorIndex,itemId){
  const graph=topology(project),source=graph.nodes.find(n=>n.floorIndex===floorIndex&&String(n.item.id)===String(itemId));
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
  const small=it?.drainage?.kind==='small';
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
 function attachFloor(THREE,map,story,index,CELL){
  const sections=pieces(map.floors[index]?.items),bridges=(map.floors[index]?.items||[]).filter(isBridge);
  if(!sections.length&&!bridges.length)return;
  const bed=new THREE.MeshBasicMaterial({color:0x323d41}),water=new THREE.MeshBasicMaterial({color:0x245b6b,transparent:true,opacity:.92});
  const wall=new THREE.MeshLambertMaterial({color:0x3d4c4e}),hole=new THREE.MeshBasicMaterial({color:0x02070b});
  const metal=new THREE.MeshLambertMaterial({color:0x74847f});
  const box=(mat,x,y,z,w,h,d)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);story.add(mesh);return mesh};
  for(const it of sections){
   const x=it.x*CELL,z=it.y*CELL,s=it.w*CELL;
   box(bed,x+s/2,.02,z+s/2,s,.06,s);
   for(const r of rects(it))box(water,(r.x+r.w/2)*CELL,.082,(r.y+r.h/2)*CELL,r.w*CELL,.018,r.h*CELL);
   if(it.drainage.kind==='outfall'){
    const cx=x+s/2,cz=z+s/2;
    const ring=new THREE.Mesh(new THREE.RingGeometry(3*CELL,7*CELL,40),water);
    ring.rotation.x=-Math.PI/2;ring.position.set(cx,.085,cz);story.add(ring);
    const abyss=new THREE.Mesh(new THREE.CircleGeometry(3*CELL,40),hole);
    abyss.rotation.x=-Math.PI/2;abyss.position.set(cx,.095,cz);story.add(abyss);
   }
   for(const side of SIDE)if(!ports(it).includes(side)){
    const cx=x+s/2,cz=z+s/2,t=.19*CELL,high=Math.min(3,Math.max(2,3*CELL));
    if(side==='n'||side==='s')box(wall,cx,high/2,side==='n'?z: z+s,s,high,t);
    else box(wall,side==='w'?x:x+s,high/2,cz,t,high,s);
   }
  }
  for(const it of bridges){
   const cx=(it.x+it.w/2)*CELL,cz=(it.y+it.h/2)*CELL,w=it.w*CELL,d=it.h*CELL;
   box(metal,cx,.23,cz,w,.13,d);
   const across=it.w<it.h;
   for(let n=1;n<7;n++){
    const t=(n/7-.5);
    if(across)box(hole,cx,.305,cz+t*d,w*.95,.024,.055*CELL);
    else box(hole,cx+t*w,.305,cz,.055*CELL,.024,d*.95);
   }
  }
 }
 return Object.freeze({SIZES,isSection,isBridge,pieces,ports,rects,touches,makeSection,makeBridge,validate,
  validateProject,topology,downstream,nearest,weatherState,randomExit,draw2D,attachFloor});
});
