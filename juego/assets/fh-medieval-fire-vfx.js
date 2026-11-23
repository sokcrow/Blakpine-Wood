/* Fuego medieval tridimensional y conductos exteriores: geometría de bajo coste.
 * No crea luces nuevas ni modifica el sistema eléctrico, visibilidad o combustible.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHMedievalFireVisual=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const FT=.3048;
 const burning=new Set(['torch_wall','torch_hand','candle','candelabrum',
  'oil_lantern','brazier','campfire','fireplace']);
 const flames=[],chimneys=[];
 const flameSites=Object.freeze({
  torch_wall:[[0,.71,.05,.13]],torch_hand:[[0,.99,0,.13]],
  candle:[[0,.28,0,.075]],
  candelabrum:[[-.245,1.22,0,.07],[0,1.22,0,.07],[.245,1.22,0,.07]],
  oil_lantern:[[0,.34,0,.095]],
  brazier:[[0,.70,0,.30]],
  campfire:[[0,.26,0,.43]],
  fireplace:[[0,.27,.07,.30]]
 });
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const inFootprint=(slab,x,y)=>!!slab?.enabled&&Array.isArray(slab.spans)&&
  slab.spans.some(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h);
 function chimneyTopFt(floors,slabs,at,x,y){
  let roof=-Infinity;
  for(let i=at;i<floors.length;i++){
   const floor=floors[i];
   if(!floor||floor.__fhRoofCap)continue;
   // El nivel de origen siempre tiene cubierta de referencia. Los superiores
   // cuentan sólo cuando su volumen está efectivamente sobre la chimenea.
   if(i!==at&&!inFootprint(slabs?.[i],x,y))continue;
   const base=(Number(floor.elevationFt)||0)+(Number(floor.ceilingHeightFt)||11.5);
   const rise=floor.roof?.shape==='gable'?Math.max(0,Math.min(30,Number(floor.roof.riseFt)||0)):0;
   roof=Math.max(roof,base+rise);
  }
  return roof+10;
 }
 function attach(THREE,root,lamp){
  const sites=flameSites[lamp?.lightKind];
  if(!sites||!root||!THREE)return null;
  const group=new THREE.Group();root.add(group);
  // Pirámides de varios lados: volumen real desde todos los ángulos, no planos.
  const amber=new THREE.MeshBasicMaterial({color:0xff882a,transparent:true,opacity:.9,depthWrite:false});
  const gold=new THREE.MeshBasicMaterial({color:0xffdc69,transparent:true,opacity:.92,depthWrite:false});
  const emberMat=new THREE.MeshBasicMaterial({color:0xffb34a});
  const tongues=[],embers=[];
  for(const [x,y,z,r]of sites){
   for(const [scale,dy,mat]of [[1,0,amber],[.63,.04,gold]]){
    const mesh=new THREE.Mesh(new THREE.ConeGeometry(r*scale,r*3*scale,5),mat);
    mesh.position.set(x,y+dy+r*scale,z);group.add(mesh);tongues.push({mesh,x,scale});
   }
   const ember=new THREE.Mesh(new THREE.IcosahedronGeometry(r*.13,0),emberMat);
   ember.position.set(x,y+r,z);group.add(ember);embers.push({mesh:ember,originY:y,r});
  }
  const entry={root,group,lamp,tongues,embers,phase:flames.length*1.71};flames.push(entry);
  group.visible=false;return entry;
 }
 function buildChimneys(THREE,data,cell,floorElev,layers){
  if(!THREE||!data?.floors||!layers)return [];
  const slabs=data.roofSlabsByFloor||data.slabsByLevel||[];
  const result=[];
  const stone=new THREE.MeshLambertMaterial({color:0x76736c});
  const rim=new THREE.MeshLambertMaterial({color:0x57534d});
  const soot=new THREE.MeshBasicMaterial({color:0x242320});
  const smokeMat=new THREE.MeshBasicMaterial({color:0x8e8a82,transparent:true,opacity:.28,depthWrite:false});
  for(let f=0;f<data.floors.length;f++){
   const floor=data.floors[f];
   if(floor.__fhRoofCap)continue;
   for(const item of floor.items||[]){
    if(item.type!=='light_fixture'||item.lightKind!=='fireplace')continue;
    const x=Number(item.x),y=Number(item.y);
    if(!Number.isFinite(x)||!Number.isFinite(y))continue;
    const topFt=chimneyTopFt(data.floors,slabs,f,x,y);
    if(!Number.isFinite(topFt))continue;
    const originFt=Number(floor.elevationFt)||0;
    const bottom=(floorElev[f]||0)+.12,top=(floorElev[f]||0)+(topFt-originFt)*FT;
    const height=top-bottom;
    if(height<=0)continue;
    const rotation=(Number(item.rotation)||0)*Math.PI/180;
    const xWorld=x*cell-Math.sin(rotation)*.52,zWorld=y*cell-Math.cos(rotation)*.52;
    const group=new THREE.Group();group.position.set(xWorld,0,zWorld);
    const shaft=new THREE.Mesh(new THREE.BoxGeometry(.70,height,.64),stone);
    shaft.position.y=bottom+height/2;group.add(shaft);
    const collar=new THREE.Mesh(new THREE.BoxGeometry(.85,.21,.80),rim);
    collar.position.y=top-.09;group.add(collar);
    const mouth=new THREE.Mesh(new THREE.BoxGeometry(.42,.018,.40),soot);
    mouth.position.y=top+.018;group.add(mouth);
    const smoke=[];
    for(let i=0;i<3;i++){
     const puff=new THREE.Mesh(new THREE.IcosahedronGeometry(.12,0),smokeMat);
     puff.position.set(0,top+.2+i*.22,0);puff.visible=false;
     group.add(puff);smoke.push(puff);
    }
    layers[f].add(group);
    const entry={floor:f,item,group,top,smoke};
    chimneys.push(entry);result.push(entry);
   }
  }
  return result;
 }
 let clock=0;
 function tick(dt,runtime){
  clock+=Math.max(0,Math.min(.05,Number(dt)||0));
  for(const flame of flames){
   const on=runtime?.lit?.(flame.lamp.floorIndex??flame.lamp.__floorIndex??flame.floor??0,flame.lamp);
   // La planta está guardada en attach para las luminarias multiarea.
   flame.group.visible=!!on;
   if(!on)continue;
   const t=clock*9+flame.phase;
   for(const [i,v]of flame.tongues.entries()){
    v.mesh.scale.set(1+Math.sin(t+i)*.12,.83+Math.sin(t*1.37+i*1.2)*.22,1+Math.cos(t+i)*.08);
    v.mesh.rotation.z=Math.sin(t*.7+i)*.13;
   }
   for(const [i,v]of flame.embers.entries()){
    const phase=(clock*.7+i*.34+flame.phase)%1;
    v.mesh.position.y=v.originY+v.r+phase*v.r*2;
    v.mesh.visible=phase<.80;
   }
  }
  for(const shaft of chimneys){
   const lit=runtime?.lit?.(shaft.floor,shaft.item)===true;
   for(const [i,puff]of shaft.smoke.entries()){
    puff.visible=lit;
    if(!lit)continue;
    const p=(clock*.24+i/3)%1;
    puff.position.set(Math.sin(clock*.6+i)*.07,shaft.top+.15+p*1.3,Math.cos(clock*.5+i)*.06);
    puff.scale.setScalar(.8+p*2);
   }
  }
 }
 function reset(){flames.length=0;chimneys.length=0;clock=0;}
 return Object.freeze({burning,flameSites,chimneyTopFt,attach,buildChimneys,tick,reset});
});
