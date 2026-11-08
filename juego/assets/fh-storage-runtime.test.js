/* Pruebas del flujo real de almacenamiento: interfaz, transferencia y persistencia. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('./fh-inventory-core.js');

function mount(snapshot = null) {
  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.children = []; this.events = {};
      this.attributes = {}; this.hidden = false; this.className = '';
      this.textContent = ''; this.id = ''; this.type = '';
    }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = [...children]; }
    addEventListener(key, fn) { (this.events[key] ||= []).push(fn); }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    click() { for (const fn of this.events.click || []) fn({ target: this }); }
    focus() { document.activeElement = this; }
    querySelector(selector) {
      const found = findAll(this, item => item.className.split(' ').includes(selector.slice(1)));
      return found[0] || null;
    }
  }
  function findAll(root, predicate) {
    const out = [];
    const scan = el => { if (predicate(el)) out.push(el); for (const child of el.children) scan(child); };
    scan(root);
    return out;
  }
  const document = {
    body: new Element('body'), activeElement: null,
    createElement: tag => new Element(tag)
  };
  const win = { document, FHInventoryCore: Core, FH_STORAGE_STRINGS: {
    open: 'Abrir inventario', store: 'Guardar', take: 'Sacar', category: 'Categoría incompatible'
  } };
  const src = fs.readFileSync(path.join(__dirname, 'fh-storage-runtime.js'), 'utf8');
  new Function('window', src)(win);
  const alacena = { id: 'alacena-1', type: 'misc', modelId: 'alacena_superior', label: 'Alacena de pared' };
  const otra = { id: 'alacena-2', type: 'misc', modelId: 'alacena_superior', label: 'Otra alacena' };
  const sofa = { id: 'sofa-1', type: 'sofa', modelId: 'sofa' };
  const project = { floors: [
    { id: 'F1', items: [alacena, sofa] }, { id: 'F2', items: [otra] }
  ] };
  const defs = [
    { id: 'lata', name: 'Lata', kind: 'consumable', storageCategory: 'food', stackable: true },
    { id: 'nota', name: 'Nota', kind: 'note', storageCategory: 'document', stackable: false }
  ];
  const state = { inventory: ['lata', 'lata', 'nota'], fhInventoryStorage: snapshot };
  let saves = 0, renders = 0;
  const rt = win.FHStorageRuntime;
  const instance = rt.init({
    project, state, itemDefs: defs, save: () => saves++,
    onInventoryChange: () => renders++
  });
  return { win, doc: document, rt, instance, state, alacena, sofa, otra, findAll,
    get saves() { return saves; }, get renders() { return renders; } };
}

test('alacenas interactuables; muebles no contenedores excluidos', () => {
  const s = mount();
  assert.equal(s.rt.supports(s.alacena), true);
  assert.equal(s.rt.supports(s.sofa), false);
  assert.equal(s.rt.open(s.sofa, 0), false);
  assert.equal(s.rt.open(s.alacena, 0), true);
  assert.equal(s.rt.isOpen, true);
  assert.equal(s.instance.world.furniture['F1:alacena-1'].slots, 6);
  assert.equal(s.instance.world.furniture['F2:alacena-2'].slots, 6);
  assert.notEqual(s.instance.world.furniture['F1:alacena-1'], s.instance.world.furniture['F2:alacena-2']);
  s.rt.close();
  assert.equal(s.rt.isOpen, false);
});

test('guardar y sacar modifica el inventario real, sin duplicar objetos', () => {
  const s = mount();
  assert.equal(s.rt.open(s.alacena, 0), true);
  const moveButtons = () => s.findAll(s.doc.body, el => el.className === 'fh-storage-move');
  assert.equal(moveButtons().length, 2);
  moveButtons()[0].click(); // Guardar una lata.
  assert.deepEqual(s.state.inventory, ['lata', 'nota']);
  assert.equal(s.instance.world.furniture['F1:alacena-1'].items[0].quantity, 1);
  assert.equal(s.saves, 1);
  assert.equal(s.renders, 1);
  moveButtons().at(-1).click(); // Recuperar la lata.
  assert.deepEqual(s.state.inventory, ['lata', 'lata', 'nota']);
  assert.equal(s.instance.world.furniture['F1:alacena-1'].items.length, 0);
  assert.equal(s.saves, 2);
  assert.equal(s.renders, 2);
});

test('las restricciones y el guardado siguen vigentes al cerrar y reabrir', () => {
  const s = mount();
  s.rt.open(s.alacena, 0);
  const moveButtons = () => s.findAll(s.doc.body, el => el.className === 'fh-storage-move');
  moveButtons()[1].click(); // Nota: no válida en alacena.
  assert.deepEqual(s.state.inventory, ['lata', 'lata', 'nota']);
  assert.equal(s.instance.world.furniture['F1:alacena-1'].items.length, 0);
  assert.equal(s.saves, 0);
  moveButtons()[0].click();
  const snapshot = JSON.parse(JSON.stringify(s.state.fhInventoryStorage));
  s.rt.close();
  const restored = mount(snapshot);
  restored.rt.open(restored.alacena, 0);
  assert.equal(restored.instance.world.furniture['F1:alacena-1'].items[0].quantity, 1);
  assert.equal(restored.instance.world.furniture['F2:alacena-2'].items.length, 0);
});

test('encimera modular aparece como contenedor interactuable en 3D', () => {
  const s = mount();
  const encimera = { id: 'encimera-1', type: 'misc', modelId: 'encimera_simple', label: 'Encimera modular' };
  s.instance.project.floors[0].items.push(encimera);
  assert.equal(s.rt.supports(encimera), true);
  assert.equal(s.rt.open(encimera, 0), true);
  assert.equal(s.rt.isOpen, true);
  assert.equal(s.instance.world.furniture['F1:encimera-1'].slots, 6);
  const moveButtons = () => s.findAll(s.doc.body, el => el.className === 'fh-storage-move');
  moveButtons()[0].click();
  assert.deepEqual(s.state.inventory, ['lata', 'nota']);
  assert.equal(s.instance.world.furniture['F1:encimera-1'].items[0].id, 'lata');
  s.rt.close();
});
