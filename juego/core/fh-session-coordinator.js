/* Preparación y enlace operativo Legacy; no instala el puerto privado del motor.
 * Contrato IA 1 leído: PR #205, commit 1b175ae0b4ac6ba3c9dfd209b96394e89a98f748.
 * Corte verificado en main 4e69a954: fh-shadow-ai.js:306–307, antes de attack.
 * BLOQUEO A1/B1: ese runtime solo expone tick/dispose/read. bindLegacyCombat
 * rechaza el motor actual con LEGACY_ENGINE_PORT_UNAVAILABLE; ni globals ni
 * combat:damage son sustitutos. Exponer connectCombat/contexto/revisión requiere
 * intervención posterior del motor; index/iframe/Base64 requieren diff y autorización
 * del Director. Este cambio no los modifica y no declara conexión jugable.
 */
(function (root, factory) {
  'use strict';
  const api = factory(() => typeof module === 'object' && module.exports
    ? require('../rules/legacy/fh-legacy-combat-bridge.js') : root.FHLegacyCombatBridge);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FHSessionCoordinator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (getLegacyBridge) {
  'use strict';
  class SessionPreparationError extends Error {
    constructor(code, cause) {
      super(code, cause === undefined ? undefined : { cause });
      this.name = 'SessionPreparationError';
      this.code = code;
    }
  }
  class LegacyBindingError extends Error {
    constructor(code, cause) {
      super(code, cause === undefined ? undefined : { cause });
      this.name = 'LegacyBindingError'; this.code = code;
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
    const sessionIds = new Set(), runtimes = new WeakSet();
    /**
     * Puerto de confianza del anfitrión, no una activación a partir de prepare().
     * readContext debe demostrar sesión activa/generación, personaje y revisión
     * desde el cierre real. La capacidad del motor revalida contacto, actor y
     * elegibilidad antes de llamar al attack original, sin await ni otro resolutor.
     * Mientras ese puerto no exista, esta ruta se mantiene bloqueada en juego.
     * Solo criatura -> jugador. Estructuras conservan un puerto independiente.
     */
    function bindLegacyCombat({ sessionId, playerId, shadowRuntime, readContext } = {}) {
      const error = code => { throw new LegacyBindingError(code); };
      if (typeof sessionId !== 'string' || !sessionId.trim() || typeof playerId !== 'string' ||
          !playerId.trim() || typeof readContext !== 'function') error('LEGACY_BINDING_INVALID');
      if (!shadowRuntime || typeof shadowRuntime.connectCombat !== 'function') error('LEGACY_ENGINE_PORT_UNAVAILABLE');
      if (sessionIds.has(sessionId) || runtimes.has(shadowRuntime)) error('LEGACY_BINDING_ALREADY_USED');
      const api = getLegacyBridge();
      if (typeof api?.create !== 'function') error('LEGACY_BRIDGE_UNAVAILABLE');
      let closed = false, connection;
      const entries = new Map(), pendingActors = new Map();
      function current(revision) {
        if (closed) return false;
        const context = readContext();
        return context?.sessionId === sessionId && context.playerId === playerId &&
          context.rulesetId === 'legacy' && Number.isSafeInteger(context.revision) && context.revision >= 0 &&
          (revision === undefined || context.revision === revision) && Number.isFinite(context.minute);
      }
      if (!current()) error('LEGACY_SESSION_NOT_ACTIVE');
      function authorized(entry) {
        const result = entry.authorize();
        if (result && typeof result.then === 'function') {
          Promise.resolve(result).catch(() => {});
          return false; // la capacidad del motor debe ser síncrona
        }
        return result === true;
      }
      const bridge = api.create({ sessionId, playerId,
        authorize(intent) {
          const entry = entries.get(intent.actionId);
          return current(intent.revision) && entry && !entry.consumed && authorized(entry);
        },
        playerAttack(intent) {
          const entry = entries.get(intent.actionId);
          // Revalidación síncrona después del await interno del puente.
          if (!current(intent.revision) || !entry || entry.consumed || !authorized(entry) || !current(intent.revision)) {
            error('LEGACY_ACTION_REVOKED');
          }
          entry.consumed = true; // antes de execute y cualquier callback reentrante
          const result = entry.execute();
          if (result !== null) {
            if (result && typeof result.then === 'function') Promise.resolve(result).catch(() => {});
            error('LEGACY_CAPABILITY_RESULT_INVALID');
          }
          return null;
        },
        structureAttack() { error('LEGACY_STRUCTURE_PORT_UNAVAILABLE'); }
      });
      function requestAttack(value, operation) {
        try {
          if (closed) error('LEGACY_SESSION_CLOSED');
          const intent = bridge.validateIntent(value);
          if (intent.actor.kind !== 'creature' || intent.target.kind !== 'player') error('LEGACY_PLAYER_PORT_ONLY');
          const signature = JSON.stringify([intent.sessionId, intent.rulesetId, intent.actionId,
            intent.revision, intent.action, intent.actor.kind, intent.actor.id, intent.target.kind, intent.target.id]);
          const previous = entries.get(intent.actionId);
          if (previous) {
            if (previous.signature !== signature || previous.operation !== operation) error('LEGACY_ACTION_CONFLICT');
            return previous.promise;
          }
          if (!operation || typeof operation.authorize !== 'function' || typeof operation.execute !== 'function') {
            error('LEGACY_CAPABILITY_INVALID');
          }
          if (pendingActors.has(intent.actor.id)) error('LEGACY_ACTOR_PENDING');
          const entry = { signature, operation, consumed: false,
            authorize: operation.authorize.bind(operation), execute: operation.execute.bind(operation) };
          entries.set(intent.actionId, entry);
          pendingActors.set(intent.actor.id, intent.actionId);
          entry.promise = bridge.executeOnce(intent);
          // Capturar ambos resultados sin crear una promesa rechazada sin observador.
          const release = () => pendingActors.delete(intent.actor.id);
          entry.promise.then(release, release);
          return entry.promise;
        } catch (cause) { return Promise.reject(cause); }
      }
      // IDs y runtime no se reutilizan tras fallo/cierre: una sesión nueva usa otro runtime.
      sessionIds.add(sessionId); runtimes.add(shadowRuntime);
      try {
        connection = shadowRuntime.connectCombat({ sessionId, playerId, readContext, requestAttack });
        if (typeof connection?.close !== 'function') error('LEGACY_ENGINE_CONNECTION_INVALID');
      } catch (cause) {
        closed = true; bridge.close();
        throw new LegacyBindingError('LEGACY_ENGINE_CONNECTION_FAILED', cause);
      }
      return Object.freeze({
        // Ni un puerto simulado ni prepared:true acreditan conexión con el juego real.
        getStatus: () => Object.freeze({ connected: false, closed }),
        close() {
          if (closed) return;
          closed = true; bridge.close();
          entries.clear(); pendingActors.clear();
          connection.close();
        }
      });
    }
    return Object.freeze({
      bindLegacyCombat,
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

  return Object.freeze({ create, SessionPreparationError, LegacyBindingError });
});
