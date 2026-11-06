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
const safeModel=/^(puerta_madera|puerta_metal|puerta_mirilla|puerta_cristal_simple|puerta_cristal_antipanico|puerta_cristal_tintada|ventana_clasica|ventana_dividida)$/;
const loaded=new Map();
let loaderPromise=null;

function chooseDoor(d,it){
 if(!d||!['single','double'].includes(d.family)||!it)return null;
 if(it.type==='peephole_door')return d.family==='single'&&!d.transparent?'puerta_mirilla':null;
 if(it.type!=='door')return null;
 if(d.transparent){
  if(it.architectureSkin)return ['puerta_cristal_simple','puerta_cristal_antipanico','puerta_cristal_tintada'].includes(it.architectureSkin)?it.architectureSkin:null;
  return 'puerta_cristal_simple';
 }
 return d.variant==='metal'?'puerta_metal':d.variant==='wood'?'puerta_madera':null;
}
function chooseWindow(it){return it?.windowSkin==='dividida'?'ventana_dividida':'ventana_clasica';}
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
function decorateDoor(d,it,THREE,sightMask){
 const model=chooseDoor(d,it);if(!model)return;
 const count=d.family==='double'?2:1;
 if(!Array.isArray(d.animated)||d.animated.length!==count||!d.frame?.parent||!d.hinge?.parent)return;
 const parts=d.animated;
 load(model).then(scene=>{
  if(!d.hinge?.parent||!d.frame?.parent||parts.some(p=>!p.group?.parent))return;
  const leaves=parts.map(()=>cloneNode(scene,'HOJA_PIVOTE'));
  const frames=parts.map(part=>{
   const fixed=new THREE.Group();
   fixed.position.set(part.group.position.x,part.group.position.y,part.group.position.z);
   fixed.rotation.y=part.base; // En la segunda hoja, el motor ya suma PI.
   fixed.add(cloneNode(scene,'MARCO_FIJO'));
   return fixed;
  });
  for(const node of [...leaves,...frames])applyFOW(node,sightMask);
  const originalLeaves=parts.map(part=>part.group.children.slice());
  const originalFrame=d.frame.children.slice();
  parts.forEach((part,i)=>part.group.add(leaves[i]));
  for(const fixed of frames)d.frame.add(fixed);
  for(const original of originalLeaves)for(const visual of original)hideLegacyVisual(visual);
  for(const visual of originalFrame)hideLegacyVisual(visual);
  d.skinId=model;
 }).catch(error=>reportFailure(model,error));
}
function decorateWindow(args){
 const {it,container,built,a,angle,sightMask}=args||{};
 if(!it||!container||!Array.isArray(built)||!a)return;
 // Los dos primeros son antepecho y dintel; deben permanecer siempre.
 const originalPaneAndSideFrames=built.slice(2);
 if(originalPaneAndSideFrames.length!==3)return;
 load(chooseWindow(it)).then(scene=>{
  if(!container.parent)return;
  const node=scene.clone(true);
  node.position.set(a.x,.83,a.z);
  node.rotation.y=angle;
  applyFOW(node,sightMask);
  container.add(node);
  for(const visual of originalPaneAndSideFrames)hideLegacyVisual(visual,true);
 }).catch(error=>reportFailure(chooseWindow(it),error));
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
 const hook="\n window.FHArchitectureSkins?.decorateWindow({it,THREE,container:stories[f],built:stories[f].children.slice(fhWinVisualStart),a,b,angle,sightMask:installVisibility});";
 out=out.slice(0,begin)+part.slice(0,last)+hook+part.slice(last)+out.slice(end);
 const script='<script src="'+scriptUrl.href+'"></scr'+'ipt>';
 const headEnd=out.indexOf('</head>');
 if(headEnd<0)throw Error('El documento del motor no contiene cierre de head');
 // El motor menciona '</head>' en strings de sus scripts: solo se inserta en
 // el primer cierre HTML real, sin exigir exclusividad global del texto.
 return out.slice(0,headEnd)+script+out.slice(headEnd);
}
global.FHArchitectureSkins=Object.freeze({chooseDoor,chooseWindow,decorateDoor,decorateWindow,patchEngineDoc,load});
})(window);
