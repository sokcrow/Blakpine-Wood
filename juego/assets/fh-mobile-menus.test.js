'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const assets = __dirname;
const css = fs.readFileSync(path.join(assets, 'fh-mobile-menus.css'), 'utf8');
const page = fs.readFileSync(path.resolve(assets, '../../index.html'), 'utf8');
const terminal = fs.readFileSync(path.join(assets, 'fh-terminal.html'), 'utf8');

test('el CSS móvil reduce a la mitad los menús del motor, no el editor', () => {
  assert.match(css, /pointer:\s*coarse/);
  assert.match(css, /scale\(\.5\)/);
  assert.match(css, /#fhLiveDialog \\.fh-panel\\s*\\{\\s*transform:\\s*translateX\\(-50%\\) scale\\(\\.5\\)/);
  for (const id of [
    '#fhPlayerMenu', '#importCard', '#inventoryPanel.open', '#fhcc-root',
    '#fhLiveDialog', '#fhDeliveryDialog', '#noteCard', '#fhContextRadial',
    '#elevatorPanel', '#fhBreakerFrame', '#fhDecorStoredPanel'
  ]) assert.ok(css.includes(id), 'Falta el menú: ' + id);
  for (const editor of ['#palette', '#inspector', '#stage', '#tools', '#headActions']) {
    assert.ok(!css.includes(editor), 'No debe estilizar el editor: ' + editor);
  }
});

test('la hoja móvil se carga tanto para la creación como dentro del juego', () => {
  assert.match(page, /href="\.\/juego\/assets\/fh-mobile-menus\.css\?v=/);
  assert.match(page, /const mobileMenusCss=/);
  assert.match(page, /\+hudFrameScript\+mobileMenusCss\+'<\/head>'/);
});

test('la computadora conserva su pantalla y escala ventanas/menú RAVEN', () => {
  assert.match(terminal, /#startMenu\.start-menu\s*\{\s*transform:\s*scale\(\.5\)/);
  assert.match(terminal, /#windowsLayer \.window\.maximized/);
  assert.match(terminal, /transform-origin:\s*top left/);
});
