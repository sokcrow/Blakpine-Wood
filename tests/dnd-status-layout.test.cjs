'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('el motor real carga el CSS de ficha sin reactivar el HUD Legacy retirado',()=>{
 const {html}=require('./helpers/forest-engine.cjs')();
 const result=require('../juego/core/fh-multimode-save-hook.js').patch(html,'https://example.test/');
 const head=result.slice(0,result.indexOf('</head>'));
 assert.match(head,/<link rel="stylesheet" href="https:\/\/example.test\/juego\/rules\/dnd\/fh-dnd-sheet.css\?v=20261126-dnd-sheet-polish">/);
 assert.doesNotMatch(head,/fh-status-hud.css/);
 const index=fs.readFileSync('index.html','utf8');
 assert.match(index,/fh-multimode-save-hook.js\?v=20261126-dnd-sheet-polish/);
 for(const script of result.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(script[1].trim())new vm.Script(script[1]);
});
test('la prueba visual usa el menú y el motor de ficha reales sin escribir partidas',()=>{
 const html=fs.readFileSync('tests/fixtures/dnd-status-preview.html','utf8');
 assert.match(html,/fh-player-menu.js/);assert.match(html,/FHDndEngine.create/);
 assert.match(html,/FHPlayerMenu.openSection\('status'\)/);
 assert.doesNotMatch(html,/localStorage|writeGameSave|new THREE/);
});
