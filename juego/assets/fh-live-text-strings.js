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
    actionWords: Object.freeze({
      door_open: '¡ÑIIIC…!',
      door_close: '¡CLAC!',
      door_locked: '¡CLACK!',
      lamp_click: '¡TIC!',
      computer_start: '¡BIP!',
      computer_use: '¡BIP!',
      flashlight_on: '¡CLIC!',
      flashlight_off: '¡CLIC!',
      panel_open: '¡CLAC!',
      breaker_toggle: '¡CLACK!',
      elevator_call: '¡DING!',
      elevator_board: '¡CLAC!',
      stairs_step: 'TAC…',
      sit: 'FUF…',
      lie: 'FSSS…',
      stand: 'FRSS…',
      hide: 'FRSS…',
      unhide: 'FRSS…',
      open: '¡CLAC!',
      search: 'CRRR…',
      use: '¡CLIC!',
      take: 'FRSS…',
      read: 'FRSS…',
      examine: 'Mmm…',
      watch: 'BZZT…'
    }),
    next: 'Continuar diálogo',
    dialog: 'Diálogo',
    narration: 'Narración'
  });
})(typeof window !== 'undefined' ? window : globalThis);
