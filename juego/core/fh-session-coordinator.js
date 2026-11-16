/* Preparación de sesiones: no inicia gameplay ni aplica propuestas de combate. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FHSessionCoordinator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  class SessionPreparationError extends Error {
    constructor(code, cause) {
      super(code, cause === undefined ? undefined : { cause });
      this.name = 'SessionPreparationError';
      this.code = code;
    }
  }

  function copyDescription(value) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (Array.isArray(value)) return Object.freeze(value.map(copyDescription));
    if (value && Object.getPrototypeOf(value) === Object.prototype) {
      return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copyDescription(child)])));
    }
    throw new TypeError('INVALID_JSON_DESCRIPTION');
  }

  /** Inyectar readSelection, worldLoader.prepare(perfil) y rulesAdapter; ver README. */
  function create({ readSelection, worldLoader, rulesAdapter } = {}) {
    return Object.freeze({
      async prepare(selection) {
        // Devolver el control al arranque heredado, sin fabricar otra sesión Legacy.
        if (selection == null) return Object.freeze({ kind: 'legacy' });
        if (typeof readSelection !== 'function') throw new SessionPreparationError('SELECTION_READER_MISSING');
        let mode;
        try { mode = await readSelection(selection); }
        catch (cause) { throw new SessionPreparationError('SELECTION_FAILED', cause); }
        if (mode?.kind !== 'multimode' || !mode.worldProfile || !mode.rulesetManifest) {
          throw new SessionPreparationError('SELECTION_INVALID');
        }
        const manifest = mode.rulesetManifest;
        if (manifest.status !== 'implemented' || !manifest.adapter) {
          throw new SessionPreparationError('RULESET_NOT_IMPLEMENTED');
        }
        if (!rulesAdapter) throw new SessionPreparationError('RULES_ADAPTER_MISSING');
        if (rulesAdapter.id !== manifest.adapter.id ||
            rulesAdapter.contract !== 'blakpine-combat-adapter-v1' ||
            rulesAdapter.contract !== manifest.adapter.contract ||
            rulesAdapter.rulesetId !== manifest.id || typeof rulesAdapter.evaluate !== 'function') {
          throw new SessionPreparationError('RULES_ADAPTER_MISMATCH');
        }
        if (!mode.worldProfile.map) throw new SessionPreparationError('WORLD_MAP_MISSING');
        if (typeof worldLoader?.prepare !== 'function') throw new SessionPreparationError('WORLD_LOADER_MISSING');
        let worldDescription;
        try { worldDescription = await worldLoader.prepare(mode.worldProfile); }
        catch (cause) { throw new SessionPreparationError('WORLD_PREPARATION_FAILED', cause); }
        try {
          if (!worldDescription || Object.getPrototypeOf(worldDescription) !== Object.prototype) {
            throw new TypeError('WORLD_DESCRIPTION_NOT_OBJECT');
          }
          worldDescription = copyDescription(worldDescription);
        } catch (cause) { throw new SessionPreparationError('WORLD_DESCRIPTION_INVALID', cause); }
        return Object.freeze({ kind: 'prepared', mode, worldDescription });
      }
    });
  }

  return Object.freeze({ create, SessionPreparationError });
});
