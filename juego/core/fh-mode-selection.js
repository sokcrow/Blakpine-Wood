/* Lectura independiente del motor. Los esquemas v1 son la fuente canónica. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FHModeSelection = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const schemas = Object.freeze({
    selection: 'contratos/multimodo/v1/seleccion-modo.schema.json',
    world: 'contratos/multimodo/v1/perfil-mundo.schema.json',
    rules: 'contratos/multimodo/v1/manifiesto-reglas.schema.json'
  });

  class ModeSelectionError extends Error {
    constructor(code, cause) {
      super(code, cause === undefined ? undefined : { cause });
      this.name = 'ModeSelectionError';
      this.code = code;
    }
  }

  // Admite únicamente datos JSON; nunca conserva referencias a objetos del motor.
  function snapshot(value) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (Array.isArray(value)) return Object.freeze(value.map(snapshot));
    if (value && Object.getPrototypeOf(value) === Object.prototype) {
      return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, snapshot(child)])));
    }
    throw new ModeSelectionError('INVALID_JSON_DATA');
  }

  /** null/undefined -> Legacy sin IO. validate(data, canonicalSchema) debe devolver true. */
  async function readSelection(selection, { readJson, validate } = {}) {
    if (selection == null) return Object.freeze({ kind: 'legacy' });
    if (typeof readJson !== 'function' || typeof validate !== 'function') {
      throw new ModeSelectionError('SELECTION_DEPENDENCIES_MISSING');
    }
    async function read(path) {
      try { return snapshot(await readJson(path)); }
      catch (cause) { throw new ModeSelectionError('DOCUMENT_READ_FAILED', cause); }
    }
    async function check(document, schemaPath) {
      const schema = await read(schemaPath);
      try {
        if (await validate(document, schema) !== true) throw new Error('VALIDATION_REJECTED');
      } catch (cause) { throw new ModeSelectionError('CONTRACT_INVALID', cause); }
    }
    try {
      const binding = snapshot(selection);
      await check(binding, schemas.selection);
      const worldProfile = await read(binding.worldProfile);
      await check(worldProfile, schemas.world);
      const rulesetManifest = await read(binding.rulesetManifest);
      await check(rulesetManifest, schemas.rules);
      return Object.freeze({ kind: 'multimode', selection: binding, worldProfile, rulesetManifest });
    } catch (cause) {
      if (cause instanceof ModeSelectionError) throw cause;
      throw new ModeSelectionError('INVALID_SELECTION', cause);
    }
  }

  return Object.freeze({ readSelection, ModeSelectionError });
});
