'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../juego/assets/fh-medieval-lighting.js'),catalog=require('../juego/assets/fh-medieval-catalog.js');
const textContext={};vm.runInNewContext(fs.readFileSync('juego/assets/fh-medieval-light-strings.js','utf8'),textContext);
const T=textContext.FH_MEDIEVAL_LIGHT_TEXT;
function fixture(kind='oil_lantern',remaining=0){
 const item={id:'source',type:'light_fixture',lightKind:kind,lightOn:false,lightFuelMinutes:remaining,x:2,y:2};
 const state={inventory:[],used:{},clock:{year:2026,month:11,day:24,minutes:100}};
 const runtime=M.createRuntime({floors:[{items:[item]}],state});return {item,state,runtime};
}
test('cada suministro usa el contrato v1 de recogida única y tiene una definición legible',()=>{
 const html=fs.readFileSync('index.html','utf8'),start=html.indexOf('const ForestShared=(()=>{'),end=html.indexOf("\n'use strict';",start);
 const env={window:{},console};vm.createContext(env);vm.runInContext(html.slice(start,end),env);
 const engineContext={window:{}};vm.createContext(engineContext);
 for(let i=0;i<13;i++)vm.runInContext(fs.readFileSync('juego/assets/engine-'+String(i).padStart(2,'0')+'.js','utf8'),engineContext);
 const engine=Buffer.from(engineContext.window.__FOREST_EMBEDDED_ENGINE__,'base64').toString('utf8');
 env.grantItem=vm.runInContext('ForestShared.grantItem',env);env.inventorySlots=vm.runInContext('ForestShared.inventorySlots',env);
 env.structuredClone=structuredClone;
 vm.runInContext(engine.slice(engine.indexOf('function createGameState('),engine.indexOf('/** Guardado de progresión')),env);
 const createStart=html.indexOf('function createObject(type,p){'),createEnd=html.indexOf('\nfunction sanitizeId',createStart);
 Object.assign(env,{project:{units:{feetPerCell:5},itemDefs:[]},window:{FHMedievalLighting:M,FH_MEDIEVAL_LIGHT_TEXT:T},
  numId:()=> 'supply',current:()=>({items:[]}),OBJECT_SIZES:{misc:[.75,.75]},ForestShared:vm.runInContext('ForestShared',env)});
 // Preserve the real creator; unrelated editor prerequisites are inert for a misc pickup.
 env.toast=()=>{};vm.runInContext(html.slice(createStart,createEnd),env);
 for(const [tool,id]of Object.entries(M.fuelTools)){
  assert.equal(catalog.toolAllowed('lighting',tool,'dnd'),true);
  assert.equal(catalog.toolAllowed('lighting',tool,'legacy'),false);
  const item=env.createObject(tool,{x:1,y:1});
  assert.equal(item.type,'misc');assert.equal(item.medievalFuel,id);
  assert.equal(item.interact.once,true);assert.equal(item.interact.verb,'take');
  assert.equal(item.interact.effects[0].id,id);assert.equal(item.blocksMovement,false);
  assert.equal(env.project.itemDefs.find(d=>d.id===id).name,T.fuels[id]);
  assert.equal(env.ForestShared.validateInteraction(item.interact).length,0);
  const state=env.createGameState(),bus=env.createEventBus();
  assert.equal(env.performInteraction(item,state,bus,0,env.project.itemDefs).ok,true);
  assert.deepEqual(Array.from(state.inventory),[id]);
  assert.equal(env.performInteraction(item,state,bus,1,env.project.itemDefs).reason,'once');
  const restored=env.createGameState(JSON.parse(JSON.stringify(state)));
  assert.equal(env.performInteraction(item,restored,bus,2,env.project.itemDefs).reason,'once');

 }
});
test('recargar consume una unidad compatible, conserva apagado y no desperdicia una carga completa',()=>{
 const {runtime,item,state}=fixture();state.inventory=['lena','aceite_lampara','aceite_lampara'];
 assert.deepEqual(runtime.act(0,item,'on'),{ok:false,reason:'empty'});
 assert.equal(runtime.act(1,item,'refuel').ok,false);
 assert.equal(runtime.act(0,item,'refuel').action,'refueled');
 assert.deepEqual(state.inventory,['lena','aceite_lampara']);assert.equal(runtime.lit(0,item),false);
 assert.equal(runtime.view(item.id).remaining,240);
 assert.deepEqual(runtime.act(0,item,'refuel'),{ok:false,reason:'full'});
 assert.deepEqual(state.inventory,['lena','aceite_lampara']);
 assert.equal(runtime.act(0,item,'on').action,'on');assert.equal(runtime.lit(0,item),true);
 assert.equal(runtime.act(0,item,'off').action,'off');assert.equal(runtime.lit(0,item),false);
 const saved=JSON.parse(JSON.stringify(state));
 const reopened=M.createRuntime({floors:[{items:[item]}],state:saved});
 assert.equal(reopened.lit(0,item),false);assert.equal(reopened.view(item.id).remaining,240);
});
test('combustible incorrecto no se consume; encendida consume tiempo sólo hasta apagar',()=>{
 const {runtime,item,state}=fixture('torch_wall',10);state.inventory=['lena'];
 assert.deepEqual(runtime.act(0,item,'refuel'),{ok:false,reason:'noFuelItem'});
 assert.deepEqual(state.inventory,['lena']);runtime.act(0,item,'on');
 state.clock.minutes+=3;runtime.act(0,item,'off');
 assert.equal(runtime.view(item.id).remaining,7);state.clock.minutes+=20;runtime.tick();
 assert.equal(runtime.view(item.id).remaining,7);
});
test('recoger la antorcha apagada no la enciende; el cristal no consume combustible',()=>{
 const {runtime,item}=fixture('torch_hand',10);
 assert.equal(runtime.act(0,item,'carry').action,'carried');assert.equal(runtime.isCarried(item.id),true);
 assert.equal(runtime.lit(0,item),false);assert.equal(runtime.act(0,item,'on').ok,true);
 const magic=fixture('magic_crystal');
 assert.equal(magic.runtime.act(0,magic.item,'refuel').reason,'permanent');
 assert.equal(magic.runtime.act(0,magic.item,'on').ok,true);assert.equal(magic.runtime.view(magic.item.id).remaining,null);
});
