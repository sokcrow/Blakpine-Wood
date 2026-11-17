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
    const scripts = ['core/fh-multimode-save-identity.js', 'core/fh-multimode-persistence.js']
      .map(file => '<script src="' + new URL('./juego/' + file + '?v=20261117-persist32', baseURL).href + '"></' + 'script>').join('');
    once('</head>', scripts + '</head>');
    return doc;
  }
  return Object.freeze({ patch });
});
