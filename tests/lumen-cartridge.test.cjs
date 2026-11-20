const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const editor=fs.readFileSync('index.html','utf8');
const from=editor.indexOf('const ForestShared=(()=>{'),to=editor.indexOf("\n'use strict';",from);
const shared=vm.runInNewContext(editor.slice(from,to)+';ForestShared');
const validate=p=>shared.loadProject(p);
const context={uid:'dm-one',ownerUid:'dm-one',campaignId:'campaign-one',rulesetId:'legacy',status:'active'};
const map=()=>JSON.parse(fs.readFileSync('forest-horror/maps/DEMO_Ascensor_5_Pisos.json'));
test('Campañas, IDs, JSON completo, revisiones y reimportación',async()=>{
 const m=await import('../portal/cartridge.js');
 const a=m.createCartridge(context),ctx2={...context,campaignId:'campaign-two'},b=m.createCartridge(ctx2);
 assert.notEqual(a.cartridgeId,b.cartridgeId);
 const project=map();project.custom={unknown:[1,2],electric:{unmodified:true}};
 const original=JSON.stringify(project);
 const first=m.changeMap(a,context,validate,{name:'Igual',project,expectedRevision:1});
 const second=m.changeMap(first.cartridge,context,validate,{name:'Igual',project,expectedRevision:2});
 assert.notEqual(first.mapId,second.mapId);
 const other=m.changeMap(b,ctx2,validate,{name:'Igual',project,expectedRevision:1});
 assert.notEqual(first.mapId,other.mapId);
 assert.equal(JSON.stringify(second.cartridge.maps[0].project),original);
 const renamed=m.changeMap(second.cartridge,context,validate,{mapId:first.mapId,name:'Nuevo',expectedRevision:3});
 assert.deepEqual(renamed.cartridge.maps[1],second.cartridge.maps[1]);
 assert.deepEqual(m.importCartridge(m.exportCartridge(renamed.cartridge,context,validate),context,validate),renamed.cartridge);
 assert.equal(a.maps.length,0);assert.equal(JSON.stringify(project),original);
 assert.throws(()=>m.changeMap(a,context,validate,{name:'x',project,expectedRevision:3}),/CONFLICT/);
});
test('Rechazo sin mutación de identidad, versión, corrupción y miembros',async()=>{
 const m=await import('../portal/cartridge.js'),a=m.createCartridge(context),before=JSON.stringify(a);
 for(const patch of [{campaignId:'other'},{ownerUid:'other'},{rulesetId:'dnd'},{formatVersion:2},{revision:NaN},{connections:[{}]},{token:'secret'},{worldState:{version:2,data:null}}])
  assert.throws(()=>m.validateCartridge({...a,...patch},context,validate));
 assert.throws(()=>m.importCartridge('{',context,validate),/JSON/);
 assert.throws(()=>m.createCartridge({...context,uid:'player'}),/ACCESS/);
 assert.throws(()=>m.createCartridge({...context,status:'archived'}),/ACCESS/);
 assert.throws(()=>m.changeMap(a,context,validate,{name:'x',project:{schema:'forest-horror-map-v2'},expectedRevision:1}));
 assert.equal(JSON.stringify(a),before);
});
