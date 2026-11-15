#!/usr/bin/env node
// Validador estático de contratos multimodo. Sin paquetes externos ni arranque del juego.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, isAbsolute, sep } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const rel = 'contratos/multimodo';
let checks = 0;
function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks++;
}
function safePath(path) {
  assert(typeof path === 'string' && path.length > 0, 'Ruta vacía');
  assert(!isAbsolute(path) && !path.includes('\\'), 'Ruta absoluta o separador inválido: ' + path);
  assert(path.split('/').every(p => p !== '..' && p !== '.' && p !== ''), 'Ruta fuera de repositorio: ' + path);
  const absolute = resolve(repoRoot, path);
  assert(!relative(repoRoot, absolute).startsWith('..' + sep), 'Ruta externa: ' + path);
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
const worlds = [
 'ciudad-moderna', 'distopia', 'villa-medieval'
].map(id => 'contratos/multimodo/ejemplos/mundos/' + id + '.json');
const rulesets = [
 'dnd', 'moon-system', 'tercer-sistema-pendiente'
].map(id => 'contratos/multimodo/ejemplos/reglas/' + id + '.json');
const selections = [
 'moderno-dnd', 'distopia-moon', 'medieval-tercero'
].map(id => 'contratos/multimodo/ejemplos/selecciones/' + id + '.json');
const ids = new Set();
for (const path of [...worlds, ...rulesets]) {
  const doc = load(path);
  validate(doc, refs[doc.kind], path);
  assert(!ids.has(doc.kind + ':' + doc.id), 'ID duplicado: ' + doc.id);
  ids.add(doc.kind + ':' + doc.id);
  if (doc.kind === 'blakpine-world-profile-v1' && doc.map) {
    const map = load(doc.map.path);
    assert(map.schema === 'forest-horror-map-v1', 'Formato heredado incompatible: ' + doc.map.path);
  }
  if (doc.kind === 'blakpine-ruleset-manifest-v1' && doc.status === 'reserved') {
    assert(!doc.adapter, 'Un reglamento reservado no puede declarar adaptador operativo');
  }
}
const verifyBinding = binding => {
  validate(binding, refs['blakpine-mode-selection-v1']);
  const world = load(binding.worldProfile);
  const rules = load(binding.rulesetManifest);
  assert(world.kind === 'blakpine-world-profile-v1', 'Referencia de mundo errónea');
  assert(rules.kind === 'blakpine-ruleset-manifest-v1', 'Referencia de reglas errónea');
};
for (const path of selections) verifyBinding(load(path));
for (const worldProfile of worlds) for (const rulesetManifest of rulesets) {
  verifyBinding({
    kind: 'blakpine-mode-selection-v1',
    version: 1,
    worldProfile, rulesetManifest
  });
}
console.log('PASS: ' + checks + ' aserciones estructurales; 3 mundos, 3 reglamentos y 9 combinaciones.');
console.log('NOTA: no se ejecutó el juego; "planned" y "reserved" no implican adaptadores operativos.');
