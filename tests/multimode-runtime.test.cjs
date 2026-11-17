'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const selectionModule = require('../juego/core/fh-mode-selection.js');
const coordinatorModule = require('../juego/core/fh-session-coordinator.js');
const worldModule = require('../juego/worlds/fh-world-profile-loader.js');
const root = path.resolve(__dirname, '..');
const readJson = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
// Reutiliza las funciones puras del validador canónico, igual que las suites de IA 2/3.
const source = fs.readFileSync(path.join(root, 'contratos/multimodo/validar-contratos.mjs'), 'utf8');
assert.ok(source.includes('function matchesType') && source.includes('const refs ='));
const validateDocument = vm.runInNewContext(source.slice(source.indexOf('function matchesType'), source.indexOf('const refs =')) + '\nvalidate', {
  assert(condition, message) { assert.ok(condition, message); }
});
const validate = (data, schema) => { validateDocument(data, schema); return true; };
const worlds = ['ciudad-moderna', 'distopia', 'villa-medieval'];
const rules = ['legacy', 'dnd', 'moon-system'];
const binding = (world, rule) => ({ kind: 'blakpine-mode-selection-v1', version: 1,
  worldProfile: `contratos/multimodo/ejemplos/mundos/${world}.json`,
  rulesetManifest: `contratos/multimodo/ejemplos/reglas/${rule}.json` });
const read = (input, readJsonPort = readJson) => selectionModule.readSelection(input, { readJson: readJsonPort, validate });
const rejects = (promise, code, cause) => assert.rejects(promise,
  error => error.code === code && (!cause || error.cause?.code === cause));
function harness(rule, edit = () => {}) {
  let loads = 0;
  const reads = [];
  const readPort = p => {
    reads.push(p);
    const data = readJson(p);
    if (p === binding('ciudad-moderna', rule).rulesetManifest) {
      // Fixture explícita: ningún manifiesto oficial ni adaptador real está implemented.
      data.status = 'implemented';
      data.adapter = { id: `fixture.${rule}`, contract: 'blakpine-combat-adapter-v1' };
    }
    edit(p, data);
    return data;
  };
  const loader = worldModule.create({ readJson: readPort, validate });
  const options = {
    readSelection: input => read(input, readPort),
    worldLoader: { prepare(profile) { loads++; return loader.prepare(profile); } },
    rulesAdapter: { id: `fixture.${rule}`, rulesetId: rule, contract: 'blakpine-combat-adapter-v1',
      evaluate() { assert.fail('Preparar una sesión no debe evaluar combate'); } }
  };
  return { options, reads, loads: () => loads };
}

for (const world of worlds) for (const rule of rules) {
  test(`selección real independiente ${world} / ${rule}; reglas oficiales bloqueadas`, async () => {
    const input = binding(world, rule);
    const mode = await read(input);
    assert.equal(mode.worldProfile.id, world);
    assert.equal(mode.rulesetManifest.id, rule);
    assert.deepEqual(mode.worldProfile, readJson(input.worldProfile));
    assert.deepEqual(mode.rulesetManifest, readJson(input.rulesetManifest));
    const description = await worldModule.create({ readJson, validate }).prepare(mode.worldProfile);
    assert.equal(description.scenario.status, world === 'ciudad-moderna' ? 'map-available' : 'declarative-only');
    let loads = 0;
    await rejects(coordinatorModule.create({ readSelection: read,
      worldLoader: { prepare() { loads++; } } }).prepare(input), 'RULESET_NOT_IMPLEMENTED');
    assert.equal(loads, 0);
  });
}
for (const rule of rules) {
  test(`coordinador y cargador reales preparan ${rule} con adaptador fixture sin evaluar`, async () => {
    const h = harness(rule);
    const result = await coordinatorModule.create(h.options).prepare(binding('ciudad-moderna', rule));
    assert.equal(result.kind, 'prepared');
    assert.equal(result.mode.rulesetManifest.id, rule);
    assert.deepEqual(result.worldDescription.scenario.data,
      readJson('forest-horror/maps/DEMO_Interacciones.json'));
    assert.equal(h.loads(), 1);
    assert.ok(Object.isFrozen(result.worldDescription.scenario.data.units));
  });
}
for (const rule of ['dnd', 'moon-system']) {
  test(`${rule} implemented sintético sin adaptador o con identidad ajena se rechaza antes de mapa`, async () => {
    const h = harness(rule);
    delete h.options.rulesAdapter;
    await rejects(coordinatorModule.create(h.options).prepare(binding('ciudad-moderna', rule)), 'RULES_ADAPTER_MISSING');
    h.options.rulesAdapter = { id: 'foreign', rulesetId: rule, contract: 'blakpine-combat-adapter-v1', evaluate() {} };
    await rejects(coordinatorModule.create(h.options).prepare(binding('ciudad-moderna', rule)), 'RULES_ADAPTER_MISMATCH');
    assert.equal(h.loads(), 0);
    assert.ok(!h.reads.some(p => p.startsWith('forest-horror/')));
  });
}
test('sin selección devuelve Legacy sin invocar ningún puerto', async () => {
  const bomb = () => assert.fail('Dependencia invocada sin selección');
  for (const input of [null, undefined]) {
    assert.deepEqual(await selectionModule.readSelection(input, { readJson: bomb, validate: bomb }), { kind: 'legacy' });
    assert.deepEqual(await coordinatorModule.create({ readSelection: bomb,
      worldLoader: { prepare: bomb }, rulesAdapter: { evaluate: bomb } }).prepare(input), { kind: 'legacy' });
  }
});
test('mundo declarativo válido no equivale a sesión preparada ni inventa mapa', async () => {
  for (const world of worlds.slice(1)) {
    const h = harness('dnd');
    await rejects(coordinatorModule.create(h.options).prepare(binding(world, 'dnd')), 'WORLD_MAP_MISSING');
    assert.equal(h.loads(), 0);
    assert.ok(!h.reads.some(p => p.startsWith('forest-horror/')));
  }
});
test('versiones desconocidas en selección, mundo y reglamento fallan sin cargar escenario', async () => {
  for (const target of ['selection', 'worldProfile', 'rulesetManifest']) {
    const input = binding('ciudad-moderna', 'dnd');
    const h = harness('dnd', (p, data) => { if (p === input[target]) data.version = 99; });
    if (target === 'selection') input.version = 99;
    await rejects(coordinatorModule.create(h.options).prepare(input), 'SELECTION_FAILED', 'CONTRACT_INVALID');
    assert.equal(h.loads(), 0);
  }
});
test('referencias inseguras no llegan a IO; referencias inexistentes no caen a Legacy', async () => {
  for (const field of ['worldProfile', 'rulesetManifest']) {
    for (const ref of ['../escape.json', '/absolute.json', 'https://example.com/data.json']) {
      const input = { ...binding('ciudad-moderna', 'dnd'), [field]: ref };
      const h = harness('dnd');
      await rejects(coordinatorModule.create(h.options).prepare(input), 'SELECTION_FAILED', 'CONTRACT_INVALID');
      assert.ok(!h.reads.includes(ref));
    }
    const input = { ...binding('ciudad-moderna', 'dnd'), [field]: 'contratos/multimodo/ejemplos/missing.json' };
    await rejects(coordinatorModule.create({ readSelection: read }).prepare(input), 'SELECTION_FAILED', 'DOCUMENT_READ_FAILED');
  }
});
test('mapa inexistente o etiqueta desconocida falla a través de toda la cadena real', async () => {
  const h = harness('dnd', (p, data) => {
    if (p.endsWith('/ciudad-moderna.json')) data.map.path = 'forest-horror/maps/missing.json';
  });
  await rejects(coordinatorModule.create(h.options).prepare(binding('ciudad-moderna', 'dnd')),
    'WORLD_PREPARATION_FAILED', 'WORLD_MAP_READ_FAILED');
  const badMap = harness('dnd', (p, data) => { if (p.startsWith('forest-horror/')) data.schema = 'forest-horror-map-v99'; });
  await rejects(coordinatorModule.create(badMap.options).prepare(binding('ciudad-moderna', 'dnd')),
    'WORLD_PREPARATION_FAILED', 'WORLD_MAP_SCHEMA_INVALID');
});
test('sesiones DnD y Moon intercaladas no comparten descripciones, manifiestos ni namespaces', async () => {
  const a = harness('dnd'), b = harness('moon-system');
  const [dnd, moon] = await Promise.all([
    coordinatorModule.create(a.options).prepare(binding('ciudad-moderna', 'dnd')),
    coordinatorModule.create(b.options).prepare(binding('ciudad-moderna', 'moon-system'))
  ]);
  assert.equal(dnd.mode.rulesetManifest.statsNamespace, 'dnd');
  assert.equal(moon.mode.rulesetManifest.statsNamespace, 'moon-system');
  assert.notEqual(dnd.worldDescription.scenario.data, moon.worldDescription.scenario.data);
  assert.throws(() => { dnd.mode.rulesetManifest.statsNamespace = 'moon-system'; }, TypeError);
  assert.equal((await read(binding('ciudad-moderna', 'dnd'))).rulesetManifest.status, 'planned');
});
