/* Ejecutar: node --test juego/assets/fh-cctv-engine-hook.test.js */
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const vm=require('node:vm');
const sandboxWindow={};
const oldWindow=global.window,oldDocument=global.document;
global.window=sandboxWindow;
global.document={currentScript:{src:'file://'+path.join(__dirname,'fh-cctv-engine-hook.js')},
 baseURI:'file://'+path.join(__dirname,'../index.html')};
require('./fh-cctv-engine-hook.js');
global.window=oldWindow;global.document=oldDocument;
// Derivar el fixture de la función real de visión; no mantener otra implementación.
const engineChunks=Array.from({length:13},(_,i)=>{
 const file=fs.readFileSync(path.join(__dirname,'engine-'+String(i).padStart(2,'0')+'.js'),'utf8');
 const match=file.match(/\+"([A-Za-z0-9+/=]+)";/);
 assert.ok(match,'Fragmento Base64 '+i);return match[1];
});
const baseEngine=Buffer.from(engineChunks.join(''),'base64').toString('utf8');
const sightStart=baseEngine.indexOf('function drawSight(){');
const sightEnd=baseEngine.indexOf('\nfunction installVisibility(){',sightStart);
assert.ok(sightStart>0&&sightEnd>sightStart,'Fuente real de drawSight');
const sightFragment=baseEngine.slice(sightStart,sightEnd);
const source=`<html><head></head><body><script>
${sightFragment}
function installVisibility(){}
function startGame(){
 window.FHComputerRuntime=window.FHComputer?.createRuntime({
  cameras:()=>DATA.floors.flatMap(f=>(f.items||[]).filter(it=>it.modelId==='camara_seguridad'||it.type==='camera')
   .map(it=>({id:it.id,place:it.label||it.id,online:it.cameraOnline!==false}))),
 });
 function frame(now){circleMask();requestAnimationFrame(frame);}
}
</script></body></html>`;
test('adaptador añade módulo CCTV y conserva motor, sin sustituir a RAVEN/OS',()=>{
 const patched=sandboxWindow.FHCCTVEngine.patch(source);
 assert.match(patched,/fh-cctv\.js/);
 assert.match(patched,/fhCCTV\.list\(performance\.now\(\)\)/);
 assert.match(patched,/onCameraControl:\(id,angle\)=>fhCCTV\.setManualAngle/);
 assert.match(patched,/fhCCTVFrame\(now\);/);
 assert.match(patched,/renderer\.readRenderTargetPixels\(/);
 assert.match(patched,/stories\.forEach\(/);
 const runtime=patched.slice(patched.indexOf('const fhCCTV='),patched.indexOf('window.FHComputerRuntime='));
 assert.doesNotThrow(()=>new Function(runtime));
});
test('adaptador rechaza fuentes sin los puntos de integración necesarios',()=>{
 assert.throws(()=>sandboxWindow.FHCCTVEngine.patch('<html><head></head></html>'),/Hook CCTV incompatible/);
});

test('P1: adapta el motor real con el cierre de frame instrumentado y varios </head>',()=>{
 // Los trece fragmentos son el mismo motor que el editor ejecuta en su iframe.
 let composed=baseEngine;
 assert.match(composed,/function frame\(now\)\{/);
 assert.match(composed,/circleMask\(\);requestAnimationFrame\(frame\);/);
 // El flujo real inyecta scripts en el head y RAVEN/OS en el motor.
 const cameraSource=[
  "window.FHComputerRuntime=window.FHComputer?.createRuntime({",
  " cameras:()=>DATA.floors.flatMap(f=>(f.items||[]).filter(it=>it.modelId==='camara_seguridad'||it.type==='camera')",
  "  .map(it=>({id:it.id,place:it.label||it.id,online:it.cameraOnline!==false}))),",
  "});"
 ].join('\n');
 composed=composed.replace('function frame(now){',cameraSource+'\nfunction frame(now){');
 const diagnostics="circleMask();if(!frame.fhReady&&!window.FHPreviewDiagnostics?.failed){frame.fhReady=true;if(window.FH_PREVIEW_TEXT?.engineReady)notice(window.FH_PREVIEW_TEXT.engineReady,5500);if(!window.FHPreviewDiagnostics?.frame)parent.postMessage({type:'FOREST_PREVIEW_RUNNING'},'*')}window.FHPreviewDiagnostics?.frame();requestAnimationFrame(frame);";
 const editor=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 assert.ok(editor.includes('circleMask();if(!frame.fhReady'),'El fixture respeta el punto real del diagnósticador');
 composed=composed.replace('circleMask();requestAnimationFrame(frame);',diagnostics);
 assert.ok(composed.split('</head>').length-1>1,'El motor real ya contiene varios </head>');
 const patched=sandboxWindow.FHCCTVEngine.patch(composed);
 assert.equal(patched.split('fh-cctv.js"></script>').length-1,1);
 assert.ok(patched.indexOf('fh-cctv.js"></script>')<patched.indexOf('</head>'));
 assert.match(patched,/cameras:\(\)=>fhCCTV.list\(performance.now\(\)\)/);
 assert.match(patched,/fhCCTVFrame\(now\);\s*circleMask\(\);if\(!frame.fhReady/);
 assert.match(patched,/window.FHPreviewDiagnostics\?\.frame\(\);requestAnimationFrame\(frame\);/);
});
test('P1: el receptor acepta vídeo HD de otro iframe y descarta tamaños erróneos',()=>{
 const source=fs.readFileSync(path.join(__dirname,'fh-terminal.html'),'utf8');
 const start=source.indexOf('receiveCameraPixels(frame){');
 const end=source.indexOf('setLogs(logs){',start);
 assert.ok(start>0&&end>start,'El método real está disponible');
 const method=source.slice(start,end).trim().replace(/,\s*$/,'');
 const pixels=vm.runInNewContext('new Uint8ClampedArray(960*552*4)');
 assert.equal(pixels instanceof Uint8ClampedArray,false,'La transferencia viene de otro realm');
 let draws=0;
 const canvas={width:960,height:552,getContext:()=>({putImageData(img){
  assert.ok(img.data instanceof Uint8ClampedArray);
  assert.equal(img.data.length,canvas.width*canvas.height*4);
  draws++;
 }})};
 const state={power:true,boot:false,camera:0,cameraQuality:'hd'};
 const DATA={cameras:[{id:'CAM-A',online:true,angleDeg:0}]};
 const status={textContent:''};
 class FakeImageData{
  constructor(data,width,height){
   assert.ok(data instanceof Uint8ClampedArray);
   assert.equal(width,canvas.width);assert.equal(height,canvas.height);
   this.data=data;this.width=width;this.height=height;
  }
 }
 const CCTV_VIDEO={hd:{width:960,height:552},normal:{width:640,height:368}};
 const make=new Function('state','DATA','$','ImageData','CCTV_VIDEO',
  'let cameraFrameReceived=false; return {api:{'+method+'},received:()=>cameraFrameReceived};');
 const session=make(state,DATA,id=>id==='camCanvas'?canvas:status,FakeImageData,CCTV_VIDEO);
 session.api.receiveCameraPixels({id:'CAM-A',width:960,height:552,pixels,angleDeg:20});
 assert.equal(draws,1);assert.equal(session.received(),true);
 assert.equal(DATA.cameras[0].angleDeg,20);
 assert.match(status.textContent,/960×552/);
 session.api.receiveCameraPixels({id:'CAM-A',width:960,height:552,pixels:new Uint8ClampedArray(4)});
 assert.equal(draws,1,'No dibujar frames truncados');
 state.cameraQuality='normal';canvas.width=640;canvas.height=368;
 session.api.receiveCameraPixels({id:'CAM-A',width:960,height:552,pixels});
 assert.equal(draws,1,'Descartar resolución anterior al cambio de calidad');
 const normal=vm.runInNewContext('new Uint8ClampedArray(640*368*4)');
 session.api.receiveCameraPixels({id:'CAM-A',width:640,height:368,pixels:normal});
 assert.equal(draws,2,'Aceptar modo rendimiento desde otro iframe');
});
test('captura CCTV restaura luces, muros y visibilidad del jugador',()=>{
 const patched=sandboxWindow.FHCCTVEngine.patch(source);
 const runtime=patched.slice(patched.indexOf('const fhCCTV='),patched.indexOf('window.FHComputerRuntime='));
 assert.doesNotThrow(()=>new Function(runtime));
 const CCTV=require('./fh-cctv.js');
 const wall={visible:false,userData:{fhSightVisible:false}};
 const hero={visible:true,position:{x:9,z:9}},shadow={visible:true,position:{x:9,z:9}};
 const ambient={intensity:.2},flashlightSpot={intensity:1.65};
 const poolLight={intensity:0.4,position:{
  x:1,y:2,z:3,clone(){return {x:this.x,y:this.y,z:this.z};},
  set(x,y,z){this.x=x;this.y=y;this.z=z;},
  copy(p){this.x=p.x;this.y=p.y;this.z=p.z;}
 }};
 const fixture={floor:0,x:9,z:10,room:{id:'R'},lamp:null,lit:{visible:false},dark:{visible:true}};
 const active={id:'c',modelId:'camara_seguridad',cameraMode:'fixed',x:6,y:6,rotation:0};
 const DATA={floors:[{items:[active]}]};
 const received=[];
 const screen={power:true,mode:'on',front:'cams',camera:0,cameraQuality:'hd'};
 const window={FHCCTV:CCTV,FHComputerRuntime:{
  isOpen:true,session:{cameras:[{id:'c',online:true}]},
  terminalApi:()=>({getState:()=>screen,receiveCameraPixels:frame=>received.push(frame)})
 }};
 const stories=[{visible:true}],sightUniform={value:'sight-mask'};
 const events=[],renderer={
  getRenderTarget:()=> 'player-target',
  setRenderTarget:target=>events.push(['target',target]),
  render(scene,camera){
   assert.equal(wall.visible,true,'El muro previamente recortado debe tapar la vista');
   assert.equal(ambient.intensity,.37,'La luz ambiente se calcula en la cámara');
   assert.equal(poolLight.intensity,1.58,'La luz de la estancia llega a la cámara');
   assert.equal(fixture.lit.visible,true,'El plafón se actualiza en la cámara');
   assert.notEqual(sightUniform.value,'sight-mask','La cámara usa su máscara propia');
   assert.equal(sightUniform.value.needsUpdate,true,'La máscara CCTV se actualiza antes del render');
  },
  readRenderTargetPixels(target,x,y,width,height,buffer){
   assert.equal(width,960);assert.equal(height,552);buffer.fill(127);
  }
 };
 const scene={traverse(cb){cb(wall)}};
 class WebGLRenderTarget{
  constructor(w,h){this.width=w;this.height=h;}
  dispose(){}
 }
 class CanvasTexture{constructor(canvas){this.canvas=canvas;this.needsUpdate=false;}}
 class PerspectiveCamera{
  constructor(fov,aspect){this.fov=fov;this.aspect=aspect;this.position={set(){}};}
  updateProjectionMatrix(){}
  lookAt(){}
 }
 const THREE={WebGLRenderTarget,CanvasTexture,PerspectiveCamera,LinearFilter:'linear',NearestFilter:'nearest',RGBAFormat:'rgba'};
 const mockContext={getImageData(){return {data:[255,255,255,255]};}};
 const document={createElement(){return {getContext(){return mockContext;}};}};
 const sightCanvas={width:20,height:32},sightTexture={minFilter:'near',magFilter:'near'};
 let observed=null;
 const drawSight=observer=>{observed=observer;observer.texture.needsUpdate=true;};
 const lighting={roomLit:()=>true,fixtureLit:()=>true,sourcesNear:()=>[fixture]};
 const ForestShared={lightReachesPoint:()=>true};
 // La prueba ejecuta el mismo cuerpo inyectado que utiliza el motor, con dobles de WebGL.
 const create=new Function('window','THREE','document','sightCanvas','sightTexture','drawSight',
  'MAX_X','MAX_Z','DATA','scene','renderer','hero','shadow','ambient','flashlightSpot',
  'roomDynamicLights','roomLampEntries','stories','occlusionRoots','sightUniform','lighting',
  'roomAt','sightWalls','doorList','ForestShared','CELL','floorElev','currentFloor',
  runtime+'\nreturn fhCCTVFrame;');
 const frame=create(window,THREE,document,sightCanvas,sightTexture,drawSight,
  100,100,DATA,scene,renderer,hero,shadow,ambient,flashlightSpot,
  [poolLight],[fixture],stories,[[wall]],sightUniform,lighting,
  ()=>fixture.room,[[]],[[]],ForestShared,1.5,[0],0);
 frame(1000);
 assert.ok(observed,'La captura usa drawSight desde la cámara');
 assert.equal(observed.floor,0);
 assert.notEqual(observed.canvas,sightCanvas,'El jugador mantiene su canvas');
 assert.notEqual(observed.texture,sightTexture,'El jugador mantiene su textura');
 assert.equal(observed.texture.needsUpdate,true);
 assert.equal(received.length,1);
 assert.equal(received[0].pixels.length,960*552*4);
 assert.equal(wall.visible,false);
 assert.equal(ambient.intensity,.2);
 assert.equal(poolLight.intensity,.4);
 assert.deepEqual([poolLight.position.x,poolLight.position.y,poolLight.position.z],[1,2,3]);
 assert.equal(fixture.lit.visible,false);
 assert.equal(fixture.dark.visible,true);
 assert.equal(sightUniform.value,'sight-mask');
 assert.ok(events.some(e=>e[0]==='target'&&e[1]==='player-target'));
});

test('drawSight acepta cámara observadora con la misma oclusión y luz sin tocar caché jugador',()=>{
 const patched=sandboxWindow.FHCCTVEngine.patch(source);
 const start=patched.indexOf('function drawSight(observer=null){');
 const end=patched.indexOf('\nfunction installVisibility(){',start);
 assert.ok(start>0&&end>start);
 const sight=patched.slice(start,end);
 assert.doesNotThrow(()=>new Function(sight));
 const wall={x1:0,z1:0,x2:1,z2:1},door={x1:2,z1:0,x2:2,z2:3};
 const calls=[];
 const ctx={
  fillRect(){calls.push('clear');},save(){calls.push('save');},
  beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){calls.push('clip');},
  fill(){calls.push('fill');},restore(){calls.push('restore');}
 };
 const cameraCanvas={width:80,height:80},cameraTexture={needsUpdate:false};
 let rays=0;
 const lighting={
  range(floor,room,flash){assert.equal(floor,1);assert.equal(room,'CAMERA_ROOM');
   assert.equal(flash,false,'La cámara no hereda linterna');return {base:3.1,beam:0,angle:0};},
  sourcesNear(entries,floor,x,z){assert.equal(floor,1);assert.equal(x,15);assert.equal(z,20);return [];}
 };
 const ForestShared={sightRayDistance(x,z,dir,opaque,radius){
  assert.ok(opaque.includes(wall)&&opaque.includes(door),'Los muros y puertas cerradas bloquean la cámara');
  rays++;return Math.min(radius,3);
 }};
 const maker=new Function('eyeLocation','performance','visibilityDirty','visibilityLast',
  'currentFloor','peeking','yaw','sightCanvas','q','sightTexture',
  'lighting','roomAt','sightWalls','doorList','elevatorStops','sightParameters',
  'ForestShared','STEPS','dirs','LOOK_RADIUS','MAX_X','MAX_Z',
  'updateSegmentSight','updateFurnitureSight','updateElevatorSight','updateDoorSight','updateLampSight',
  sight+'\nreturn drawSight;');
 const unused=()=>{throw Error('La vista remota no debe editar la visibilidad del jugador');};
 const f=maker(()=>({x:99,z:99}),{now:()=>10},false,{f:0},0,false,0,
  {width:4,height:4},ctx,{needsUpdate:false},lighting,()=> 'CAMERA_ROOM',
  [[],[wall]],[[],[{transparent:false,passable:false,block:door}]],[],
  unused,ForestShared,4,[{x:1,z:0},{x:0,z:1},{x:-1,z:0},{x:0,z:-1}],10.4,100,100,
  unused,unused,unused,unused,unused);
 f({floor:1,at:{x:15,z:20},yaw:0,canvas:cameraCanvas,ctx,texture:cameraTexture});
 assert.equal(cameraTexture.needsUpdate,true);
 assert.ok(rays>=8);
 assert.ok(calls.includes('clip')&&calls.includes('restore'));
});
