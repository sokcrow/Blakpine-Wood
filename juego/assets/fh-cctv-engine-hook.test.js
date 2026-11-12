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
const source=`<html><head></head><body><script>
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
 const chunks=Array.from({length:13},(_,i)=>{
  const file=fs.readFileSync(path.join(__dirname,'engine-'+String(i).padStart(2,'0')+'.js'),'utf8');
  const match=file.match(/\+"([A-Za-z0-9+/=]+)";/);
  assert.ok(match,'Fragmento Base64 '+i);
  return match[1];
 });
 let composed=Buffer.from(chunks.join(''),'base64').toString('utf8');
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
test('P1: el receptor de cámara acepta Uint8ClampedArray de otro iframe',()=>{
 const source=fs.readFileSync(path.join(__dirname,'fh-terminal.html'),'utf8');
 const start=source.indexOf('receiveCameraPixels(frame){');
 const end=source.indexOf('setLogs(logs){',start);
 assert.ok(start>0&&end>start,'El método real está disponible');
 const method=source.slice(start,end).trim().replace(/,\s*$/,'');
 const pixels=vm.runInNewContext('new Uint8ClampedArray(320*184*4)');
 assert.equal(pixels instanceof Uint8ClampedArray,false,'Distinto realm: instancia no compatible');
 let draws=0;
 const canvas={getContext:()=>({putImageData(img){assert.ok(img.data instanceof Uint8ClampedArray);assert.equal(img.data.length,320*184*4);draws++;}})};
 const state={power:true,boot:false,camera:0};
 const DATA={cameras:[{id:'CAM-A',online:true,angleDeg:0}]};
 class FakeImageData{
  constructor(data,width,height){assert.ok(data instanceof Uint8ClampedArray);this.data=data;this.width=width;this.height=height;}
 }
 const make=new Function('state','DATA','$','ImageData',
  'let cameraFrameReceived=false; return {api:{'+method+'},received:()=>cameraFrameReceived};');
 const session=make(state,DATA,()=>canvas,FakeImageData);
 session.api.receiveCameraPixels({id:'CAM-A',width:320,height:184,pixels,angleDeg:20});
 assert.equal(draws,1);assert.equal(session.received(),true);assert.equal(DATA.cameras[0].angleDeg,20);
 session.api.receiveCameraPixels({id:'CAM-A',width:320,height:184,pixels:new Uint8ClampedArray(4)});
 assert.equal(draws,1,'No dibujar frames truncados');
});
