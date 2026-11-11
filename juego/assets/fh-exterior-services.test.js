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
