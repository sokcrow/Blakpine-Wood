'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'fh-architecture-skins.js'),'utf8');
const index=fs.readFileSync(path.join(__dirname,'../..','index.html'),'utf8');
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../../forest-horror/biblioteca/arquitectura/catalogo_arquitectura.json'),'utf8'));
function sceneEnvironment(){
 let loads=0,masks=0;
 class Group{
  constructor(){this.children=[];this.parent=null;this.position={x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z})}};this.rotation={y:0};this.visible=true;}
  add(child){this.children.push(child);child.parent=this;}
  remove(child){this.children=this.children.filter(x=>x!==child);child.parent=null;}
 }
 const nodes={};
 for(const name of ['MARCO_FIJO','HOJA_PIVOTE','VIDRIO'])nodes[name]={
  name,clone(){return {name,visible:true,parent:null}}
 };
 const modelScene={getObjectByName:n=>nodes[n],clone(){const obj=new Group();obj.name='modelo_glb';return obj;},traverse(fn){fn({isMesh:true,material:{}})}};
 class GLTFLoader{load(url,ok){loads++;ok({scene:modelScene})}}
 const win={THREE:{GLTFLoader,Group,NearestFilter:1,NearestMipmapNearestFilter:2}};
 const doc={currentScript:{src:'https://example.test/juego/assets/fh-architecture-skins.js'},baseURI:'https://example.test/',
  head:{appendChild(){}}};
 vm.runInNewContext(code,{window:win,document:doc,URL,Promise,console});
 return {api:win.FHArchitectureSkins,THREE:win.THREE,Group,loads:()=>loads,masks:()=>masks,mask(){masks++}};
}
test('catálogo estructural: cinco modelos y rutas, sin transformar puertas en muebles',()=>{
 assert.equal(catalog.schema,'forest-horror-architecture-catalog-v1');
 assert.equal(catalog.architecture.length,8);
 assert.deepEqual(catalog.architecture.map(x=>x.type),['door','door','peephole_door','window','window','door','door','door']);
 assert.ok(catalog.architecture.every(x=>x.widthTiles===1));
 assert.ok(catalog.architecture.every(x=>x.glb.startsWith('modelos_glb/')));
});
test('elige puertas sencillas y dobles con los mismos modelos de una hoja',()=>{
 const {api}=sceneEnvironment();
 assert.equal(api.chooseDoor({family:'single',variant:'wood',transparent:false},{type:'door'}),'puerta_madera');
 assert.equal(api.chooseDoor({family:'single',variant:'metal',transparent:false},{type:'door'}),'puerta_metal');
 assert.equal(api.chooseDoor({family:'single',variant:'wood',transparent:false},{type:'peephole_door'}),'puerta_mirilla');
 assert.equal(api.chooseDoor({family:'double',variant:'wood',transparent:false},{type:'door'}),'puerta_madera');
 assert.equal(api.chooseDoor({family:'garage',variant:'metal',transparent:false},{type:'door'}),null);
 assert.equal(api.chooseDoor({family:'single',variant:'glass',transparent:true},{type:'door'}),'puerta_cristal_simple');
 assert.equal(api.chooseDoor({family:'double',variant:'storefront',transparent:true},{type:'door',architectureSkin:'puerta_cristal_antipanico'}),'puerta_cristal_antipanico');
 assert.equal(api.chooseDoor({family:'single',variant:'glass',transparent:true},{type:'door',architectureSkin:'puerta_cristal_doble'}),null);
 assert.equal(api.chooseWindow({windowSkin:'dividida'}),'ventana_dividida');
 assert.equal(api.chooseWindow({windowSkin:'no-existe'}),'ventana_clasica');
});
test('puerta mantiene bisagra, estado de paso y marco fijo',async()=>{
 const env=sceneEnvironment(),{api,THREE,Group}=env;
 const animated=new Group();animated.parent={};animated.position.set(7,0,9);
 const originalLeaf={visible:true};animated.add(originalLeaf);
 const frame=new Group();frame.parent={};const originalFrame={visible:true};frame.add(originalFrame);
 const door={family:'single',variant:'wood',transparent:false,open:true,angle:1.20,
  passable:true,target:1.20,hinge:{parent:{}},frame,animated:[{group:animated,base:.35}]};
 api.decorateDoor(door,{type:'door'},THREE,()=>env.mask());
 await new Promise(setImmediate);
 assert.equal(door.open,true);assert.equal(door.angle,1.20);assert.equal(door.passable,true);
 assert.equal(door.target,1.20);
 assert.equal(originalLeaf.visible,false);assert.equal(originalFrame.visible,false);
 assert.equal(animated.children[1].name,'HOJA_PIVOTE');
 assert.equal(frame.children[1].rotation.y,.35);
 assert.equal(door.skinId,'puerta_madera');assert.equal(env.masks(),2);
});
test('puerta doble instancia dos GLB individuales, segundo a 180 grados, apertura conservada',async()=>{
 const env=sceneEnvironment(),{api,THREE,Group}=env;
 const frame=new Group();frame.parent={};const oldFrame={visible:true};frame.add(oldFrame);
 const animated=[0,1].map((n)=>{
  const group=new Group();group.parent={};group.position.set(n?10:7,0,9);
  group.add({visible:true});
  return {group,base:.35+n*Math.PI};
 });
 const door={family:'double',variant:'metal',transparent:false,open:true,angle:1.2,target:1.2,
  passable:true,frame,hinge:{parent:{}},animated};
 api.decorateDoor(door,{type:'door'},THREE,()=>env.mask());
 await new Promise(setImmediate);
 assert.equal(door.skinId,'puerta_metal');
 assert.equal(frame.children.length,3);
 assert.equal(frame.children[1].rotation.y,.35);
 assert.equal(frame.children[2].rotation.y,.35+Math.PI);
 for(const part of animated){assert.equal(part.group.children.length,2);assert.equal(part.group.children[0].visible,false);assert.equal(part.group.children[1].name,'HOJA_PIVOTE');}
 assert.equal(env.masks(),4);
 assert.equal(oldFrame.visible,false);
 assert.equal(door.open,true);assert.equal(door.angle,1.2);assert.equal(door.target,1.2);assert.equal(door.passable,true);
});
test('ventana conserva antepecho y dintel y retira panel original del render FOW',async()=>{
 const env=sceneEnvironment(),{api,THREE,Group}=env;
 const container=new Group();container.parent={};
 const low={visible:true},high={visible:true},pane={visible:true},side1={visible:true},side2={visible:true};
 container.add(low);container.add(high);container.add(pane);container.add(side1);container.add(side2);
 api.decorateWindow({it:{type:'window',windowSkin:'dividida'},THREE,container,
  built:[low,high,pane,side1,side2],a:{x:4,z:7},angle:.15,sightMask:()=>env.mask()});
 await new Promise(setImmediate);
 assert.equal(low.visible,true);assert.equal(high.visible,true);
 assert.equal(low.parent,container);assert.equal(high.parent,container);
 for(const part of [pane,side1,side2]){assert.equal(part.visible,false);assert.equal(part.parent,null);}
 assert.equal(container.children.length,3);
 assert.equal(container.children[2].position.y,.83);
 assert.equal(env.masks(),1);
});
test('el hook valida anclas y preserva el comportamiento original del motor',()=>{
 const {api}=sceneEnvironment();
 const fixture='<html><head></head><body><script>'+
  'function windowModel(f,it){\nconst a=world(it.a),b=world(it.b),angle=0;\n}\n'+
  'function doorTarget(d){return 1.20;}\n'+
  'function doorModel(f,it){applyDoorPose(d);doorList[f].push(d);return d;}</scr'+'ipt></body></html>';
 const result=api.patchEngineDoc(fixture);
 assert.match(result,/FHArchitectureSkins\?\.decorateDoor\(d,it,THREE,installVisibility\)/);
 assert.match(result,/FHArchitectureSkins\?\.decorateWindow/);
 assert.match(result,/function doorTarget\(d\)\{return 1.20;\}/);
 assert.match(result,/fh-architecture-skins\.js/);
 assert.throws(()=>api.patchEngineDoc('incompatible'),/Motor 3D no compatible/);
});
test('editor carga el adaptador, permite escoger marco y conserva fallback 3D',()=>{
 assert.match(index,/fh-architecture-skins\.js\?v=20261106-hotfix2/);
 assert.match(index,/architectureSkin/);
 assert.match(index,/Marco de ventana','windowSkin'/);
 assert.match(index,/window\.FHArchitectureSkins\.patchEngineDoc\(fhEngineDoc\)/);
 assert.match(index,/play3DFrame\.srcdoc=fhEngineDoc/);
});

test('regresión: el motor REAL contiene varias etiquetas de cierre de head y acepta el kit',()=>{
 const env=sceneEnvironment(),{api}=env;
 const globals={window:{__FOREST_EMBEDDED_ENGINE__:''}};
 vm.createContext(globals);
 for(let i=0;i<=12;i++){
  const js=fs.readFileSync(path.join(__dirname,'engine-'+String(i).padStart(2,'0')+'.js'),'utf8');
  vm.runInContext(js,globals,{filename:'engine-'+i+'.js'});
 }
 const realHtml=Buffer.from(globals.window.__FOREST_EMBEDDED_ENGINE__,'base64').toString('utf8');
 assert.ok((realHtml.match(/<\/head>/g)||[]).length>1,'el caso original tiene cierres repetidos en strings');
 const patched=api.patchEngineDoc(realHtml);
 assert.ok(patched.includes('FHArchitectureSkins?.decorateDoor(d,it,THREE,installVisibility)'));
 assert.ok(patched.includes('FHArchitectureSkins?.decorateWindow({it,THREE,container:stories[f]'));
 const injected='<script src="https://example.test/juego/assets/fh-architecture-skins.js"></script>';
 assert.ok(patched.indexOf(injected)>0);
 assert.ok(patched.indexOf(injected)<patched.indexOf('</head>'));
 assert.equal(patched.split(injected).length-1,1);
});
test('el GLTFLoader procede del repositorio y no depende de un CDN',async()=>{
 assert.ok(fs.existsSync(path.join(__dirname,'vendor/GLTFLoader.js')));
 assert.ok(fs.existsSync(path.join(__dirname,'vendor/GLTFLoader.LICENSE')));
 const loadedScripts=[];
 const fakeTHREE={NearestFilter:1,NearestMipmapNearestFilter:2};
 const mockScene={traverse(fn){fn({isMesh:true,material:{}});}};
 class LocalGLTFLoader{load(url,done){assert.match(url,/\/arquitectura\/modelos_glb\/puerta_madera\.glb$/);done({scene:mockScene});}}
 const mockDoc={
  currentScript:{src:'https://example.test/juego/assets/fh-architecture-skins.js'},
  baseURI:'https://example.test/index.html',
  createElement(){return {src:'',onload:null,onerror:null};},
  head:{appendChild(script){
   loadedScripts.push(script.src);
   fakeTHREE.GLTFLoader=LocalGLTFLoader;
   script.onload();
  }}
 };
 const sandbox={window:{THREE:fakeTHREE},document:mockDoc,URL,Promise,console};
 vm.runInNewContext(code,sandbox);
 await sandbox.window.FHArchitectureSkins.load('puerta_madera');
 assert.deepEqual(loadedScripts,['https://example.test/juego/assets/vendor/GLTFLoader.js']);
});
test('el editor nunca oculta un fallo de integración de arquitectura',()=>{
 assert.match(index,/preview3DArchitectureError=window\.FH_ARCHITECTURE_TEXT\.patchFailure/);
 assert.match(index,/FOREST_ARCHITECTURE_ERROR/);
 assert.match(index,/FH_ARCHITECTURE_TEXT\.loadFailure/);
 assert.match(index,/fh-architecture-strings\.js/);
 assert.match(index,/if\(preview3DArchitectureError\)show3DStatus/);
});
