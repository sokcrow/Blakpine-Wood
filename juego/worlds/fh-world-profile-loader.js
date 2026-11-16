/* Perfiles declarativos y referencias de mapa; sin editor ni motor 3D. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FHWorldProfileLoader = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const schemaPath = 'contratos/multimodo/v1/perfil-mundo.schema.json';
  const capabilitiesKey = 'blakpine.world-capabilities.v1';

  class WorldProfileError extends Error {
    constructor(code, cause) {
      super(code, cause === undefined ? undefined : { cause });
      this.name = 'WorldProfileError';
      this.code = code;
    }
  }

  function snapshot(value) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (Array.isArray(value)) return Object.freeze(value.map(snapshot));
    if (value && Object.getPrototypeOf(value) === Object.prototype) {
      return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, snapshot(child)])));
    }
    throw new TypeError('INVALID_JSON_DATA');
  }

  /** Inyectar lectura JSON desde raíz fija y validación del esquema canónico. */
  function create({ readJson, validate } = {}) {
    return Object.freeze({
      /** prepare(perfil v1) -> descripción inmutable compatible con IA 2. */
      async prepare(worldProfile) {
        if (typeof readJson !== 'function' || typeof validate !== 'function') {
          throw new WorldProfileError('WORLD_LOADER_DEPENDENCIES_MISSING');
        }
        let profile, schema;
        try { profile = snapshot(worldProfile); }
        catch (cause) { throw new WorldProfileError('PROFILE_DATA_INVALID', cause); }
        try { schema = snapshot(await readJson(schemaPath)); }
        catch (cause) { throw new WorldProfileError('PROFILE_SCHEMA_READ_FAILED', cause); }
        try {
          if (await validate(profile, schema) !== true) throw new Error('VALIDATION_REJECTED');
        } catch (cause) { throw new WorldProfileError('PROFILE_INVALID', cause); }

        const capabilities = profile.extensions?.[capabilitiesKey] ?? null;
        let scenario = Object.freeze({ status: 'declarative-only' });
        if (profile.map) {
          let data;
          // La ruta ya fue validada contra el esquema antes de cualquier lectura.
          try { data = snapshot(await readJson(profile.map.path)); }
          catch (cause) { throw new WorldProfileError('WORLD_MAP_READ_FAILED', cause); }
          if (!data || Array.isArray(data) || data.schema !== profile.map.schema) {
            throw new WorldProfileError('WORLD_MAP_SCHEMA_INVALID');
          }
          // Se entrega el JSON original copiado, sin normalizar ni convertir units.
          scenario = Object.freeze({ status: 'map-available', reference: profile.map, data });
        }
        return Object.freeze({ kind: 'world-profile-description', profile, capabilities, scenario });
      }
    });
  }

  return Object.freeze({ create, WorldProfileError });
});
