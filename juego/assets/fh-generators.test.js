'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const library=path.join(__dirname,'../../forest-horror/biblioteca');
const catalog=JSON.parse(fs.readFileSync(path.join(library,'generadores/catalogo_generadores.json')));
test('ocho props: GLB íntegros, texturas embebidas y categorías funcionales',()=>{
 assert.equal(catalog.furniture.length,8);
 assert.equal(catalog.furniture.filter(m=>m.type==='generator'&&m.generatorRole==='normal').length,4);
 assert.equal(catalog.furniture.filter(m=>m.type==='generator'&&m.generatorRole==='emergency').length,2);
 let total=0;
 for(const m of catalog.furniture){
  const b=fs.readFileSync(path.join(library,m.glb));
  assert.equal(b.toString('ascii',0,4),'glTF');assert.equal(b.readUInt32LE(4),2);assert.equal(b.readUInt32LE(8),b.length);
  const doc=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
  assert.equal(doc.meshes.length,1);assert.equal(doc.materials.length,1);assert.ok(doc.images.every(i=>i.bufferView!==undefined));
  let triangles=0;
  for(const primitive of doc.meshes[0].primitives){
   triangles+=doc.accessors[primitive.indices].count/3;
   const positions=doc.accessors[primitive.attributes.POSITION],limits=[m.widthFt,m.heightFt,m.depthFt].map(v=>v*.3048);
   for(let axis=0;axis<3;axis++)assert.ok(positions.max[axis]-positions.min[axis]<=limits[axis]+.002,m.id+' dimensión '+axis);
   if(m.placement==='wall')assert.ok(positions.min[2]>=.08-.0001,'ATS delante del muro');
   else assert.equal(positions.min[1],0,'origen en el suelo');
  }
  assert.equal(triangles,m.triangles);total+=triangles;assert.equal(doc.samplers[0].magFilter,9728);
  assert.equal(m.forSale,false);assert.ok(fs.existsSync(path.join(library,m.thumbnail)));assert.ok(fs.existsSync(path.join(library,m.texture)));
  assert.equal(m.blocksMovement,m.placement!=='wall');
 }
 assert.equal(total,1352);
});
test('puente carga catálogo técnico opcional sin agregar generadores a ventas',async()=>{
 const main=JSON.parse(fs.readFileSync(path.join(library,'catalogo_muebles.json'))),delivery=JSON.parse(fs.readFileSync(path.join(library,'catalogo_delivery.json')));
 const win={},document={baseURI:'https://test.local/',currentScript:{src:'https://test.local/juego/assets/fh-glb-bridge.js'}};
 const fetch=async url=>({ok:true,json:async()=>url.includes('generadores/')?catalog:url.includes('catalogo_delivery')?delivery:main});
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'fh-glb-bridge.js'),'utf8'),{window:win,document,fetch,URL,console});
 const entries=await win.FHAssets.catalog();assert.equal(entries.size,94);
 for(const m of catalog.furniture){assert.equal(entries.get(m.id).glb,m.glb);assert.equal(main.furniture.some(x=>x.id===m.id),false);}
});

async function editorFixture(){
 class Element{
  constructor(tag){this.tag=tag;this.children=[];this.style={};this.attributes={};this.classList={add(){}};}
  append(...nodes){this.children.push(...nodes);}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(){}
  focus(){}
  replaceChildren(...nodes){this.children=nodes;}
  get options(){return this.children;}
 }
 const nodes=[],document={currentScript:{src:'https://test.local/juego/assets/fh-generators-editor.js'},
  createElement:tag=>{const e=new Element(tag);nodes.push(e);return e;},getElementById:id=>nodes.find(n=>n.id===id)||null,
  querySelector:()=>null,head:new Element('head'),body:new Element('body')};
 const win={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'fh-services-strings.js'),'utf8'),{globalThis:win});
 const Services=require('./fh-services-core.js');
 const floor={id:'ground',name:'PB',items:[{id:'wall',type:'wall'}]},upper={id:'upper',name:'Piso 1',items:[]};
 let mount={point:{x:2,y:3},rotation:90,wallId:'wall',room:{roomId:'A'}};
 const calls=[],ctx={window:win,document,URL,console,project:{units:{feetPerCell:5},floors:[floor,upper]},activeCategory:'lighting',
  current:()=>floor,fetch:async()=>({ok:true,json:async()=>catalog}),setCategory(){},chooseTool:t=>{ctx.tool=t},
  createObject:(type,p)=>({id:'new',type:type==='generator_emergency'?'generator':type,x:p.x,y:p.y,
   ...Services.defaultsFor(type==='generator_emergency'?'generator':type),...(type==='generator_emergency'?{generatorKind:'emergency',enabled:true}:{})}),
  ForestShared:{switchWallMount:()=>mount},toast:()=>{},record:()=>{},render:()=>{},openInspector:()=>{},
  makeField:(...args)=>{calls.push(args);return new Element('field')},setItemField:(id,key,value)=>calls.push({id,key,value})};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'fh-generators-editor.js'),'utf8'),ctx);
 await win.FHGeneratorsEditor.load();
 return {ctx,win,floor,upper,fields:()=>new Element('fields'),calls,mount:v=>mount=v};
}
test('editor crea generadores funcionales, ATS y tanque con medidas y montaje del catálogo',async()=>{
 const f=await editorFixture();
 for(const [tool,id] of [['generator','generador_portatil'],['generator_emergency','generador_emergencia_compacto'],['generator_ats','tablero_transferencia_automatica'],['generator_tank','tanque_combustible_generador']]){
  const item=f.ctx.createObject(tool,{x:1,y:1}),model=catalog.furniture.find(m=>m.id===id);
  assert.equal(item.modelId,id);assert.equal(item.type,model.type);assert.equal(item.w,model.widthFt/5);assert.equal(item.h,model.depthFt/5);
  assert.equal(item.blocksMovement,model.placement!=='wall');
  if(tool==='generator_emergency'){assert.equal(item.generatorKind,'emergency');assert.equal(item.enabled,true);}
  if(tool==='generator_ats'){assert.equal(item.wallId,'wall');assert.equal(item.rotation,90);assert.equal(item.mountHeightFt,4);}
 }
 f.mount(null);assert.equal(f.ctx.createObject('generator_ats',{x:1,y:1}),null);
});
test('editor intercambia los seis modelos sin borrar configuración del generador',async()=>{
 const f=await editorFixture();
 for(const model of catalog.furniture.filter(m=>m.type==='generator')){
  const item={type:'generator',capacityWatts:777,autonomyHours:96,targets:[{floorId:'upper'}],atsId:'ats'};
  assert.equal(f.win.FHGeneratorsEditor.setModel(item,model),true);
  assert.equal(item.modelId,model.id);assert.equal(item.capacityWatts,777);assert.equal(item.autonomyHours,96);
  assert.equal(item.targets[0].floorId,'upper');assert.equal(item.atsId,'ats');assert.equal(item.blocksMovement,true);
 }
});
test('inspector vincula equipos entre pisos y excluye accesorios ocupados',async()=>{
 const f=await editorFixture(),generator={id:'g',type:'generator',generatorKind:'emergency'};
 f.floor.items.push(generator,{id:'other',type:'generator',tankId:'busy',tankFloorId:'upper'});
 f.upper.items.push({id:'ats',type:'generator_ats'},{id:'tank',type:'generator_tank',capacityLiters:120},{id:'busy',type:'generator_tank'});
 const fields=f.fields();f.win.FHGeneratorsEditor.attachInspector(generator,fields);
 const label=fields.children.find(n=>n.textContent===f.win.FH_SERVICES_TEXT.generator.tankLink),select=label.children[0];
 assert.equal(select.options.length,2);
 select.value=JSON.stringify({id:'tank',floorId:'upper'});select.onchange();
 const saved=f.calls.find(c=>c.key==='tankLink');assert.equal(saved.value.id,'tank');assert.equal(saved.value.floorId,'upper');
 assert.ok(f.calls.some(c=>Array.isArray(c)&&c[1]==='fuelLitersPerHour'));
});

test('breaker nuevo nace sin fuente ni respaldo implícitos',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8'),start=source.indexOf('function createObject(type,p){'),end=source.indexOf('\nfunction sanitizeId',start);
 const win={FHLights:{kindForTool:()=>null}},floor={id:'basement',items:[]};
 const ctx={window:win,project:{units:{feetPerCell:5}},current:()=>floor,numId:()=> 'new-panel',OBJECT_SIZES:{},roomHasPosition:()=>false,
  availableCircuits:()=>[],ForestShared:{PROP_ACTIONS:{},nextCircuit:()=>({id:'a',zoneId:'a',circuitColor:'#ffffff'})}};
 vm.runInNewContext(source.slice(start,end),ctx);const panel=ctx.createObject('breaker_panel',{x:1,y:1});
 assert.equal(panel.powerSource.kind,'none');assert.equal(panel.backupSource.kind,'none');assert.equal(panel.sourceCableFt,90);
});
test('inspector del breaker elige fuente y respaldo permanentes entre pisos',async()=>{
 const f=await editorFixture(),panel={id:'p',type:'breaker_panel',powerSource:{kind:'none'},circuits:[{id:'a',zoneId:'a'}]};
 f.floor.items.push(panel);f.upper.items.push({id:'main',type:'generator',generatorKind:'normal',enabled:true},{id:'backup',type:'generator',generatorKind:'emergency'});
 f.win.FHServices=require('./fh-services-core.js');
 f.ctx.utilityVisual=()=>({runtime:f.win.FHServices.createRuntime(f.ctx.project,{})});
 const fields=f.fields();f.win.FHGeneratorsEditor.attachInspector(panel,fields);
 const label=fields.children.find(n=>n.textContent===f.win.FH_SERVICES_TEXT.powerSource.primary),select=label.children[0];
 const reference={kind:'generator',floorId:'upper',itemId:'main'};
 select.value=JSON.stringify(reference);select.onchange();
 assert.deepEqual(JSON.parse(JSON.stringify(f.calls.find(c=>c.key==='powerSource').value)),reference);
 const card=f.fields();f.win.FHGeneratorsEditor.attachCircuitFields(panel,panel.circuits[0],card);
 const floorSelect=card.children[0].children[0];floorSelect.value='upper';floorSelect.onchange();assert.equal(panel.circuits[0].floorId,'upper');
 const length=card.children[1].children[0];length.value=35;length.onchange();assert.equal(panel.circuits[0].rangeFt,35);
});
