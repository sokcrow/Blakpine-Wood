/* Validación aislada de partidas multimodo; no accede al almacenamiento ni al motor. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FHMultimodeSaveIdentity = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const KIND = 'blakpine-multimode-save';
  const FORMAT_VERSION = 1;
  const PREFIX = 'blakpine_multimode_save_v1:';
  const RULESETS = Object.freeze(['dnd', 'moon-system']);
  class SaveIdentityError extends Error {
    constructor(code, cause) {
      super(code, cause === undefined ? undefined : { cause });
      this.name = 'SaveIdentityError';
      this.code = code;
    }
  }
  const fail = code => { throw new SaveIdentityError(code); };
  const record = value => value !== null && typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype;
  const exact = (value, keys) => record(value) && Object.keys(value).length === keys.length &&
    keys.every(key => Object.hasOwn(value, key));
  const text = value => typeof value === 'string' && value.length > 0 && value.trim() === value;

  // Copia JSON sin invocar getters, aceptar huecos o convertir datos incompatibles silenciosamente.
  function copy(value, ancestors = new Set(), depth = 0) {
    if (depth > 100) fail('SAVE_JSON_INVALID');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (!Array.isArray(value) && !record(value)) fail('SAVE_JSON_INVALID');
    if (ancestors.has(value)) fail('SAVE_JSON_INVALID');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const names = Reflect.ownKeys(descriptors);
    if (names.some(key => typeof key !== 'string' ||
      !Object.hasOwn(descriptors[key], 'value') ||
      (!descriptors[key].enumerable && !(Array.isArray(value) && key === 'length')))) fail('SAVE_JSON_INVALID');
    ancestors.add(value);
    let result;
    if (Array.isArray(value)) {
      if (names.length !== value.length + 1) fail('SAVE_JSON_INVALID');
      result = [];
      for (let i = 0; i < value.length; i++) {
        if (!Object.hasOwn(descriptors, String(i))) fail('SAVE_JSON_INVALID');
        result.push(copy(descriptors[i].value, ancestors, depth + 1));
      }
    } else {
      result = Object.fromEntries(names.map(key => [key, copy(descriptors[key].value, ancestors, depth + 1)]));
    }
    ancestors.delete(value);
    return Object.freeze(result);
  }

  const identityKeys = ['mapId', 'characterId', 'rulesetId', 'rulesetVersion', 'saveId'];
  function readIdentity(value) {
    const identity = copy(value);
    if (!exact(identity, identityKeys) || !text(identity.mapId) ||
        !text(identity.characterId) || !text(identity.saveId)) fail('SAVE_IDENTITY_INVALID');
    if (!RULESETS.includes(identity.rulesetId)) fail('SAVE_RULESET_UNKNOWN');
    // Versión del estado persistido acordada por este módulo, no prueba de un adaptador jugable.
    if (identity.rulesetVersion !== 1) fail('SAVE_RULESET_VERSION_UNSUPPORTED');
    return identity;
  }
  const tuple = identity => identityKeys.map(key => identity[key]);
  const sameIdentity = (a, b) => tuple(a).every((value, index) => value === tuple(b)[index]);

  function create({ identity: suppliedIdentity, validateWorldState, validateRulesetState } = {}) {
    const identity = readIdentity(suppliedIdentity);
    if (typeof validateWorldState !== 'function' || typeof validateRulesetState !== 'function') {
      fail('SAVE_VALIDATORS_MISSING');
    }
    const key = PREFIX + encodeURIComponent(JSON.stringify(tuple(identity)));
    function approved(validator, data) {
      const result = validator(data, identity);
      if (result && typeof result.then === 'function') {
        // Una dependencia asíncrona es inválida; manejar también su posible rechazo.
        Promise.resolve(result).catch(() => {});
        return false;
      }
      return result === true;
    }
    function validateState(state) {
      if (!exact(state, ['world', 'rules']) || !record(state.world) ||
          !exact(state.rules, ['rulesetId', 'rulesetVersion', 'data']) || !record(state.rules.data) ||
          state.rules.rulesetId !== identity.rulesetId || state.rules.rulesetVersion !== identity.rulesetVersion) {
        fail('SAVE_STATE_INCOMPATIBLE');
      }
      try {
        // Validadores síncronos de confianza: true exacto; promesas/undefined no autorizan.
        if (!approved(validateWorldState, state.world) ||
            !approved(validateRulesetState, state.rules.data)) fail('SAVE_STATE_INCOMPATIBLE');
      } catch (cause) {
        if (cause instanceof SaveIdentityError) throw cause;
        throw new SaveIdentityError('SAVE_STATE_INCOMPATIBLE', cause);
      }
    }
    function validate(value) {
      const envelope = copy(value);
      if (!exact(envelope, ['kind', 'formatVersion', 'identity', 'state']) || envelope.kind !== KIND) {
        fail('SAVE_ENVELOPE_INVALID');
      }
      if (envelope.formatVersion !== FORMAT_VERSION) fail('SAVE_FORMAT_UNSUPPORTED');
      const incomingIdentity = readIdentity(envelope.identity);
      if (!sameIdentity(identity, incomingIdentity)) fail('SAVE_IDENTITY_MISMATCH');
      validateState(envelope.state);
      return envelope;
    }
    function pack(state) {
      return JSON.stringify(validate({ kind: KIND, formatVersion: FORMAT_VERSION, identity, state }));
    }
    function unpack(raw) {
      if (typeof raw !== 'string') fail('SAVE_JSON_INVALID');
      let value;
      try { value = JSON.parse(raw); }
      catch (cause) { throw new SaveIdentityError('SAVE_JSON_INVALID', cause); }
      return validate(value);
    }
    return Object.freeze({ identity, key, validate, pack, unpack });
  }
  return Object.freeze({ KIND, FORMAT_VERSION, PREFIX, RULESETS, create, SaveIdentityError });
});
