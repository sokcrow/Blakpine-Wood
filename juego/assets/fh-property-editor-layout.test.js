'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const editor=fs.readFileSync(path.join(__dirname,'fh-property-editor.js'),'utf8');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
test('el orden previo de las herramientas de Zonas permanece intacto',()=>{
 const match=editor.match(/TOOL_GROUPS\.property=\[([^\n]+)\];/);
 assert.ok(match,'La barra de Zonas debe declararse como una lista de botones.');
 const ids=[...match[1].matchAll(/\['([^']+)'/g)].map(m=>m[1]);
 assert.deepEqual(ids,['property_zone','location_exterior','location_common','property_select',
  'property_erase','pan','prefab_zone']);
});
test('no insertar formularios en la barra horizontal del HUD del editor',()=>{
 assert.doesNotMatch(editor,/tools\.prepend\(panel\)/);
 assert.doesNotMatch(editor,/id=['"]fhPrefabSettings/);
 assert.doesNotMatch(editor,/function showPrefabSettings\(/);
 const choice=editor.slice(editor.indexOf('function openPrefabSettings()'),
  editor.indexOf('function add(a,b,tool){'));
 assert.match(choice,/modal\(/);
 assert.doesNotMatch(choice,/tools\.append|tools\.prepend|panel\.append|panel\.prepend/);
});
test('el usuario confirma el preset antes de poder dibujar su contorno',()=>{
 assert.match(editor,/if\(tool==='prefab_zone'\)\{prefabReady=false;openPrefabSettings\(\)/);
 assert.match(editor,/prefabReady=true;start=null;live=null;prefabPreview=null/);
 assert.match(editor,/if\(activeTool==='prefab_zone'&&!prefabReady\)/);
 assert.match(editor,/if\(!prefabReady\)\{openPrefabSettings\(\);return;\}/);
 assert.match(editor,/prefabPreview\|\|/);
 assert.match(editor,/PF\(\)\.limitFootprint/);
});
test('el editor conserva el contenedor de herramientas horizontal',()=>{
 assert.match(html,/#tools\{display:flex;gap:6px;overflow-x:auto;/);
 assert.match(html,/#tools button\{height:66px;/);
 assert.match(html,/id="tools"/);
});
