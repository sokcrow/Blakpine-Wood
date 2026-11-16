'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { readSelection } = require('../juego/core/fh-mode-selection.js');
const { create } = require('../juego/core/fh-session-coordinator.js');
const root = path.resolve(__dirname, '..');
const readJson = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
// Reutiliza el validador real sin ejecutar su recorrido CLI ni mantener otra implementación.
const validatorSource = fs.readFileSync(path.join(root, 'contratos/multimodo/validar-contratos.mjs'), 'utf8');
const validator = vm.runInNewContext(
  validatorSource.slice(validatorSource.indexOf('function matchesType'), validatorSource.indexOf('const refs =')) + '\nvalidate',
  { assert(condition, message) { assert.ok(condition, message); } }
);
const validate = (data, schema) => { validator(data, schema); return true; };
const reader = selection => readSelection(selection, { readJson, validate });
const base = readJson('contratos/multimodo/ejemplos/selecciones/moderno-dnd.json');
const copy = value => structuredClone(value);
const rejectsCode = (promise, code) => assert.rejects(promise, error => error.code === code);
function synthetic(overrides = {}) {
  const worldProfile = readJson(base.worldProfile);
  const rulesetManifest = readJson(base.rulesetManifest);
  rulesetManifest.status = 'implemented'; // SOLO fixture; no cambia manifiestos oficiales.
  const mode = { kind: 'multimode', selection: copy(base), worldProfile, rulesetManifest };
  let loads = 0, evaluations = 0;
  const options = {
    readSelection: async () => mode,
    worldLoader: { async prepare(world) { loads++; assert.equal(world, worldProfile); return { map: world.map.path }; } },
    rulesAdapter: { ...rulesetManifest.adapter, rulesetId: rulesetManifest.id, evaluate() { evaluations++; } },
    ...overrides
  };
  return { mode, options, loads: () => loads, evaluations: () => evaluations };
}

test('ausencia conserva Legacy sin leer ni preparar dependencias', async () => {
  const bomb = () => { throw Error('No debe invocarse'); };
  for (const input of [null, undefined]) {
    assert.deepEqual(await readSelection(input, { readJson: bomb, validate: bomb }), { kind: 'legacy' });
    assert.deepEqual(await create({ readSelection: bomb, worldLoader: { prepare: bomb } }).prepare(input), { kind: 'legacy' });
  }
});

test('lector valida los 9 pares reales y entrega copias profundamente congeladas', async () => {
  for (const world of ['ciudad-moderna', 'distopia', 'villa-medieval']) {
    for (const rules of ['legacy', 'dnd', 'moon-system']) {
      const input = { ...base, worldProfile: `contratos/multimodo/ejemplos/mundos/${world}.json`, rulesetManifest: `contratos/multimodo/ejemplos/reglas/${rules}.json` };
      const result = await reader(input);
      assert.equal(result.worldProfile.id, world);
      assert.equal(result.rulesetManifest.id, rules);
      assert.ok(Object.isFrozen(result.worldProfile.environment));
      assert.ok(Object.isFrozen(result.selection));
      input.worldProfile = 'changed.json';
      assert.notEqual(result.selection.worldProfile, input.worldProfile);
      assert.throws(() => { result.worldProfile.environment.archetype = 'changed'; }, TypeError);
    }
  }
});

test('selección inválida nunca equivale a ausencia y no lee referencias inseguras', async () => {
  for (const bad of [false, '', 0, {}, { ...base, version: 99 }, { ...base, extra: true },
    { ...base, worldProfile: '../escape.json' }, { ...base, rulesetManifest: 'https://bad/rules.json' }]) {
    const paths = [];
    await rejectsCode(readSelection(bad, { readJson(p) { paths.push(p); return readJson(p); }, validate }), 'CONTRACT_INVALID');
    assert.ok(paths.every(p => p.startsWith('contratos/multimodo/v1/')));
  }
  await rejectsCode(reader({ ...base, kind: 'forest-horror-map-v1' }), 'CONTRACT_INVALID');
});

test('lector controla dependencias, fallos IO/JSON, documentos y validación asíncrona', async () => {
  await rejectsCode(readSelection(base), 'SELECTION_DEPENDENCIES_MISSING');
  await rejectsCode(readSelection(base, { readJson: () => { throw new SyntaxError('JSON'); }, validate }), 'DOCUMENT_READ_FAILED');
  await rejectsCode(readSelection(base, { readJson, validate: async () => false }), 'CONTRACT_INVALID');
  await rejectsCode(readSelection(base, { readJson, validate: async () => undefined }), 'CONTRACT_INVALID');
  assert.equal((await readSelection(base, { readJson, validate: async (d, s) => validate(d, s) })).kind, 'multimode');
  for (const target of [base.worldProfile, base.rulesetManifest]) {
    await rejectsCode(readSelection(base, { readJson: p => p === target ? {} : readJson(p), validate }), 'CONTRACT_INVALID');
    await rejectsCode(readSelection(base, { readJson: p => { if (p === target) throw Error('missing'); return readJson(p); }, validate }), 'DOCUMENT_READ_FAILED');
  }
});

test('reglas oficiales planned fallan antes del cargador y sin fallback', async () => {
  let calls = 0;
  for (const rule of ['legacy', 'dnd', 'moon-system']) {
    const selection = { ...base, rulesetManifest: `contratos/multimodo/ejemplos/reglas/${rule}.json` };
    await rejectsCode(create({ readSelection: reader, worldLoader: { prepare() { calls++; } } }).prepare(selection), 'RULESET_NOT_IMPLEMENTED');
  }
  assert.equal(calls, 0);
});

test('fixture implemented prepara descripción sin evaluar combate', async () => {
  const fixture = synthetic();
  const result = await create(fixture.options).prepare(base);
  assert.equal(result.kind, 'prepared');
  assert.equal(fixture.loads(), 1);
  assert.equal(fixture.evaluations(), 0);
  assert.ok(Object.isFrozen(result));
});

test('adaptador ausente, identidad incorrecta o sin evaluate se rechaza antes de cargar', async () => {
  for (const property of ['id', 'contract', 'rulesetId', 'evaluate']) {
    const fixture = synthetic();
    fixture.options.rulesAdapter[property] = null;
    await rejectsCode(create(fixture.options).prepare(base), 'RULES_ADAPTER_MISMATCH');
    assert.equal(fixture.loads(), 0);
  }
  const fixture = synthetic({ rulesAdapter: null });
  await rejectsCode(create(fixture.options).prepare(base), 'RULES_ADAPTER_MISSING');
  assert.equal(fixture.loads(), 0);
  fixture.mode.rulesetManifest.status = 'reserved';
  await rejectsCode(create(fixture.options).prepare(base), 'RULESET_NOT_IMPLEMENTED');
});

test('mundo sin mapa y errores de cargador tienen resultados controlados', async () => {
  const fixture = synthetic();
  delete fixture.mode.worldProfile.map;
  await rejectsCode(create(fixture.options).prepare(base), 'WORLD_MAP_MISSING');
  assert.equal(fixture.loads(), 0);
  await rejectsCode(create(synthetic({ worldLoader: null }).options).prepare(base), 'WORLD_LOADER_MISSING');
  await rejectsCode(create(synthetic({ worldLoader: { prepare() { throw Error('map missing'); } } }).options).prepare(base), 'WORLD_PREPARATION_FAILED');
  await rejectsCode(create(synthetic({ worldLoader: { prepare: async () => null } }).options).prepare(base), 'WORLD_DESCRIPTION_INVALID');
});

test('fallos del lector se controlan; una selección explícita no acepta retorno Legacy', async () => {
  await rejectsCode(create().prepare(base), 'SELECTION_READER_MISSING');
  await rejectsCode(create({ readSelection() { throw Error('read'); } }).prepare(base), 'SELECTION_FAILED');
  await rejectsCode(create({ readSelection: async () => ({ kind: 'legacy' }) }).prepare(base), 'SELECTION_INVALID');
});

test('exportaciones clásicas cargan sin DOM, motor, almacenamiento ni require', () => {
  const context = vm.createContext({});
  for (const file of ['fh-mode-selection.js', 'fh-session-coordinator.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'juego/core', file), 'utf8'), context);
  }
  assert.equal(typeof context.FHModeSelection.readSelection, 'function');
  assert.equal(typeof context.FHSessionCoordinator.create, 'function');
});

test('descripción aislada del cargador y rechazo de objetos vivos/no JSON', async () => {
  const description = { nested: { path: 'before' }, tags: ['one'] };
  const fixture = synthetic({ worldLoader: { prepare: () => description } });
  const result = await create(fixture.options).prepare(base);
  description.nested.path = 'after';
  description.tags.push('two');
  assert.equal(result.worldDescription.nested.path, 'before');
  assert.deepEqual(result.worldDescription.tags, ['one']);
  assert.ok(Object.isFrozen(result.worldDescription.nested));
  const cycle = {}; cycle.self = cycle;
  for (const bad of [[], new Date(), { live: new Date() }, { callback() {} }, cycle]) {
    await rejectsCode(create(synthetic({ worldLoader: { prepare: () => bad } }).options).prepare(base), 'WORLD_DESCRIPTION_INVALID');
  }
});
