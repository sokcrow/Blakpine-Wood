/* Blakpine-Wood — adaptador CCTV para el motor 3D embebido. */
(function(global){
 'use strict';
 const scriptUrl=new URL(document.currentScript.src,document.baseURI);
 const jsUrl=new URL('fh-cctv.js',scriptUrl).href;
 function replaceOnce(doc,needle,replacement){
  const count=doc.split(needle).length-1;
  if(count!==1)throw Error('Hook CCTV incompatible ('+count+'): '+needle.slice(0,70));
  return doc.replace(needle,replacement);
 }
 function patch(source){
  if(typeof source!=='string')throw Error('Documento del motor CCTV no válido');
  // El motor compuesto contiene "</head>" también dentro de strings embebidos.
  // Insertar únicamente en el cierre del head del documento raíz.
  const headStart=source.indexOf('<head>'),headEnd=source.indexOf('</head>',headStart);
  if(headStart<0||headEnd<0)throw Error('Hook CCTV incompatible: falta head del motor');
  let doc=source.slice(0,headEnd)+'<script src="'+jsUrl+'"></script>'+source.slice(headEnd);
  const computers='window.FHComputerRuntime=window.FHComputer?.createRuntime({';
  const runtime=String.raw`
const fhCCTV=window.FHCCTV.createRuntime(DATA.floors);
const fhCCTVFormats=Object.freeze({
 hd:{width:960,height:552,intervalMs:100},
 normal:{width:640,height:368,intervalMs:84}
});
let fhCCTVTarget=null,fhCCTVView=null,fhCCTVRead=null,fhCCTVFrameStamp=-1,fhCCTVFormat=null;
const fhCCTVWhite=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1,THREE.RGBAFormat);
fhCCTVWhite.needsUpdate=true;
let fhCCTVModels=[],fhCCTVLastScan=-2000;
function fhCCTVVisuals(now){
 // Reindexar al cargar modelos GLB asíncronos; actualizar giros aun sin terminal abierta.
 if(now-fhCCTVLastScan>1200){
  fhCCTVLastScan=now;fhCCTVModels=[];
  scene.traverse(root=>{
   if(root.userData?.fhModelId!=='camara_seguridad'||!root.userData?.fhItemId)return;
   const pivot=root.getObjectByName('CAM_YAW');
   if(pivot)fhCCTVModels.push({id:root.userData.fhItemId,pivot});
  });
 }
 for(const cam of fhCCTVModels){
  const angle=fhCCTV.angleFor(cam.id,now);
  if(angle!==null)cam.pivot.rotation.y=-angle*Math.PI/180;
 }
}
function fhCCTVFrame(now){
 fhCCTVVisuals(now);
 const pc=window.FHComputerRuntime;
 if(!pc?.isOpen)return;
 const api=pc.terminalApi?.(),screen=api?.getState?.(),session=pc.session;
 if(!screen?.power||screen?.mode!=='on'||screen?.front!=='cams')return;
 const selected=session?.cameras?.[screen.camera];
 if(!selected?.online)return;
 const format=screen.cameraQuality==='normal'?fhCCTVFormats.normal:fhCCTVFormats.hd;
 if(fhCCTVTarget&&fhCCTVFormat!==format){fhCCTVTarget.dispose();fhCCTVTarget=null;}
 if(now-fhCCTVFrameStamp<format.intervalMs&&fhCCTVTarget)return;
 const cameraPose=fhCCTV.view(selected.id,now,CELL,floorElev);
 if(!cameraPose)return;
 if(!fhCCTVTarget){
  fhCCTVFormat=format;
  fhCCTVTarget=new THREE.WebGLRenderTarget(format.width,format.height,{
   minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true
  });
  fhCCTVView=new THREE.PerspectiveCamera(65,format.width/format.height,.05,190);
  fhCCTVRead=new Uint8Array(format.width*format.height*4);
 }
 fhCCTVFrameStamp=now;
 fhCCTVView.fov=cameraPose.fovDeg;fhCCTVView.updateProjectionMatrix();
 fhCCTVView.position.set(cameraPose.x,cameraPose.y,cameraPose.z);
 fhCCTVView.lookAt(cameraPose.x-Math.sin(cameraPose.bearing),cameraPose.y,cameraPose.z+Math.cos(cameraPose.bearing));
 const oldTarget=renderer.getRenderTarget(),oldMask=sightUniform.value;
 const oldHero=hero.visible,oldShadow=shadow.visible;
 const oldAmbient=ambient.intensity,oldFlashlight=flashlightSpot.intensity;
 const oldLights=roomDynamicLights.map(light=>({intensity:light.intensity,position:light.position.clone()}));
 const storyVisibility=stories.map(story=>story.visible);
 const oldCutaways=occlusionRoots[cameraPose.floor].map(root=>[root,root.visible]);
 const oldFixtures=roomLampEntries.filter(entry=>entry.floor===cameraPose.floor)
  .map(entry=>[entry,entry.lit.visible,entry.dark.visible]);
 const objects=[];
 scene.traverse(obj=>{
  if(obj.userData&&Object.prototype.hasOwnProperty.call(obj.userData,'fhSightVisible')){
   objects.push([obj,obj.visible]);obj.visible=true;
  }
 });
 const oldActors=[];
 if(typeof fhSightActors!=='undefined')for(const [actor,floorSource] of fhSightActors){
  const f=typeof floorSource==='function'?floorSource():floorSource;
  if(f===cameraPose.floor){oldActors.push([actor,actor.visible]);actor.visible=true;}
 }
 try{
  // La cámara ve el mundo real, sin la máscara FOW ni los recortes de muros del jugador.
  sightUniform.value=fhCCTVWhite;
  stories.forEach((story,i)=>story.visible=i===cameraPose.floor);
  for(const [root] of oldCutaways)root.visible=true;
  if(cameraPose.floor!==currentFloor){hero.visible=false;shadow.visible=false;flashlightSpot.intensity=0;}

  // Las luces de Three.js normalmente siguen al jugador. Reubicarlas solo durante
  // esta captura en la planta/estancia observada, y restaurarlas antes del frame siguiente.
  const localRoom=roomAt(cameraPose.floor,cameraPose.x,cameraPose.z);
  const failing=typeof fhHorrorLightsFail==='function'&&fhHorrorLightsFail(now);
  ambient.intensity=lighting.roomLit(cameraPose.floor,localRoom)&&!failing?.37:.075;
  const blocked=sightWalls[cameraPose.floor].slice();
  for(const door of doorList[cameraPose.floor])if(!door.transparent&&!door.passable)blocked.push(door.block);
  const available=failing?[]:(window.FHLights?.sourcesNear
   ?window.FHLights.sourcesNear(roomLampEntries,lighting,cameraPose.floor,cameraPose.x,cameraPose.z,8,10)
   :lighting.sourcesNear(roomLampEntries,cameraPose.floor,cameraPose.x,cameraPose.z,7.2,7.2,12));
  const active=available.filter(entry=>window.FHLights?.lightReachesPoint
   ?window.FHLights.lightReachesPoint(entry,cameraPose.x,cameraPose.z,blocked,ForestShared.pointInSight)
   :ForestShared.lightReachesPoint(entry,cameraPose.x,cameraPose.z,blocked))
   .slice(0,roomDynamicLights.length);
  roomDynamicLights.forEach((light,i)=>{
   const entry=active[i];
   light.intensity=entry?(failing?.05:1.58):0;
   if(entry)light.position.set(entry.x,floorElev[entry.floor]+2.32,entry.z);
  });
  for(const [entry] of oldFixtures){
   const lit=lighting.fixtureLit(entry.floor,entry.room,entry.lamp)&&!failing;
   entry.lit.visible=lit;entry.dark.visible=!lit;
  }

  renderer.setRenderTarget(fhCCTVTarget);
  renderer.render(scene,fhCCTVView);
  renderer.readRenderTargetPixels(fhCCTVTarget,0,0,format.width,format.height,fhCCTVRead);
 }catch(error){
  console.warn('[CCTV] Falló un fotograma:',error);
  return;
 }finally{
  renderer.setRenderTarget(oldTarget);
  sightUniform.value=oldMask;hero.visible=oldHero;shadow.visible=oldShadow;
  ambient.intensity=oldAmbient;flashlightSpot.intensity=oldFlashlight;
  roomDynamicLights.forEach((light,i)=>{
   light.intensity=oldLights[i].intensity;light.position.copy(oldLights[i].position);
  });
  stories.forEach((story,i)=>story.visible=storyVisibility[i]);
  for(const [obj,visible] of objects)obj.visible=visible;
  for(const [root,visible] of oldCutaways)root.visible=visible;
  for(const [actor,visible] of oldActors)actor.visible=visible;
  for(const [entry,lit,dark] of oldFixtures){entry.lit.visible=lit;entry.dark.visible=dark;}
 }
 // WebGL entrega filas invertidas respecto a Canvas2D.
 const pixels=new Uint8ClampedArray(fhCCTVRead.length),row=format.width*4;
 for(let y=0;y<format.height;y++)pixels.set(
  fhCCTVRead.subarray(y*row,(y+1)*row),(format.height-1-y)*row
 );
 api.receiveCameraPixels?.({
  id:selected.id,width:format.width,height:format.height,pixels,angleDeg:cameraPose.angleDeg
 });
}
`;
  doc=replaceOnce(doc,computers,runtime+'\n'+computers);
  const cameraList=/cameras:\(\)=>DATA\.floors\.flatMap\(f=>\(f\.items\|\|\[\]\)\.filter\(it=>it\.modelId==='camara_seguridad'\|\|it\.type==='camera'\)\s*\.map\(it=>\(\{id:it\.id,place:it\.label\|\|it\.id,online:it\.cameraOnline!==false\}\)\)\),/g;
  const matches=[...doc.matchAll(cameraList)];
  if(matches.length!==1)throw Error('Conexiones CCTV incompatibles ('+matches.length+')');
  doc=doc.replace(cameraList,'cameras:()=>fhCCTV.list(performance.now()),\n onCameraControl:(id,angle)=>fhCCTV.setManualAngle(id,angle),');
  // El diagnósticador de 3D sustituye el cierre del frame antes de ejecutar este hook.
  // Admitir tanto su cierre instrumentado como el del motor sin instrumentar.
  const frameAnchors=[
   'circleMask();if(!frame.fhReady&&!window.FHPreviewDiagnostics?.failed){',
   'circleMask();requestAnimationFrame(frame);'
  ];
  const matching=frameAnchors.filter(anchor=>doc.includes(anchor));
  if(matching.length!==1)throw Error('Hook CCTV incompatible: cierre de frame ('+matching.length+')');
  doc=replaceOnce(doc,matching[0],'fhCCTVFrame(now);\n '+matching[0]);
  return doc;
 }
 global.FHCCTVEngine=Object.freeze({patch});
})(window);
