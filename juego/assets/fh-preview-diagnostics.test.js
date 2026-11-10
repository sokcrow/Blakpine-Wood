'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function target(){
 const listeners=new Map();
 return {listeners,addEventListener(type,fn){const set=listeners.get(type)||new Set();set.add(fn);listeners.set(type,set);},
  removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
  dispatch(type,event){for(const fn of listeners.get(type)||[])fn(event);}};
}
function environment(){
 let now=0,timer;
 const messages=[],nodes=[];
 const document=Object.assign(target(),{baseURI:'https://game.test/',currentScript:null,hidden:false,
  createElement(tag){const el=Object.assign(target(),{tagName:tag.toUpperCase(),style:{},children:[],
   textContent:'',append(...children){this.children.push(...children);},remove(){this.removed=true;}});nodes.push(el);return el;},
  getElementById(){return {click(){messages.push({back:true});}};}});
 const window=Object.assign(target(),{document,parent:{postMessage(message){messages.push(message);}},
  console:{error(){}},setInterval(fn){timer=fn;return 1;},clearInterval(){timer=null;},
  navigator:{clipboard:{async writeText(text){messages.push({copied:text});}}}});
 const context=vm.createContext({window,URL,Date:class extends Date{
  constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}
 }});
 for(const file of ['fh-preview-strings.js','fh-preview-diagnostics.js']){
  vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),context);
 }
 return {window,document,messages,nodes,api:window.FHPreviewDiagnostics,advance(ms){now+=ms;timer?.();}};
}
test('solo confirma RUNNING después de completar un fotograma; un error temprano lo impide',()=>{
 const e=environment(),r=e.api.createRuntime(e.window);
 r.stage('survival');
 e.window.dispatch('error',{target:e.window,error:new ReferenceError('lightBlockers is not defined'),filename:'about:srcdoc',lineno:42,colno:6});
 r.frame();
 assert.equal(e.messages.some(x=>x.type==='FOREST_PREVIEW_RUNNING'),false);
 const failure=e.messages.find(x=>x.kind==='fatal');
 assert.equal(failure.stage,'survival');assert.match(failure.stack,/ReferenceError/);assert.equal(failure.line,42);
 assert.equal(failure.url,'about:srcdoc');
});
test('captura una excepción después del arranque y no vuelve a anunciar éxito',()=>{
 const e=environment(),r=e.api.createRuntime(e.window);r.frame();r.stage('camera');
 e.window.dispatch('unhandledrejection',{reason:Error('camera-failure')});r.frame();
 assert.equal(e.messages.filter(x=>x.type==='FOREST_PREVIEW_RUNNING').length,1);
 assert.equal(e.messages.find(x=>x.kind==='fatal').stage,'camera');
});
test('GLB e imágenes fallidos quedan identificados; un script ausente es fatal',()=>{
 const e=environment(),r=e.api.createRuntime(e.window),manager={onError(){manager.previousCalled=true;}};
 r.watchThree({DefaultLoadingManager:manager},{debug:{}});
 manager.onError('https://game.test/models/puerta.glb?token=private');
 assert.equal(manager.previousCalled,true);
 assert.equal(e.messages.find(x=>x.kind==='resource').url,'https://game.test/models/puerta.glb');
 e.window.dispatch('error',{target:{tagName:'IMG',src:'https://game.test/hero.png'}});
 assert.equal(e.messages.some(x=>x.kind==='fatal'),false);
 e.window.dispatch('error',{target:{tagName:'SCRIPT',src:'https://game.test/fh-sleep.js?v=1'}});
 assert.equal(e.messages.find(x=>x.kind==='fatal').url,'https://game.test/fh-sleep.js');
 r.frame();assert.equal(e.messages.some(x=>x.type==='FOREST_PREVIEW_RUNNING'),false);
});
test('captura shaders y pérdida del contexto WebGL sin depender de una excepción JS',()=>{
 for(const type of ['shader','context']){
  const e=environment();e.api.createRuntime(e.window);
  if(type==='shader')e.window.console.error('THREE.WebGLProgram: Shader Error 0 - VALIDATE_STATUS false');
  else e.window.dispatch('webglcontextlost',{});
  assert.equal(e.messages.filter(x=>x.kind==='fatal').length,1);
 }
});
test('las etapas por frame se guardan sin generar mensajes a 60 FPS',()=>{
 const e=environment(),r=e.api.createRuntime(e.window);r.frame();const count=e.messages.length;
 for(let i=0;i<60;i++){r.stage('movement');r.stage('render');r.frame();}
 assert.equal(e.messages.length,count);
});
test('el lector acepta solo su iframe, conserva el error y ofrece copiar y volver',async()=>{
 const e=environment(),source={},failures=[],container={ownerDocument:e.document,appendChild(node){this.panel=node;}};
 const reader=e.api.mount({container,frame:{contentWindow:source},onFailure:x=>failures.push(x)});
 const receive=(data,sender=source)=>e.window.dispatch('message',{source:sender,data:{type:'FOREST_PREVIEW_DIAGNOSTIC',...data}});
 receive({kind:'fatal',message:'spoof'},{});assert.deepEqual(failures,[]);
 receive({kind:'fatal',stage:'camera',message:'<img src=x onerror=alert(1)>',stack:'stack:123'});
 assert.equal(container.panel.open,true);
 const pre=e.nodes.find(x=>x.tagName==='PRE');assert.match(pre.textContent,/stack:123/);assert.equal(pre.innerHTML,undefined);
 const buttons=e.nodes.filter(x=>x.tagName==='BUTTON');
 await [...buttons[0].listeners.get('click')][0]();assert.match(e.messages.find(x=>x.copied).copied,/stack:123/);
 buttons[1].dispatch('click',{});assert.equal(e.messages.at(-1).back,true);
 for(let i=0;i<100;i++)reader.record({kind:'resource',message:'resource-'+i});
 assert.equal(pre.textContent.split('\n').length,80);
 assert.match(pre.textContent,/stack:123/,'Los avisos no deben expulsar el primer error del informe');
 reader.dispose();assert.equal(container.panel.removed,true);assert.equal(e.window.listeners.get('message').size,0);
});
test('el watchdog detecta ausencia de fotogramas y respeta pestañas ocultas',()=>{
 const e=environment(),source={},failures=[];
 e.api.mount({container:{ownerDocument:e.document,appendChild(){}},frame:{contentWindow:source},onFailure:x=>failures.push(x)});
 e.window.dispatch('message',{source,data:{type:'FOREST_PREVIEW_DIAGNOSTIC',kind:'frame'}});
 e.document.hidden=true;e.advance(9000);assert.deepEqual(failures,[]);
 e.document.hidden=false;e.document.dispatch('visibilitychange',{});e.advance(1000);assert.deepEqual(failures,[]);
 e.advance(9000);assert.match(failures[0],/8 segundos/);
});

test('el informe distingue bloqueo de movimiento y estado de render sin copiar la partida',()=>{
 const e=environment();
 e.window.ForestHorrorGame={position:{x:4,z:7},floor:1,metrics:{fps:60},posture:{phase:'sitting'},
  canWalk:()=>false,gameState:{hidden:false,secret:'no copiar'}};
 e.window.FHPlayerMenu={isOpen:()=>true};
 const r=e.api.createRuntime(e.window);r.watchThree({DefaultLoadingManager:{}},{info:{render:{calls:12},memory:{geometries:5,textures:2}},domElement:{width:800,height:450}});
 r.frame();
 const state=e.messages.find(x=>x.kind==='frame').state;
 assert.equal(state.walkable,false);assert.equal(state.menu,true);assert.equal(state.calls,12);
 assert.equal(state.width,800);assert.equal(JSON.stringify(state).includes('no copiar'),false);
});
