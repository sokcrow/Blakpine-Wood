/* Textos del sistema de narración y sonidos espaciales (español). */
(function (global) {
  'use strict';
  global.FH_LIVE_TEXT_STRINGS = Object.freeze({
    doorKnock: 'Alguien toca la puerta.',
    soundWords: Object.freeze({
      knock: '¡TOC!',
      door_knock: '¡TOC!',
      glass_break: '¡CRASH!',
      crack: '¡CRACK!',
      dragging: 'SCRRR…',
      drawer_open: 'CRRR…',
      fabric_rustle: 'FRSS…',
      tv_static: 'SHHH…'
    }),
    next: 'Continuar diálogo',
    dialog: 'Diálogo',
    narration: 'Narración'
  });
})(typeof window !== 'undefined' ? window : globalThis);
