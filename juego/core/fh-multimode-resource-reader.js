/*
 * Lectores concretos Node/Linux y navegador HTTPS para selección/carga de mundos.
 * Base revisada: 4e69a954150b2c9fa104fa26d827ec9eed3e955f, Etapa 2 A5.
 *
 * createNode({root, resources, validate, validateMap?, maxBytes?}) -> {readJson, validate}
 * resources: objeto de confianza { 'ruta/archivo.json': 'selection'|'world'|'rules'|'map' }.
 * Las tres rutas de esquema canónico se autorizan automáticamente. Ninguna referencia
 * encontrada dentro de un JSON amplía la lista. No se buscan archivos ni se sigue otro
 * mundo/reglamento ante un error. Cada readJson valida el tipo declarado y versión.
 * validate(document,schema) es el validador canónico ya exigido por los consumidores;
 * debe devolver true exacto. validateMap(map) debe devolver true exacto y es obligatorio
 * si se autorizan mapas (ligar a ForestShared.validate(map).ok, sin migrar el mapa).
 * No se duplica aquí JSON Schema ni la validación geométrica del motor.
 *
 * Enlace previsto (no instalado en el motor por esta entrega):
 * const io = createNode({root, resources, validate, validateMap});
 * FHModeSelection.readSelection(selection, io);
 * FHWorldProfileLoader.create(io).prepare(profile);
 * Leer una selección desde disco: await io.readJson(rutaAutorizada).
 * root/resources/validadores provienen del anfitrión, nunca del documento recibido.
 *
 * Frontera: createNode usa O_NOFOLLOW y /proc/self/fd (Linux); falla en navegador.
 * createBrowser({baseURL,resources,validate,validateMap?,maxBytes?,timeoutMs?}) usa
 * HTTPS del mismo origen de location, base de directorio explícita, redirect:error,
 * response.url exacta, MIME JSON y stream acotado. No acepta file:// ni orígenes
 * alternativos y nunca intenta Node si falla. CORS no constituye autorización.
 * No puede inspeccionar symlinks del servidor: la publicación debe servir una raíz
 * inmutable sin aliases/reescrituras que expongan archivos ajenos a esa publicación.
 * Ambos requieren validadores y política de recursos de confianza del anfitrión;
 * no se instala un lector ni se modifica el arranque del motor en esta entrega.
 * Un contexto file:// u origin null (incluido un iframe opaco) no se admite:
 * debe cargar desde el anfitrión HTTPS con identidad/canal validado, no relajar origen.
 *
 * Modelo: raíz de despliegue/contratos y callbacks de confianza; recursos de solo lectura
 * durante cada carga. Se rechazan symlinks internos y externos, incluidos directorios.
 * Se comprueba identidad/ruta del descriptor antes y después de leer. No es un sandbox
 * contra procesos con permiso para reescribir la raíz o el archivo abierto concurrentemente,
 * ni garantiza una instantánea de varios documentos. Desplegar una raíz inmutable.
 * No lee partidas, escribe almacenamiento, activa modos ni genera ciudades.
 * Pruebas: tests/multimode-resource-reader.test.cjs (fs real y HTTP simulado en VM).
 * No acredita una publicación HTTP real, un navegador automatizado ni WebGL.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FHMultimodeResourceReader = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const schemas = Object.freeze({
    selection: 'contratos/multimodo/v1/seleccion-modo.schema.json',
    world: 'contratos/multimodo/v1/perfil-mundo.schema.json',
    rules: 'contratos/multimodo/v1/manifiesto-reglas.schema.json'
  });
  const kinds = Object.freeze({ selection: 'blakpine-mode-selection-v1',
    world: 'blakpine-world-profile-v1', rules: 'blakpine-ruleset-manifest-v1' });
  class ResourceReadError extends Error {
    constructor(code, cause) {
      super(code, cause === undefined ? undefined : { cause });
      this.name = 'ResourceReadError'; this.code = code;
    }
  }
  const fail = code => { throw new ResourceReadError(code); };
  function checkPath(value) {
    // No URL decoding or normalization: %, :, \\, NUL, ./, ../, leading / all fail.
    if (typeof value !== 'string' || !value.endsWith('.json') ||
        !/^(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*\.json$/.test(value)) {
      fail('RESOURCE_PATH_INVALID');
    }
    return value;
  }
  function createNode({ root, resources, validate, validateMap, maxBytes = 16 * 1024 * 1024 } = {}) {
    if (typeof process === 'undefined' || process.platform !== 'linux' || typeof require !== 'function') {
      fail('RESOURCE_NODE_LINUX_REQUIRED');
    }
    const fs = require('node:fs'), path = require('node:path');
    if (typeof root !== 'string' || !path.isAbsolute(root)) fail('RESOURCE_CONFIGURATION_INVALID');
    const allowed = configure(resources, validate, validateMap, maxBytes);
    let realRoot;
    try {
      realRoot = fs.realpathSync(root);
      if (!fs.statSync(realRoot).isDirectory() || !fs.constants.O_NOFOLLOW) fail('RESOURCE_ROOT_INVALID');
      fs.statSync('/proc/self/fd');
    } catch (cause) { throw new ResourceReadError('RESOURCE_ROOT_INVALID', cause); }
    const inside = target => {
      const relative = path.relative(realRoot, target);
      return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
    };
    function readFile(name) {
      checkPath(name);
      if (!allowed.has(name)) fail('RESOURCE_NOT_AUTHORIZED');
      let fd;
      try {
        let current = realRoot;
        for (const segment of name.split('/')) {
          current = path.join(current, segment);
          if (fs.lstatSync(current).isSymbolicLink()) fail('RESOURCE_SYMLINK_REJECTED');
        }
        const canonical = fs.realpathSync(current);
        if (!inside(canonical) || canonical !== path.join(realRoot, name)) fail('RESOURCE_ROOT_ESCAPE');
        // O_NONBLOCK evita bloquear si un archivo autorizado fue sustituido por FIFO.
        fd = fs.openSync(canonical, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
        const verify = () => {
          const actual = fs.realpathSync('/proc/self/fd/' + fd);
          if (!inside(actual) || actual !== canonical) fail('RESOURCE_ROOT_ESCAPE');
          const stat = fs.fstatSync(fd);
          if (!stat.isFile()) fail('RESOURCE_NOT_FILE');
          if (stat.size > maxBytes) fail('RESOURCE_TOO_LARGE');
          return stat;
        };
        const before = verify();
        // Lectura acotada incluso si el archivo crece después de fstat.
        const buffer = Buffer.alloc(Math.min(before.size + 1, maxBytes + 1));
        let length = 0, count;
        while (length < buffer.length && (count = fs.readSync(fd, buffer, length, buffer.length - length, null)) > 0) length += count;
        const after = verify();
        if (length > maxBytes) fail('RESOURCE_TOO_LARGE');
        if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs || length !== before.size) {
          fail('RESOURCE_CHANGED_DURING_READ');
        }
        return parseBytes(buffer.subarray(0, length));
      } catch (cause) {
        if (cause instanceof ResourceReadError) throw cause;
        throw new ResourceReadError(cause.code === 'ENOENT' ? 'RESOURCE_NOT_FOUND' : 'RESOURCE_IO_FAILED', cause);
      } finally { if (fd !== undefined) fs.closeSync(fd); }
    }
    return validatedReader(allowed, readFile, validate, validateMap);
  }
  function configure(resources, validate, validateMap, maxBytes) {
    if (!resources || Object.getPrototypeOf(resources) !== Object.prototype || typeof validate !== 'function' ||
        !Number.isSafeInteger(maxBytes) || maxBytes < 1) fail('RESOURCE_CONFIGURATION_INVALID');
    const allowed = new Map(Object.entries(resources));
    for (const [name, type] of allowed) {
      checkPath(name);
      if ((!Object.hasOwn(kinds, type) && type !== 'map') || Object.values(schemas).includes(name)) {
        fail('RESOURCE_CONFIGURATION_INVALID');
      }
    }
    if ([...allowed.values()].includes('map') && typeof validateMap !== 'function') fail('RESOURCE_CONFIGURATION_INVALID');
    for (const name of Object.values(schemas)) allowed.set(name, 'schema');
    return allowed;
  }
  function parseBytes(bytes) {
    let data;
    try {
      data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes), (_key, value) => {
        if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('NON_FINITE_JSON_NUMBER');
        return value;
      });
    } catch (cause) { throw new ResourceReadError('RESOURCE_JSON_INVALID', cause); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) fail('RESOURCE_DOCUMENT_INVALID');
    return data;
  }
  function createBrowser({ baseURL, resources, validate, validateMap,
    maxBytes = 16 * 1024 * 1024, timeoutMs = 10000 } = {}) {
    if (typeof window === 'undefined' || typeof location === 'undefined' || typeof fetch !== 'function') {
      fail('RESOURCE_BROWSER_REQUIRED');
    }
    const allowed = configure(resources, validate, validateMap, maxBytes);
    let base;
    try { base = new URL(baseURL); } catch (cause) { throw new ResourceReadError('RESOURCE_BASE_INVALID', cause); }
    if (base.protocol !== 'https:' || base.origin !== location.origin || base.username || base.password ||
        base.search || base.hash || !base.pathname.endsWith('/') || /[%\\]/.test(base.pathname) ||
        !Number.isSafeInteger(timeoutMs) || timeoutMs < 1) fail('RESOURCE_BASE_INVALID');
    async function readFile(name) {
      checkPath(name);
      if (!allowed.has(name)) fail('RESOURCE_NOT_AUTHORIZED');
      const target = new URL(name, base);
      if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname)) fail('RESOURCE_ROOT_ESCAPE');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let stream;
      try {
        const response = await fetch(target.href, { mode: 'same-origin', credentials: 'omit',
          redirect: 'error', cache: 'no-store', signal: controller.signal });
        if (response.redirected || response.url !== target.href || response.type === 'opaque' ||
            response.type === 'opaqueredirect') fail('RESOURCE_RESPONSE_REJECTED');
        if (response.status === 404) fail('RESOURCE_NOT_FOUND');
        if (!response.ok) fail('RESOURCE_HTTP_FAILED');
        if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) fail('RESOURCE_MIME_INVALID');
        const length = response.headers.get('content-length');
        if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) fail('RESOURCE_TOO_LARGE');
        if (!response.body?.getReader) fail('RESOURCE_RESPONSE_REJECTED');
        stream = response.body.getReader();
        const chunks = []; let size = 0;
        while (true) {
          const { done, value } = await stream.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) fail('RESOURCE_TOO_LARGE');
          chunks.push(value);
        }
        const bytes = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        return parseBytes(bytes);
      } catch (cause) {
        if (cause instanceof ResourceReadError) throw cause;
        throw new ResourceReadError(controller.signal.aborted ? 'RESOURCE_TIMEOUT' : 'RESOURCE_FETCH_FAILED', cause);
      } finally {
        clearTimeout(timer);
        controller.abort();
        if (stream) { try { await stream.cancel(); } catch {} stream.releaseLock(); }
      }
    }
    return validatedReader(allowed, readFile, validate, validateMap);
  }
  function validatedReader(allowed, readFile, validate, validateMap) {
    async function readJson(name) {
      const data = await readFile(name), type = allowed.get(name);
      if (type === 'schema') {
        const documentType = Object.keys(schemas).find(key => schemas[key] === name);
        if (data.$schema !== 'https://json-schema.org/draft/2020-12/schema' ||
            data.properties?.kind?.const !== kinds[documentType] || data.properties?.version?.const !== 1) {
          fail('RESOURCE_SCHEMA_INVALID');
        }
        return data;
      }
      if (type === 'map') {
        if (data.schema !== 'forest-horror-map-v1' || ![1, 2].includes(data.version)) fail('RESOURCE_VERSION_UNSUPPORTED');
        try { if (await validateMap(data) !== true) fail('RESOURCE_DOCUMENT_INVALID'); }
        catch (cause) {
          if (cause instanceof ResourceReadError) throw cause;
          throw new ResourceReadError('RESOURCE_DOCUMENT_INVALID', cause);
        }
      } else {
        if (data.kind !== kinds[type]) fail('RESOURCE_DOCUMENT_INVALID');
        if (data.version !== 1) fail('RESOURCE_VERSION_UNSUPPORTED');
        const schema = await readJson(schemas[type]);
        try { if (await validate(data, schema) !== true) fail('RESOURCE_DOCUMENT_INVALID'); }
        catch (cause) {
          if (cause instanceof ResourceReadError) throw cause;
          throw new ResourceReadError('RESOURCE_DOCUMENT_INVALID', cause);
        }
        const references = type === 'selection' ? [[data.worldProfile, 'world'], [data.rulesetManifest, 'rules']]
          : type === 'world' && data.map ? [[data.map.path, 'map']] : [];
        for (const [reference, expectedType] of references) {
          checkPath(reference);
          if (allowed.get(reference) !== expectedType) fail('RESOURCE_REFERENCE_NOT_AUTHORIZED');
        }
      }
      return data;
    }
    return Object.freeze({ readJson, validate });
  }
  return Object.freeze({ createNode, createBrowser, ResourceReadError });
});
