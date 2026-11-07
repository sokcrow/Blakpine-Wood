/* Ejecutar: node juego/assets/fh-game-ui.test.js */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'fh-game-ui.css'),'utf8');
const rules=css.replace(/\/\*[\s\S]*?\*\//g,'');

test('la misma hoja se carga en el creador (página) y en el juego 3D',()=>{
 assert.match(html,/<link rel="stylesheet" href="\.\/juego\/assets\/fh-game-ui\.css\?v=/);
 assert.match(html,/const gameUiCss='<link rel="stylesheet"/);
 assert.match(html,/locationScript\+hudRedesignCss\+gameUiCss\+hudFrameScript\+mobileMenusCss\+statusCss\+statusStrings\+statusScript\+mobileCameraScript\+'<\/head>'/);
});

test('identidad visual común: fuentes existentes y variables de color',()=>{
 assert.match(css,/Cinzel/);
 assert.match(css,/Spectral/);
 assert.match(css,/--fh-ui-paper:/);
 assert.match(css,/--fh-ui-stroke:/);
 assert.match(css,/--fh-ui-title:/);
 assert.match(css,/--fh-ui-reading:/);
});

test('cubre los menús del juego y el creador, sin capturar selectores globales',()=>{
 for(const selector of [
  '#importCard','#inventoryPanel','#inventorySelected',
  '#fhLiveDialog .fh-panel','#fhDeliveryDialog #fhDeliveryCard',
  '#fhcc-root .fhcc-card','#actions .action'
 ])assert.ok(rules.includes(selector),'Falta '+selector);
 assert.doesNotMatch(rules,/(?:^|\})\s*(?:button|section|div|body)\s*\{/m);
});

test('Raven/OS y dispositivos físicos conservan su estilo propio',()=>{
 assert.doesNotMatch(rules,/#(?:fhTerminal|fhComputer|fhOS|RavenOS|raven-os|elevatorPanel|fhBreakerOverlay|noteCard|noteOverlay)\b/i);
 assert.doesNotMatch(rules,/\.dialog\s*\{/);
});

test('contrarresta las reglas !important del motor sin alterar lógica ni visibilidad',()=>{
 assert.match(rules,/body\.fh-player-menu-ready #actions \.action[\s\S]*?font-family:[^;]+!important/);
 assert.match(rules,/body\.fh-player-menu-ready #inventoryPanel button/);
 assert.match(rules,/body\.fh-player-menu-ready #inventoryPanel \.inventorySlot[\s\S]*?background:[^;]+!important/);
 assert.doesNotMatch(rules,/display:\s*(?:block|flex|grid|none)\s*!important/);
});

test('teclado, móvil y movimiento reducido mantienen tratamientos explícitos',()=>{
 assert.match(rules,/:focus-visible/);
 assert.match(rules,/@media\(max-width:650px\)/);
 assert.match(rules, /@media\(prefers-reduced-motion:reduce\)/);
});

test('características de selección del creador siguen diferenciadas',()=>{
 assert.match(rules,/#fhcc-root \.fhcc-choice\[aria-pressed=true\]/);
 assert.match(rules,/#fhcc-root \.fhcc-error/);
 assert.match(rules,/#fhcc-root \.fhcc-field input/);
});
