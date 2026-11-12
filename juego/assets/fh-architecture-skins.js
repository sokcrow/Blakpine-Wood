/* Forest Horror — Kit Arquitectura 01: skins visuales de puertas y ventanas.
 * No sustituye puertas, colisiones, mirillas, luz, FOW ni el JSON del mapa.
 * Adaptador del kit suministrado; los originales son fallback si falla un GLB.
 */
(function(global){
'use strict';
const scriptUrl=document.currentScript?.src
 ?new URL(document.currentScript.src,document.baseURI)
 :new URL('./fh-architecture-skins.js',document.baseURI);
const libraryBase=new URL('../../forest-horror/biblioteca/arquitectura/',scriptUrl);
const safeModel=/^(puerta_madera|puerta_metal|puerta_mirilla|puerta_cristal_simple|puerta_cristal_antipanico|puerta_cristal_tintada|puerta_electronica_opaca|puerta_electronica_reja|teclado_pin|lector_tarjeta|ventana_clasica|ventana_dividida)$/;
const electronicDoors=new Set(['puerta_electronica_opaca','puerta_electronica_reja']);
const loaded=new Map();
let loaderPromise=null;

function chooseDoor(d,it){
 if(!d||!['single','double'].includes(d.family)||!it)return null;
 if(it.type==='peephole_door')return d.family==='single'&&!d.transparent?'puerta_mirilla':null;
 if(it.type!=='door')return null;
 if(electronicDoors.has(it.architectureSkin)){
  if(d.family!=='single')return null; // Solo los nuevos modelos: una hoja. No alterar puertas dobles.
  if(it.architectureSkin==='puerta_electronica_reja')return d.transparent?it.architectureSkin:null;
  return !d.transparent&&d.variant==='metal'?it.architectureSkin:null;
 }
 if(d.transparent){
  if(it.architectureSkin)return ['puerta_cristal_simple','puerta_cristal_antipanico','puerta_cristal_tintada'].includes(it.architectureSkin)?it.architectureSkin:null;
  return 'puerta_cristal_simple';
 }
 return d.variant==='metal'?'puerta_metal':d.variant==='wood'?'puerta_madera':null;
}
function chooseWindow(it){return it?.windowSkin==='dividida'?'ventana_dividida':'ventana_clasica';}
// Una ventana GLB ocupa exactamente una casilla: nunca se escala para cubrir un tramo.
function windowTilePlan(it){
 if(!it?.a||!it?.b)return null;
 const dx=Number(it.b.x)-Number(it.a.x),dy=Number(it.b.y)-Number(it.a.y);
 const length=Math.hypot(dx,dy);
 if(!Number.isFinite(length)||length<.05)return null;
 return {count:Math.max(1,Math.ceil(length-1e-6)),length,ux:dx/length,uy:dy/length};
}
function splitWindow(it,newId){
 if(it?.type!=='window')return [it];
 const plan=windowTilePlan(it);
 if(!plan)return [it];
 if(plan.count>1&&typeof newId!=='function')throw new TypeError('Se requieren IDs únicos para cada ventana');
 const point=t=>({
  x:Math.round((Number(it.a.x)+plan.ux*t)*1e6)/1e6,
  y:Math.round((Number(it.a.y)+plan.uy*t)*1e6)/1e6
 });
 return Array.from({length:plan.count},(_,i)=>({
  ...it,id:i===0?it.id:newId(),a:point(i),b:point(i+1)
 }));
}
function loader(){
 if(!loaderPromise)loaderPromise=new Promise((resolve,reject)=>{
  const THREE=global.THREE;
  if(!THREE)return reject(Error('Three.js no está disponible'));
  if(THREE.GLTFLoader)return resolve(new THREE.GLTFLoader());
  const script=document.createElement('script');
  script.src=new URL('./vendor/GLTFLoader.js',scriptUrl).href;
  script.onload=()=>THREE.GLTFLoader?resolve(new THREE.GLTFLoader()):reject(Error('GLTFLoader no pudo iniciarse'));
  script.onerror=()=>reject(Error('GLTFLoader no disponible'));
  document.head.appendChild(script);
 });
 return loaderPromise;
}
function load(id){
 if(!safeModel.test(id))return Promise.reject(Error('Modelo de arquitectura no reconocido'));
 if(!loaded.has(id))loaded.set(id,loader().then(l=>new Promise((resolve,reject)=>{
  l.load(new URL('modelos_glb/'+id+'.glb',libraryBase).href,glb=>{
   glb.scene.traverse(obj=>{
    if(!obj.isMesh)return;
    obj.castShadow=false;obj.receiveShadow=true;
    for(const mat of Array.isArray(obj.material)?obj.material:[obj.material]){
     if(mat?.map){
      mat.map.magFilter=global.THREE.NearestFilter;
      mat.map.minFilter=global.THREE.NearestMipmapNearestFilter;
      mat.map.needsUpdate=true;
     }
    }
   });
   resolve(glb.scene);
  },undefined,reject);
 })).catch(err=>{loaded.delete(id);throw err;}));
 return loaded.get(id);
}
function applyFOW(root,fn){if(typeof fn==='function')fn(root);}
function reportFailure(id,error){
 console.warn('[Forest Arquitectura] Se conserva el placeholder:',id,error);
 if(global.parent&&global.parent!==global){
  global.parent.postMessage({type:'FOREST_ARCHITECTURE_ERROR',id,reason:String(error?.message||error)},'*');
 }
}
function cloneNode(scene,name){
 const source=scene.getObjectByName(name);
 if(!source)throw Error('Falta nodo '+name);
 return source.clone(true);
}
function hideLegacyVisual(node,detach=false){
 node.visible=false;
 // Ventanas: updateSegmentSight reestablece root.visible cada frame.
 // Desacoplar solo la malla gráfica evita que reaparezca. Los colliders y FOW
 // siguen guardando sus datos y sus referencias originales.
 if(detach&&node.parent)node.parent.remove(node);
}
function accessDeviceId(it){
 return it?.accessDevice==='pin'?'teclado_pin':it?.accessDevice==='card'?'lector_tarjeta':null;
}
function mountAccessDevice(fixed,it,THREE,sightMask,d){
 const id=accessDeviceId(it);
 if(!id||!fixed?.parent)return;
 // El lector está sujeto al MARCO_FIJO, nunca a la hoja que gira.
 const sides=it.accessSide==='both'?[1,-1]:[it.accessSide==='back'?-1:1];
 function place(scene,sign){
  if(!fixed.parent||d?.readerDestroyed||global.FHStructureHealthRuntime?.isDestroyed?.(d?.f,it.id,'reader'))return;
  const node=scene.clone(true);
  node.position.set(.045,1.12,sign*.1);
  if(sign<0)node.rotation.y=Math.PI;
  applyFOW(node,sightMask);
  fixed.add(node);
  if(d)(d.accessVisuals||(d.accessVisuals=[])).push(node);
 }
 load(id).then(scene=>{for(const sign of sides)place(scene,sign);}).catch(error=>{
  reportFailure(id,error);
  if(typeof THREE.BoxGeometry!=='function'||typeof THREE.Mesh!=='function'||typeof THREE.MeshBasicMaterial!=='function')return;
  // Reserva geométrica pequeña sólo cuando el GLB está realmente indisponible.
  for(const sign of sides){
   const marker=new THREE.Mesh(new THREE.BoxGeometry(.13,.24,.045),
    new THREE.MeshBasicMaterial({color:0xb000ff}));
   marker.position.set(.045,1.24,sign*.105);
   applyFOW(marker,sightMask);
   if(fixed.parent&&!d?.readerDestroyed){fixed.add(marker);if(d)(d.accessVisuals||(d.accessVisuals=[])).push(marker);}
  }
 });
}
function decorateDoor(d,it,THREE,sightMask){
 const model=chooseDoor(d,it);if(!model)return;
 const double=d.family==='double',count=double?2:1;
 if(!Array.isArray(d.animated)||d.animated.length!==count||!d.frame?.parent||!d.hinge?.parent)return;
 const parts=d.animated;
 for(const part of parts)global.FHAssets?.markPlaceholder(part.group,sightMask);
 if(!double)global.FHAssets?.markPlaceholder(d.frame,sightMask);
 load(model).then(scene=>{
  if(!d.hinge?.parent||!d.frame?.parent||parts.some(p=>!p.group?.parent))return;
  const leaves=parts.map(()=>cloneNode(scene,'HOJA_PIVOTE'));
  if(double){
   // Dos copias de UNA sola hoja, con la segunda orientada 180° por el motor.
   // Se unen por los cantos interiores. No generar un GLB doble ni un poste.
   const first=parts[0].group.position,second=parts[1].group.position;
   const halfSpan=Math.hypot(second.x-first.x,second.z-first.z)/2;
   const farEdge=new THREE.Box3().setFromObject(leaves[0]).max.x;
   if(!Number.isFinite(halfSpan)||halfSpan<=0||!Number.isFinite(farEdge)||farEdge<=0){
    throw Error('No se puede calcular el encuentro de las dos hojas');
   }
   // Escalar solo las hojas, no sus grupos de bisagra ni las colisiones.
   // El extremo libre de cada hoja llega exactamente al centro del vano.
   const stretch=halfSpan/farEdge;
   for(const leaf of leaves)leaf.scale.x*=stretch;
  }
  // Una puerta simple lleva su marco GLB completo. La doble usa exclusivamente
  // el dintel y las dos jambas EXTERIORES del motor, nunca dos marcos completos.
  const frames=double?[]:parts.map(part=>{
   const fixed=new THREE.Group();
   fixed.position.set(part.group.position.x,part.group.position.y,part.group.position.z);
   fixed.rotation.y=part.base;
   fixed.add(cloneNode(scene,'MARCO_FIJO'));
   return fixed;
  });
  for(const node of [...leaves,...frames])applyFOW(node,sightMask);
  const originalLeaves=parts.map(part=>part.group.children.slice());
  const originalFrame=double?[]:d.frame.children.slice();
  parts.forEach((part,i)=>part.group.add(leaves[i]));
  for(const fixed of frames)d.frame.add(fixed);
  if(!double&&electronicDoors.has(model)&&frames[0])mountAccessDevice(frames[0],it,THREE,sightMask,d);
  for(const original of originalLeaves)for(const visual of original)hideLegacyVisual(visual);
  // Con una 'T' o pared divisoria se dibujan dos puertas independientes:
  // cada puerta simple conserva su marco completo.
  for(const visual of originalFrame)hideLegacyVisual(visual);
  d.skinId=model;
 }).catch(error=>reportFailure(model,error));
}
function decorateWindow(args){
 const {it,container,built,a,b,angle,sightMask,floor,onReady}=args||{};
 if(!it||!container||!Array.isArray(built)||!a||global.FHStructureHealthRuntime?.isDestroyed?.(floor,it.id))return;
 // El antepecho y el dintel originales mantienen su colisión y visibilidad.
 const originalPaneAndSideFrames=built.slice(2);
 if(originalPaneAndSideFrames.length!==3)return;
 for(const visual of originalPaneAndSideFrames)global.FHAssets?.markPlaceholder(visual,sightMask);
 const plan=windowTilePlan(it),count=plan?.count||1;
 // Los mapas antiguos pueden contener un solo segmento de varios tiles.
 // Se colocan N instancias individuales, espaciadas un tile, sin escalar el GLB.
 const stepX=plan?(b?(b.x-a.x)/plan.length:plan.ux*1.524):0;
 const stepZ=plan?(b?(b.z-a.z)/plan.length:plan.uy*1.524):0;
 const model=chooseWindow(it);
 load(model).then(scene=>{
  if(!container.parent||global.FHStructureHealthRuntime?.isDestroyed?.(floor,it.id))return;
  const windows=[];
  for(let i=0;i<count;i++){
   const node=scene.clone(true);
   node.position.set(a.x+stepX*i,.83,a.z+stepZ*i);
   node.rotation.y=angle;
   applyFOW(node,sightMask);
   windows.push(node);
  }
  for(const node of windows){container.add(node);global.FHStructureHealthRuntime?.registerWindowVisual?.(floor,it.id,node);}
  for(const visual of originalPaneAndSideFrames)hideLegacyVisual(visual,true);
  if(typeof onReady==='function')onReady(windows);
 }).catch(error=>reportFailure(model,error));
}
// Al cargar el GLB de una ventana, renovar las copias de fachada entre pisos.
// La geometría original se sigue mostrando en rosa si falla la carga.
function syncExteriorWindowFacade({floor,item,nodes,proxies,layers,cutaways,elevation,cutSet}={}){
 if(!Array.isArray(nodes)||!nodes.length||!Array.isArray(proxies)||!Array.isArray(layers)||!Array.isArray(cutaways))return 0;
 const previous=proxies.filter(p=>p.f===floor&&p.item===item);
 const layer=layers[floor];
 if(!previous.length||!layer)return 0; // No copiar ventanas que no pertenecen a una fachada.
 for(const entry of previous){
  if(entry.source?.parent)continue; // El antepecho y dintel todavía se usan.
  if(entry.clone?.parent)entry.clone.parent.remove(entry.clone);
  const index=proxies.indexOf(entry);
  if(index>=0)proxies.splice(index,1);
  for(let i=cutaways.length-1;i>=0;i--)if(cutaways[i].root===entry.clone)cutaways.splice(i,1);
  cutSet?.delete?.(entry.clone);
 }
 let added=0;
 for(const source of nodes){
  if(!source?.parent||proxies.some(p=>p.f===floor&&p.item===item&&p.source===source))continue;
  const clone=source.clone(true);
  clone.position.y+=Number(elevation?.[floor])||0;
  clone.visible=false; // La visibilidad la decide el motor, no el GLB.
  clone.userData.fhOcclusionRoot=true;
  layer.add(clone);
  proxies.push({source,clone,f:floor,item});
  cutaways.push({root:clone,f:floor});
  added++;
 }
 return added;
}
function one(source,anchor,replacement){
 const first=source.indexOf(anchor);
 if(first<0||source.indexOf(anchor,first+anchor.length)>=0)throw Error('Motor 3D no compatible con kit de arquitectura: '+anchor.slice(0,70));
 return source.slice(0,first)+replacement+source.slice(first+anchor.length);
}
function patchEngineDoc(doc){
 if(typeof doc!=='string')throw new TypeError('Se requiere documento HTML del motor 3D');
 let out=one(doc,'applyDoorPose(d);doorList[f].push(d);return d;',
  'applyDoorPose(d);doorList[f].push(d);window.FHArchitectureSkins?.decorateDoor(d,it,THREE,installVisibility);return d;');
 // Dos bisagras espejadas: la segunda gira en sentido contrario para abrir al mismo lado del muro.
 out=one(out,'else for(const part of d.animated)part.group.rotation.y=part.base+d.angle;',
  "else for(let i=0;i<d.animated.length;i++){const part=d.animated[i];part.group.rotation.y=part.base+(d.family==='double'&&i===1?-d.angle:d.angle);}");
 out=one(out,'function windowModel(f,it){',
  'function windowModel(f,it){const fhWinVisualStart=stories[f].children.length;');
 const begin=out.indexOf('function windowModel(f,it){'),end=out.indexOf('function doorTarget(d)',begin);
 if(begin<0||end<0)throw Error('No se encontró windowModel o doorTarget');
 const part=out.slice(begin,end),last=part.lastIndexOf('\n}');
 if(last<0)throw Error('No se encontró cierre de windowModel');
 const hook="\n window.FHArchitectureSkins?.decorateWindow({it,THREE,container:stories[f],built:stories[f].children.slice(fhWinVisualStart),a,b,angle,floor:f,sightMask:installVisibility,onReady:models=>window.FHArchitectureSkins?.syncExteriorWindowFacade({floor:f,item:it,nodes:models,proxies:exteriorProxies,layers:exteriorLayers,cutaways:exteriorCutawayRoots,elevation:floorElev,cutSet:wasCut})});";
 out=out.slice(0,begin)+part.slice(0,last)+hook+part.slice(last)+out.slice(end);
 const script='<script src="'+scriptUrl.href+'"></scr'+'ipt>';
 const headEnd=out.indexOf('</head>');
 if(headEnd<0)throw Error('El documento del motor no contiene cierre de head');
 // El motor menciona '</head>' en strings de sus scripts: solo se inserta en
 // el primer cierre HTML real, sin exigir exclusividad global del texto.
 return out.slice(0,headEnd)+script+out.slice(headEnd);
}
global.FHArchitectureSkins=Object.freeze({chooseDoor,chooseWindow,splitWindow,accessDeviceId,decorateDoor,decorateWindow,patchEngineDoc,load,syncExteriorWindowFacade});
})(window);

