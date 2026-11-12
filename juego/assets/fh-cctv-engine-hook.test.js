/* Ejecutar: node --test juego/assets/fh-cctv-engine-hook.test.js */
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
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
