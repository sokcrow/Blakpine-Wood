'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('el adaptador inserta audición y SFX sin romper el motor 3D embebido', () => {
  const root = path.resolve(__dirname, '../..');
  const editor = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const find = (start, end) => {
    const from = editor.indexOf(start), to = editor.indexOf(end, from);
    assert.ok(from >= 0 && to > from, 'Falta adaptador '+start);
    return editor.slice(from, to).trim();
  };
  const sandbox = { window: {} };
  for (let i = 0; i <= 12; i++) {
    const file = 'engine-'+String(i).padStart(2, '0')+'.js';
    vm.runInNewContext(fs.readFileSync(path.join(root, 'juego/assets', file), 'utf8'), sandbox);
  }
  const motor = Buffer.from(sandbox.window.__FOREST_EMBEDDED_ENGINE__, 'base64').toString('utf8');
  const delivery = vm.runInNewContext('('+find('function addDeliveryToEngine(doc){', 'const engineSuccessBefore=')+')');
  const live = vm.runInNewContext('('+find('function addLiveTextToEngine(doc){', '\nfunction prepareGLBEngineDoc')+')',
    { URL, document: { baseURI: 'https://example.test/' } });
  const patched = live(delivery(motor));
  assert.match(patched, /fh-hearing\.js/);
  assert.match(patched, /hearingRadius:LOOK_RADIUS/);
  assert.match(patched, /FHHearing\?\.buildObstacles/);
  assert.match(patched, /playSfxAt\(\{id:d\.open\?'door_open':'door_close'/);
  assert.doesNotMatch(patched, /notice\(d\.open\?'Abres la puerta\.'/);
  const first = patched.lastIndexOf('<script>') + 8, last = patched.lastIndexOf('</script>');
  assert.ok(first > 7 && last > first);
  assert.doesNotThrow(() => new vm.Script(patched.slice(first, last)));
});
