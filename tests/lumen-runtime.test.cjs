const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const extract=(a,b)=>{const from=html.indexOf(a),to=html.indexOf(b,from);assert.ok(from>=0&&to>from);return html.slice(from,to);};
test('El motor recibe la copia íntegra del cartucho sin cargar progreso Legacy ni mutar el mapa',()=>{
 const project=JSON.parse(fs.readFileSync('forest-horror/maps/DEMO_Ascensor_5_Pisos.json'));
 project.future={opaque:['🌲',1]};project.floors[0].items.push({id:'test-spawn',type:'spawn',x:1,y:1});
 const before=JSON.stringify(project);let legacyReads=0;
 const c=vm.createContext({preview3DSelectedMap:project,project:{},clone:structuredClone,
  window:{FHCharacterCreation:{current:()=>({id:'character',life:'alive'})}},preview3DSaveContext:()=>null,
  readStorage:()=>{legacyReads++;return 'old';}});
 vm.runInContext(extract('function makeCurrent3DProject(){','function show3DStatus('),c);
 const sent=c.makeCurrent3DProject();assert.deepEqual(sent.floors,project.floors);assert.deepEqual(sent.future,project.future);
 assert.equal(sent.__runtimeSave,null);assert.equal(sent.__runtimeCharacter.id,'character');
 assert.equal(legacyReads,0);assert.equal(JSON.stringify(project),before);
 sent.floors[0].items[0].future='runtime';assert.equal(JSON.stringify(project),before);
});
test('La ruta real de arranque aísla el almacenamiento del motor y conserva sintaxis',()=>{
 const {html:source}=require('./helpers/forest-engine.cjs')();
 const code=extract('  if(lumenLaunch){\n   const saveHook=', '  play3DFrame.srcdoc=engineDoc;');
 const patch=lumenLaunch=>vm.runInNewContext(code+';engineDoc',{lumenLaunch,engineDoc:source});
 const isolated=patch({});assert.equal(patch(null),source);
 assert.ok(isolated.includes('const localSave=null;'));assert.ok(!isolated.includes('localSave=window.localStorage'));
 assert.doesNotThrow(()=>new vm.Script(isolated.slice(isolated.lastIndexOf('<script>')+8,isolated.lastIndexOf('</script>'))));
});
test('Mensajes de guardado del cartucho no escriben claves Legacy; el editor independiente conserva su guardado',()=>{
 function run(lumenCartridgeMode){let listener,writes=0,selected=0;const child={};
  const context=vm.createContext({lumenCartridgeMode,preview3DActive:true,play3DFrame:{contentWindow:child},previewSaveSession:null,
   project:{},ForestShared:{gameSaveKey:()=> 'legacy-key'},window:{addEventListener:(_name,fn)=>listener=fn,
    FHCharacterCreation:{current:()=>({id:'character'}),selectMapSave:()=>{selected++;return 'save';}}},safeStorage:()=>writes++});
  vm.runInContext(extract("window.addEventListener('message',e=>{","// Fullscreen se solicita"),context);
  listener({source:child,data:{type:'FOREST_GAMESTATE_SAVE',key:'legacy-key',json:'save'}});
  return {writes,selected};
 }
 assert.deepEqual(run(true),{writes:0,selected:0});assert.deepEqual(run(false),{writes:1,selected:1});
});
