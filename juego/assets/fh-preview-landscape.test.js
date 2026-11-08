/* Prueba 3D: orientación horizontal obligatoria en teléfonos. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const camera=require('./fh-mobile-camera.js');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const strings=fs.readFileSync(path.resolve(__dirname,'fh-preview-strings.js'),'utf8');

function harness(width=390,height=844){
 const eventHandlers={};
 const elements={};
 const calls={start:0,close:0,fullscreen:0,lock:0};
 const classes=new Set();
 function control(){
  return {textContent:'',hidden:false,disabled:false,
   handlers:{},addEventListener(type,handler){this.handlers[type]=handler},focus(){this.focused=true}};
 }
 for(const id of ['play3dLandscapeGate','play3dLandscapeTitle','play3dLandscapeMessage',
  'play3dLandscapeStart','play3dLandscapeCancel'])elements[id]=control();
 elements.play3dLandscapeGate.hidden=true;
 const layer={
  classList:{add(...list){for(const item of list)classes.add(item)},
   remove(...list){for(const item of list)classes.delete(item)}},
  setAttribute(){},
  requestFullscreen:async()=>{calls.fullscreen++;}
 };
 const document={fullscreenElement:null,getElementById:id=>elements[id]};
 const window={
  FHMobileCamera:camera,matchMedia:()=>({matches:true}),
  addEventListener:(type,fn)=>{eventHandlers[type]=fn}
 };
 const screen={orientation:{lock:async orientation=>{assert.equal(orientation,'landscape');calls.lock++},
  addEventListener:(type,fn)=>{eventHandlers['orientation-'+type]=fn}}};
 const sandbox={window,screen,document,play3DLayer:layer,
  play3DFrame:{},PREVIEW_TEXT:{landscapeTitle:'Horizontal',landscapeStart:'Iniciar',
   landscapeCancel:'Volver',landscapeBefore:'Pulsa el botón',landscapeReady:'Listo',
   landscapeRotate:'Gira el teléfono'},
  innerWidth:width,innerHeight:height,preview3DActive:false,fhCharacterLaunchPending:false,
  start3DPreview:async()=>{calls.start++},close3DPreview:()=>{calls.close++;sandbox.preview3DActive=false},
  Promise,console};
 const from=html.indexOf("const play3DLandscapeGate=document.getElementById('play3dLandscapeGate');");
 const to=html.indexOf("window.addEventListener('message',e=>{",from);
 assert.ok(from>0&&to>from,'La compuerta debe estar integrada en el editor.');
 vm.runInNewContext(html.slice(from,to),vm.createContext(sandbox));
 return {sandbox,elements,calls,classes,eventHandlers};
}
test('el botón Probar 3D abre compuerta en móvil y no carga en vertical',()=>{
 const {sandbox,elements,calls,classes}=harness();
 sandbox.launch3DPreview();
 assert.equal(elements.play3dLandscapeGate.hidden,false);
 assert.equal(calls.start,0);
 assert.equal(classes.has('fh-landscape-gate-open'),true);
});
test('girar el celular sin pulsar el botón no inicia el motor',()=>{
 const {sandbox,calls}=harness();
 sandbox.launch3DPreview();
 sandbox.innerWidth=844;sandbox.innerHeight=390;
 sandbox.handle3DPreviewOrientation();
 assert.equal(calls.start,0);
});
test('al pulsar en vertical intenta bloquear giro y espera horizontal antes de cargar',async()=>{
 const {sandbox,elements,calls}=harness();
 sandbox.launch3DPreview();
 await sandbox.confirm3DLandscape();
 assert.equal(calls.start,0);
 assert.equal(elements.play3dLandscapeGate.hidden,false);
 assert.equal(calls.fullscreen,1);
 assert.equal(calls.lock,1);
 sandbox.innerWidth=844;sandbox.innerHeight=390;
 sandbox.handle3DPreviewOrientation();
 assert.equal(calls.start,1);
 assert.equal(elements.play3dLandscapeGate.hidden,true);
 await Promise.resolve();
});
test('si vuelven a vertical durante gameplay, cierra el iframe y vuelve a bloquear',()=>{
 const {sandbox,elements,calls}=harness(844,390);
 sandbox.launch3DPreview();
 sandbox.preview3DActive=true;
 sandbox.innerWidth=390;sandbox.innerHeight=844;
 sandbox.handle3DPreviewOrientation();
 assert.equal(calls.close,1);
 assert.equal(elements.play3dLandscapeGate.hidden,false);
 assert.equal(calls.start,0);
});
test('cancelar vuelve al editor sin abrir el motor',()=>{
 const {sandbox,elements,calls,classes}=harness();
 sandbox.launch3DPreview();
 elements.play3dLandscapeCancel.handlers.click();
 assert.equal(elements.play3dLandscapeGate.hidden,true);
 assert.equal(classes.has('show'),false);
 assert.equal(calls.start,0);
});
test('el bloqueo es exclusivo del celular; computadora inicia sin compuerta',()=>{
 const {sandbox,elements,calls}=harness(1920,1080);
 sandbox.window.matchMedia=()=>({matches:false});
 sandbox.launch3DPreview();
 assert.equal(calls.start,1);
 assert.equal(elements.play3dLandscapeGate.hidden,true);
});
test('los textos son externos y la compuerta es modal accesible',()=>{
 assert.match(html,/id="play3dLandscapeGate" role="dialog" aria-modal="true"/);
 assert.match(html,/#play3dLandscapeGate\[hidden\]\{display:none\}/);
 assert.match(html,/\$\('#testBtn'\)\.onclick=launch3DPreview/);
 assert.match(html,/if\(window\.FHMobileCamera\?\.isPhone\?\.\(innerWidth,innerHeight/);
 for(const key of ['landscapeTitle','landscapeStart','landscapeCancel','landscapeBefore','landscapeReady','landscapeRotate'])
  assert.match(strings,new RegExp(key+":"));
});
