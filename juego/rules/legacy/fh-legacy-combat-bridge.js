/* Puente de ejecución Legacy. No instala puertos ni resuelve fórmulas de combate. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FHLegacyCombatBridge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  class LegacyBridgeError extends Error {
    constructor(code, cause) {
      super(code, cause === undefined ? undefined : { cause });
      this.name = 'LegacyBridgeError';
      this.code = code;
    }
  }
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const record = value => value && Object.getPrototypeOf(value) === Object.prototype;
  const keys = (value, expected) => record(value) &&
    Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));

  function snapshot(value) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (Array.isArray(value)) return Object.freeze(value.map(snapshot));
    if (record(value)) return Object.freeze(Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, snapshot(child)])));
    throw new TypeError('INVALID_JSON_DATA');
  }

  /** Una instancia por sesión; conservarla durante toda la vida de esa sesión. */
  function create({ sessionId, playerId, authorize, playerAttack, structureAttack } = {}) {
    if (!text(sessionId) || !text(playerId)) throw new LegacyBridgeError('LEGACY_SESSION_INVALID');
    const actions = new Map();
    const prepared = typeof authorize === 'function' && typeof playerAttack === 'function' &&
      typeof structureAttack === 'function';

    function readIntent(value) {
      let intent;
      try { intent = snapshot(value); }
      catch (cause) { throw new LegacyBridgeError('LEGACY_INTENT_INVALID', cause); }
      if (!keys(intent, ['sessionId', 'rulesetId', 'actionId', 'revision', 'action', 'actor', 'target']) ||
          intent.sessionId !== sessionId || intent.rulesetId !== 'legacy' ||
          !text(intent.actionId) || !Number.isSafeInteger(intent.revision) || intent.revision < 0 ||
          intent.action !== 'attack' || !keys(intent.actor, ['kind', 'id']) || !text(intent.actor.id) ||
          !['player', 'creature'].includes(intent.actor.kind) ||
          (intent.actor.kind === 'player' && intent.actor.id !== playerId)) {
        throw new LegacyBridgeError('LEGACY_INTENT_INVALID');
      }
      const target = intent.target;
      if (target?.kind === 'player') {
        if (!keys(target, ['kind', 'id']) || target.id !== playerId || intent.actor.kind !== 'creature') {
          throw new LegacyBridgeError('LEGACY_TARGET_INVALID');
        }
      } else if (target?.kind === 'structure') {
        if (!keys(target, ['kind', 'id', 'floorId', 'part']) || !text(target.id) || !text(target.floorId) ||
            !['structure', 'reader'].includes(target.part)) throw new LegacyBridgeError('LEGACY_TARGET_INVALID');
      } else throw new LegacyBridgeError('LEGACY_TARGET_INVALID');
      // Orden estable para comparar semánticamente una repetición con claves JSON reordenadas.
      const targetKey = target.kind === 'player' ? [target.kind, target.id] :
        [target.kind, target.id, target.floorId, target.part];
      const fingerprint = JSON.stringify([sessionId, 'legacy', intent.actionId, intent.revision,
        intent.action, intent.actor.kind, intent.actor.id, targetKey]);
      return { intent, fingerprint };
    }

    /** Delega la operación completa una vez; también conserva rechazos y fallos parciales. */
    function executeOnce(value) {
      let intent, fingerprint;
      try {
        ({ intent, fingerprint } = readIntent(value));
        if (!prepared) throw new LegacyBridgeError('LEGACY_DEPENDENCIES_MISSING');
      } catch (cause) { return Promise.reject(cause); }
      const previous = actions.get(intent.actionId);
      if (previous) {
        if (previous.fingerprint !== fingerprint) return Promise.reject(new LegacyBridgeError('LEGACY_ACTION_CONFLICT'));
        return previous.promise;
      }
      // Registrar antes de invocar cualquier callback, incluso ante concurrencia/reentrada.
      const promise = Promise.resolve().then(async () => {
        try {
          if (await authorize(intent) !== true) throw new Error('AUTHORIZATION_REJECTED');
        } catch (cause) { throw new LegacyBridgeError('LEGACY_NOT_AUTHORIZED', cause); }
        const operation = intent.target.kind === 'player' ? playerAttack : structureAttack;
        try {
          const result = await operation(intent);
          return Object.freeze({ status: 'completed', sessionId, actionId: intent.actionId,
            result: snapshot(result === undefined ? null : result) });
        } catch (cause) {
          // El propietario pudo mutar antes de fallar: nunca reintentar automáticamente.
          throw new LegacyBridgeError('LEGACY_OPERATION_FAILED', cause);
        }
      });
      actions.set(intent.actionId, { fingerprint, promise });
      return promise;
    }

    return Object.freeze({
      id: 'legacy-combat-bridge-v1',
      contract: 'blakpine-combat-adapter-v1',
      rulesetId: 'legacy',
      getStatus: () => Object.freeze({ prepared, connected: false }),
      // attack() modifica PE/RNG/cooldown: no es un evaluador puro exportado hoy.
      async evaluate() { throw new LegacyBridgeError('LEGACY_PURE_RESOLVER_UNAVAILABLE'); },
      executeOnce
    });
  }
  return Object.freeze({ create, LegacyBridgeError });
});
