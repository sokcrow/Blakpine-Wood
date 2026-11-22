'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('function launchDndCurrentMap(){');
const end=html.indexOf('\nfunction continue3DPreviewInLandscape()',start);
assert.ok(start>=0&&end>start,'No está el arranque DnD del mapa del editor');
const launcher=html.slice(start,end);
function harness({map={createdAt:'mapa_usuario_1',floors:[{items:[]}]},
 valid=true,adapter=true}={}){
 const errors=[],scope={project:map,preview3DSelectedMap:{title:'DEMO'},
  window:{FH_MULTIMODE_TEXT:{dndUnavailable:'faltan adaptadores',mapIdMissing:'sin id',
   currentMapInvalid:'mapa inválido'},
   FHDndCombat:adapter?{status:'implemented'}:null,
   FHDndSaveAdapter:adapter?{initial(){}}:null},
  ForestShared:{validate:()=>({ok:valid})},toast:message=>errors.push(message),
  launch3DPreview(){scope.launches++},launches:0};
 const fn=vm.runInNewContext('('+launcher+')',scope);
 return {fn,scope,errors};
}
test('Mapa actual en D&D usa su createdAt, su partida y nunca la DEMO',()=>{
 const h=harness(),before=JSON.stringify(h.scope.project);
 assert.equal(h.fn(),true);assert.equal(h.scope.launches,1);
 assert.equal(h.scope.preview3DSelectedMap,null);
 assert.equal(h.scope.window.FHMultimodeSaveSelection.mapId,'mapa_usuario_1');
 assert.equal(h.scope.window.FHMultimodeSaveSelection.rulesetId,'dnd');
 assert.equal(h.scope.window.FHMultimodeSaveSelection.rulesetVersion,1);
 assert.equal(JSON.stringify(h.scope.project),before,'No edita el mapa');
});
test('D&D no inicia sin adaptadores, ID o mapa válido',()=>{
 for(const [opts,error] of [
  [{adapter:false},'faltan adaptadores'],
  [{map:{createdAt:'',floors:[{}]}},'sin id'],
  [{valid:false},'mapa inválido']]){
  const h=harness(opts);assert.equal(h.fn(),false);
  assert.deepEqual(h.errors,[error]);assert.equal(h.scope.launches,0);
 }
});
test('El mapa de edición lleva ficha DnD propia al iframe y no usa creador Legacy',()=>{
 const start=html.indexOf('function makeCurrent3DProject(){');
 const end=html.indexOf('\nfunction show3DStatus(',start);
 const source=html.slice(start,end);
 assert.match(source,/const dndProfile=session\?\.identity\.rulesetId==='dnd'/);
 assert.match(source,/__dndCharacter:\{id:dndProfile\.id,sheet:clone\(dndProfile\.sheet\)\}/);
 assert.match(source,/__multimodeSave:session/);
 assert.match(source,/__runtimeCharacter:session\?null/);
});
test('La entrada Lumen.play acepta DnD, usa el JSON recibido y no muestra pendiente',()=>{
 const start=html.indexOf('  play(raw,onClose){');
 const end=html.indexOf('  stop(){',start);
 const source=html.slice(start,end);
 assert.ok(start>=0&&end>start);
 assert.doesNotMatch(source,/dndPreviewUnavailable/);
 assert.match(source,/validate\(raw\)/);
 assert.match(source,/window\.FHMultimodeSaveSelection=lumenEditorRuleset==='dnd'/);
 assert.match(source,/mapId:raw\.createdAt/);
 assert.match(source,/preview3DSelectedMap=clone\(raw\)/);
});
test('Lumen.play invoca el lanzamiento DnD con el JSON editado y callback',()=>{
 const start=html.indexOf('  play(raw,onClose){');
 const end=html.indexOf('  stop(){',start);
 const method=html.slice(start,end);
 let launch=0,close=0,errors=[];
 const scope={window:{FH_MULTIMODE_TEXT:{mapIdMissing:'sin id'},
  FHMultimodeSaveSelection:null},
  lumenEditorRuleset:'dnd',lumenPlaySession:null,preview3DSelectedMap:null,
  validate:()=>true,clone:value=>JSON.parse(JSON.stringify(value)),
  toast:message=>errors.push(message),launch3DPreview:()=>launch++};
 const api=vm.runInNewContext('({'+method+'})',scope);
 api.stop=()=>{close++};
 const raw={createdAt:'mi_mapa_123',floors:[{items:[]}],title:'Castillo propio'};
 api.play(raw,()=>{});
 assert.equal(launch,1);assert.equal(close,1);
 assert.equal(scope.window.FHMultimodeSaveSelection.rulesetId,'dnd');
 assert.equal(scope.window.FHMultimodeSaveSelection.mapId,'mi_mapa_123');
 assert.deepEqual(JSON.parse(JSON.stringify(scope.preview3DSelectedMap)),raw);
 assert.notEqual(scope.preview3DSelectedMap,raw,'La sesión debe recibir una copia');
 assert.deepEqual(errors,[]);
});
test('Probar 3D usa DnD cuando se eligió ese reglamento y Legacy por defecto',()=>{
 assert.match(html,/FHEditorCatalog\?\.ruleset\?\.\(\)==='dnd'\)\{launchDndCurrentMap\(\)/);
 assert.match(html,/window\.FHMultimodeSaveSelection=null;preview3DSelectedMap=null;launch3DPreview\(\)/);
 assert.match(html,/id="fhModesDndLocal"/);
});
