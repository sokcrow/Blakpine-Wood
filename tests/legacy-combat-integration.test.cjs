'use strict';
/* Enlace modular probado con puerto SINTÉTICO y propietario FHSurvival real.
 * Las pruebas del motor ensamblado viven en legacy-real-engine.test.cjs.
 * Contrato IA 1: PR #205 @ 1b175ae0b4ac6ba3c9dfd209b96394e89a98f748.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../juego/core/fh-session-coordinator.js');
const { create: bridgeFactory } = require('../juego/rules/legacy/fh-legacy-combat-bridge.js');
const survivalCore = require('../juego/assets/fh-survival-core.js');
const shadows = require('../juego/assets/fh-shadow-ai.js');
const intent = (actionId = 'one') => ({ sessionId: 'session', rulesetId: 'legacy', actionId,
  revision: 0, action: 'attack', actor: { kind: 'creature', id: 'shadow' },
  target: { kind: 'player', id: 'hero' } });
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);
function fixture() {
  const context = { sessionId: 'session', playerId: 'hero', rulesetId: 'legacy', revision: 0, minute: 1322 };
  const state = { character: { resources: { pg: 3, pgMax: 10, sp: 8, spMax: 8, pe: 7, peMax: 7 } } };
  let critical = 0, calls = 0, closes = 0;
  const survival = survivalCore.createRuntime(state, { onCritical() { critical++; } }, 1322);
  let port;
  const runtime = { connectCombat(value) { port = value; return { close() { closes++; } }; } };
  const coordinator = create();
  const options = { sessionId: 'session', playerId: 'hero', shadowRuntime: runtime, readContext: () => context };
  const binding = coordinator.bindLegacyCombat(options);
  const operation = { authorize: () => true, execute() {
    calls++; survival.damagePG(4); return null; // importe fijo, sin recrear reglas/dados Legacy
  } };
  return { context, state, survival, operation, runtime, options, coordinator, binding,
    request: (value = intent(), op = operation) => port.requestAttack(value, op),
    counts: () => ({ calls, closes, critical }) };
}

test('runtime deshabilitado bloquea el puerto antes de cualquier efecto', () => {
  const runtime = shadows.createRuntime({config:{enabled:false}});
  assert.throws(() => create().bindLegacyCombat({sessionId:'session',playerId:'hero',
    shadowRuntime:runtime,readContext:()=>null}),error=>error.code==='LEGACY_ENGINE_PORT_UNAVAILABLE');
});

test('enlace sintético reutiliza puente real, comparte promesa y aplica PG/crítico una sola vez', async () => {
  const f = fixture();
  const first = f.request();
  assert.equal(f.request(Object.fromEntries(Object.entries(intent()).reverse())), first);
  const result = await first;
  assert.equal(f.request(), first);
  assert.deepEqual(result, { status: 'completed', sessionId: 'session', actionId: 'one', result: null });
  assert.equal(f.state.character.resources.pg, 0);
  assert.equal(f.state.character.resources.pe, 7);
  assert.deepEqual(f.counts(), { calls: 1, closes: 0, critical: 1 });
  assert.deepEqual(f.binding.getStatus(), { connected: true, closed: false });
});

test('SP usa propietario real sin descontar PG/PE; sin usar combat:damage como entrada', async () => {
  const f = fixture(); let applications = 0;
  const operation = { authorize: () => true, execute() {
    applications++; f.survival.change('sp', -2); return null;
  } };
  await Promise.all([f.request(intent(), operation), f.request(intent(), operation)]);
  assert.equal(applications, 1);
  assert.equal(f.state.character.resources.sp, 6);
  assert.equal(f.state.character.resources.pg, 3);
  assert.equal(f.state.character.resources.pe, 7);
  await assert.rejects(f.request({ type: 'combat:damage', damage: 2 }));
  assert.equal(applications, 1);
});

test('sustituir capacidad, revisión o actor de una acción se rechaza; otro ID pendiente también', async () => {
  const f = fixture(), pending = f.request();
  await rejects(f.request(intent(), { ...f.operation }), 'LEGACY_ACTION_CONFLICT');
  await rejects(f.request({ ...intent(), revision: 1 }), 'LEGACY_ACTION_CONFLICT');
  await rejects(f.request({ ...intent(), actor: { kind: 'creature', id: 'other' } }), 'LEGACY_ACTION_CONFLICT');
  // Crear una segunda fixture evita que los await anteriores hayan liberado el pendiente.
  const g = fixture(), first = g.request();
  await rejects(g.request(intent('two')), 'LEGACY_ACTOR_PENDING');
  await pending; await first;
  assert.equal(f.counts().calls, 1); assert.equal(g.counts().calls, 1);
});

test('reentrada desde execute devuelve la promesa existente sin repetir la operación', async () => {
  const f = fixture(); let repeated, calls = 0;
  const operation = { authorize: () => true, execute() {
    calls++; repeated = f.request(intent(), operation); return null;
  } };
  const first = f.request(intent(), operation); await first;
  assert.equal(repeated, first); assert.equal(calls, 1);
});

test('revisión cambia entre authorize y execute: rechazo antes de aplicación', async () => {
  const f = fixture(); let authorizations = 0;
  const operation = { authorize() {
    authorizations++;
    if (authorizations === 1) queueMicrotask(() => { f.context.revision++; });
    return true;
  }, execute() { assert.fail('no debe aplicar'); } };
  await rejects(f.request(intent(), operation), 'LEGACY_OPERATION_FAILED');
  assert.equal(f.state.character.resources.pg, 3);
});

test('sesión, personaje y reglas cambiados o autorización falsa no permiten ejecutar', async () => {
  for (const field of ['sessionId', 'playerId', 'rulesetId']) {
    const f = fixture(), pending = f.request(); f.context[field] = 'other';
    await rejects(pending, 'LEGACY_NOT_AUTHORIZED');
    assert.equal(f.counts().calls, 0);
  }
  const f = fixture();
  await rejects(f.request(intent(), { ...f.operation, authorize: () => false }), 'LEGACY_NOT_AUTHORIZED');
  assert.equal(f.counts().calls, 0);
});

test('cerrar revoca pendientes y bloquea reuso de sesión/runtime; close es idempotente', async () => {
  const f = fixture(), pending = f.request();
  f.binding.close(); f.binding.close();
  await rejects(pending, 'LEGACY_NOT_AUTHORIZED');
  await rejects(f.request(intent('new')), 'LEGACY_SESSION_CLOSED');
  assert.deepEqual(f.counts(), { calls: 0, closes: 1, critical: 0 });
  assert.throws(() => f.coordinator.bindLegacyCombat(f.options), error => error.code === 'LEGACY_BINDING_ALREADY_USED');
  assert.equal(f.binding.getStatus().connected, false);
});

test('puente cerrado durante await authorize impide invocar al propietario', async () => {
  let release, entered, applications = 0;
  const waiting = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const bridge = bridgeFactory({ sessionId: 'session', playerId: 'hero',
    authorize() { entered(); return gate; }, playerAttack() { applications++; }, structureAttack() {} });
  const pending = bridge.executeOnce(intent()); await waiting;
  bridge.close(); release(true);
  await rejects(pending, 'LEGACY_SESSION_CLOSED');
  assert.equal(bridge.executeOnce(intent()), pending);
  await rejects(bridge.executeOnce(intent('new')), 'LEGACY_SESSION_CLOSED');
  assert.equal(applications, 0);
});

test('estructuras nunca entran por la capacidad del jugador', async () => {
  const f = fixture();
  await rejects(f.request({ ...intent(), target: { kind: 'structure', id: 'door', floorId: 'f1', part: 'structure' } }), 'LEGACY_PLAYER_PORT_ONLY');
  assert.equal(f.counts().calls, 0);
});

test('fallo después de daño no reintenta, no aplica fallback y conserva la promesa rechazada', async () => {
  const f = fixture(); let calls = 0;
  const operation = { authorize: () => true, execute() {
    calls++; f.survival.damagePG(2); throw Error('fallo simulado de notificación/guardado');
  } };
  const pending = f.request(intent(), operation);
  await rejects(pending, 'LEGACY_OPERATION_FAILED');
  assert.equal(f.request(intent(), operation), pending);
  assert.equal(calls, 1); assert.equal(f.state.character.resources.pg, 1);
});

test('capacidad con retorno asíncrono inválido falla sin repetir sus efectos', async () => {
  const f = fixture(); let calls = 0;
  const operation = { authorize: () => true, execute() { calls++; return Promise.reject(Error('no es síncrona')); } };
  const pending = f.request(intent(), operation);
  await rejects(pending, 'LEGACY_OPERATION_FAILED');
  assert.equal(f.request(intent(), operation), pending); assert.equal(calls, 1);
});

test('autorización asíncrona de capacidad se rechaza y maneja su error sin ejecutar', async () => {
  const f = fixture();
  await rejects(f.request(intent(), { authorize: () => Promise.reject(Error('invalid async authorize')),
    execute() { assert.fail('no debe ejecutar'); } }), 'LEGACY_NOT_AUTHORIZED');
});

test('fallo de conexión después de registrar un ataque revoca la operación pendiente', async () => {
  let pending, executions = 0;
  const runtime = { connectCombat(port) {
    pending = port.requestAttack(intent(), { authorize: () => true, execute() { executions++; return null; } });
    throw Error('fallo de instalación');
  } };
  assert.throws(() => create().bindLegacyCombat({ sessionId: 'session', playerId: 'hero', shadowRuntime: runtime,
    readContext: () => ({ sessionId: 'session', playerId: 'hero', rulesetId: 'legacy', revision: 0, minute: 1 })
  }), error => error.code === 'LEGACY_ENGINE_CONNECTION_FAILED');
  await rejects(pending, 'LEGACY_NOT_AUTHORIZED'); assert.equal(executions, 0);
});

test('sin selección conserva arranque Legacy; planned no pasa por evaluate ni executeOnce', async () => {
  let reads = 0;
  const session = create({ readSelection: async () => {
    reads++; return { kind: 'multimode', worldProfile: {}, rulesetManifest: { status: 'planned' } };
  } });
  assert.deepEqual(await session.prepare(null), { kind: 'legacy' }); assert.equal(reads, 0);
  await rejects(session.prepare({}), 'RULESET_NOT_IMPLEMENTED');
});
