'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const catalog=require('./fh-water-storage-catalog.js');
const services=require('./fh-services-core.js');
const potable=require('./fh-water-potable.js');
const index=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const editor=fs.readFileSync(path.resolve(__dirname,'fh-water-editor.js'),'utf8');
const boiler=fs.readFileSync(path.resolve(__dirname,'fh-boilers-editor.js'),'utf8');
const visuals=fs.readFileSync(path.resolve(__dirname,'fh-water-visuals.js'),'utf8');
const bridge=fs.readFileSync(path.resolve(__dirname,'fh-glb-bridge.js'),'utf8');
test('cisterna y tinaco están presentes como herramientas visibles en Agua',()=>{
 const line=index.match(/^\s*water:\[\['select'.*$/m)?.[0]||'';
 assert.ok(line,'falta la barra de herramientas de agua');
 for(const type of ['water_cistern','water_tinaco'])
  assert.match(line,new RegExp("\\['"+type+"','"));
 assert.doesNotMatch(line,/\['misc','/,'no usar colocación genérica');
 assert.ok(index.includes('fh-water-storage-catalog.js'));
});
test('catálogo mantiene IDs GLB reales y medidas del pack Agua 03',()=>{
 assert.equal(catalog.models.length,2);
 const cisterna=catalog.byType('water_cistern');
 const tinaco=catalog.byType('water_tinaco');
 assert.equal(cisterna.id,'cisterna_principal');
 assert.deepEqual([cisterna.widthFt,cisterna.depthFt,cisterna.heightFt],[8,5,4.5]);
 assert.equal(tinaco.id,'tinaco_elevado');
 assert.deepEqual([tinaco.widthFt,tinaco.depthFt,tinaco.heightFt],[4,4,6]);
 for(const m of catalog.models){
  assert.equal(m.placement,'floor');
  assert.equal(m.blocksMovement,true);
  assert.match(m.glb,/^almacenamiento\/modelos_glb\/[a-z_]+\.glb$/);
  assert.match(m.thumbnail,/^almacenamiento\/miniaturas\/[a-z_]+\.png$/);
 }
});
test('editor coloca tipos nativos como infraestructura, no misc, y guarda el ID GLB',()=>{
 const calls=[],window={FHWaterCatalog:{models:Array.from({length:8},()=>({}))},
  FHWaterStorageCatalog:catalog,FHServices:{defaultsFor:type=>services.defaultsFor(type)},
  FH_WATER_TEXT:{},FHWaterVisuals:{},FHBoilersCatalog:{models:[]}};
 const elements=[];
 const node=tag=>{const obj={tag,style:{},classList:{add(){}},hidden:false,children:[],
  append(...children){this.children.push(...children);},appendChild(x){this.children.push(x);},
  setAttribute(){},addEventListener(){},replaceChildren(){this.children=[];},
  querySelector(){return null;},focus(){},textContent:'',innerHTML:''};
  elements.push(obj);return obj;};
 const document={baseURI:'https://example.test/index.html',head:node('head'),body:node('body'),
  createElement:node,querySelector:()=>null,getElementById:()=>null};
 const project={units:{feetPerCell:5},plumbing:{},floors:[{id:'floor',items:[]}]};
 const context={window,document,URL,project,activeCategory:'water',
  activeTool:'water_cistern',current:()=>project.floors[0],
  setCategory(cat){context.activeCategory=cat;},chooseTool(tool){context.activeTool=tool;},
  createObject(type,p){calls.push(type);return {id:'item'+calls.length,type,x:p.x,y:p.y,
   ...services.defaultsFor(type),blocksMovement:false};},
  openInspector(){},record(){},render(){},toast(){},selection:null,
  ForestShared:{switchWallMount:()=>null},setItemField(){},utilityVisual:()=>({})};
 vm.runInNewContext(editor,context,{filename:'fh-water-editor.js'});
 for(const spec of [catalog.byType('water_cistern'),catalog.byType('water_tinaco')]){
  const it=context.createObject(spec.type,{x:2,y:4});
  assert.equal(it.type,spec.type);
  assert.equal(it.modelId,spec.id);
  assert.equal(it.utilitySkin,spec.id);
  assert.equal(it.w,spec.widthFt/5);
  assert.equal(it.h,spec.depthFt/5);
  assert.equal(it.heightFt,spec.heightFt);
  assert.equal(it.blocksMovement,true);
  assert.equal(it.capacityLiters,services.defaultsFor(spec.type).capacityLiters);
  assert.equal(it.interact.verb,'use');
 }
 assert.deepEqual(calls,['water_cistern','water_tinaco']);
 assert.equal(project.plumbing.enabled,true);
});
test('selector de calderas no secuestra las dos herramientas de almacenamiento',()=>{
 assert.match(boiler,/if\(type!=='misc'\|\|activeCategory!=='water'/);
 assert.match(editor,/type==='water_cistern'\|\|type==='water_tinaco'/);
});
test('GLB de Agua 03 se gestionan por el cargador hidráulico, no de muebles',()=>{
 assert.match(visuals,/FHWaterStorageCatalog/);
 assert.match(visuals,/fh-water-storage-catalog\.js/,'catálogo disponible en documento 3D');
 assert.match(visuals,/cisterna_principal/);
 assert.match(visuals,/tinaco_elevado/);
 assert.match(visuals,/storageFallback\(THREE,meta\)/,'fallback visible si faltan GLB');
 assert.match(bridge,/FHWaterStorageCatalog\?\.byId\(modelId\)/);
});
test('las reservas siguen entrando en el cálculo de agua potable',()=>{
 const m={schema:'forest-horror-map-v1',units:{feetPerCell:5},floors:[
  {id:'pb',items:[{id:'tank',type:'water_cistern',modelId:'cisterna_principal',
   x:2,y:2,capacityLiters:120,initialLiters:50,networkId:'main'}]}]};
 const game={services:{contracts:{water:'suspended'}}};
 const core=services.createRuntime(m,game,{waterCore:potable});
 assert.equal(core.waterStatus(0,m.floors[0].items[0]).liters,50);
 assert.equal(game.services.waterTanks['pb:tank'].liters,50);
 assert.equal(core.waterNetwork.enabled,true);
});
