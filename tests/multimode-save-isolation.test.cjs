'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const saves = require('../juego/core/fh-multimode-save-identity.js');
const identity = (rulesetId = 'dnd') => ({ mapId: 'same-map', characterId: 'same-player',
  rulesetId, rulesetVersion: 1, saveId: 'slot-1' });
// Contratos sintéticos: no se atribuyen estas estadísticas a adaptadores oficiales planned.
const state = rulesetId => ({ world: { marker: rulesetId }, rules: {
  rulesetId, rulesetVersion: 1, data: rulesetId === 'dnd' ? { fixtureD20: 12 } : { fixtureCoins: 3 }
} });
const options = rulesetId => ({ identity: identity(rulesetId),
  validateWorldState: world => typeof world.marker === 'string',
  validateRulesetState: (data, id) => id.rulesetId === 'dnd'
    ? Object.keys(data).length === 1 && Number.isInteger(data.fixtureD20)
    : Object.keys(data).length === 1 && Number.isInteger(data.fixtureCoins)
});
const fixture = (rulesetId = 'dnd') => saves.create(options(rulesetId));
const code = (fn, expected) => assert.throws(fn, error => error.code === expected);

test('mismo mapa/personaje/slot: DnD y Moon conservan claves y estados independientes', () => {
  const dnd = fixture(), moon = fixture('moon-system');
  const storage = new Map([
    ['blakpine_character_active_v1', 'legacy-profile'], ['fh_game_v1_123', 'legacy-save']
  ]);
  assert.notEqual(dnd.key, moon.key);
  storage.set(dnd.key, dnd.pack(state('dnd')));
  storage.set(moon.key, moon.pack(state('moon-system')));
  assert.equal(dnd.unpack(storage.get(dnd.key)).state.rules.data.fixtureD20, 12);
  assert.equal(moon.unpack(storage.get(moon.key)).state.rules.data.fixtureCoins, 3);
  code(() => dnd.unpack(storage.get(moon.key)), 'SAVE_IDENTITY_MISMATCH');
  code(() => moon.unpack(storage.get(dnd.key)), 'SAVE_IDENTITY_MISMATCH');
  // Sobrescribir una copia no toca la otra ni ninguna clave Legacy.
  const next = state('dnd'); next.rules.data.fixtureD20 = 19;
  storage.set(dnd.key, dnd.pack(next));
  assert.equal(moon.unpack(storage.get(moon.key)).state.rules.data.fixtureCoins, 3);
  assert.equal(storage.get('blakpine_character_active_v1'), 'legacy-profile');
  assert.equal(storage.get('fh_game_v1_123'), 'legacy-save');
});

test('todas las identidades quedan ligadas: cambios se rechazan sin retargeting', () => {
  const guard = fixture(), raw = JSON.parse(guard.pack(state('dnd')));
  for (const field of ['mapId', 'characterId', 'saveId']) {
    const changed = structuredClone(raw); changed.identity[field] += '-other';
    code(() => guard.validate(changed), 'SAVE_IDENTITY_MISMATCH');
    const other = saves.create({ ...options('dnd'), identity: changed.identity });
    assert.notEqual(other.key, guard.key);
  }
  const original = identity(); const bound = saves.create({ ...options('dnd'), identity: original });
  original.mapId = 'changed-after-binding';
  assert.equal(bound.identity.mapId, 'same-map');
  assert.ok(Object.isFrozen(bound.identity));
});

test('reglas desconocidas, Legacy y versiones desconocidas fallan al crear y al leer', () => {
  const guard = fixture();
  for (const rulesetId of ['legacy', 'moon', 'unknown', '', null]) {
    code(() => saves.create({ ...options('dnd'), identity: { ...identity(), rulesetId } }), 'SAVE_RULESET_UNKNOWN');
    const value = JSON.parse(guard.pack(state('dnd'))); value.identity.rulesetId = rulesetId;
    code(() => guard.validate(value), 'SAVE_RULESET_UNKNOWN');
  }
  for (const rulesetVersion of [0, 2, '1', null]) {
    code(() => saves.create({ ...options('dnd'), identity: { ...identity(), rulesetVersion } }), 'SAVE_RULESET_VERSION_UNSUPPORTED');
    const value = JSON.parse(guard.pack(state('dnd'))); value.identity.rulesetVersion = rulesetVersion;
    code(() => guard.validate(value), 'SAVE_RULESET_VERSION_UNSUPPORTED');
  }
  for (const formatVersion of [0, 2, '1', null]) {
    const value = JSON.parse(guard.pack(state('dnd'))); value.formatVersion = formatVersion;
    code(() => guard.validate(value), 'SAVE_FORMAT_UNSUPPORTED');
  }
});

test('estado de otro reglamento o no aprobado se rechaza al escribir y restaurar', () => {
  const guard = fixture();
  for (const invalid of [state('moon-system'), { ...state('dnd'), world: [] },
    { ...state('dnd'), rules: { ...state('dnd').rules, data: { fixtureCoins: 2 } } },
    { ...state('dnd'), rules: { ...state('dnd').rules, rulesetVersion: 2 } }]) {
    code(() => guard.pack(invalid), 'SAVE_STATE_INCOMPATIBLE');
    const envelope = JSON.parse(guard.pack(state('dnd'))); envelope.state = invalid;
    code(() => guard.unpack(JSON.stringify(envelope)), 'SAVE_STATE_INCOMPATIBLE');
  }
  code(() => saves.create({ identity: identity() }), 'SAVE_VALIDATORS_MISSING');
  for (const validator of [() => false, () => undefined, () => 'true', () => Promise.resolve(true), () => Promise.reject(Error('async invalid')), () => { throw Error('bad schema'); }]) {
    const bad = saves.create({ ...options('dnd'), validateRulesetState: validator });
    code(() => bad.pack(state('dnd')), 'SAVE_STATE_INCOMPATIBLE');
  }
});

test('el sobre multimodo no lo acepta el selector Legacy real, ni acepta sobre Legacy', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../juego/assets/fh-character-core.js'), 'utf8'), context);
  const guard = fixture(), raw = guard.pack(state('dnd'));
  assert.equal(context.FHCharacterCore.selectMapSave(raw, 'same-player'), null);
  code(() => guard.unpack(JSON.stringify({ version: 1, state: { characterId: 'same-player' } })), 'SAVE_ENVELOPE_INVALID');
  const disguised = JSON.parse(raw); disguised.version = 1;
  code(() => guard.validate(disguised), 'SAVE_ENVELOPE_INVALID');
});

test('el lector real del iframe rechaza multimodo en almacenamiento y backup', () => {
  const { window } = require('./helpers/forest-engine.cjs')();
  const base = Buffer.from(window.__FOREST_EMBEDDED_ENGINE__, 'base64').toString('utf8');
  const from = base.indexOf('function readGameSave('), to = base.indexOf('function writeGameSave(', from);
  assert.ok(from >= 0 && to > from, 'anclas de las funciones reales presentes');
  const context = vm.createContext({});
  vm.runInContext(base.slice(from, to), context);
  const guard = fixture(), raw = guard.pack(state('dnd'));
  assert.equal(context.readGameSave({ getItem: () => raw }, 'any-key', raw), null);
  assert.equal(context.readGameSave(null, 'any-key', JSON.parse(raw)), null);
  const legacy = JSON.stringify({ version: 1, state: { characterId: 'same-player' } });
  assert.equal(context.readGameSave({ getItem: () => legacy }, 'fh_game_v1_123', null).characterId, 'same-player');
});

test('JSON estricto, campos extra, getters y ciclos no se normalizan en silencio', () => {
  const guard = fixture();
  for (const raw of ['', '{', null, '{}', 'null', '[]']) {
    assert.throws(() => guard.unpack(raw), saves.SaveIdentityError);
  }
  for (const value of [undefined, NaN, Infinity, new Date(), () => {}, [,], new Map()]) {
    const invalid = state('dnd'); invalid.world.bad = value;
    code(() => guard.pack(invalid), 'SAVE_JSON_INVALID');
  }
  const cyclic = state('dnd'); cyclic.world.self = cyclic;
  code(() => guard.pack(cyclic), 'SAVE_JSON_INVALID');
  let reads = 0; const accessor = state('dnd');
  Object.defineProperty(accessor.world, 'bad', { enumerable: true, get() { reads++; return 1; } });
  code(() => guard.pack(accessor), 'SAVE_JSON_INVALID'); assert.equal(reads, 0);
  const extra = JSON.parse(guard.pack(state('dnd'))); extra.identity.sessionId = 'not-durable';
  code(() => guard.validate(extra), 'SAVE_IDENTITY_INVALID');
});

test('claves no colisionan por delimitadores y los resultados no comparten referencias', () => {
  const a = saves.create({ ...options('dnd'), identity: { ...identity(), mapId: 'a:b', characterId: 'c' } });
  const b = saves.create({ ...options('dnd'), identity: { ...identity(), mapId: 'a', characterId: 'b:c' } });
  assert.notEqual(a.key, b.key);
  const guard = fixture(), input = state('dnd');
  const value = guard.validate({ kind: saves.KIND, formatVersion: 1, identity: identity(), state: input });
  input.rules.data.fixtureD20 = 99;
  assert.equal(value.state.rules.data.fixtureD20, 12);
  assert.ok(Object.isFrozen(value.state.rules.data));
  assert.throws(() => { value.state.world.marker = 'mutated'; }, TypeError);
});

test('script clásico carga sin DOM, almacenamiento, motor ni módulos', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../juego/core/fh-multimode-save-identity.js'), 'utf8'), context);
  assert.equal(typeof context.FHMultimodeSaveIdentity.create, 'function');
  assert.equal(vm.runInContext(`FHMultimodeSaveIdentity.create({identity:{mapId:'m',characterId:'c',rulesetId:'dnd',rulesetVersion:1,saveId:'s'},validateWorldState:()=>true,validateRulesetState:()=>true}).pack({world:{},rules:{rulesetId:'dnd',rulesetVersion:1,data:{}}})`, context).includes('blakpine-multimode-save'), true);
});
