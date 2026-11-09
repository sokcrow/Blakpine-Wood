/* Blakpine Wood — lluvia y truenos sintetizados; sin assets ni dependencias. */
(function (root, factory) {
 'use strict';
 const api = factory();
 if (root) root.FHWeatherAudio = api;
 if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
 'use strict';
 const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
 const number = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;

 function rainIntensity(view) {
  if (!view || (view.phase !== 'lluvia' && view.phase !== 'aguanieve')) return 0;
  return clamp(number(view.intensity, 0), 0, 1) * (view.phase === 'aguanieve' ? .5 : 1);
 }
 function thunderDelay(proximity) {
  return .35 + (1 - clamp(number(proximity, 0), 0, 1)) * 2.8;
 }
 function softenLoopEdge(samples, rate) {
  const edge = Math.min(Math.floor(rate * .025), Math.floor(samples.length / 4));
  for (let i = 0; i < edge; i++) {
   const gain = Math.sin((i / edge) * Math.PI / 2);
   samples[i] *= gain;samples[samples.length - 1 - i] *= gain;
  }
 }
 function makeRainBuffer(ctx, kind, random) {
  const rate = Math.min(22050, ctx.sampleRate), length = Math.floor(rate * (kind === 'drops' ? 7.3 : 5.7));
  const buffer = ctx.createBuffer(1, length, rate), samples = buffer.getChannelData(0);
  let drop = 0, smooth = 0;
  for (let i = 0; i < length; i++) {
   const noise = random() * 2 - 1;
   smooth = smooth * .96 + noise * .04;
   if (kind === 'drops') {
    if (random() < 75 / rate) drop = .4 + random() * .6;
    drop *= .993;
    samples[i] = noise * (.10 + drop * .85);
   } else {
    const swell = .88 + .12 * Math.sin(i * Math.PI * 2 / (rate * 1.7));
    samples[i] = (noise * .73 + smooth * .50) * swell;
   }
  }
  softenLoopEdge(samples, rate);
  return buffer;
 }
 function makeThunderBuffer(ctx, variant, random) {
  const rate = Math.min(11025, ctx.sampleRate), length = Math.floor(rate * 5.6);
  const buffer = ctx.createBuffer(1, length, rate), samples = buffer.getChannelData(0);
  const bursts = [0, .26 + variant * .09, .9 + variant * .16, 2.05 + variant * .19];
  let bass = 0;
  for (let i = 0; i < length; i++) {
   const t = i / rate, noise = random() * 2 - 1;
   bass = bass * .985 + noise * .015;
   let rumble = 0;
   for (let j = 0; j < bursts.length; j++) {
    const since = t - bursts[j];
    if (since < 0) continue;
    const rise = Math.min(1, since / (.012 + j * .025));
    rumble += rise * Math.exp(-since / (1.1 + j * .23)) * (j === 0 ? 1 : .43);
   }
   const crack = t < .09 ? (1 - t / .09) * (variant === 0 ? .65 : .38) : 0;
   const tail = Math.max(0, 1 - t / 5.6);
   samples[i] = clamp((bass * 3.1 + noise * .18) * rumble * .52 + noise * crack * tail, -1, 1);
  }
  return buffer;
 }
 function createRuntime({root = typeof globalThis !== 'undefined' ? globalThis : null,
  outside = () => true, volume = .65, random = Math.random, contextFactory} = {}) {
  const host = root || {}, doc = host.document;
  let ctx = null, nodes = null, disposed = false, flashWasOn = false;
  let snapshot = null, lastPositionCheck = Infinity, currentVolume = clamp(number(volume, .65), 0, 1);
  const pendingThunder = new Set();

  function createNodes(context) {
   const master = context.createGain();
   master.gain.value = currentVolume;
   master.connect(context.destination);

   const rainGain = context.createGain(), rainFilter = context.createBiquadFilter();
   rainGain.gain.value = 0;
   rainFilter.type = 'lowpass';rainFilter.frequency.value = 4500;
   rainFilter.connect(rainGain);rainGain.connect(master);
   const rainSources = [];
   for (const kind of ['bed', 'drops']) {
    const src = context.createBufferSource(), layer = context.createGain();
    src.buffer = makeRainBuffer(context, kind, random);
    src.loop = true;
    layer.gain.value = kind === 'bed' ? .38 : .29;
    src.connect(layer);layer.connect(rainFilter);src.start();
    rainSources.push(src);
   }

   const thunderFilter = context.createBiquadFilter(), thunderGain = context.createGain();
   thunderFilter.type = 'lowpass';thunderFilter.frequency.value = 1400;
   thunderFilter.connect(thunderGain);thunderGain.connect(master);
   thunderGain.gain.value = .8;
   const thunderBuffers = [makeThunderBuffer(context, 0, random), makeThunderBuffer(context, 1, random)];
   return {master, rainGain, rainFilter, rainSources, thunderFilter, thunderGain, thunderBuffers};
  }

  function activate() {
   if (disposed || doc?.hidden) return false;
   if (!ctx) {
    try {
     const Ctor = host.AudioContext || host.webkitAudioContext;
     if (!contextFactory && !Ctor) return false;
     ctx = contextFactory ? contextFactory() : new Ctor();
     nodes = createNodes(ctx);
    } catch (_) {
     try { ctx?.close(); } catch (_) { /* contexto incompleto */ }
     ctx = null;nodes = null;return false;
    }
   }
   try { const result = ctx.resume?.();result?.catch?.(() => {}); }
   catch (_) { return false; }
   applyMix(true);
   return true;
  }

  function playThunder() {
   if (!ctx || !nodes || ctx.state !== 'running' || pendingThunder.size >= 4) return;
   const proximity = .20 + random() * .8;
   const src = ctx.createBufferSource(), gain = ctx.createGain();
   src.buffer = nodes.thunderBuffers[Math.min(1, Math.floor(random() * 2))];
   src.playbackRate.value = .86 + random() * .28;
   gain.gain.value = (.22 + proximity * .76) * .75;
   src.connect(gain);gain.connect(nodes.thunderFilter);
   src.onended = () => { pendingThunder.delete(src);src.disconnect();gain.disconnect(); };
   pendingThunder.add(src);
   src.start(ctx.currentTime + thunderDelay(proximity));
  }

  function applyMix(force = false) {
   if (!ctx || !nodes) return;
   if (!force && lastPositionCheck < .12) return;
   lastPositionCheck = 0;
   let outdoors = false;
   try { outdoors = outside() === true; } catch (_) { /* silencio interior seguro */ }
   const rain = rainIntensity(snapshot);
   const now = ctx.currentTime;
   const shelter = outdoors ? 1 : .28;
   nodes.rainGain.gain.setTargetAtTime(rain * shelter * .82, now, .32);
   nodes.rainFilter.frequency.setTargetAtTime(outdoors ? 5000 : 950, now, .25);
   nodes.thunderGain.gain.setTargetAtTime(outdoors ? .8 : .43, now, .32);
   nodes.thunderFilter.frequency.setTargetAtTime(outdoors ? 1400 : 450, now, .25);
  }

  function update(dt, weather) {
   if (disposed) return;
   const lit = weather?.lightning === true;
   const newFlash = lit && !flashWasOn;
   flashWasOn = lit;
   snapshot = weather || null;
   lastPositionCheck += clamp(number(dt, 0), 0, .25);
   applyMix();
   if (newFlash) playThunder();
  }

  function setVolume(value) {
   currentVolume = clamp(number(value, currentVolume), 0, 1);
   if (ctx && nodes) nodes.master.gain.setTargetAtTime(currentVolume, ctx.currentTime, .08);
  }
  function visibilityChange() {
   if (!ctx || disposed) return;
   try {
    const action = doc?.hidden ? ctx.suspend?.() : ctx.resume?.();
    action?.catch?.(() => {});
   } catch (_) { /* el audio puede quedar suspendido por el navegador */ }
  }
  host.addEventListener?.('pointerdown', activate, {passive: true});
  host.addEventListener?.('keydown', activate);
  doc?.addEventListener?.('visibilitychange', visibilityChange);

  function dispose() {
   if (disposed) return;
   disposed = true;
   host.removeEventListener?.('pointerdown', activate);
   host.removeEventListener?.('keydown', activate);
   doc?.removeEventListener?.('visibilitychange', visibilityChange);
   for (const source of pendingThunder) { try { source.stop();source.disconnect(); } catch (_) { /* fuente terminada */ } }
   pendingThunder.clear();
   for (const source of nodes?.rainSources || []) { try { source.stop();source.disconnect(); } catch (_) { /* fuente terminada */ } }
   try { const result = ctx?.close();result?.catch?.(() => {}); } catch (_) { /* navegador cerrando */ }
   ctx = null;nodes = null;snapshot = null;
  }
  return Object.freeze({update, setVolume, activate, dispose});
 }
 return Object.freeze({rainIntensity, thunderDelay, createRuntime});
});
