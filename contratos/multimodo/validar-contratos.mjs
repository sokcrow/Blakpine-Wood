#!/usr/bin/env node
// Validador estático de contratos multimodo. Sin paquetes externos ni arranque del juego.
import { readFileSync, existsSync, readdirSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, isAbsolute, sep } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const realRepoRoot = realpathSync(repoRoot);
let checks = 0;
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks++;
}
function isInsideRoot(root, target) {
  const result = relative(root, target);
  return result !== '..' && !result.startsWith('..' + sep) && !isAbsolute(result);
}
function safePath(path) {
  assert(typeof path === 'string' && path.length > 0, 'Ruta vacía');
  assert(!isAbsolute(path) && !path.includes('\\'), 'Ruta absoluta o separador inválido: ' + path);
  assert(path.split('/').every(p => /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(p)),
    'Segmento de ruta inválido: ' + path);
  const absolute = resolve(repoRoot, path);
  assert(isInsideRoot(repoRoot, absolute), 'Ruta fuera de repositorio: ' + path);
  if (existsSync(absolute)) {
    assert(isInsideRoot(realRepoRoot, realpathSync(absolute)), 'Enlace fuera del repositorio: ' + path);
  }
  return absolute;
}
function load(path) {
  const absolute = safePath(path);
  assert(existsSync(absolute), 'Archivo no encontrado: ' + path);
  return JSON.parse(readFileSync(absolute, 'utf8'));
}
function matchesType(value, type) {
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'array') return Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  return typeof value === type;
}
// Solo las palabras clave efectivamente utilizadas por nuestros tres esquemas.
function validate(value, schema, where = '$') {
  if (Object.hasOwn(schema, 'const')) assert(value === schema.const, where + ': const inválida');
  if (schema.enum) assert(schema.enum.includes(value), where + ': enum inválida');
  if (schema.type) assert(matchesType(value, schema.type), where + ': tipo incorrecto');
  if (schema.type === 'string') {
    if (schema.minLength != null) assert(value.length >= schema.minLength, where + ': cadena vacía');
    if (schema.pattern) assert(new RegExp(schema.pattern).test(value), where + ': patrón inválido');
  }
  if (schema.type === 'object') {
    for (const key of schema.required || []) assert(Object.hasOwn(value, key), where + ': falta ' + key);
    for (const [key, child] of Object.entries(value)) {
      if (!Object.hasOwn(schema.properties || {}, key)) {
        assert(schema.additionalProperties !== false, where + ': campo no permitido ' + key);
      } else validate(child, schema.properties[key], where + '.' + key);
    }
  }
  if (schema.type === 'array') {
    if (schema.uniqueItems) assert(new Set(value.map(v => JSON.stringify(v))).size === value.length, where + ': repetidos');
    if (schema.items) value.forEach((item, i) => validate(item, schema.items, where + '[' + i + ']'));
  }
}
const refs = {
  'blakpine-world-profile-v1': load('contratos/multimodo/v1/perfil-mundo.schema.json'),
  'blakpine-ruleset-manifest-v1': load('contratos/multimodo/v1/manifiesto-reglas.schema.json'),
  'blakpine-mode-selection-v1': load('contratos/multimodo/v1/seleccion-modo.schema.json')
};
for (const [kind, schema] of Object.entries(refs)) {
  assert(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', kind + ': dialécto JSON Schema');
  assert(schema.properties.kind.const === kind, kind + ': esquema incoherente');
}
const examplesRoot = 'contratos/multimodo/ejemplos/';
const worldIds = ['ciudad-moderna', 'distopia', 'villa-medieval'];
const ruleIds = ['legacy', 'dnd', 'moon-system'];
const selectionIds = ['moderno-dnd', 'distopia-moon', 'medieval-legacy'];
const worlds = worldIds.map(id => examplesRoot + 'mundos/' + id + '.json');
const rulesets = ruleIds.map(id => examplesRoot + 'reglas/' + id + '.json');
const selections = selectionIds.map(id => examplesRoot + 'selecciones/' + id + '.json');

function assertOnlyExamples(dir, ids) {
  const actual = readdirSync(safePath(examplesRoot + dir)).filter(name => name.endsWith('.json')).sort();
  const expected = ids.map(id => id + '.json').sort();
  assert(JSON.stringify(actual) === JSON.stringify(expected),
    'Ejemplos inesperados u obsoletos en ' + dir + ': ' + actual.join(', '));
}
assertOnlyExamples('mundos', worldIds);
assertOnlyExamples('reglas', ruleIds);
assertOnlyExamples('selecciones', selectionIds);
for (const obsolete of ['reglas/tercer-sistema-pendiente.json', 'selecciones/medieval-tercero.json']) {
  assert(!existsSync(safePath(examplesRoot + obsolete)), 'Referencia obsoleta: ' + obsolete);
}
const ids = new Set();
const adapterIds = new Map();
const statsNamespaces = new Map();
function assertUniqueRuleIdentity(registry, value, ruleId, description) {
  if (value == null) return;
  assert(!registry.has(value),
    description + ' duplicado entre ' + registry.get(value) + ' y ' + ruleId + ': ' + value);
  registry.set(value, ruleId);
}
for (const path of [...worlds, ...rulesets]) {
  const doc = load(path);
  validate(doc, refs[doc.kind], path);
  assert(!ids.has(doc.kind + ':' + doc.id), 'ID duplicado: ' + doc.id);
  ids.add(doc.kind + ':' + doc.id);
  if (doc.kind === 'blakpine-world-profile-v1') {
    assert(!Object.hasOwn(doc, 'rulesetManifest') && !Object.hasOwn(doc, 'rulesets'),
      'El perfil no debe imponer reglamentos: ' + path);
    if (doc.map) {
      const map = load(doc.map.path);
      assert(map.schema === 'forest-horror-map-v1', 'Formato heredado incompatible: ' + doc.map.path);
    }
  }
  if (doc.kind === 'blakpine-ruleset-manifest-v1') {
    assertUniqueRuleIdentity(adapterIds, doc.adapter?.id, doc.id, 'ID de adaptador');
    assertUniqueRuleIdentity(statsNamespaces, doc.statsNamespace, doc.id, 'statsNamespace');
    assert(ruleIds.includes(doc.id) && path.endsWith('/' + doc.id + '.json'),
      'ID de reglamento ajeno a Legacy, DnD y Moon: ' + path);
    assert(doc.status === (doc.id === 'dnd' ? 'implemented' : 'planned'),
      'Estado de implementación no autorizado: ' + doc.id);
    if (doc.id === 'legacy') {
      assert(!Object.hasOwn(doc, 'adapter'), 'Legacy no tiene adaptador multimodo implementado');
    } else {
      assert(doc.adapter?.contract === 'blakpine-combat-adapter-v1',
        'Contrato simbólico de adaptador inválido: ' + doc.id);
    }
  }
}
const verifyBinding = binding => {
  validate(binding, refs['blakpine-mode-selection-v1']);
  const world = load(binding.worldProfile);
  const rules = load(binding.rulesetManifest);
  assert(world.kind === 'blakpine-world-profile-v1', 'Referencia de mundo errónea');
  assert(rules.kind === 'blakpine-ruleset-manifest-v1', 'Referencia de reglas errónea');
};
const expectedSelections = [
  {path: selections[0], worldProfile: worlds[0], rulesetManifest: rulesets[1]},
  {path: selections[1], worldProfile: worlds[1], rulesetManifest: rulesets[2]},
  {path: selections[2], worldProfile: worlds[2], rulesetManifest: rulesets[0]}
];
for (const {path, worldProfile, rulesetManifest} of expectedSelections) {
  const selection = load(path);
  verifyBinding(selection);
  assert(selection.worldProfile === worldProfile && selection.rulesetManifest === rulesetManifest,
    'Selección de ejemplo incorrecta: ' + path);
}
for (const worldProfile of worlds) for (const rulesetManifest of rulesets) {
  verifyBinding({
    kind: 'blakpine-mode-selection-v1',
    version: 1,
    worldProfile, rulesetManifest
  });
}
console.log('PASS: ' + checks + ' aserciones estructurales; 3 mundos, 3 reglamentos y 9 combinaciones.');
console.log('LEGACY: combate nativo conservado; manifiesto declarativo planned.');
console.log('DND: contrato implementado para combate y persistencia; no equivale a nueve modos jugables.');
console.log('PENDIENTE: Moon System y mundos sin mapa.');
