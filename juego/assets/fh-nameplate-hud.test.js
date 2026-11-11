'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const HUD=require('./fh-nameplate-hud.js');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');

test('PG PS PE se leen de las claves reales con límite',()=>{
 assert.deepEqual(HUD.reading({pg:15,pgMax:30},'pg'),{current:15,maximum:30,percent:50});
 assert.deepEqual(HUD.reading({sp:25,spMax:20},'sp'),{current:20,maximum:20,percent:100});
 assert.deepEqual(HUD.reading({pe:-2,peMax:12},'pe'),{current:0,maximum:12,percent:0});
 assert.equal(HUD.reading({pg:1},'pg'),null);
 assert.equal(HUD.reading({pg:NaN,pgMax:1},'pg'),null);
 assert.equal(HUD.reading({pg:2,pgMax:0},'pg'),null);
});
test('Mood proviene de mental.mood sin inventar estados',()=>{
 assert.equal(HUD.moodIcon('bueno'),'☺');
 assert.equal(HUD.moodIcon('neutral'),'−');
 assert.equal(HUD.moodIcon('malo'),'☹');
 assert.equal(HUD.moodIcon(undefined),'◇');
 assert.equal(HUD.moodIcon('inexistente'),'◇');
});
test('forma diagonal, barras reales y refresco independiente',()=>{
 const js=read('fh-nameplate-hud.js'),css=read('fh-nameplate-hud.css');
 assert.match(js,/root\.FHCharacterRuntime\?\.character/);
 assert.match(js,/requestAnimationFrame\(tick\)/);
 assert.match(js,/frameId = root\.requestAnimationFrame\(tick\)/);
 assert.match(js,/character\.mental\?\.mood/);
 assert.match(js,/character\.resources/);
 assert.match(js,/fh-np-health-fill/);
 assert.match(css,/\.fh-np-main-frame\s*\{[\s\S]*?clip-path:polygon/);
 assert.match(css,/\.fh-np-mood-frame\s*\{[\s\S]*?clip-path:polygon/);
 assert.match(css,/\.fh-np-meter\s*\{[\s\S]*?clip-path:polygon/);
 assert.match(css,/transition:width \.25s ease-out/);
 assert.match(css,/\#fhNameplateHUD \.fh-np-lower \{[\s\S]*?width:calc\(100% - 64px\)/);
 assert.doesNotMatch(js,/localStorage|GameState\s*=/);
});
