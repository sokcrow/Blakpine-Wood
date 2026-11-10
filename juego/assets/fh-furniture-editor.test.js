const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const api=require('./fh-furniture-state.js');
const clone=value=>JSON.parse(JSON.stringify(value));
function setup(){
 const nodes=new Map(),storage=new Map();
 function element(id){if(!nodes.has(id))nodes.set(id,{id,style:{},children:[],append(child){this.children.push(child);if(child.id)nodes.set(child.id,child);},prepend(child){this.append(child);},addEventListener(){},removeEventListener(){}});return nodes.get(id);}
 const initial={createdAt:'fixture',units:{feetPerCell:5},floors:[{id:'f1',items:[{id:'legacy',type:'chair',x:2,y:2,w:.5,h:.5}]}]};
 const payload={version:1,state:{characterId:'p1',inventory:['key'],decoration:{poses:{}},delivery:{orders:[{id:'o1',status:'unboxed',productId:'chair'}],furnishings:[{id:'delivered_o1',floor:0,orderId:'o1',productId:'chair',x:3,y:4,rotation:0}]}}};
 storage.set('save',JSON.stringify(payload));
 const env={console,URL,clone,project:clone(initial),history:[JSON.stringify(initial)],historyIndex:0,activeCategory:'structure',current:()=>env.project.floors[0],
  ForestShared:{gameSaveKey:()=> 'save'},readStorage:key=>storage.get(key),safeStorage:(key,value)=>{storage.set(key,value);return true;},
  document:{baseURI:'http://localhost/',getElementById:id=>nodes.get(id)||null,createElement:()=>({style:{}})},
  fetch:async()=>({ok:true,json:async()=>({furniture:[]})}),toast:()=>{},
  record:()=>{env.history=env.history.slice(0,env.historyIndex+1);env.history.push(JSON.stringify(env.project));env.historyIndex++;},
  restoreHistory:()=>{env.project=JSON.parse(env.history[env.historyIndex]);},
  setCategory:category=>{env.activeCategory=category;nodes.delete('fhFurnitureObjectsBtn');},
  chooseTool:()=>{},selection:null,canvas:{clientWidth:600,clientHeight:400},view:{scale:1},toPixel:p=>p,openInspector:()=>{},render:()=>{},SHORT:{},escapeAttr:String,
  modal:(html,callback)=>{element('fhFurnitureObjects');element('fhFurnitureClose');callback();},closeModal:()=>{},close3DPreview:()=>{},
  makeCurrent3DProject:()=>({...clone(env.project),__runtimeSave:storage.get('save')}),
  window:{FHFurnitureState:api,FH_FURNITURE_EDITOR_TEXT:{},FHCharacterCreation:{current:()=>({id:'p1'}),selectMapSave:(raw,id)=>JSON.parse(raw).state.characterId===id?raw:null}}
 };
 element('play3dBack');element('tools');
 vm.runInNewContext(fs.readFileSync(__dirname+'/fh-furniture-editor.js','utf8'),env);
 return {env,storage,nodes};
}
test('lista real del editor selecciona muebles de partida y sincroniza borrar/deshacer/rehacer en el sobre v1',async()=>{
 const {env,storage,nodes}=setup();env.setCategory('furniture');
 await nodes.get('fhFurnitureObjectsBtn').onclick();
 const imported=env.project.floors[0].items.find(item=>item.id==='delivered_o1');assert.ok(imported);
 const button=nodes.get('fhFurnitureObjects').children.find(button=>button.textContent.includes('delivered_o1'));
 button.onclick();assert.equal(env.selection,'delivered_o1');
 env.project.floors[0].items=env.project.floors[0].items.filter(item=>item!==imported);env.record();
 let saved=JSON.parse(storage.get('save'));assert.equal(saved.version,1);assert.equal(saved.state.delivery.furnishings.length,0);
 assert.deepEqual(saved.state.inventory,['key']);
 env.historyIndex--;env.restoreHistory();assert.equal(JSON.parse(storage.get('save')).state.delivery.furnishings.length,1);
 env.historyIndex++;env.restoreHistory();assert.equal(JSON.parse(storage.get('save')).state.delivery.furnishings.length,0);
 assert.equal(env.makeCurrent3DProject().floors[0].items.length,1);
});
test('deshacer la incorporación al editor no elimina muebles de la partida',async()=>{
 const {env,storage,nodes}=setup();env.setCategory('furniture');await nodes.get('fhFurnitureObjectsBtn').onclick();
 env.historyIndex--;env.restoreHistory();
 assert.equal(JSON.parse(storage.get('save')).state.delivery.furnishings.length,1);
 env.historyIndex++;env.restoreHistory();assert.equal(env.makeCurrent3DProject().floors[0].items.length,2);
});
test('el inicio 3D usa la última pose comprada y excluye muebles almacenados',async()=>{
 const {env,storage,nodes}=setup();env.setCategory('furniture');await nodes.get('fhFurnitureObjectsBtn').onclick();
 const payload=JSON.parse(storage.get('save'));payload.state.delivery.furnishings[0].x=10;storage.set('save',JSON.stringify(payload));
 assert.equal(env.makeCurrent3DProject().floors[0].items[1].x,10);
 payload.state.delivery.furnishings[0].stored=true;storage.set('save',JSON.stringify(payload));
 assert.equal(env.makeCurrent3DProject().floors[0].items.length,1);
});
