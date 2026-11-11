/* Red vial opcional sobre items existentes de forest-horror-map-v1.
 * Geometría en casillas; anchos físicos en pies. Sin simulación de tráfico. */
(function(root,factory){
 const api=factory();root.FHRoads=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const EPS=1e-6,MAX_CELLS=120;
 const isRoad=it=>it?.type==='asphalt'&&it.road!==undefined;
 const isControl=it=>it?.type==='misc'&&it.roadControl!==undefined;
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const round=v=>Math.round(v*1e6)/1e6;
 const text=key=>globalThis.FH_ROAD_TEXT?.[key]||key;
 const fail=key=>{const error=new Error(text(key));error.code=key;throw error;};
 const feet=units=>finite(units?.feetPerCell)&&units.feetPerCell>0?units.feetPerCell:5;
 function config(raw={}){
  const c={version:1,axis:raw.axis??'x',sign:raw.sign??1,forwardLanes:raw.forwardLanes??1,reverseLanes:raw.reverseLanes??1,
   laneWidthFt:raw.laneWidthFt??10,sidewalkFt:raw.sidewalkFt??5,speedKmh:raw.speedKmh??40};
  if(!['x','y'].includes(c.axis)||![1,-1].includes(c.sign)||
   ![c.forwardLanes,c.reverseLanes].every(n=>Number.isInteger(n)&&n>=0&&n<=12)||
   c.forwardLanes+c.reverseLanes<1||c.forwardLanes+c.reverseLanes>12||
   !finite(c.laneWidthFt)||c.laneWidthFt<6||c.laneWidthFt>20||
   !finite(c.sidewalkFt)||c.sidewalkFt<0||c.sidewalkFt>20||
   !finite(c.speedKmh)||c.speedKmh<5||c.speedKmh>130||raw.version!==undefined&&raw.version!==1)fail('invalid');
  return c;
 }
 function endpoints(it){
  const c=config(it.road),horizontal=c.axis==='x';
  const a=horizontal?{x:it.x,y:it.y+it.h/2}:{x:it.x+it.w/2,y:it.y};
  const b=horizontal?{x:it.x+it.w,y:a.y}:{x:a.x,y:it.y+it.h};
  return c.sign===1?{a,b}:{a:b,b:a};
 }
 function makeRoad(a,b,raw,units,id){
  if(!a||!b||![a.x,a.y,b.x,b.y].every(finite))fail('badRoad');
  const axis=Math.abs(b.x-a.x)>=Math.abs(b.y-a.y)?'x':'y';
  b=axis==='x'?{x:b.x,y:a.y}:{x:a.x,y:b.y};
  const length=Math.abs(b[axis]-a[axis]);if(length<2)fail('short');
  const road=config({...raw,axis,sign:b[axis]>a[axis]?1:-1});
  const width=(road.forwardLanes+road.reverseLanes)*road.laneWidthFt/feet(units);
  const item={id,type:'asphalt',x:round(axis==='x'?Math.min(a.x,b.x):a.x-width/2),
   y:round(axis==='x'?a.y-width/2:Math.min(a.y,b.y)),w:round(axis==='x'?length:width),h:round(axis==='x'?width:length),
   label:String(raw?.label||text('road')).slice(0,80),blocksMovement:false,road};
  validateRoad(item,units);return item;
 }
 function footprint(it,units){const s=config(it.road).sidewalkFt/feet(units);return it.road.axis==='x'?{x:it.x,y:it.y-s,w:it.w,h:it.h+2*s}:{x:it.x-s,y:it.y,w:it.w+2*s,h:it.h};}
 function within(rect,units){return rect.x>=-EPS&&rect.y>=-EPS&&rect.x+rect.w<=Math.min(MAX_CELLS,units?.columns??MAX_CELLS)+EPS&&rect.y+rect.h<=Math.min(MAX_CELLS,units?.rows??MAX_CELLS)+EPS;}
 function validateRoad(it,units){
  const c=config(it.road);if(![it.x,it.y,it.w,it.h].every(finite)||it.w<=0||it.h<=0||it.blocksMovement!==false)fail('badRoad');
  const width=(c.forwardLanes+c.reverseLanes)*c.laneWidthFt/feet(units);
  if(Math.abs((c.axis==='x'?it.h:it.w)-width)>1e-5||(c.axis==='x'?it.w:it.h)<2)fail('badRoad');
  if(!within(footprint(it,units),units))fail('bounds');return true;
 }
 function overlap(a,b){const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),w=Math.min(a.x+a.w,b.x+b.w)-x,h=Math.min(a.y+a.h,b.y+b.h)-y;return w>EPS&&h>EPS?{x,y,w,h}:null;}
 const contains=(r,p)=>p.x>=r.x-EPS&&p.x<=r.x+r.w+EPS&&p.y>=r.y-EPS&&p.y<=r.y+r.h+EPS;
 function roads(items){return items.filter(isRoad);}
 function junctions(items){
  const list=roads(items),out=[];
  for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
   const a=list[i],b=list[j];if(a.road.axis===b.road.axis)continue;
   const h=a.road.axis==='x'?a:b,v=h===a?b:a,p={x:v.x+v.w/2,y:h.y+h.h/2};
   const rect=overlap(h,v);if(!rect||!contains(h,p)||!contains(v,p))continue;
   out.push({id:[a.id,b.id].sort().join(':'),roadIds:[a.id,b.id],...p,rect});
  }
  return out;
 }
 function lanes(it,units){
  const c=config(it.road),{a,b}=endpoints(it),length=Math.hypot(b.x-a.x,b.y-a.y),dx=(b.x-a.x)/length,dy=(b.y-a.y)/length;
  const lane=c.laneWidthFt/feet(units),total=c.forwardLanes+c.reverseLanes,out=[];
  // Orden de izquierda a derecha mirando hacia el final del eje.
  for(let n=0;n<total;n++){
   const offset=(n+.5-total/2)*lane,forward=n>=c.reverseLanes;
   const start={x:round(a.x-dy*offset),y:round(a.y+dx*offset)},end={x:round(b.x-dy*offset),y:round(b.y+dx*offset)};
   out.push({id:it.id+':lane:'+n,roadId:it.id,index:n,direction:forward?'forward':'reverse',
    from:forward?start:end,to:forward?end:start,speedKmh:c.speedKmh,allowedTurns:['left','straight','right']});
  }
  return out;
 }
 function topology(items,units){
  const list=roads(items),crossings=junctions(items),allLanes=list.flatMap(r=>lanes(r,units)),connections=[];
  for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
   const a=list[i],b=list[j];if(a.road.axis!==b.road.axis)continue;
   const p=endpoints(a),q=endpoints(b);
   if([p.a,p.b].some(v=>[q.a,q.b].some(w=>Math.hypot(v.x-w.x,v.y-w.y)<EPS)))connections.push([a.id,b.id]);
  }
  return {lanes:allLanes,junctions:crossings,connections};
 }
 function nearestRoad(items,p){
  return roads(items).filter(r=>contains(r,p)).sort((a,b)=>{
   const dist=r=>r.road.axis==='x'?Math.abs(p.y-r.y-r.h/2):Math.abs(p.x-r.x-r.w/2);
   return dist(a)-dist(b);
  })[0]||null;
 }
 const CONTROL_KINDS=['stop','signal','speed','crosswalk','portal'];
 function controlConfig(kind,raw={}){
  if(!CONTROL_KINDS.includes(kind))fail('badControl');
  const c={version:1,kind,direction:raw.direction??'both',speedKmh:raw.speedKmh??40,stopSeconds:raw.stopSeconds??1,
   greenSeconds:raw.greenSeconds??20,yellowSeconds:raw.yellowSeconds??3,allRedSeconds:raw.allRedSeconds??1,offsetSeconds:raw.offsetSeconds??0};
  if(!['both','forward','reverse'].includes(c.direction)||!finite(c.speedKmh)||c.speedKmh<5||c.speedKmh>130||
   !finite(c.stopSeconds)||c.stopSeconds<.5||c.stopSeconds>10||!finite(c.greenSeconds)||c.greenSeconds<5||c.greenSeconds>180||
   !finite(c.yellowSeconds)||c.yellowSeconds<1||c.yellowSeconds>10||!finite(c.allRedSeconds)||c.allRedSeconds<1||c.allRedSeconds>10||
   !finite(c.offsetSeconds)||c.offsetSeconds<0||c.offsetSeconds>600||raw.version!==undefined&&raw.version!==1)fail('badControl');
  return c;
 }
 function makeControl(kind,p,raw,items,id){
  const c=controlConfig(kind,raw);let at={...p},road=null;
  if(kind==='stop'||kind==='signal'){
   const junction=junctions(items).filter(j=>contains(j.rect,p)).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
   if(!junction)fail('missingJunction');
   c.junctionId=junction.id;c.roadIds=junction.roadIds;at={x:junction.x,y:junction.y};
   c.requireClearExit=true;
   if(kind==='stop'){c.priority='first-arrival-then-clockwise';c.skipEmpty=true;}
   if(kind==='signal')c.phases=['horizontal-green','horizontal-yellow','all-red','vertical-green','vertical-yellow','all-red'];
  }else{
   road=nearestRoad(items,p);if(!road)fail('missingRoad');c.roadId=road.id;
   const {a,b}=endpoints(road),length=Math.hypot(b.x-a.x,b.y-a.y);
   c.position=Math.max(0,Math.min(1,((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/(length*length)));
   at={x:a.x+(b.x-a.x)*c.position,y:a.y+(b.y-a.y)*c.position};
   if(kind==='portal'){c.position=c.position<.5?0:1;at=c.position===0?a:b;}
  }
  return {id,type:'misc',x:round(at.x),y:round(at.y),w:.7,h:.7,rotation:0,heightFt:0,blocksMovement:false,label:text(kind),roadControl:c};
 }
 function validateProject(project){
  for(const floor of project?.floors||[]){
   for(const it of floor.items||[]){
    if(isRoad(it))validateRoad(it,project.units);
    if(isControl(it)){
     controlConfig(it.roadControl.kind,it.roadControl);
     if(![it.x,it.y].every(finite)||!within({x:it.x,y:it.y,w:0,h:0},project.units)||it.blocksMovement!==false)fail('badControl');
    }
   }
  }return true;
 }
 function audit(items,units){
  const issues=[],valid=[];
  for(const it of roads(items)){try{validateRoad(it,units);valid.push(it);}catch(error){issues.push({code:error.code||'badRoad',itemId:it.id});}}
  const graph=topology(valid,units),joined=new Set(graph.connections.flat().concat(graph.junctions.flatMap(j=>j.roadIds)));
  if(valid.length>1)for(const r of valid)if(!joined.has(r.id))issues.push({code:'disconnected',itemId:r.id});
  for(let i=0;i<valid.length;i++)for(let j=i+1;j<valid.length;j++)if(valid[i].road.axis===valid[j].road.axis&&overlap(valid[i],valid[j]))issues.push({code:'parallel',itemId:valid[i].id,otherId:valid[j].id});
  const controls=items.filter(isControl);
  for(const j of graph.junctions){const count=controls.filter(it=>['stop','signal'].includes(it.roadControl.kind)&&it.roadControl.junctionId===j.id).length;
   if(count!==1)issues.push({code:count?'duplicate':'uncontrolled',itemId:j.id});}
  for(const it of controls){const c=it.roadControl;
   try{controlConfig(c.kind,c);}catch{issues.push({code:'badControl',itemId:it.id});continue;}
   if(c.junctionId){const j=graph.junctions.find(j=>j.id===c.junctionId);if(!j||Math.hypot(it.x-j.x,it.y-j.y)>EPS)issues.push({code:'orphan',itemId:it.id});}
   else {const r=valid.find(r=>r.id===c.roadId);if(!r||!contains(r,it))issues.push({code:'orphan',itemId:it.id});}
  }
  return {roads:valid.length,...graph,issues};
 }
 // Una textura compartida para el editor y la vista 3D; resolución y caché acotadas.
 const cache=new Map();
 function artwork(items,units){
  const list=items.filter(it=>isRoad(it)||isControl(it)),key=JSON.stringify([units?.columns,units?.rows,feet(units),list]);
  if(cache.has(key))return cache.get(key);
  const canvas=document.createElement('canvas'),cols=units.columns,rows=units.rows,scale=Math.min(24,2048/Math.max(cols,rows));
  canvas.width=Math.ceil(cols*scale);canvas.height=Math.ceil(rows*scale);
  const ctx=canvas.getContext('2d');ctx.scale(canvas.width/cols,canvas.height/rows);paint(ctx,list,units);
  if(cache.size>=2)cache.delete(cache.keys().next().value);cache.set(key,canvas);return canvas;
 }
 function paint(ctx,items,units){
  const list=roads(items),crossings=junctions(items),fpc=feet(units);
  // Primero banquetas; después todas las calzadas para abrirlas en los cruces.
  for(const r of list){const box=footprint(r,units);ctx.fillStyle='#999994';ctx.fillRect(box.x,box.y,box.w,box.h);
   ctx.strokeStyle='#737570';ctx.lineWidth=.04;ctx.strokeRect(box.x,box.y,box.w,box.h);}
  for(const r of list){ctx.fillStyle='#41444a';ctx.fillRect(r.x,r.y,r.w,r.h);}
  for(const r of list){const c=config(r.road),{a,b}=endpoints(r),length=Math.hypot(b.x-a.x,b.y-a.y),dx=(b.x-a.x)/length,dy=(b.y-a.y)/length,lw=c.laneWidthFt/fpc,total=c.forwardLanes+c.reverseLanes;
   ctx.save();ctx.beginPath();ctx.rect(r.x,r.y,r.w,r.h);
   for(const j of crossings.filter(j=>j.roadIds.includes(r.id))){const q=j.rect;ctx.rect(q.x,q.y,q.w,q.h);}ctx.clip('evenodd');
   ctx.translate(a.x,a.y);ctx.rotate(Math.atan2(dy,dx));
   for(let n=1;n<total;n++){
    const y=(n-total/2)*lw,center=n===c.reverseLanes&&c.forwardLanes&&c.reverseLanes;
    ctx.strokeStyle=center?'#e6c34e':'#f3efdc';ctx.lineWidth=.08;ctx.setLineDash(center?[]:[.7,.6]);
    for(const offset of center?[-.09,.09]:[0]){ctx.beginPath();ctx.moveTo(0,y+offset);ctx.lineTo(length,y+offset);ctx.stroke();}
   }
   ctx.setLineDash([]);ctx.strokeStyle='#eee9d7';ctx.lineWidth=.06;
   for(const edge of [-1,1]){ctx.beginPath();ctx.moveTo(0,edge*(total*lw/2-.1));ctx.lineTo(length,edge*(total*lw/2-.1));ctx.stroke();}
   for(let n=0;n<total;n++){const y=(n+.5-total/2)*lw,sign=n>=c.reverseLanes?1:-1;
    for(let x=2;x<length-1;x+=8){ctx.beginPath();ctx.moveTo(x-.4*sign,y);ctx.lineTo(x+.4*sign,y);ctx.moveTo(x+.05*sign,y-.25);ctx.lineTo(x+.4*sign,y);ctx.lineTo(x+.05*sign,y+.25);ctx.stroke();}
   }ctx.restore();
  }
  for(const it of items.filter(isControl)){
   const c=it.roadControl,r=list.find(r=>r.id===c.roadId);
   if(c.kind==='crosswalk'&&r){ctx.fillStyle='#f3efdc';if(r.road.axis==='x'){for(let y=r.y+.12;y<r.y+r.h-.1;y+=.55)ctx.fillRect(it.x-.8,y,1.6,.25);}else{for(let x=r.x+.12;x<r.x+r.w-.1;x+=.55)ctx.fillRect(x,it.y-.8,.25,1.6);}continue;}
   ctx.save();ctx.translate(it.x,it.y);ctx.fillStyle=c.kind==='stop'?'#a53838':c.kind==='signal'?'#23342b':'#e6e5d9';ctx.strokeStyle='#f1eddc';ctx.lineWidth=.05;
   ctx.beginPath();if(c.kind==='stop'){for(let n=0;n<8;n++){const a=Math.PI/8+n*Math.PI/4,x=Math.cos(a)*.55,y=Math.sin(a)*.55;n?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();}else ctx.rect(-.55,-.4,1.1,.8);ctx.fill();ctx.stroke();
   ctx.fillStyle=c.kind==='stop'||c.kind==='signal'?'#ffffff':'#20262a';ctx.font='bold .32px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.fillText(c.kind==='speed'?String(c.speedKmh):c.kind==='stop'?String(text('stop')).toUpperCase():c.kind==='signal'?'● ● ●':'↔',0,0);ctx.restore();
  }
 }
 function draw2D(ctx,items,units,toPixel,gx,gy,selection){
  if(!items.some(isRoad))return;const image=artwork(items,units),p=toPixel({x:0,y:0});
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(image,p.x,p.y,units.columns*gx,units.rows*gy);
  const selected=items.find(it=>it.id===selection&&isRoad(it));if(selected){const q=toPixel(selected);ctx.strokeStyle='#fff';ctx.lineWidth=.1*Math.min(gx,gy);ctx.strokeRect(q.x,q.y,selected.w*gx,selected.h*gy);}ctx.restore();
 }
 function attachFloor(THREE,map,story,index,CELL){
  const items=map.floors[index].items||[];if(!items.some(isRoad))return null;
  const texture=new THREE.CanvasTexture(artwork(items,map.units));texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.encoding=THREE.sRGBEncoding;
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.03,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(map.units.columns*CELL,map.units.rows*CELL),material);
  mesh.rotation.x=-Math.PI/2;mesh.position.set(map.units.columns*CELL/2,.05,map.units.rows*CELL/2);mesh.renderOrder=7;story.add(mesh);return mesh;
 }
 return Object.freeze({MAX_CELLS,CONTROL_KINDS,isRoad,isControl,config,endpoints,makeRoad,footprint,within,validateRoad,validateProject,overlap,contains,roads,junctions,lanes,topology,nearestRoad,controlConfig,makeControl,audit,paint,artwork,draw2D,attachFloor});
});
