/* Blakpine-Wood — interfaz jugable de contenedores.
 * El núcleo compartido valida capacidad, categorías y transferencias.
 * Conserva GameState.inventory como fuente de verdad del inventario legacy.
 */
(function (global) {
  'use strict';
  const Core = global.FHInventoryCore;
  const T = global.FH_STORAGE_STRINGS || {};
  const ACTOR = '__player__';
  let runtime = null;
  let overlay = null, title = null, status = null, personal = null, furniture = null;
  let opened = null, focusBefore = null;

  const txt = (key, fallback) => T[key] || fallback;
  const node = (tag, className, value) => {
    const el = global.document.createElement(tag);
    if (className) el.className = className;
    if (value !== undefined) el.textContent = value;
    return el;
  };
  const isStorage = item => !!(Core && item?.modelId &&
    Core.furnitureProfile(item.modelId, item.storage || {}));
  const isValidFloor = (project, floor) => Number.isInteger(floor) && floor >= 0 && floor < (project.floors || []).length;
  const storageId = (project, floor, item) => {
    if (!isValidFloor(project, floor) || !item?.id) return null;
    return String(project.floors[floor].id || floor) + ':' + String(item.id);
  };
  function packLegacy(ids, defs) {
    const packed = [], byId = new Map();
    for (const id of ids || []) {
      if (typeof id !== 'string' || !id) continue;
      const stackable = defs.some(def => def.id === id && def.stackable === true);
      if (stackable && byId.has(id)) packed[byId.get(id)].quantity++;
      else {
        if (stackable) byId.set(id, packed.length);
        packed.push({ id, quantity: 1 });
      }
    }
    return packed;
  }
  function unpackLegacy(items) {
    const ids = [];
    for (const entry of items || []) {
      if (entry.backpackId) continue; // Las mochilas se gestionan por su propio flujo.
      for (let i = 0; i < entry.quantity; i++) ids.push(entry.id);
    }
    return ids;
  }
  function ensureUI() {
    if (overlay || !global.document?.body) return;
    overlay = node('section', 'fh-storage-overlay');
    overlay.id = 'fhStorageOverlay';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'fhStorageTitle');
    const panel = node('div', 'fh-storage-panel');
    const head = node('div', 'fh-storage-head');
    title = node('h2', '', '');
    title.id = 'fhStorageTitle';
    const closeButton = node('button', 'fh-storage-close', txt('close', 'Cerrar'));
    closeButton.type = 'button';
    closeButton.addEventListener('click', close);
    head.append(title, closeButton);
    const columns = node('div', 'fh-storage-columns');
    const left = node('section', 'fh-storage-column');
    const right = node('section', 'fh-storage-column');
    left.append(node('h3', '', txt('personal', 'Bolsillos')));
    right.append(node('h3', '', txt('container', 'Contenedor')));
    personal = node('div', 'fh-storage-list');
    furniture = node('div', 'fh-storage-list');
    left.append(personal);
    right.append(furniture);
    columns.append(left, right);
    status = node('p', 'fh-storage-status', txt('help', 'Selecciona un objeto para mover una unidad.'));
    status.setAttribute('role', 'status');
    panel.append(head, columns, status);
    overlay.append(panel);
    overlay.addEventListener('pointerdown', event => {
      if (event.target === overlay) close();
      else event.stopPropagation();
    });
    overlay.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    });
    global.document.body.append(overlay);
  }
  function close() {
    opened = null;
    if (overlay) overlay.hidden = true;
    const previous = focusBefore;
    focusBefore = null;
    previous?.focus?.({ preventScroll: true });
  }
  function itemName(world, entry) {
    const def = world.itemDefs.find(d => d.id === entry.id);
    return (def?.icon ? def.icon + ' ' : '') + (def?.name || entry.id);
  }
  function messageFor(result) {
    return ({
      full: txt('full', 'No hay espacios libres.'),
      category: txt('category', 'Este mueble no admite ese tipo de objeto.'),
      categoryFull: txt('categoryFull', 'Límite alcanzado para esta categoría.'),
      notStackable: txt('invalid', 'No se puede mover ese objeto.'),
      inaccessible: txt('inaccessible', 'No puedes acceder a ese inventario.'),
      missing: txt('missing', 'El objeto ya no está disponible.')
    })[result.reason] || txt('invalid', 'No se pudo transferir el objeto.');
  }
  function renderList(host, items, capacity, onMove, world) {
    host.replaceChildren();
    const count = node('p', 'fh-storage-count', items.length + ' / ' + capacity + ' ' + txt('slots', 'espacios'));
    host.append(count);
    if (!items.length) {
      host.append(node('p', 'fh-storage-empty', txt('empty', 'Vacío')));
      return;
    }
    for (const entry of items) {
      if (entry.backpackId) continue;
      const row = node('div', 'fh-storage-row');
      const name = node('span', 'fh-storage-name', itemName(world, entry));
      const qty = node('span', 'fh-storage-qty', '×' + entry.quantity);
      const button = node('button', 'fh-storage-move', onMove.caption);
      button.type = 'button';
      button.setAttribute('aria-label', onMove.caption + ': ' + itemName(world, entry));
      button.addEventListener('click', () => onMove.action(entry.id));
      row.append(name, qty, button);
      host.append(row);
    }
  }
  function refresh() {
    if (!opened || !runtime) return;
    const { world, state, project } = runtime;
    const entry = Core.resolve(world, { kind: 'furniture', id: opened.id }, ACTOR);
    const actor = world.actors[ACTOR];
    if (!entry.ok || !actor) { close(); return; }
    const target = entry.container;
    title.textContent = opened.item.label || opened.item.modelId || txt('container', 'Contenedor');
    const move = (from, to, itemId) => {
      runtime.syncFromLegacy();
      const result = Core.transfer(world, from, to, ACTOR, itemId, 1);
      if (!result.ok) {
        status.textContent = messageFor(result);
        return;
      }
      state.inventory.splice(0, state.inventory.length, ...unpackLegacy(actor.personal));
      state.fhInventoryStorage = Core.saveWorld(world);
      runtime.onInventoryChange?.();
      runtime.save?.();
      status.textContent = txt('moved', 'Objeto transferido.');
      refresh();
    };
    const playerRef = { kind: 'personal', actorId: ACTOR };
    const furnitureRef = { kind: 'furniture', id: opened.id };
    renderList(personal, actor.personal, Core.PERSONAL_SLOTS,
      { caption: txt('store', 'Guardar'), action: id => move(playerRef, furnitureRef, id) }, world);
    renderList(furniture, target.items, target.slots,
      { caption: txt('take', 'Sacar'), action: id => move(furnitureRef, playerRef, id) }, world);
  }
  function init(options = {}) {
    if (!Core || !options.project || !options.state) return null;
    close();
    const project = options.project, state = options.state, defs = options.itemDefs || [];
    let world = null;
    try { if (state.fhInventoryStorage) world = Core.restoreWorld(state.fhInventoryStorage); }
    catch (_) { world = null; }
    if (!world) world = Core.createWorld(defs);
    world.itemDefs = defs.map(def => ({ ...def }));
    if (!world.actors[ACTOR]) Core.addActor(world, ACTOR);
    if (!world.actors[ACTOR]) world.actors[ACTOR] = { personal: [], equippedBackpackId: null };
    const syncFromLegacy = () => {
      world.actors[ACTOR].personal = packLegacy(state.inventory, defs);
    };
    syncFromLegacy();
    const ensureFurniture = (item, floor) => {
      if (!isStorage(item)) return null;
      const id = storageId(project, floor, item);
      if (!id) return null;
      if (!world.furniture[id]) {
        const settings = item.storage || {};
        Core.addFurniture(world, id, item.modelId, {
          ...settings,
          items: settings.initialItems || settings.items || []
        });
      }
      return world.furniture[id] ? id : null;
    };
    project.floors.forEach((floor, i) => (floor.items || []).forEach(item => ensureFurniture(item, i)));
    runtime = { project, state, world, syncFromLegacy, ensureFurniture,
      save: options.save, onInventoryChange: options.onInventoryChange };
    return runtime;
  }
  function open(item, floor) {
    if (!runtime || !isStorage(item) || !isValidFloor(runtime.project, floor)) return false;
    const id = runtime.ensureFurniture(item, floor);
    if (!id) return false;
    runtime.syncFromLegacy();
    ensureUI();
    if (!overlay) return false;
    focusBefore = global.document.activeElement;
    opened = { id, item };
    overlay.hidden = false;
    status.textContent = txt('help', 'Selecciona un objeto para mover una unidad.');
    refresh();
    overlay.querySelector?.('.fh-storage-close')?.focus?.();
    return true;
  }
  // Los muebles de Hamazon nacen en runtime, no en el catálogo del mapa.
  // Al llegar necesitan una acción real antes de entrar en interactableItems.
  function prepareDeliveryItem(item) {
    if (!item?.id || !item.runtimeDeliveryFurniture || item.interact) return false;
    const container = isStorage(item);
    item.interact = {
      id: (container ? 'storage_' : 'decorate_') + item.id,
      verb: container ? 'storage' : 'decorate',
      label: container ? txt('open', 'Abrir inventario')
        : (global.FH_DELIVERY_TEXT?.decorateAction || 'Mover / decorar'),
      effects: []
    };
    return true;
  }
  global.FHStorageRuntime = Object.freeze({
    init, open, close, supports: isStorage, prepareDeliveryItem,
    get isOpen() { return !!opened && !!overlay && !overlay.hidden; }
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = { packLegacy, unpackLegacy, storageId, isStorage };
})(typeof window !== 'undefined' ? window : globalThis);
