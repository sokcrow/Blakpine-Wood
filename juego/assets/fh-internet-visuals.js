/* Internet 01 — visuales independientes para servicios FHServices EXISTENTES.
 * El frente es +Z, la cara trasera de los props de pared está en Z=0.
 * No calcula redes, tarifas, colisiones ni visibilidad: reutiliza el motor.
 */
(function(global,factory){
  'use strict';
  const api=factory(global);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(global?.document)global.FHInternetVisuals=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis,function(global){
 'use strict';
 const FT=.3048, HALF_WALL=.065, GAP=.012;
 const INTERNET_TYPES=new Set(['router','ethernet_port','landline_phone']);
 const DEFAULT=Object.freeze({router:'router_wifi',ethernet_port:'toma_rj45',landline_phone:'telefono_pared'});
 const models=()=>global.FHInternetCatalog?.models||[];
 const byId=id=>models().find(m=>m.id===id)||null;
 const choose=it=>{
  const selected=byId(it?.utilitySkin);
  return selected?.type===it?.type?selected:byId(DEFAULT[it?.type]);
 };
 const isInternetType=type=>INTERNET_TYPES.has(type);
 const normal=rotation=>{const r=(Number(rotation)||0)*Math.PI/180;return {x:-Math.sin(r),y:Math.cos(r)};};
 function frontAllowed(it,x,y){
  const meta=choose(it);
  if(!meta||meta.mount!=='wall')return true;
  const n=normal(it.rotation);
  return (Number(x)-Number(it.x))*n.x+(Number(y)-Number(it.y))*n.y>=.012;
 }
 function mountPose(it,meta,items,CELL,shared){
  if(!it||!meta)return null;
  if(meta.mount==='floor')return {x:Number(it.x)*CELL,z:Number(it.y)*CELL,y:0,
   rotation:-(Number(it.rotation)||0)*Math.PI/180,mount:'floor'};
  if(!shared||typeof shared.switchWallMount!=='function')return null;
  const near=shared.switchWallMount(items,{x:Number(it.x),y:Number(it.y)},
   {wallId:it.wallId||undefined,maxDistance:it.wallId?.12:.55,
    ...(Number.isFinite(Number(it.rotation))?{rotation:Number(it.rotation)}:{})});
  if(!near||!['wall','red_wall','property_wall'].includes((items||[]).find(w=>w.id===near.wallId)?.type))return null;
  const offset=HALF_WALL+GAP;
  return {x:near.point.x*CELL+near.normal.x*offset,
   z:near.point.y*CELL+near.normal.y*offset,
   y:(Number.isFinite(Number(it.utilityMountHeightFt))?Number(it.utilityMountHeightFt):meta.mountHeightFt)*FT,
   rotation:-near.rotation*Math.PI/180,mount:'wall',wallId:near.wallId};
 }
 let loaderPromise=null;const cache=new Map();
 function getLoader(THREE){
  if(!loaderPromise)loaderPromise=new Promise((resolve,reject)=>{
   if(THREE.GLTFLoader)return resolve(new THREE.GLTFLoader());
   const script=document.createElement('script');
   script.src=new URL('./vendor/GLTFLoader.js',scriptUrl()).href;
   script.onload=()=>THREE.GLTFLoader?resolve(new THREE.GLTFLoader()):reject(Error('Falta GLTFLoader'));
   script.onerror=()=>reject(Error('GLTFLoader no disponible'));document.head.appendChild(script);
  });
  return loaderPromise;
 }
 function scriptUrl(){return global.document?.currentScript?.src||new URL('./juego/assets/fh-internet-visuals.js',global.document?.baseURI||'https://localhost/').href;}
 function load(meta,THREE){
  if(!cache.has(meta.id)){
   const req=getLoader(THREE).then(loader=>new Promise((resolve,reject)=>{
    const root=new URL('../../forest-horror/biblioteca/internet/',scriptUrl());
    loader.load(new URL(meta.glb,root).href,glb=>{
     glb.scene.traverse(node=>{
      if(!node.isMesh)return;
      node.castShadow=false;node.receiveShadow=true;
      for(const mat of Array.isArray(node.material)?node.material:[node.material]){
       if(!mat?.map)continue;
       mat.map.magFilter=THREE.NearestFilter;mat.map.minFilter=THREE.NearestMipmapNearestFilter;
       mat.map.needsUpdate=true;
      }
     });resolve(glb.scene);
    },undefined,reject);
   })).catch(e=>{cache.delete(meta.id);throw e;});cache.set(meta.id,req);
  }
  return cache.get(meta.id);
 }
 function install({THREE,DATA,CELL,stories,renderedByItem,ForestShared,applyFOW}){
  const results=[];
  for(let f=0;f<DATA.floors.length;f++){
   const items=DATA.floors[f].items||[];
   for(const item of items){
    if(!isInternetType(item.type))continue;
    const meta=choose(item),pose=mountPose(item,meta,items,CELL,ForestShared);
    if(!meta||!pose){console.warn('[Internet 01] Equipo sin pared válida o skin:',item.id);continue;}
    const root=new THREE.Group();root.name='FH_NET_'+item.id;root.userData.fhServiceItem=item.id;
    root.position.set(pose.x,pose.y,pose.z);root.rotation.y=pose.rotation;
    const originals=(renderedByItem[f]?.get?.(item.id)||[]).map(x=>x.root||x).filter(Boolean);
    stories[f]?.add(root);
    results.push({root,item,pose,meta});
    load(meta,THREE).then(scene=>{
     if(!root.parent)return;
     const instance=scene.clone(true);
     if(typeof applyFOW==='function')applyFOW(instance);
     root.add(instance);root.userData.fhModelState='ready';
     for(const old of originals)if(old.parent&&old!==root)old.parent.remove(old);
     renderedByItem[f]?.set?.(item.id,[{root}]);
    }).catch(error=>{root.userData.fhModelState='error';console.error('[Internet 01] Error al cargar:',meta.id,error);});
   }
  }
  return results;
 }
 function once(doc,needle,value){
  if(doc.split(needle).length!==2)throw Error('Integración Internet 01 incompatible: '+needle.slice(0,70));
  return doc.replace(needle,value);
 }
 function patchEngineDoc(doc){
  if(typeof doc!=='string')throw TypeError('Se requiere HTML del motor');
  // Reemplaza el placeholder solamente cuando el GLB se ha cargado.
  // Si falla la carga o falta una pared válida, el placeholder sigue visible.
  doc=once(doc,'function fhServicesSyncVisuals(){',
   'const fhInternetVisuals=window.FHInternetVisuals?.install({THREE,DATA,CELL,stories,renderedByItem,ForestShared,applyFOW:installVisibility});\nfunction fhServicesSyncVisuals(){');
  const handle='handle:(it,f)=>{\n  const service=window.FHServicesRuntime,T=window.FH_SERVICES_TEXT||{};';
  doc=once(doc,handle,handle+'\n  if(window.FHInternetVisuals.isInternetType(it.type)&&!window.FHInternetVisuals.frontAllowed(it,user.x/CELL,user.z/CELL)){notice(window.FH_INTERNET_TEXT?.wrongSide||"Usa el dispositivo desde su frente.");return true;}');
  const base=new URL('./juego/assets/',global.document?.baseURI||'https://localhost/');
  const scripts=['fh-internet-catalog.js','fh-internet-strings.js','fh-internet-visuals.js'].map(p=>
   '<script src="'+new URL(p,base).href+'"></scr'+'ipt>').join('');
  const h=doc.indexOf('</head>');if(h<0)throw Error('No se encontró cabecera del motor');
  return doc.slice(0,h)+scripts+doc.slice(h);
 }
 return {DEFAULT,choose,normal,isInternetType,frontAllowed,mountPose,install,patchEngineDoc,load};
});
