/* Forest Horror · superficies y decals de estacionamiento.
 * Una sola fuente para el editor 2D, la escena Three.js y la exportación JSON.
 * 1 casilla = project.units.feetPerCell pies (5 pies por defecto). */
(function(root,factory){
 const api=factory();
 if(root)root.FHParking=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const DEFAULT_FEET_PER_CELL=5, TEXELS_PER_FOOT=8;
 const SURFACES=Object.freeze({
  asphalt:{preset:'asfalto',color:'#41444A'},
  alley:{preset:'callejon',color:'#575653'},
  sidewalk:{preset:'banqueta',color:'#999994'},
  concrete:{preset:'concreto',color:'#98958E'},
  gravel:{preset:'grava',color:'#85817A'},
  cobblestone:{preset:'adoquin',color:'#898278'},
  tile_floor:{preset:'baldosa',color:'#B5AAA0'},
  carpet:{preset:'alfombra',color:'#786C72'},
  wood_floor:{preset:'madera',color:'#846B52'},
  parking:{preset:'asfalto',color:'#41444A'},
  pavement:{preset:'banqueta',color:'#999994'},
  grass:{preset:'pasto',color:'#4C6947'},
  dirt:{preset:'tierra',color:'#75604B'}
 });
 const TOOLS=Object.freeze({
  parking_stall:'stall',parking_arrow:'arrow',parking_crosswalk:'crosswalk',
  parking_double_yellow:'double_yellow',parking_dashed_yellow:'dashed_yellow',
  parking_speed_bump:'speed_bump',parking_curb:'curb'
 });
 const KINDS=Object.freeze(Object.values(TOOLS));
 const DEFAULT_FT=Object.freeze({
  stall:[9,18],arrow:[6,12],crosswalk:[12,10],double_yellow:[2,20],
  dashed_yellow:[1,20],speed_bump:[10,3],curb:[2,20]
 });
 const feetPerCell=n=>Number.isFinite(Number(n))&&Number(n)>0?Number(n):DEFAULT_FEET_PER_CELL;
 const toCells=(ft,ftPerCell=DEFAULT_FEET_PER_CELL)=>Number(ft)/feetPerCell(ftPerCell);
 const toFeet=(cells,ftPerCell=DEFAULT_FEET_PER_CELL)=>Number(cells)*feetPerCell(ftPerCell);
 const clamp=(value,lo,hi)=>Math.max(lo,Math.min(hi,value));
 const validNumber=(v,lo,hi,fallback)=>Number.isFinite(Number(v))?clamp(Number(v),lo,hi):fallback;
 const colorValid=s=>typeof s==='string'&&/^#[\da-fA-F]{6}$/.test(s);
 const colorFor=kind=>kind==='accessible'?'#69B8E8':kind==='double_yellow'||kind==='dashed_yellow'?'#E6C34E':'#F3EFDC';
 function makeDecal(kind,x,y,opts={},id){
  if(!KINDS.includes(kind))throw Error('Marca de estacionamiento no reconocida');
  if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Coordenadas inválidas');
  const fpc=feetPerCell(opts.feetPerCell),dim=DEFAULT_FT[kind];
  const widthFt=validNumber(opts.widthFt,0.5,200,dim[0]),lengthFt=validNumber(opts.lengthFt,.5,200,dim[1]);
  const rotation=validNumber(opts.rotation,-3600,3600,0);
  return {id:id||'parking_'+kind,type:'parking_decal',decalKind:kind,x,y,w:toCells(widthFt,fpc),h:toCells(lengthFt,fpc),
   rotation,widthFt,lengthFt,number:kind==='stall'?String(opts.number??''):'',
   accessible:kind==='stall'&&!!opts.accessible,color:colorValid(opts.color)?opts.color:colorFor(kind),
   blocksMovement:false,label:String(opts.label||'').slice(0,60)};
 }
 function createStalls(origin,opts={},nextId){
  const count=Math.round(validNumber(opts.count,1,100,1));
  const fpc=feetPerCell(opts.feetPerCell),widthFt=validNumber(opts.widthFt,.5,40,9),lengthFt=validNumber(opts.lengthFt,1,50,18),
   gapFt=validNumber(opts.gapFt,0,20,0),rotation=validNumber(opts.rotation,-3600,3600,0),rad=rotation*Math.PI/180,
   increment=toCells(widthFt+gapFt,fpc),first=Math.max(0,Math.trunc(Number(opts.startNumber)||1)),accessible=new Set(
    Array.isArray(opts.accessibleIndices)?opts.accessibleIndices.map(Number):[]);
  if(!Number.isFinite(origin?.x)||!Number.isFinite(origin?.y))throw Error('Origen de los cajones inválido');
  return Array.from({length:count},(_,i)=>{
   const x=origin.x+Math.cos(rad)*increment*i,y=origin.y+Math.sin(rad)*increment*i;
   return makeDecal('stall',x,y,{feetPerCell:fpc,widthFt,lengthFt,rotation,number:(opts.prefix||'')+(first+i),
    accessible:accessible.has(i+1),color:opts.color},typeof nextId==='function'?nextId():'parking_stall_'+(i+1));
  });
 }
 function checkDecal(item,ftPerCell=DEFAULT_FEET_PER_CELL){
  if(item?.type!=='parking_decal')return false;
  if(!KINDS.includes(item.decalKind))throw Error('Tipo de decal desconocido');
  for(const key of ['x','y','w','h','rotation'])if(!Number.isFinite(item[key]))throw Error('Decal: '+key+' debe ser numérico');
  if(item.w<=0||item.h<=0||item.w>200||item.h>200)throw Error('Decal de tamaño inválido');
  if(item.blocksMovement!==false)throw Error('Los decals nunca tienen colisión');
  if(item.color!==undefined&&!colorValid(item.color))throw Error('Color hexadecimal inválido');
  if(item.number!==undefined&&String(item.number).length>24)throw Error('Número de cajón demasiado largo');
  return true;
 }
 function validateProject(doc){
  for(const fl of doc?.floors||[])for(const item of fl.items||[])if(item.type==='parking_decal')checkDecal(item,doc.units?.feetPerCell);
  return true;
 }
 // El diseño 2D se usa como CanvasTexture en 3D: mismas medidas y mismos símbolos.
 const cache=new Map();
 function artwork(item,ftPerCell=DEFAULT_FEET_PER_CELL){
  const wFt=item.widthFt||toFeet(item.w,ftPerCell),hFt=item.lengthFt||toFeet(item.h,ftPerCell);
  const ratio=Math.min(TEXELS_PER_FOOT,1024/Math.max(wFt,hFt));
  const width=Math.max(16,Math.round(wFt*ratio)),height=Math.max(16,Math.round(hFt*ratio));
  const key=[item.decalKind,width,height,item.color,item.number,item.accessible].join('|');
  if(cache.has(key))return cache.get(key);
  if(typeof document==='undefined')throw Error('Canvas no disponible');
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
  paintArtwork(c,item,width,height);
  if(cache.size>=160)cache.delete(cache.keys().next().value);
  cache.set(key,canvas);return canvas;
 }
 function paintArtwork(c,item,w,h){
  const col=colorValid(item.color)?item.color:colorFor(item.decalKind),
   s=clamp(Math.round(w/28),2,Math.max(2,Math.round(w/10)));
  c.clearRect(0,0,w,h);c.strokeStyle=col;c.fillStyle=col;c.lineWidth=s;
  c.lineJoin='miter';c.lineCap='butt';
  const rect=(x,y,a,b)=>c.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(a)),Math.max(1,Math.round(b)));
  const path=points=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x*w,y*h):c.moveTo(x*w,y*h));c.stroke()};
  switch(item.decalKind){
   case 'stall':{
    // U abierta arriba para permitir que los cajones compartan el acceso.
    path([[.04,.07],[.04,.97],[.96,.97],[.96,.07]]);
    if(item.accessible){
     c.fillStyle='#286595';rect(w*.15,h*.36,w*.70,h*.39);
     c.fillStyle='#DDEEFF';c.font='bold '+Math.round(Math.min(w*.48,h*.24))+'px monospace';
     c.textAlign='center';c.textBaseline='middle';c.fillText('♿',w*.5,h*.55,w*.67);
     c.fillStyle=col;
    }
    if(item.number){
     const label=String(item.number).slice(0,24);
     c.font='bold '+Math.max(9,Math.round(Math.min(w*.31,h*.15)))+'px monospace';
     c.textBaseline='top';c.textAlign='center';c.fillText(label,w*.5,h*.07,w*.88);
    }
    break;
   }
   case 'arrow':
    path([[.5,.89],[.5,.22]]);path([[.20,.47],[.5,.11],[.80,.47]]);
    break;
   case 'crosswalk':
    for(let x=w*.06;x<w*.94;x+=w*.17)rect(x,h*.07,w*.085,h*.86);
    break;
   case 'double_yellow':
    rect(w*.24,0,Math.max(s,w*.12),h);rect(w*.64,0,Math.max(s,w*.12),h);
    break;
   case 'dashed_yellow':
    for(let y=0;y<h;y+=Math.max(s*6,h*.16))rect(w*.43,y,w*.14,Math.min(h*.1,h-y));
    break;
   case 'speed_bump':
    c.fillStyle='#E3B546';rect(0,h*.18,w,h*.64);
    c.fillStyle='#1E2427';for(let x=-h;x<w+h;x+=h*.36){c.save();c.translate(x,0);c.transform(1,0,-.55,1,0,0);rect(0,h*.18,h*.15,h*.64);c.restore();}
    break;
   case 'curb':
    c.fillStyle='#C5BCA7';rect(0,0,w,h);
    c.fillStyle='#D9CEB4';rect(0,0,w*.35,h);
    c.fillStyle='#53565A';rect(w*.82,0,w*.18,h);
    for(let y=0;y<h;y+=Math.max(9,w*.9))rect(w*.06,y,w*.27,Math.max(1,s*.45));
    break;
  }
 }
 function draw2D(c,item,toPixel,gridX,gridY,selected=false,fpc=DEFAULT_FEET_PER_CELL){
  const image=artwork(item,fpc),p=toPixel(item),w=item.w*gridX,h=item.h*gridY;
  c.save();c.translate(p.x,p.y);c.rotate((Number(item.rotation)||0)*Math.PI/180);
  c.imageSmoothingEnabled=false;c.drawImage(image,-w/2,-h/2,w,h);
  if(selected){c.strokeStyle='#FFFFFF';c.lineWidth=2;c.setLineDash([6,4]);c.strokeRect(-w/2,-h/2,w,h);}
  c.restore();
 }
 function attachFloor(THREE,map,story,index,CELL){
  const floor=map.floors[index],fpc=feetPerCell(map.units?.feetPerCell);
  let order=0;const meshes=[];
  for(const item of floor.items||[]){
   if(item.type!=='parking_decal')continue;
   try{checkDecal(item,fpc)}catch(err){console.warn('Decal inválido',err);continue;}
   const img=artwork(item,fpc),tex=new THREE.CanvasTexture(img);
   tex.magFilter=tex.minFilter=THREE.NearestFilter;
   tex.generateMipmaps=false;tex.encoding=THREE.sRGBEncoding;
   tex.needsUpdate=true;
   const material=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,
    alphaTest:.035,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
   const mesh=new THREE.Mesh(new THREE.PlaneGeometry(item.w*CELL,item.h*CELL),material);
   mesh.rotation.x=-Math.PI/2;
   const group=new THREE.Group();story.add(group);
   group.position.set(item.x*CELL,.064+Math.min(order++,300)*.00004,item.y*CELL);
   group.rotation.y=-(Number(item.rotation)||0)*Math.PI/180;
   mesh.renderOrder=8;group.add(mesh);meshes.push(group);
  }
  return meshes;
 }
 return Object.freeze({DEFAULT_FEET_PER_CELL,TEXELS_PER_FOOT,SURFACES,TOOLS,KINDS,DEFAULT_FT,
  toCells,toFeet,makeDecal,createStalls,checkDecal,validateProject,paintArtwork,artwork,draw2D,attachFloor});
});
