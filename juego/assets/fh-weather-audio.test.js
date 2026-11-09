'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const WeatherAudio = require('./fh-weather-audio.js');

class Param {
 constructor(value = 0) { this.value = value;this.history = []; }
 setTargetAtTime(value) { this.value = value;this.history.push(value); }
}
class FakeNode {
 constructor() { this.connections = [];this.gain = new Param();this.frequency = new Param();this.playbackRate = new Param(1);this.loop = false;this.started = [];this.stopped = false; }
 connect(node) { this.connections.push(node);return node; }
 disconnect() { this.connections.length = 0; }
 start(when = 0) { this.started.push(when); }
 stop() { this.stopped = true; }
}
class FakeAudioContext {
 constructor() { this.sampleRate = 8000;this.currentTime = 10;this.state = 'running';this.destination = {};this.nodes = [];this.sources = [];this.closed = false; }
 createGain() { const n = new FakeNode();this.nodes.push(n);return n; }
 createBiquadFilter() { const n = new FakeNode();this.nodes.push(n);return n; }
 createBufferSource() { const n = new FakeNode();this.sources.push(n);return n; }
 createBuffer(_channels, frames) { const samples = new Float32Array(frames);return { getChannelData: () => samples }; }
 resume() { this.state = 'running';return Promise.resolve(); }
 suspend() { this.state = 'suspended';return Promise.resolve(); }
 close() { this.closed = true;return Promise.resolve(); }
}
function eventHost() {
 const listeners = new Map(), docListeners = new Map();
 const methods = (map) => ({
  addEventListener(name, fn) { if (!map.has(name)) map.set(name, new Set());map.get(name).add(fn); },
  removeEventListener(name, fn) { map.get(name)?.delete(fn); }
 });
 const host = {...methods(listeners), document: {...methods(docListeners), hidden: false }};
 host.emit = (name) => { for (const fn of listeners.get(name) || []) fn(); };
 host.visibility = () => { for (const fn of docListeners.get('visibilitychange') || []) fn(); };
 host.listeners = listeners;
 return host;
}
const rainy = (more = {}) => ({phase: 'lluvia', intensity: 1, type: 'tormenta', lightning: false, ...more});

test('el volumen ambiental distingue lluvia, aguanieve, nieve y sol', () => {
 assert.equal(WeatherAudio.rainIntensity(rainy({intensity: .23})), .23);
 assert.equal(WeatherAudio.rainIntensity(rainy({phase: 'aguanieve', intensity: .58})), .29);
 assert.equal(WeatherAudio.rainIntensity(rainy({phase: 'nieve'})), 0);
 assert.equal(WeatherAudio.rainIntensity(rainy({phase: 'ninguna'})), 0);
 assert.equal(WeatherAudio.rainIntensity(null), 0);
 assert.equal(WeatherAudio.rainIntensity(rainy({intensity: 5})), 1);
 assert.ok(WeatherAudio.thunderDelay(1) < WeatherAudio.thunderDelay(.2));
});

test('no inicia audio antes de una interacción y no falla sin Web Audio', () => {
 const host = eventHost();
 const audio = WeatherAudio.createRuntime({root: host});
 audio.update(.016, rainy({lightning: true}));
 assert.equal(audio.activate(), false);
 assert.doesNotThrow(() => audio.update(.016, rainy()));
 audio.dispose();
 assert.equal(host.listeners.get('pointerdown').size, 0);
 assert.equal(host.listeners.get('keydown').size, 0);
});

test('la lluvia se atenúa al entrar, y los truenos suenan una vez por destello y con retraso', () => {
 const host = eventHost(), ctx = new FakeAudioContext();
 let outdoors = true;
 const audio = WeatherAudio.createRuntime({root: host, outside: () => outdoors, contextFactory: () => ctx, random: () => .5});
 audio.update(.016, rainy({intensity: .58}));
 assert.equal(ctx.sources.length, 0, 'sin interacción no se crean fuentes');
 host.emit('pointerdown');
 assert.equal(ctx.sources.filter(s => s.loop).length, 2, 'dos capas continuas de lluvia');
 const rainGain = ctx.nodes.find(n => n.gain.history.includes(.58 * .82));
 assert.ok(rainGain);
 audio.update(.016, rainy({lightning: true}));
 const thunder = ctx.sources.filter(s => !s.loop);
 assert.equal(thunder.length, 1);
 assert.ok(thunder[0].started[0] > ctx.currentTime, 'trueno después del rayo');
 audio.update(.016, rainy({lightning: true}));
 assert.equal(ctx.sources.filter(s => !s.loop).length, 1, 'no repetir mientras dura el relámpago');
 audio.update(.016, rainy({lightning: false}));
 audio.update(.016, rainy({lightning: true}));
 assert.equal(ctx.sources.filter(s => !s.loop).length, 2, 'un nuevo relámpago genera otro trueno');
 outdoors = false;
 audio.update(.25, rainy({intensity: .58}));
 assert.equal(rainGain.gain.value, .58 * .28 * .82);
 assert.ok(ctx.nodes.some(n => n.frequency.value === 950), 'interior filtra las frecuencias altas');
 audio.setVolume(0);
 assert.ok(ctx.nodes.some(n => n.gain.value === 0 && n.gain.history.includes(0)));
 audio.dispose();
 assert.equal(ctx.closed, true);
 assert.ok(ctx.sources.every(s => s.stopped), 'detiene todas las fuentes activas');
});

test('visibilidad suspende y reanuda el audio, y dispose desuscribe eventos', () => {
 const host = eventHost(), ctx = new FakeAudioContext();
 const audio = WeatherAudio.createRuntime({root: host, contextFactory: () => ctx, random: () => .5});
 host.emit('keydown');
 host.document.hidden = true;host.visibility();
 assert.equal(ctx.state, 'suspended');
 host.document.hidden = false;host.visibility();
 assert.equal(ctx.state, 'running');
 audio.dispose();
 assert.equal(host.listeners.get('pointerdown').size, 0);
 assert.equal(host.listeners.get('keydown').size, 0);
});

test('la integración del motor carga audio, enlaza exterior y lo libera', () => {
 const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
 assert.match(html, /fh-weather-audio\.js/);
 assert.match(html, /FHWeatherAudio\?\.createRuntime/);
 assert.match(html, /fhWeatherAudio\?\.update\(dt,fhWeather\?\.view\(\)\)/);
 assert.match(html, /fhWeatherAudio\?\.dispose\(\)/);
});
