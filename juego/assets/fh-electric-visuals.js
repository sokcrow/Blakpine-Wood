/* Electricidad 01 - solo apariencia 3D y consulta del medidor existente.
 * Reutiliza FHServices, la orientación switchWallMount, la FOW y los colliders del motor.
 * Convención GLB: pared Z>=0, frente +Z; techo Y<=0.
 */
(function(global,factory){
 'use strict';
 const api=factory(global);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(global?.document)global.FHElectricVisuals=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis,function(global){
 'use strict';
 const FT=.3048,HALF_WALL=.065,CLEARANCE=.012;
 const base=global.document?.currentScript?.src
  ?new URL('../../forest-horror/biblioteca/electricidad/',global.document.currentScript.src)
  :null;
 const scriptBase=global.document?.currentScript?.src
  ?new URL('.',global.document.currentScript.src):null;
 const DEFAULT=global.FHElectricCatalog?.DEFAULT||Object.freeze({});
 const catalog=()=>global.FHElectricCatalog?.models||[];
 const byId=id=>catalog().find(m=>m.id===id)||null;
 const choose=it=>global.FHElectricCatalog?.modelFor(it)||null;
 const normal=rotation=>{const r=(Number(rotation)||0)*Math.PI/180;return {x:-Math.sin(r),y:Math.cos(r)};};
 function frontAllowed(it,x,y){
  const meta=choose(it);
  if(!meta||meta.mount!=='wall')return true;
  const n=normal(it.rotation),offsetX=Number(x)-Number(it.x),offsetY=Number(y)-Number(it.y);
  return offsetX*n.x+offsetY*n.y>=.012;
 }
 function mountPose(it,meta,items,CELL,shared,ceilingFt=11.5){
  if(!it||!meta)return null;
  if(meta.mount==='ceiling'){
   const y=(Number.isFinite(Number(it.utilityMountHeightFt))&&Number(it.utilityMountHeightFt)>0?
    Number(it.utilityMountHeightFt):Number(ceilingFt)||11.5)*FT-.015;
   return {x:Number(it.x)*CELL,z:Number(it.y)*CELL,y,rotation:-(Number(it.rotation)||0)*Math.PI/180,mount:'ceiling'};
  }
  if(!shared||typeof shared.switchWallMount!=='function')return null;
  const target={x:Number(it.x),y:Number(it.y)};
  const rotation=Number.isFinite(Number(it.rotation))?{rotation:Number(it.rotation)}:{};
  let mount=shared.switchWallMount(items,target,{wallId:it.wallId||undefined,maxDistance:it.wallId?.12:.55,...rotation});
  // Un wallId antiguo puede quedar obsoleto al editar la arquitectura.
  // Sólo recuperar el modelo si existe otra pared estructural realmente cercana.
  if(!mount&&it.wallId)mount=shared.switchWallMount(items,target,{maxDistance:.55,...rotation});
  const wall=(items||[]).find(it=>it.id===mount?.wallId);
  if(!wall||!['wall','red_wall','property_wall'].includes(wall.type))return null;
  return {x:mount.point.x*CELL+mount.normal.x*(HALF_WALL+CLEARANCE),
   z:mount.point.y*CELL+mount.normal.y*(HALF_WALL+CLEARANCE),
   y:(it.utilityMountHeightFt!=null&&Number.isFinite(Number(it.utilityMountHeightFt))?Number(it.utilityMountHeightFt):meta.mountHeightFt)*FT,
   rotation:-mount.rotation*Math.PI/180,mount:'wall',wallId:mount.wallId};
 }
 let loaderPromise=null;const loaded=new Map();
 function loader(THREE){
  if(!loaderPromise)loaderPromise=new Promise((resolve,reject)=>{
   if(THREE.GLTFLoader)return resolve(new THREE.GLTFLoader());
   if(!global.document||!scriptBase)return reject(Error('No se encontró GLTFLoader'));
   const tag=global.document.createElement('script');tag.src=new URL('vendor/GLTFLoader.js',scriptBase).href;
   tag.onload=()=>THREE.GLTFLoader?resolve(new THREE.GLTFLoader()):reject(Error('No se encontró GLTFLoader'));
   tag.onerror=()=>reject(Error('No se pudo cargar GLTFLoader'));
   global.document.head.appendChild(tag);
  });
  return loaderPromise;
 }
 function load(meta,THREE){
  if(!loaded.has(meta.id)){
   const req=loader(THREE).then(l=>new Promise((resolve,reject)=>{
    if(!base)return reject(Error('No hay ruta del kit'));
    l.load(new URL(meta.glb,base).href,result=>{
     const scene=result.scene;
     scene.traverse(node=>{
      if(!node.isMesh)return;
      node.castShadow=false;node.receiveShadow=true;
      for(const mat of Array.isArray(node.material)?node.material:[node.material]){
       if(!mat?.map)continue;
       mat.map.magFilter=THREE.NearestFilter;mat.map.minFilter=THREE.NearestMipmapNearestFilter;
       mat.map.needsUpdate=true;
      }
     });resolve(scene);
    },undefined,reject);
   })).catch(e=>{loaded.delete(meta.id);throw e;});loaded.set(meta.id,req);
  }
  return loaded.get(meta.id);
 }
 function onUse(it,f,services,notify,x,y){
  if(!it||it.type!=='misc'||!byId(it.utilitySkin)||typeof notify!=='function')return false;
  if(!frontAllowed(it,x,y)){notify(global.FH_ELECTRIC_TEXT?.wrongSide||'Usa el dispositivo desde su frente.');return true;}
  const T=global.FH_ELECTRIC_TEXT||{};
  if(it.utilitySkin==='medidor_electrico'){
   const kwh=Math.max(0,Number(services?.state?.meters?.kwh)||0);
   if(global.FHElectricMeterHUD?.open(services)===true)return true;
   notify(T.meterReading?.(kwh)||('Lectura del medidor: '+kwh.toFixed(2)+' kWh.'));return true;
  }
  if(it.utilitySkin==='caja_conexiones'){
   notify(T.junction||'Caja de conexiones sin mecanismos configurables.');return true;
  }
  if(it.utilitySkin==='conduit_pared'){
   notify(T.conduit||'Canalización visible.');return true;
  }
  return false;
 }
 function install({THREE,DATA,CELL,stories,renderedByItem,ForestShared,applyFOW}){
  const visual=[];
  for(let f=0;f<(DATA?.floors?.length||0);f++){
   const floor=DATA.floors[f],items=floor.items||[];
   for(const it of items){
    const meta=choose(it);if(!meta)continue;
    for(const entry of renderedByItem[f]?.get?.(it.id)||[])global.FHAssets?.markPlaceholder(entry.root||entry,applyFOW);
    const pose=mountPose(it,meta,items,CELL,ForestShared,floor.ceilingHeightFt);if(!pose){console.warn('[Electricidad 01] Sin pared estructural para',meta.id,it.id);continue;}
    const existing=renderedByItem[f]?.get?.(it.id)||[];
    const old=existing.map(p=>p.root||p).filter(Boolean);
    const root=new THREE.Group();root.name='FH_ELECTRIC_'+it.id;root.userData.fhServiceItem=it.id;
    root.position.set(pose.x,pose.y,pose.z);root.rotation.y=pose.rotation;
    stories[f]?.add(root);
    const entry={it,meta,pose,root,old,f};visual.push(entry);
    load(meta,THREE).then(scene=>{
     if(!root.parent)return;
     const instance=scene.clone(true);if(typeof applyFOW==='function')applyFOW(instance);
     root.add(instance);root.userData.fhModelState='ready';
     for(const node of old)if(node.parent&&node!==root)node.parent.remove(node);
     renderedByItem[f]?.set?.(it.id,[{root}]);
    }).catch(error=>{
     root.userData.fhModelState='error';
     console.warn('[Electricidad 01]',global.FH_ELECTRIC_TEXT?.loadError||'No se pudo cargar el GLB',meta.id,error);
     // El placeholder original permanece visible si el GLB falla.
    });
   }
  }
  return visual;
 }
 function once(doc,oldText,newText){
  if(doc.split(oldText).length!==2)throw Error('Electricidad 01: punto de integración incompatible: '+oldText.slice(0,60));
  return doc.replace(oldText,newText);
 }
 function patchEngineDoc(doc){
  if(typeof doc!=='string')throw new TypeError('Se esperaba el documento HTML del motor 3D');
  doc=once(doc,'function fhServicesSyncVisuals(){',
   'const fhElectricVisuals=window.FHElectricVisuals?.install({THREE,DATA,CELL,stories,renderedByItem,ForestShared,applyFOW:installVisibility});\nfunction fhServicesSyncVisuals(){window.FHElectricMeterHUD?.refresh(window.FHServicesRuntime);');
  // Conserva el motor de servicios y su interacción, añadiendo el control de frente.
  const handle='handle:(it,f)=>{\n  const service=window.FHServicesRuntime,T=window.FH_SERVICES_TEXT||{};';
  doc=once(doc,handle,handle+'\n  if(window.FHElectricVisuals?.choose(it)?.mount==="wall"&&!window.FHElectricVisuals.frontAllowed(it,user.x/CELL,user.z/CELL)){notice(window.FH_ELECTRIC_TEXT?.wrongSide||"Usa el dispositivo desde su frente.");return true;}');
  doc=once(doc,'function useFurniture(item,selectedSeat=null){',
   'function useFurniture(item,selectedSeat=null){\n if(window.FHElectricVisuals?.onUse(item,currentFloor,window.FHServicesRuntime,notice,user.x/CELL,user.z/CELL))return;');
  const rootUrl=new URL('./juego/assets/',global.document?.baseURI||'https://localhost/');
  const scripts=['fh-electric-catalog.js?v=20261112-double-outlet-only-1','fh-electric-strings.js','fh-electric-meter-hud.js','fh-electric-visuals.js?v=20261112-outlet-auto-1'].map(p=>
   '<script src="'+new URL(p,rootUrl).href+'"></scr'+'ipt>').join('');
  const where=doc.indexOf('</head>');if(where<0)throw Error('Electricidad 01: falta la cabecera del motor');
  return doc.slice(0,where)+scripts+doc.slice(where);
 }
 return {DEFAULT,byId,choose,normal,frontAllowed,mountPose,onUse,install,patchEngineDoc,load};
});

