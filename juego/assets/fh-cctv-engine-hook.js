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
  let doc=replaceOnce(source,'</head>','<script src="'+jsUrl+'"><\\/script>'.replace('<\\/script>','</script>')+'</head>');
  const computers='window.FHComputerRuntime=window.FHComputer?.createRuntime({';
  const runtime=String.raw`
const fhCCTV=window.FHCCTV.createRuntime(DATA.floors);
let fhCCTVTarget=null,fhCCTVView=null,fhCCTVRead=null,fhCCTVFrameStamp=-1;
const fhCCTVWhite=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1,THREE.RGBAFormat);
fhCCTVWhite.needsUpdate=true;
function fhCCTVFrame(now){
 const pc=window.FHComputerRuntime;
 if(!pc?.isOpen)return;
 const api=pc.terminalApi?.(),screen=api?.getState?.(),session=pc.session;
 if(!screen?.power||screen?.mode!=='on'||screen?.front!=='cams')return;
 const selected=session?.cameras?.[screen.camera];
 if(!selected?.online||now-fhCCTVFrameStamp<250)return;
 const cameraPose=fhCCTV.view(selected.id,now,CELL,floorElev);
 if(!cameraPose)return;
 fhCCTVFrameStamp=now;
 if(!fhCCTVTarget){
  fhCCTVTarget=new THREE.WebGLRenderTarget(320,184,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:true});
  fhCCTVView=new THREE.PerspectiveCamera(65,320/184,.05,190);
  fhCCTVRead=new Uint8Array(320*184*4);
 }
 fhCCTVView.fov=cameraPose.fovDeg;fhCCTVView.updateProjectionMatrix();
 fhCCTVView.position.set(cameraPose.x,cameraPose.y,cameraPose.z);
 fhCCTVView.lookAt(cameraPose.x-Math.sin(cameraPose.bearing),cameraPose.y,cameraPose.z+Math.cos(cameraPose.bearing));
 const oldTarget=renderer.getRenderTarget(),oldMask=sightUniform.value;
 const oldHero=hero.visible,oldShadow=shadow.visible;
 const objects=[];
 scene.traverse(obj=>{
  // Solo reponer por un instante la ocultación FOW del jugador.
  if(obj.userData&&Object.prototype.hasOwnProperty.call(obj.userData,'fhSightVisible')){
   objects.push([obj,obj.visible]);obj.visible=true;
  }
 });
 try{
  sightUniform.value=fhCCTVWhite;
  if(cameraPose.floor!==currentFloor){hero.visible=false;shadow.visible=false;}
  renderer.setRenderTarget(fhCCTVTarget);
  renderer.render(scene,fhCCTVView);
  renderer.readRenderTargetPixels(fhCCTVTarget,0,0,320,184,fhCCTVRead);
 }catch(error){
  console.warn('[CCTV] Falló un fotograma:',error);
  return;
 }finally{
  renderer.setRenderTarget(oldTarget);
  sightUniform.value=oldMask;hero.visible=oldHero;shadow.visible=oldShadow;
  for(const [obj,visible] of objects)obj.visible=visible;
 }
 // WebGL devuelve píxeles desde abajo; Canvas2D los espera desde arriba.
 const pixels=new Uint8ClampedArray(fhCCTVRead.length),row=320*4;
 for(let y=0;y<184;y++)pixels.set(fhCCTVRead.subarray(y*row,(y+1)*row),(183-y)*row);
 api.receiveCameraPixels?.({id:selected.id,width:320,height:184,pixels,angleDeg:cameraPose.angleDeg});
}
`;
  doc=replaceOnce(doc,computers,runtime+'\n'+computers);
  const cameraList=/cameras:\(\)=>DATA\.floors\.flatMap\(f=>\(f\.items\|\|\[\]\)\.filter\(it=>it\.modelId==='camara_seguridad'\|\|it\.type==='camera'\)\s*\.map\(it=>\(\{id:it\.id,place:it\.label\|\|it\.id,online:it\.cameraOnline!==false\}\)\)\),/g;
  const matches=[...doc.matchAll(cameraList)];
  if(matches.length!==1)throw Error('Conexiones CCTV incompatibles ('+matches.length+')');
  doc=doc.replace(cameraList,'cameras:()=>fhCCTV.list(performance.now()),\n onCameraControl:(id,angle)=>fhCCTV.setManualAngle(id,angle),');
  doc=replaceOnce(doc,'circleMask();requestAnimationFrame(frame);','fhCCTVFrame(now);\n circleMask();requestAnimationFrame(frame);');
  return doc;
 }
 global.FHCCTVEngine=Object.freeze({patch});
})(window);
