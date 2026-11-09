'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./fh-economy-core.js');
const money = () => E.createEconomy();
const character = { ownerType: 'character', ownerId: 'player-1' };
const npc = { ownerType: 'npc', ownerId: 'npc-1' };
const business = { ownerType: 'business', ownerId: 'shop-1' };
const city = { ownerType: 'municipality', ownerId: 'city-1' };
const req = (id, rest = {}) => ({ id, category: 'test', gameMinutes: 480, amountCents: 100, ...rest });
const setup = () => {
  let state = money();
  const a = E.ensureOwner(state, character); state = a.state;
  const n = E.ensureOwner(state, npc); state = n.state;
  const b = E.ensureOwner(state, business); state = b.state;
  const c = E.ensureOwner(state, city); state = c.state;
  return { state, a: a.accountIds, n: n.accountIds, b: b.accountIds, c: c.accountIds };
};

test('USD usa centavos enteros sin redondeos ni NaN', () => {
  assert.equal(E.usdToCents('0.01'), 1);
  assert.equal(E.usdToCents('15.75'), 1575);
  assert.equal(E.formatUsd(1575), '$15.75');
  for (const wrong of ['0.001', '1e3', '-1', 'NaN', '1,000', '1.2.3', 1.25, '9007199254740992'])
    assert.throws(() => E.usdToCents(wrong));
});

test('personajes, NPC, comercios y municipio tienen cuentas separadas', () => {
  const { state, a, n, b, c } = setup();
  assert.equal(Object.keys(state.accounts).length, 8);
  assert.equal(new Set([a.cash, n.cash, b.cash, c.cash]).size, 4);
  assert.equal(E.getBalance(state, a.bank), 0);
});

test('cobro rechazado conserva fondos y queda en el historial', () => {
  const { state, a, b } = setup();
  const result = E.transfer(state, req('payment-1', { from: a.cash, to: b.bank }));
  assert.equal(result.ok, false);
  assert.equal(result.transaction.status, 'rejected');
  assert.equal(result.transaction.reason, 'insufficient_funds');
  assert.deepEqual(result.transaction.entries, []);
  assert.equal(E.getBalance(result.state, a.cash), 0);
  assert.equal(E.getBalance(result.state, b.bank), 0);
  assert.equal(result.state.transactions.length, 1);
});

test('abono explícito y transferencia conservan suma de saldos', () => {
  let { state, a, b } = setup();
  const first = E.credit(state, req('issue', { to: a.cash, amountCents: 15000, category: 'initial', externalRef: 'system:initial' }));
  assert.equal(first.ok, true);
  state = first.state;
  const total = Object.values(state.accounts).reduce((sum, item) => sum + item.balanceCents, 0);
  const result = E.transfer(state, req('sale', { from: a.cash, to: b.bank, amountCents: 7050, category: 'sale' }));
  assert.equal(result.ok, true);
  assert.equal(E.getBalance(result.state, a.cash), 7950);
  assert.equal(E.getBalance(result.state, b.bank), 7050);
  assert.equal(Object.values(result.state.accounts).reduce((sum, item) => sum + item.balanceCents, 0), total);
  assert.equal(result.transaction.entries.reduce((sum, item) => sum + item.deltaCents, 0), 0);
  assert.equal(E.getBalance(state, a.cash), 15000);
});

test('cuenta de NPC paga a personaje; tienda y municipio independientes', () => {
  let { state, a, n, b, c } = setup();
  state = E.credit(state, req('npc-seed', { to: n.cash, amountCents: 1000, externalRef: 'system:seed' })).state;
  state = E.transfer(state, req('npc-to-char', { from: n.cash, to: a.cash, amountCents: 330 })).state;
  assert.equal(E.getBalance(state, n.cash), 670);
  assert.equal(E.getBalance(state, a.cash), 330);
  assert.equal(E.getBalance(state, b.cash), 0);
  assert.equal(E.getBalance(state, c.cash), 0);
});

test('misma operación no se duplica; colisión del ID no se admite', () => {
  let { state, a } = setup();
  const initial = req('once', { to: a.cash, externalRef: 'system:startup' });
  const first = E.credit(state, initial); state = first.state;
  const again = E.credit(state, initial);
  assert.equal(again.duplicate, true);
  assert.equal(again.ok, true);
  assert.equal(again.state.transactions.length, 1);
  assert.equal(E.getBalance(again.state, a.cash), 100);
  const collision = E.credit(state, { ...initial, amountCents: 101 });
  assert.equal(collision.reason, 'id_conflict');
  assert.equal(collision.transaction, null);
  assert.equal(collision.state.transactions.length, 1);
});

test('rechazo con mismo ID conserva resultado original', () => {
  const { state, a } = setup();
  const input = req('rejected-once', { from: a.cash, externalRef: 'system:test' });
  const rejected = E.debit(state, input);
  const repeat = E.debit(rejected.state, input);
  assert.equal(repeat.reason, 'insufficient_funds');
  assert.equal(repeat.duplicate, true);
  assert.equal(repeat.state.transactions.length, 1);
});

test('reglas de importe, cuentas y límite seguro impiden alterar los saldos', () => {
  let { state, a, n } = setup();
  for (const amount of [NaN, Infinity, -1, 0, 0.1])
    assert.throws(() => E.credit(state, req('bad-' + String(amount), { to: a.cash, amountCents: amount, externalRef: 'system:seed' })));
  const missing = E.credit(state, req('absent', { to: 'account:character:missing:bank', externalRef: 'system:seed' }));
  assert.equal(missing.reason, 'account_missing');
  const same = E.transfer(state, req('same', { from: a.cash, to: a.cash }));
  assert.equal(same.reason, 'same_account');
  state = E.credit(state, req('max', { to: a.cash, amountCents: Number.MAX_SAFE_INTEGER, externalRef: 'system:seed' })).state;
  const over = E.credit(state, req('overflow', { to: a.cash, amountCents: 1, externalRef: 'system:seed' }));
  assert.equal(over.reason, 'amount_overflow');
  assert.equal(E.getBalance(over.state, a.cash), Number.MAX_SAFE_INTEGER);
  assert.equal(E.getBalance(over.state, n.cash), 0);
});

test('serialización conserva cuentas y movimientos y detecta corrupciones', () => {
  let { state, a, b } = setup();
  state = E.credit(state, req('issue', { to: a.cash, externalRef: 'system:startup' })).state;
  state = E.transfer(state, req('sale', { from: a.cash, to: b.cash, amountCents: 40 })).state;
  state = E.debit(state, req('reject', { from: b.cash, amountCents: 1000, externalRef: 'system:fees' })).state;
  const raw = E.serialize(state);
  assert.deepEqual(E.restore(raw), state);
  for (const tamper of [
    p => { p.accounts[a.cash].balanceCents = 999; },
    p => { p.transactions[1].entries[0].deltaCents = 40; },
    p => { p.transactions[2].status = 'confirmed'; },
    p => { p.transactions[1].id = 'issue'; }
  ]) {
    const p = JSON.parse(raw); tamper(p);
    assert.throws(() => E.restore(p), /economy_corrupt/);
  }
});

test('persistencia hace una sola escritura y no confirma cobros si falla guardar', () => {
  const data = new Map();
  let broken = false;
  const storage = {
    getItem: k => data.has(k) ? data.get(k) : null,
    setItem: (k, v) => { if (broken) throw new Error('storage_quota'); data.set(k, v); }
  };
  const db = E.openStore(storage);
  const { accountIds } = db.ensureOwner(character);
  assert.equal(db.ensureOwner(character).created, false);
  db.credit(req('one', { to: accountIds.cash, externalRef: 'system:startup' }));
  assert.equal(db.getBalance(accountIds.cash), 100);
  broken = true;
  assert.throws(() => db.debit(req('fail', { from: accountIds.cash, externalRef: 'system:fees' })), /storage_quota/);
  assert.equal(db.getBalance(accountIds.cash), 100);
  broken = false;
  const result = db.debit(req('fail', { from: accountIds.cash, externalRef: 'system:fees' }));
  assert.equal(result.ok, true);
  assert.equal(db.getBalance(accountIds.cash), 0);
  assert.equal(db.read().transactions.filter(x => x.id === 'fail').length, 1);
});

test('estado corrupto no se sobrescribe silenciosamente ni recrea fondos', () => {
  const data = new Map([[E.STORAGE_KEY, '{broken']]);
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k,v) => data.set(k,v) };
  const db = E.openStore(storage);
  assert.throws(() => db.ensureOwner(character), /economy_corrupt/);
  assert.equal(data.get(E.STORAGE_KEY), '{broken');
});
