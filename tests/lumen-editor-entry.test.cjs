const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Memory {
 records=new Map();
 async read(key){return structuredClone(this.records.get(key));}
 async update(key,fn){const {record,result}=fn(await this.read(key));this.records.set(key,structuredClone(record));return result;}
 async list(){return [...this.records].map(([key,record])=>({key,record:structuredClone(record)}));}
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function boot({signedIn=true,iframe=false}={}){
 const m=await import('../portal/cartridge.js'),r=await import('../portal/cartridge-recovery.js'),w=await import('../portal/editor-workspace-model.js');
 const strings=await import('../portal/cartridge-strings.js'),{campaignAccess}=await import('../portal/cartridge-access.js');
 const previous=w.workspaceStore.backend,previousRecovery=r.recoveryStore.backend;
 w.workspaceStore.backend=new Memory();r.recoveryStore.backend=new Memory();
 const context={uid:'dm',ownerUid:'dm',campaignId:'a'.repeat(20),rulesetId:'legacy',status:'active'};
 const project={schema:'forest-horror-map-v1',future:{full:'🌲'}},validate=p=>assert.equal(p.schema,'forest-horror-map-v1');
 const map=m.changeMap(m.createCartridge(context),context,validate,{name:'Mapa',project,expectedRevision:1});
 const handoff=await w.workspaceStore.create(context,map.cartridge,map.mapId,validate,{needsExport:false});
 const auth={currentUser:signedIn?{uid:'dm'}:null},listeners=[],events={};let actions,loaded=null,changed,stops=0;
 const nodes=new Map([['app',{inert:false}],['autosave',{textContent:''}]]);
 const doc={getElementById:id=>nodes.get(id),createElement:()=>({setAttribute(){},replaceChildren(...children){this.children=children;}}),
  body:{append(node){nodes.set(node.id,node);}}};
 let ruleset=null;
 const api={validate,setRuleset:id=>{ruleset=id;},
  load:(p,callback)=>{loaded=p;changed=callback;},read:()=>structuredClone(loaded),setActions:a=>actions=a,saved(){},stop:()=>stops++};
 const win={LumenEditor:api,addEventListener:(name,fn)=>events[name]=fn};win.parent=iframe?{}:win;
 const location={search:'?editor=1&lumenCartridge=1&campaign='+context.campaignId+'&workspace='+handoff.id,href:''};
 const authSDK={getAuth:()=>auth,onAuthStateChanged:(_auth,fn)=>{
  listeners.push(fn);queueMicrotask(()=>fn(auth.currentUser));return ()=>{};
 }};
 const sandbox=vm.createContext({window:win,document:doc,location,URLSearchParams,queueMicrotask,setTimeout,clearTimeout,
  firebaseConfig:{},campaignAccess,workspaceStore:w.workspaceStore,EditorWorkspace:w.EditorWorkspace,libraryURL:w.libraryURL,
  exportCartridge:m.exportCartridge,cartridgeFilename:m.cartridgeFilename,...strings,
  mockApps:{getApps:()=>[],initializeApp:()=>({})},mockAuth:authSDK,mockFirestore:{getFirestore:()=>({}),doc:()=>({}),getDocFromServer:async()=>({exists:()=>true,data:()=>({ownerId:'dm',ruleset:'legacy',status:'active',name:'Campaña'})})}});
 let source=fs.readFileSync('portal/editor-workspace.js','utf8').replace(/^import .*;\n/gm,'');
 source=source.replace(/import\('https:\/\/www\.gstatic\.com\/firebasejs\/13\.3\.0\/firebase-app\.js'\)/,"Promise.resolve(mockApps)")
  .replace(/import\('https:\/\/www\.gstatic\.com\/firebasejs\/13\.3\.0\/firebase-auth\.js'\)/,"Promise.resolve(mockAuth)")
  .replace(/import\('https:\/\/www\.gstatic\.com\/firebasejs\/13\.3\.0\/firebase-firestore\.js'\)/,"Promise.resolve(mockFirestore)");
 vm.runInContext(source,sandbox);await tick();await tick();
 return {actions:()=>actions,nodes,location,auth,events,changed:()=>changed(),loaded:()=>loaded,ruleset:()=>ruleset,
  signOut:()=>{auth.currentUser=null;listeners.forEach(fn=>fn(null));},stops:()=>stops,
  cleanup:()=>{w.workspaceStore.backend=previous;r.recoveryStore.backend=previousRecovery;}};
}
test('Página independiente: autoriza, abre la copia completa y guarda antes de volver a la biblioteca',async()=>{
 const f=await boot();try{
  assert.equal(f.nodes.get('app').inert,false);assert.deepEqual(f.loaded().future,{full:'🌲'});
  assert.equal(f.ruleset(),'legacy','el puente debe establecer modo antes de cargar el mapa');
  assert.equal(typeof f.actions().save,'function');await f.actions().close();
  assert.match(f.location.href,/^\.\/portal\/#mapas\//);
  let prevented=false;f.events.beforeunload({preventDefault:()=>prevented=true});assert.equal(prevented,false);
 }finally{f.cleanup();}
});
test('No hay acceso sin sesión y cerrar sesión bloquea la herramienta y detiene su motor',async()=>{
 const missing=await boot({signedIn:false});try{
  assert.equal(missing.loaded(),null);assert.equal(missing.nodes.get('app').inert,true);assert.ok(missing.nodes.has('workspace-error'));
 }finally{missing.cleanup();}
 const f=await boot();try{f.signOut();assert.equal(f.nodes.get('app').inert,true);assert.equal(f.stops(),1);assert.ok(f.nodes.has('workspace-error'));}finally{f.cleanup();}
});
test('El arranque de página completa no se activa en los iframes del motor o de validación',async()=>{
 const f=await boot({iframe:true});try{assert.equal(f.loaded(),null);assert.equal(f.actions(),undefined);}finally{f.cleanup();}
});

test('Lumen registra su API antes de inicializar los módulos tardíos',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const guard=html.indexOf('if(!lumenCartridgeMode){setupPlayMode();init();}');
 const register=html.indexOf('window.LumenEditor=Object.freeze({',guard);
 const deferred=html.indexOf('ensureLumenEditorInitialized();',register);
 assert.ok(guard>0&&register>guard&&deferred>register,
  'la apertura del cartucho inicializa el editor sólo al cargar su mapa');
 const match=html.match(/setRuleset\(rulesetId\)\{([\s\S]*?)\n  \},\n  create:/);
 assert.ok(match,'se localiza la implementación real de setRuleset');
 const update=new Function('window','rulesetId',
  'let lumenEditorRuleset="legacy";'+match[1]+';return lumenEditorRuleset;');
 assert.equal(update({},'dnd'),'dnd','el catálogo opcional ausente no bloquea DnD');
 assert.equal(update({},'legacy'),'legacy');
 assert.throws(()=>update({},'invalido'),/EDITOR_RULESET_INVALID/);
});

test('un catálogo opcional defectuoso no impide cargar el cartucho validado',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const match=html.match(/\n  load\(raw,onChange\)\{([\s\S]*?)\n  \},\n  read\(\)/);
 assert.ok(match,'se localiza la carga real de LumenEditor');
 const workspace={schema:'forest-horror-map-v1',units:{feetPerCell:5},
  floors:[{id:'a',name:'Planta',elevationFt:0,items:[]}]};
 let rendered=0,initialized=0;
 const env={
  validate:()=>{},ensureLumenEditorInitialized:()=>{initialized++;},
  clearTimeout:()=>{},saveTimer:null,lumenEditorNotify:null,
  clone:x=>structuredClone(x),newProject:()=>({units:{feetPerCell:5},floors:[]}),
  floorDefault:()=>({items:[]}),project:{},floorIndex:0,selection:null,
  history:[],historyIndex:0,floorRefArchive:{clear(){}},
  rememberFloorRefs(){},closeInspector(){},closeModal(){},
  loadedImgs:[],spaceCache:[],refreshFloorTabs(){},setupImage(){},
  render(){rendered++;},setTimeout:()=>1,fitMap(){},lumenEditorChanged:true,
  dirty:true,lumenEditorRuleset:'dnd',
  window:{FHEditorCatalog:{setRuleset(){throw Error('CATALOG_TEST_FAILURE');}}},
  console:{warn(){}}
 };
 const load=new Function('env','raw','onChange','with(env){'+match[1]+'}');
 assert.doesNotThrow(()=>load(env,workspace,()=>{}));
 assert.equal(initialized,1);
 assert.equal(rendered,1);
 assert.equal(env.project.floors[0].id,'a');
 assert.equal(env.dirty,false);
});
