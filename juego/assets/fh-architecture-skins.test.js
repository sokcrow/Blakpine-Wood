'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'fh-architecture-skins.js'),'utf8');
const index=fs.readFileSync(path.join(__dirname,'../..','index.html'),'utf8');
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../../forest-horror/biblioteca/arquitectura/catalogo_arquitectura.json'),'utf8'));
function sceneEnvironment({leafFarEdge=1.444}={}){
 let loads=0,masks=0;
 class Group{
  constructor(){this.children=[];this.parent=null;this.position={x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z})}};this.rotation={y:0};this.scale={x:1,y:1,z:1};this.visible=true;}
  add(child){this.children.push(child);child.parent=this;}
  remove(child){this.children=this.children.filter(x=>x!==child);child.parent=null;}
 }
 const nodes={};
 for(const name of ['MARCO_FIJO','HOJA_PIVOTE','VIDRIO'])nodes[name]={
  name,clone(){return {name,visible:true,parent:null,scale:{x:1,y:1,z:1},testFarEdge:leafFarEdge}}
 };
 const modelScene={getObjectByName:n=>nodes[n],clone(){const obj=new Group();obj.name='modelo_glb';return obj;},traverse(fn){fn({isMesh:true,material:{}})}};
 class GLTFLoader{load(url,ok){loads++;ok({scene:modelScene})}}
 class Box3{constructor(){this.max={x:0}}setFromObject(obj){this.max.x=obj.testFarEdge;return this;}}
 const win={THREE:{GLTFLoader,Group,Box3,NearestFilter:1,NearestMipmapNearestFilter:2}};
 const doc={currentScript:{src:'https://example.test/juego/assets/fh-architecture-skins.js'},baseURI:'https://example.test/',
  head:{appendChild(){}}};
 vm.runInNewContext(code,{window:win,document:doc,URL,Promise,console});
 return {api:win.FHArchitectureSkins,THREE:win.THREE,Group,loads:()=>loads,masks:()=>masks,mask(){masks++}};
}
test('catálogo estructural: modelos previos preservados y Kit 03 sin puertas dobles',()=>{
 assert.equal(catalog.schema,'forest-horror-architecture-catalog-v1');
 assert.equal(catalog.architecture.length,12);
 assert.deepEqual(catalog.architecture.slice(0,8).map(x=>x.type),['door','door','peephole_door','window','window','door','door','door']);
 assert.deepEqual(catalog.architecture.slice(8).map(x=>x.id),[
  'puerta_electronica_reja','puerta_electronica_opaca','teclado_pin','lector_tarjeta']);
 assert.ok(catalog.architecture.filter(x=>x.type==='door').every(x=>x.widthTiles===1));
 assert.ok(catalog.architecture.every(x=>x.glb.startsWith('modelos_glb/')));
 assert.ok(catalog.architecture.slice(8,10).every(x=>x.mounting==='single'));
 assert.ok(catalog.architecture.slice(10).every(x=>x.placement==='door_frame'));
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
test('puerta doble: dos hojas individuales que se tocan y SIN poste en medio',async()=>{
 const env=sceneEnvironment(),{api,THREE,Group}=env;
 const frame=new Group();frame.parent={};
 // El marco original ya contiene solamente dintel y jambas EXTERIORES.
 const outerHeader={visible:true},leftJamb={visible:true},rightJamb={visible:true};
 for(const node of [outerHeader,leftJamb,rightJamb])frame.add(node);
 const animated=[0,1].map(n=>{
  const group=new Group();group.parent={};group.position.set(n?3.048:0,0,0);
  group.add({visible:true});return {group,base:n*Math.PI};
 });
 const door={family:'double',variant:'wood',transparent:false,open:true,angle:1.2,target:1.2,
  passable:true,frame,hinge:{parent:{}},animated};
 api.decorateDoor(door,{type:'door'},THREE,()=>env.mask());
 await new Promise(setImmediate);
 assert.equal(door.skinId,'puerta_madera');
 assert.deepEqual(frame.children,[outerHeader,leftJamb,rightJamb],
  'Una doble no puede agregar copias de MARCO_FIJO ni postes centrales');
 for(const legacy of [outerHeader,leftJamb,rightJamb])assert.equal(legacy.visible,true);
 assert.equal(env.masks(),2,'Solo se aplica FOW a las dos hojas GLB');
 for(const part of animated){
  assert.equal(part.group.children.length,2);
  assert.equal(part.group.children[0].visible,false);
  assert.equal(part.group.children[1].name,'HOJA_PIVOTE');
 }
 const edge=1.444;
 const leftEnd=animated[0].group.position.x+edge*animated[0].group.children[1].scale.x;
 const rightEnd=animated[1].group.position.x-edge*animated[1].group.children[1].scale.x;
 assert.ok(Math.abs(leftEnd-rightEnd)<1e-9,'Las hojas se tocan en el centro del vano');
 assert.ok(Math.abs(leftEnd-1.524)<1e-9,'El contacto coincide con el centro nominal del vano');
 assert.equal(animated[1].base-animated[0].base,Math.PI);
 assert.equal(door.open,true);assert.equal(door.angle,1.2);assert.equal(door.target,1.2);assert.equal(door.passable,true);
});
test('el encuentro central se ajusta también al ancho del marco de cristal',async()=>{
 const env=sceneEnvironment({leafFarEdge:1.494}),{api,THREE,Group}=env;
 const frame=new Group();frame.parent={};const outerHeader={visible:true};frame.add(outerHeader);
 const animated=[0,1].map(n=>{
  const group=new Group();group.parent={};group.position.set(n?2.8:0,0,0);
  group.add({visible:true});return {group,base:n*Math.PI};
 });
 const door={family:'double',variant:'glass',transparent:true,frame,hinge:{parent:{}},animated};
 api.decorateDoor(door,{type:'door',architectureSkin:'puerta_cristal_antipanico'},THREE,()=>{});
 await new Promise(setImmediate);
 assert.equal(door.skinId,'puerta_cristal_antipanico');
 assert.equal(frame.children.length,1);
 assert.equal(outerHeader.visible,true);
 const x0=animated[0].group.children[1].scale.x*1.494;
 const x1=2.8-animated[1].group.children[1].scale.x*1.494;
 assert.ok(Math.abs(x0-x1)<1e-9);
});
test('dos puertas sencillas independientes conservan cada marco cuando hay pared T',async()=>{
 const env=sceneEnvironment(),{api,THREE,Group}=env;
 const doors=[0,2].map(x=>{
  const group=new Group();group.parent={};group.position.set(x,0,0);group.add({visible:true});
  const frame=new Group();frame.parent={};frame.add({visible:true});
  return {family:'single',variant:'wood',transparent:false,frame,hinge:{parent:{}},animated:[{group,base:0}]};
 });
 for(const door of doors)api.decorateDoor(door,{type:'door'},THREE,()=>{});
 await new Promise(setImmediate);
 for(const door of doors){
  assert.equal(door.frame.children.length,2,'Cada puerta sencilla recibe su propio marco completo');
  assert.equal(door.frame.children[0].visible,false);
  assert.equal(door.frame.children[1].children[0].name,'MARCO_FIJO');
  assert.equal(door.animated[0].group.children[1].scale.x,1,'La puerta sencilla no se estira');
 }
});
test('rotaciones de puerta doble: ambas hojas avanzan al mismo lado del muro',()=>{
 const {api}=sceneEnvironment();
 const fixture='<html><head></head><body><script>'+
  'function applyDoorPose(d){if(d.family==="garage"){}else for(const part of d.animated)part.group.rotation.y=part.base+d.angle;}\n'+
  'function windowModel(f,it){\nconst a=world(it.a),b=world(it.b),angle=0;\n}\n'+
  'function doorTarget(d){return 1.20;}\n'+
  'function doorModel(f,it){applyDoorPose(d);doorList[f].push(d);return d;}</scr'+'ipt></body></html>';
 const patched=api.patchEngineDoc(fixture);
 const match=patched.match(/else for\(let i=0;i<d\.animated\.length;i\+\+\)\{[^}]+\}/);
 assert.ok(match,'No se inyectó el cambio de giro de la segunda hoja');
 const rig={family:'double',angle:.8,animated:[
  {base:0,group:{rotation:{y:0}}},{base:Math.PI,group:{rotation:{y:0}}}
 ]};
 vm.runInNewContext('if(false){}'+match[0],{d:rig});
 const side=rig.animated.map(part=>Math.sign(-Math.sin(part.group.rotation.y)));
 assert.deepEqual(side,[-1,-1]);
 const single={family:'single',angle:.8,animated:[{base:0,group:{rotation:{y:0}}}]};
 vm.runInNewContext('if(false){}'+match[0],{d:single});
 assert.equal(single.animated[0].group.rotation.y,.8);
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
test('ventanas nuevas: una instancia de mapa con ID único por casilla horizontal',()=>{
 const {api}=sceneEnvironment();let next=0;
 const source={id:'win_1',type:'window',a:{x:2,y:6},b:{x:5,y:6},windowSkin:'dividida'};
 const pieces=api.splitWindow(source,()=>('win_'+(++next+1)));
 assert.equal(pieces.length,3);
 assert.deepEqual(Array.from(pieces,p=>[p.a.x,p.a.y,p.b.x,p.b.y]),[
  [2,6,3,6],[3,6,4,6],[4,6,5,6]
 ]);
 assert.deepEqual(Array.from(pieces,p=>p.id),['win_1','win_2','win_3']);
 assert.ok(pieces.every(p=>p.windowSkin==='dividida'));
 assert.deepEqual([source.a.x,source.b.x],[2,5],'El original no se muta');
});
test('ventanas invertidas, verticales y tramos parciales ocupan tiles completos',()=>{
 const {api}=sceneEnvironment();
 const pieces=api.splitWindow({id:'a',type:'window',a:{x:7,y:5},b:{x:7,y:2}},(()=>{let n=0;return ()=>String(++n)})());
 assert.deepEqual(Array.from(pieces,p=>[p.a.y,p.b.y]),[[5,4],[4,3],[3,2]]);
 const partial=api.splitWindow({id:'p',type:'window',a:{x:1,y:3},b:{x:3.25,y:3}},(()=>{let n=0;return ()=>('partial_'+(++n))})());
 assert.equal(partial.length,3);
 assert.deepEqual(Array.from(partial,p=>[p.a.x,p.b.x]),[[1,2],[2,3],[3,4]]);
 const single=api.splitWindow({id:'s',type:'window',a:{x:1,y:2},b:{x:2,y:2}});
 assert.equal(single.length,1);assert.equal(single[0].id,'s');
});
test('un segmento legado de 3 tiles crea tres GLB sin estirarlos',async()=>{
 const env=sceneEnvironment(),{api,THREE,Group}=env;
 const container=new Group();container.parent={};
 const low={visible:true},high={visible:true},pane={visible:true},side1={visible:true},side2={visible:true};
 for(const node of [low,high,pane,side1,side2])container.add(node);
 api.decorateWindow({it:{id:'old',type:'window',a:{x:4,y:7},b:{x:7,y:7}},THREE,container,
  built:[low,high,pane,side1,side2],a:{x:6.096,z:10.668},b:{x:10.668,z:10.668},
  angle:0,sightMask:()=>env.mask()});
 await new Promise(setImmediate);
 assert.equal(container.children.length,5);
 assert.deepEqual(container.children.slice(2).map(n=>n.position.x),[6.096,7.62,9.144]);
 assert.ok(container.children.slice(2).every(n=>n.scale.x===1&&n.scale.y===1&&n.scale.z===1));
 assert.equal(env.masks(),3);
 for(const original of [pane,side1,side2])assert.equal(original.parent,null);
 for(const original of [low,high])assert.equal(original.parent,container);
});
test('el hook valida anclas y preserva el comportamiento original del motor',()=>{
 const {api}=sceneEnvironment();
 const fixture='<html><head></head><body><script>'+
  'function applyDoorPose(d){if(d.family==="garage"){}else for(const part of d.animated)part.group.rotation.y=part.base+d.angle;}\n'+
  'function windowModel(f,it){\nconst a=world(it.a),b=world(it.b),angle=0;\n}\n'+
  'function doorTarget(d){return 1.20;}\n'+
  'function doorModel(f,it){applyDoorPose(d);doorList[f].push(d);return d;}</scr'+'ipt></body></html>';
 const result=api.patchEngineDoc(fixture);
 assert.match(result,/FHArchitectureSkins\?\.decorateDoor\(d,it,THREE,installVisibility\)/);
 assert.match(result,/FHArchitectureSkins\?\.decorateWindow/);
 assert.match(result,/function doorTarget\(d\)\{return 1.20;\}/);
 assert.match(result,/d\.family==='double'&&i===1\?-d\.angle:d\.angle/);
 assert.match(result,/fh-architecture-skins\.js/);
 assert.throws(()=>api.patchEngineDoc('incompatible'),/Motor 3D no compatible/);
});
test('editor carga el adaptador, permite escoger marco y conserva fallback 3D',()=>{
 assert.match(index,/fh-architecture-skins\.js\?v=20261106-window-tiles/);
 assert.match(index,/windowPieces=it\.type==='window'/);
 assert.match(index,/FHArchitectureSkins\?\.splitWindow\(it,numId\)/);
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
 assert.ok(patched.includes("d.family==='double'&&i===1?-d.angle:d.angle"));
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

test('puertas electrónicas: una hoja, opacidad correcta y rechazo de dobles',()=>{
 const {api}=sceneEnvironment();
 assert.equal(api.chooseDoor({family:'single',variant:'metal',transparent:false},
  {type:'door',architectureSkin:'puerta_electronica_opaca'}),'puerta_electronica_opaca');
 assert.equal(api.chooseDoor({family:'single',variant:'glass',transparent:true},
  {type:'door',architectureSkin:'puerta_electronica_reja'}),'puerta_electronica_reja');
 assert.equal(api.chooseDoor({family:'double',variant:'metal',transparent:false},
  {type:'door',architectureSkin:'puerta_electronica_opaca'}),null);
 assert.equal(api.chooseDoor({family:'double',variant:'glass',transparent:true},
  {type:'door',architectureSkin:'puerta_electronica_reja'}),null);
 assert.equal(api.chooseDoor({family:'single',variant:'metal',transparent:false},
  {type:'door',architectureSkin:'puerta_electronica_reja'}),null);
 assert.equal(api.accessDeviceId({accessDevice:'none'}),null);
 assert.equal(api.accessDeviceId({accessDevice:'pin'}),'teclado_pin');
 assert.equal(api.accessDeviceId({accessDevice:'card'}),'lector_tarjeta');
 assert.equal(api.accessDeviceId({accessDevice:'unexpected'}),null);
});
test('el lector visual se monta sólo en el marco fijo, no en la hoja',async()=>{
 const env=sceneEnvironment(),{api,THREE,Group}=env;
 const group=new Group();group.parent={};group.add({visible:true});
 const frame=new Group();frame.parent={};frame.add({visible:true});
 const door={family:'single',variant:'metal',transparent:false,frame,hinge:{parent:{}},
  animated:[{group,base:0}]};
 api.decorateDoor(door,{type:'door',architectureSkin:'puerta_electronica_opaca',
  accessDevice:'pin',accessSide:'both'},THREE,()=>env.mask());
 await new Promise(setImmediate);
 assert.equal(door.skinId,'puerta_electronica_opaca');
 assert.equal(group.children.length,2,'Sólo una hoja visual nueva');
 assert.equal(frame.children.length,2,'Un marco nuevo, sin postes adicionales');
 const fixed=frame.children[1];
 assert.equal(fixed.children.length,3,'Marco fijo y un lector por cada cara');
 assert.ok(fixed.children.slice(1).every(x=>x.name==='modelo_glb'));
 assert.equal(fixed.children[1].position.z,.1);
 assert.equal(fixed.children[2].position.z,-.1);
 assert.equal(env.masks(),4);
});
test('editor: selección de lectores solo junto a la puerta electrónica',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const editor=fs.readFileSync(path.join(__dirname,'fh-architecture-editor-catalog.js'),'utf8');
 assert.match(editor,/m\.type==='accessory'/);
 assert.match(editor,/ForestShared\.doorSpec\(it\)\.family==='single'/);
 assert.match(editor,/setItemField\(it\.id,'accessDevice'/);
 assert.match(editor,/if\(!isElectronic\(model\.id\)\)\{delete it\.accessDevice/);
 assert.doesNotMatch(editor,/setCategory\('furniture'\)/);
});
