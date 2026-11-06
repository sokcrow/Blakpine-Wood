/* Blakpine Wood — Menú del Jugador sobre los controles reales del motor. */
(function (global) {
  'use strict';
  const T = global.FH_PLAYER_MENU_STRINGS || {};
  const sections = Object.freeze([
    ['objectives', 'objectives', '◇'],
    ['inventory', 'inventory', '▧'],
    ['notes', 'notes', '≡'],
    ['status', 'status', '◈'],
    ['settings', 'settings', '⚙']
  ]);
  let open = false, current = null, toggle = null, layer = null, panel = null;
  let navigation = null, detail = null, menuBack = null, scroll = null, previousFocus = null, onOpen = null;
  const el = id => global.document.getElementById(id);
  const label = (key, fallback = '') => T[key] || fallback;
  const textOf = id => String(el(id)?.textContent || '').trim() || label('notAvailable', '—');

  function node(tag, className, content) {
    const result = global.document.createElement(tag);
    if (className) result.className = className;
    if (content !== undefined) result.textContent = content;
    return result;
  }
  function card(caption, value) {
    const root = node('div', 'fh-detail-card');
    root.append(node('div', 'fh-kicker', caption),node('div', 'fh-value', value));
    return root;
  }
  function action(caption, handler) {
    const b = node('button', '', caption);
    b.type = 'button';
    b.addEventListener('click', handler);
    return b;
  }
  function available(id) {
    const target = el(id);
    return target && !target.disabled && !target.hidden ? target : null;
  }
  function pressReal(id, leaveMenu = false) {
    const target = available(id);
    if (!target) { detail.append(node('p', '', label('missingControl'))); return; }
    if (leaveMenu) closeMenu();
    target.click();
    if (!leaveMenu && current) renderDetail(current);
  }
  function appendLocation(host) {
    host.append(card(label('floor'), textOf('floorLabel')));
    host.append(card(label('room'), textOf('regionLabel')));
  }
  function renderDetail(key) {
    current = key;
    navigation.hidden = true;
    detail.hidden = false;
    detail.replaceChildren();
    menuBack = action('‹ ' + label('back'), showMain);
    menuBack.id = 'fhPlayerMenuBack';
    detail.append(menuBack);
    const section = sections.find(x => x[0] === key);
    detail.append(node('h3', '', label(section?.[1] || key)));
    switch (key) {
      case 'objectives':
        detail.append(node('p', '', label('noObjective')));
        detail.append(node('h4', 'fh-kicker', label('location')));
        appendLocation(detail);
        break;
      case 'inventory':
        detail.append(card(label('currentInventory'), textOf('inventoryToggle')));
        detail.append(action(label('openInventory'), () => pressReal('inventoryToggle', true)));
        break;
      case 'notes':
        detail.append(node('p', '', label('notesHelp')));
        detail.append(action(label('openInventory'), () => pressReal('inventoryToggle', true)));
        break;
      case 'status':
        appendLocation(detail);
        detail.append(card(label('currentInventory'), textOf('inventoryToggle')));
        detail.append(card(label('torch'), textOf('flashlightToggle')));
        break;
      case 'settings': {
        const options = [
          ['floorBtn','changeFloor'],
          ['pixelBtn','pixels'],
          ['gridBtn','grid'],
          ['fullscreenBtn','fullscreen'],
          ['mapBtn','editor']
        ];
        for (const [id, name] of options) {
          const item = el(id);
          if (!item) continue;
          const caption = label(name) + (name==='editor' ? '' : ' · ' + textOf(id));
          detail.append(action(caption, () => pressReal(id, name==='editor')));
        }
        break;
      }
      default: break;
    }
    scroll.scrollTop = 0;
  }
  function showMain() {
    current = null;
    detail.hidden = true;
    navigation.hidden = false;
    scroll.scrollTop = 0;
    navigation.querySelector('button')?.focus();
  }
  function closeMenu() {
    if (!open) return;
    open = false;current = null;
    layer.hidden = true;
    global.document.body.classList.remove('fh-player-menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', label('open'));
    (previousFocus?.isConnected ? previousFocus : toggle).focus();
  }
  function hasModal() {
    return Boolean(
      global.FHLiveText?.isDialogOpen?.() ||
      el('inventoryPanel')?.classList.contains('open') ||
      el('noteOverlay')?.classList.contains('open') ||
      el('fhDeliveryDialog')?.classList.contains('open') ||
      (el('fhBreakerOverlay') && !el('fhBreakerOverlay').hidden) ||
      (el('elevatorPanel') && !el('elevatorPanel').hidden)
    );
  }
  function openMenu() {
    if (open || hasModal()) return;
    previousFocus = global.document.activeElement;
    try { onOpen?.(); } catch (err) { console.warn('[FH Player Menu] pausa no disponible',err); }
    open = true;
    layer.hidden = false;
    global.document.body.classList.add('fh-player-menu-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', label('close'));
    showMain();
  }
  function cycleFocus(event) {
    const focusable = Array.from(panel.querySelectorAll('button:not([disabled])')).filter(n => n.getClientRects().length && n.closest('[hidden]') === null);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length-1];
    if (event.shiftKey && (global.document.activeElement === first || !panel.contains(global.document.activeElement))) {
      event.preventDefault();last.focus();
    } else if (!event.shiftKey && global.document.activeElement === last) {
      event.preventDefault();first.focus();
    }
  }
  function onKeydown(event) {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();event.stopImmediatePropagation();
      if (current) showMain();else closeMenu();
      return;
    }
    if (event.key === 'Tab') {cycleFocus(event);event.stopImmediatePropagation();return;}
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();event.stopImmediatePropagation();
      if (panel.contains(global.document.activeElement) && global.document.activeElement?.tagName === 'BUTTON')
        global.document.activeElement.click();
      return;
    }
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','e','f','q','t','j','l'].includes(event.key))
      event.preventDefault();
    event.stopImmediatePropagation();
  }
  function init() {
    if (!global.document || el('fhMenuToggle') || !el('hud') || !el('inventoryToggle') || !el('hudOptions')) return false;
    toggle = node('button', '', '');
    toggle.id = 'fhMenuToggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', label('open'));
    toggle.setAttribute('aria-controls', 'fhPlayerMenuLayer');
    toggle.setAttribute('aria-expanded', 'false');
    const bars = node('span', 'fh-bars');bars.setAttribute('aria-hidden','true');
    bars.append(node('i'),node('i'),node('i'));toggle.append(bars);

    layer = node('div');layer.id = 'fhPlayerMenuLayer';layer.hidden = true;
    const scrim = node('button');scrim.id = 'fhMenuScrim';scrim.type='button';scrim.setAttribute('aria-label',label('close'));
    panel = node('section');panel.id='fhPlayerMenu';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','fhPlayerMenuTitle');
    const head = node('header');head.id='fhPlayerMenuHeader';
    head.append(node('small','',label('chapter')),node('h2','',label('title')));
    head.querySelector('h2').id = 'fhPlayerMenuTitle';
    scroll = node('div');scroll.id='fhPlayerMenuScroll';
    navigation = node('nav');navigation.id='fhPlayerMenuNav';navigation.setAttribute('aria-label',label('title'));
    for (const [key,name,icon] of sections) {
      const b = node('button');b.type='button';
      const emblem = node('span','fh-menu-icon',icon);emblem.setAttribute('aria-hidden','true');
      b.append(emblem,node('span','',label(name)));
      b.addEventListener('click',()=>{renderDetail(key);menuBack?.focus()});
      navigation.append(b);
    }
    detail = node('div');detail.id='fhPlayerMenuDetail';detail.hidden = true;
    scroll.append(navigation,detail);
    const foot = node('footer','',label('navHelp'));foot.id='fhPlayerMenuFooter';
    panel.append(head,scroll,foot);layer.append(scrim,panel);
    global.document.body.append(toggle,layer);
    toggle.addEventListener('click',()=>open?closeMenu():openMenu());
    scrim.addEventListener('click',closeMenu);
    global.addEventListener('keydown',onKeydown,true);
    global.addEventListener('blur',()=>{if(open)closeMenu()});
    global.document.body.classList.add('fh-player-menu-ready');
    if (global.parent !== global) global.parent.postMessage({type:'FOREST_PLAYER_MENU_READY'},'*');
    return true;
  }
  const api = Object.freeze({
    isOpen:()=>open,
    close:closeMenu,
    configure(options={}) {onOpen=typeof options.onOpen==='function'?options.onOpen:null;},
    init
  });
  global.FHPlayerMenu=api;
  if (global.document?.readyState==='loading') global.document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})(typeof window!=='undefined'?window:globalThis);
