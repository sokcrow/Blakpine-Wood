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
 for(const file of ['fh-roof-engine-hook.js','fh-architecture-skins.js','fh-comic-action-engine-hook.js','fh-context-engine-hook.js','fh-structure-engine-hook.js',
  'fh-internet-catalog.js','fh-internet-visuals.js','fh-electric-catalog.js','fh-electric-visuals.js',
  'fh-water-catalog.js','fh-water-visuals.js','fh-services-engine-hook.js']){
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
 assert.match(source,/FHPreviewDiagnostics\?\.frame\(\)/);
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

test('arranque real: servicios, 24 GLB y PG componen después de cómics y menú contextual',()=>{
 const {context,window,motor}=integrationEnvironment();
 const prepared=context.prepareGLBEngineDoc(motor);
 assert.match(prepared,/if\(d\.stairBlockFlag&&GameState.flags\[d.stairBlockFlag\]\)\{fhComicWorld/);
 const served=window.FHServicesEngine.patch(prepared);
 const patched=window.FHStructureHealthEngine.patch(window.FHArchitectureSkins.patchEngineDoc(served));
 for(const name of ['FHServicesRuntime','FHInternetVisuals','FHElectricVisuals','FHWaterVisuals'])assert.ok(patched.includes(name),name+' integrado');
 assert.match(patched,/FHArchitectureSkins\?\.decorateDoor\(d,it,THREE,installVisibility\)/);
 assert.match(patched,/FHArchitectureSkins\?\.decorateWindow/);
 assert.match(patched,/FHStructureHealthRuntime\?\.registerDoor/);
 assert.match(patched,/FHStructureHealthRuntime\?\.registerWindow/);
 assert.match(patched,/if\(d.destroyed\)return notice\(window.FH_STRUCTURE_TEXT.destroyed,1800\);\n if\(d.stairBlockFlag/);
 assert.match(patched,/FHStorageRuntime\?\.isOpen/);
 const body=patched.slice(patched.lastIndexOf('<script>')+8,patched.lastIndexOf('</script>'));
 assert.doesNotThrow(()=>new vm.Script(body),'la cadena completa produce JavaScript válido');
});

test('el primer tick de supervivencia funciona a oscuras y respeta paredes y puertas',()=>{
 const {context,motor}=integrationEnvironment();
 const html=context.prepareGLBEngineDoc(motor);
 const from=html.indexOf('window.FHDeliveryRuntime?.update(dt);window.FHPhoneRuntime?.update(dt);');
 const to=html.indexOf('if(fhWeather?.update(dt))',from);
 assert.ok(from>=0&&to>from,'Tick real del motor ensamblado localizado');
 const helperStart=html.indexOf('function fhLightBlockers(){');
 const helperEnd=html.indexOf('function updateRoomLighting(now){',helperStart);
 const helper=helperStart>=0?html.slice(helperStart,helperEnd):'';
 const wall={x1:1,z1:-2,x2:1,z2:2};
 const door={transparent:false,passable:false,block:wall};
 const walls=[[]],doors=[[door]];
 const game={character:{life:'alive',resources:{pg:20,pgMax:20,sp:20,spMax:20,pe:18,peMax:18}}};
 const survival=require('./fh-survival-core.js').createRuntime(game,{},0);
 let minute=0;
 const runtime=vm.createContext({window:{},console,dt:.016,currentFloor:0,
  user:{x:2,z:0},sightWalls:walls,doorList:doors,
  roomLampEntries:[{floor:0,x:0,z:0,radius:5,dimRadius:7,angleDeg:360}],
  lighting:{state:{enabled:false},fixtureLit:()=>true},
  fhNatural:{illuminates:()=>false},ForestShared:vm.runInContext('ForestShared',context),
  playerPose:{state:{phase:'idle'}},watchingTvId:null,
  fhSurvival:survival,fhSurvivalMinute:()=>minute,fhSurvivalUI:null,
  fhSurvivalDirty:false,fhSurvivalLastSave:0,saveProgress(){}
 });
 vm.runInContext(fs.readFileSync(path.join(__dirname,'fh-lights.js'),'utf8'),runtime);
 vm.runInContext(helper,runtime);
 const tick=()=>vm.runInContext(html.slice(from,to),runtime);
 assert.doesNotThrow(tick,'El primer tick no debe detener el render por una variable fuera de alcance');
 minute=60;tick();
 assert.equal(game.character.resources.sp,18,'La puerta opaca cerrada impide recibir luz');
 door.passable=true;minute=120;tick();
 assert.equal(game.character.resources.sp,18,'La puerta abierta deja pasar luz');
 door.passable=false;door.transparent=true;minute=180;tick();
 assert.equal(game.character.resources.sp,18,'La puerta transparente deja pasar luz');
 doors[0]=[];walls[0]=[wall];minute=240;tick();
 assert.equal(game.character.resources.sp,16,'Las paredes siguen bloqueando luz');
 assert.equal(walls[0].length,1,'El cálculo no modifica los obstáculos del mapa');
});

test('fotograma ensamblado: movimiento, cámara y render deben terminar antes de RUNNING',()=>{
 const {context,motor}=integrationEnvironment();
 const html=context.prepareGLBEngineDoc(motor);
 assert.ok(html.indexOf('data-fh-runtime')<html.indexOf('vendor/three.min.js'),'El lector se instala antes de Three y los demás recursos');
 const start=html.indexOf('function frame(now){'),end=html.indexOf('function resize(){',start);
 assert.ok(start>0&&end>start);
 const source=html.slice(start,end),THREE=require('./vendor/three.min.js');
 for(const failAt of [null,'movement','camera','render','without-reader']){
  const calls=[],messages=[],handlers={},noop=()=>{},sprite=()=>({position:new THREE.Vector3(),scale:new THREE.Vector3()});
  const step=(name)=>{calls.push(name);if(failAt===name)throw Error('failure-'+name);};
  const window={document:{baseURI:'https://game.test/',currentScript:null},console:{error:noop},
   parent:{postMessage(message){messages.push(message);if(message.type==='FOREST_PREVIEW_RUNNING')calls.push('running');}},
   addEventListener(type,fn){handlers[type]=fn;}};
  const env=vm.createContext({window,parent:window.parent,URL,console,
   last:0,perfFrames:0,perfStamp:0,perfFPS:0,elevatorSystem:{update:noop},updateElevatorVisuals:noop,
   elevatorArrivalEvents:[],elevatorFlicker:0,lighting:{state:{charge:100,enabled:false},tick:noop,flicker:()=>false},
   lastBatteryNotice:false,visibilityDirty:false,flashlightSpot:{position:new THREE.Vector3(),target:{position:new THREE.Vector3()}},
   occupiedShaft:()=>null,floorElev:[0],currentFloor:0,user:{x:4,z:4,face:1},flashDir:{x:0,z:-1},
   updateRoomLighting:noop,fhHorrorLightsFail:()=>false,fhHorror:{tick:()=>{}},$:()=>({hidden:true}),fhSurvival:null,fhWeather:null,fhWeatherRenderer:null,fhGroundFog:null,fhWeatherAudio:null,fhNatural:null,
   fhDecorationTick:noop,fhDeliveryUiActive:false,moveUpdate:()=>step('movement'),fhDeliveryNpcTick:noop,
   playerPose:{state:{phase:'standing'},update:()=>null},playerPoseItem:null,GameState:{hidden:false},GameEvents:{},
   cameraUpdate:()=>step('camera'),updateCabinIsolation:noop,updateAdjacentVisibility:noop,updateCameraCutaway:noop,
   stairTravel:null,stairSupportHeight:()=>0,hero:sprite(),shadow:sprite(),saveProgress:noop,
   fhPlayerWalkCycle:{tick:()=> 'idle'},tex:{},heroMaterial:{},HERO_VISUAL_SCALE:1,spriteWidth:()=>1,
   walkDistance:0,doorList:[[]],lastHud:0,hudUpdate:noop,DATA:{floors:[{id:'f1'}]},CELL:1.524,fhContextRefresh:noop,
   drawSight:noop,fhRefreshActorVisibility:noop,peeking:false,renderer:{render:()=>step('render')},scene:{},cam:{},
   circleMask:noop,requestAnimationFrame:()=>calls.push('scheduled'),notice:noop
  });
  for(const file of ['fh-preview-strings.js','fh-preview-diagnostics.js']){
   vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),env);
  }
  const diagnostics=window.FHPreviewDiagnostics.createRuntime(window);
  window.FHPreviewDiagnostics=failAt==='without-reader'?undefined:diagnostics;
  vm.runInContext(source,env);
  if(failAt&&failAt!=='without-reader'){
   let error;try{vm.runInContext('frame(100)',env);}catch(e){error=e;}
   assert.ok(error,'La excepción de '+failAt+' debe propagarse al navegador');
   handlers.error({target:window,error});
   assert.equal(messages.some(x=>x.type==='FOREST_PREVIEW_RUNNING'),false);
   assert.equal(messages.find(x=>x.kind==='fatal').stage,failAt);
   assert.equal(calls.includes('scheduled'),false,'No confundir una animación detenida con un arranque correcto');
  }else{
   assert.doesNotThrow(()=>vm.runInContext('frame(100)',env));
   assert.deepEqual(calls,['movement','camera','render','running','scheduled']);
  }
 }
});

test('un hook diagnóstico incompatible no bloquea la construcción del motor',()=>{
 const {context,window,motor}=integrationEnvironment(),patch=window.FHContextEngine.patch,messages=[];
 context.preview3DDiagnostics={record:entry=>messages.push(entry)};
 context.console={...console,warn(){}};
 window.FHContextEngine={patch(doc){return patch(doc).replace('fhDecorationTick();','fhDecorationTick( );');}};
 const html=context.prepareGLBEngineDoc(motor);
 assert.ok(html.includes('data-fh-runtime'),'La captura global de errores sigue instalada');
 assert.ok(html.includes("type:'FOREST_PREVIEW_RUNNING',unverified:true"));
 assert.equal(messages.length,1,'El lector debe identificar su propia incompatibilidad');
 const body=html.slice(html.lastIndexOf('<script>')+8,html.lastIndexOf('</script>'));
 assert.doesNotThrow(()=>new vm.Script(body));
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

test('cableado exterior instala FOW antes de crear hero y shadow',()=>{
 const {context,window,motor}=integrationEnvironment();
 const html=window.FHServicesEngine.patch(context.prepareGLBEngineDoc(motor));
 const from=html.indexOf('function installVisibility(root=scene)');
 const actors=html.indexOf('const heroMaterial=',from);
 const to=html.indexOf('const tex={},loader=new THREE.TextureLoader();',actors);
 assert.ok(from>0&&actors>from&&to>actors);
 assert.ok(html.indexOf('const fhExteriorVisuals=')<from,'El cableado se construye antes del personaje');
 const THREE=require('./vendor/three.min.js'),scene=new THREE.Scene(),stories=[new THREE.Group()];
 scene.add(stories[0]);
 const env=vm.createContext({THREE,scene,stories,MAX_X:24,MAX_Z:24,sightUniform:{value:null},
  window:{addEventListener(){}},URL,DATA:{},CELL:1.524,floorElev:[0],
  exterior:require('./fh-exterior-visuals.js'),service:{exteriorGrid:{nodes:[],panelLinks:()=>[],links:()=>[{
   from:{f:0,id:'a',it:{x:0,y:0,modelId:'caja_distribucion_exterior'}},
   to:{f:0,id:'b',it:{x:2,y:0,modelId:'caja_distribucion_exterior'}}
  }]}}});
 const early='exterior.install({THREE,DATA,CELL,stories,service,applyFOW:installVisibility});\n';
 // Execute in the same lexical scope as the later const declarations: this
 // reproduces the temporal dead zone, unlike supplying hero:null in a fixture.
 assert.doesNotThrow(()=>vm.runInContext(early+html.slice(from,actors)+html.slice(actors,to),env));
 const wire=stories[0].children.find(node=>node.userData.fhExteriorWire);
 assert.ok(wire,'Cable real construido durante el arranque');
 const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',
  fragmentShader:'#include <common>\n#include <dithering_fragment>'};
 wire.material.onBeforeCompile(shader);
 assert.ok(shader.uniforms.uSight,'El cable conserva la máscara de visibilidad');
 assert.equal(vm.runInContext('installVisibility.maskedMaterials.has(hero.material)',env),false);
 assert.equal(vm.runInContext('installVisibility.maskedMaterials.has(shadow.material)',env),false);
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
   FHPreviewDiagnostics:{mount(){if(failingAdapter==='diagnostics')throw Error('diagnostics');return null;}},
   FHArchitectureSkins:{patchEngineDoc(){if(failingAdapter==='architecture')throw Error('architecture');return 'motor-con-glb';}},
   FHStructureHealthEngine:{patch(){throw Error('structure');}},
   FH_ARCHITECTURE_TEXT:{patchFailure:'error de arquitectura'},
   FH_STRUCTURE_TEXT:{integrationFailure:'error de PG'}
  },
  project:{floors:[{items:[{type:'spawn'}]}]},
  document:{activeElement:null,getElementById:()=>null},console:{error(){},warn(){}},
  preview3DActive:false,preview3DSent:false,preview3DRunning:false,preview3DArchitectureError:'',
  preview3DDiagnostics:null,preview3DDiagnosticFailed:false,
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

test('si el panel de diagnóstico falla al montarse, el motor sigue construyéndose',async()=>{
 const {frame,messages}=await previewWithFailure('diagnostics');
 assert.equal(frame.srcdoc,'motor-con-glb');
 assert.deepEqual(messages,[]);
});




test('el shader del motor conserva negro opaco y profundidad en el suelo sin luz',()=>{
 const {context,motor}=integrationEnvironment(),html=context.prepareGLBEngineDoc(motor);
 const from=html.indexOf('function installVisibility(root=scene)'),to=html.indexOf('const heroMaterial=',from);
 assert.ok(from>0&&to>from,'instalador real de FOW localizado');
 const THREE=require('./vendor/three.min.js'),scene=new THREE.Scene();
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(6,6),new THREE.MeshLambertMaterial({color:0xffffff}));
 scene.add(floor);
 const env=vm.createContext({scene,hero:null,shadow:null,MAX_X:20,MAX_Z:20,sightUniform:{value:null}});
 vm.runInContext(html.slice(from,to),env);env.installVisibility();
 const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',
  fragmentShader:'#include <common>\n#include <dithering_fragment>'};
 floor.material.onBeforeCompile(shader);
 assert.equal(floor.material.depthWrite,true);assert.equal(floor.material.depthTest,true);assert.equal(floor.material.transparent,false);
 assert.match(shader.fragmentShader,/gl_FragColor.rgb\*=clamp\(fhLight,0\.,1\.\);/);
 assert.doesNotMatch(shader.fragmentShader,/if\s*\(fhLight\s*</,'la oscuridad no elimina fragmentos del piso');
 assert.ok(shader.uniforms.uSight);
});

test('el motor ensamblado exige apertura y losa libre al mirar abajo y no dibuja terreno de sótano',()=>{
 const {context,motor}=integrationEnvironment(),html=context.prepareGLBEngineDoc(motor);
 assert.match(html,/if\(inside&&f!==currentFloor\)/);
 assert.match(html,/facadeCandidate\(currentFloor,f,inside,inCameraVolume\(bounds\),upperWindows.length>0,mainFloorIndex\)/);
 const start=html.indexOf('function exteriorGroundVisible('),end=html.indexOf('function updateAdjacentVisibility(',start);
 const env=vm.createContext({mainFloorIndex:1});
 vm.runInContext(html.slice(start,end),env);
 assert.equal(env.exteriorGroundVisible(0,{},[],false,[]),false,'el sótano no entra ni en el muestreo exterior');
 assert.match(html,/if\(inside&&!floorSightThroughOpening\(f,at,/);
 assert.match(html,/slab.spans\|\|\[\]\).flatMap\(sp=>surfaceRectsMinusVoids\(index,/);
});
