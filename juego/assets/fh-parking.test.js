/* Ejecutar: node juego/assets/fh-parking.test.js */
const assert=typeof require==='function'?require('node:assert/strict'):null;
(function(root,factory){
 const run=factory();
 if(typeof module==='object'&&module.exports)module.exports=run;
 if(typeof require==='function'&&typeof module==='object'&&require.main===module){
  const result=run(require('./fh-parking.js'));
  console.log('Forest Horror · estacionamiento: '+result.passed+'/'+result.total+' pruebas OK');
 }
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 return function run(P){
  let passed=0,total=0;
  const check=(title,cond)=>{total++;if(!cond)throw Error('FAIL: '+title);passed++;};
  const fpc=5;
  check('Escala física 9 pies',P.toCells(9,fpc)===1.8);
  check('Escala física coche ancho',P.toCells(6,fpc)===1.2);
  check('Escala física coche largo',P.toCells(15,fpc)===3);
  let id=0;
  const stalls=P.createStalls({x:1.7,y:6.8},{count:8,widthFt:9,lengthFt:18,startNumber:1,feetPerCell:fpc,accessibleIndices:[3]},()=>('slot_'+(++id)));
  check('Se generan ocho cajones',stalls.length===8);
  check('Números 1 a 8',stalls.map(s=>s.number).join(',')==='1,2,3,4,5,6,7,8');
  check('Tamaño físico por cajón',stalls.every(s=>Math.abs(s.w-1.8)<1e-10&&Math.abs(s.h-3.6)<1e-10));
  check('Accesibilidad sólo cajón 3',stalls.filter(s=>s.accessible).length===1&&stalls[2].accessible);
  check('Alineados horizontalmente',stalls.every((s,i)=>Math.abs(s.x-(1.7+1.8*i))<1e-10&&s.y===6.8));
  check('Sin colisión',stalls.every(s=>s.blocksMovement===false&&s.type==='parking_decal'));
  const spaced=P.createStalls({x:0,y:0},{count:2,feetPerCell:5,gapFt:1},()=>('new_'+(++id)));
  check('Separación de un pie',spaced[1].x===2);
  const turned=P.createStalls({x:4,y:4},{count:3,feetPerCell:5,rotation:90},()=>('turned_'+(++id)));
  check('Rotación de fila 90 grados',turned.every((s,i)=>Math.abs(s.x-4)<1e-10&&Math.abs(s.y-(4+i*1.8))<1e-10&&s.rotation===90));
  const cars=stalls.slice(0,4).map((s,i)=>({id:'car'+i,type:'car',x:s.x,y:s.y,w:P.toCells(6,fpc),h:P.toCells(15,fpc),rotation:s.rotation,blocksMovement:true}));
  check('Cuatro coches',cars.length===4);
  check('Cada coche cabe dentro de su cajón',cars.every((car,i)=>car.w<stalls[i].w&&car.h<stalls[i].h&&car.x===stalls[i].x&&car.y===stalls[i].y));
  const asphalt={id:'asphalt',type:'asphalt',x:.4,y:4.25,w:15.15,h:5.25};
  const project={schema:'forest-horror-map-v1',version:2,units:{feetPerCell:5,columns:16,rows:22},
   floors:[{id:'floor1',items:[asphalt,...stalls,...cars]}]};
  check('Decals superpuestos al área de asfalto',project.floors[0].items.filter(s=>s.type==='asphalt').length===1&&stalls.every(s=>s.x>asphalt.x&&s.x<asphalt.x+asphalt.w));
  check('Exportación acepta decals',P.validateProject(project)===true);
  const serialized=JSON.stringify(project);
  const after=JSON.parse(serialized);
  check('JSON idéntico tras importar',JSON.stringify(after)===serialized);
  check('Ocho cajones tras importar',after.floors[0].items.filter(s=>s.decalKind==='stall').length===8);
  check('Cuatro coches tras importar',after.floors[0].items.filter(s=>s.type==='car').length===4);
  check('Números idénticos tras importar',after.floors[0].items.filter(s=>s.decalKind==='stall').map(s=>s.number).join(',')==='1,2,3,4,5,6,7,8');
  check('Coordenadas y giro idénticos tras importar',stalls.every((s,i)=>['x','y','w','h','rotation','widthFt','lengthFt'].every(k=>s[k]===after.floors[0].items[i+1][k])));
  check('Nueve pavimentos de catálogo',['asphalt','alley','sidewalk','concrete','gravel','cobblestone','tile_floor','carpet','wood_floor'].every(k=>!!P.SURFACES[k]));
  check('Siete herramientas de marcas',Object.keys(P.TOOLS).length===7);
  check('Todos los decals son sin colisión',Object.values(P.TOOLS).every((kind,i)=>P.makeDecal(kind,1,1,{feetPerCell:5},'d'+i).blocksMovement===false));
  check('Decal sin flag se interpreta inerte',P.checkDecal({...stalls[0],blocksMovement:undefined}));
  check('Rotación omitida tiene defecto cero',P.checkDecal({...stalls[0],rotation:undefined}));
  let denied=false;try{P.checkDecal({...stalls[0],blocksMovement:true});}catch{denied=true}
  check('Se rechaza colisión activada',denied);
  denied=false;try{P.makeDecal('unsupported',1,1,{},'x')}catch{denied=true}
  check('Se rechaza decal desconocido',denied);
  const safe=P.createStalls({x:0,y:0},{count:1,rotation:NaN},()=>('q_'+(++id)))[0];
  check('Rotación inválida usa valor seguro',safe.rotation===0);
  // Un solo canvas por marca para la vista 2D y su CanvasTexture de Three.js.
  const previousDocument=globalThis.document;
  const ctx={fillRect(){},clearRect(){},beginPath(){},stroke(){},moveTo(){},lineTo(){},
   arc(){},fillText(){},save(){},restore(){},translate(){},scale(x,y){this.lastScale=[x,y]},transform(){},
   rotate(){},strokeRect(){},setLineDash(){},drawImage(image){this.lastImage=image;}};
  if(!globalThis.document)globalThis.document={createElement(name){
   if(name!=='canvas')throw Error('Se esperaba canvas');return {width:0,height:0,getContext:()=>ctx};
  }};
  class CanvasTexture{constructor(image){this.image=image}}
  class PlaneGeometry{constructor(width,height){this.parameters={width,height}}}
  class MeshBasicMaterial{constructor(config){Object.assign(this,config)}}
  class Mesh{constructor(geometry,material){this.geometry=geometry;this.material=material;this.rotation={};}}
  class Group{constructor(){this.children=[];this.rotation={};this.position={set:(x,y,z)=>this.coords={x,y,z}};}add(item){this.children.push(item);}}
  const THREE={CanvasTexture,PlaneGeometry,MeshBasicMaterial,Mesh,Group,
   NearestFilter:10,sRGBEncoding:11,DoubleSide:12};
  try{
   const story=new Group(),meshes=P.attachFloor(THREE,{floors:[{items:stalls}],units:{feetPerCell:5}},story,0,1.524);
   check('Ocho mallas planas en 3D',meshes.length===8&&story.children.length===8);
   const geometry=meshes[0].children[0].geometry.parameters;
   check('Geometría 3D de 9×18 pies',Math.abs(geometry.width-9*.3048)<1e-8&&Math.abs(geometry.height-18*.3048)<1e-8);
   check('Decals elevados sobre los pisos',meshes.every(m=>m.coords.y>.039));
   check('No escribir profundidad al dibujar marcas',meshes.every(m=>m.children[0].material.depthWrite===false));
   check('Mosaico 72×144 sin suavizado',meshes[0].children[0].material.map.image.width===72&&
    meshes[0].children[0].material.map.image.height===144&&meshes[0].children[0].material.map.minFilter===THREE.NearestFilter);
   P.draw2D(ctx,stalls[0],p=>({x:p.x,y:p.y}),48,64,false,5);
   check('Canvas idéntico en editor y Three.js',ctx.lastImage===meshes[0].children[0].material.map.image);
   check('Dibujo 2D respeta cuadrícula no cuadrada',ctx.lastScale[0]===48&&ctx.lastScale[1]===64);
  }finally{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
  return {passed,total,fixture:project};
 };
});
