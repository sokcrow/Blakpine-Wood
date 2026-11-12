'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Services=require('./fh-services-core.js');
const Potable=require('./fh-water-potable.js');
const Hot=require('./fh-water-hot.js');
const Boilers=require('./fh-boilers-catalog.js');
const Storage=require('./fh-water-storage-catalog.js');
const repo=path.resolve(__dirname,'../..');
function scene(options={}){
 const heaterId='calentador_domestico_vertical';
 const wall={id:'w',type:'red_wall',a:{x:0,y:0},b:{x:16,y:0}};
 const panel={id:'breaker',type:'breaker_panel',x:0,y:0,circuits:[{zoneId:'casa',rangeFt:160}]};
 const boiler={id:'caldera',type:options.legacy?'misc':'water_boiler',modelId:heaterId,
  x:4,y:1,pipeLeadFt:10,service:{requiresPower:true,requiresWater:true,
   waterHeating:true,powerConnection:'direct',onDemand:true,watts:1200,rayos:6},
  hotNetworkId:'main',networkId:'main',hotRangeFt:120,boilerCapacityLiters:80,
  heatCPerMinute:3,fillLpm:12,targetTemperatureC:55};
 const pub={id:'red',type:'water_main',x:1,y:0,networkId:'main',rangeFt:120};
 const cold={id:'fria',type:'water_outlet',x:4,y:0,networkId:'main'};
 const hot={id:'doble',type:'water_outlet',x:12,y:0,networkId:'main',
  hotWaterEnabled:true,hotNetworkId:'main'};
 const sink={id:'sink',type:'misc',modelId:'lavabo_pedestal',x:12,y:.3,networkId:'main'};
 const items=[wall,panel,pub,cold,hot,sink,boiler];
 if(options.socket)items.push({id:'socket',type:'power_outlet',x:4,y:0,zoneId:'casa'});
 if(options.noPanel)items.splice(items.indexOf(panel),1);
 if(options.noCold)items.splice(items.indexOf(cold),1);
 return {project:{schema:'forest-horror-map-v1',units:{feetPerCell:5},
  plumbing:{enabled:true},floors:[{id:'0',items}]},
  boiler,sink,pub,hot, panel};
}
function runtime(input,flags={}){
 const state={flags,services:{contracts:{electricity:'active',water:'active'}}};
 return Services.createRuntime(input.project,state,{waterCore:Potable,hotCore:Hot});
}
test('caldera técnica usa el GLB original por ID y no el mueble libre',()=>{
 const model=Boilers.byId('calentador_domestico_vertical');
 assert.equal(model.type,'water_boiler');
 assert.equal(model.glb,'calderas/modelos_glb/calentador_domestico_vertical.glb');
 assert.ok(Boilers.models.every(m=>m.type!=='misc'&&/\.glb$/.test(m.glb)));
 assert.equal(Storage.byType('water_cistern').glb,'almacenamiento/modelos_glb/cisterna_principal.glb');
});
test('el editor tiene dos herramientas hidráulicas, sin misc',()=>{
 const index=fs.readFileSync(path.join(repo,'index.html'),'utf8');
 const boilerEditor=fs.readFileSync(path.join(__dirname,'fh-boilers-editor.js'),'utf8');
 assert.match(index,/\['water_boiler','Caldera \/ calentador GLB'/);
 assert.match(index,/\['water_boiler_aux','Equipos de caldera GLB'/);
 assert.doesNotMatch(boilerEditor,/oldCreate\(['"]misc['"]/);
 assert.doesNotMatch(boilerEditor,/item\.type=['"]misc['"]/);
});
test('caldera obtiene electricidad de breaker por paredes sin enchufe',()=>{
 const x=scene();const r=runtime(x);
 assert.equal(x.project.floors[0].items.some(i=>i.type==='power_outlet'),false);
 const status=r.statusFor(0,x.boiler).power;
 assert.equal(status.direct,true);
 assert.equal(status.connected,true);
 assert.equal(status.powered,true);
 assert.equal(status.breakerId,'breaker');
 assert.equal(status.via,'breaker');
 assert.ok(status.feet>0);
});
test('una caldera sin circuito no se energiza aunque esté colocada',()=>{
 const x=scene({noPanel:true});const r=runtime(x);
 assert.equal(r.statusFor(0,x.boiler).power.powered,false);
 assert.equal(r.statusFor(0,x.boiler).power.reason,'sinCircuito');
 r.tick(30,1);
 assert.equal(r.hotWaterStatus(0,x.boiler).ready,false);
});
test('un breaker apagado corta calentamiento pero no borra agua almacenada',()=>{
 const x=scene();const r=runtime(x);
 r.tick(60,1);
 const b1=r.hotWaterStatus(0,x.boiler);
 assert.equal(b1.coldConnected,true);
 assert.equal(b1.ready,true);
 r.setService('electricity',false);
 assert.equal(r.statusFor(0,x.boiler).power.powered,false);
 const before=r.hotWaterStatus(0,x.boiler).temperatureC;
 r.tick(2,1);
 assert.ok(r.hotWaterStatus(0,x.boiler).temperatureC<before);
});
test('caldera legada misc con GLB se conecta automáticamente al breaker',()=>{
 const x=scene({legacy:true}),r=runtime(x);
 assert.equal(r.statusFor(0,x.boiler).power.connected,true);
 assert.equal(r.statusFor(0,x.boiler).power.direct,true);
});
test('no fabrica agua cuando no hay entrada potable',()=>{
 const x=scene({noCold:true}),r=runtime(x);
 r.tick(60,1);
 assert.equal(r.hotWaterStatus(0,x.boiler).liters,0);
 assert.equal(r.hotWaterStatus(0,x.boiler).hotWater,false);
});
test('la red fría y la caliente son circuitos separados y medibles',()=>{
 const x=scene(),r=runtime(x);
 assert.ok(r.waterNetwork.diagnostics().coldFeet>0);
 assert.ok(r.hotWater.diagnostics().hotFeet>0);
 assert.equal(r.hotWater.diagnostics().routes[0].itemId,'doble');
 assert.ok(r.hotWater.diagnostics().routes[0].sections.length>0);
});
