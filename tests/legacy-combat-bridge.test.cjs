'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { create } = require('../juego/rules/legacy/fh-legacy-combat-bridge.js');
const survivalCore = require('../juego/assets/fh-survival-core.js');
function intent(actionId = 'hit-1', target = { kind: 'player', id: 'hero' }) {
  return { sessionId: 'session-1', rulesetId: 'legacy', actionId, revision: 0,
    action: 'attack', actor: { kind: 'creature', id: 'shadow' }, target };
}
const structure = () => ({ kind: 'structure', id: 'door', floorId: 'floor-1', part: 'structure' });
function fixture(overrides = {}) {
  const calls = { authorize: 0, player: 0, structure: 0 };
  const bridge = create({ sessionId: 'session-1', playerId: 'hero',
    authorize() { calls.authorize++; return true; },
    playerAttack() { calls.player++; return { resource: 'pg', changed: true }; },
    structureAttack() { calls.structure++; return { changed: true }; }, ...overrides });
  return { bridge, calls };
}
const rejectsCode = (promise, code) => assert.rejects(promise, error => error.code === code);

test('sin identidad válida falla; preparado con dependencias nunca significa conectado', async () => {
  assert.throws(() => create(), error => error.code === 'LEGACY_SESSION_INVALID');
  assert.throws(() => create({ sessionId: ' ', playerId: 'hero' }), error => error.code === 'LEGACY_SESSION_INVALID');
  const bridge = create({ sessionId: 'session-1', playerId: 'hero' });
  assert.deepEqual(bridge.getStatus(), { prepared: false, connected: false });
  await rejectsCode(bridge.executeOnce(intent()), 'LEGACY_DEPENDENCIES_MISSING');
  assert.deepEqual(fixture().bridge.getStatus(), { prepared: true, connected: false });
});

test('evaluate se bloquea sin consumir recursos ni llamar operaciones Legacy', async () => {
  const { bridge, calls } = fixture();
  assert.equal(bridge.contract, 'blakpine-combat-adapter-v1');
  assert.equal(bridge.rulesetId, 'legacy');
  await rejectsCode(bridge.evaluate(intent(), {}, {}), 'LEGACY_PURE_RESOLVER_UNAVAILABLE');
  assert.deepEqual(calls, { authorize: 0, player: 0, structure: 0 });
});

test('repeticiones concurrentes, posteriores y claves reordenadas comparten operación y promesa', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let executions = 0;
  const { bridge, calls } = fixture({ async playerAttack() { executions++; await gate; return { changed: true }; } });
  const action = intent();
  const first = bridge.executeOnce(action);
  const reordered = Object.fromEntries(Object.entries(action).reverse());
  assert.equal(bridge.executeOnce(reordered), first);
  release();
  const result = await first;
  assert.equal(bridge.executeOnce(action), first);
  assert.equal(await bridge.executeOnce(action), result);
  assert.equal(executions, 1);
  assert.equal(calls.authorize, 1);
});

test('reentrada antes de completar no vuelve a invocar al propietario', async () => {
  let repeated, bridge, calls = 0;
  bridge = fixture({ playerAttack() { calls++; repeated = bridge.executeOnce(intent()); } }).bridge;
  const first = bridge.executeOnce(intent());
  await first;
  assert.equal(first, repeated);
  assert.equal(calls, 1);
});

test('PG usa propietario Legacy real y mantiene crítico; PE de criatura separado del jugador', async () => {
  const state = { character: { life: 'alive', resources: { pg: 3, pgMax: 10, sp: 12, spMax: 12, pe: 7, peMax: 7 } } };
  let critical = 0, resolved = 0;
  const survival = survivalCore.createRuntime(state, { onCritical() { critical++; } }, 0);
  const creature = { pe: 6 };
  const events = [];
  const { bridge } = fixture({ playerAttack() {
    // Simulación de una operación completa: importe fijo, sin reproducir tiradas.
    resolved++; creature.pe--;
    const changed = survival.damagePG(4);
    if (changed) events.push('combat:damage');
    return { changed };
  } });
  await Promise.all([bridge.executeOnce(intent()), bridge.executeOnce(intent())]);
  assert.equal(resolved, 1);
  assert.equal(state.character.resources.pg, 0);
  assert.equal(state.character.resources.sp, 12);
  assert.equal(state.character.resources.pe, 7);
  assert.equal(creature.pe, 5);
  assert.equal(critical, 1);
  assert.deepEqual(events, ['combat:damage']);
});

test('PS se mantiene como SP del propietario; sin descuentos PG o PE adicionales', async () => {
  const resources = { pg: 20, pgMax: 20, sp: 10, spMax: 10, pe: 5, peMax: 5 };
  const survival = survivalCore.createRuntime({ character: { resources } }, {}, 0);
  const { bridge } = fixture({ playerAttack: () => ({ changed: survival.change('sp', -3) }) });
  await bridge.executeOnce(intent());
  await bridge.executeOnce(intent());
  assert.deepEqual(resources, { pg: 20, pgMax: 20, sp: 7, spMax: 10, pe: 5, peMax: 5 });
});

test('puertas, muros y objetos van exclusivamente al propietario estructural con piso y parte', async () => {
  const seen = [];
  const { bridge, calls } = fixture({ structureAttack(value) { seen.push(value.target); return { changed: true }; } });
  for (const id of ['door', 'wall', 'object']) {
    await bridge.executeOnce(intent(id, { ...structure(), id }));
    await bridge.executeOnce(intent(id, { ...structure(), id }));
  }
  await bridge.executeOnce(intent('reader', { ...structure(), part: 'reader' }));
  assert.equal(calls.player, 0);
  assert.equal(seen.length, 4);
  assert.equal(seen[3].part, 'reader');
  assert.ok(seen.every(target => target.kind === 'structure' && target.floorId === 'floor-1'));
});

test('conflictos de revisión/atacante/objetivo/tipo no sustituyen una acción registrada', async () => {
  const { bridge, calls } = fixture();
  await bridge.executeOnce(intent());
  for (const changed of [
    { ...intent(), revision: 1 },
    { ...intent(), actor: { kind: 'creature', id: 'other' } },
    intent('hit-1', structure())
  ]) await rejectsCode(bridge.executeOnce(changed), 'LEGACY_ACTION_CONFLICT');
  assert.equal(calls.player, 1);
  assert.equal(calls.structure, 0);
});

test('sesión/reglas/personaje ajenos, revisiones y eventos posteriores se rechazan sin mutar', async () => {
  const { bridge, calls } = fixture();
  for (const value of [null, {}, { type: 'combat:damage', damage: 4 },
    { ...intent(), sessionId: 'session-2' }, { ...intent(), rulesetId: 'moon-system' },
    { ...intent(), revision: -1 }, { ...intent(), revision: 0.5 },
    { ...intent(), damage: 4 }, { ...intent(), resource: 'pe' },
    { ...intent(), actor: { kind: 'player', id: 'other' } }
  ]) await rejectsCode(bridge.executeOnce(value), 'LEGACY_INTENT_INVALID');
  for (const target of [{ kind: 'player', id: 'other' }, { kind: 'creature', id: 'shadow' },
    { ...structure(), floorId: '' }, { ...structure(), part: 'pg' },
    { ...structure(), resource: 'pg' }
  ]) await rejectsCode(bridge.executeOnce(intent('bad', target)), 'LEGACY_TARGET_INVALID');
  assert.deepEqual(calls, { authorize: 0, player: 0, structure: 0 });
});

test('autorización falsa o fallida queda registrada y nunca entra en resolución/aplicación', async () => {
  for (const authorize of [() => false, () => undefined, () => { throw Error('stale'); }]) {
    const { bridge, calls } = fixture({ authorize });
    const first = bridge.executeOnce(intent());
    await rejectsCode(first, 'LEGACY_NOT_AUTHORIZED');
    assert.equal(bridge.executeOnce(intent()), first);
    await rejectsCode(bridge.executeOnce(intent()), 'LEGACY_NOT_AUTHORIZED');
    assert.equal(calls.player, 0);
  }
});

test('fallo después de aplicar o notificar nunca reejecuta daño ni coste', async () => {
  for (const operation of [() => { throw Error('notify failed after damage'); }, async () => { throw Error('save failed'); }]) {
    let damage = 0;
    const { bridge } = fixture({ playerAttack() { damage += 4; return operation(); } });
    const first = bridge.executeOnce(intent());
    await rejectsCode(first, 'LEGACY_OPERATION_FAILED');
    assert.equal(bridge.executeOnce(intent()), first);
    await rejectsCode(bridge.executeOnce(intent()), 'LEGACY_OPERATION_FAILED');
    assert.equal(damage, 4);
  }
});

test('resultado vacío/sin cambio también se registra, sin declarar daño aplicado', async () => {
  for (const output of [undefined, { changed: false }]) {
    let count = 0;
    const { bridge } = fixture({ playerAttack() { count++; return output; } });
    const first = await bridge.executeOnce(intent());
    await bridge.executeOnce(intent());
    assert.equal(count, 1);
    assert.equal(first.status, 'completed');
    assert.deepEqual(first.result, output ?? null);
  }
});

test('entrada y resultado se copian y congelan; un resultado no JSON no permite reintentar', async () => {
  const input = intent();
  const output = { nested: { changed: true } };
  const { bridge } = fixture({ playerAttack(value) {
    assert.equal(value.actor.id, 'shadow');
    assert.ok(Object.isFrozen(value.target));
    return output;
  } });
  const pending = bridge.executeOnce(input);
  input.actor.id = 'mutated';
  const result = await pending;
  output.nested.changed = false;
  assert.equal(result.result.nested.changed, true);
  assert.ok(Object.isFrozen(result.result.nested));
  let calls = 0;
  const bad = fixture({ playerAttack() { calls++; return { live: new Date() }; } }).bridge;
  await rejectsCode(bad.executeOnce(intent()), 'LEGACY_OPERATION_FAILED');
  await rejectsCode(bad.executeOnce(intent()), 'LEGACY_OPERATION_FAILED');
  assert.equal(calls, 1);
});

test('dos IDs genuinamente distintos pueden ejecutar acciones distintas en la misma sesión', async () => {
  const { bridge, calls } = fixture();
  await Promise.all([bridge.executeOnce(intent('one')), bridge.executeOnce(intent('two'))]);
  assert.equal(calls.player, 2);
});

test('carga como script clásico sin DOM, Three, bus de eventos o almacenamiento', () => {
  const context = vm.createContext({});
  const code = fs.readFileSync(path.join(__dirname, '../juego/rules/legacy/fh-legacy-combat-bridge.js'), 'utf8');
  vm.runInContext(code, context);
  assert.equal(typeof context.FHLegacyCombatBridge.create, 'function');
  assert.equal(vm.runInContext('FHLegacyCombatBridge.create({sessionId:"s",playerId:"p"}).getStatus().connected', context), false);
});
