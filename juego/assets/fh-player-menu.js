/* Blakpine Wood — Menú del jugador; el inventario y sus handlers pertenecen al motor. */
(function (global) {
  'use strict';
  const T = global.FH_PLAYER_MENU_STRINGS || {};
  const sections = Object.freeze([
    ['objectives','objectives','◇'],
    ['inventory','inventory','▧'],
    ['notes','notes','≡'],
    ['status','status','◈'],
    ['settings','settings','⚙']
  ]);
  const categories = Object.freeze([
    ['all','categoryAll','▦'],
    ['key','categoryKeys','⚿'],
    ['note','categoryNotes','▤'],
    ['other','categoryOther','ϟ']
  ]);
  const el = id => global.document.getElementById(id);
  const label = (key,fallback='') => T[key] || fallback;
  const textOf = id => String(el(id)?.textContent || '').trim() || label('notAvailable','—');
  let open=false,current=null,toggle=null,layer=null,panel=null;
  let navigation=null,detail=null,scroll=null,previousFocus=null,onOpen=null,counter=null,exitButton=null;
  let inventoryHome=null,inventoryNext=null,inventoryUI=null,filter='all',inventoryWatcher=null;
  const isInventoryTab = key => key==='inventory'||key==='notes';

  function node(tag,className,content){
    const n=global.document.createElement(tag);
    if(className)n.className=className;
    if(content!==undefined)n.textContent=content;
    return n;
  }
  function card(caption,value){
    const n=node('div','fh-detail-card');
    n.append(node('div','fh-kicker',caption),node('div','fh-value',value));
    return n;
  }
  function action(caption,handler){
    const b=node('button','',caption);b.type='button';
    b.addEventListener('click',handler);
    return b;
  }
  function available(id){
    const n=el(id);return n&&!n.disabled&&!n.hidden?n:null;
  }
  // No simular el motor: el mismo botón, su mismo onclick y su renderInventory().
  function clickOriginalControl(target,beforeClick){
    if(!target||target.hidden||target.disabled)return false;
    if(beforeClick)beforeClick();
    target.click();
    return true;
  }
  function pressReal(id,leaveMenu=false){
    const target=available(id);
    if(!target){detail.append(node('p','',label('missingControl')));return;}
    clickOriginalControl(target,leaveMenu?()=>closeMenu(id!=='inventoryToggle'):null);
    if(!leaveMenu&&current)renderDetail(current);
  }
  function appendLocation(host){
    host.append(card(label('floor'),textOf('floorLabel')),card(label('room'),textOf('regionLabel')));
  }
  function inventorySlotKind(slot){
    if(!slot||slot.disabled)return 'empty';
    const sprite=slot.querySelector?.('.itemSprite');
    const kind=String(sprite?.className||'').match(/(?:^|\s)kind-(key|note|tool|consumable)(?:\s|$)/);
    return kind?kind[1]:'other';
  }
  function categoryMatches(category,kind){
    return category==='all' || (category==='other'
      ? kind!=='empty'&&kind!=='key'&&kind!=='note'
      : category===kind);
  }
  function updateCounter(){
    if(!counter)return;
    const raw=textOf('inventoryToggle'),match=raw.match(/\d+\s*\/\s*\d+/);
    counter.textContent=match?match[0]:raw;
    counter.setAttribute('aria-label',raw);
  }
  function syncFilter(){
    if(!inventoryUI || !isInventoryTab(current) || !open)return;
    const slots=Array.from(el('inventorySlots')?.querySelectorAll('.inventorySlot')||[]);
    const visible=slots.filter(s=>categoryMatches(filter,inventorySlotKind(s))&&inventorySlotKind(s)!=='empty');
    for(const slot of slots){
      const included=filter==='all'||categoryMatches(filter,inventorySlotKind(slot));
      slot.style.visibility=included?'':'hidden';
      slot.style.pointerEvents=included?'':'none';
      if(!included)slot.tabIndex=-1;
      else slot.removeAttribute('tabindex');
    }
    const hasActive=visible.some(s=>s.classList.contains('active'));
    if(visible.length&&!hasActive){
      // Cambiar de filtro selecciona mediante el onclick real del slot.
      visible[0].click();
      return; // El renderInventory() del motor recrea los slots; el observer reintenta.
    }
    inventoryUI.right.dataset.empty=visible.length?'false':'true';
    inventoryUI.empty.textContent=filter==='all'?label('inventoryEmpty'):label('emptyCategory');
    const status=textOf('inventoryStatus').match(/Cantidad:\s*(\d+)/);
    inventoryUI.quantity.textContent=status?'×'+status[1]:'';
    inventoryUI.filters.querySelectorAll('button').forEach(b=>{
      const chosen=b.dataset.category===filter;
      b.setAttribute('aria-pressed',String(chosen));
    });
    updateCounter();
  }
  function setCategory(name){
    filter=name;
    syncFilter();
  }
  function ensureInventoryUI(){
    if(inventoryUI)return inventoryUI;
    const native=el('inventoryPanel'),head=el('inventoryHead');
    const summary=el('inventorySummary'),slots=el('inventorySlots'),selected=el('inventorySelected');
    if(!native||!head||!summary||!slots||!selected)return null;
    const left=node('div','fh-inventory-left'),right=node('div','fh-inventory-right');
    left.id='fhInventoryLeft';right.id='fhInventoryRight';
    const filters=node('nav','fh-inventory-filters');filters.id='fhInventoryFilters';
    filters.setAttribute('aria-label',label('categoryLabel'));
    for(const [key,textKey,icon] of categories){
      const b=node('button','fh-inventory-filter',icon);
      b.type='button';b.dataset.category=key;
      b.setAttribute('aria-label',label(textKey));
      b.setAttribute('title',label(textKey));
      b.setAttribute('aria-pressed','false');
      b.addEventListener('click',()=>setCategory(key));
      filters.append(b);
    }
    const empty=node('p','fh-inventory-empty',label('emptyCategory'));
    empty.id='fhInventoryEmpty';empty.setAttribute('role','status');
    const hint=node('p','fh-inventory-hint',label('chooseItemHint'));
    hint.id='fhInventoryHint';
    const quantity=node('span','fh-inventory-quantity');quantity.id='fhInventoryQuantity';
    el('inventoryNameRow')?.append(quantity);
    const close=el('inventoryClose');
    if(close){close.textContent=label('backToGame');close.setAttribute('aria-label',label('closeInventory'));}
    inventoryUI={native,head,summary,slots,selected,left,right,filters,empty,hint,quantity};
    native.addEventListener('click',event=>{
      // El onclick original cierra la mochila; después salimos del contenedor.
      if(event.target?.closest?.('#inventoryClose')&&open&&isInventoryTab(current))
        closeMenu();
    });
    if(typeof global.MutationObserver==='function'){
      inventoryWatcher=new global.MutationObserver(syncFilter);
      inventoryWatcher.observe(slots,{childList:true});
    }
    return inventoryUI;
  }
  function mountInventory(kind){
    const ui=ensureInventoryUI(),real=available('inventoryToggle');
    if(!ui||!real){
      detail.append(node('p','',label('missingControl')));
      return;
    }
    if(!inventoryHome){
      inventoryHome=ui.native.parentNode;
      inventoryNext=ui.native.nextSibling;
    }
    ui.left.append(ui.filters,ui.summary,ui.slots,ui.hint);
    ui.right.append(ui.selected,ui.empty);
    ui.native.replaceChildren(ui.head,ui.left,ui.right);
    detail.append(ui.native);
    ui.native.setAttribute('aria-modal','false'); // El modal exterior es el menú.
    if(!ui.native.classList.contains('open'))clickOriginalControl(real);
    setCategory(kind==='notes'?'note':'all');
    updateCounter();
  }
  function unmountInventory(){
    const ui=inventoryUI;
    if(!ui || !inventoryHome || ui.native.parentNode!==detail)return;
    // El motor desactiva el panel y su aria-expanded con su propio onclick.
    if(ui.native.classList.contains('open'))
      clickOriginalControl(available('inventoryToggle'));
    ui.native.replaceChildren(ui.head,ui.summary,ui.slots,ui.selected);
    ui.native.setAttribute('aria-modal','true');
    if(inventoryNext?.parentNode===inventoryHome)
      inventoryHome.insertBefore(ui.native,inventoryNext);
    else inventoryHome.append(ui.native);
    ui.right.dataset.empty='false';
  }
  function renderDetail(key){
    if(!sections.some(s=>s[0]===key))return;
    if(isInventoryTab(current)&&!isInventoryTab(key))unmountInventory();
    current=key;
    detail.hidden=false;
    navigation.hidden=false;
    detail.replaceChildren();
    navigation.querySelectorAll('button').forEach(b=>{
      const selected=b.dataset.section===key;
      b.setAttribute('aria-selected',String(selected));
      b.tabIndex=selected?0:-1;
    });
    panel.dataset.fhSection=key;
    exitButton.hidden=isInventoryTab(key);
    if(isInventoryTab(key)){
      // Entre Inventario y Notas se reutiliza el mismo panel real.
      mountInventory(key);
    } else {
      detail.append(node('h3','fh-section-title',label(sections.find(x=>x[0]===key)[1])));
      switch(key){
        case 'objectives':
          detail.append(node('p','',label('noObjective')),node('h4','fh-kicker',label('location')));
          appendLocation(detail);
          break;
        case 'status':
          appendLocation(detail);
          detail.append(card(label('currentInventory'),textOf('inventoryToggle')));
          detail.append(card(label('torch'),textOf('flashlightToggle')));
          break;
        case 'settings':
          for(const [id,name] of [
            ['floorBtn','changeFloor'],['pixelBtn','pixels'],['gridBtn','grid'],
            ['fullscreenBtn','fullscreen'],['mapBtn','editor']
          ]){
            if(!el(id))continue;
            const caption=label(name)+(name==='editor'?'':' · '+textOf(id));
            detail.append(action(caption,()=>pressReal(id,name==='editor')));
          }
          break;
      }
    }
    scroll.scrollTop=0;
  }
  function showMain(){renderDetail('objectives');}
  function closeMenu(restoreFocus=true){
    if(!open)return;
    const leavingInventory=isInventoryTab(current);
    unmountInventory();
    open=false;current=null;
    layer.hidden=true;
    global.document.body.classList.remove('fh-player-menu-open');
    toggle.setAttribute('aria-expanded','false');
    toggle.setAttribute('aria-label',label('open'));
    if(restoreFocus)(leavingInventory||!previousFocus?.isConnected?toggle:previousFocus).focus();
  }
  function hasModal(){
    return Boolean(
      global.FHLiveText?.isDialogOpen?.()||
      el('inventoryPanel')?.classList.contains('open')||
      el('noteOverlay')?.classList.contains('open')||
      el('fhDeliveryDialog')?.classList.contains('open')||
      (el('fhBreakerOverlay')&&!el('fhBreakerOverlay').hidden)||
      (el('elevatorPanel')&&!el('elevatorPanel').hidden)
    );
  }
  function openMenu(){
    if(open||hasModal())return;
    previousFocus=global.document.activeElement;
    try{onOpen?.();}catch(err){console.warn('[FH Player Menu] pausa no disponible',err);}
    open=true;layer.hidden=false;
    global.document.body.classList.add('fh-player-menu-open');
    toggle.setAttribute('aria-expanded','true');
    toggle.setAttribute('aria-label',label('close'));
    updateCounter();
    showMain();
    navigation.querySelector('[aria-selected="true"]')?.focus();
  }
  function observeModalFocus(){
    if(typeof global.MutationObserver!=='function')return;
    const native=el('inventoryPanel');
    if(native){
      let wasOpen=native.classList.contains('open');
      new global.MutationObserver(()=>{
        const now=native.classList.contains('open');
        if(wasOpen&&!now){
          if(open&&isInventoryTab(current))closeMenu();
          else if(!open&&!el('noteOverlay')?.classList.contains('open'))toggle?.focus();
        }
        wasOpen=now;
      }).observe(native,{attributes:true,attributeFilter:['class','aria-hidden']});
    }
    const note=el('noteOverlay');
    if(note){
      let wasOpen=note.classList.contains('open');
      new global.MutationObserver(()=>{
        const now=note.classList.contains('open');
        if(now&&!wasOpen)el('noteClose')?.focus();
        else if(wasOpen&&!now&&open&&isInventoryTab(current))
          el('inventoryPrimaryAction')?.focus();
        wasOpen=now;
      }).observe(note,{attributes:true,attributeFilter:['class','aria-hidden']});
    }
  }
  function cycleFocus(event){
    const focusable=Array.from(panel.querySelectorAll('button:not([disabled])'))
      .filter(n=>n.tabIndex!==-1&&n.getClientRects().length&&n.closest('[hidden]')===null);
    if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&(global.document.activeElement===first||!panel.contains(global.document.activeElement))){
      event.preventDefault();last.focus();
    } else if(!event.shiftKey&&global.document.activeElement===last){
      event.preventDefault();first.focus();
    }
  }
  function onKeydown(event){
    if(!open)return;
    if(el('noteOverlay')?.classList.contains('open')){
      if(event.key==='Escape'){
        event.preventDefault();event.stopImmediatePropagation();
        el('noteClose')?.click();
      }else if(event.key==='Tab'){
        event.preventDefault();el('noteClose')?.focus();
      }else if(['w','a','s','d','e','f','q'].includes(event.key)){
        event.preventDefault();event.stopImmediatePropagation();
      }
      return;
    }
    if(event.key==='Escape'){
      event.preventDefault();event.stopImmediatePropagation();closeMenu();return;
    }
    if(event.key==='Tab'){cycleFocus(event);event.stopImmediatePropagation();return;}
    if((event.key==='ArrowLeft'||event.key==='ArrowRight')&&navigation.contains(global.document.activeElement)){
      event.preventDefault();event.stopImmediatePropagation();
      const buttons=Array.from(navigation.querySelectorAll('button'));
      const i=buttons.indexOf(global.document.activeElement);
      const next=buttons[(i+buttons.length+(event.key==='ArrowRight'?1:-1))%buttons.length];
      next?.click();next?.focus();return;
    }
    if(event.key==='Enter'||event.key===' '){
      event.preventDefault();event.stopImmediatePropagation();
      if(panel.contains(global.document.activeElement)&&global.document.activeElement?.tagName==='BUTTON')
        global.document.activeElement.click();
      return;
    }
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','e','f','q','t','j','l'].includes(event.key))
      event.preventDefault();
    event.stopImmediatePropagation();
  }
  function init(){
    if(!global.document||el('fhMenuToggle')||!el('hud')||!el('inventoryToggle')||!el('hudOptions'))return false;
    toggle=node('button','','');toggle.id='fhMenuToggle';toggle.type='button';
    toggle.setAttribute('aria-label',label('open'));
    toggle.setAttribute('aria-controls','fhPlayerMenuLayer');
    toggle.setAttribute('aria-expanded','false');
    const bars=node('span','fh-bars');bars.setAttribute('aria-hidden','true');
    bars.append(node('i'),node('i'),node('i'));toggle.append(bars);
    layer=node('div');layer.id='fhPlayerMenuLayer';layer.hidden=true;
    const scrim=node('button');scrim.id='fhMenuScrim';scrim.type='button';
    scrim.setAttribute('aria-label',label('close'));
    panel=node('section');panel.id='fhPlayerMenu';panel.setAttribute('role','dialog');
    panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','fhPlayerMenuTitle');
    const head=node('header');head.id='fhPlayerMenuHeader';
    const title=node('h2','',label('title'));title.id='fhPlayerMenuTitle';
    const emblem=node('span','fh-menu-emblem','✧');emblem.id='fhPlayerMenuEmblem';
    emblem.setAttribute('aria-hidden','true');
    navigation=node('nav');navigation.id='fhPlayerMenuNav';
    navigation.setAttribute('role','tablist');navigation.setAttribute('aria-label',label('title'));
    for(const [key,name] of sections){
      const b=node('button','',label(name));b.type='button';
      b.dataset.section=key;b.setAttribute('role','tab');
      b.setAttribute('aria-controls','fhPlayerMenuDetail');b.setAttribute('aria-selected','false');
      b.addEventListener('click',()=>renderDetail(key));
      navigation.append(b);
    }
    counter=node('span','fh-inventory-counter');
    counter.id='fhInventoryCounter';counter.setAttribute('role','status');
    head.append(title,emblem,navigation,counter);
    scroll=node('div');scroll.id='fhPlayerMenuScroll';
    detail=node('div');detail.id='fhPlayerMenuDetail';
    detail.setAttribute('role','tabpanel');detail.hidden=true;
    scroll.append(detail);
    const foot=node('footer');foot.id='fhPlayerMenuFooter';
    exitButton=action(label('backToGame'),closeMenu);
    exitButton.id='fhPlayerMenuExit';foot.append(exitButton);
    panel.append(head,scroll,foot);layer.append(scrim,panel);
    global.document.body.append(toggle,layer);
    toggle.addEventListener('click',()=>open?closeMenu():openMenu());
    scrim.addEventListener('click',()=>closeMenu());
    global.addEventListener('keydown',onKeydown,true);
    global.addEventListener('blur',()=>{if(open&&!el('noteOverlay')?.classList.contains('open'))closeMenu();});
    global.document.body.classList.add('fh-player-menu-ready');
    observeModalFocus();
    if(typeof global.MutationObserver==='function')
      new global.MutationObserver(updateCounter).observe(el('inventoryToggle'),{childList:true,subtree:true});
    updateCounter();
    if(global.parent!==global)global.parent.postMessage({type:'FOREST_PLAYER_MENU_READY'},'*');
    return true;
  }
  const api=Object.freeze({
    isOpen:()=>open,close:closeMenu,
    configure(options={}){onOpen=typeof options.onOpen==='function'?options.onOpen:null;},
    init
  });
  global.FHPlayerMenu=api;
  if(typeof module==='object'&&module.exports)
    module.exports=Object.freeze({clickOriginalControl,categoryMatches,inventorySlotKind});
  if(global.document?.readyState==='loading')global.document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})(typeof window!=='undefined'?window:globalThis);

/* Pruebas autocontenidas para preservar el alcance del cambio. */
if(typeof module==='object'&&module.exports&&typeof require==='function'&&require.main===module){
  const test=require('node:test'),assert=require('node:assert/strict');
  const {clickOriginalControl,categoryMatches,inventorySlotKind}=module.exports;
  test('el control legacy conserva su onclick y se cierra la vista antes del clic',()=>{
    const seq=[],real={hidden:false,disabled:false,click(){seq.push('motor');}};
    assert.equal(clickOriginalControl(real,()=>seq.push('HUD')),true);
    assert.deepEqual(seq,['HUD','motor']);
    assert.equal(clickOriginalControl({...real,hidden:true}),false);
    assert.equal(clickOriginalControl({...real,disabled:true}),false);
  });
  test('categorías usan los cuatro tipos originales sin modificar el motor',()=>{
    assert.equal(categoryMatches('key','key'),true);
    assert.equal(categoryMatches('note','key'),false);
    assert.equal(categoryMatches('note','note'),true);
    assert.equal(categoryMatches('other','tool'),true);
    assert.equal(categoryMatches('other','consumable'),true);
    assert.equal(categoryMatches('other','note'),false);
    assert.equal(categoryMatches('all','empty'),true);
    const slot={disabled:false,querySelector(){return {className:'itemSprite kind-note'};}};
    assert.equal(inventorySlotKind(slot),'note');
    assert.equal(inventorySlotKind({...slot,disabled:true}),'empty');
  });
}
