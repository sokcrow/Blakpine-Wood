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

