'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const runtime = require('../juego/core/fh-multimode-persistence.js');

const identity = (rulesetId = 'dnd', saveId = 'slot-1', mapId = 'map-1', characterId = 'hero-1') =>
  ({ mapId, characterId, rulesetId, rulesetVersion: 1, saveId });
const state = (rulesetId, progress, resource) => ({
  world: { progress },
  rules: { rulesetId, rulesetVersion: 1,
    data: rulesetId === 'dnd' ? { d20: resource } : { coins: resource } }
});
function adapter(rulesetId, overrides = {}) {
  return {
    status: 'implemented', // Adaptador SINTÉTICO de prueba; no habilita reglamentos reales.
    contract: 'blakpine-save-adapter-v1', rulesetId,
    validateWorldState: world => Number.isInteger(world.progress) && Object.keys(world).length === 1,
    validateRulesetState: data => rulesetId === 'dnd'
      ? Number.isInteger(data.d20) && Object.keys(data).length === 1
      : Number.isInteger(data.coins) && Object.keys(data).length === 1,
    capture: game => state(rulesetId, game.progress, game.resource),
    restore: (world, rules) => ({ progress: world.progress,
      resource: rulesetId === 'dnd' ? rules.d20 : rules.coins }),
    initial: () => ({ progress: 0, resource: 0 }),
    ...overrides
  };
}
const memory = (initial = []) => {
  const entries = new Map(initial);
  return { entries, getItem: key => entries.get(key) || null,
    setItem: (key, value) => entries.set(key, value) };
};
const create = (role, id, storage, rules = adapter(id.rulesetId), sessionId = 'session-1', send = () => {}) =>
  runtime.create({ role, identity: id, sessionId, adapter: rules, storage, send });
const code = (fn, expected) => assert.throws(fn, err => err.code === expected);

test('Legacy sigue intacto, y DnD/Moon no comparten clave, estado o recursos', () => {
  const store = memory([['fh_game_v1_aabb', 'legacy-save'], ['blakpine_character_active_v1', 'legacy-profile']]);
  const events = [];
  const dnd = create('frame', identity('dnd'), store, adapter('dnd'), 'dnd-session', m => events.push(m));
  const moon = create('frame', identity('moon-system'), store, adapter('moon-system'), 'moon-session', m => events.push(m));
  assert.notEqual(dnd.key, moon.key);
  dnd.write({ progress: 12, resource: 20 }, {});
  moon.write({ progress: 4, resource: 3 }, {});
  assert.deepEqual(dnd.restore({}), { progress: 12, resource: 20 });
  assert.deepEqual(moon.restore({}), { progress: 4, resource: 3 });
  assert.equal(store.entries.get('fh_game_v1_aabb'), 'legacy-save');
  assert.equal(store.entries.get('blakpine_character_active_v1'), 'legacy-profile');
  assert.ok([...store.entries.keys()].filter(k => k.startsWith('blakpine_multimode_save_v1:')).length === 2);
  assert.ok(events.every(e => e.type === 'FOREST_MULTIMODE_SAVE'));
});

test('mapa, personaje y partida independientes incluso bajo el mismo reglamento', () => {
  const store = memory();
  const slots = [identity(), identity('dnd', 'slot-2'),
    identity('dnd', 'slot-1', 'map-2'), identity('dnd', 'slot-1', 'map-1', 'hero-2')];
  const sessions = slots.map((id, index) => create('frame', id, store, adapter('dnd'), 'session-'+index));
  assert.equal(new Set(sessions.map(session => session.key)).size, slots.length);
  sessions.forEach((session, index) => session.write({ progress: index + 1, resource: 10 + index }, {}));
  sessions.forEach((session, index) => assert.equal(session.restore({}).progress, index + 1));
});

test('cerrar, reabrir y restaurar una muerte no pierde ni mezcla progreso', () => {
  const store = memory();
  const id = identity('moon-system');
  const first = create('frame', id, store);
  first.write({ progress: 15, resource: 0 }, {});
  first.close();
  code(() => first.read(), 'SAVE_SESSION_CLOSED');
  code(() => first.write({ progress: 99, resource: 99 }, {}), 'SAVE_SESSION_CLOSED');
  const reopened = create('frame', id, store, adapter('moon-system'), 'new-session');
  assert.deepEqual(reopened.restore({}), { progress: 15, resource: 0 });
  reopened.write({ progress: 15, resource: -1 }, {});
  assert.deepEqual(create('parent', id, store).restore({}), { progress: 15, resource: -1 });
});

test('canal padre/iframe valida sobre, identidad, sesión, orden y escritura', () => {
  const father = memory(), child = memory(), id = identity();
  const outbound = [];
  const frame = create('frame', id, child, adapter('dnd'), 'actual', m => outbound.push(m));
  const parent = create('parent', id, father, adapter('dnd'), 'actual');
  frame.write({ progress: 2, resource: 14 }, {});
  const first = outbound[0];
  assert.equal(parent.accept({ ...first, sessionId: 'other' }), false);
  assert.equal(parent.accept({ ...first, key: 'fh_game_v1_aabb' }), false);
  assert.equal(parent.accept({ ...first, identity: { ...id, saveId: 'other' } }), false);
  assert.equal(father.entries.size, 0);
  assert.equal(parent.accept(first), true);
  assert.equal(parent.accept(first), false);
  frame.write({ progress: 3, resource: 17 }, {});
  assert.equal(parent.accept(outbound[1]), true);
  assert.equal(parent.accept(first), false);
  assert.deepEqual(parent.restore({}), { progress: 3, resource: 17 });
  const wrong = { ...outbound[1], sequence: 3, json: outbound[1].json.replace('"dnd"', '"moon-system"') };
  code(() => parent.accept(wrong), 'SAVE_IDENTITY_MISMATCH');
  assert.equal(parent.restore({}).resource, 17);
  parent.close();
  code(() => parent.accept(outbound[1]), 'SAVE_SESSION_CLOSED');
});

test('escritura incompatible se rechaza antes de tocar almacenamiento o mensajes', () => {
  const store = memory(); let emitted = 0;
  const broken = adapter('dnd', {
    capture: () => state('moon-system', 1, 3)
  });
  const writer = create('frame', identity(), store, broken, 'save', () => emitted++);
  code(() => writer.write({ progress: 2, resource: 1 }, {}), 'SAVE_STATE_INCOMPATIBLE');
  assert.equal(store.entries.size, 0);
  assert.equal(emitted, 0);
  const badJson = create('frame', identity(), store, adapter('dnd', {
    capture: () => ({ ...state('dnd', 1, 10), world: { progress: Infinity } })
  }));
  code(() => badJson.write({}, {}), 'SAVE_JSON_INVALID');
  assert.equal(store.entries.size, 0);
});

test('local incompatible NO cae en backup; fallback válido no entra a Legacy', () => {
  const id = identity(), backing = memory(), writer = create('frame', id, backing);
  writer.write({ progress: 5, resource: 11 }, {});
  const valid = backing.getItem(writer.key);
  const deny = { getItem: () => { throw Error('storage denied'); }, setItem: () => { throw Error('storage denied'); } };
  const frame = create('frame', id, deny, adapter('dnd'), 'another-session');
  assert.equal(frame.restore({}, valid).resource, 11);
  assert.equal(frame.restore({}).resource, 0);
  const corrupt = memory([[writer.key, '{"version":1,"state":{}}']]);
  const reader = create('parent', id, corrupt);
  code(() => reader.read(valid), 'SAVE_ENVELOPE_INVALID');
  const changed = JSON.parse(valid);
  changed.formatVersion = 42;
  code(() => frame.read(JSON.stringify(changed)), 'SAVE_FORMAT_UNSUPPORTED');
  const otherRule = create('frame', identity('moon-system'), memory());
  code(() => otherRule.read(valid), 'SAVE_IDENTITY_MISMATCH');
});

test('adaptadores reservados, de contrato incorrecto y versiones no admitidas bloquean sesión', () => {
  for (const value of [
    adapter('dnd', { status: 'reserved' }), adapter('dnd', { contract: 'unknown' }),
    adapter('moon-system'), adapter('dnd', { capture: null }), null
  ]) code(() => create('frame', identity(), memory(), value), 'SAVE_ADAPTER_UNAVAILABLE');
  code(() => create('frame', { ...identity(), rulesetVersion: 2 }, memory()), 'SAVE_RULESET_VERSION_UNSUPPORTED');
  code(() => create('frame', { ...identity(), rulesetId: 'legacy' }, memory(), adapter('legacy')), 'SAVE_RULESET_UNKNOWN');
  code(() => create('frame', identity(), memory(), adapter('dnd'), ''), 'SAVE_SESSION_INVALID');
});

test('un frame no acepta mensajes entrantes, un padre no escribe, y un receptor sin storage no confirma', () => {
  const id = identity();
  const frame = create('frame', id, memory());
  const parent = create('parent', id, memory());
  code(() => frame.accept({}), 'SAVE_RECEIVER_INVALID');
  code(() => parent.write({}, {}), 'SAVE_WRITER_INVALID');
  const missing = create('parent', id, null);
  const outbound = [];const writer = create('frame', id, memory(), adapter('dnd'), 'session-1', m => outbound.push(m));
  writer.write({ progress: 1, resource: 1 }, {});
  assert.equal(missing.accept(outbound[0]), false);
});
