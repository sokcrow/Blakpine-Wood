'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { create } = require('../juego/rules/legacy/fh-legacy-combat-bridge.js');
const survivalCore = require('../juego/assets/fh-survival-core.js');
const root = path.resolve(__dirname, '..');
const intent = (sessionId = 'session-a', actionId = 'attack-1') => ({
  sessionId, actionId, rulesetId: 'legacy', revision: 0, action: 'attack',
  actor: { kind: 'creature', id: 'shadow' }, target: { kind: 'player', id: 'hero' }
});
function combat(sessionId = 'session-a', resource = 'pg', failAfterDamage = false) {
  const resources = { pg: 9, pgMax: 20, sp: 10, spMax: 10, pe: 8, peMax: 8 };
  const state = { character: { life: 'alive', resources } };
  const counts = { critical: 0, cost: 0, notification: 0, save: 0 };
  const survival = survivalCore.createRuntime(state, { onCritical() { counts.critical++; } }, 0);
  const bridge = create({ sessionId, playerId: 'hero', authorize: () => true,
    playerAttack() {
      // Puerto simulado de resolución completa; mutador de supervivencia real.
      // No reproduce RNG, elección de ataque ni cooldown privados de FHShadowAI.
      counts.cost++;
      const changed = resource === 'pg' ? survival.damagePG(4) : survival.change('sp', -4);
      if (changed) counts.notification++;
      if (failAfterDamage) throw Error('guardado fallido después de mutar');
      if (changed) counts.save++;
      return { changed };
    }, structureAttack() { assert.fail('Un golpe al jugador llegó a estructuras'); }
  });
  return { bridge, resources, counts };
}
for (const resource of ['pg', 'sp']) {
  test(`puente real + supervivencia real: ${resource}, una resta ante duplicados concurrentes y posteriores`, async () => {
    const h = combat('session-a', resource);
    const action = intent();
    const first = h.bridge.executeOnce(action);
    const pending = Array.from({ length: 20 }, () => h.bridge.executeOnce(structuredClone(action)));
    assert.ok(pending.every(p => p === first));
    await Promise.all([first, ...pending]);
    await h.bridge.executeOnce(action);
    assert.equal(h.resources[resource], resource === 'pg' ? 5 : 6);
    assert.equal(h.resources[resource === 'pg' ? 'sp' : 'pg'], resource === 'pg' ? 10 : 9);
    assert.equal(h.resources.pe, 8);
    assert.deepEqual(h.counts, { critical: 0, cost: 1, notification: 1, save: 1 });
    assert.deepEqual(h.bridge.getStatus(), { prepared: true, connected: false });
  });
}
test('fallo posterior a mutación conserva rechazo sin repetir coste, daño o notificación', async () => {
  const h = combat('session-a', 'pg', true);
  for (let i = 0; i < 3; i++) await assert.rejects(h.bridge.executeOnce(intent()), { code: 'LEGACY_OPERATION_FAILED' });
  assert.equal(h.resources.pg, 5);
  assert.deepEqual(h.counts, { critical: 0, cost: 1, notification: 1, save: 0 });
});
test('mismo ID en sesiones distintas tiene estado propio; reglas y sesiones ajenas no mutan Legacy', async () => {
  const a = combat(), b = combat('session-b');
  await a.bridge.executeOnce(intent());
  assert.equal(b.resources.pg, 9);
  for (const rulesetId of ['dnd', 'moon-system']) {
    await assert.rejects(a.bridge.executeOnce({ ...intent(), rulesetId }), { code: 'LEGACY_INTENT_INVALID' });
  }
  await assert.rejects(b.bridge.executeOnce(intent()), { code: 'LEGACY_INTENT_INVALID' });
  await b.bridge.executeOnce(intent('session-b'));
  assert.equal(a.resources.pg, 5);
  assert.equal(b.resources.pg, 5);
  assert.equal(a.counts.cost, 1);
  assert.equal(b.counts.cost, 1);
});
test('crítico PG se ejecuta una vez y evaluate no provoca una segunda aplicación', async () => {
  let critical = 0, calls = 0;
  const state = { character: { life: 'alive', resources: { pg: 2, pgMax: 10, sp: 10, spMax: 10, pe: 8, peMax: 8 } } };
  const survival = survivalCore.createRuntime(state, { onCritical() { critical++; } }, 0);
  const bridge = create({ sessionId: 'session-a', playerId: 'hero', authorize: () => true,
    playerAttack() { calls++; return { changed: survival.damagePG(4) }; }, structureAttack() {} });
  await bridge.executeOnce(intent());
  await bridge.executeOnce(intent());
  await assert.rejects(bridge.evaluate(intent()), { code: 'LEGACY_PURE_RESOLVER_UNAVAILABLE' });
  assert.equal(state.character.resources.pg, 0);
  assert.equal(critical, 1);
  assert.equal(calls, 1);
});

function storageHarness() {
  const values = new Map(), writes = [], reads = [];
  const localStorage = {
    getItem(key) { reads.push(key); return values.get(key) ?? null; },
    setItem(key, value) { writes.push([key, String(value)]); values.set(key, String(value)); },
    removeItem(key) { writes.push([key, null]); values.delete(key); },
    clear() { writes.push(['*', null]); values.clear(); }
  };
  const source = fs.readFileSync(path.join(root, 'contratos/multimodo/validar-contratos.mjs'), 'utf8');
  const validator = vm.runInNewContext(source.slice(source.indexOf('function matchesType'), source.indexOf('const refs =')) + '\nvalidate', {
    assert(condition, message) { assert.ok(condition, message); }
  });
  const context = vm.createContext({ localStorage, sessionStorage: localStorage,
    readText: p => fs.readFileSync(path.join(root, p), 'utf8'),
    validate(data, schema) { validator(data, schema); return true; },
    assert, crypto: { randomUUID: () => 'hero' } });
  vm.runInContext('window = globalThis', context);
  for (const file of ['juego/assets/fh-skills.js', 'juego/assets/fh-character-core.js',
    'juego/assets/fh-survival-core.js', 'juego/core/fh-mode-selection.js',
    'juego/core/fh-session-coordinator.js', 'juego/worlds/fh-world-profile-loader.js',
    'juego/rules/legacy/fh-legacy-combat-bridge.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  // Control positivo: el propietario Legacy real escribe a través del espía.
  vm.runInContext(`FHCharacterCore.store(FHCharacterCore.createProfile({ name:'Hero', origin:'resident',
    relationship:'amigo', strengths:['FOR','AGI'], weaknesses:['VOL','PRU'], bonus:{FOR:1,AGI:1,ING:1,SOC:1} }))`, context);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], 'blakpine_character_active_v1');
  const mapKey = 'fh_game_v1_ia5-sentinel'; // Representante del espacio de claves del motor.
  localStorage.setItem(mapKey, JSON.stringify({ version: 1, state: { characterId: 'hero', inventory: ['llave'] } }));
  writes.length = 0;
  reads.length = 0;
  return { context, values, writes, reads, before: [...values] };
}
test('scripts reales: selección, rechazo y preparación no leen ni escriben guardados Legacy', async () => {
  const h = storageHarness();
  await vm.runInContext(`(async () => {
    const readJson = p => JSON.parse(readText(p));
    const officialReader = input => FHModeSelection.readSelection(input, {readJson, validate});
    const loader = FHWorldProfileLoader.create({readJson, validate});
    const official = FHSessionCoordinator.create({readSelection:officialReader, worldLoader:loader});
    assert.equal((await official.prepare(null)).kind, 'legacy');
    for (const world of ['ciudad-moderna','distopia','villa-medieval']) {
      for (const rule of ['legacy','dnd','moon-system']) {
        const input = {kind:'blakpine-mode-selection-v1',version:1,
          worldProfile:'contratos/multimodo/ejemplos/mundos/'+world+'.json',
          rulesetManifest:'contratos/multimodo/ejemplos/reglas/'+rule+'.json'};
        await officialReader(input);
        await assert.rejects(official.prepare(input), {code:'RULESET_NOT_IMPLEMENTED'});
      }
    }
    for (const rule of ['dnd','moon-system']) {
      const fixtureRead = p => {
        const data = readJson(p);
        if (p.endsWith('/reglas/'+rule+'.json')) data.status='implemented';
        return data;
      };
      const adapter = {...readJson('contratos/multimodo/ejemplos/reglas/'+rule+'.json').adapter,
        rulesetId:rule, evaluate(){assert.fail('No debe resolver combate');}};
      const coordinator = FHSessionCoordinator.create({
        readSelection: input => FHModeSelection.readSelection(input,{readJson:fixtureRead,validate}),
        worldLoader:loader,rulesAdapter:adapter});
      const input={kind:'blakpine-mode-selection-v1',version:1,
        worldProfile:'contratos/multimodo/ejemplos/mundos/ciudad-moderna.json',
        rulesetManifest:'contratos/multimodo/ejemplos/reglas/'+rule+'.json'};
      assert.equal((await coordinator.prepare(input)).kind,'prepared');
      await assert.rejects(coordinator.prepare({...input,version:99}),{code:'SELECTION_FAILED'});
    }
  })()`, h.context);
  assert.deepEqual(h.writes, []);
  assert.deepEqual(h.reads, []);
  assert.deepEqual([...h.values], h.before);
});
test('puente real solo permite al propietario guardar el perfil Legacy; rechazos no guardan', async () => {
  const h = storageHarness();
  await vm.runInContext(`(async () => {
    const state={character:FHCharacterCore.current()};
    const survival=FHSurvival.createRuntime(state,{},0);
    const before=state.character.resources.pg;
    const bridge=FHLegacyCombatBridge.create({sessionId:'session-a',playerId:'hero',authorize:()=>true,
      playerAttack(){const changed=survival.damagePG(4);if(changed)FHCharacterCore.store(state.character);return {changed};},
      structureAttack(){assert.fail('Propietario incorrecto');}});
    const action={sessionId:'session-a',rulesetId:'legacy',actionId:'one',revision:0,action:'attack',
      actor:{kind:'creature',id:'shadow'},target:{kind:'player',id:'hero'}};
    await Promise.all([bridge.executeOnce(action),bridge.executeOnce(action)]);
    for(const rulesetId of ['dnd','moon-system'])
      await assert.rejects(bridge.executeOnce({...action,rulesetId}),{code:'LEGACY_INTENT_INVALID'});
    assert.equal(FHCharacterCore.current().resources.pg,before-4);
  })()`, h.context);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0][0], 'blakpine_character_active_v1');
  const previous = JSON.parse(h.before.find(([key]) => key === 'blakpine_character_active_v1')[1]);
  const saved = JSON.parse(h.writes[0][1]);
  previous.resources.pg -= 4;
  assert.deepEqual(saved, previous); // Ningún campo multimodo añadido al perfil.
  for (const [key, value] of h.before) if (key.startsWith('fh_game_v1_')) assert.equal(h.values.get(key), value);
});
