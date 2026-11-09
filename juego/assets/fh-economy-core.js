/* Blakpine-Wood — núcleo económico universal. Sin dependencias del mapa ni del DOM. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FHEconomyCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const VERSION = 1;
  const STORAGE_KEY = 'blakpine_economy_world_v1';
  const OWNER_TYPES = Object.freeze(['character', 'npc', 'business', 'municipality']);
  const ACCOUNT_KINDS = Object.freeze(['cash', 'bank']);
  const OPERATIONS = Object.freeze(['credit', 'debit', 'transfer']);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const copy = value => JSON.parse(JSON.stringify(value));
  const cents = value => Number.isSafeInteger(value) && value >= 0;
  const nonEmpty = value => typeof value === 'string' && value.length > 0 && value.length <= 160 &&
    value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value);
  const validAccountId = id => typeof id === 'string' && id.startsWith('account:') && id.length <= 600;

  function usdToCents(value) {
    if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value))
      throw new TypeError('invalid_amount');
    const [whole, fraction = ''] = value.split('.');
    const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
    if (!cents(result)) throw new RangeError('amount_overflow');
    return result;
  }
  function formatUsd(value) {
    if (!cents(value)) throw new TypeError('invalid_amount');
    const whole = Math.floor(value / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return '$' + whole + '.' + String(value % 100).padStart(2, '0');
  }
  function accountId(ownerType, ownerId, kind) {
    if (!OWNER_TYPES.includes(ownerType) || !nonEmpty(ownerId) || !ACCOUNT_KINDS.includes(kind))
      throw new TypeError('invalid_owner');
    return 'account:' + ownerType + ':' + encodeURIComponent(ownerId) + ':' + kind;
  }
  function createEconomy() {
    return { version: VERSION, currency: 'USD', accounts: {}, transactions: [] };
  }
  function ensureAccount(state, { ownerType, ownerId, kind }) {
    const id = accountId(ownerType, ownerId, kind);
    const next = copy(state);
    if (!own(next.accounts, id)) {
      next.accounts[id] = { id, ownerType, ownerId, kind, balanceCents: 0 };
    }
    return { state: next, accountId: id, created: !own(state.accounts, id) };
  }
  function ensureOwner(state, { ownerType, ownerId }) {
    let next = state;
    const accountIds = {};
    let created = false;
    for (const kind of ACCOUNT_KINDS) {
      const result = ensureAccount(next, { ownerType, ownerId, kind });
      next = result.state;
      accountIds[kind] = result.accountId;
      created = created || result.created;
    }
    return { state: next, accountIds, created };
  }
  function getBalance(state, id) {
    if (!own(state.accounts, id)) return null;
    return state.accounts[id].balanceCents;
  }
  function normalizeRequest(operation, request) {
    if (!OPERATIONS.includes(operation) || !request || !nonEmpty(request.id) ||
      !cents(request.amountCents) || request.amountCents === 0 || !nonEmpty(request.category) ||
      !Number.isSafeInteger(request.gameMinutes) || request.gameMinutes < 0)
      throw new TypeError('invalid_transaction');
    const tx = {
      id: request.id, operation, amountCents: request.amountCents,
      category: request.category, gameMinutes: request.gameMinutes,
      from: operation === 'credit' ? null : request.from,
      to: operation === 'debit' ? null : request.to,
      externalRef: operation === 'transfer' ? null : request.externalRef
    };
    if (operation === 'credit' && !validAccountId(tx.to) ||
        operation === 'debit' && !validAccountId(tx.from) ||
        operation === 'transfer' && (!validAccountId(tx.from) || !validAccountId(tx.to)) ||
        operation !== 'transfer' && !nonEmpty(tx.externalRef))
      throw new TypeError('invalid_transaction');
    return tx;
  }
  function transactionSignature(tx) {
    return JSON.stringify([tx.operation, tx.amountCents, tx.category, tx.gameMinutes, tx.from, tx.to, tx.externalRef]);
  }
  function post(state, tx) {
    let reason = null;
    const source = tx.from === null ? null : state.accounts[tx.from];
    const target = tx.to === null ? null : state.accounts[tx.to];
    if ((tx.from !== null && !source) || (tx.to !== null && !target)) reason = 'account_missing';
    else if (source && target && source.id === target.id) reason = 'same_account';
    else if (source && source.balanceCents < tx.amountCents) reason = 'insufficient_funds';
    else if (target && !cents(target.balanceCents + tx.amountCents)) reason = 'amount_overflow';
    const entries = [];
    if (!reason) {
      if (source) {
        source.balanceCents -= tx.amountCents;
        entries.push({ accountId: source.id, deltaCents: -tx.amountCents });
      }
      if (target) {
        target.balanceCents += tx.amountCents;
        entries.push({ accountId: target.id, deltaCents: tx.amountCents });
      }
    }
    const record = { ...tx, status: reason ? 'rejected' : 'confirmed', reason, entries };
    state.transactions.push(record);
    return record;
  }
  function apply(state, operation, request) {
    const tx = normalizeRequest(operation, request);
    const duplicate = state.transactions.find(item => item.id === tx.id);
    if (duplicate) {
      if (transactionSignature(duplicate) !== transactionSignature(tx))
        return { state, ok: false, reason: 'id_conflict', duplicate: true, transaction: null };
      return { state, ok: duplicate.status === 'confirmed', reason: duplicate.reason,
        duplicate: true, transaction: copy(duplicate) };
    }
    const next = copy(state);
    const record = post(next, tx);
    return { state: next, ok: record.status === 'confirmed', reason: record.reason,
      duplicate: false, transaction: copy(record) };
  }
  function credit(state, request) { return apply(state, 'credit', request); }
  function debit(state, request) { return apply(state, 'debit', request); }
  function transfer(state, request) { return apply(state, 'transfer', request); }

  function restore(raw) {
    let state;
    try { state = typeof raw === 'string' ? JSON.parse(raw) : copy(raw); }
    catch { throw new Error('economy_corrupt'); }
    if (!state || state.version !== VERSION || state.currency !== 'USD' ||
        !state.accounts || Array.isArray(state.accounts) || typeof state.accounts !== 'object' ||
        !Array.isArray(state.transactions)) throw new Error('economy_corrupt');
    try {
      const rebuilt = createEconomy();
      for (const [id, account] of Object.entries(state.accounts)) {
        if (!account || id !== accountId(account.ownerType, account.ownerId, account.kind) ||
            account.id !== id || !cents(account.balanceCents)) throw new Error('corrupt_account');
        rebuilt.accounts[id] = { ...account, balanceCents: 0 };
      }
      const ids = new Set();
      for (const tx of state.transactions) {
        if (!tx || ids.has(tx.id)) throw new Error('duplicate_transaction');
        ids.add(tx.id);
        const expected = normalizeRequest(tx.operation, tx);
        if (transactionSignature(tx) !== transactionSignature(expected)) throw new Error('invalid_transaction');
        const record = post(rebuilt, expected);
        if (record.status !== tx.status || record.reason !== tx.reason ||
            JSON.stringify(record.entries) !== JSON.stringify(tx.entries)) throw new Error('invalid_journal');
      }
      for (const [id, account] of Object.entries(state.accounts)) {
        if (account.balanceCents !== rebuilt.accounts[id].balanceCents) throw new Error('balance_mismatch');
      }
      return copy(state);
    } catch { throw new Error('economy_corrupt'); }
  }
  function serialize(state) { return JSON.stringify(restore(state)); }

  // Cada cambio se prepara y se graba en una sola escritura. Un fallo no se anuncia como pago.
  function openStore(storage, key = STORAGE_KEY) {
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function')
      throw new TypeError('storage_unavailable');
    function read() {
      const raw = storage.getItem(key);
      return raw === null ? createEconomy() : restore(raw);
    }
    function commit(state) { storage.setItem(key, serialize(state)); }
    function addAccount(params) {
      const current = read();
      const result = ensureAccount(current, params);
      if (result.created) commit(result.state);
      return { accountId: result.accountId, created: result.created };
    }
    function addOwner(params) {
      const current = read();
      const result = ensureOwner(current, params);
      if (result.created) commit(result.state);
      return { accountIds: result.accountIds, created: result.created };
    }
    function run(operation, request) {
      const result = apply(read(), operation, request);
      if (!result.duplicate) commit(result.state);
      return { ok: result.ok, reason: result.reason, duplicate: result.duplicate,
        transaction: result.transaction };
    }
    return Object.freeze({ read, ensureAccount: addAccount, ensureOwner: addOwner,
      getBalance: id => getBalance(read(), id),
      credit: request => run('credit', request), debit: request => run('debit', request),
      transfer: request => run('transfer', request) });
  }
  return Object.freeze({ VERSION, STORAGE_KEY, OWNER_TYPES, ACCOUNT_KINDS, OPERATIONS,
    usdToCents, formatUsd, accountId, createEconomy, ensureAccount, ensureOwner,
    getBalance, credit, debit, transfer, restore, serialize, openStore });
});
