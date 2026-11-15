'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve, sep } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = resolve(__dirname, '..');
const contracts = 'contratos/multimodo';
const examples = `${contracts}/ejemplos`;
const worldDir = `${examples}/mundos`;
const rulesDir = `${examples}/reglas`;
const selectionDir = `${examples}/selecciones`;
const worldFiles = ['ciudad-moderna.json', 'distopia.json', 'villa-medieval.json'];
const rulesFiles = ['dnd.json', 'legacy.json', 'moon-system.json'];
const selectionFiles = ['distopia-moon.json', 'medieval-legacy.json', 'moderno-dnd.json'];
const schemaFiles = [
  `${contracts}/v1/perfil-mundo.schema.json`,
  `${contracts}/v1/manifiesto-reglas.schema.json`,
  `${contracts}/v1/seleccion-modo.schema.json`
];
const worldKind = 'blakpine-world-profile-v1';
const rulesKind = 'blakpine-ruleset-manifest-v1';
const selectionKind = 'blakpine-mode-selection-v1';

function readJson(file) {
  const absolute = resolve(root, file);
  assert.ok(absolute.startsWith(root + sep), `Ruta fuera del repositorio: ${file}`);
  assert.ok(!file.includes('\\') && !file.split('/').includes('..'), `Ruta inválida: ${file}`);
  try {
    return JSON.parse(readFileSync(absolute, 'utf8'));
  } catch (error) {
    throw new Error(`JSON inválido o inexistente: ${file}: ${error.message}`, { cause: error });
  }
}

function jsonNames(dir) {
  return readdirSync(resolve(root, dir)).filter(name => name.endsWith('.json')).sort();
}

function entries(dir, names) {
  return names.map(name => ({ file: `${dir}/${name}`, data: readJson(`${dir}/${name}`) }));
}

function assertUniqueIds(documents) {
  const seen = new Set();
  for (const { file, data } of documents) {
    assert.match(data.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${file}: ID inválido`);
    assert.ok(!seen.has(data.id), `${file}: ID repetido: ${data.id}`);
    seen.add(data.id);
    assert.equal(data.id, file.slice(file.lastIndexOf('/') + 1, -'.json'.length), `${file}: ID y archivo distintos`);
  }
}

function propertyTokens(key) {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/);
}

function assertNoKeys(document, forbidden, location) {
  if (!document || typeof document !== 'object') return;
  if (Array.isArray(document)) {
    document.forEach((item, index) => assertNoKeys(item, forbidden, `${location}[${index}]`));
    return;
  }
  for (const [key, value] of Object.entries(document)) {
    assert.ok(
      propertyTokens(key).every(token => !forbidden.has(token)),
      `${location}.${key}: campo fuera de su responsabilidad`
    );
    assertNoKeys(value, forbidden, `${location}.${key}`);
  }
}

const combatBindings = new Set(['combat', 'ruleset', 'rulesets', 'adapter', 'battle']);
const spatialFields = new Set([
  'map', 'mapa', 'world', 'geometry', 'geometria', 'terrain', 'walls', 'wall',
  'doors', 'door', 'collision', 'collisions', 'collider', 'colliders', 'physics',
  'navigation', 'visibility', 'position', 'positions', 'coordinates', 'transform',
  'transforms', 'layout', 'mesh', 'meshes', 'structure', 'structures', 'spatial'
]);

test('existen exactamente tres mundos, tres manifiestos y tres selecciones oficiales', () => {
  assert.deepEqual(jsonNames(worldDir), worldFiles);
  assert.deepEqual(jsonNames(rulesDir), rulesFiles);
  assert.deepEqual(jsonNames(selectionDir), selectionFiles);
});

test('los tres esquemas y todos los ejemplos son JSON válido', () => {
  for (const file of schemaFiles) readJson(file);
  for (const [dir, names] of [
    [worldDir, worldFiles], [rulesDir, rulesFiles], [selectionDir, selectionFiles]
  ]) for (const name of names) readJson(`${dir}/${name}`);
});

test('los seis perfiles y reglamentos tienen IDs únicos y corresponden a sus archivos', () => {
  const worlds = entries(worldDir, worldFiles);
  const rules = entries(rulesDir, rulesFiles);
  assertUniqueIds([...worlds, ...rules]);
  for (const { data } of worlds) {
    assert.equal(data.kind, worldKind);
    assert.equal(data.version, 1);
  }
  for (const { data } of rules) {
    assert.equal(data.kind, rulesKind);
    assert.equal(data.version, 1);
    assert.equal(data.domain, 'combat');
  }
});

test('ningún perfil de mundo exige ni selecciona un sistema de combate', () => {
  const schema = readJson(schemaFiles[0]);
  assert.equal(schema.properties.kind.const, worldKind);
  assert.ok((schema.required || []).every(key => !combatBindings.has(key)));
  assertNoKeys(schema.properties, combatBindings, schemaFiles[0]);
  for (const { file, data } of entries(worldDir, worldFiles)) {
    assert.ok(data.environment?.archetype && data.environment?.layoutProfile, file);
    assertNoKeys(data, combatBindings, file);
    if (data.map) {
      assert.equal(data.map.schema, 'forest-horror-map-v1', file);
      assert.equal(readJson(data.map.path).schema, 'forest-horror-map-v1', data.map.path);
    }
  }
});

test('los manifiestos se limitan al combate, sin cambios de geometría ni colisiones', () => {
  const schema = readJson(schemaFiles[1]);
  assert.equal(schema.properties.kind.const, rulesKind);
  assert.equal(schema.properties.domain.const, 'combat');
  assertNoKeys(schema.properties, spatialFields, schemaFiles[1]);
  for (const { file, data } of entries(rulesDir, rulesFiles)) {
    assertNoKeys(data, spatialFields, file);
    // En los manifiestos oficiales, solo se ha aprobado esta extensión descriptiva.
    // Impide que un bloque no auditado introduzca instrucciones espaciales encubiertas.
    if (data.extensions) {
      assert.deepEqual(Object.keys(data.extensions), ['blakpine.combat-scope.v1'], file);
      const scope = data.extensions['blakpine.combat-scope.v1'];
      assert.deepEqual(Object.keys(scope).sort(), ['combatResolution', 'generalSkills'], file);
      for (const value of Object.values(scope)) assert.equal(typeof value, 'string', file);
    }
    assert.equal(data.status, 'planned', `${file}: integración aún no implementada`);
    if (data.id === 'legacy') {
      assert.equal(data.adapter, undefined, 'Legacy no debe anunciar un adaptador nuevo');
    } else {
      assert.equal(data.adapter?.contract, 'blakpine-combat-adapter-v1', file);
    }
  }
  assert.throws(
    () => assertNoKeys({ extensions: { extra: { geometryOverrides: { walls: [] } } } }, spatialFields, 'ejemplo'),
    /geometryOverrides/
  );
});

test('las selecciones enlazan archivos independientes de mundo y reglas', () => {
  const schema = readJson(schemaFiles[2]);
  assert.equal(schema.properties.kind.const, selectionKind);
  const expected = new Map([
    ['moderno-dnd.json', ['ciudad-moderna', 'dnd']],
    ['distopia-moon.json', ['distopia', 'moon-system']],
    ['medieval-legacy.json', ['villa-medieval', 'legacy']]
  ]);
  for (const { file, data } of entries(selectionDir, selectionFiles)) {
    assert.equal(data.kind, selectionKind, file);
    assert.equal(data.version, 1, file);
    const world = readJson(data.worldProfile);
    const rules = readJson(data.rulesetManifest);
    assert.equal(world.kind, worldKind, file);
    assert.equal(rules.kind, rulesKind, file);
    assert.deepEqual([world.id, rules.id], expected.get(file.split('/').pop()), file);
  }
});

test('los perfiles admiten nueve combinaciones estructurales sin acoplar sus archivos', () => {
  const worlds = entries(worldDir, worldFiles);
  const rules = entries(rulesDir, rulesFiles);
  const combinations = new Set();
  for (const world of worlds) for (const ruleset of rules) {
    assertNoKeys(world.data, combatBindings, world.file);
    assertNoKeys(ruleset.data, spatialFields, ruleset.file);
    combinations.add(`${world.data.id}:${ruleset.data.id}`);
  }
  assert.equal(combinations.size, 9);
});

test('el validador oficial aprueba los contratos y referencias de las nueve combinaciones', () => {
  const script = resolve(root, contracts, 'validar-contratos.mjs');
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: 'utf8',
    timeout: 15000
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${result.stdout || ''}\n${result.stderr || ''}`);
  assert.match(result.stdout, /PASS:.*3 mundos, 3 reglamentos y 9 combinaciones/);
});
