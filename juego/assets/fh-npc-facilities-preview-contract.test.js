'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');

test('la API de sanitarios se instala en el motor sin agregar un sistema de colisión',()=>{
 const a=html.indexOf('function addNpcFacilitiesToEngine(doc){');
 const b=html.indexOf('\n return addNpcFacilitiesToEngine(',a);
 assert.ok(a>0&&b>a,'Hook de sanitarios ausente');
 const source=html.slice(a,b)+'\nthis.patchNpcBathrooms=addNpcFacilitiesToEngine;';
 const ctx={URL,document:{baseURI:'https://game.example/index.html'}};
 vm.runInNewContext(source,ctx);
 const existing='window.FHRoomNeedsRuntime=window.FHConstructionRooms.createRuntime(DATA,{getServices:()=>window.FHServicesRuntime,getConstruction:()=>window.FHConstructionRuntime});';
 const minimal='<html><head></head><body>'+existing+'</body></html>';
 const patched=ctx.patchNpcBathrooms(minimal);
 assert.match(patched,/window\.FHNPCFacilitiesRuntime=window\.FHNPCFacilities\.createRuntime/);
 assert.match(patched,/canWalk:\(f,x,z\)=>fhNpcCanWalk\(f,x,z,false\)/);
 assert.match(patched,/fh-npc-facilities\.js/);
 assert.match(patched,/transitions:fhNpcStairTransitions/);
 assert.match(patched,/getServices:\(\)=>window\.FHServicesRuntime/);
 assert.throws(()=>ctx.patchNpcBathrooms('<html><head></head></html>'),/Hook sanitarios NPC incompatible/);
});
test('el motor sigue cargando el GOAP único y no crea un NPC adicional',()=>{
 assert.match(html,/fh-npc-goap\.js\?v=20261106-goap-1/);
 assert.match(html,/return addNpcFacilitiesToEngine\(addRoomNeedsToEngine/);
 assert.doesNotMatch(html,/window\.FHNPCFacilitiesRuntime\?\.tick\(dt\)/);
});
