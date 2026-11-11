// Reloj autoritativo del servidor de Blakpine-Wood.
// Todas las duraciones internas se expresan en minutos de juego.
export const SLEEP_RULES = Object.freeze({
  normalMinutesPerRealSecond: 1,
  sleepingMinutesPerRealSecond: 4,
  earliestSleepMinutes: 6 * 60,
  sleepyAfterMinutes: 12 * 60,
  fullSleepMinutes: 8 * 60,
});

export class ServerSleepClock {
  constructor({ gameMinutes = 0 } = {}) {
    if (!Number.isFinite(gameMinutes) || gameMinutes < 0) throw new RangeError("Hora inicial inválida");
    this.gameMinutes = gameMinutes;
    this.players = new Map();
  }

  connect(id, { awakeMinutes = 0 } = {}) {
    if (!id || this.players.has(id)) throw new Error("Jugador inválido o duplicado");
    if (!Number.isFinite(awakeMinutes) || awakeMinutes < 0) throw new RangeError("Vigilia inválida");
    this.players.set(id, { awakeMinutes, sleepingMinutes: 0, sleeping: false });
    return this.snapshot();
  }

  disconnect(id) {
    this.players.delete(id);
    return this.snapshot();
  }

  canSleep(id) {
    const p = this.requirePlayer(id);
    return !p.sleeping && p.awakeMinutes >= SLEEP_RULES.earliestSleepMinutes;
  }

  startSleep(id) {
    const p = this.requirePlayer(id);
    if (!this.canSleep(id)) return false;
    p.sleeping = true;
    p.sleepingMinutes = 0;
    return true;
  }

  requirePlayer(id) {
    const p = this.players.get(id);
    if (!p) throw new Error("Jugador no conectado");
    return p;
  }

  get accelerated() {
    return this.players.size > 0 && [...this.players.values()].every(p => p.sleeping);
  }

  // elapsedRealSeconds proviene del reloj monotónico del servidor, nunca del cliente.
  tick(elapsedRealSeconds) {
    if (!Number.isFinite(elapsedRealSeconds) || elapsedRealSeconds < 0) throw new RangeError("Delta real inválido");
    let remaining = elapsedRealSeconds;
    const wakeEvents = [];
    while (remaining > 1e-9) {
      const speed = this.accelerated
        ? SLEEP_RULES.sleepingMinutesPerRealSecond
        : SLEEP_RULES.normalMinutesPerRealSecond;
      const sleepers = [...this.players.entries()].filter(([, p]) => p.sleeping);
      const nextWake = sleepers.length
        ? Math.min(...sleepers.map(([, p]) => SLEEP_RULES.fullSleepMinutes - p.sleepingMinutes))
        : Infinity;
      const step = Math.min(remaining, Math.max(0, nextWake / speed));
      const gameDelta = step * speed;
      this.gameMinutes += gameDelta;
      for (const p of this.players.values()) {
        if (p.sleeping) p.sleepingMinutes += gameDelta;
        else p.awakeMinutes += gameDelta;
      }
      remaining -= step;
      for (const [id, p] of sleepers) {
        if (p.sleepingMinutes >= SLEEP_RULES.fullSleepMinutes - 1e-8) {
          p.sleeping = false;
          p.sleepingMinutes = 0;
          p.awakeMinutes = 0;
          wakeEvents.push(id);
        }
      }
      if (step === 0 && wakeEvents.length === 0) throw new Error("Reloj sin progreso");
    }
    return { ...this.snapshot(), wakeEvents };
  }

  snapshot() {
    return {
      gameMinutes: this.gameMinutes,
      accelerated: this.accelerated,
      minutesPerRealSecond: this.accelerated ? 4 : 1,
      players: Object.fromEntries([...this.players].map(([id, p]) => [id, {
        sleeping: p.sleeping,
        awakeMinutes: p.awakeMinutes,
        sleepingMinutes: p.sleepingMinutes,
        sleepy: !p.sleeping && p.awakeMinutes >= SLEEP_RULES.sleepyAfterMinutes,
        canSleep: !p.sleeping && p.awakeMinutes >= SLEEP_RULES.earliestSleepMinutes,
      }])),
    };
  }
}
