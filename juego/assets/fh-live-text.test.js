const test = require('node:test');
const assert = require('node:assert/strict');
require('./fh-live-text-strings.js');
require('./fh-live-text.js');
const ui = globalThis.FHLiveText;

test('la puntuación define distintas pausas y puntos suspensivos únicos', () => {
  const chars = Array.from('Eh, espera... ¡No! ¿Quién?');
  assert.equal(ui.delayAfter(chars,2),ui.PAUSE.comma);
  const dot = chars.indexOf('.');
  assert.equal(ui.delayAfter(chars,dot),ui.PAUSE.letter);
  assert.equal(ui.delayAfter(chars,dot+1),ui.PAUSE.letter);
  assert.equal(ui.delayAfter(chars,dot+2),ui.PAUSE.ellipsis);
  assert.equal(ui.delayAfter(chars,chars.indexOf('!')),ui.PAUSE.exclamation);
  assert.equal(ui.delayAfter(chars,chars.lastIndexOf('?')),ui.PAUSE.question);
  assert.equal(ui.delayAfter(['.'],0),ui.PAUSE.period);
});

test('el texto de distintas emociones ocupa una sola medición completa', () => {
  const pages = ui.normalizePages({
    speaker:'Guardabosques',kind:'npc',mood:'normal',
    text:'No te acerques...',
    segments:[{text:'No te acerques',mood:'miedo'},{text:'...',mood:'grito'}]
  });
  assert.equal(pages.length,1);
  assert.equal(pages[0].text,'No te acerques...');
  assert.equal(pages[0].kind,'npc');
  assert.equal(pages[0].speaker,'Guardabosques');
  assert.deepEqual(pages[0].segments.map(s=>s.mood),['miedo','grito']);
});

test('un evento sin hablante se distingue de diálogo de NPC', () => {
  const pages=ui.normalizePages({pages:['Se oyen pasos.','La puerta se abre.']});
  assert.deepEqual(pages.map(p=>p.kind),['event','event']);
  assert.deepEqual(pages.map(p=>p.text),['Se oyen pasos.','La puerta se abre.']);
});

test('la proximidad auditiva respeta distancia 3D y datos inválidos', () => {
  const listener={x:0,y:2,z:0};
  assert.equal(ui.audible({x:3,y:2,z:4},listener,5),true);
  assert.equal(ui.audible({x:3,y:8,z:4},listener,5),false);
  assert.equal(ui.audible({x:3,y:2,z:4},listener,4.99),false);
  assert.equal(ui.audible({x:NaN,y:2,z:0},listener,10),false);
  assert.equal(ui.audible({x:0,y:2,z:0},listener,0),false);
});


test('los textos extensos se dividen sin perder palabras ni emoción', () => {
  const scary = 'Algo camina detrás de la puerta. '.repeat(9);
  const shout = '¡SAL DE AHÍ!';
  const pages=ui.normalizePages({speaker:'Guardabosques',segments:[{text:scary,mood:'miedo'},{text:shout,mood:'impacto'}]});
  assert.ok(pages.length>1);
  assert.equal(pages.map(p=>p.text).join(''),scary+shout);
  assert.equal(pages.flatMap(p=>p.segments).map(s=>s.text).join(''),scary+shout);
  assert.equal(pages.at(-1).segments.at(-1).mood,'impacto');
  assert.ok(pages.every(p=>p.kind==='npc' && p.speaker==='Guardabosques'));
});
