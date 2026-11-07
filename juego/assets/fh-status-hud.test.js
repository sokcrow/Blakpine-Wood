/* Ejecutar: node --test juego/assets/fh-status-hud.test.js */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const H=require('./fh-status-hud.js');
const directory=__dirname;
const editor=fs.readFileSync(path.resolve(directory,'../../index.html'),'utf8');
const css=fs.readFileSync(path.join(directory,'fh-status-hud.css'),'utf8');

test('PG/SP toman los valores reales y los limitan a su máximo',()=>{
 assert.deepEqual(H.reading({pg:18,pgMax:36},'pg'),{current:18,maximum:36,percent:50});
 assert.deepEqual(H.reading({sp:60,spMax:20},'sp'),{current:20,maximum:20,percent:100});
 assert.equal(H.reading({pg:10},'pg'),null);
 assert.equal(H.reading({pg:NaN,pgMax:36},'pg'),null);
 assert.equal(H.reading({pg:0,pgMax:0},'pg'),null);
});
test('Cada PE es un cuadrito; se admiten cambios del máximo',()=>{
 assert.deepEqual(H.segmentStates({pe:3,peMax:6}),[true,true,true,false,false,false]);
 assert.deepEqual(H.segmentStates({pe:2,peMax:2}),[true,true]);
 assert.deepEqual(H.segmentStates({pe:-3,peMax:3}),[false,false,false]);
 assert.deepEqual(H.segmentStates({pe:12,peMax:10}),Array(10).fill(true));
});
test('El motor pasa los recursos de FHCharacterRuntime durante el ciclo HUD',()=>{
 assert.match(editor,/FHStatusHUD\?\.update\(window\.FHCharacterRuntime\?\.character\?\.resources\)/);
 for(const file of ['fh-status-strings.js','fh-status-hud.js','fh-status-hud.css'])
  assert.ok(editor.includes('juego/assets/'+file),'Falta recurso: '+file);
});
test('El estilo respeta la escala 75%, las tres gamas y el sueño',()=>{
 assert.match(css,/width:min\(300px,calc\(75vw - 96px\)\)/);
 assert.match(css,/--fh-status-pg:#c94d4a/);
 assert.match(css,/--fh-status-sp:#34c8d8/);
 assert.match(css,/--fh-status-pe:#49ad67/);
 assert.match(css,/body\.fh-sleeping #fhStatusHUD/);
 assert.doesNotMatch(css,/clip-path|filter:blur|border-radius:\d+px/);
});
