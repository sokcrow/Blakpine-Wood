const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const largeMap=require('./helpers/lumen-large-map.cjs');
const html=fs.readFileSync('index.html','utf8'),from=html.indexOf('const ForestShared=(()=>{'),to=html.indexOf("\n'use strict';",from);
const shared=vm.runInNewContext(html.slice(from,to)+';ForestShared'),validate=p=>shared.loadProject(p);
const ctx={uid:'benchmark',ownerUid:'benchmark',campaignId:'measurement',rulesetId:'legacy',status:'active'};
test('120 × 120: mapa real de cinco pisos y carga derivada de 18 000 muebles; importación/validación/exportación',async()=>{
 const m=await import('../portal/cartridge.js');
 for(const stress of [false,true]){
  const p=largeMap(stress),c=m.changeMap(m.createCartridge(ctx),ctx,validate,{name:'120 × 120',project:p,expectedRevision:1}).cartridge;
  const times={};let start=performance.now();const text=JSON.stringify(c);times.serializeMs=performance.now()-start;
  start=performance.now();const parsed=JSON.parse(text);times.parseMs=performance.now()-start;
  start=performance.now();m.validateCartridge(parsed,ctx,validate);times.validateMs=performance.now()-start;
  start=performance.now();const imported=m.importCartridge(text,ctx,validate);times.importMs=performance.now()-start;
  start=performance.now();const exported=m.exportCartridge(imported,ctx,validate);times.exportMs=performance.now()-start;
  assert.equal(exported,text);assert.deepEqual(imported.maps[0].project,p);
  console.log(JSON.stringify({scenario:stress?'derived-stress':'repository-map-120',bytes:Buffer.byteLength(text),floors:p.floors.length,items:p.floors.reduce((n,f)=>n+f.items.length,0),...times}));
 }
});
