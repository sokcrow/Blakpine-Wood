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
const safeModel=/^(puerta_madera|puerta_metal|puerta_mirilla|ventana_clasica|ventana_dividida)$/;
const loaded=new Map();
let loaderPromise=null;

function chooseDoor(d,it){
 if(!d||d.family!=='single')return null;
 if(it?.type==='peephole_door')return 'puerta_mirilla';
 if(d.transparent)return null;
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
 const animated=d.animated?.[0]?.group;
 if(!animated||!d.frame||!d.hinge)return;
 const pivot={x:animated.position.x,y:animated.position.y,z:animated.position.z,rotation:d.animated[0].base};
 load(model).then(scene=>{
  if(!d.hinge?.parent||!d.frame?.parent)return;
  const leaf=cloneNode(scene,'HOJA_PIVOTE'),frameMesh=cloneNode(scene,'MARCO_FIJO');
  const fixed=new THREE.Group();
  fixed.position.set(pivot.x,pivot.y,pivot.z);
  fixed.rotation.y=pivot.rotation;
  fixed.add(frameMesh);
  applyFOW(leaf,sightMask);applyFOW(fixed,sightMask);
  const originalLeaf=animated.children.slice(),originalFrame=d.frame.children.slice();
  animated.add(leaf);d.frame.add(fixed);
  for(const mesh of originalLeaf)hideLegacyVisual(mesh);
  for(const mesh of originalFrame)hideLegacyVisual(mesh);
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
