const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
function bridge(){
 const start=html.indexOf('const ForestShared=(()=>{'),end=html.indexOf("\n'use strict';",start);
 const begin=html.indexOf("if(typeof lumenCartridgeMode!=='undefined'&&lumenCartridgeMode){\n const validate=raw=>"),finish=html.indexOf('// Puerta opcional',begin);
 const fixture=JSON.parse(fs.readFileSync('forest-horror/maps/DEMO_Ascensor_5_Pisos.json'));
 let writes=0;
 const ctx=vm.createContext({fixture,console,setTimeout:()=>0,clearTimeout:()=>{},localStorage:{setItem(){writes++}},
  status:()=>{},closeInspector:()=>{},closeModal:()=>{},refreshFloorTabs:()=>{},setupImage:()=>{},render:()=>{},fitMap:()=>{},rememberFloorRefs:()=>{},
  window:{FHFloorLevels:{mainIndex:()=>0},FHMapGrid:{cellSize:()=>70}},STRUCTURAL_TYPES:new Set(),syncStairLinks:()=>{},recalcAllSpaces:()=>{},buildingSlabs:()=>({spans:[]}),slabsForLevels:()=>[],basementSlabs:()=>[],courtyardFloorItems:x=>x,buildArchitectureGraph:()=>({}),rounded:x=>x,clone:x=>JSON.parse(JSON.stringify(x)),lumenCartridgeMode:true,lumenEditorChanged:false,lumenEditorOriginal:null,lumenEditorNotify:null,
  project:null,saveTimer:null,dirty:false,floorRefArchive:new Map(),newProject:()=>fixture,floorDefault:()=>({reference:{data:''}})});
 const exportStart=html.indexOf('function exportProject(includeImages)'),exportEnd=html.indexOf('function downloadBlob(',exportStart);
 const initStart=html.indexOf('let lumenEditorInitialized=false;'),initEnd=html.indexOf("\nif(typeof lumenCartridgeMode",initStart);
 ctx.setupPlayMode=()=>{};ctx.init=()=>{};
 vm.runInContext(html.slice(start,end)+html.slice(exportStart,exportEnd)+html.slice(initStart,initEnd)+html.slice(begin,finish),ctx);
 const s=html.indexOf('function saveSoon()'),e=html.indexOf('\nfunction toast(',s);
 vm.runInContext(html.slice(s,e),ctx);
 return {ctx,api:ctx.window.LumenEditor,fixture,writes:()=>writes};
}
test('Puente real conserva todos los campos, incluso al editar y guardar, sin tocar Legacy',()=>{
 const {ctx,api,fixture,writes}=bridge();fixture.extra={future:[1,2]};fixture.floors[0].extra={service:'untouched'};
 let changed=0;const original=JSON.stringify(fixture);api.load(fixture,()=>changed++);
 assert.equal(JSON.stringify(api.read()),original);assert.equal(ctx.historyIndex,0);assert.equal(ctx.history.length,1);
 vm.runInContext("project.title='Título editado';saveSoon()",ctx);
 const result=api.read();assert.equal(result.title,'Título editado');assert.deepEqual(result.extra,fixture.extra);
 assert.deepEqual(result.floors[0].extra,fixture.floors[0].extra);
 assert.deepEqual(result.floors[0].items,fixture.floors[0].items);
 assert.equal(writes(),0);assert.equal(changed,1);assert.equal(JSON.stringify(fixture),original);
 api.saved();assert.equal(ctx.dirty,false);
});
test('Carga corrupta rechazada antes de sustituir el proyecto',()=>{
 const {api,fixture}=bridge();api.load(fixture,()=>{});const before=JSON.stringify(api.read());
 assert.throws(()=>api.load({...fixture,schema:'forest-horror-map-v2'},()=>{}));
 assert.equal(JSON.stringify(api.read()),before);
});
test('Scripts inline del editor mantienen sintaxis válida',()=>{
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))
  if(!/src=|application\/json/.test(match[1]))new vm.Script(match[2]);
});

test('Autoguardado del editor independiente conserva clave Legacy y JSON',()=>{
 const saved=new Map(),node={};
 const ctx=vm.createContext({project:{schema:'forest-horror-map-v1',custom:{legacy:true}},dirty:false,saveTimer:null,
  $:()=>node,localStorage:{setItem:(k,v)=>saved.set(k,v)},clearTimeout(){},setTimeout(fn){fn();return 1;}});
 const start=html.indexOf('function key(){'),end=html.indexOf('function toast(',start);
 vm.runInContext(html.slice(start,end)+';saveSoon();',ctx);
 assert.equal(saved.size,1);assert.deepEqual(JSON.parse(saved.get('fh_editor_map_v1')),ctx.project);
 assert.equal(ctx.dirty,false);
});
