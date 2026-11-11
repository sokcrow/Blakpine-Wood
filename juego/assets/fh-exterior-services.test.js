'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Exterior=require('./fh-exterior-grid.js');
globalThis.FHExteriorGrid=Exterior;
const Services=require('./fh-services-core.js');

function scenario(includeTransformer=true){
 const transformer={id:'transformador',type:'misc',modelId:'transformador_poste_simple',x:0,y:0};
 const panel={id:'panel',type:'breaker_panel',x:1,y:0,zoneId:'main',enabled:true,
  powerSource:{kind:'utility'},backupSource:{kind:'generator',floorId:'ground',itemId:'emergency'},
  circuits:[{id:'main',zoneId:'main'}],sourceCableFt:90,exteriorAutoConnect:true};
 const generator={id:'emergency',type:'generator',generatorKind:'emergency',enabled:true,x:2,y:0,
  tankId:'tank',atsId:'ats',fuelLitersPerHour:1,capacityWatts:2400,autonomyHours:8,
  electricCapacityHours:8,initialElectricChargeHours:1,rechargeHoursPerHour:4};
 const tank={id:'tank',type:'generator_tank',x:2,y:1,capacityLiters:2,initialFuelLiters:2};
 const ats={id:'ats',type:'generator_ats',x:3,y:0};
 const floor={id:'ground',elevationFt:0,items:[...(includeTransformer?[transformer]:[]),panel,generator,tank,ats]};
 const state={flags:{}};
 const runtime=Services.createRuntime({units:{feetPerCell:5},floors:[floor]},state,{random:()=>.5});
 return {runtime,state,panel,generator,tank};
}

test('el transformador recarga automáticamente reserva eléctrica aunque el generador tenga combustible',()=>{
 const {runtime,generator,panel}=scenario();
 assert.equal(runtime.panelStatus(0,panel).circuits[0].source.kind,'utility');
 assert.equal(runtime.generatorStatus(0,generator).electricChargeHours,1);
 assert.equal(runtime.state.fuelTanks['ground:tank'].liters,2);
 runtime.tick(1,60); // Una hora de juego con suministro público.
 assert.equal(runtime.generatorStatus(0,generator).electricChargeHours,5);
 assert.equal(runtime.state.fuelTanks['ground:tank'].liters,2,'no se crea combustible');
 runtime.tick(1,60);
 assert.equal(runtime.generatorStatus(0,generator).electricChargeHours,8,'nunca supera capacidad');
 assert.equal(runtime.state.fuelTanks['ground:tank'].liters,2);
});

test('durante un apagón el generador consume combustible y después su batería',()=>{
 const {runtime,state,generator}=scenario();
 runtime.tick(1,60); // Batería 1 -> 5; combustible intacto.
 state.flags.power_global=false;
 runtime.tick(1,60);
 assert.equal(runtime.state.fuelTanks['ground:tank'].liters,1);
 assert.equal(runtime.generatorStatus(0,generator).electricChargeHours,5);
 runtime.tick(1,60);
 assert.equal(runtime.state.fuelTanks['ground:tank'].liters,0);
 assert.equal(runtime.generatorStatus(0,generator).electricChargeHours,5);
 runtime.tick(1,60);
 assert.equal(runtime.generatorStatus(0,generator).electricChargeHours,4);
 assert.equal(runtime.state.fuelTanks['ground:tank'].liters,0);
 state.flags.power_global=true;
 runtime.tick(1,60);
 assert.equal(runtime.generatorStatus(0,generator).electricChargeHours,8);
 assert.equal(runtime.state.fuelTanks['ground:tank'].liters,0,'restablecer suministro no repone combustible');
});

test('mapas v1 sin transformadores conservan los generadores de combustible originales',()=>{
 const {runtime,generator}=scenario(false);
 const before=runtime.generatorStatus(0,generator);
 assert.equal(runtime.exteriorGrid.hasTransformers,false);
 assert.equal(before.electricChargeHours,null);
 runtime.tick(1,60);
 assert.equal(runtime.generatorStatus(0,generator).electricChargeHours,null);
 assert.equal(runtime.state.fuelTanks['ground:tank'].liters,2);
});


test('un panel antiguo con ATS usa la conexión física y activa el respaldo si queda fuera de alcance',()=>{
 const transformer={id:'trafo',type:'misc',modelId:'transformador_poste_simple',x:0,y:0};
 function panelAt(x){
  const panel={id:'panel_antiguo',type:'breaker_panel',x,y:0,zoneId:'main',enabled:true,
   circuits:[{id:'main',zoneId:'main'}]}; // Sin powerSource: mapa v1 original.
  const generator={id:'emergencia',type:'generator',generatorKind:'emergency',x:x+1,y:0,
   enabled:true,atsId:'ats',autonomyHours:6,capacityWatts:2400,
   targets:[{floorId:'ground',panelId:panel.id,circuitId:'main'}]};
  const ats={id:'ats',type:'generator_ats',x:x+2,y:0};
  const project={units:{feetPerCell:5},floors:[{id:'ground',elevationFt:0,items:[transformer,panel,generator,ats]}]};
  const runtime=Services.createRuntime(project,{flags:{}},{random:()=>.5});
  return {runtime,panel,ats};
 }
 const near=panelAt(5);
 assert.equal(near.runtime.panelStatus(0,near.panel).circuits[0].source.kind,'utility');
 assert.equal(near.runtime.atsStatus(0,near.ats).outage,false);
 const far=panelAt(40); // 200 pies: desconectado del transformador.
 assert.equal(far.runtime.exteriorGrid.panelConnection(0,far.panel),null);
 assert.equal(far.runtime.atsStatus(0,far.ats).outage,true);
 assert.equal(far.runtime.panelStatus(0,far.panel).circuits[0].source.kind,'generator');
});
