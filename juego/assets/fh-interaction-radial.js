/* Blakpine Wood: presentación del radial contextual; las acciones las decide el motor. */
(function (global) {
  'use strict';
  const T = global.FH_INTERACTION_STRINGS || {};
  let root = null, title = null, wheel = null, center = null;
  let buttons = [], active = [], signature = '', currentKey = '';
  let requestedKey = '', outsidePointerId = null;
  const byId = id => global.document.getElementById(id);

  function ensure() {
    if (root || !global.document?.body) return;
    root = global.document.createElement('section');
    root.id = 'fhContextRadial';
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', T.menuLabel || 'Acciones del objeto');
    root.hidden = true;
    title = global.document.createElement('strong');
    title.className = 'fh-radial-target';
    wheel = global.document.createElement('div');
    wheel.className = 'fh-radial-wheel';
    wheel.id = 'fhRadialWheel';
    center = global.document.createElement('button');
    center.type = 'button';
    center.className = 'fh-radial-center';
    center.id = 'fhRadialCenter';
    center.setAttribute('aria-label', T.close || 'Cerrar menú radial');
    center.innerHTML = '<svg class="fh-radial-hand" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 13V6a2 2 0 0 1 4 0v5"/><path d="M12 11V4a2 2 0 0 1 4 0v7"/><path d="M16 11V6a2 2 0 0 1 4 0v7c0 6-3 8-8 8h-1c-3 0-4-1-5.1-2.4L2 14.5a2 2 0 0 1 3-2.6L8 15"/></svg>';
    center.addEventListener('click', event => { event.stopPropagation(); close(); });
    wheel.append(center);
    root.append(title, wheel);
    global.document.body.append(root);
    global.document.addEventListener?.('keydown', keydown);
    // Cualquier pulsación externa cierra el único radial; su pointerup no debe reabrirlo.
    global.document.addEventListener?.('pointerdown', event => {
      if (root.hidden || root.contains(event.target)) return;
      outsidePointerId = event.pointerId;
      close();
    }, true);
    global.document.addEventListener?.('pointerup', event => {
      if (outsidePointerId === event.pointerId) outsidePointerId = null;
    });
    global.document.addEventListener?.('pointercancel', event => {
      if (outsidePointerId === event.pointerId) outsidePointerId = null;
    });
  }

  function hide() {
    if (!root) return;
    root.hidden = true;
    signature = '';
    active = [];
    currentKey = '';
    requestedKey = '';
  }

  function close() {
    hide();
    center?.blur?.();
  }

  function consumeOutsidePress(pointerId) {
    if (outsidePointerId !== pointerId) return false;
    outsidePointerId = null;
    return true;
  }

  function open(context) {
    ensure();
    if (!context || !context.key || !Array.isArray(context.actions)) return false;
    requestedKey = String(context.key);
    update(context);
    return !!root && !root.hidden;
  }

  function sectorPath(index, count) {
    if (count === 1) return 'circle(50% at 50% 50%)';
    const from = -90 - 180 / count + index * 360 / count;
    const steps = Math.max(12, Math.ceil(48 / count));
    const points = ['50% 50%'];
    for (let step = 0; step <= steps; step++) {
      const angle = (from + step / steps * 360 / count) * Math.PI / 180;
      points.push((50 + Math.cos(angle) * 50).toFixed(3) + '% ' + (50 + Math.sin(angle) * 50).toFixed(3) + '%');
    }
    return 'polygon(' + points.join(',') + ')';
  }

  function update(context) {
    ensure();
    if (!root || !requestedKey) return;
    if (!context || String(context.key) !== requestedKey || !Array.isArray(context.actions) || !context.actions.length) {
      hide();
      return;
    }
    if (global.FHPlayerMenu?.isOpen() || byId('fhLiveDialog')?.classList.contains('open')
      || byId('fhDeliveryDialog')?.classList.contains('open')
      || byId('inventoryPanel')?.classList.contains('open')
      || byId('noteOverlay')?.classList.contains('open')
      || byId('fhBreakerOverlay')?.getAttribute('aria-hidden') === 'false') {
      hide();
      return;
    }
    const actions = context.actions.filter(action => action && (typeof action.run === 'function' || action.disabled === true)).slice(0, 8);
    if (!actions.length) { hide(); return; }
    const key = String(context.key || 'context');
    if (key !== requestedKey) { hide(); return; }
    const nextSignature = key + ':' + actions.map(a => String(a.id) + ':' + (a.disabled ? '0' : '1') + ':' + a.label).join('|');
    active = actions;
    title.textContent = String(context.title || T.menuLabel || 'Interacción').slice(0, 72);
    if (nextSignature !== signature) {
      wheel.replaceChildren(center);
      buttons = [];
      const count = actions.length;
      wheel.style.setProperty('--fh-radial-step', (360 / count) + 'deg');
      wheel.style.setProperty('--fh-radial-start', (-180 / count) + 'deg');
      wheel.classList.toggle('fh-radial-single', count === 1);
      wheel.classList.toggle('fh-radial-four', count === 4);
      wheel.classList.toggle('fh-radial-dense', count >= 6);
      actions.forEach((entry, index) => {
        const button = global.document.createElement('button');
        button.type = 'button';
        button.className = 'fh-radial-action';
        button.disabled = !!entry.disabled;
        button.dataset.index = String(index);
        button.setAttribute('aria-label', String(entry.label || T.action || 'Acción'));
        button.style.clipPath = sectorPath(index, count);
        const angle = (-90 + index * 360 / count) * Math.PI / 180;
        button.style.setProperty('--fh-label-x', (50 + Math.cos(angle) * 37) + '%');
        button.style.setProperty('--fh-label-y', (50 + Math.sin(angle) * 37) + '%');
        const label = global.document.createElement('span');
        label.textContent = String(entry.label || T.action || 'Acción');
        button.append(label);
        button.addEventListener('click', event => {
          event.stopPropagation();
          const item = active[Number(button.dataset.index)];
          if (!item || item.disabled || typeof item.run !== 'function') return;
          close();
          item.run();
        });
        wheel.append(button);
        buttons.push(button);
      });
      // La mano queda visualmente encima de todos los sectores.
      wheel.append(center);
      signature = nextSignature;
      currentKey = key;
    }
    const w = global.innerWidth || 800, h = global.innerHeight || 600;
    // Compacto en móvil: evita cubrir la mayor parte del escenario.
    const preferred = w <= 620 ? 164 : h <= 480 ? 176 : 208;
    const size = Math.max(112, Math.min(preferred, w - 24, h - 106));
    root.style.setProperty('--fh-radial-size', size + 'px');
    const x = Number.isFinite(context.x) ? context.x : w / 2;
    const y = Number.isFinite(context.y) ? context.y : h * 0.52;
    const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
    root.style.left = Math.round(clamp(x, size / 2 + 8, Math.max(size / 2 + 8, w - size / 2 - 8))) + 'px';
    root.style.top = Math.round(clamp(y, size / 2 + 46, Math.max(size / 2 + 46, h - size / 2 - 8))) + 'px';
    root.hidden = false;
  }

  function activatePrimary() {
    if (!root || root.hidden) return false;
    const choice = active.find(action => !action.disabled && typeof action.run === 'function');
    if (!choice) return false;
    close();
    choice.run();
    return true;
  }

  function keydown(event) {
    if (!root || root.hidden || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Escape', 'Enter', ' '].includes(event.key)) return false;
    // No interceptar las flechas del jugador mientras el radial no tenga el foco.
    let focused = global.document.activeElement;
    let inside = false;
    while (focused) {
      if (focused === wheel) { inside = true; break; }
      focused = focused.parent || focused.parentElement;
    }
    if (!inside) return false;
    if (event.key === 'Escape') {
      close();
    } else if (event.key === 'Enter' || event.key === ' ') {
      if (global.document.activeElement === center) close();
      else if (buttons.includes(global.document.activeElement)) global.document.activeElement.click();
    } else {
      const enabled = buttons.filter(button => !button.disabled);
      if (!enabled.length) return false;
      const position = enabled.indexOf(global.document.activeElement);
      const change = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
      enabled[(position + change + enabled.length) % enabled.length].focus();
    }
    event.preventDefault();
    event.stopPropagation?.();
    return true;
  }

  global.FHInteractionRadial = Object.freeze({ open, update, hide, close, consumeOutsidePress, activatePrimary, keydown,
    get visible() { return !!root && !root.hidden; },
    get target() { return currentKey; }
  });
})(typeof window !== 'undefined' ? window : globalThis);
