'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const map = require('../forest-horror/maps/DEMO_DnD_Iluminacion.json');
const mime = {
 '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
};

test('Chromium: arranque real Lumen + D&D, guardado aislado y vista 3D Legacy', {
 skip: process.env.LUMEN_BROWSER_TEST !== '1', timeout: 120000,
}, async () => {
 const { chromium } = require('playwright');
 const server = http.createServer(async (req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try {
   const data = await fs.readFile(file);
   res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }).end(data);
  } catch {
   res.writeHead(404).end();
  }
 });
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 const origin = 'http://127.0.0.1:' + server.address().port;
 let browser;
 try {
  browser = await chromium.launch({
   executablePath: process.env.LUMEN_CHROMIUM_PATH || undefined,
   args: ['--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 650 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
   if (message.type() === 'error' && message.text().startsWith('[')) errors.push(message.text());
  });
  await page.addInitScript(() => {
   if (window.parent !== window) {
    window.previewStorageWrites = [];
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
     window.previewStorageWrites.push(key);
     return write.call(this, key, value);
    };
    return;
   }
   window.previewPackets = [];
   window.addEventListener('message', event => {
    if (event.source !== document.getElementById('play3dFrame')?.contentWindow) return;
    if (event.data?.type?.startsWith('FOREST_')) window.previewPackets.push(event.data);
   });
  });

  async function running() {
   await page.waitForFunction(() => preview3DRunning || preview3DDiagnosticFailed, { }, { timeout: 35000 });
   assert.equal(await page.evaluate(() => preview3DRunning && !preview3DDiagnosticFailed), true,
    JSON.stringify(await page.evaluate(() => document.getElementById('play3dState')?.textContent)) + '\n' + errors.join('\n'));
   assert.ok(await page.evaluate(() => window.previewPackets.some(packet =>
    packet.type === 'FOREST_PREVIEW_RUNNING' && !packet.unverified)));
   const frame = page.frames().find(candidate => candidate.url() === 'about:srcdoc');
   assert.ok(frame);
   assert.equal(await frame.evaluate(() => window.ForestHorrorLoadedMap?.createdAt), map.createdAt);
   return frame;
  }

  await page.goto(origin + '/index.html?editor=1&lumenCartridge=1');
  const { legacyKey, legacyRaw, characterId } = await page.evaluate(map => {
   const legacy = FHCharacterCore.store(FHCharacterCore.createProfile({
    name: 'Prueba Legacy', origin: 'resident', relationship: 'amigo',
    strengths: ['FOR', 'AGI'], weaknesses: ['VOL', 'PRU'], bonus: { FOR: 1, AGI: 1, ING: 2 },
   }));
   const legacyKey = ForestShared.gameSaveKey(map);
   const legacyRaw = JSON.stringify({ version: 1, state: { characterId: legacy.id, flags: { legacyOnly: true } } });
   localStorage.setItem(legacyKey, legacyRaw);
   const character = FHDndCharacterManager.registry(localStorage).upsert({
    name: 'Ada', character: FHDndSheet.createCharacter({
     name: 'Ada', classId: 'wizard', level: 1, hp: 7, maxHp: 7, armorClass: 12,
     abilities: { str: 8, dex: 14, con: 12, int: 17, wis: 13, cha: 10 },
     hitDice: { sides: 6, total: 1, available: 1 },
     attacks: [{ id: 'dagger', name: 'Daga', ability: 'dex', damageCount: 1,
      damageDie: 4, damageType: 'piercing', rangeFt: 5, proficient: true }],
    }),
   });
   return { legacyKey, legacyRaw, characterId: character.id };
  }, map);

  async function startDnd() {
   await page.evaluate(map => {
    window.previewPackets.length = 0;
    LumenEditor.setRuleset('dnd');
    LumenEditor.play(map, () => {});
   }, map);
   await page.locator('#fh-dnd-character-dialog button[type="submit"]').click();
   return running();
  }

  let frame = await startDnd();
  assert.equal(await page.evaluate(() => preview3DArchitectureError), '');
  const status = await frame.evaluate(() => ({
   combat: window.FHDndCombatSession?.getStatus(), shadow: window.FHShadowRuntime,
   legacySave: window.ForestHorrorLoadedMap.__runtimeSave,
   selection: window.ForestHorrorLoadedMap.__multimodeSave.identity,
  }));
  assert.equal(status.combat?.rulesetId, 'dnd');
  assert.equal(status.combat?.connected, true);
  assert.equal(status.shadow, null);
  assert.equal(status.legacySave, null);
  assert.equal(status.selection.characterId, characterId);
  assert.equal(status.selection.mapId, map.createdAt);

  const torch = map.floors[0].items.find(item => item.lightKind === 'torch_hand');
  await frame.evaluate(id => {
   const item = window.ForestHorrorLoadedMap.floors[0].items.find(item => item.id === id);
   if (!window.FHMedievalRuntime.interact(0, item).ok) throw Error('No se pudo recoger la antorcha');
   window.FHEquipmentGame.save();
  }, torch.id);
  const save = await (await page.waitForFunction(id => window.previewPackets.find(packet =>
   packet.type === 'FOREST_MULTIMODE_SAVE' &&
   JSON.parse(packet.json).state.world.runtime.medievalLighting?.[id]?.carried), torch.id)).jsonValue();
  assert.ok(save.key.startsWith('blakpine_multimode_save_v1:'));
  assert.equal(await page.evaluate(key => localStorage.getItem(key) !== null, save.key), true);
  assert.equal(await frame.evaluate(keys => window.previewStorageWrites.some(key => keys.includes(key)),
   [legacyKey, save.key]), false);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), legacyKey), legacyRaw);

  const architecture = await page.evaluateHandle(() => window.FHArchitectureSkins);
  await page.evaluate(() => {
   LumenEditor.stop();
   window.FHArchitectureSkins = undefined;
  });
  frame = await startDnd();
  assert.notEqual(await page.evaluate(() => preview3DArchitectureError), '');
  assert.equal(await frame.evaluate(id => window.FHMedievalRuntime.isCarried(id), torch.id), true);
  await page.evaluate(architecture => {
   LumenEditor.stop();
   window.FHArchitectureSkins = architecture;
  }, architecture);
  await architecture.dispose();

  await page.evaluate(map => {
   window.previewPackets.length = 0;
   LumenEditor.setRuleset('legacy');
   LumenEditor.play(map, () => {});
  }, map);
  frame = await running();
  assert.equal(await frame.evaluate(() => !!window.FHLegacyCombatSession && !!window.FHShadowRuntime), true);
  assert.equal(await frame.evaluate(() => typeof window.FHDndCombatSession), 'undefined');
  assert.equal(await page.evaluate(key => localStorage.getItem(key), legacyKey), legacyRaw);

  await page.goto(origin + '/index.html?editor=1');
  await page.evaluate(map => importProject(map), map);
  await page.locator('#testBtn').click();
  frame = await running();
  await frame.evaluate(() => window.FHEquipmentGame.save());
  await page.waitForFunction(({ legacyKey, legacyRaw }) =>
   window.previewPackets.some(packet => packet.type === 'FOREST_GAMESTATE_SAVE' && packet.key === legacyKey) &&
   localStorage.getItem(legacyKey) !== legacyRaw, { legacyKey, legacyRaw });
  assert.equal(await frame.evaluate(() => typeof window.FHDndCombatSession), 'undefined');
 } finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
 }
});
