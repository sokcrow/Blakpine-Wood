/* Se compone al final: preserva los anclajes de arquitectura, servicios y cámaras. */
(function(root){
 'use strict';
 const scriptURL=new URL(document.currentScript?.src||'./juego/assets/fh-forest-engine-hook.js',document.baseURI);
 function once(doc,before,after){const count=doc.split(before).length-1;if(count!==1)throw Error('Hook de bosque incompatible ('+count+'): '+before.slice(0,90));return doc.replace(before,after);}
 function patch(source){
  let doc=source;
  const state='const GameState=createGameState(restored||DATA.initialGameState);';
  doc=once(doc,state,state+`
GameState.environment=structuredClone(restored?.environment||DATA.initialGameState?.environment||{});
const fhForest=window.FHForest.createRuntime(DATA,GameState,{
 getFloor:()=>currentFloor,save:()=>saveProgress(),refresh:()=>{visibilityDirty=true;}
});
window.FHForestRuntime=fhForest;
function fhForestSight(f,segments){segments.forestFloor=f;return segments;}
function fhGroundRise(f,x,z){return fhForest.heightAt(x,z,f);}
window.ForestHorrorEnvironmentAPI=Object.freeze({
 removeTree:id=>fhForest.removeTree(id),getTree:id=>fhForest.getTree(id),
 heightAt:(x,z)=>floorElev[fhForest.terrain.mainFloor]+fhForest.heightAt(x,z),
 slopeAt:fhForest.slopeAt,vegetationAt:(x,z,r=0)=>fhForest.nearby(x,z,r),
 reservedAt:fhForest.reservedAt,evaluateConstruction:fhForest.evaluateConstruction
});`);
  // Una consulta compartida de colisión para jugador y NPC; troncos circulares.
  doc=once(doc,' const radius=ctx.radius;',` const radius=ctx.radius;
 const forest=window.FHForestRuntime;
 for(const tree of forest?.collisionCandidates(ctx.forestFloor??forest.getCurrentFloor(),x,y,radius)||[]){
  if(Math.hypot(x-tree.x,y-tree.z)<radius+tree.radius)return true;
 }`);
  doc=doc.replace(/objects:furnitureColliders\[(currentFloor|f)\]/g,'forestFloor:$1,objects:furnitureColliders[$1]');
  // Los arrays llevan la planta del observador, también para CCTV independiente.
  doc=doc.replace(/sightWalls\[([^\]\n]+)\]\.slice\(\)/g,'fhForestSight($1,sightWalls[$1].slice())');
  doc=once(doc,' for(const wall of segments){\n  const dx=wall.x2-wall.x1,dz=wall.z2-wall.z1;',` const forest=window.FHForestRuntime;
 const trunks=segments.forestFloor===undefined?[]:forest?.collisionCandidates(segments.forestFloor,x,z,maxRange)||[];
 for(const wall of segments.concat(trunks)){
  if(Number.isFinite(wall.radius)){
   const dx=x-wall.x,dz=z-wall.z,a=dir.x*dir.x+dir.z*dir.z;
   const b=dx*dir.x+dz*dir.z,c=dx*dx+dz*dz-wall.radius*wall.radius,disc=b*b-a*c;
   if(a>0&&disc>=0){const t=(-b-Math.sqrt(disc))/a;if(t>=0&&t<result)result=t;else if(c<0)result=0;}
   continue;
  }
  const dx=wall.x2-wall.x1,dz=wall.z2-wall.z1;`);
  // El suelo natural reemplaza únicamente el plano neutro de PB. Las losas permanecen.
  const base='if(f===mainFloorIndex||(f>mainFloorIndex&&!SLABS[f].enabled))for(const r of surfaceRectsMinusVoids(f,0,0,GRID_X,GRID_Z))';
  doc=once(doc,base,'if((f===mainFloorIndex&&!fhForest.enabled)||(f>mainFloorIndex&&!SLABS[f].enabled))for(const r of surfaceRectsMinusVoids(f,0,0,GRID_X,GRID_Z))');
  doc=once(doc,'if(!items.length&&!(f>0&&SLABS[f].spans?.length)){grids.push(debugGrid(f));return}',
   'if(!items.length&&!(f>0&&SLABS[f].spans?.length)&&!(fhForest.enabled&&f===mainFloorIndex)){grids.push(debugGrid(f));return}');
  const ready='installVisibility();window.FHAssets?.setSightMaskInstaller(installVisibility);';
  doc=once(doc,ready,ready+`
const fhForestVisuals=window.FHForestVisuals.install({THREE,runtime:fhForest,parent:stories[mainFloorIndex],
 baseURL:${JSON.stringify(new URL('../../forest-horror/biblioteca/vegetacion/',scriptURL).href)},
 surfaceRects:surfaceRectsMinusVoids(mainFloorIndex,0,0,GRID_X,GRID_Z).map(r=>({x:r.x*CELL,z:r.y*CELL,w:r.w*CELL,d:r.h*CELL})),
 applySightMask:installVisibility,onError:(error,id)=>{console.error('[Blakpine bosque]',id,error);notice(window.FH_FOREST_TEXT.assetError);}
});
window.FHForestVisualRuntime=fhForestVisuals;
fhForestVisuals.ready.catch(error=>{console.error('[Blakpine bosque]',error);});
window.addEventListener('beforeunload',()=>fhForestVisuals.dispose());`);
  // El FOW existente necesita la transformación de cada instancia para enmascararla.
  doc=once(doc,'fhPos=(modelMatrix*vec4(position,1.)).xyz;',
   'vec4 fhWorld=vec4(position,1.);\\n#ifdef USE_INSTANCING\\nfhWorld=instanceMatrix*fhWorld;\\n#endif\\nfhPos=(modelMatrix*fhWorld).xyz;');
  const drained='const visualBase=(passenger?(elevatorCabMeshes.get(passenger.id)?.position.y??floorElev[currentFloor]):floorElev[currentFloor])+fhDrainActorDrop;';
  doc=once(doc,drained,drained.replace(')+fhDrainActorDrop;',')+fhDrainActorDrop+fhGroundRise(currentFloor,user.x,user.z);'));
  for(const before of [
   'const y=shaft?(elevatorCabMeshes.get(shaft.id)?.position.y??floorElev[currentFloor]):floorElev[currentFloor];',
   'const lightBase=occupiedShaft()?(elevatorCabMeshes.get(occupiedShaft().id)?.position.y??floorElev[currentFloor]):floorElev[currentFloor];'
  ])doc=once(doc,before,before.replace(':floorElev[currentFloor];',':floorElev[currentFloor]+fhGroundRise(currentFloor,user.x,user.z);'));
  doc=once(doc,'y:floorElev[currentFloor]+HERO_H*1.12','y:floorElev[currentFloor]+HERO_H*1.12+fhGroundRise(currentFloor,user.x,user.z)');
  doc=once(doc,'y:floorElev[currentFloor]+.15','y:floorElev[currentFloor]+.15+fhGroundRise(currentFloor,user.x,user.z)');
  doc=once(doc,'fhDeliveryNpc.position.set(point.x,1.05,point.z);','fhDeliveryNpc.position.set(point.x,1.05+fhGroundRise(point.floor,point.x,point.z),point.z);');
  const baseURL=new URL('../../',scriptURL);
  const files=['fh-forest-strings.js','fh-terrain.js','fh-forest-catalog.js','fh-forest.js','fh-forest-visuals.js','vendor/GLTFLoader.js'];
  const scripts=files.map(file=>'<script src="'+new URL('juego/assets/'+file+'?v=20261114-forest1',baseURL).href+'"></scr'+'ipt>').join('');
  const headEnd=doc.indexOf('</head>');if(headEnd<0)throw Error('Motor sin cabecera para el bosque');
  return doc.slice(0,headEnd)+scripts+doc.slice(headEnd);
 }
 root.FHForestEngine=Object.freeze({patch});
})(window);
