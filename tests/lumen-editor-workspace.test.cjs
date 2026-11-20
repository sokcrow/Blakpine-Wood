const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={uid:'dm',ownerUid:'dm',campaignId:'a'.repeat(20),rulesetId:'legacy',status:'active'};
class Memory {
 records=new Map();
 async read(key){return structuredClone(this.records.get(key));}
 async update(key,fn){const {record,result}=fn(await this.read(key));this.records.set(key,structuredClone(record));return result;}
 async list(){return [...this.records].map(([key,record])=>({key,record:structuredClone(record)}));}
}
async function setup(){
 const {WorkspaceStore,EditorWorkspace,editorURL,libraryURL}=await import('../portal/editor-workspace-model.js');
 const {RecoveryStore}=await import('../portal/cartridge-recovery.js'),m=await import('../portal/cartridge.js');
 const project=JSON.parse(fs.readFileSync('forest-horror/maps/DEMO_Ascensor_5_Pisos.json'));
 project.future={complete:['🌲','power','water']};
 const validate=p=>{assert.equal(p.schema,'forest-horror-map-v1');p.changedByValidator=true;};
 const doc=m.changeMap(m.createCartridge(context),context,validate,{name:'Mapa',project,expectedRevision:1});
 const workspaces=new WorkspaceStore(new Memory()),recoveries=new RecoveryStore(new Memory());
 const handoff=await workspaces.create(context,doc.cartridge,doc.mapId,validate,{needsExport:false});
 let input=structuredClone(project);let saved=0;
 const api={validate,read:()=>structuredClone(input),saved:()=>saved++};
 const editor=new EditorWorkspace({context,id:handoff.id,record:handoff,api,verify:async()=>context,workspaces,recoveries});
 return {editor,workspaces,recoveries,handoff,project,doc:doc.cartridge,validate,editorURL,libraryURL,setInput:p=>input=p,saved:()=>saved};
}
test('Traspaso conserva el cartucho completo y no pisa recuperaciones al abrir un archivo sin editar',async()=>{
 const f=await setup(),before=JSON.stringify(f.doc);
 const initial=await f.workspaces.read(context,f.handoff.id,f.validate);
 assert.deepEqual(initial.cartridge,f.doc);assert.equal(initial.needsExport,false);
 await f.editor.save();assert.equal(JSON.stringify(f.editor.record.cartridge),before);
 assert.equal((await f.recoveries.read(context,f.doc.cartridgeId,f.validate)).snapshots.length,0);
 assert.match(f.editorURL(context.campaignId,f.handoff.id),/^\.\.\/index\.html\?editor=1&lumenCartridge=1&campaign=/);
 assert.equal(f.libraryURL(context.campaignId,f.handoff.id),'./portal/#mapas/'+context.campaignId+'/'+f.handoff.id);
 await assert.rejects(()=>f.workspaces.read({...context,uid:'other',ownerUid:'other'},f.handoff.id,f.validate),/WORKSPACE/);
});
test('Guardar actualiza sólo el mapa seleccionado y permite volver a abrir la copia exacta',async()=>{
 const f=await setup(),next=structuredClone(f.project);next.title='Editado';
 f.setInput(next);f.editor.changed();await f.editor.save();
 const loaded=await f.workspaces.read(context,f.handoff.id,f.validate);
 assert.deepEqual(loaded.cartridge.maps[0].project,next);assert.equal(loaded.cartridge.revision,f.doc.revision+1);
 assert.equal(loaded.needsExport,true);assert.equal(loaded.pendingRecovery,false);assert.equal(f.saved(),1);
 assert.deepEqual((await f.recoveries.read(context,f.doc.cartridgeId,f.validate)).snapshots[0].cartridge,loaded.cartridge);
 assert.deepEqual(f.doc.maps[0].project,f.project);
});
test('Conflicto en la recuperación conserva la versión ajena y la edición en su espacio propio',async()=>{
 const f=await setup(),other=structuredClone(f.doc);other.revision=99;other.maps[0].project.title='Otra pestaña';
 await f.recoveries.save(other,context,f.validate);
 f.editor.record.recoveryFloor=99;const next=structuredClone(f.project);next.title='Mi copia';f.setInput(next);f.editor.changed();
 await f.editor.save();
 assert.equal(f.editor.record.recoveryError,'RECOVERY_CONFLICT');assert.equal(f.editor.record.cartridge.revision,100);
 assert.equal((await f.workspaces.read(context,f.handoff.id,f.validate)).cartridge.maps[0].project.title,'Mi copia');
 assert.equal((await f.recoveries.read(context,f.doc.cartridgeId,f.validate)).snapshots[0].cartridge.maps[0].project.title,'Otra pestaña');
});
test('Validación, cuota y cambio de cuenta no descartan el proyecto ni permiten un guardado cruzado',async()=>{
 const f=await setup();f.setInput({schema:'invalid'});f.editor.changed();
 await assert.rejects(()=>f.editor.save());assert.deepEqual(f.editor.record.cartridge,f.doc);
 f.setInput({...f.project,title:'Sin cuota'});
 f.workspaces.backend.update=async()=>{throw Object.assign(Error('full'),{name:'QuotaExceededError'});};
 await assert.rejects(()=>f.editor.save(),/RECOVERY_QUOTA/);assert.equal(f.editor.record.cartridge.maps[0].project.title,'Sin cuota');
 f.editor.verify=async()=>({...context,uid:'other'});await assert.rejects(()=>f.editor.save(),/ACCESS/);
});
test('Dos ventanas sobre el mismo espacio no se sobrescriben silenciosamente',async()=>{
 const f=await setup(),stale=await f.workspaces.read(context,f.handoff.id,f.validate);
 await f.editor.save();await assert.rejects(()=>f.workspaces.save(context,f.handoff.id,stale,f.validate,stale.token),/CONFLICT/);
});
test('Editar navega a la herramienta real; no carga ni muestra el editor dentro de la biblioteca',async()=>{
 const f=await setup();global.window={addEventListener(){}};global.document={getElementById:()=>({hidden:true})};global.location={href:''};
 const {MapLibrary}=await import('../portal/map-library.js'),{workspaceStore}=await import('../portal/editor-workspace-model.js');
 const previous=workspaceStore.backend;workspaceStore.backend=new Memory();
 try{
  const state={doc:f.doc,dirty:false,editorDirty:false,saveQueue:Promise.resolve(),recoveryTokens:new Map()};
  const view=new MapLibrary({},state,context,async()=>context);view.api={validate:f.validate,load:()=>assert.fail('Editor embebido')};view.frame={hidden:true};
  await view.edit(f.doc.maps[0].mapId);assert.match(location.href,/index\.html\?editor=1/);assert.equal(view.frame.hidden,true);
  const id=new URL(location.href,'https://example.test/portal/').searchParams.get('workspace');
  assert.deepEqual((await workspaceStore.read(context,id,f.validate)).cartridge,f.doc);
 }finally{workspaceStore.backend=previous;}
});
test('Probar 3D conserva el botón original y envía el mapa editado al mismo motor',()=>{
 const html=fs.readFileSync('index.html','utf8'),start=html.indexOf('function setupPlayMode(){'),end=html.indexOf('// —— Vista 3D integrada',start);
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{addEventListener(){}});return nodes.get(id);};
 for(const mode of [false,true]){
  let launch=0,play=0;const raw={title:'Actual'};
  const c=vm.createContext({lumenCartridgeMode:mode,window:{addEventListener(){},LumenEditor:{read:()=>raw,play:p=>{assert.equal(p,raw);play++;}}},
   $:node,document:{querySelector:node},stopPlay(){},playAction(){},playResize(){},launch3DPreview:()=>launch++});
  vm.runInContext(html.slice(start,end)+';setupPlayMode();',c);nodes.get('#testBtn').onclick();
  assert.equal(play,mode?1:0);assert.equal(launch,mode?0:1);
 }
});
