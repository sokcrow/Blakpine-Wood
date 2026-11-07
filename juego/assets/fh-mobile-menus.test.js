'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const assets = __dirname;
const css = fs.readFileSync(path.join(assets, 'fh-mobile-menus.css'), 'utf8');
const page = fs.readFileSync(path.resolve(assets, '../../index.html'), 'utf8');
const terminal = fs.readFileSync(path.join(assets, 'fh-terminal.html'), 'utf8');

test('los menús móviles usan 75%; el radial permanece exactamente al 50%', () => {
  assert.match(css, /pointer:\s*coarse/);
  assert.match(css, /--fh-mobile-ui-scale:\s*\.75/);
  const radialStart = css.indexOf('/* El radial se dibuja');
  const radialEnd = css.indexOf('/* Equipamiento electrónico', radialStart);
  assert.ok(radialStart >= 0 && radialEnd > radialStart);
  const radial = css.slice(radialStart, radialEnd);
  assert.match(radial, /#fhContextRadial \.fh-radial-wheel\s*\{[^}]*scale\(\.5\)/);
  assert.match(radial, /#fhContextRadial \.fh-radial-target\s*\{[^}]*scale\(\.5\)/);
  assert.doesNotMatch(css.slice(0, radialStart) + css.slice(radialEnd), /scale\(\.5\)/);
  for (const id of [
    '#fhPlayerMenu', '#importCard', '#inventoryPanel.open', '#fhcc-root',
    '#fhLiveDialog', '#fhDeliveryDialog', '#noteCard', '#fhContextRadial',
    '#elevatorPanel', '#fhBreakerFrame', '#fhDecorStoredPanel', '#fhMenuToggle'
  ]) assert.ok(css.includes(id), 'Falta el menú: ' + id);
  assert.match(css, /#fhLiveDialog \.fh-panel\s*\{\s*transform:\s*translateX\(-50%\) scale\(var\(--fh-mobile-ui-scale\)\)/);
  for (const editor of ['#palette', '#inspector', '#stage', '#tools', '#headActions']) {
    assert.ok(!css.includes(editor), 'No debe estilizar el editor: ' + editor);
  }
});

test('la hoja móvil se carga tanto en creación como dentro del juego, con versión actualizada', () => {
  assert.match(page, /href="\.\/juego\/assets\/fh-mobile-menus\.css\?v=20261107-mobile-ui-75"/);
  assert.match(page, /const mobileMenusCss=/);
  assert.match(page, /\+hudFrameScript\+mobileMenusCss\+'<\/head>'/);
  assert.equal((page.match(/fh-mobile-menus\.css\?v=20261107-mobile-ui-75/g) || []).length, 2);
});

test('RAVEN usa 75% en teléfonos sin reescalar el monitor ni eliminar su maximización', () => {
  const start = terminal.indexOf('/* Teléfonos: menús del sistema RAVEN/OS al 75%.');
  assert.ok(start >= 0);
  const mobile = terminal.slice(start, terminal.indexOf('</style>', start));
  assert.match(mobile, /#startMenu\.start-menu\s*\{\s*transform:\s*scale\(\.75\)/);
  assert.match(mobile, /#desktopIcons\s*\{\s*transform:\s*scale\(\.75\)/);
  assert.match(mobile, /#windowsLayer \.window\.maximized/);
  assert.match(mobile, /left:\s*12\.5%\s*!important/);
  assert.match(mobile, /top:\s*12\.5%\s*!important/);
  assert.match(mobile, /transform-origin:\s*top left/);
  assert.equal((mobile.match(/scale\(\.75\)/g) || []).length, 3);
});
