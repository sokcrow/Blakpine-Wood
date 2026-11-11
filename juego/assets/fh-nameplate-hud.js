/* Blakpine Wood: placa de nombre y recursos. Presentación aislada del estado real. */
(function (root, factory) {
 'use strict';
 const api = factory(root);
 if (typeof module === 'object' && module.exports) module.exports = api;
 if (root) root.FHNameplateHUD = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
 'use strict';
 const RESOURCE_KEYS = Object.freeze(['pg', 'sp', 'pe']);
 const MOOD_ICONS = Object.freeze({bueno:'☺', neutral:'−', malo:'☹'});
 const MOOD_TEXT_KEYS = Object.freeze({bueno:'good', neutral:'neutral', malo:'bad'});
 const LABELS = Object.freeze({pg:'Puntos de golpe', sp:'Puntos de sanidad', pe:'Puntos de energía'});
 let ui = null;
 let active = false;
 let frameId = null;
 let lastUpdate = -Infinity;
 const cached = {name:null,mood:null,pg:null,sp:null,pe:null};

 function reading(resources, key) {
  if (!RESOURCE_KEYS.includes(key)) return null;
  const value = resources?.[key], max = resources?.[key + 'Max'];
  if (typeof value !== 'number' || !Number.isFinite(value) ||
      typeof max !== 'number' || !Number.isFinite(max) || max <= 0) return null;
  const current = Math.max(0, Math.min(value, max));
  return {current, maximum:max, percent:current / max * 100};
 }
 function moodIcon(mood) {
  return Object.hasOwn(MOOD_ICONS, mood) ? MOOD_ICONS[mood] : '◇';
 }
 function node(tag, className, text) {
  const el = root.document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
 }
 function mount() {
  if (!root.document?.body) return false;
  if (ui?.host?.isConnected) return true;
  const previous = root.document.getElementById('fhNameplateHUD');
  if (previous) previous.remove();
  const host = node('aside', 'fh-np');
  host.id = 'fhNameplateHUD';
  host.hidden = true;
  host.setAttribute('aria-label', 'Nombre y recursos del personaje');
  const head = node('div', 'fh-np-head');
  const moodFrame = node('div', 'fh-np-mood-frame');
  const moodBevel = node('div', 'fh-np-mood-bevel');
  const moodCore = node('div', 'fh-np-mood-core');
  const moodMark = node('span', 'fh-np-mood-mark', '◇');
  moodMark.setAttribute('aria-hidden', 'true');
  moodFrame.setAttribute('role', 'img');
  moodFrame.setAttribute('aria-label', 'Humor sin datos');
  moodCore.append(moodMark);
  moodBevel.append(moodCore);
  moodFrame.append(moodBevel);
  const main = node('div', 'fh-np-main-frame');
  const mainBevel = node('div', 'fh-np-main-bevel');
  const mainCore = node('div', 'fh-np-main-core');
  const healthFill = node('div', 'fh-np-health-fill');
  const healthRule = node('span', 'fh-np-health-rule');
  const name = node('strong', 'fh-np-name');
  const pgReadout = node('div', 'fh-np-pg-readout');
  pgReadout.setAttribute('role', 'progressbar');
  pgReadout.setAttribute('aria-label', LABELS.pg);
  pgReadout.setAttribute('aria-valuemin', '0');
  mainCore.append(healthFill, healthRule, name, pgReadout);
  mainBevel.append(mainCore);
  main.append(mainBevel);
  head.append(moodFrame, main);
  const lower = node('div', 'fh-np-lower');
  const bars = {pg:{track:pgReadout, fill:healthFill}};
  for (const key of ['sp', 'pe']) {
   const outer = node('div', 'fh-np-meter fh-np-meter--' + key);
   const bevel = node('div', 'fh-np-meter-bevel');
   const well = node('div', 'fh-np-meter-well');
   const fill = node('span', 'fh-np-meter-fill');
   well.setAttribute('role', 'progressbar');
   well.setAttribute('aria-label', LABELS[key]);
   well.setAttribute('aria-valuemin', '0');
   well.append(fill);
   bevel.append(well);
   outer.append(bevel);
   lower.append(outer);
   bars[key] = {track:well, fill};
  }
  host.append(head, lower);
  root.document.body.append(host);
  ui = {host, name, moodFrame, moodMark, bars};
  cached.name = cached.mood = cached.pg = cached.sp = cached.pe = null;
  return true;
 }
 function update(character = root.FHCharacterRuntime?.character ?? null) {
  if (!mount()) return false;
  const pg = reading(character?.resources, 'pg');
  if (!character || !pg) {
   ui.host.hidden = true;
   return false;
  }
  ui.host.hidden = false;
  const name = typeof character.name === 'string' ? character.name.trim() : '';
  if (cached.name !== name) {
   ui.name.textContent = name;
   cached.name = name;
  }
  const mood = character.mental?.mood;
  if (cached.mood !== mood) {
   ui.moodMark.textContent = moodIcon(mood);
   const words = root.FH_MOOD_FEAR_TEXT;
   const translated = words?.[MOOD_TEXT_KEYS[mood]];
   ui.moodFrame.setAttribute('aria-label', typeof translated === 'string'
    ? 'Humor: ' + translated : Object.hasOwn(MOOD_ICONS, mood) ? 'Humor: ' + mood : 'Humor sin datos');
   cached.mood = mood;
  }
  for (const key of RESOURCE_KEYS) {
   const info = key === 'pg' ? pg : reading(character.resources, key);
   const bar = ui.bars[key];
   const state = info ? String(info.current) + '/' + info.maximum : '?';
   if (cached[key] === state) continue;
   cached[key] = state;
   bar.fill.style.width = (info ? info.percent : 0) + '%';
   bar.track.setAttribute('aria-valuemax', String(info?.maximum ?? 1));
   bar.track.setAttribute('aria-valuenow', String(info?.current ?? 0));
  }
  return true;
 }
 function tick(time) {
  if (!active) return;
  if (!Number.isFinite(time) || time - lastUpdate >= 90 || time < lastUpdate) {
   lastUpdate = Number.isFinite(time) ? time : 0;
   update();
  }
  frameId = root.requestAnimationFrame(tick);
 }
 function start() {
  if (active) return true;
  if (!root.document || typeof root.requestAnimationFrame !== 'function') return false;
  if (root.document.readyState === 'loading') {
   root.document.addEventListener('DOMContentLoaded', start, {once:true});
   return true;
  }
  if (!mount()) return false;
  active = true;
  frameId = root.requestAnimationFrame(tick);
  return true;
 }
 function stop() {
  active = false;
  if (frameId != null && typeof root.cancelAnimationFrame === 'function') root.cancelAnimationFrame(frameId);
  frameId = null;
 }
 if (root.document) start();
 return Object.freeze({reading, moodIcon, mount, update, start, stop});
});