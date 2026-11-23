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
    const legacyKey = doc.includes('const SAVE_KEY=fhRoofSaveKey;')
      ? 'fhRoofSaveKey' : 'ForestShared.gameSaveKey(DATA)';
    const storage = 'let localSave=null;try{localSave=window.localStorage}catch{}';
    once('const SAVE_KEY='+legacyKey+';\n'+storage,
      `${storage}
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
const SAVE_KEY=fhMultimode?fhMultimode.key:${legacyKey};`);
    const saved = 'const fhSavedState=readGameSave(localSave,SAVE_KEY,DATA.__runtimeSave);';
    const backup = 'const fhBackupState=readGameSave(null,SAVE_KEY,DATA.__runtimeSave);';
    const legacyRestored='const restored=DATA.__runtimeCharacter?.id?(fhSavedState?.characterId===DATA.__runtimeCharacter.id?fhSavedState:fhBackupState?.characterId===DATA.__runtimeCharacter.id?fhBackupState:null):fhSavedState;';
    once([saved,backup,legacyRestored].join('\n'),
      `const restored=fhMultimode?fhMultimode.restore(DATA,DATA.__multimodeSave.backupRaw):(()=>{
${saved}
${backup}
${legacyRestored}
return restored;
})();`);
    once('const fhIncomingCharacter=DATA.__runtimeCharacter;',
      'const fhIncomingCharacter=fhMultimode?null:DATA.__runtimeCharacter;');
    once('const result=writeGameSave(localSave,SAVE_KEY,GameState);',
      'if(fhMultimode){fhMultimode.write(GameState,DATA);return;}const result=writeGameSave(localSave,SAVE_KEY,GameState);');
    once("if(window.parent!==window)window.parent.postMessage({type:'FOREST_CHARACTER_DEATH',characterId:GameState.characterId},'*');",
      "if(fhMultimode){fhMultimode.write(GameState,DATA);if(window.parent!==window)window.parent.postMessage({type:'FOREST_MULTIMODE_DEATH',sessionId:fhMultimode.sessionId},'*');}\n  else if(window.parent!==window)window.parent.postMessage({type:'FOREST_CHARACTER_DEATH',characterId:GameState.characterId},'*');");
    const scripts = ['core/fh-multimode-save-identity.js', 'core/fh-multimode-persistence.js',
       'core/fh-combat-target-port.js',
      'rules/dnd/fh-dnd-sheet.js','rules/dnd/fh-dnd-combat.js','rules/dnd/fh-dnd-save-adapter.js',
      'assets/fh-dnd-character-strings.js',
      'rules/dnd/fh-dnd-strings.js','rules/dnd/fh-dnd-engine.js']
      .map(file => '<script src="' + new URL('./juego/' + file + '?v=20261117-persist32', baseURL).href + '"></' + 'script>').join('');
    const adapters = '<script>window.FHMultimodeCombatAdapters=Object.freeze({dnd:window.FHDndCombat});\n' +
      'window.FHMultimodeSaveAdapters=Object.freeze({dnd:window.FHDndSaveAdapter});</' + 'script>';
    if(doc.includes('GameState.horror=structuredClone(restored?.horror||DATA.initialGameState?.horror||{});')){
      once('GameState.horror=structuredClone(restored?.horror||DATA.initialGameState?.horror||{});',
       "if(DATA.__multimodeSave?.identity.rulesetId!=='dnd')GameState.horror=structuredClone(restored?.horror||DATA.initialGameState?.horror||{});");
    }
    if(doc.includes('const fhLegacySession=window.FHLegacyEngineSession.create({')){
       // No crear ni activar la IA de Sombras al iniciar una sesión DnD.
       once('const fhHorror=window.FHShadowAI?.createRuntime({',
        "const fhHorror=DATA.__multimodeSave?.identity.rulesetId==='dnd'?null:window.FHShadowAI?.createRuntime({");
      once('const fhLegacySession=window.FHLegacyEngineSession.create({',
        "const fhWorldClearTrainingLine=(a,b)=>{\n"+
         " if(a.floor!==b.floor)return false;\n"+
         " const distance=Math.hypot(b.x-a.x,b.z-a.z);\n"+
         " const steps=Math.max(1,Math.ceil(distance/.05));\n"+
         " for(let i=0;i<=steps;i++){const t=i/steps;\n"+
         "  if(!fhNpcCanWalk(a.floor,a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,false))return false;\n"+
         " }return true;\n"+
         "};\n"+
         "const fhDndTargetPort=window.FHCombatTargetPort.create({\n"+
         " readRuntime:()=>window.FHTrainingDummyRuntime,\n"+
         " maxDistanceMeters:CELL,\n"+
         " canContact:fhWorldClearTrainingLine,canSee:fhWorldClearTrainingLine\n"+
         "});\n"+
         "const fhLegacySession=DATA.__multimodeSave?.identity.rulesetId==='dnd'?\n"+
        "window.FHDndEngine.create({\n"+
        " targetPort:fhDndTargetPort,gameState:GameState,\n"+
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
    const headEnd = doc.indexOf('</head>');
    if (headEnd < 0) throw Error('SAVE_ENGINE_HEAD_MISSING');
    return doc.slice(0, headEnd) + scripts + adapters + doc.slice(headEnd);
  }
  return Object.freeze({ patch });
});
