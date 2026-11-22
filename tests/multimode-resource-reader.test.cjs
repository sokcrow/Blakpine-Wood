'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { createNode } = require('../juego/core/fh-multimode-resource-reader.js');
const { readSelection } = require('../juego/core/fh-mode-selection.js');
const { create: worldLoader } = require('../juego/worlds/fh-world-profile-loader.js');
const { create: coordinator } = require('../juego/core/fh-session-coordinator.js');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'contratos/multimodo/validar-contratos.mjs'), 'utf8');
// Reutilizar el validador canónico, sin copiar su implementación ni ejecutar su CLI.
const canonicalValidate = vm.runInNewContext(
  source.slice(source.indexOf('function matchesType'), source.indexOf('const refs =')) + '\nvalidate',
  { assert: (condition, message) => assert.ok(condition, message) }
);
const validate = (data, schema) => { canonicalValidate(data, schema); return true; };
const editor = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const start = editor.indexOf('const ForestShared=(()=>{');
const mapValidator = vm.runInNewContext(editor.slice(start, editor.indexOf("\n'use strict';", start)) + '\nForestShared.validate');
const validateMap = data => mapValidator(data).ok;
const worldPath = id => `contratos/multimodo/ejemplos/mundos/${id}.json`;
const rulePath = id => `contratos/multimodo/ejemplos/reglas/${id}.json`;
const selectionPath = id => `contratos/multimodo/ejemplos/selecciones/${id}.json`;
const mapPath = 'forest-horror/maps/DEMO_Interacciones.json';
const medievalPath = 'forest-horror/maps/DEMO_DnD_Iluminacion.json';
const resources = Object.fromEntries([
  ...['ciudad-moderna', 'distopia', 'villa-medieval'].map(id => [worldPath(id), 'world']),
  ...['legacy', 'dnd', 'moon-system'].map(id => [rulePath(id), 'rules']),
  ...['moderno-dnd', 'distopia-moon', 'medieval-legacy'].map(id => [selectionPath(id), 'selection']),
  [mapPath, 'map'],[medievalPath, 'map']
]);
const reader = options => createNode({ root, resources, validate, validateMap, ...options });
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);
function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fh-resources-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  fs.cpSync(path.join(root, 'contratos'), path.join(temp, 'contratos'), { recursive: true });
  fs.mkdirSync(path.join(temp, 'forest-horror/maps'), { recursive: true });
  fs.copyFileSync(path.join(root, mapPath), path.join(temp, mapPath));
  fs.copyFileSync(path.join(root, medievalPath), path.join(temp, medievalPath));
  const edit = (name, change) => {
    const file = path.join(temp, name), data = JSON.parse(fs.readFileSync(file, 'utf8'));
    change(data); fs.writeFileSync(file, JSON.stringify(data));
  };
  return { temp, edit, io: reader({ root: temp }) };
}

test('los tres perfiles y nueve pares conservan los documentos oficiales sin modificación', async () => {
  const io = reader();
  const loader = worldLoader(io);
  for (const world of ['ciudad-moderna', 'distopia', 'villa-medieval']) {
    const original = JSON.parse(fs.readFileSync(path.join(root, worldPath(world)), 'utf8'));
    assert.deepEqual(await io.readJson(worldPath(world)), original);
    const description = await loader.prepare(original);
    assert.deepEqual(description.profile, original);
    if (world === 'ciudad-moderna'||world==='villa-medieval')
      assert.deepEqual(description.scenario.data,
       JSON.parse(fs.readFileSync(path.join(root,world==='villa-medieval'?medievalPath:mapPath),'utf8')));
    else assert.equal(description.scenario.status,'declarative-only');
    for (const rules of ['legacy', 'dnd', 'moon-system']) {
      const binding = { kind: 'blakpine-mode-selection-v1', version: 1,
        worldProfile: worldPath(world), rulesetManifest: rulePath(rules) };
      const result = await readSelection(binding, io);
      assert.equal(result.worldProfile.id, world);
      assert.equal(result.rulesetManifest.id, rules);
    }
  }
  for (const id of ['moderno-dnd', 'distopia-moon', 'medieval-legacy']) {
    const selection = await io.readJson(selectionPath(id));
    assert.equal((await readSelection(selection, io)).kind, 'multimode');
  }
});

test('rutas absolutas, traversal, URLs, encoding y separadores ambiguos se rechazan', async () => {
  const io = reader();
  for (const name of ['/etc/passwd', '../secret.json', 'a/../secret.json', './a.json',
    'C:/x.json', 'C:\\x.json', '\\\\server\\a.json', 'https://example.test/a.json',
    'file:///tmp/a.json', 'a/%2e%2e/x.json', 'a/%252e%252e/x.json', 'a//x.json',
    'a.json?x', 'a.json#x', 'a\0.json', 'a.json\n', '', null, 'a/./x.json']) {
    await rejects(io.readJson(name), 'RESOURCE_PATH_INVALID');
  }
});

test('archivo JSON existente no autorizado y referencias no autorizadas no se leen', async t => {
  const { temp, io, edit } = fixture(t);
  fs.writeFileSync(path.join(temp, 'secret.json'), '{}');
  await rejects(io.readJson('secret.json'), 'RESOURCE_NOT_AUTHORIZED');
  edit(worldPath('ciudad-moderna'), data => { data.map.path = 'secret.json'; });
  await rejects(io.readJson(worldPath('ciudad-moderna')), 'RESOURCE_REFERENCE_NOT_AUTHORIZED');
  edit(selectionPath('moderno-dnd'), data => { data.worldProfile = rulePath('dnd'); });
  await rejects(io.readJson(selectionPath('moderno-dnd')), 'RESOURCE_REFERENCE_NOT_AUTHORIZED');
});

test('la lista autorizada se copia y no se amplía desde el llamador', async () => {
  const allowed = { [worldPath('distopia')]: 'world' };
  const io = reader({ resources: allowed }); allowed[rulePath('dnd')] = 'rules';
  await rejects(io.readJson(rulePath('dnd')), 'RESOURCE_NOT_AUTHORIZED');
});

test('enlaces finales internos o externos se rechazan, incluso a JSON válido', async t => {
  for (const internal of [true, false]) {
    const { temp, io } = fixture(t);
    const file = path.join(temp, worldPath('distopia'));
    const target = internal ? path.join(temp, worldPath('villa-medieval')) : path.join(root, worldPath('distopia'));
    fs.unlinkSync(file); fs.symlinkSync(target, file);
    await rejects(io.readJson(worldPath('distopia')), 'RESOURCE_SYMLINK_REJECTED');
  }
});

test('symlink de directorio no escapa a raíz ni a un directorio hermano con prefijo igual', async t => {
  const { temp, io } = fixture(t);
  const sibling = temp + '-outside';
  t.after(() => fs.rmSync(sibling, { recursive: true, force: true }));
  fs.cpSync(path.join(temp, 'contratos/multimodo/ejemplos/mundos'), sibling, { recursive: true });
  const dir = path.join(temp, 'contratos/multimodo/ejemplos/mundos');
  fs.rmSync(dir, { recursive: true }); fs.symlinkSync(sibling, dir);
  await rejects(io.readJson(worldPath('distopia')), 'RESOURCE_SYMLINK_REJECTED');
});

test('archivo autorizado inexistente, directorio, JSON inválido y UTF-8 inválido fallan', async t => {
  const { temp, io } = fixture(t);
  const file = path.join(temp, worldPath('distopia'));
  fs.unlinkSync(file);
  await rejects(io.readJson(worldPath('distopia')), 'RESOURCE_NOT_FOUND');
  fs.mkdirSync(file);
  await rejects(io.readJson(worldPath('distopia')), 'RESOURCE_NOT_FILE');
  fs.rmdirSync(file);
  for (const bytes of ['{', 'null', '[]', Buffer.from([0xff])]) {
    fs.writeFileSync(file, bytes);
    await rejects(io.readJson(worldPath('distopia')), typeof bytes === 'string' && bytes !== '{'
      ? 'RESOURCE_DOCUMENT_INVALID' : 'RESOURCE_JSON_INVALID');
  }
  fs.writeFileSync(file, '{"bad":1e999}');
  await rejects(io.readJson(worldPath('distopia')), 'RESOURCE_JSON_INVALID');
});

test('esquemas canónicos rechazan documentos incorrectos y versiones desconocidas', async t => {
  const { io, edit } = fixture(t);
  edit(worldPath('distopia'), data => { data.version = 2; });
  await rejects(io.readJson(worldPath('distopia')), 'RESOURCE_VERSION_UNSUPPORTED');
  edit(rulePath('dnd'), data => { data.kind = 'wrong'; });
  await rejects(io.readJson(rulePath('dnd')), 'RESOURCE_DOCUMENT_INVALID');
  edit(selectionPath('moderno-dnd'), data => { data.extra = true; });
  await rejects(io.readJson(selectionPath('moderno-dnd')), 'RESOURCE_DOCUMENT_INVALID');
  edit(worldPath('villa-medieval'), data => { data.environment = {}; });
  await rejects(io.readJson(worldPath('villa-medieval')), 'RESOURCE_DOCUMENT_INVALID');
});

test('esquemas desconocidos e inválidos se rechazan antes de aprobar un documento', async t => {
  const { io, edit } = fixture(t);
  edit('contratos/multimodo/v1/perfil-mundo.schema.json', schema => { schema.properties.version.const = 9; });
  await rejects(io.readJson(worldPath('distopia')), 'RESOURCE_SCHEMA_INVALID');
});

test('mapas usan validador real sin migración y rechazan versión o contenido inválidos', async t => {
  const { io, edit } = fixture(t);
  edit(mapPath, data => { data.version = 99; });
  await rejects(io.readJson(mapPath), 'RESOURCE_VERSION_UNSUPPORTED');
  edit(mapPath, data => { data.version = 2; data.floors = []; });
  await rejects(io.readJson(mapPath), 'RESOURCE_DOCUMENT_INVALID');
});

test('límites de bytes, configuración y validadores ausentes no degradan la carga', async () => {
  await rejects(reader({ maxBytes: 10 }).readJson(worldPath('distopia')), 'RESOURCE_TOO_LARGE');
  for (const options of [{ root: '.' }, { root: '/not-existing-fh-root' }, { validate: null },
    { validateMap: null }, { resources: { '../escape.json': 'world' } },
    { resources: { 'foo.json': 'unknown' } }, { maxBytes: 0 }]) {
    assert.throws(() => reader(options));
  }
  await rejects(reader({ validate: () => false }).readJson(worldPath('distopia')), 'RESOURCE_DOCUMENT_INVALID');
  await rejects(reader({ validateMap: () => undefined }).readJson(mapPath), 'RESOURCE_DOCUMENT_INVALID');
});

test('fallo real de IO no activa Legacy ni otro mundo en los consumidores', async t => {
  const { temp, io } = fixture(t);
  const binding = await io.readJson(selectionPath('moderno-dnd'));
  fs.unlinkSync(path.join(temp, worldPath('ciudad-moderna')));
  await assert.rejects(readSelection(binding, io), error =>
    error.code === 'DOCUMENT_READ_FAILED' && error.cause.code === 'RESOURCE_NOT_FOUND');
  const session = coordinator({ readSelection: selection => readSelection(selection, io) });
  await assert.rejects(session.prepare(binding), error => error.code === 'SELECTION_FAILED');
  const mapProfile = JSON.parse(fs.readFileSync(path.join(root, worldPath('ciudad-moderna')), 'utf8'));
  fs.unlinkSync(path.join(temp, mapPath));
  await assert.rejects(worldLoader(io).prepare(mapProfile), error =>
    error.code === 'WORLD_MAP_READ_FAILED' && error.cause.code === 'RESOURCE_NOT_FOUND');
});

test('carga en navegador sin IO y rechaza createNode explícitamente', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(root, 'juego/core/fh-multimode-resource-reader.js'), 'utf8'), context);
  assert.throws(() => context.FHMultimodeResourceReader.createNode(), error => error.code === 'RESOURCE_NODE_LINUX_REQUIRED');
});

// HTTP simulado para ejecutar el script clásico en un contexto de navegador aislado.
// No demuestra despliegue HTTPS real ni inspecciona aliases/symlinks del servidor.
function browserFixture(fetchImpl, options = {}) {
  const calls = [];
  const context = vm.createContext({ window: {}, location: { origin: 'https://game.test' },
    URL, TextDecoder, Uint8Array, AbortController, setTimeout, clearTimeout, validate, validateMap,
    fetch: async (url, init) => { calls.push({ url, init }); return fetchImpl(url, init); }
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'juego/core/fh-multimode-resource-reader.js'), 'utf8'), context);
  for (const file of ['juego/core/fh-mode-selection.js', 'juego/worlds/fh-world-profile-loader.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  }
  return { calls, loader: context.FHWorldProfileLoader, selectionReader: context.FHModeSelection,
    io: vm.runInContext(`FHMultimodeResourceReader.createBrowser({
    ...${JSON.stringify({ baseURL: 'https://game.test/repo/', resources, ...options })}, validate, validateMap
  })`, context) };
}
function response(url, body, options = {}) {
  const result = new Response(body, { headers: { 'content-type': 'application/json', ...options.headers },
    status: options.status || 200 });
  Object.defineProperty(result, 'url', { value: options.url || url });
  if (options.redirected) Object.defineProperty(result, 'redirected', { value: true });
  return result;
}
const published = url => response(url, fs.readFileSync(path.join(root, new URL(url).pathname.slice('/repo/'.length))));

test('navegador lee perfiles oficiales con HTTPS de raíz fija y validadores canónicos', async () => {
  const { io, calls, loader, selectionReader } = browserFixture(published);
  for (const world of ['ciudad-moderna', 'distopia', 'villa-medieval']) {
    const profile = await io.readJson(worldPath(world));
    assert.equal(profile.id, world);
    assert.equal((await loader.create(io).prepare(profile)).profile.id, world);
  }
  const binding = await io.readJson(selectionPath('moderno-dnd'));
  assert.equal((await selectionReader.readSelection(binding, io)).rulesetManifest.id, 'dnd');
  for (const { url, init } of calls) {
    assert.ok(url.startsWith('https://game.test/repo/'));
    assert.equal(init.redirect, 'error'); assert.equal(init.mode, 'same-origin');
    assert.equal(init.credentials, 'omit'); assert.equal(init.cache, 'no-store');
  }
});

test('navegador rechaza base ajena/file/http, traversal y referencias fuera de allowlist antes de fetch', async () => {
  for (const baseURL of ['https://elsewhere.test/repo/', 'file:///repo/', 'http://game.test/repo/',
    'https://game.test/repo', 'https://game.test/repo/?x', 'https://user:pass@game.test/repo/',
    'https://game.test/%2frepo/']) assert.throws(() => browserFixture(published, { baseURL }),
      error => error.code === 'RESOURCE_BASE_INVALID');
  const { io, calls } = browserFixture(() => { throw Error('must not fetch'); });
  await rejects(io.readJson('../secret.json'), 'RESOURCE_PATH_INVALID');
  await rejects(io.readJson('unlisted.json'), 'RESOURCE_NOT_AUTHORIZED');
  assert.equal(calls.length, 0);
});

test('navegador rechaza redirecciones, respuesta de otro origen o salida de subruta', async () => {
  for (const options of [{ redirected: true }, { url: 'https://other.test/repo/valid.json' },
    { url: 'https://game.test/private.json' }]) {
    const { io } = browserFixture(url => response(url, '{}', options));
    await rejects(io.readJson(worldPath('distopia')), 'RESOURCE_RESPONSE_REJECTED');
  }
  const { io } = browserFixture(() => { throw new TypeError('redirect:error'); });
  await rejects(io.readJson(worldPath('distopia')), 'RESOURCE_FETCH_FAILED');
});

test('navegador rechaza HTTP/HTML, JSON inválido y tamaños declarados o transmitidos excesivos', async () => {
  for (const [body, options, expected] of [
    ['{}', { status: 404 }, 'RESOURCE_NOT_FOUND'],
    ['{}', { status: 500 }, 'RESOURCE_HTTP_FAILED'],
    ['<html>', { headers: { 'content-type': 'text/html' } }, 'RESOURCE_MIME_INVALID'],
    ['{', {}, 'RESOURCE_JSON_INVALID'],
    ['{}', { headers: { 'content-length': '100000000' } }, 'RESOURCE_TOO_LARGE']
  ]) {
    const { io } = browserFixture(url => response(url, body, options));
    await rejects(io.readJson(worldPath('distopia')), expected);
  }
  const { io } = browserFixture(url => response(url, ' '.repeat(30)), { maxBytes: 10 });
  await rejects(io.readJson(worldPath('distopia')), 'RESOURCE_TOO_LARGE');
});

test('navegador aborta carga vencida y no cambia mundo o reglamento', async () => {
  const { io, calls } = browserFixture((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }), { timeoutMs: 5 });
  await rejects(io.readJson(worldPath('distopia')), 'RESOURCE_TIMEOUT');
  assert.equal(calls.length, 1);
  assert.ok(calls[0].init.signal.aborted);
});
