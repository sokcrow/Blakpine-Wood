'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const hook = require('../juego/core/fh-multimode-save-hook.js');
const saves = require('../juego/core/fh-multimode-persistence.js');
const root = path.resolve(__dirname, '..');

test('el hook se instala en el documento REAL del motor ensamblado, no en un módulo aislado', () => {
  const { html } = require('./helpers/forest-engine.cjs')();
  const patched = hook.patch(html, 'https://example.test/');
  assert.ok(patched.includes('const fhMultimode=DATA.__multimodeSave?'));
  assert.ok(patched.includes('const fhSavedState=fhMultimode?null:readGameSave('));
  assert.ok(patched.includes('const fhBackupState=fhMultimode?null:readGameSave('));
  assert.ok(patched.includes('const restored=fhMultimode?fhMultimode.restore('));
  assert.ok(patched.includes('const fhIncomingCharacter=fhMultimode?null:'));
  assert.ok(patched.includes('if(fhMultimode){fhMultimode.write(GameState,DATA);return;}'));
  assert.ok(patched.includes("type:'FOREST_MULTIMODE_DEATH'"));
  assert.ok(patched.includes('juego/core/fh-multimode-persistence.js'));
  assert.equal(patched.split('const fhMultimode=DATA.__multimodeSave?').length, 2);
  assert.throws(() => hook.patch(patched, 'https://example.test/'), /SAVE_ENGINE_HOOK_MISMATCH/);
});

test('el padre separa envío, confirmación, muerte y sincronización Legacy', () => {
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(index.includes('previewSaveSession=prepare3DSaveSession(profile)'));
  assert.ok(index.includes("combat?.contract!=='blakpine-combat-adapter-v1'"));
  assert.ok(index.includes('FHMultimodeSaveHook.patch(architectureDoc,document.baseURI)'));
  assert.ok(index.includes('FHMultimodeSaveHook.patch(fhEngineDoc,document.baseURI)'));
  assert.ok(index.includes('__runtimeSave:previewSaveSession?null:fhMapSave'));
  assert.ok(index.includes('backupRaw:previewSaveSession.readRaw()'));
  assert.ok(index.includes("e.data.type==='FOREST_MULTIMODE_SAVE'"));
  assert.ok(index.includes("e.data.type==='FOREST_MULTIMODE_DEATH'"));
  assert.ok(index.includes("e.data.type==='FOREST_GAMESTATE_SAVE'){\n   if(previewSaveSession)return;"));
  assert.ok(index.includes("e.data.type==='FOREST_CHARACTER_DEATH'){\n   if(previewSaveSession)return;"));
  assert.ok(index.includes('previewSaveSession?.close();previewSaveSession=null;'));
});

const fixtureDoc = `<!doctype html><html><head></head><body><script>
const DATA=window.DATA;
const SAVE_KEY=ForestShared.gameSaveKey(DATA);
let localSave=null;try{localSave=window.localStorage}catch{}
const fhSavedState=readGameSave(localSave,SAVE_KEY,DATA.__runtimeSave);
const fhBackupState=readGameSave(null,SAVE_KEY,DATA.__runtimeSave);
const restored=DATA.__runtimeCharacter?.id?(fhSavedState?.characterId===DATA.__runtimeCharacter.id?fhSavedState:fhBackupState?.characterId===DATA.__runtimeCharacter.id?fhBackupState:null):fhSavedState;
const GameState=createGameState(restored||DATA.initialGameState);
const fhIncomingCharacter=DATA.__runtimeCharacter;
const saveProgress=()=>{const result=writeGameSave(localSave,SAVE_KEY,GameState);
 if(window.parent!==window)window.parent.postMessage({type:'FOREST_GAMESTATE_SAVE',key:SAVE_KEY,json:result.json},'*');};
function die(){
 if(window.parent!==window)window.parent.postMessage({type:'FOREST_CHARACTER_DEATH',characterId:GameState.characterId},'*');
}
window.runtime={saveProgress,die,GameState,SAVE_KEY,restored,fhIncomingCharacter};
</script></body></html>`;
const makeStore = () => { const values = new Map(); return {
  values, getItem(key) { return values.get(key)||null; },
  setItem(key, value) { values.set(key,value); }
}; };
function boot(data, adapter) {
  const store=makeStore(),messages=[];
  const window={ DATA:data,localStorage:store,parent:{postMessage:m=>messages.push(m)},
    FHMultimodePersistence:saves,FHMultimodeSaveAdapters:adapter?{dnd:adapter}:{},
    FHMultimodeCombatAdapters:adapter?{dnd:{status:'implemented',contract:'blakpine-combat-adapter-v1',rulesetId:'dnd',evaluate(){}}}:{} };
  const context=vm.createContext({window,ForestShared:{gameSaveKey:()=> 'fh_game_v1_aabb'},
    readGameSave:(store,key,backup)=>{const raw=store?.getItem?.(key)||backup;return raw?JSON.parse(raw).state:null;},
    writeGameSave:(store,key,state)=>{const json=JSON.stringify({version:1,state});store?.setItem(key,json);return {json};},
    createGameState:state=>({...state}),structuredClone});
  const document=hook.patch(fixtureDoc,'https://example.test/');
  const script=document.slice(document.indexOf('<script>')+8,document.lastIndexOf('</script>'));
  vm.runInContext(script,context);
  return {window,store,messages};
}
test('simulación de iframe: guardar/cargar Legacy conserva formato y clave antigua', () => {
  const game=boot({initialGameState:{characterId:'hero',progress:1},__runtimeCharacter:{id:'hero'}},null);
  assert.equal(game.window.runtime.SAVE_KEY,'fh_game_v1_aabb');
  game.window.runtime.GameState.progress=7;
  game.window.runtime.saveProgress();
  assert.equal(game.store.values.size,1);
  assert.equal(JSON.parse(game.store.getItem('fh_game_v1_aabb')).version,1);
  assert.equal(game.messages[0].type,'FOREST_GAMESTATE_SAVE');
});

test('simulación de iframe: multimodo restaura, guarda y notifica muerte sin tocar Legacy', () => {
  const id={mapId:'map-1',characterId:'hero',rulesetId:'dnd',rulesetVersion:1,saveId:'slot-1'};
  const adapter={status:'implemented',contract:'blakpine-save-adapter-v1',rulesetId:'dnd',
    validateWorldState:w=>Number.isInteger(w.progress),
    validateRulesetState:r=>Number.isInteger(r.d20),
    initial:()=>({progress:0,resource:0,characterId:'hero'}),
    restore:(w,r)=>({progress:w.progress,resource:r.d20,characterId:'hero'}),
    capture:s=>({world:{progress:s.progress},rules:{rulesetId:'dnd',rulesetVersion:1,data:{d20:s.resource}}})};
  const game=boot({__multimodeSave:{identity:id,sessionId:'session-1',backupRaw:null},
    __runtimeSave:'MUST_NOT_READ_LEGACY',__runtimeCharacter:{id:'LEGACY'},initialGameState:{}},adapter);
  assert.equal(game.window.runtime.fhIncomingCharacter,null);
  assert.equal(game.window.runtime.GameState.progress,0);
  game.window.runtime.GameState.progress=2;game.window.runtime.GameState.resource=19;
  game.window.runtime.saveProgress();
  const packet=game.messages[0];
  assert.equal(packet.type,'FOREST_MULTIMODE_SAVE');
  assert.ok(packet.key.startsWith('blakpine_multimode_save_v1:'));
  assert.equal(game.store.values.has('fh_game_v1_aabb'),false);
  const parent=saves.create({role:'parent',identity:id,sessionId:'session-1',adapter,storage:makeStore()});
  assert.equal(parent.accept(packet),true);
  game.window.runtime.die();
  assert.equal(game.messages[1].type,'FOREST_MULTIMODE_SAVE');
  assert.equal(game.messages[2].type,'FOREST_MULTIMODE_DEATH');
  assert.equal(game.messages.some(m=>m.type==='FOREST_CHARACTER_DEATH'),false);
});
