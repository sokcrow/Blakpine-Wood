/* Instalación verificable en el documento que ejecuta el motor (no en un espejo). */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FHMultimodeSaveHook = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function patch(documentHtml, baseURL) {
    if (typeof documentHtml !== 'string') throw Error('SAVE_ENGINE_DOCUMENT_MISSING');
    let doc = documentHtml;
    function once(before, after) {
      const count = doc.split(before).length - 1;
      if (count !== 1) throw Error('SAVE_ENGINE_HOOK_MISMATCH:' + count + ':' + before.slice(0, 52));
      doc = doc.replace(before, after);
    }
    once('const SAVE_KEY=ForestShared.gameSaveKey(DATA);\nlet localSave=null;try{localSave=window.localStorage}catch{}',
      `let localSave=null;try{localSave=window.localStorage}catch{}
const fhCombatAdapter=DATA.__multimodeSave?
 window.FHMultimodeCombatAdapters?.[DATA.__multimodeSave.identity.rulesetId]:null;
if(DATA.__multimodeSave&&(fhCombatAdapter?.status!=='implemented'||
 fhCombatAdapter?.contract!=='blakpine-combat-adapter-v1'||
 fhCombatAdapter?.rulesetId!==DATA.__multimodeSave.identity.rulesetId||
 typeof fhCombatAdapter?.evaluate!=='function'))throw Error('SAVE_COMBAT_ADAPTER_UNAVAILABLE');
const fhMultimode=DATA.__multimodeSave?window.FHMultimodePersistence.create({
 role:'frame',identity:DATA.__multimodeSave.identity,
 sessionId:DATA.__multimodeSave.sessionId,
 adapter:window.FHMultimodeSaveAdapters?.[DATA.__multimodeSave.identity.rulesetId],
 storage:localSave,
 send:message=>{if(window.parent!==window)window.parent.postMessage(message,'*')}
}):null;
const SAVE_KEY=fhMultimode?fhMultimode.key:ForestShared.gameSaveKey(DATA);`);
    once('const fhSavedState=readGameSave(localSave,SAVE_KEY,DATA.__runtimeSave);',
      'const fhSavedState=fhMultimode?null:readGameSave(localSave,SAVE_KEY,DATA.__runtimeSave);');
    once('const fhBackupState=readGameSave(null,SAVE_KEY,DATA.__runtimeSave);',
      'const fhBackupState=fhMultimode?null:readGameSave(null,SAVE_KEY,DATA.__runtimeSave);');
    const legacyRestored='const restored=DATA.__runtimeCharacter?.id?(fhSavedState?.characterId===DATA.__runtimeCharacter.id?fhSavedState:fhBackupState?.characterId===DATA.__runtimeCharacter.id?fhBackupState:null):fhSavedState;';
    once(legacyRestored,
      'const restored=fhMultimode?fhMultimode.restore(DATA,DATA.__multimodeSave.backupRaw):'+legacyRestored.slice('const restored='.length));
    once('const fhIncomingCharacter=DATA.__runtimeCharacter;',
      'const fhIncomingCharacter=fhMultimode?null:DATA.__runtimeCharacter;');
    once('const saveProgress=()=>{const result=writeGameSave(localSave,SAVE_KEY,GameState);',
      'const saveProgress=()=>{if(fhMultimode){fhMultimode.write(GameState,DATA);return;}const result=writeGameSave(localSave,SAVE_KEY,GameState);');
    once("if(window.parent!==window)window.parent.postMessage({type:'FOREST_CHARACTER_DEATH',characterId:GameState.characterId},'*');",
      "if(fhMultimode){fhMultimode.write(GameState,DATA);if(window.parent!==window)window.parent.postMessage({type:'FOREST_MULTIMODE_DEATH',sessionId:fhMultimode.sessionId},'*');}\n  else if(window.parent!==window)window.parent.postMessage({type:'FOREST_CHARACTER_DEATH',characterId:GameState.characterId},'*');");
    const scripts = ['core/fh-multimode-save-identity.js', 'core/fh-multimode-persistence.js',
      'rules/dnd/fh-dnd-combat.js','rules/dnd/fh-dnd-save-adapter.js',
      'rules/dnd/fh-dnd-strings.js','rules/dnd/fh-dnd-engine.js']
      .map(file => '<script src="' + new URL('./juego/' + file + '?v=20261117-persist32', baseURL).href + '"></' + 'script>').join('');
    if(doc.includes('const fhLegacySession=window.FHLegacyEngineSession.create({')){
      once('const fhLegacySession=window.FHLegacyEngineSession.create({',
        "const fhLegacySession=DATA.__multimodeSave?.identity.rulesetId==='dnd'?\n"+
        "window.FHDndEngine.create({\n"+
        " shadowRuntime:fhHorror,gameState:GameState,\n"+
        " identity:DATA.__multimodeSave.identity,sessionId:DATA.__multimodeSave.sessionId,\n"+
        " readMinute:()=>window.FHWeatherCore?.absoluteMinute(GameState.clock)??GameState.clock?.minutes,\n"+
        " readPlayer:()=>({floor:currentFloor,x:user.x,z:user.z,\n"+
        "  sleeping:window.FHSleep?.status()?.stage==='asleep',inElevator:!!occupiedShaft(),\n"+
        "  inactive:!!window.FHSleep?.status()?.unconscious}),\n"+
        " save:()=>saveProgress(),notice\n"+
        "}):window.FHLegacyEngineSession.create({");
      once('window.FHLegacyCombatSession=fhLegacySession;',
        "window.FHLegacyCombatSession=fhLegacySession;\n"+
        "if(DATA.__multimodeSave?.identity.rulesetId==='dnd')window.FHDndCombatSession=fhLegacySession;");
    }else if(doc.includes('const fhHorror=window.FHShadowAI?.createRuntime({')){
      throw Error('DND_ENGINE_COMBAT_HOOK_MISMATCH');
    }
    if(doc.includes('const GameState=createGameState(restored||DATA.initialGameState);')){
      once('const GameState=createGameState(restored||DATA.initialGameState);',
        "const GameState=createGameState(restored||DATA.initialGameState);\n"+
        "if(fhMultimode?.identity.rulesetId==='dnd')GameState.dnd=structuredClone(restored.dnd);");
    }
    once('</head>', scripts + '</head>');
    return doc;
  }
  return Object.freeze({ patch });
});
