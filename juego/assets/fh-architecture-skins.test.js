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
 assert.equal(catalog.architecture.length,5);
 assert.deepEqual(catalog.architecture.map(x=>x.type),['door','door','peephole_door','window','window']);
 assert.ok(catalog.architecture.every(x=>x.widthTiles===1));
 assert.ok(catalog.architecture.every(x=>x.glb.startsWith('modelos_glb/')));
});
test('elige la puerta correcta, sin sustituir dobles, garaje ni cristal',()=>{
 const {api}=sceneEnvironment();
 assert.equal(api.chooseDoor({family:'single',variant:'wood',transparent:false},{type:'door'}),'puerta_madera');
 assert.equal(api.chooseDoor({family:'single',variant:'metal',transparent:false},{type:'door'}),'puerta_metal');
 assert.equal(api.chooseDoor({family:'single',variant:'wood',transparent:false},{type:'peephole_door'}),'puerta_mirilla');
 assert.equal(api.chooseDoor({family:'double',variant:'wood',transparent:false},{type:'door'}),null);
 assert.equal(api.chooseDoor({family:'garage',variant:'metal',transparent:false},{type:'door'}),null);
 assert.equal(api.chooseDoor({family:'single',variant:'glass',transparent:true},{type:'door'}),null);
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
 assert.match(index,/fh-architecture-skins\.js\?v=20261105-kit01/);
 assert.match(index,/Marco de ventana','windowSkin'/);
 assert.match(index,/FHArchitectureSkins\?\.patchEngineDoc\(fhEngineDoc\)/);
 assert.match(index,/play3DFrame\.srcdoc=fhEngineDoc/);
});
