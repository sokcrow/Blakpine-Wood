'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'../..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('El portal NPC es un marcador opcional del mapa, no el spawn del jugador',()=>{
 assert.match(index,/const POINT_TYPES=new Set\(\['spawn','npc_portal'\]\)/);
 assert.match(index,/npc_portal:'Entrada \/ salida NPC'/);
 assert.match(index,/if\(tool==='spawn'\)\{current\(\)\.items=current\(\)\.items\.filter/);
 assert.match(index,/blocksMovement:type!=='spawn'&&type!=='npc_portal'/);
 assert.match(index,/const markerExclusion=/);
});
test('La reconstrucción del motor Base64 integra GOAP y mantiene JS válido',()=>{
 const dir=path.join(root,'juego/assets');
 const ctx={window:{}};
 for(let i=0;i<=12;i++){
  const code=fs.readFileSync(path.join(dir,'engine-'+String(i).padStart(2,'0')+'.js'),'utf8');
  vm.runInNewContext(code,ctx,{timeout:5000});
 }
 const engine=Buffer.from(ctx.window.__FOREST_EMBEDDED_ENGINE__,'base64').toString('utf8');
 assert.ok(engine.includes('function canWalk(x,z)'));
 const start=index.indexOf('function addLiveTextToEngine(doc){');
 const end=index.indexOf('let fhCharacterLaunchPending',start);
 assert.ok(start>0&&end>start,'No se localizaron los adaptadores del motor');
 const patch=index.slice(start,end);
 const env={URL,document:{baseURI:'https://example.test/'},window:{},ENGINE_SOURCE:engine};
 const sharedStart=index.indexOf('const ForestShared=(()=>{');
 const sharedEnd=index.indexOf("\n'use strict';",sharedStart);
 vm.runInNewContext(index.slice(sharedStart,sharedEnd)+patch+'\nvar PATCHED=prepareGLBEngineDoc(ENGINE_SOURCE);',env,{timeout:20000});
 const result=env.PATCHED;
 assert.ok(result.includes('function fhNpcCanWalk('));
 assert.ok(result.includes('function fhStartNpcRoute('));
 assert.ok(result.includes("fh-npc-goap.js?v=20261106-goap-1"));
 assert.ok(result.includes("fh-npc-courier.js?v=20261106-goap-1"));
 assert.ok(result.includes("'opening','spawn','npc_portal'].includes(it.type)"));
 assert.match(result,/onNpcArrived\(id\)/);
 let count=0;
 for(const m of result.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
  if(m[1].trim()){new vm.Script(m[1],{filename:'motor-patched.js'});count++}
 }
 assert.ok(count>=1,'No se encontraron scripts generados');
});

