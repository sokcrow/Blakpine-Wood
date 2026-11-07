/* Blakpine Wood — audición por eventos, sin renderizado ni dependencias. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FHHearing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_RANGE_METERS = 10.4; // LOOK_RADIUS del motor 3D; se inyecta el valor real en la vista.
  const MIN_AUDIBLE_GAIN = 0.025;
  const TRANSMISSION = Object.freeze({
    wall: 0.25, red_wall: 0.25, property_wall: 0.25,
    half_wall: 0.65, window: 0.70, door: 0.50
  });
  const SEGMENT_TYPES = new Set(['wall', 'red_wall', 'property_wall', 'half_wall', 'window']);
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const valid2D = point => point && finite(point.x) && finite(point.z);

  // La geometría procede del mapa y de las puertas vivas; las colisiones no se recalculan.
  function buildObstacles(items, doors, cell = 1.524) {
    const meters = Number.isFinite(cell) && cell > 0 ? cell : 1.524;
    const result = [];
    for (const item of items || []) {
      if (!SEGMENT_TYPES.has(item?.type) || !item.a || !item.b ||
          ![item.a.x, item.a.y, item.b.x, item.b.y].every(finite)) continue;
      result.push({
        x1: item.a.x * meters, z1: item.a.y * meters,
        x2: item.b.x * meters, z2: item.b.y * meters,
        type: item.type
      });
    }
    for (const door of doors || []) {
      const block = door?.block;
      if (!block || ![block.x1, block.z1, block.x2, block.z2].every(finite)) continue;
      result.push({ x1: block.x1, z1: block.z1, x2: block.x2, z2: block.z2,
        type: 'door', open: door.open === true });
    }
    return result;
  }

  // Retorna la fracción de la línea oyente→fuente donde cruza el segmento.
  function crossing(from, source, segment) {
    const dx = source.x - from.x, dz = source.z - from.z;
    const sx = segment.x2 - segment.x1, sz = segment.z2 - segment.z1;
    const den = dx * sz - dz * sx;
    if (Math.abs(den) < 1e-10) return null;
    const px = segment.x1 - from.x, pz = segment.z1 - from.z;
    const t = (px * sz - pz * sx) / den;
    const u = (px * dz - pz * dx) / den;
    // Un sonido originado en una puerta no debe amortiguarse por su propia hoja.
    return t > 0.0001 && t < 0.9999 && u >= -0.0001 && u <= 1.0001 ? t : null;
  }

  function evaluate(source, options = {}) {
    const listener = options.listener;
    const radius = finite(options.radius) && options.radius > 0 ? options.radius : MAX_RANGE_METERS;
    const requested = finite(source?.range) && source.range > 0 ? source.range : radius;
    const range = Math.min(radius, requested);
    const empty = (distance = Infinity) => ({ audible: false, volume: 0, distance, barriers: 0, range });
    if (!valid2D(source) || !valid2D(listener)) return empty();
    if (source.floor != null && options.floor != null && source.floor !== options.floor) return empty();
    const dy = finite(source.y) && finite(listener.y) ? source.y - listener.y : 0;
    const distance = Math.hypot(source.x - listener.x, source.z - listener.z, dy);
    if (distance >= range) return empty(distance);

    const hits = [];
    for (const segment of options.obstacles || []) {
      const transmission = TRANSMISSION[segment?.type];
      if (transmission == null || (segment.type === 'door' && segment.open === true)) continue;
      if (![segment.x1, segment.z1, segment.x2, segment.z2].every(finite)) continue;
      const t = crossing(listener, source, segment);
      if (t != null) hits.push({ t, transmission });
    }
    hits.sort((a, b) => a.t - b.t);
    let pass = 1, barriers = 0;
    for (let i = 0; i < hits.length;) {
      // Un cruce compartido por tramos vecinos o duplicados cuenta como UNA barrera.
      let strongest = hits[i].transmission, next = i + 1;
      while (next < hits.length && Math.abs(hits[next].t - hits[i].t) < 0.0001) {
        strongest = Math.min(strongest, hits[next].transmission);
        next++;
      }
      pass *= strongest;
      barriers++;
      i = next;
    }
    const loudness = finite(source.gain) ? Math.max(0, Math.min(1, source.gain)) : 1;
    const volume = Math.max(0, 1 - distance / range) * pass * loudness;
    return { audible: volume >= MIN_AUDIBLE_GAIN, volume: volume >= MIN_AUDIBLE_GAIN ? volume : 0,
      distance, barriers, range };
  }

  return Object.freeze({ MAX_RANGE_METERS, MIN_AUDIBLE_GAIN, TRANSMISSION, buildObstacles, evaluate });
});
