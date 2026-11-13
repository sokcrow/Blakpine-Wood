/* Regression for Codex PR #94 findings:
 * P1: embedded HTML has several </head> tags, yet outer services must load.
 * P2: createGameState drops services unless restored before runtime construction.
 */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const Services=require('./fh-services-core.js');
const hookSource=fs.readFileSync(path.join(__dirname,'fh-services-engine-hook.js'),'utf8');

function loadHook(){
 const win={document:{baseURI:'https://example.org/blakpine/index.html'}};
 vm.runInNewContext(hookSource,{window:win,URL});
 return win.FHServicesEngine;
}
function exampleEngine(){
 // 1 outer head and 4 heads inside embedded HTML strings.
 return [
  '<!doctype html><html><head><title>Forest Horror</title></head><body><script>',
  "const embedded1='<html><head></head></html>';",
  "const embedded2='<html><head></head></html>';",
  "const embedded3='<html><head></head></html>';",
  "const embedded4='<html><head></head></html>';",
  'const DATA={floors:[],units:{feetPerCell:5},initialGameState:{}};',
  'const restored=window.__saved||null;',
  'function createGameState(input){return {clock:{minutes:480},flags:{},phone:{...(input?.phone||{})}};}',
  'const GameState=createGameState(restored||DATA.initialGameState);',
  'const CELL=1,stories=[],renderedByItem=[],THREE={};',
  'const user={x:0,z:0};let currentFloor=0;',
  'function notice(){} function saveProgress(){}',
  'window.FHComputerRuntime=window.FHComputer?.createRuntime({});',
  'window.FHPhoneRuntime=window.FHPhone?.createRuntime({});',
  'function loop(dt){window.FHPhoneRuntime?.update(dt);}',
  'function useFurniture(item,selectedSeat=null){return true;}',
  'const interactableItems=DATA.floors.map(f=>(f.items||[]).filter(it=>it.interact||window.FHStorageRuntime?.supports(it)));',
  'function showRadial(){const key="furniture:demo",actions=[],fhContextGesture=null;const gesture=fhContextGesture;fhContextGesture=null;}',
  '</script></body></html>'
 ].join('\n');
}
function runEngine(saved,overrides={}){
 const win={__saved:saved,FHServices:Services,...overrides};
 const patched=loadHook().patch(exampleEngine());
 const match=patched.match(/<script>\s*([\s\S]*?)<\/script>/);
 assert.ok(match,'el parche mantiene el script principal');
 vm.runInNewContext(match[1],{window:win,structuredClone,console});
 return {win,patched};
}
test('el adaptador instala scripts en el HEAD externo aunque haya cinco cierres',()=>{
 const doc=exampleEngine();
 assert.equal(doc.split('</head>').length-1,5);
 const patched=loadHook().patch(doc);
 const first=patched.indexOf('</head>');
 const core=patched.indexOf('fh-services-core.js');
 const strings=patched.indexOf('fh-services-strings.js');
 assert.ok(core>=0&&strings>=0&&core<first&&strings<first,'ambos scripts van en el head externo');
 assert.equal(patched.split('fh-services-core.js').length-1,1,'no duplicar scripts');
 assert.equal(patched.split('</head>').length-1,5,'no eliminar cabezales internos');
 assert.ok(patched.includes('window.FHServicesRuntime=window.FHServices?.createRuntime'));
});
test('sin cabecera exterior, el adaptador falla explícitamente',()=>{
 assert.throws(()=>loadHook().patch('<html><body></body></html>'),/falta cabecera exterior/);
});
test('un guardado restaura contadores, daños, válvulas, credenciales, llamadas y contratos',()=>{
 const services={
  contracts:{electricity:'active',water:'active',internet:'suspended',landline:'active',mobile:'suspended'},
  meters:{kwh:42.5,waterLiters:930,drainLiters:570},
  damage:{enchufe_1:29},enabled:{valvula_1:false},
  wifiKeys:{router_1:'clave'},usage:{grifo_1:true},
  calls:[{from:'555-0001',to:'555-0002',status:'ringing'}]
 };
 const save={services,phone:{battery:47,placedAt:'cargador_1',placedFloor:0}};
 const {win}=runEngine(save);
 const state=win.FHServicesRuntime.state;
 assert.equal(state.meters.kwh,42.5);
 assert.equal(state.meters.waterLiters,930);
 assert.equal(state.meters.drainLiters,570);
 assert.equal(state.damage.enchufe_1,29);
 assert.equal(state.enabled.valvula_1,false);
 assert.equal(state.wifiKeys.router_1,'clave');
 assert.equal(state.contracts.internet,'suspended');
 assert.equal(state.contracts.mobile,'suspended');
 assert.equal(state.calls[0].status,'ringing');
 assert.equal(state.usage.grifo_1,true);
 assert.equal(win.FHServicesRuntime.phone.battery,47);
 assert.equal(win.FHServicesRuntime.phone.placedAt,'cargador_1');
 state.damage.enchufe_1=99;
 assert.equal(save.services.damage.enchufe_1,29,'el guardado se copia, no se muta');
});
test('un mapa antiguo sin services sigue inicializando medidores a cero',()=>{
 const {win}=runEngine({phone:{battery:100}});
 assert.equal(win.FHServicesRuntime.state.meters.kwh,0);
 assert.equal(win.FHServicesRuntime.state.meters.waterLiters,0);
 assert.equal(win.FHServicesRuntime.state.contracts.internet,'active');
});
test('una computadora antigua sin requiresPower también debe tener suministro; proveedor ausente bloquea',()=>{
 let options;
 const {win}=runEngine({}, {FHComputer:{createRuntime:input=>{options=input;return {}}}});
 const item={id:'legacy',modelId:'escritorio_pc'};
 win.FHServicesRuntime=undefined;assert.equal(options.powerAvailable(item,0),false);
 win.FHServicesRuntime={statusFor:()=>({power:{powered:false}})};assert.equal(options.powerAvailable(item,0),false);
 win.FHServicesRuntime={statusFor:()=>({power:{powered:true}})};assert.equal(options.powerAvailable(item,0),true);
});


test('interacción de generador restaura reserva, permite habilitar y guarda mediante el puente',()=>{
 const generator={id:'g',type:'generator',generatorKind:'emergency',enabled:true,autonomyHours:72,targets:[]};
 const data={floors:[{id:'sotano',items:[generator]}]};
 const services={generators:{'sotano:g':{enabled:false,remainingHours:31,running:true}}};
 const {win}=runEngine({services},{FHServices:{...Services,createRuntime:(_,state)=>Services.createRuntime(data,state)}});
 assert.equal(win.FHServicesRuntime.generatorStatus(0,generator).remainingHours,31);
 assert.equal(win.FHServicesRuntime.generatorStatus(0,generator).running,false);
 win.FH_SERVICES_TEXT={generator:{status:s=>String(s.enabled)}};
 assert.equal(win.FHServicesGame.handle(generator,0),true);
 assert.equal(win.FHServicesRuntime.generatorStatus(0,generator).enabled,true);
 assert.equal(win.FHServicesRuntime.generatorStatus(0,generator).remainingHours,31);
 win.FHServicesGame.handle(generator,0);
 assert.equal(win.FHServicesRuntime.generatorStatus(0,generator).enabled,false);
});

test('editor: selección de habitación, prioridad y circuito completo se exportan con IDs entre pisos',()=>{
 class Node{
  constructor(tag){this.tag=tag;this.children=[];this.style={};this.attributes={};}
  append(...nodes){this.children.push(...nodes);}
  setAttribute(k,v){this.attributes[k]=v;}
 }
 const document={createElement:tag=>new Node(tag),createTextNode:text=>({text})};
 const item={id:'g',type:'generator',targets:[]};
 const floor={id:'upper',name:'Piso 1',items:[
  {id:'p',type:'breaker_panel',label:'Panel',circuits:[{id:'c',zoneId:'a'}]},
  {id:'r',type:'room',roomId:'A',zoneId:'a',label:'Enfermería'}]};
 const editor=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 const from=editor.indexOf('function attachServiceInspector('),to=editor.indexOf('\nfunction openInspector()',from);
 const strings={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'fh-services-strings.js'),'utf8'),{globalThis:strings});
 const calls=[];let refreshed=0;
 const ctx={document,window:strings,project:{floors:[{id:'basement',items:[item]},floor]},
  makeField:(...args)=>{calls.push(args);return new Node('field')},
  setItemField:(_,key,value)=>item[key]=value,openInspector:()=>refreshed++};
 vm.runInNewContext(editor.slice(from,to),ctx);
 let fields=new Node('fields');ctx.attachServiceInspector(item,fields);
 assert.ok(calls.some(args=>args[1]==='autonomyHours'));assert.ok(calls.some(args=>args[1]==='capacityWatts'));
 let group=fields.children.at(-1),roomRow=group.children[2];
 roomRow.children[0].children[0].checked=true;roomRow.children[1].value='9';roomRow.children[0].children[0].onchange();
 assert.deepEqual(JSON.parse(JSON.stringify(item.targets)),[{floorId:'upper',panelId:'p',circuitId:'c',roomId:'A',priority:9}]);
 assert.equal(refreshed,1);
 fields=new Node('fields');ctx.attachServiceInspector(item,fields);group=fields.children.at(-1);
 assert.equal(group.children[2].children[1].disabled,false,'prioridad editable después de seleccionar');
 const whole=group.children[1];whole.children[0].children[0].checked=true;whole.children[0].children[0].onchange();
 assert.equal(item.targets.length,1);assert.equal(item.targets[0].roomId,undefined,'circuito completo reemplaza sus habitaciones');
});

test('el motor 3D compone el puente de Agua y monta los GLB en la escena del mapa',()=>{
 const win={document:{baseURI:'https://example.org/blakpine/index.html',
  currentScript:{src:'https://example.org/blakpine/juego/assets/fh-water-visuals.js'}}};
 const context={window:win,URL};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'fh-water-visuals.js'),'utf8'),context);
 vm.runInNewContext(hookSource,context);
 const engine=win.FHServicesEngine.patch(exampleEngine());
 const url='https://example.org/blakpine/juego/assets/';
 assert.match(engine,/const fhWaterVisuals=window\.FHWaterVisuals\?\.install\(/,
  'El motor debe montar los GLB, no solo cargar el catálogo');
 for(const asset of ['fh-boilers-catalog.js','fh-water-storage-catalog.js','fh-water-visuals.js']){
  assert.ok(engine.includes(url+asset),asset+' se carga en la cabecera del iframe');
 }
 const hook=engine.indexOf('const fhWaterVisuals=window.FHWaterVisuals?.install(');
 const update=engine.indexOf('function fhServicesSyncVisuals(){');
 assert.ok(hook>=0&&hook<update,'el montaje debe ejecutarse antes del ciclo del motor');
 const scripts=engine.split('<script>').slice(1).map(part=>part.split('</script>')[0]);
 assert.ok(scripts.length>0);
 for(const script of scripts)assert.doesNotThrow(()=>new vm.Script(script[1]));
});

test('el editor y el motor reconocen el mismo frente de agua y electricidad',()=>{
 const legacy="const FACING_OBJECT_TYPES=new Set(['bed','sofa','tv','dining','table','chair','kitchen','bath','toilet','car','misc','stairs','elevator','light_switch','breaker_panel']);";
 const fake=exampleEngine().replace('const DATA=',legacy+'\\nconst DATA=');
 const patched=loadHook().patch(fake);
 const from=patched.match(/const FACING_OBJECT_TYPES=new Set\\(\\[([^\\]]*)\\]\\);/);
 assert.ok(from,'el motor conserva un conjunto de tipos orientables');
 const engineTypes=new Set(vm.runInNewContext('['+from[1]+']'));
 const editor=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 const declared=editor.match(/const FACING_OBJECT_TYPES=new Set\\(\\[([^\\]]*)\\]\\);/);
 assert.ok(declared,'el editor define los frentes');
 const editorTypes=new Set(vm.runInNewContext('['+declared[1]+']'));
 for(const type of ['power_outlet','router','landline_phone','water_main','water_valve','water_outlet','drain_outlet']){
  assert.ok(engineTypes.has(type),'el motor detecta el frente de '+type);
  assert.ok(editorTypes.has(type),'el editor muestra el frente de '+type);
 }
 assert.deepEqual([...engineTypes].sort(),[...editorTypes].sort(),'editor y motor no pueden invertir caras');
 assert.equal(patched.split("'water_main'").length-1,1,'no duplicar el tipo en el motor');
});
