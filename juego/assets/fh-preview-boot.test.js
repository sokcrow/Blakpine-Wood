'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'../..');
const editor=fs.readFileSync(path.join(root,'index.html'),'utf8');
function integrationEnvironment(){
 const document={baseURI:'https://example.test/',currentScript:null};
 const window={document,__FOREST_EMBEDDED_ENGINE__:''};
 const context=vm.createContext({window,document,URL,console});
 const sharedStart=editor.indexOf('const ForestShared=(()=>{');
 const sharedEnd=editor.indexOf("\n'use strict';",sharedStart);
 vm.runInContext(editor.slice(sharedStart,sharedEnd),context);
 for(let i=0;i<=12;i++){
  vm.runInContext(fs.readFileSync(path.join(__dirname,'engine-'+String(i).padStart(2,'0')+'.js'),'utf8'),context);
 }
 for(const file of ['fh-architecture-skins.js','fh-comic-action-engine-hook.js','fh-context-engine-hook.js','fh-structure-engine-hook.js']){
  document.currentScript={src:new URL('juego/assets/'+file,document.baseURI).href};
  vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),context);
 }
 vm.runInContext(extract('function addLiveTextToEngine(','\nlet fhCharacterLaunchPending=false;'),context);
 return {context,window,motor:Buffer.from(window.__FOREST_EMBEDDED_ENGINE__,'base64').toString('utf8')};
}
function extract(start,end){
 const from=editor.indexOf(start),to=editor.indexOf(end,from);
 assert.ok(from>=0&&to>from,'No se encontró el código de arranque: '+start);
 return editor.slice(from,to);
}
test('decodifica UTF-8 cuando un carácter queda dividido entre bloques Base64',()=>{
 const source=extract('function decodeEmbedded3DEngine(base64){','\nconst play3DLayer=').trim();
 const decode=new Function('PREVIEW_TEXT','return ('+source+')')({missing:'Faltan archivos del motor 3D.'});
 const original='x'.repeat(98302)+'🌲'+'ñ'.repeat(72000);
 assert.equal(decode(Buffer.from(original,'utf8').toString('base64')),original);
 assert.throws(()=>decode(''),/Faltan archivos/);
});
test('el adaptador 3D declara integración local y el motor base tiene sintaxis válida',()=>{
 const sandbox={window:{}};
 for(let i=0;i<=12;i++){
  const name='engine-'+String(i).padStart(2,'0')+'.js';
  vm.runInNewContext(fs.readFileSync(path.join(root,'juego/assets',name),'utf8'),sandbox,{filename:name});
 }
 const base64=sandbox.window.__FOREST_EMBEDDED_ENGINE__;
 assert.ok(base64&&base64.length>10000000,'Se requieren los 13 fragmentos del motor');
 const motor=Buffer.from(base64,'base64').toString('utf8');
 const source=extract('function prepareGLBEngineDoc(source){','\nlet fhCharacterLaunchPending=false;').trim();
 // El adaptador usa funciones auxiliares del editor que no están en este
 // aislamiento: validar su sintaxis y contratos sin simularlas incorrectamente.
 assert.doesNotThrow(()=>new vm.Script('('+source+')'));
 assert.ok(source.includes('juego/assets/vendor/three.min.js'));
 assert.match(source,/FOREST_PREVIEW_RUNNING/);
 assert.match(source,/FOREST_PREVIEW_ERROR/);
 const start=motor.lastIndexOf('<script>')+8;
 const end=motor.lastIndexOf('</script>');
 assert.ok(start>7&&end>start,'El motor incluye script de arranque');
 assert.doesNotThrow(()=>new vm.Script(motor.slice(start,end)));
 const vendor=fs.readFileSync(path.join(root,'juego/assets/vendor/three.min.js'),'utf8');
 assert.match(vendor,/SPDX-License-Identifier: MIT/);
});

test('hook del repartidor construye una cámara de puerta válida desde el motor embebido',()=>{
 const sandbox={window:{}};
 for(let i=0;i<=12;i++){
  const name='engine-'+String(i).padStart(2,'0')+'.js';
  vm.runInNewContext(fs.readFileSync(path.join(root,'juego/assets',name),'utf8'),sandbox,{filename:name});
 }
 const motor=Buffer.from(sandbox.window.__FOREST_EMBEDDED_ENGINE__,'base64').toString('utf8');
 const adapter=extract('function addDeliveryToEngine(doc){','const engineSuccessBefore=').trim();
 const patch=vm.runInNewContext('('+adapter+')');
 const output=patch(motor);
 assert.match(output,/function fhBeginDoorEvent\(door\)/);
 assert.match(output,/if\(!peeking\|\|fhDoorConversationView\)return/);
 assert.match(output,/function fhDoorProperty\(door\)/);
 const start=output.lastIndexOf('<script>')+8,end=output.lastIndexOf('</script>');
 assert.ok(start>7&&end>start);
 assert.doesNotThrow(()=>new vm.Script(output.slice(start,end)));
});

test('arranque real: GLB y PG componen después de cómics y menú contextual',()=>{
 const {context,window,motor}=integrationEnvironment();
 const prepared=context.prepareGLBEngineDoc(motor);
 assert.match(prepared,/if\(d\.stairBlockFlag&&GameState.flags\[d.stairBlockFlag\]\)\{fhComicWorld/);
 const patched=window.FHStructureHealthEngine.patch(window.FHArchitectureSkins.patchEngineDoc(prepared));
 assert.match(patched,/FHArchitectureSkins\?\.decorateDoor\(d,it,THREE,installVisibility\)/);
 assert.match(patched,/FHArchitectureSkins\?\.decorateWindow/);
 assert.match(patched,/FHStructureHealthRuntime\?\.registerDoor/);
 assert.match(patched,/FHStructureHealthRuntime\?\.registerWindow/);
 assert.match(patched,/if\(d.destroyed\)return notice\(window.FH_STRUCTURE_TEXT.destroyed,1800\);\n if\(d.stairBlockFlag/);
 assert.match(patched,/FHStorageRuntime\?\.isOpen/);
 const body=patched.slice(patched.lastIndexOf('<script>')+8,patched.lastIndexOf('</script>'));
 assert.doesNotThrow(()=>new vm.Script(body),'la cadena completa produce JavaScript válido');
});

function actorStartup(){
 const {context,window,motor}=integrationEnvironment();
 const html=window.FHStructureHealthEngine.patch(window.FHArchitectureSkins.patchEngineDoc(context.prepareGLBEngineDoc(motor)));
 const from=html.indexOf('// Los actores ajenos usan la visión que ya calcula drawSight');
 const to=html.indexOf('const tex={},loader=new THREE.TextureLoader();',from);
 assert.ok(from>=0&&to>from,'Inicialización real de actores localizada');
 const THREE=require('./vendor/three.min.js');
 const scene=new THREE.Scene(),stories=[new THREE.Group()];scene.add(stories[0]);
 let playerHeight;
 const runtime=vm.createContext({THREE,scene,stories,floorElev:[0],MAX_X:24,MAX_Z:24,DATA:{},CELL:1.524,
  sightUniform:{value:null},URL,console,Promise,window:{addEventListener(){},FHShadowVisuals:{createManager(options){
   playerHeight=options.playerHeight;
   return require('./fh-shadow-visuals.js').createManager(options);
  }}}});
 return {runtime,source:html.slice(from,to),THREE,stories,height:()=>playerHeight};
}

test('arranque ejecutado: Sombras espera a HERO_H, hero y shadow inicializados',()=>{
 const env=actorStartup();
 assert.doesNotThrow(()=>vm.runInContext(env.source,env.runtime));
 assert.equal(env.height(),1.68,'Conserva la escala visual unificada del jugador');
 assert.equal(env.runtime.window.FHShadowActors.size,0);
 assert.equal(vm.runInContext('window.FHActorVisibility.register(hero)',env.runtime),false);
 const other=new env.THREE.Sprite(new env.THREE.SpriteMaterial());env.stories[0].add(other);
 assert.equal(env.runtime.window.FHActorVisibility.register(other),true);
 assert.equal(other.visible,false,'El registro FOW conserva la visibilidad inicial');
 env.runtime.window.FHShadowActors.dispose();
});

test('ventana pendiente al arrancar instala FOW sin leer hero antes de inicializar',async()=>{
 const env=actorStartup(),{runtime,THREE,stories}=env;
 const warnings=[],mask=()=>vm.runInContext('installVisibility',runtime);
 // El parser y el GLB son los del juego. Sólo la decodificación de imagen del
 // navegador se sustituye por una textura vacía en esta prueba sin DOM/WebGL.
 const parserTHREE={...THREE,TextureLoader:class extends THREE.TextureLoader{
  load(url,done){const texture=new THREE.Texture();queueMicrotask(()=>done(texture));return texture;}
 }};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'vendor/GLTFLoader.js'),'utf8'),
  {THREE:parserTHREE,self:{URL},Blob,TextDecoder,console});
 let loadedUrl;
 const skinsWindow={THREE:{...THREE,GLTFLoader:class extends parserTHREE.GLTFLoader{
  load(url,done,progress,fail){
   loadedUrl=url;
   const bytes=fs.readFileSync(path.join(root,'forest-horror/biblioteca/arquitectura/modelos_glb',path.basename(new URL(url).pathname)));
   this.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'',done,fail);
  }
 }}};
 const document={baseURI:'https://example.test/',currentScript:{src:'https://example.test/juego/assets/fh-architecture-skins.js'}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'fh-architecture-skins.js'),'utf8'),
  {window:skinsWindow,document,URL,Promise,console:{warn(...args){warnings.push(args);}}});
 const built=Array.from({length:5},()=>new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial()));
 for(const part of built)stories[0].add(part);
 skinsWindow.FHArchitectureSkins.decorateWindow({it:{id:'window-boot',type:'window',a:{x:1,y:1},b:{x:2,y:1}},
  container:stories[0],built,a:{x:1.524,z:1.524},b:{x:3.048,z:1.524},angle:0,
  sightMask(node){mask()(node);}});
 assert.doesNotThrow(()=>vm.runInContext(env.source,runtime));
 await skinsWindow.FHArchitectureSkins.load('ventana_clasica');
 await new Promise(setImmediate);
 assert.equal(loadedUrl,'https://example.test/forest-horror/biblioteca/arquitectura/modelos_glb/ventana_clasica.glb');
 assert.deepEqual(warnings,[],'Ningún error de carga o FOW de ventana');
 assert.equal(stories[0].children.length,3,'Antepecho, dintel y GLB instalado');
 for(const original of built.slice(2))assert.equal(original.parent,null);
 let mesh;stories[0].children[2].traverse(node=>{if(node.isMesh)mesh=node;});
 assert.ok(mesh?.geometry.attributes.position.count>0,'Geometría real del GLB');
 assert.equal(typeof mesh.material.onBeforeCompile,'function');
 const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',
  fragmentShader:'#include <common>\n#include <dithering_fragment>'};
 mesh.material.onBeforeCompile(shader);
 assert.ok(shader.uniforms.uSight,'La máscara FOW se instaló realmente');
});

async function previewWithFailure(failingAdapter){
 const frame={srcdoc:''},messages=[];
 const context=vm.createContext({
  window:{
   FHCharacterCreation:{ensureCharacter:async()=>({id:'test'})},
   FHArchitectureSkins:{patchEngineDoc(){if(failingAdapter==='architecture')throw Error('architecture');return 'motor-con-glb';}},
   FHStructureHealthEngine:{patch(){throw Error('structure');}},
   FH_ARCHITECTURE_TEXT:{patchFailure:'error de arquitectura'},
   FH_STRUCTURE_TEXT:{integrationFailure:'error de PG'}
  },
  project:{floors:[{items:[{type:'spawn'}]}]},
  document:{activeElement:null},console:{error(){}},
  preview3DActive:false,preview3DSent:false,preview3DRunning:false,preview3DArchitectureError:'',
  play3DFrame:frame,play3DLayer:{classList:{add(){}},setAttribute(){}},
  PREVIEW_ENGINE_DOC_B64:'base64',PREVIEW_TEXT:{preparing:'preparando'},
  decodeEmbedded3DEngine:()=>'',prepareGLBEngineDoc:()=>'motor-base',
  closeInspector(){},closeModal(){},show3DStatus(){},
  preview3DError(message){messages.push(message);},setTimeout:()=>1
 });
 vm.runInContext(extract('let fhCharacterLaunchPending=false;','\nfunction close3DPreview(){'),context);
 await context.start3DPreview();
 return {frame,context,messages};
}
test('si PG falla, el arranque conserva el documento con GLB y distingue el error',async()=>{
 const {frame,context,messages}=await previewWithFailure('structure');
 assert.equal(frame.srcdoc,'motor-con-glb');
 assert.equal(context.preview3DArchitectureError,'error de PG');
 assert.deepEqual(messages,[]);
});
test('si falla arquitectura, el arranque conserva el motor base y su aviso',async()=>{
 const {frame,context,messages}=await previewWithFailure('architecture');
 assert.equal(frame.srcdoc,'motor-base');
 assert.equal(context.preview3DArchitectureError,'error de arquitectura');
 assert.deepEqual(messages,[]);
});



