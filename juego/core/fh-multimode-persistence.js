/* Frontera de persistencia padre/iframe. Nunca reescribe claves Legacy. */
(function (root, factory) {
  'use strict';
  const dependency = typeof module === 'object' && module.exports
    ? require('./fh-multimode-save-identity.js') : root.FHMultimodeSaveIdentity;
  const api = factory(dependency);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FHMultimodePersistence = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (identities) {
  'use strict';
  class SaveRuntimeError extends Error {
    constructor(code, cause) {
      super(code, cause === undefined ? undefined : { cause });
      this.name = 'SaveRuntimeError'; this.code = code;
    }
  }
  const fail = code => { throw new SaveRuntimeError(code); };
  const text = value => typeof value === 'string' && value.trim() === value && value.length > 0;
  const plain = value => value !== null && typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype;
  function supportedAdapter(adapter, rulesetId) {
    return plain(adapter) && adapter.status === 'implemented' &&
      adapter.contract === 'blakpine-save-adapter-v1' && adapter.rulesetId === rulesetId &&
      ['validateWorldState', 'validateRulesetState', 'capture', 'restore', 'initial']
        .every(name => typeof adapter[name] === 'function');
  }
  function create({ role, identity, sessionId, adapter, storage = null, send = null } = {}) {
    if (!identities || typeof identities.create !== 'function') fail('SAVE_IDENTITY_MODULE_MISSING');
    if (role !== 'parent' && role !== 'frame') fail('SAVE_ROLE_INVALID');
    if (!text(sessionId)) fail('SAVE_SESSION_INVALID');
    if (!plain(identity) || !supportedAdapter(adapter, identity.rulesetId)) fail('SAVE_ADAPTER_UNAVAILABLE');
    if (role === 'frame' && typeof send !== 'function') fail('SAVE_TRANSPORT_MISSING');
    const guard = identities.create({
      identity,
      validateWorldState: (state, bound) => adapter.validateWorldState(state, bound),
      validateRulesetState: (state, bound) => adapter.validateRulesetState(state, bound)
    });
    let closed = false, sequence = 0, lastReceived = 0;
    function active() { if (closed) fail('SAVE_SESSION_CLOSED'); }
    function localRaw() {
      try { return storage?.getItem?.(guard.key) || null; }
      catch { return null; } // file:// puede bloquear localStorage.
    }
    function readRaw(backup = null) {
      active();
      const raw = localRaw() || backup;
      if (raw === null || raw === undefined) return null;
      // Un guardado local incompatible NO activa un fallback silencioso.
      guard.unpack(raw);
      return raw;
    }
    function read(backup = null) {
      const raw = readRaw(backup);
      return raw === null ? null : guard.unpack(raw).state;
    }
    function restore(map, backup = null) {
      active();
      const state = read(backup);
      const value = state === null
        ? adapter.initial(map, guard.identity)
        : adapter.restore(state.world, state.rules.data, map, guard.identity);
      if (!plain(value)) fail('SAVE_RESTORE_INVALID');
      let detached;
      try { detached = structuredClone(value); }
      catch (cause) { throw new SaveRuntimeError('SAVE_RESTORE_INVALID', cause); }
      if (!plain(detached)) fail('SAVE_RESTORE_INVALID');
      return detached;
    }
    function write(gameState, map) {
      active();
      if (role !== 'frame') fail('SAVE_WRITER_INVALID');
      // Validación completa ANTES de setItem y postMessage.
      const json = guard.pack(adapter.capture(gameState, map, guard.identity));
      let ok = false;
      try { if (storage?.setItem) { storage.setItem(guard.key, json); ok = true; } } catch {}
      const next = ++sequence;
      send({ type: 'FOREST_MULTIMODE_SAVE', sessionId, identity: guard.identity,
        key: guard.key, sequence: next, json });
      return Object.freeze({ ok, json, sequence: next });
    }
    function accept(message) {
      active();
      if (role !== 'parent') fail('SAVE_RECEIVER_INVALID');
      if (!plain(message) || message.type !== 'FOREST_MULTIMODE_SAVE' ||
        message.sessionId !== sessionId || message.key !== guard.key ||
        !plain(message.identity) ||
        JSON.stringify(message.identity) !== JSON.stringify(guard.identity) ||
        !Number.isSafeInteger(message.sequence) || message.sequence <= lastReceived ||
        typeof message.json !== 'string') return false;
      guard.unpack(message.json);
      try {
        if (!storage?.setItem) return false;
        storage.setItem(guard.key, message.json);
      } catch { return false; }
      lastReceived = message.sequence;
      return true;
    }
    return Object.freeze({
      key: guard.key, identity: guard.identity, sessionId,
      read, readRaw, restore, write, accept,
      close() { closed = true; },
      get closed() { return closed; }
    });
  }
  return Object.freeze({ create, supportedAdapter, SaveRuntimeError });
});
