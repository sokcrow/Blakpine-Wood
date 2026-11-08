/* Blakpine-Wood — Inventarios: lógica compartida, independiente del DOM y Three.js.
 * No define atributos de ítems ni comportamientos de NPCs.
 */
(function (global) {
  'use strict';

  const PERSONAL_SLOTS = 10;
  const MIN_FURNITURE_SLOTS = 6;
  const FURNITURE = Object.freeze({
    buro: { slots: 6, allowed: ['other', 'medicine', 'document', 'tool'] },
    botiquin_pared: { slots: 6, allowed: ['medicine', 'hygiene'] },
    cajonera: { slots: 8, allowed: ['clothing', 'other', 'document'] },
    armario: { slots: 24, allowed: ['clothing', 'other', 'food'], limits: { food: 2 } },
    estante_bajo: { slots: 6 },
    gabinete_inferior: { slots: 6, allowed: ['kitchen', 'hygiene', 'other'] },
    encimera_simple: { slots: 6, allowed: ['kitchen', 'food', 'hygiene', 'other'] },
    alacena_superior: { slots: 6, allowed: ['food', 'kitchen'] },
    fregadero_mueble: { slots: 6, allowed: ['hygiene', 'kitchen'] },
    despensa_alta: { slots: 32, allowed: ['food', 'kitchen'] },
    refrigerador: { slots: 20, allowed: ['food', 'drink'] },
    escritorio_clasico: { slots: 6, allowed: ['document', 'tool', 'other'] },
    archivero_metalico: { slots: 9, allowed: ['document'] },
    gabinete_bano: { slots: 6, allowed: ['hygiene', 'clothing'] },
    lavabo_gabinete: { slots: 6, allowed: ['hygiene'] },
    caja_carton_pequena: { slots: 6 },
    caja_carton_mediana: { slots: 8 },
    caja_carton_grande: { slots: 12 }
  });
  const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  const copy = value => JSON.parse(JSON.stringify(value));
  const positive = n => Number.isInteger(n) && n > 0;
  const slotsUsed = items => items.length;
  const itemCategory = (world, id) => {
    const def = world.itemDefs.find(item => item.id === id);
    return def?.storageCategory || ({ key: 'other', note: 'document', tool: 'tool', consumable: 'other' }[def?.kind] || 'other');
  };
  const isBackpack = entry => !!entry?.backpackId;
  const stackable = (world, id) => world.itemDefs.find(def => def.id === id)?.stackable === true;

  function createWorld(itemDefs = []) {
    return { version: 1, itemDefs: copy(itemDefs), actors: {}, backpacks: {}, furniture: {} };
  }
  function restoreWorld(snapshot) {
    if (!snapshot || snapshot.version !== 1 || !snapshot.actors || !snapshot.backpacks || !snapshot.furniture)
      throw new Error('Inventario guardado inválido');
    return copy(snapshot);
  }
  function saveWorld(world) { return copy(world); }
  function addActor(world, actorId, personal = []) {
    if (!actorId || own(world.actors, actorId)) return { ok: false, reason: 'duplicate' };
    if (personal.length > PERSONAL_SLOTS) return { ok: false, reason: 'full' };
    world.actors[actorId] = { personal: copy(personal), equippedBackpackId: null };
    return { ok: true };
  }
  function addBackpack(world, backpackId, slots, position = { kind: 'ground' }, items = []) {
    if (!backpackId || own(world.backpacks, backpackId) || !positive(slots)) return { ok: false, reason: 'invalid' };
    if (items.length > slots || items.some(isBackpack) || items.some(item => !positive(item.quantity)))
      return { ok: false, reason: 'invalidContents' };
    // Las mochilas nuevas se colocan en el suelo; el traslado al personaje usa pickupBackpack.
    if (position.kind !== 'ground') return { ok: false, reason: 'invalidLocation' };
    world.backpacks[backpackId] = { id: backpackId, slots, items: copy(items), location: copy(position) };
    return { ok: true };
  }
  function furnitureProfile(modelId, override = {}) {
    const base = FURNITURE[modelId];
    if (!base && !override.enabled) return null;
    const slots = Math.max(MIN_FURNITURE_SLOTS, Number.isInteger(override.slots) ? override.slots : base?.slots || MIN_FURNITURE_SLOTS);
    return {
      slots,
      allowed: Array.isArray(override.allowedCategories) ? [...override.allowedCategories] : base?.allowed ? [...base.allowed] : null,
      limits: { ...(base?.limits || {}), ...(override.categoryLimits || {}) }
    };
  }
  function addFurniture(world, furnitureId, modelId, override = {}) {
    if (!furnitureId || own(world.furniture, furnitureId)) return { ok: false, reason: 'duplicate' };
    const profile = furnitureProfile(modelId, override);
    if (!profile) return { ok: false, reason: 'notStorage' };
    const entry = { id: furnitureId, modelId, ...profile, items: [] };
    world.furniture[furnitureId] = entry;
    for (const item of override.items || []) {
      const result = insert(world, entry, item);
      if (!result.ok) { delete world.furniture[furnitureId]; return result; }
    }
    return { ok: true };
  }
  function resolve(world, ref, actorId) {
    if (ref?.kind === 'personal' && ref.actorId === actorId && own(world.actors, actorId))
      return { ok: true, container: world.actors[actorId], items: world.actors[actorId].personal, slots: PERSONAL_SLOTS, type: 'personal' };
    if (ref?.kind === 'furniture' && own(world.furniture, ref.id)) {
      const furniture = world.furniture[ref.id];
      return { ok: true, container: furniture, items: furniture.items, slots: furniture.slots, type: 'furniture' };
    }
    if (ref?.kind === 'backpack' && own(world.backpacks, ref.id)) {
      const backpack = world.backpacks[ref.id];
      const loc = backpack.location;
      if (!(loc.kind === 'ground' || (loc.kind === 'equipped' && loc.actorId === actorId)))
        return { ok: false, reason: 'inaccessible' };
      return { ok: true, container: backpack, items: backpack.items, slots: backpack.slots, type: 'backpack' };
    }
    return { ok: false, reason: 'inaccessible' };
  }
  function insert(world, target, entry) {
    if (!entry || !entry.id || !positive(entry.quantity)) return { ok: false, reason: 'invalidItem' };
    if (isBackpack(entry) && target !== null && target !== undefined && target.modelId !== undefined)
      return { ok: false, reason: 'backpackOnlyPersonal' };
    if (isBackpack(entry) && target?.location)
      return { ok: false, reason: 'nestedBackpack' };
    if (!isBackpack(entry) && !stackable(world, entry.id) && entry.quantity !== 1)
      return { ok: false, reason: 'notStackable' };
    const items = target.personal || target.items;
    const capacity = target.personal ? PERSONAL_SLOTS : target.slots;
    const category = itemCategory(world, entry.id);
    if (target.allowed && !target.allowed.includes(category)) return { ok: false, reason: 'category' };
    if (target.limits && own(target.limits, category)) {
      const used = items.filter(item => itemCategory(world, item.id) === category).length;
      const already = items.some(item => item.id === entry.id && !isBackpack(entry) && stackable(world, entry.id));
      if (used + (already ? 0 : 1) > target.limits[category]) return { ok: false, reason: 'categoryFull' };
    }
    const pile = !isBackpack(entry) && stackable(world, entry.id) && items.find(item => item.id === entry.id && !isBackpack(item));
    if (!pile && slotsUsed(items) >= capacity) return { ok: false, reason: 'full' };
    if (pile) pile.quantity += entry.quantity;
    else items.push(copy(entry));
    return { ok: true };
  }
  function deposit(world, ref, actorId, entry) {
    if (isBackpack(entry)) return { ok: false, reason: 'backpackActionRequired' };
    const r = resolve(world, ref, actorId);
    if (!r.ok) return r;
    return insert(world, r.container, entry);
  }
  function transfer(world, from, to, actorId, itemId, quantity = 1) {
    if (!positive(quantity) || !itemId || JSON.stringify(from) === JSON.stringify(to))
      return { ok: false, reason: 'invalid' };
    const source = resolve(world, from, actorId), target = resolve(world, to, actorId);
    if (!source.ok) return source;
    if (!target.ok) return target;
    const index = source.items.findIndex(item => item.id === itemId && !isBackpack(item));
    if (index < 0 || source.items[index].quantity < quantity) return { ok: false, reason: 'missing' };
    const moved = { id: itemId, quantity };
    // Validar el destino antes de tocar el origen: transferencia atómica.
    const candidate = { ...target.container, personal: target.type === 'personal' ? copy(target.items) : undefined,
      items: target.type === 'personal' ? undefined : copy(target.items) };
    const result = insert(world, candidate, moved);
    if (!result.ok) return result;
    const original = source.items[index];
    original.quantity -= quantity;
    if (!original.quantity) source.items.splice(index, 1);
    target.items.splice(0, target.items.length, ...(candidate.personal || candidate.items));
    return { ok: true };
  }
  function pickupBackpack(world, backpackId, actorId) {
    const bag = world.backpacks[backpackId], actor = world.actors[actorId];
    if (!bag || !actor || bag.location.kind !== 'ground') return { ok: false, reason: 'inaccessible' };
    if (actor.personal.length >= PERSONAL_SLOTS) return { ok: false, reason: 'full' };
    actor.personal.push({ id: 'backpack', backpackId, quantity: 1 });
    bag.location = { kind: 'carried', actorId };
    return { ok: true };
  }
  function equipBackpack(world, backpackId, actorId) {
    const bag = world.backpacks[backpackId], actor = world.actors[actorId];
    if (!bag || !actor || bag.location.kind !== 'carried' || bag.location.actorId !== actorId)
      return { ok: false, reason: 'inaccessible' };
    const index = actor.personal.findIndex(item => item.backpackId === backpackId);
    if (index < 0) return { ok: false, reason: 'missing' };
    const old = actor.equippedBackpackId && world.backpacks[actor.equippedBackpackId];
    actor.personal.splice(index, 1);
    if (old) {
      actor.personal.push({ id: 'backpack', backpackId: old.id, quantity: 1 });
      old.location = { kind: 'carried', actorId };
    }
    actor.equippedBackpackId = backpackId;
    bag.location = { kind: 'equipped', actorId };
    return { ok: true };
  }
  function unequipBackpack(world, actorId) {
    const actor = world.actors[actorId];
    if (!actor?.equippedBackpackId) return { ok: false, reason: 'missing' };
    if (actor.personal.length >= PERSONAL_SLOTS) return { ok: false, reason: 'full' };
    const bag = world.backpacks[actor.equippedBackpackId];
    actor.personal.push({ id: 'backpack', backpackId: bag.id, quantity: 1 });
    bag.location = { kind: 'carried', actorId };
    actor.equippedBackpackId = null;
    return { ok: true };
  }
  function dropBackpack(world, backpackId, actorId, position) {
    const bag = world.backpacks[backpackId], actor = world.actors[actorId];
    if (!bag || !actor || bag.location.actorId !== actorId || !['equipped', 'carried'].includes(bag.location.kind))
      return { ok: false, reason: 'inaccessible' };
    if (bag.location.kind === 'equipped') actor.equippedBackpackId = null;
    else {
      const index = actor.personal.findIndex(item => item.backpackId === backpackId);
      if (index < 0) return { ok: false, reason: 'missing' };
      actor.personal.splice(index, 1);
    }
    bag.location = { ...copy(position || {}), kind: 'ground' };
    return { ok: true };
  }

  const API = Object.freeze({ PERSONAL_SLOTS, MIN_FURNITURE_SLOTS, FURNITURE, createWorld, restoreWorld,
    saveWorld, addActor, addBackpack, furnitureProfile, addFurniture, resolve, deposit, transfer,
    pickupBackpack, equipBackpack, unequipBackpack, dropBackpack });
  global.FHInventoryCore = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
