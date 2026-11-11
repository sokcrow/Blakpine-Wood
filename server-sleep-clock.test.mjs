import test from 'node:test';
import assert from 'node:assert/strict';
import { ServerSleepClock } from './server-sleep-clock.mjs';

test('normal: 1 minuto de juego por segundo real', () => {
  const c = new ServerSleepClock();
  c.connect('a');
  assert.equal(c.tick(60).gameMinutes, 60);
  assert.equal(c.snapshot().players.a.awakeMinutes, 60);
});
test('sueño anticipado a las 6 horas y Sueño a las 12', () => {
  const c = new ServerSleepClock();
  c.connect('a');
  c.tick(359);
  assert.equal(c.canSleep('a'), false);
  c.tick(1);
  assert.equal(c.canSleep('a'), true);
  assert.equal(c.snapshot().players.a.sleepy, false);
  c.tick(360);
  assert.equal(c.snapshot().players.a.sleepy, true);
});
test('acelera únicamente cuando todos duermen y despierta tras 8 horas', () => {
  const c = new ServerSleepClock();
  c.connect('a', {awakeMinutes: 360});
  c.connect('b', {awakeMinutes: 360});
  c.startSleep('a');
  assert.equal(c.accelerated, false);
  c.startSleep('b');
  assert.equal(c.accelerated, true);
  const result = c.tick(120);
  assert.deepEqual(result.wakeEvents, ['a','b']);
  assert.equal(result.gameMinutes, 480);
  assert.equal(c.accelerated, false);
  assert.equal(c.canSleep('a'), false);
});
test('un jugador nuevo despierto desactiva aceleración', () => {
  const c = new ServerSleepClock();
  c.connect('a', {awakeMinutes: 360});
  c.startSleep('a');
  c.connect('b');
  assert.equal(c.accelerated, false);
  c.tick(15);
  assert.equal(c.snapshot().players.a.sleepingMinutes, 15);
});
test('desconexión recalcula consenso y servidor vacío no acelera', () => {
  const c = new ServerSleepClock();
  c.connect('a', {awakeMinutes: 360});
  c.connect('b');
  c.startSleep('a');
  c.disconnect('b');
  assert.equal(c.accelerated, true);
  c.disconnect('a');
  assert.equal(c.accelerated, false);
});
test('cambio de velocidad dentro del mismo tick no adelanta horas', () => {
  const c = new ServerSleepClock();
  c.connect('a', {awakeMinutes: 360});
  c.startSleep('a');
  c.tick(130);
  assert.equal(c.gameMinutes, 490);
  assert.equal(c.snapshot().players.a.awakeMinutes, 10);
});
