/* Blakpine Wood: narración expresiva y texto de sonidos 3D, sin dependencias. */
(function (global) {
  'use strict';
  const T = global.FH_LIVE_TEXT_STRINGS || {};
  const PAUSE = Object.freeze({ letter: 35, comma: 160, period: 350, ellipsis: 650, question: 300, exclamation: 250 });
  const SOUND = Object.freeze({
    knock: { range: 11, word: 'knock' }, door_knock: { range: 11, word: 'door_knock' },
    glass_break: { range: 13, word: 'glass_break' }, crack: { range: 10, word: 'crack' },
    dragging: { range: 9, word: 'dragging' }, drawer_open: { range: 6, word: 'drawer_open' },
    fabric_rustle: { range: 4, word: 'fabric_rustle' }, tv_static: { range: 7, word: 'tv_static' }
  });
  const split = text => Array.from(String(text ?? ''));
  function delayAfter(chars, index) {
    const c = chars[index];
    if (c === '…') return PAUSE.ellipsis;
    if (c === '.') {
      if (chars[index + 1] === '.') return PAUSE.letter;
      return index > 0 && chars[index - 1] === '.' ? PAUSE.ellipsis : PAUSE.period;
    }
    if (c === ',') return PAUSE.comma;
    if (c === '?' || c === '¿') return c === '?' ? PAUSE.question : PAUSE.letter;
    if (c === '!' || c === '¡') return c === '!' ? PAUSE.exclamation : PAUSE.letter;
    return PAUSE.letter;
  }
  function audible(source, listener, range) {
    const coords = [source?.x, source?.z, source?.y, listener?.x, listener?.z, listener?.y];
    if (coords.some(v => !Number.isFinite(v)) || !Number.isFinite(range) || range <= 0) return false;
    return Math.hypot(source.x - listener.x, source.y - listener.y, source.z - listener.z) <= range;
  }
  function splitPage(page, maxLength = 160) {
    const source = page.text, pages = [];
    if (source.length <= maxLength) return [page];
    for (let start=0;start<source.length;) {
      let end = Math.min(source.length,start+maxLength);
      if (end < source.length) {
        const boundary = source.lastIndexOf(' ',end);
        if (boundary > start+Math.floor(maxLength*.55)) end=boundary+1;
      }
      const segments = [], selected = source.slice(start,end);
      let offset = 0;
      for (const segment of page.segments) {
        const from = Math.max(start,offset), to = Math.min(end,offset+segment.text.length);
        if (to > from) segments.push({text:segment.text.slice(from-offset,to-offset),mood:segment.mood});
        offset += segment.text.length;
      }
      pages.push({ ...page, segments, text:selected });start=end;
    }
    return pages;
  }
  function normalizePages(spec) {
    const input = Array.isArray(spec?.pages) && spec.pages.length ? spec.pages : [spec || {}];
    return input.flatMap(page => {
      const p = typeof page === 'string' ? { text: page } : page || {};
      const segments = Array.isArray(p.segments) && p.segments.length
        ? p.segments.filter(s => s && typeof s.text === 'string').map(s => ({ text: s.text, mood: s.mood || p.mood || spec?.mood || 'normal' }))
        : [{ text: String(p.text ?? spec?.text ?? ''), mood: p.mood || spec?.mood || 'normal' }];
      const normalized = { segments, text: segments.map(s => s.text).join(''), speaker: p.speaker ?? spec?.speaker ?? '',
        kind: p.kind || spec?.kind || (p.speaker || spec?.speaker ? 'npc' : 'event') };
      return normalized.text ? splitPage(normalized) : [];
    });
  }
  let viewProvider = null, onFreeze = null, current = null, queue = [], timer = 0, noticeTimer = 0, elements = null, pendingNotice = null;
  const spatialItems = [];
  const recentActions = new Map();
  function actionWord(id) {
    return typeof id === 'string' ? String(T.actionWords?.[id] || '') : '';
  }
  function styleText() {
    return [
      '#toast{top:30%;max-width:min(86vw,660px);padding:0;background:none;border:0;border-radius:0;box-shadow:none;color:#f1efe9;font:normal clamp(17px,2.5vw,23px)/1.48 Georgia,serif;text-shadow:0 2px 4px #000,0 0 13px #000d;}',
      '#fhLiveDialog{position:fixed;z-index:65;inset:0;display:none;pointer-events:none;}#fhLiveDialog.open{display:block;}',
      '#fhLiveDialog .fh-panel{position:absolute;max-height:min(56dvh,400px);overflow-y:auto;bottom:max(20px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);width:min(760px,90vw);padding:19px 23px 13px;background:rgba(9,15,16,.81);border:1px solid rgba(223,218,199,.36);border-radius:20px;color:#f1efe9;box-shadow:0 9px 30px #0007;font:normal clamp(17px,2.2vw,21px)/1.48 "Spectral",Georgia,serif;}',
      '#fhLiveDialog.event .fh-panel{border-radius:3px;}#fhLiveDialog .fh-speaker{margin:0 0 7px;color:#e5d4ae;font:600 14px/1.4 "Cinzel",Georgia,serif;}#fhLiveDialog .fh-speaker:empty{display:none;}',
      '#fhLiveDialog .fh-text{position:relative;white-space:pre-wrap;overflow-wrap:anywhere;min-height:1.5em;}#fhLiveDialog .fh-measure{visibility:hidden;}#fhLiveDialog .fh-reveal{position:absolute;inset:0;}#fhLiveDialog .fh-char{opacity:0;}#fhLiveDialog .fh-char.shown{opacity:1;}',
      '#fhLiveDialog .fh-next{opacity:0;text-align:center;height:19px;line-height:19px;font-size:21px;color:#e6dfc7;transition:opacity .15s;}#fhLiveDialog .fh-next.ready{opacity:1;animation:fh-chevron .85s ease-in-out infinite alternate;}',
      '#fhDeliveryText .fh-text{position:relative;white-space:pre-wrap;overflow-wrap:anywhere;min-height:1.5em;}#fhDeliveryText .fh-measure{visibility:hidden;}#fhDeliveryText .fh-reveal{position:absolute;inset:0;}#fhDeliveryText .fh-char{opacity:0;}#fhDeliveryText .fh-char.shown{opacity:1;}',
      '#fhDeliveryText .fh-next{opacity:0;text-align:center;height:19px;font-size:21px;line-height:19px;color:#e6dfc7;}#fhDeliveryText .fh-next.ready{opacity:1;animation:fh-chevron .85s ease-in-out infinite alternate;}',
      '#fhDeliveryText .fh-char.miedo,#fhDeliveryText .fh-char.grito{display:inline-block;}#fhDeliveryText .fh-char.impacto{font-weight:900;font-size:1.12em;}#fhDeliveryText .fh-char.miedo.shown{animation:fh-shiver .15s linear infinite alternate;}#fhDeliveryText .fh-char.grito.shown{animation:fh-shout .26s ease-in-out infinite alternate;}',
      '#fhSpatialLayer{position:fixed;z-index:35;inset:0;pointer-events:none;overflow:hidden;}#fhSpatialLayer .fh-sound{position:absolute;left:0;top:0;white-space:nowrap;color:#f3eee4;text-shadow:-2px -2px 0 #171619,2px -2px 0 #171619,-2px 2px 0 #171619,2px 2px 0 #171619,0 3px 5px #000;font:600 italic clamp(18px,2.6vw,30px)/1.12 "Spectral",Georgia,serif;animation:fh-impact .55s ease-out both;will-change:transform,opacity;}',
      '#fhSpatialLayer .fh-sound.fh-sleep-comic{animation:fh-sleep-breath 2.6s cubic-bezier(.22,.44,.38,.98) both;font-size:clamp(18px,2.4vw,27px);}',
      '@keyframes fh-sleep-breath{0%{opacity:0;translate:0 4px;scale:.90}22%{opacity:.92;translate:2px -4px;scale:1}55%{opacity:.78}100%{opacity:0;translate:8px -31px;scale:1.05}}',
      '#fhLiveDialog .fh-char.miedo,#fhLiveDialog .fh-char.grito{display:inline-block;}#fhLiveDialog .fh-char.impacto{font-weight:900;font-size:1.12em;}#fhLiveDialog .fh-char.miedo.shown{animation:fh-shiver .15s linear infinite alternate;}#fhLiveDialog .fh-char.grito.shown{animation:fh-shout .26s ease-in-out infinite alternate;}',
      '@keyframes fh-shiver{from{transform:translate(-.6px,.5px)}to{transform:translate(.6px,-.5px)}}@keyframes fh-shout{from{transform:translateY(-3px)}to{transform:translateY(3px)}}@keyframes fh-impact{0%{opacity:0;scale:.7}28%{opacity:1;scale:1.15}100%{opacity:0;scale:1;translate:0 -14px}}@keyframes fh-chevron{to{transform:translateY(3px)}}',
      '@media (prefers-reduced-motion:reduce){#fhLiveDialog .fh-char.miedo.shown,#fhLiveDialog .fh-char.grito.shown,#fhLiveDialog .fh-next.ready,#fhDeliveryText .fh-next.ready,#fhDeliveryText .fh-char.miedo.shown,#fhDeliveryText .fh-char.grito.shown,#fhSpatialLayer .fh-sound{animation:none!important;}#fhSpatialLayer .fh-sound{opacity:1;}}'
    ].join('\n');
  }
  function ensure() {
    if (elements || !global.document) return elements;
    const doc = global.document, css = doc.createElement('style');css.id = 'fhLiveTextStyle';css.textContent = styleText();doc.head.appendChild(css);
    const dialog = doc.createElement('section');dialog.id = 'fhLiveDialog';dialog.setAttribute('role', 'dialog');dialog.setAttribute('aria-modal', 'true');dialog.setAttribute('aria-label', T.narration);
    dialog.innerHTML = '<div class="fh-panel"><div class="fh-speaker"></div><div class="fh-text"><div class="fh-measure" aria-hidden="true"></div><div class="fh-reveal"></div></div><div class="fh-next" aria-hidden="true">⌄</div></div>';
    const layer = doc.createElement('div');layer.id = 'fhSpatialLayer';layer.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(layer);doc.body.appendChild(dialog);
    elements = { dialog, layer, speaker: dialog.querySelector('.fh-speaker'), measure: dialog.querySelector('.fh-measure'), reveal: dialog.querySelector('.fh-reveal'), next: dialog.querySelector('.fh-next') };
    global.addEventListener('keydown', event => {
      if (!current) return;
      const key = event.key.toLowerCase(), advances = ['e', ' ', 'enter', 'arrowdown'].includes(key);
      const locked = advances || ['w','a','s','d','arrowup','arrowleft','arrowright','q','j','l','t','f','escape'].includes(key);
      if (!locked) return;
      event.preventDefault();event.stopImmediatePropagation();
      if (advances && !event.repeat) advance();
    }, true);
    global.addEventListener('click', event => {
      if (!current) return;
      event.preventDefault();event.stopImmediatePropagation();advance();
    }, true);
    return elements;
  }
  function configure(options) { viewProvider = options?.view || null;onFreeze = options?.freeze || null;ensure(); }
  function freeze(on) { if (typeof onFreeze === 'function') onFreeze(on); }
  function showDialogue(spec) {
    const pages = normalizePages(spec);
    if (!pages.length) return false;
    queue.push({ pages, page: 0 });
    if (!current) begin();
    return true;
  }
  function begin() {
    if (!queue.length) { current = null;freeze(false);return; }
    current = queue.shift();ensure();
    freeze(true);
    elements.dialog.className = 'open';
    drawPage();
  }
  function drawPage() {
    global.clearTimeout(timer);
    const page = current.pages[current.page];
    elements.dialog.className = 'open ' + (page.kind === 'npc' ? 'npc' : 'event');
    elements.dialog.setAttribute('aria-label', page.kind === 'npc' ? T.dialog : T.narration);
    elements.speaker.textContent = page.kind === 'npc' ? page.speaker : '';
    elements.measure.replaceChildren();
    elements.reveal.replaceChildren();elements.next.classList.remove('ready');
    const chars = [];
    for (const segment of page.segments) {
      for (const ch of split(segment.text)) {
        const el = global.document.createElement('span');el.className = 'fh-char ' + (['miedo','grito','impacto'].includes(segment.mood) ? segment.mood : '');
        el.textContent = ch;el.style.animationDelay = '-' + (chars.length % 4) * 27 + 'ms';
        const reserved = global.document.createElement('span');reserved.className = el.className;reserved.textContent = ch;
        elements.measure.appendChild(reserved);elements.reveal.appendChild(el);chars.push({ el, ch, mood: segment.mood });
      }
    }
    current.chars = chars;current.glyphs = chars.map(c => c.ch);current.index = 0;
    const instant = chars.every(c => c.mood === 'impacto');
    if (instant || global.matchMedia?.('(prefers-reduced-motion: reduce)').matches) finishPage();
    else revealNext();
  }
  function revealNext() {
    if (!current) return;
    const i = current.index;
    if (i >= current.chars.length) { finishPage(); return; }
    const entry = current.chars[i];
    if (entry.mood === 'impacto') {
      while (current.index < current.chars.length && current.chars[current.index].mood === 'impacto')
        current.chars[current.index++].el.classList.add('shown');
      timer = global.setTimeout(revealNext, 120);return;
    }
    entry.el.classList.add('shown');current.index++;
    const pageDelay = Math.max(15, delayAfter(current.glyphs,i));
    timer = global.setTimeout(revealNext, pageDelay);
  }
  function finishPage() {
    if (!current) return;
    global.clearTimeout(timer);
    for (const ch of current.chars) ch.el.classList.add('shown');
    current.index = current.chars.length;elements.next.classList.add('ready');
  }
  function advance() {
    if (!current) return false;
    if (current.index < current.chars.length) { finishPage();return true; }
    if (++current.page < current.pages.length) { drawPage();return true; }
    elements.dialog.className = '';
    current = null;
    if (queue.length) begin();else {freeze(false);flushNotice();}
    return true;
  }

  // La misma cadencia que usa showDialogue(), adaptada al cuadro con opciones del repartidor.
  // Reserva los glifos completos antes de revelar cualquiera, sin recolocar el panel.
  function typeInto(host, spec, options = {}) {
    if (!host || !global.document) return null;
    ensure();
    const page = normalizePages(spec)[0];
    if (!page) return null;
    const doc = global.document;
    const text = doc.createElement('div');text.className='fh-text';
    const reserve=doc.createElement('div');reserve.className='fh-measure';reserve.setAttribute('aria-hidden','true');
    const reveal=doc.createElement('div');reveal.className='fh-reveal';
    const next=doc.createElement('div');next.className='fh-next';next.setAttribute('aria-hidden','true');next.textContent='⌄';
    text.appendChild(reserve);text.appendChild(reveal);host.replaceChildren(text,next);
    const chars=[];
    for (const segment of page.segments) for (const ch of split(segment.text)) {
      const mood=['miedo','grito','impacto'].includes(segment.mood)?segment.mood:'';
      const visible=doc.createElement('span'),hidden=doc.createElement('span');
      visible.className=hidden.className='fh-char '+mood;
      visible.textContent=hidden.textContent=ch;
      visible.style.animationDelay='-'+(chars.length%4)*27+'ms';
      reserve.appendChild(hidden);reveal.appendChild(visible);
      chars.push({el:visible,ch,mood});
    }
    let index=0,timeout=null,done=false,disposed=false;
    const glyphs=chars.map(c=>c.ch);
    function finish(){
      if (disposed || done) return;
      global.clearTimeout(timeout);
      for (const ch of chars)ch.el.classList.add('shown');
      index=chars.length;done=true;next.classList.add('ready');
      options.onComplete?.();
    }
    function step(){
      if (disposed || done)return;
      if (index>=chars.length){finish();return;}
      const at=index,entry=chars[index];
      if(entry.mood==='impacto'){
        while(index<chars.length && chars[index].mood==='impacto')
          chars[index++].el.classList.add('shown');
        timeout=global.setTimeout(step,120);return;
      }
      entry.el.classList.add('shown');index++;
      timeout=global.setTimeout(step,Math.max(15,delayAfter(glyphs,at)));
    }
    function onKey(event){
      if(disposed || !host.isConnected)return;
      const key=String(event.key||'').toLowerCase();
      const advances=['e',' ','enter','arrowdown'].includes(key);
      if(!advances && !['w','a','s','d','arrowup','arrowleft','arrowright','q','j','l','t','f','escape'].includes(key))return;
      // Enter y espacio deben activar los botones reales, no abrir otra vez la puerta.
      if(done && (key==='enter'||key===' ') && event.target?.closest?.('#fhDeliveryActions button')){
        event.stopImmediatePropagation();return;
      }
      event.preventDefault();event.stopImmediatePropagation();
      if(advances && !event.repeat){
        if(!done)finish();
        else options.onReadyAdvance?.();
      }
    }
    function onPointer(event){if(!done){event.stopPropagation();finish();}}
    global.addEventListener('keydown',onKey,true);
    text.addEventListener('click',onPointer);
    if(global.matchMedia?.('(prefers-reduced-motion: reduce)').matches)finish();
    else step();
    return Object.freeze({
      finish,
      get complete(){return done;},
      dispose(){if(disposed)return;disposed=true;global.clearTimeout(timeout);global.removeEventListener('keydown',onKey,true);text.removeEventListener('click',onPointer);}
    });
  }
  function isDialogOpen() { return !!current; }
  function notice(text, ms = 2800) {
    if (current || global.document?.getElementById('fhDeliveryDialog')?.classList.contains('open')) {pendingNotice={text,ms};return true;}
    const el = global.document?.getElementById('toast');if (!el) return false;
    ensure();el.textContent = String(text ?? '');el.classList.add('on');
    global.clearTimeout(noticeTimer);noticeTimer = global.setTimeout(() => el.classList.remove('on'), Math.max(500,Number(ms) || 2800));
    return true;
  }
  function flushNotice() {if(!current && !global.document?.getElementById('fhDeliveryDialog')?.classList.contains('open') && pendingNotice){const n=pendingNotice;pendingNotice=null;notice(n.text,n.ms);}}
  function getView() { return typeof viewProvider === 'function' ? viewProvider() : null; }
  // La distancia máxima es la de dibujado; la luz y la zona negra no determinan el oído.
  function soundLevel(spec, view = getView()) {
    if (!view || (spec?.floor != null && spec.floor !== view.floor)) return 0;
    const radius = Number(view.hearingRadius) > 0 ? Number(view.hearingRadius) : 10.4;
    const range = Math.min(radius, Number(spec?.range) > 0 ? Number(spec.range) : radius);
    if (!global.FHHearing) {
      return audible({x:spec?.x,z:spec?.z,y:spec?.y},view.listener,range) ? 1 : 0;
    }
    const obstacles = typeof view.hearingObstacles === 'function'
      ? view.hearingObstacles() : view.hearingObstacles;
    return global.FHHearing.evaluate(spec, {
      listener: view.listener, floor: view.floor, radius, obstacles
    }).volume;
  }
  function sourceInRange(spec, view) { return soundLevel(spec, view) > 0; }
  function soundAt(spec) {
    const screenSleep=spec?.kind==='sleep'&&Number.isFinite(spec?.screenX)&&Number.isFinite(spec?.screenY);
    const view = getView(), info = SOUND[spec?.id] || {};
    // El Zzz no depende de iluminación, visión, ni siquiera de una cámara 3D
    // válida: ya llega proyectado al mismo plano que los demás textos cómic.
    if (!screenSleep && (!view || !(Number.isFinite(spec?.level) ? spec.level : soundLevel({ ...spec, range: spec?.range || info.range },view)))) return false;
    const word = String(spec?.text || T.soundWords?.[info.word] || '');
    if (!word) return true;
    ensure();
    if (spatialItems.length >= 8) { const old = spatialItems.shift();old.el.remove(); }
    const sleep=spec?.kind==='sleep';
    const el = global.document.createElement('div');el.className=sleep?'fh-sound fh-sleep-comic':'fh-sound';el.textContent=word;elements.layer.appendChild(el);
    const entry = { el,kind:sleep?'sleep':'normal',x:spec.x,z:spec.z,y:spec.y,floor:spec.floor,
      screenX:screenSleep?spec.screenX:null,screenY:screenSleep?spec.screenY:null,
      self:spec.self===true, expires:global.performance.now()+(sleep?2600:580),nextSight:0,shown:false };
    spatialItems.push(entry);tick();return true;
  }
  // Comparte tipografía, animación, capa y proyección con el texto «¡TOC!».
  // El evento puede indicar self cuando lo provoca el jugador: el texto sigue
  // visible aunque apagar una luz deje el objeto a oscuras.
  function actionAt(spec) {
    const word = actionWord(spec?.id);
    if (!word) return false;
    const key = String(spec?.key ?? (spec?.floor + ':' + spec?.x + ':' + spec?.z));
    const now = global.performance.now();
    const previous = recentActions.get(key);
    if (previous != null && now - previous < 260) return false;
    const shown = soundAt({ ...spec, text: word, level: spec?.self === true ? 1 : spec?.level });
    if (!shown) return false;
    if (recentActions.has(key)) recentActions.delete(key);
    if (recentActions.size >= 128) recentActions.delete(recentActions.keys().next().value);
    recentActions.set(key, now);
    return true;
  }

  let audio = null;
  function knockSound(level = 1) {
    try {
      const Audio = global.AudioContext || global.webkitAudioContext;
      if (!Audio) return;
      audio = global.ForestHorrorAudioContext || audio || new Audio();if (audio.state === 'suspended') audio.resume().catch(()=>{});
      const now = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = 'triangle';osc.frequency.setValueAtTime(155,now);osc.frequency.exponentialRampToValueAtTime(68,now+.07);
      gain.gain.setValueAtTime(Math.max(.001,.14*level),now);gain.gain.exponentialRampToValueAtTime(.001,now+.09);
      osc.connect(gain);gain.connect(audio.destination);osc.start(now);osc.stop(now+.1);
    } catch (_) { /* El texto sigue funcionando aunque el navegador bloquee el audio. */ }
  }
  function knockAt(spec) {
    const source = { ...spec, range: spec?.range || 11 };
    if (!soundLevel(source)) return false;
    notice(T.doorKnock,2800); // Única reacción interna: no narrar cada golpe.
    for (let i=0;i<3;i++) global.setTimeout(() => {
      const level = soundLevel(source); // El jugador o la puerta pueden haberse movido.
      if (!level) return;
      knockSound(level);
      soundAt({ ...source, id:'knock',text:T.soundWords?.knock,level });
    }, i*440);
    return true;
  }

  // SFX puntuales; se evalúan sólo cuando ocurre un evento, nunca por frame.
  function playSfxAt(spec) {
    const level = spec?.self === true ? 1 : soundLevel(spec);
    if (!level) return false;
    const presets = {
      door_open: { start: 130, end: 185, duration: .24, volume: .10, wave: 'sawtooth' },
      door_close: { start: 105, end: 58, duration: .13, volume: .16, wave: 'triangle' },
      lamp_click: { start: 620, end: 280, duration: .027, volume: .065, wave: 'square' },
      computer_start: { start: 75, end: 155, duration: .46, volume: .075, wave: 'triangle' }
    };
    const preset = presets[spec?.id];
    if (!preset) return false;
    actionAt({ ...spec, level });
    try {
      const Audio = global.AudioContext || global.webkitAudioContext;
      if (!Audio) return true;
      audio = global.ForestHorrorAudioContext || audio || new Audio();
      global.ForestHorrorAudioContext = audio;
      if (audio.state === 'suspended') audio.resume().catch(()=>{});
      const now = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = preset.wave;
      osc.frequency.setValueAtTime(preset.start,now);
      osc.frequency.exponentialRampToValueAtTime(preset.end,now+preset.duration);
      gain.gain.setValueAtTime(Math.max(.001,preset.volume*level),now);
      gain.gain.exponentialRampToValueAtTime(.001,now+preset.duration);
      osc.connect(gain);gain.connect(audio.destination);
      osc.start(now);osc.stop(now+preset.duration+.01);
    } catch (_) { /* Un navegador sin audio no debe interrumpir la interacción. */ }
    return true;
  }
  function clearKind(kind){
    for(let i=spatialItems.length-1;i>=0;i--){
      if(spatialItems[i].kind!==kind)continue;
      spatialItems[i].el.remove();
      spatialItems.splice(i,1);
    }
  }
  function tick() {
    if (!spatialItems.length || !elements) return;
    const view = getView();
    const now = global.performance.now();
    for (let i=spatialItems.length-1;i>=0;i--) {
      const p=spatialItems[i];
      if (now>=p.expires) { p.el.remove();spatialItems.splice(i,1);continue; }
      if (p.kind==='sleep' && Number.isFinite(p.screenX) && Number.isFinite(p.screenY)) {
        p.el.hidden=false;
        p.el.style.left=p.screenX+'px';
        p.el.style.top=p.screenY+'px';
        p.el.style.transform='translate(-50%,-50%)';
        continue;
      }
      if (!view){p.el.hidden=true;continue;}
      if (now>=p.nextSight) {
        p.nextSight=now+100;
        p.shown=p.floor===view.floor && (p.self || (typeof view.visible==='function' && view.visible(p.x,p.z,p.floor)));
      }
      if (!p.shown || !view.camera || !view.canvas || !global.THREE) {p.el.hidden=true;continue;}
      const ndc = new global.THREE.Vector3(p.x,p.y,p.z).project(view.camera);
      if (ndc.z<=-1 || ndc.z>=1 || Math.abs(ndc.x)>1 || Math.abs(ndc.y)>1) {p.el.hidden=true;continue;}
      const rect=view.canvas.getBoundingClientRect();p.el.hidden=false;
      p.el.style.left = (rect.left+(ndc.x+1)*rect.width*.5)+'px';
      p.el.style.top = (rect.top+(1-ndc.y)*rect.height*.5)+'px';
      p.el.style.transform = 'translate(-50%,-50%)';
    }
  }
  global.FHLiveText = Object.freeze({ configure,showDialogue,typeInto,advance,isDialogOpen,notice,flushNotice,soundAt,soundLevel,actionAt,actionWord,playSfxAt,knockAt,clearKind,tick,delayAfter,audible,normalizePages,PAUSE });
})(typeof window !== 'undefined' ? window : globalThis);
