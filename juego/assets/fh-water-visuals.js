/* Agua 01 — representación GLB, frente absoluto y lectura del medidor.
 * La fuente de verdad de suministro/drenaje permanece en FHServices.
 * Montaje de pared: espalda del GLB Z=0, frente +Z y separación del muro 0.080 m.
 * Montaje suelo: toda la geometría Y>=0. Sin alterar colisiones ni FOW.
 */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)root.FHWaterVisuals=Object.freeze(api);
})(typeof window!=='undefined'?window:globalThis,function(root){
 'use strict';
 const FT=.3048,WALL_HALF=.065,CLEARANCE=.015;
 const base=root.document?.currentScript?.src?new URL('../../forest-horror/biblioteca/agua/',root.document.currentScript.src):null;
 const scriptBase=root.document?.currentScript?.src?new URL('.',root.document.currentScript.src):null;
 const DEFAULT=Object.freeze({water_main:'medidor_agua',water_valve:'llave_paso_principal',water_outlet:'toma_agua_pared',drain_outlet:'desague_pared'});
 const catalog=()=>root.FHWaterCatalog?.models||[];
 const byId=id=>catalog().find(m=>m.id===id)||null;
 const choose=it=>{
  const selected=byId(it?.utilitySkin);
  if(selected&&selected.type===it.type)return selected;
  return byId(DEFAULT[it?.type])||null;
 };
 const normal=rotation=>{const rad=(Number(rotation)||0)*Math.PI/180;return {x:-Math.sin(rad),y:Math.cos(rad)};};
 function frontAllowed(it,x,y){
  const meta=choose(it);if(!meta||meta.mount!=='wall')return true;
  const n=normal(it.rotation);
  return (Number(x)-Number(it.x))*n.x+(Number(y)-Number(it.y))*n.y>=.012;
 }
 function wallMount(it,items,shared){
  if(!shared||typeof shared.switchWallMount!=='function')return null;
  const mount=shared.switchWallMount(items,{x:Number(it.x),y:Number(it.y)},
   {wallId:it.wallId||undefined,maxDistance:it.wallId?.12:.55,
    ...(Number.isFinite(Number(it.rotation))?{rotation:Number(it.rotation)}:{})});
  const wall=(items||[]).find(x=>x.id===mount?.wallId);
  return wall&&['wall','red_wall','property_wall'].includes(wall.type)?mount:null;
 }
 function floorPlacement(it,meta,items,CELL){
  // Los cuerpos de piso no penetran paredes: corregir únicamente su representación,
  // sin mover los nodos del grafo de suministro ni los datos JSON existentes.
  const p={x:Number(it.x)||0,y:Number(it.y)||0};
  const radiusFt=Math.hypot(Number(meta.widthFt)||0,Number(meta.depthFt)||0)/2;
  const minCells=(radiusFt*FT+WALL_HALF+CLEARANCE)/CELL;
  let best=null;
  for(const wall of items||[]){
   if(!['wall','red_wall','property_wall'].includes(wall.type)||!wall.a||!wall.b)continue;
   const dx=wall.b.x-wall.a.x,dy=wall.b.y-wall.a.y,d2=dx*dx+dy*dy;
   if(d2<1e-6)continue;
   const t=Math.max(0,Math.min(1,((p.x-wall.a.x)*dx+(p.y-wall.a.y)*dy)/d2));
   const q={x:wall.a.x+t*dx,y:wall.a.y+t*dy};
   const vx=p.x-q.x,vy=p.y-q.y,dist=Math.hypot(vx,vy);
   if(dist>=minCells||best&&best.dist<dist)continue;
   const nx=-dy/Math.sqrt(d2),ny=dx/Math.sqrt(d2);
   const sign=dist>.001?(vx*nx+vy*ny<0?-1:1):(normal(it.rotation).x*nx+normal(it.rotation).y*ny<0?-1:1);
   best={q,nx:nx*sign,ny:ny*sign,dist};
  }
  return best?{x:best.q.x+best.nx*minCells,y:best.q.y+best.ny*minCells}:p;
 }
 function mountPose(it,meta,items,CELL,shared){
  if(!it||!meta||!Number.isFinite(Number(it.x))||!Number.isFinite(Number(it.y)))return null;
  if(meta.mount==='floor'){
   const p=floorPlacement(it,meta,items,CELL);
   return {x:p.x*CELL,z:p.y*CELL,y:.008,rotation:-(Number(it.rotation)||0)*Math.PI/180,mount:'floor'};
  }
  const m=wallMount(it,items,shared);if(!m)return null;
  return {x:m.point.x*CELL+m.normal.x*(WALL_HALF+CLEARANCE),z:m.point.y*CELL+m.normal.y*(WALL_HALF+CLEARANCE),
    y:(Number.isFinite(Number(it.utilityMountHeightFt))?Number(it.utilityMountHeightFt):meta.mountHeightFt)*FT,
    rotation:-m.rotation*Math.PI/180,mount:'wall',wallId:m.wallId};
 }
 let loaderPromise=null;const loaded=new Map();
 function loader(THREE){
  if(!loaderPromise)loaderPromise=new Promise((resolve,reject)=>{
   if(THREE.GLTFLoader)return resolve(new THREE.GLTFLoader());
   if(!root.document||!scriptBase)return reject(Error('GLTFLoader no disponible'));
   const script=root.document.createElement('script');script.src=new URL('vendor/GLTFLoader.js',scriptBase).href;
   script.onload=()=>THREE.GLTFLoader?resolve(new THREE.GLTFLoader()):reject(Error('GLTFLoader no pudo cargarse'));
   script.onerror=()=>reject(Error('No pudo cargarse GLTFLoader'));
   root.document.head.appendChild(script);
  });return loaderPromise;
 }
 function load(meta,THREE){
  if(!loaded.has(meta.id))loaded.set(meta.id,loader(THREE).then(l=>new Promise((resolve,reject)=>{
   if(!base)return reject(Error('Kit Agua 01 sin ruta de instalación'));
   l.load(new URL(meta.glb,base).href,gltf=>{
    const scene=gltf.scene;
    scene.traverse(node=>{if(!node.isMesh)return;node.castShadow=false;node.receiveShadow=true;
     for(const mat of Array.isArray(node.material)?node.material:[node.material]){
      if(!mat?.map)continue;mat.map.magFilter=THREE.NearestFilter;mat.map.minFilter=THREE.NearestMipmapNearestFilter;mat.map.needsUpdate=true;
     }});resolve(scene);
   },undefined,reject);
  })).catch(e=>{loaded.delete(meta.id);throw e;}));
  return loaded.get(meta.id);
 }
 function onUse(it,f,service,notify,x,y){
  const meta=choose(it);if(!meta||typeof notify!=='function')return false;
  const T=root.FH_WATER_TEXT||{};
  if(meta.mount==='wall'&&!frontAllowed(it,x,y)){
   notify(T.wrongSide||'Usa el dispositivo desde su frente.');return true;
  }
  if(meta.id==='medidor_agua'){
   const liters=Math.max(0,Number(service?.state?.meters?.waterLiters)||0);
   notify(T.meterReading?.(liters)||('Medidor de agua: '+liters.toFixed(1)+' litros registrados.'));
   return true;
  }
  if(meta.id==='calentador_agua'){
   const available=service?.waterStatus?.(f,it)?.water===true;
   notify(available?(T.heaterWater||'Calentador con suministro de agua. No se simula temperatura.'):
    (T.heaterNoWater||'Calentador sin suministro de agua.'));
   return true;
  }
  return false;
 }
 function install({THREE,DATA,CELL,stories,renderedByItem,ForestShared,applyFOW}){
  const result=[];
  for(let f=0;f<(DATA?.floors?.length||0);f++){
   const items=DATA.floors[f].items||[];
   for(const it of items){
    const meta=choose(it);if(!meta)continue;
    const pose=mountPose(it,meta,items,CELL,ForestShared);if(!pose)continue;
    const originals=(renderedByItem[f]?.get?.(it.id)||[]).map(o=>o.root||o).filter(Boolean);
    const root3D=new THREE.Group();root3D.name='FH_AGUA_'+it.id;root3D.userData.fhServiceItem=it.id;
    root3D.position.set(pose.x,pose.y,pose.z);root3D.rotation.y=pose.rotation;stories[f]?.add(root3D);
    result.push({it,meta,pose,root:root3D});
    load(meta,THREE).then(scene=>{
     if(!root3D.parent)return;
     const instance=scene.clone(true);if(typeof applyFOW==='function')applyFOW(instance);
     root3D.add(instance);root3D.userData.fhModelState='ready';
     for(const old of originals)if(old.parent&&old!==root3D)old.parent.remove(old);
     renderedByItem[f]?.set?.(it.id,[{root:root3D}]);
    }).catch(error=>{
     root3D.userData.fhModelState='error';
     console.warn('[Agua 01]',root.FH_WATER_TEXT?.loadError||'No se pudo cargar el GLB',meta.id,error);
     // Fallback procedural, con funcionalidad intacta.
    });
   }
  }
  return result;
 }
 function once(doc,before,after){
  if(doc.split(before).length!==2)throw Error('Agua 01: punto de integración incompatible: '+before.slice(0,72));
  return doc.replace(before,after);
 }
 function patchEngineDoc(doc){
  if(typeof doc!=='string')throw new TypeError('Se requiere el HTML del motor Three.js');
  doc=once(doc,'function fhServicesSyncVisuals(){',
    'const fhWaterVisuals=window.FHWaterVisuals?.install({THREE,DATA,CELL,stories,renderedByItem,ForestShared,applyFOW:installVisibility});\nfunction fhServicesSyncVisuals(){');
  const handle='handle:(it,f)=>{\n  const service=window.FHServicesRuntime,T=window.FH_SERVICES_TEXT||{};';
  doc=once(doc,handle,handle+
   '\n  if(window.FHWaterVisuals?.choose(it)?.mount==="wall"&&!window.FHWaterVisuals.frontAllowed(it,user.x/CELL,user.z/CELL)){notice(window.FH_WATER_TEXT?.wrongSide||"Usa el dispositivo desde su frente.");return true;}'+
   '\n  if(window.FHWaterVisuals?.onUse(it,f,service,notice,user.x/CELL,user.z/CELL))return true;');
  const rootURL=new URL('./juego/assets/',root.document?.baseURI||'https://localhost/');
  const tags=['fh-water-catalog.js','fh-water-strings.js','fh-water-visuals.js'].map(f=>'<script src="'+new URL(f,rootURL).href+'"></scr'+'ipt>').join('');
  const head=doc.indexOf('</head>');if(head<0)throw Error('Agua 01: no se encontró la cabecera del motor');
  return doc.slice(0,head)+tags+doc.slice(head);
 }
 return {DEFAULT,byId,choose,normal,frontAllowed,wallMount,floorPlacement,mountPose,onUse,install,patchEngineDoc,load};
});
