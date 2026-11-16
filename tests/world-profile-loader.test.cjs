'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { create } = require('../juego/worlds/fh-world-profile-loader.js');
const { readSelection } = require('../juego/core/fh-mode-selection.js');
const { create: createCoordinator } = require('../juego/core/fh-session-coordinator.js');
const root = path.resolve(__dirname, '..');
const readJson = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const profile = id => readJson(`contratos/multimodo/ejemplos/mundos/${id}.json`);
// Mismo validador canónico que el CLI, sin ejecutar el recorrido ni copiar su lógica.
const source = fs.readFileSync(path.join(root, 'contratos/multimodo/validar-contratos.mjs'), 'utf8');
const validator = vm.runInNewContext(
  source.slice(source.indexOf('function matchesType'), source.indexOf('const refs =')) + '\nvalidate',
  { assert(condition, message) { assert.ok(condition, message); } }
);
const validate = (data, schema) => { validator(data, schema); return true; };
const loader = create({ readJson, validate });
const rejectsCode = (promise, code) => assert.rejects(promise, error => error.code === code);

test('los tres perfiles conservan identidad, ambiente y cuatro grupos declarativos', async () => {
  for (const id of ['ciudad-moderna', 'distopia', 'villa-medieval']) {
    const input = profile(id);
    const result = await loader.prepare(input);
    assert.equal(result.kind, 'world-profile-description');
    assert.deepEqual(result.profile, input);
    assert.equal(result.profile.id, id);
    assert.deepEqual(result.capabilities, input.extensions['blakpine.world-capabilities.v1']);
    for (const group of ['architecture', 'paths', 'materials', 'services']) {
      assert.ok(Array.isArray(result.capabilities[group]));
      assert.ok(Object.isFrozen(result.capabilities[group]));
    }
    assert.ok(Object.isFrozen(result));
  }
});

test('moderno valida y conserva mapa real completo y unidades sin conversiones', async () => {
  const input = profile('ciudad-moderna');
  const original = readJson(input.map.path);
  const result = await loader.prepare(input);
  assert.equal(result.scenario.status, 'map-available');
  assert.deepEqual(result.scenario.reference, input.map);
  assert.deepEqual(result.scenario.data, original);
  assert.deepEqual(result.scenario.data.units, original.units);
  assert.equal(result.scenario.data.units.feetPerCell, 5);
  assert.equal(result.scenario.data.units.metersPerCell, 1.524);
  assert.ok(Object.isFrozen(result.scenario.data.units.originPx));
});

test('sin mapa devuelve configuración válida declarativa sin consultar mapas ni reglas', async () => {
  for (const id of ['distopia', 'villa-medieval']) {
    const paths = [];
    const result = await create({ readJson(p) { paths.push(p); return readJson(p); }, validate }).prepare(profile(id));
    assert.deepEqual(result.scenario, { status: 'declarative-only' });
    assert.deepEqual(paths, ['contratos/multimodo/v1/perfil-mundo.schema.json']);
  }
});

test('extensión opcional ausente no inventa capacidades; desconocidas siguen siendo datos', async () => {
  const input = profile('distopia');
  input.extensions = { 'example.metadata.v1': { declarative: true } };
  const result = await loader.prepare(input);
  assert.equal(result.capabilities, null);
  assert.deepEqual(result.profile.extensions, input.extensions);
  delete input.extensions;
  assert.equal((await loader.prepare(input)).capabilities, null);
});

test('esquema canónico rechaza perfil/version/tipos/capacidades inválidos antes de mapa', async () => {
  const badInputs = [null, {}, { ...profile('ciudad-moderna'), version: 3 },
    { ...profile('ciudad-moderna'), rulesetManifest: 'rules.json' }];
  for (const bad of [false, ['stone', 'stone'], ['Bad ID']]) {
    const input = profile('ciudad-moderna');
    input.extensions['blakpine.world-capabilities.v1'].materials = bad;
    badInputs.push(input);
  }
  for (const input of badInputs) {
    const paths = [];
    await rejectsCode(create({ readJson(p) { paths.push(p); return readJson(p); }, validate }).prepare(input), 'PROFILE_INVALID');
    assert.deepEqual(paths, ['contratos/multimodo/v1/perfil-mundo.schema.json']);
  }
});

test('rutas inválidas nunca llegan al lector de mapas', async () => {
  for (const unsafe of ['../map.json', '/tmp/map.json', 'a/../map.json', 'https://example/map.json',
    'a\\map.json', 'a/%2e%2e/map.json', 'map.js', './map.json']) {
    const input = profile('ciudad-moderna');
    input.map.path = unsafe;
    const paths = [];
    await rejectsCode(create({ readJson(p) { paths.push(p); return readJson(p); }, validate }).prepare(input), 'PROFILE_INVALID');
    assert.deepEqual(paths, ['contratos/multimodo/v1/perfil-mundo.schema.json']);
  }
});

test('referencia inexistente, JSON roto o escape rechazado por IO nunca se ofrecen como mapa', async () => {
  for (const reason of [new Error('ENOENT'), new SyntaxError('invalid JSON'), new Error('outside root')]) {
    const failReader = p => { if (p.startsWith('forest-horror/')) throw reason; return readJson(p); };
    await assert.rejects(create({ readJson: failReader, validate }).prepare(profile('ciudad-moderna')),
      error => error.code === 'WORLD_MAP_READ_FAILED' && error.cause === reason);
  }
});

test('mapa de otro esquema o tipo se rechaza sin fallback', async () => {
  for (const map of [{ schema: 'other-v1' }, {}, null, [], 'forest-horror-map-v1']) {
    await rejectsCode(create({ readJson: p => p.startsWith('forest-horror/') ? map : readJson(p), validate })
      .prepare(profile('ciudad-moderna')), 'WORLD_MAP_SCHEMA_INVALID');
  }
});

test('unidades especiales o ausentes se conservan sin valores predeterminados', async () => {
  for (const map of [{ schema: 'forest-horror-map-v1', units: { feetPerCell: 7, metersPerCell: 2.1336, custom: 'retained' } },
    { schema: 'forest-horror-map-v1' }]) {
    const result = await create({ readJson: p => p.startsWith('forest-horror/') ? map : readJson(p), validate })
      .prepare(profile('ciudad-moderna'));
    assert.deepEqual(result.scenario.data, map);
    assert.equal(Object.hasOwn(result.scenario.data, 'units'), Object.hasOwn(map, 'units'));
  }
});

test('copias aíslan perfil, extensión y mapa incluso frente a cambios durante la validación', async () => {
  const input = profile('ciudad-moderna');
  const map = readJson(input.map.path);
  const result = await create({
    readJson: p => p.startsWith('forest-horror/') ? map : readJson(p),
    async validate(data, schema) {
      input.map.path = '../changed.json';
      input.extensions['blakpine.world-capabilities.v1'].architecture.push('changed');
      return validate(data, schema);
    }
  }).prepare(input);
  map.units.feetPerCell = 999;
  assert.equal(result.scenario.data.units.feetPerCell, 5);
  assert.equal(result.profile.map.path, 'forest-horror/maps/DEMO_Interacciones.json');
  assert.ok(!result.capabilities.architecture.includes('changed'));
  assert.throws(() => result.capabilities.architecture.push('changed'), TypeError);
});

test('dependencias, errores de esquema, rechazo asíncrono y datos no JSON son controlados', async () => {
  await rejectsCode(create().prepare(profile('distopia')), 'WORLD_LOADER_DEPENDENCIES_MISSING');
  await rejectsCode(create({ readJson: () => { throw Error('missing schema'); }, validate }).prepare(profile('distopia')), 'PROFILE_SCHEMA_READ_FAILED');
  for (const rejection of [false, undefined]) {
    await rejectsCode(create({ readJson, validate: async () => rejection }).prepare(profile('distopia')), 'PROFILE_INVALID');
  }
  await rejectsCode(create({ readJson, validate: async () => { throw Error('schema'); } }).prepare(profile('distopia')), 'PROFILE_INVALID');
  const cycle = {}; cycle.self = cycle;
  for (const bad of [new Date(), cycle, { ...profile('distopia'), extra() {} }]) {
    await rejectsCode(loader.prepare(bad), 'PROFILE_DATA_INVALID');
  }
  await rejectsCode(create({ readJson: p => p.startsWith('forest-horror/') ? { schema: 'forest-horror-map-v1', live: new Date() } : readJson(p), validate })
    .prepare(profile('ciudad-moderna')), 'WORLD_MAP_READ_FAILED');
});

test('IA 2 consume cargador real con adaptador sintético; planned y falta mapa siguen bloqueados', async () => {
  const selection = readJson('contratos/multimodo/ejemplos/selecciones/moderno-dnd.json');
  const fixtureReader = p => {
    const value = readJson(p);
    if (p === selection.rulesetManifest) value.status = 'implemented'; // Solo fixture de prueba.
    return value;
  };
  const coordinator = createCoordinator({
    readSelection: input => readSelection(input, { readJson: fixtureReader, validate }),
    worldLoader: loader,
    rulesAdapter: { ...readJson(selection.rulesetManifest).adapter, rulesetId: 'dnd', evaluate() { assert.fail('No debe evaluar'); } }
  });
  const result = await coordinator.prepare(selection);
  assert.equal(result.kind, 'prepared');
  assert.equal(result.worldDescription.scenario.status, 'map-available');
  assert.equal(result.worldDescription.profile.id, 'ciudad-moderna');
  await rejectsCode(coordinator.prepare({ ...selection, worldProfile: 'contratos/multimodo/ejemplos/mundos/distopia.json' }), 'WORLD_MAP_MISSING');
  const official = createCoordinator({ readSelection: input => readSelection(input, { readJson, validate }), worldLoader: loader });
  await rejectsCode(official.prepare(selection), 'RULESET_NOT_IMPLEMENTED');
});

test('script clásico carga y lee perfil sin DOM/Three/require ni acceso implícito a almacenamiento', async () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(root, 'juego/worlds/fh-world-profile-loader.js'), 'utf8'), context);
  context.readJSONText = p => JSON.stringify(readJson(p));
  context.validate = validate;
  // El perfil se parsea en su propio contexto, como ocurriría en un script clásico.
  context.profileJSON = JSON.stringify(profile('distopia'));
  const result = await vm.runInContext('FHWorldProfileLoader.create({readJson: p => JSON.parse(readJSONText(p)), validate}).prepare(JSON.parse(profileJSON))', context);
  assert.equal(result.scenario.status, 'declarative-only');
});
