/* Blakpine-Wood — mensajes del núcleo de dinero. */
(function (root) {
  'use strict';
  root.FH_ECONOMY_TEXT = Object.freeze({
    insufficient_funds: 'Fondos insuficientes. No se realizó ningún cobro.',
    account_missing: 'No se encontró la cuenta. No se realizó ningún cobro.',
    same_account: 'El origen y el destino deben ser cuentas diferentes.',
    amount_overflow: 'El importe supera el límite permitido.',
    id_conflict: 'El identificador ya corresponde a otra operación.',
    invalid_transaction: 'La operación contiene datos inválidos.',
    invalid_amount: 'El importe no es válido.',
    invalid_owner: 'La identidad de la cuenta es inválida.',
    storage_unavailable: 'No se pudo guardar la operación. No se confirmó el cobro.',
    economy_corrupt: 'No se pudo comprobar la integridad del historial económico.',
    confirmed: 'Operación confirmada.',
    rejected: 'Operación rechazada. No se realizó ningún cobro.'
  });
})(typeof window !== 'undefined' ? window : globalThis);
