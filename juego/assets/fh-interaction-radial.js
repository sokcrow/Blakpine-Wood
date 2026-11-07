/* Blakpine Wood: solo presentación del radial contextual. Las acciones las decide el motor. */
(function (global) {
  'use strict';
  const T = global.FH_INTERACTION_STRINGS || {};
  let root = null, title = null, buttons = [], active = [], signature = '', currentKey = '';
  const byId = id => global.document.getElementById(id);
  function ensure() {
    if (root || !global.document?.body) return;
    root = global.document.createElement('section');
    root.id = 'fhContextRadial';
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', T.menuLabel || 'Acciones del objeto');
    root.hidden = true;
    const label = global.document.createElement('strong');
    label.className = 'fh-radial-target';
    title = label;
    const wheel = global.document.createElement('div');
    wheel.className = 'fh-radial-wheel';
    wheel.id = 'fhRadialWheel';
    root.append(label, wheel);
    global.document.body.append(root);
  }
  function hide() {
    if (!root) return;
    root.hidden = true;
    signature = '';
    active = [];
    currentKey = '';
  }
  function update(context) {
    ensure();
    if (!root || !context || !Array.isArray(context.actions) || !context.actions.length) {
      hide(); return;
    }
    if (global.FHPlayerMenu?.isOpen() || byId('fhLiveDialog')?.classList.contains('open')
      || byId('fhDeliveryDialog')?.classList.contains('open')
      || byId('inventoryPanel')?.classList.contains('open')
      || byId('noteOverlay')?.classList.contains('open')
      || byId('fhBreakerOverlay')?.getAttribute('aria-hidden') === 'false') {
      hide(); return;
    }
    const actions = context.actions.filter(a => a && typeof a.run === 'function').slice(0, 8);
    if (!actions.length) { hide(); return; }
    const key = String(context.key || 'context');
    const nextSignature = key + ':' + actions.map(a => String(a.id) + ':' + (a.disabled?'0':'1') + ':' + a.label).join('|');
    active = actions;
    title.textContent = String(context.title || T.menuLabel || 'Interacción').slice(0, 72);
    if (nextSignature !== signature) {
      const wheel = byId('fhRadialWheel');
      wheel.replaceChildren();
      buttons = [];
      actions.forEach((entry, index) => {
        const button = global.document.createElement('button');
        button.type = 'button';
        button.className = 'fh-radial-action';
        button.textContent = String(entry.label || T.action || 'Acción');
        button.disabled = !!entry.disabled;
        button.dataset.index = String(index);
        const count = actions.length;
        const angle = (-90 + index * 360 / count) * Math.PI / 180;
        const radius = count >= 6 ? 102 : count <= 2 ? 76 : 94;
        button.style.setProperty('--radial-x', Math.round(Math.cos(angle) * radius) + 'px');
        button.style.setProperty('--radial-y', Math.round(Math.sin(angle) * radius) + 'px');
        button.addEventListener('click', ev => {
          ev.stopPropagation();
          const item = active[Number(button.dataset.index)];
          if (!item || item.disabled) return;
          item.run();
        });
        wheel.append(button);
        buttons.push(button);
      });
      signature = nextSignature;
      currentKey = key;
    }
    const w = global.innerWidth || 800, h = global.innerHeight || 600;
    const x = Number.isFinite(context.x) ? context.x : w / 2;
    const y = Number.isFinite(context.y) ? context.y : h * .52;
    root.style.left = Math.round(Math.max(130, Math.min(w - 130, x))) + 'px';
    root.style.top = Math.round(Math.max(142, Math.min(h - 142, y))) + 'px';
    root.hidden = false;
  }
  function activatePrimary() {
    if (!root || root.hidden) return false;
    const choice = active.find(a => !a.disabled);
    if (!choice) return false;
    choice.run();
    return true;
  }
  function keydown(event) {
    if (!root || root.hidden || !['ArrowLeft','ArrowRight','Enter',' '].includes(event.key)) return false;
    const enabled = buttons.filter(b=>!b.disabled);
    if (!enabled.length) return false;
    if (event.key==='Enter' || event.key===' ') {
      const selected = buttons.indexOf(global.document.activeElement);
      if (selected>=0 && !buttons[selected].disabled) buttons[selected].click();
      else activatePrimary();
    } else {
      const current = enabled.indexOf(global.document.activeElement);
      enabled[(current + (event.key==='ArrowRight'?1:-1) + enabled.length)%enabled.length].focus();
    }
    event.preventDefault();
    return true;
  }
  global.FHInteractionRadial = Object.freeze({update,hide,activatePrimary,keydown,
    get visible(){return !!root&&!root.hidden},get target(){return currentKey}});
})(typeof window !== 'undefined' ? window : globalThis);
