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
  assert.match(page, /\+hudFrameScript\+mobileMenusCss\+statusCss\+statusStrings\+statusScript\+mobileCameraScript\+'<\/head>'/);
  assert.equal((page.match(/fh-mobile-menus\.css\?v=20261107-mobile-ui-75/g) || []).length, 2);
});

test('RAVEN en móvil horizontal aprovecha el escritorio y en vertical pide girar', () => {
  assert.ok(!terminal.includes('scale(.75)'), 'RAVEN no debe aplicar escalas artificiales');
  assert.ok(terminal.includes('@media (pointer:coarse) and (orientation:portrait) and (max-width:1100px)'));
  assert.ok(terminal.includes('#orientationNotice{display:flex}'));
  assert.ok(terminal.includes('@media (pointer:coarse) and (orientation:landscape) and (max-width:1100px)'));
  assert.ok(terminal.includes('frame.style.height=Math.floor(availableHeight)'));
  assert.ok(terminal.includes("if(mobileMaximized)win.classList.add('maximized')"));
  assert.ok(terminal.includes('height:calc(100% - var(--fh-desktop-topbar,31px))!important'));
  assert.ok(terminal.includes('aspect-ratio:16 / 10'), 'El monitor 3D mantiene su formato');
});
