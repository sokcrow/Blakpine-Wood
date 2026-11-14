'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const index=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
test('Motor 3D: la unidad del jugador y el repartidor usan el registro común',()=>{
 const start=index.indexOf('function addUnitCoreToEngine(doc){');
 const end=index.indexOf('\n return addUnitCoreToEngine(',start);
 assert.ok(start>0&&end>start,'adaptador Unidad localizado');
 const context={URL,document:{baseURI:'https://example.test/index.html'}};
 vm.runInNewContext(index.slice(start,end)+'\nthis.patch=addUnitCoreToEngine;',context);
 const fragment='<html><head></head><body>'+
  'const GameState=createGameState(restored||DATA.initialGameState);'+
  'window.FHSurvivalRuntime=fhSurvival;'+
  'fhNpcCourier=window.FHNPCCourier.createRuntime({'+
  '</body></html>';
 const patched=context.patch(fragment);
 assert.match(patched,/GameState\.units=structuredClone\(restored\?\.units/);
 assert.match(patched,/window\.FHUnitsRuntime=window\.FHUnitCore\.createRuntime/);
 assert.match(patched,/playerPosition:\(\)=>\(\{floor:currentFloor,x:user\.x,z:user\.z\}\)/);
 assert.match(patched,/unitFor:orderId/);
 assert.match(patched,/FHUnitsRuntime\.assignController\(unit\.id,\{type:"ai"/);
 assert.match(patched,/fh-unit-core\.js/);
 assert.match(patched,/fh-character-core\.js/);
 assert.throws(()=>context.patch('<head></head>'),/Hook Unidad incompatible/);
});
test('El motor mantiene colisión y movimiento existentes, sin controlador NPC alternativo',()=>{
 assert.match(index,/return addUnitCoreToEngine\(addRoomNeedsToEngine/);
 assert.match(index,/if\(window\.FHForestEngine\?\.patch\)/);
 assert.doesNotMatch(index,/window\.FHUnitsRuntime\?\.tick\(dt\)/);
});
