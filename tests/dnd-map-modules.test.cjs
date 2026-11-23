'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const modules = require('../juego/rules/dnd/fh-dnd-map-modules.js');
const save = require('../juego/rules/dnd/fh-dnd-save-adapter.js');
const styles = require('../juego/assets/fh-style-property.js');
globalThis.FHMedievalLighting = require('../juego/assets/fh-medieval-lighting.js');

const fixture = () => ({ floors: [{ id: 'floor1', items: [
 { id: 'torch', type: 'light_fixture', lightKind: 'torch_wall' },
 { id: 'electric-light', type: 'light_fixture' },
 { id: 'outlet', type: 'power_outlet' },
 { id: 'phone', type: 'landline_phone' },
 { id: 'pc', type: 'misc', modelId: 'escritorio_pc' },
]}] });

test('Electricidad y Modernidad son opciones del mapa independientes', () => {
 const expected = [
  [{}, ['torch']],
  [{ electricity: true }, ['torch', 'electric-light', 'outlet']],
  [{ modernity: true }, ['torch', 'phone', 'pc']],
  [{ electricity: true, modernity: true }, ['torch', 'electric-light', 'outlet', 'phone', 'pc']],
 ];
 for (const [settings, ids] of expected) {
  const map = { ...fixture(), dndModules: settings };
  const session = modules.prepareMap(structuredClone(map));
  assert.deepEqual(session.floors[0].items.map(item => item.id), ids);
  assert.equal(map.floors[0].items.length, 5);
 }
 const wall = { type: 'wall', a: { x: 0, y: 0 }, b: { x: 2, y: 0 } };
 assert.equal(styles.wallStyle({ ...fixture(), dndModules: { electricity: true } }, 'floor1', wall, 'A', 'dnd').preset, 'madera');
 assert.equal(styles.wallStyle({ ...fixture(), dndModules: { modernity: true } }, 'floor1', wall, 'A', 'dnd').preset, 'ladrillo');
});

test('Una partida existente conserva su inventario D&D, sin recuperar teléfonos ni cargadores Legacy', () => {
 const map = fixture();
 const initial = save.initial(map);
 initial.inventory = ['cell_phone_charger', 'cell_phone', 'resin'];
 initial.equipment = { rearLeft: 'cell_phone', rearRight: 'wallet' };
 initial.phone = { charge: 80 };
 initial.flags = { power_global: true, unlocked: true };
 initial.decoration = { editorItems: [{ items: [fixture().floors[0].items.at(-1)] }] };
 const packet = { runtime: { ...initial } };
 delete packet.runtime.dnd;
 const restored = save.restore(packet, initial.dnd, map);
 assert.deepEqual(restored.inventory, ['resin']);
 assert.equal(restored.equipment.rearLeft, '');
 assert.equal(restored.equipment.rearRight, 'wallet');
 assert.equal(restored.phone, undefined);
 assert.deepEqual(restored.flags, { power_global: false, unlocked: true });
 assert.deepEqual(restored.decoration.editorItems[0].items, []);
 assert.deepEqual(save.capture(restored, map).world.runtime.inventory, ['resin']);
 assert.deepEqual(initial.inventory, ['cell_phone_charger', 'cell_phone', 'resin']);
});
