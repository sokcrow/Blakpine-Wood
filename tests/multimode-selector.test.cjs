'use strict';
/* Etapa 3.3: contratos, lector real, arranque Legacy, registro, entrada HTML y UI. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const editor=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=fs.readFileSync(path.join(root,'contratos/multimodo/validar-contratos.mjs'),'utf8');
const validator=vm.runInNewContext(source.slice(source.indexOf('function matchesType'),source.indexOf('const refs ='))+'\nvalidate',
 {assert(condition,message){assert.ok(condition,message);}});
const validate=(value,schema)=>{validator(value,schema);return true;};
const start=editor.indexOf('const ForestShared=(()=>{');
const end=editor.indexOf("\n'use strict';",start);
assert.ok(start>0&&end>start);
const validateMap=vm.runInNewContext(editor.slice(start,end)+'\nForestShared.validate');
const choice=require('../juego/assets/fh-multimode-selector.js');
const {createNode}=require('../juego/core/fh-multimode-resource-reader.js');
const selection=require('../juego/core/fh-mode-selection.js');
const worldLoader=require('../juego/worlds/fh-world-profile-loader.js');
const coordinator=require('../juego/core/fh-session-coordinator.js');
const registryModule=require('../juego/core/fh-mode-adapter-registry.js');
const browserValidator=require('../juego/core/fh-multimode-schema-validator.js');
const mapPath='forest-horror/maps/DEMO_Interacciones.json';
const io=sourceRoot=>createNode({
 root:sourceRoot,resources:{...choice.resources},validate,validateMap:data=>validateMap(data).ok
});
function runtime(sourceRoot=root){
 const reader=io(sourceRoot),registry=registryModule.create();
 registry.registerNativeLegacy(()=>{});
 return {reader,registry,api:choice.createRuntime({
  io:reader,worldLoader:worldLoader.create(reader),registry,
  modeSelection:selection,coordinator
 })};
}
const rejected=(promise,code)=>assert.rejects(promise,error=>error.code===code);
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fh-mode-selector-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.cpSync(path.join(root,'contratos'),path.join(dir,'contratos'),{recursive:true});
 fs.mkdirSync(path.join(dir,'forest-horror/maps'),{recursive:true});
 fs.copyFileSync(path.join(root,mapPath),path.join(dir,mapPath));
 return dir;
}

test('HTML mantiene entrada Legacy original y enlaza módulos reales antes del inicio',()=>{
 for(const name of ['fh-mode-selection.js','fh-world-profile-loader.js','fh-multimode-resource-reader.js',
  'fh-multimode-schema-validator.js','fh-mode-adapter-registry.js','fh-multimode-selector.js']){
  assert.ok(editor.includes(name),name);
 }
 for(const id of ['testBtn','fhModesBtn','fhModesOverlay','fhModesStart','fhModesLegacyLocal']){
  assert.match(editor,new RegExp('id="'+id+'"'));
 }
 assert.match(editor,/setupPlayMode\(\);\s*init\(\);/);
 assert.match(editor,/window\.FHMultimodeSelector\?\.mount/);
 assert.match(editor,/function launch3DPreview\(/);
 assert.match(editor,/FOREST_PREVIEW_MAP/);
 assert.match(editor,/preview3DSelectedMap=null;\s*launch3DPreview\(\)/);
});

test('validador navegador comprueba los mismos esquemas y falla cerrado',()=>{
 for(const file of ['contratos/multimodo/v1/seleccion-modo.schema.json',
  'contratos/multimodo/v1/perfil-mundo.schema.json',
  'contratos/multimodo/v1/manifiesto-reglas.schema.json']){
  const schema=read(file),sample=file.includes('seleccion-')?choice.binding('ciudad-moderna','legacy'):
   file.includes('perfil-')?read(choice.worlds[0].path):read(choice.rules[0].path);
  assert.equal(browserValidator.validate(sample,schema),true);
  assert.throws(()=>browserValidator.validate({...sample,version:999},schema),/CONTRACT_INVALID/);
 }
 assert.throws(()=>browserValidator.validate({...choice.binding('ciudad-moderna','legacy'),
  worldProfile:'../secret.json'},read('contratos/multimodo/v1/seleccion-modo.schema.json')),/CONTRACT_INVALID/);
});

test('tres mundos, tres reglas, nueve pares y solo moderno/Legacy habilitados',async()=>{
 const {api}=runtime();
 await api.load();
 assert.equal(api.world('ciudad-moderna').description.scenario.status,'map-available');
 assert.equal(api.world('distopia').description.scenario.status,'declarative-only');
 assert.equal(api.world('villa-medieval').description.scenario.status,'declarative-only');
 for(const w of choice.worlds)for(const r of choice.rules){
  const mode=await selection.readSelection(choice.binding(w.id,r.id),io(root));
  assert.equal(mode.worldProfile.id,w.id);
  assert.equal(mode.rulesetManifest.id,r.id);
  assert.equal(api.canStart(w.id,r.id),w.id==='ciudad-moderna'&&r.id==='legacy');
  if(w.id!=='ciudad-moderna'||r.id!=='legacy')await assert.rejects(api.prepare(w.id,r.id),/MODE_NOT_AVAILABLE/);
 }
});

test('el mapa moderno completo se prepara y no se altera el JSON ni se inventan perfiles',async()=>{
 const {api}=runtime();await api.load();
 const prepared=await api.prepare('ciudad-moderna','legacy');
 assert.equal(prepared.entry.kind,'native');
 assert.equal(prepared.mode.rulesetManifest.status,'planned');
 assert.deepEqual(prepared.payload.scenario.data,read(mapPath));
 assert.equal(prepared.payload.scenario.data.floors.length,2);
 assert.ok(Object.isFrozen(prepared.payload.scenario.data));
 assert.equal(read(mapPath).floors.some(f=>f.items.some(it=>it.type==='spawn')),false);
});

test('no autoriza rutas ajenas y nunca convierte inexistencia en modo Legacy',async()=>{
 const reader=io(root);
 await rejected(reader.readJson('../secret.json'),'RESOURCE_PATH_INVALID');
 await rejected(reader.readJson('forest-horror/maps/no-autorizado.json'),'RESOURCE_NOT_AUTHORIZED');
 await rejected(selection.readSelection({...choice.binding('ciudad-moderna','legacy'),
  worldProfile:'contratos/multimodo/ejemplos/mundos/no-existe.json'},reader),'DOCUMENT_READ_FAILED');
});

test('mapa inexistente deja el modo moderno bloqueado; sin fallback del editor',async t=>{
 const dir=fixture(t),target=path.join(dir,mapPath);
 fs.unlinkSync(target);
 const {api}=runtime(dir);await api.load();
 assert.equal(api.canStart('ciudad-moderna','legacy'),false);
 assert.equal(api.world('ciudad-moderna').error?.code,'WORLD_MAP_READ_FAILED');
 await assert.rejects(api.prepare('ciudad-moderna','legacy'),/MODE_NOT_AVAILABLE/);
});

test('referencias no autorizadas en perfil se rechazan antes de activar',async t=>{
 const dir=fixture(t),location=path.join(dir,choice.worlds[0].path),profile=read(choice.worlds[0].path);
 profile.map.path='forest-horror/maps/fantasma.json';
 fs.writeFileSync(location,JSON.stringify(profile));
 const {api}=runtime(dir);await api.load();
 assert.equal(api.canStart('ciudad-moderna','legacy'),false);
 assert.equal(api.world('ciudad-moderna').error?.code,'RESOURCE_REFERENCE_NOT_AUTHORIZED');
});

test('registro evita suplantes; DnD solo habilitado con adaptador registrado y Moon bloqueado',async()=>{
 const {api,registry}=runtime();
 for(const id of ['dnd','moon-system']){
  registry.register({adapter:{
   id:'combat.'+id,rulesetId:id,contract:'blakpine-combat-adapter-v1',evaluate(){}
  },start(){}});
 }
 assert.throws(()=>registry.registerNativeLegacy(()=>{}),/MODE_NATIVE_INVALID/);
 assert.throws(()=>registry.register({adapter:{
  id:'combat.dnd',rulesetId:'dnd',contract:'blakpine-combat-adapter-v1',evaluate(){}
 },start(){}}),/MODE_ADAPTER_INVALID/);
 await api.load();
 assert.equal(api.rule('dnd').manifest.status,'implemented');
 assert.equal(api.canStart('ciudad-moderna','dnd'),true);
 assert.equal((await api.prepare('ciudad-moderna','dnd')).entry.kind,'adapter');
 assert.equal(api.rule('moon-system').manifest.status,'planned');
 assert.equal(api.canStart('ciudad-moderna','moon-system'),false);
});

class Element {
 constructor(document,id=''){
  this.document=document;this.id=id;this.events={};this.attributes={};
  this.children=[];this.dataset={};this.hidden=true;this.disabled=false;this.textContent='';
 }
 addEventListener(type,callback){(this.events[type]??=[]).push(callback);}
 fire(type,extra={}){
  if(type==='click'&&this.disabled)return;
  const event={target:this,preventDefault(){this.prevented=true;},...extra};
  for(const callback of this.events[type]||[])callback(event);
  return event;
 }
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=[...nodes];}
 setAttribute(name,value){this.attributes[name]=value;}
 focus(){this.document.activeElement=this;}
 querySelectorAll(){
  const d=this.document;
  return [d.ids.fhModesClose,...d.ids.fhWorldOptions.children,
   ...d.ids.fhRulesOptions.children,d.ids.fhModesStart,d.ids.fhModesLegacyLocal].filter(n=>!n.disabled);
 }
}
function makeDOM(){
 const doc={ids:{},activeElement:null};
 for(const id of ['fhModesBtn','fhModesOverlay','fhModesClose','fhModesStatus',
  'fhWorldOptions','fhRulesOptions','fhModesStart','fhModesLegacyLocal']){
  doc.ids[id]=new Element(doc,id);
 }
 doc.getElementById=id=>doc.ids[id];
 doc.createElement=tag=>{const e=new Element(doc);e.tagName=tag;return e;};
 return doc;
}

test('UI offline: Legacy del editor, teclado, Escape, Tab, click y tacto',async t=>{
 const backup=Object.fromEntries(['document','location','FH_MULTIMODE_TEXT',
  'FHModeAdapterRegistry'].map(k=>[k,globalThis[k]]));
 t.after(()=>{for(const [key,value]of Object.entries(backup))if(value===undefined)delete globalThis[key];else globalThis[key]=value;});
 require('../juego/assets/fh-multimode-strings.js');
 globalThis.FHModeAdapterRegistry=registryModule;
 globalThis.location={protocol:'file:'};
 const document=makeDOM();globalThis.document=document;
 let localLaunches=0,worldLaunches=0;
 const app=choice.mount({validateMap:()=>true,
  launchLegacyWorld(){worldLaunches++;},launchLegacyCurrent(){localLaunches++;}});
 assert.ok(app);
 const d=document.ids;d.fhModesBtn.fire('click');
 assert.equal(d.fhModesOverlay.hidden,false);
 assert.equal(document.activeElement,d.fhModesClose);
 assert.equal(d.fhModesStart.disabled,true);
 assert.equal(d.fhWorldOptions.children.length,3);
 assert.equal(d.fhRulesOptions.children.length,3);
 assert.ok(d.fhWorldOptions.children.every(c=>c.disabled));
 assert.ok(d.fhRulesOptions.children.every(c=>c.disabled));
 assert.match(d.fhModesStatus.textContent,/Sin acceso HTTPS/);
 d.fhModesStart.fire('click');assert.equal(worldLaunches,0);
 const backwards=d.fhModesOverlay.fire('keydown',{key:'Tab',shiftKey:true});
 assert.equal(backwards.prevented,true);
 assert.equal(document.activeElement,d.fhModesLegacyLocal);
 const forwards=d.fhModesOverlay.fire('keydown',{key:'Tab',shiftKey:false});
 assert.equal(forwards.prevented,true);
 assert.equal(document.activeElement,d.fhModesClose);
 d.fhModesOverlay.fire('pointerdown',{target:d.fhModesOverlay,pointerType:'touch'});
 assert.equal(d.fhModesOverlay.hidden,true);
 d.fhModesBtn.fire('click');d.fhModesOverlay.fire('keydown',{key:'Escape'});
 assert.equal(d.fhModesOverlay.hidden,true);
 d.fhModesBtn.fire('click');d.fhModesLegacyLocal.fire('click',{pointerType:'touch'});
 assert.equal(localLaunches,1);assert.equal(worldLaunches,0);
 assert.equal(d.fhModesOverlay.hidden,true);
});

test('UI offline: los tres catálogos pueden seleccionarse sin activar una partida',t=>{
 const backup=Object.fromEntries(['document','location','FH_MULTIMODE_TEXT',
  'FHModeAdapterRegistry'].map(k=>[k,globalThis[k]]));
 t.after(()=>{for(const [key,value]of Object.entries(backup))if(value===undefined)delete globalThis[key];else globalThis[key]=value;});
 vm.runInThisContext(fs.readFileSync(path.resolve(__dirname,'../juego/assets/fh-multimode-strings.js'),'utf8'));
 globalThis.FHModeAdapterRegistry=registryModule;
 globalThis.location={protocol:'file:'};
 const document=makeDOM(),d=document.ids;
 globalThis.document=document;
 const selections=[];
 choice.mount({
  validateMap:()=>true,selectEditorRuleset:id=>selections.push(id),
  launchLegacyWorld:()=>assert.fail('partida remota sin perfil'),
  launchLegacyCurrent:()=>assert.fail('partida local sin pulsar su botón')
 });
 d.fhModesBtn.fire('click');
 for(const id of ['dnd','moon-system','legacy']){
  const button=d.fhRulesOptions.children.find(choice=>choice.dataset.rule===id);
  assert.equal(button.disabled,false);
  button.focus();
  button.fire('click');
  assert.equal(document.activeElement.dataset.rule,id);
  assert.equal(document.activeElement.attributes['aria-pressed'],'true');
  assert.equal(d.fhModesStart.disabled,true);
 }
 assert.deepEqual(selections,['dnd','moon-system','legacy']);
 assert.equal(d.fhModesLegacyLocal.disabled,false);
});
