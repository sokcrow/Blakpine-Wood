/* Blakpine Wood — teléfono del jugador. Única sesión por partida; el gameplay sigue activo. */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHPhone=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const BASE_APPS=Object.freeze(['directory','messages','notes','accounts','calendar','weather','flashlight','store','network','calls']);
 const AVAILABLE_APPS=Object.freeze([...BASE_APPS,'hamazon']);
 const CATEGORIES=Object.freeze(['person','business','service','player']);
 const EXTRA_APPS=new Map();
 function registerApp(def){
  if(!def||!(/^[a-z][a-z0-9_-]{1,31}$/).test(def.id)||AVAILABLE_APPS.includes(def.id)||
    typeof def.render!=='function'||typeof def.name!=='string'||!def.name.trim())return false;
  EXTRA_APPS.set(def.id,{name:def.name.slice(0,40),icon:String(def.icon||'◇').slice(0,3),render:def.render});
  return true;
 }
 const allApps=()=>[...AVAILABLE_APPS,...EXTRA_APPS.keys()];
 const safe=(value,max=100)=>String(value==null?'':value).trim().slice(0,max);
 const copy=value=>JSON.parse(JSON.stringify(value));
 const validApp=id=>AVAILABLE_APPS.includes(id)||EXTRA_APPS.has(id);
 const positiveInt=value=>Number.isSafeInteger(value)&&value>=1&&value<=20;
 const stamps=()=>Date.now().toString(36);
 function ensureState(state){
  if(!state||typeof state!=='object')throw Error('Estado de partida no disponible');
  const p=state.phone&&typeof state.phone==='object'?state.phone:{};
  p.installedApps=[...new Set([...BASE_APPS,...(Array.isArray(p.installedApps)?p.installedApps:[]).filter(validApp)])];
  p.notes=Array.isArray(p.notes)?p.notes.filter(n=>n&&typeof n==='object').slice(0,200):[];
  p.contacts=Array.isArray(p.contacts)?p.contacts.filter(c=>c&&typeof c==='object').slice(0,200):[];
  p.messages=Array.isArray(p.messages)?p.messages.filter(m=>m&&typeof m==='object').slice(-500):[];
  p.calls=Array.isArray(p.calls)?p.calls.slice(-100):[];
  p.battery=Number.isFinite(Number(p.battery))?Math.max(0,Math.min(100,Number(p.battery))):100;
  p.placedAt=typeof p.placedAt==='string'?p.placedAt:'';
  if(!p.contacts.some(c=>c.id==='hamazon'))p.contacts.unshift({id:'hamazon',name:'Hamazon',kind:'business'});
  if(!p.contacts.some(c=>c.id==='hamazon-delivery'))p.contacts.push({id:'hamazon-delivery',name:'Entregas Hamazon',kind:'service'});
  p.accountId=safe(p.accountId||state.characterId||state.player?.id||state.playerId||'GUARDIA_03',100);
  state.phone=p;
  if(!state.commerce||typeof state.commerce!=='object')state.commerce={};
  state.commerce.cart=Array.isArray(state.commerce.cart)?state.commerce.cart.filter(v=>
   v&&typeof v.productId==='string'&&positiveInt(v.quantity)).slice(0,60):[];
  return p;
 }
 function formatClock(minutes){
  const n=Number(minutes);
  const m=Number.isFinite(n)?((Math.floor(n)%1440)+1440)%1440:480;
  return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
 }
 function calendarModel(clock){
  const year=Math.max(100,Math.min(9999,Math.floor(Number(clock?.year)||2016)));
  const month=Math.max(1,Math.min(12,Math.floor(Number(clock?.month)||6)));
  const days=new Date(Date.UTC(year,month,0)).getUTCDate();
  const day=Math.max(1,Math.min(days,Math.floor(Number(clock?.day)||1)));
  const date=new Date(Date.UTC(year,month-1,day));
  const firstDay=(new Date(Date.UTC(year,month-1,1)).getUTCDay()+6)%7;
  return {year,month,day,date,days,firstDay,key:year+'-'+month+'-'+day};
 }
 function formatCalendarDate(clock,locale='es-ES'){
  return new Intl.DateTimeFormat(locale,{timeZone:'UTC',
   weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(calendarModel(clock).date);
 }
 function formatCalendarMonth(clock,locale='es-ES'){
  return new Intl.DateTimeFormat(locale,{timeZone:'UTC',
   month:'long',year:'numeric'}).format(calendarModel(clock).date);
 }
 function installApp(state,id){
  const p=ensureState(state);if(!validApp(id))return false;
  if(!p.installedApps.includes(id))p.installedApps.push(id);
  return true;
 }
 function uninstallApp(state,id){
  if(BASE_APPS.includes(id)||!validApp(id))return false;
  const p=ensureState(state);p.installedApps=p.installedApps.filter(a=>a!==id);return true;
 }
 function createRuntime(options={}){
  const state=options.state||{};
  const p=ensureState(state);
  const document=options.document||root.document;
  const T=options.strings||root.FH_PHONE_TEXT||{};
  const label=(k,f)=>T[k]||f||k;
  const save=()=>{try{options.save?.()}catch(error){root.console?.warn?.('FHPhone: guardado',error)}};
  const clock=()=>formatClock(state.clock?.minutes);
  const commerce=()=>state.commerce.cart;
   const locale=label('calendarLocale','es-ES');
   const weatherState=()=>options.weather?.()||null;
   const weatherNames={
    soleado:'weatherSunny',parcial_nublado:'weatherPartlyCloudy',
    nublado:'weatherOvercast',llovizna:'weatherDrizzle',
    lluvia:'weatherRain',tormenta:'weatherStorm'
   };
   function weatherName(v){
    if(!v)return label('weatherUnavailable');
    if(v.phase==='nieve')return label(v.type==='tormenta'?'weatherSnowstorm':'weatherSnow');
    if(v.phase==='aguanieve')return label('weatherSleet');
    return label(weatherNames[v.type]||'weatherUnavailable');
   }
   function weatherTemperature(v){
    return v&&Number.isFinite(Number(v.temp))
     ?Math.round(Number(v.temp))+' °C':label('weatherNoTemperature');
   }
  let opened=false,view='home',previous='home',filter='all',currentContact='',editingNote=null,currentDocument=null;
  let toggle=null,panel=null,content=null,clockNode=null,toastNode=null,topTitle=null;
  let statusChargeBar=null,statusChargeText=null,pendingNotice=false;
  let elapsed=0,toastTimer=null,lastTorch='',lastCalendarKey='',lastWeatherKey='',networkHost=null,networkEmpty=null,networkRows=new Map(),orderSeen=new Map((state.delivery?.orders||[]).map(o=>[o.id,o.status]));
  const el=(tag,cls,txt)=>{
   const n=document.createElement(tag);if(cls)n.className=cls;
   if(txt!==undefined)n.textContent=String(txt);
   return n;
  };
  const button=(text,fn,cls)=>{
   const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;
  };
  const append=(host,...nodes)=>{nodes.forEach(n=>host.append(n));return host};
  const container=(cls)=>el('div',cls);
  // Iconos vectoriales de trazo único. Los iconos de apps registradas conservan su fallback textual.
  const ICON_PATHS=Object.freeze({
  network:'M3 10a13 13 0 0 1 18 0 M6 13a8 8 0 0 1 12 0 M9 16a4 4 0 0 1 6 0 M12 19h.1',
  calls:'M6 4c1 0 2 3 3 4l-2 2a16 16 0 0 0 7 7l2-2c2 1 4 2 4 3-1 2-3 3-5 3C8 21 3 15 3 9c0-2 1-4 3-5Z',
   phone:'M7 2.5h10a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2Z M10 18.5h4',
   directory:'M5 4h14v16H5z M9 4v16 M12 9h4 M12 13h4',
   messages:'M5 5h14v12H9l-4 3V5z M8 9h8 M8 12h5',
   notes:'M7 3h10l3 3v15H7z M17 3v4h3 M10 11h7 M10 15h7 M10 19h5',
   accounts:'M4 6h16v12H4z M4 10h16 M8 15h4',
   flashlight:'M9 3h6l1 5-2.5 3v9h-3v-9L8 8z M9 8h6',
   store:'M4 4h7v7H4z M14 4h6v7h-6z M4 14h7v6H4z M14 14h6v6h-6z',
   hamazon:'M4 8h16v13H4z M8 8V6a4 4 0 0 1 8 0v2 M4 12h16',
   calendar:'M5 5h14v16H5z M8 3v4 M16 3v4 M5 10h14 M9 14h2 M13 14h2 M9 18h2',
   weather:'M5 17h13a3 3 0 0 0 0-6h-1a5 5 0 0 0-9.4-1.3A3.5 3.5 0 0 0 5 17z M5 5V3 M2 7H1 M9 3l1-1',
   signal:'M3 19v-3 M8 19v-6 M13 19V9 M18 19V5',
   lock:'M6 10V7a6 6 0 0 1 12 0v3 M5 10h14v11H5z',
   eye:'M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
   eyeOff:'M3 3l18 18 M10 6.3a11.3 11.3 0 0 1 2-.3c6 0 10 6 10 6a17 17 0 0 1-3.3 3.6 M6.2 6.9C3.5 8.6 2 12 2 12s4 6 10 6c1.7 0 3.2-.4 4.5-1.1 M10 10a3 3 0 0 0 4 4',
   home:'M3 11l9-7 9 7 M6 10v10h12V10 M10 20v-6h4v6',
   back:'M15 18l-6-6 6-6',
   close:'M6 6l12 12 M18 6L6 18'
  });
  function glyph(id){
   const d=ICON_PATHS[id];
   if(!d)return el('span','',label('icon_'+id,EXTRA_APPS.get(id)?.icon||'◇'));
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
   svg.setAttribute('viewBox','0 0 24 24');
   svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');
   svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');
   svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');
   const path=document.createElementNS('http://www.w3.org/2000/svg','path');
   path.setAttribute('d',d);svg.append(path);return svg;
  }
  // Indicador Wi-Fi de ondas (no barras de red celular).
  function wifiSignalIcon(bars){
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
   svg.classList.add('fh-phone-network-signal');
   svg.setAttribute('viewBox','0 0 24 24');
   svg.setAttribute('fill','none');
   svg.setAttribute('stroke','currentColor');
   svg.setAttribute('stroke-width','2');
   svg.setAttribute('stroke-linecap','round');
   svg.setAttribute('aria-hidden','true');
   for(const d of [
    'M9 16.5a4.5 4.5 0 0 1 6 0',
    'M5.7 13a9.5 9.5 0 0 1 12.6 0',
    'M2 9a15 15 0 0 1 20 0'
   ]){
    const wave=document.createElementNS('http://www.w3.org/2000/svg','path');
    wave.setAttribute('d',d);svg.append(wave);
   }
   const dot=document.createElementNS('http://www.w3.org/2000/svg','circle');
   dot.setAttribute('cx','12');dot.setAttribute('cy','20');dot.setAttribute('r','1.5');
   dot.setAttribute('fill','currentColor');dot.setAttribute('stroke','none');
   svg.append(dot);
   updateWifiSignal(svg,bars);
   return svg;
  }
  function updateWifiSignal(svg,bars){
   const strength=Math.max(0,Math.min(3,Math.floor(Number(bars)||0)));
   for(let i=0;i<3;i++)svg.children[i]?.setAttribute('opacity',i<strength?'1':'.2');
   svg.children[3]?.setAttribute('opacity',strength?'1':'.2');
  }
  function wifiQuality(bars){
   return bars===3?label('wifiExcellent','Excelente'):
    bars===2?label('wifiGood','Buena'):
    bars===1?label('wifiWeak','Débil'):label('wifiNoSignal','Sin señal');
  }
  function updateStatus(){
   if(!statusChargeBar||!statusChargeText)return;
   const raw=Number(p.battery),charge=Number.isFinite(raw)?Math.max(0,Math.min(100,raw)):0;
   statusChargeBar.style.width=charge+'%';
   statusChargeText.textContent=Math.ceil(charge)+'%';
  }
  function syncNotification(){
   if(toggle)toggle.setAttribute('data-has-notification',String(pendingNotice));
  }
  function notice(message){
   if(!toastNode)return;
   toastNode.textContent=message;
   toastNode.hidden=false;root.clearTimeout?.(toastTimer);
   toastTimer=root.setTimeout?.(()=>{toastNode.hidden=true},2400);
  }
  function blocked(){
   if(!document?.body)return false;
   const body=document.body;
   return body.classList.contains('fh-pc-in-use')||body.classList.contains('breaker-active')||
    body.classList.contains('fh-player-menu-open')||
    document.getElementById('noteOverlay')?.classList.contains('open')||
    document.getElementById('fhDeliveryDialog')?.classList.contains('open')||
    document.getElementById('elevatorPanel')?.classList.contains('open');
  }
  function toolbar(title,back='home'){
   topTitle.textContent=title;
   const go=panel.querySelector('.fh-phone-back');if(go)go.hidden=view==='home';
   previous=back;
  }
  function empty(text){content.append(el('p','fh-phone-empty',text))}
  function screen(name,back='home'){
   view=name;content.replaceChildren();toolbar(label('app_'+name,name),back);
   if(name==='messages'||name==='conversation'){pendingNotice=false;syncNotification()}
   const handlers={home:home,directory:directory,messages:messages,conversation:conversation,
    notes:notes,editNote:editNote,document:readDocument,accounts:accounts,calendar:calendar,weather:weather,flashlight:flashlight,store:store,hamazon:hamazon,network:network,calls:calls};
   if(['store','hamazon'].includes(name)&&options.networkDelayMs){
    const ms=Math.max(0,Math.min(1800,Number(options.networkDelayMs())||0));
    if(ms>0){
     const loading=el('p','fh-phone-muted',label('networkLoading','Cargando datos de internet…'));
     content.append(loading);
     setTimeout(()=>{if(view!==name||!opened||p.placedAt)return;loading.remove();handlers[name]?.();},ms);
     return;
    }
   }
   if(handlers[name])handlers[name]();
   else if(EXTRA_APPS.has(name))EXTRA_APPS.get(name).render({container:content,state,save,back:()=>screen('home')});
   else home();
  }
  function home(){
   const hero=container('fh-phone-clock-card');
   append(hero,el('strong','fh-phone-big-clock',clock()),
    el('span','fh-phone-home-date',formatCalendarDate(state.clock,locale)));
   content.append(hero);
   const widget=button('',()=>screen('weather'),'fh-phone-weather-widget');
   widget.setAttribute('aria-label',label('weatherOpen'));
   const icon=container('fh-phone-weather-icon');icon.append(glyph('weather'));
   const copy=container('fh-phone-weather-copy');
   append(copy,el('span','fh-phone-weather-label',label('weatherNow')),
    el('strong','fh-phone-weather-condition',weatherName(weatherState())),
    el('small','fh-phone-weather-date',formatCalendarDate(state.clock,locale)));
   append(widget,icon,copy,el('strong','fh-phone-weather-temp',weatherTemperature(weatherState())));
   content.append(widget);
   const grid=container('fh-phone-app-grid');content.append(grid);
   for(const id of p.installedApps){
    const b=button('',()=>screen(id),'fh-phone-app');
    b.dataset.app=id;
    const icon=container('fh-phone-app-icon');icon.append(glyph(id));
    append(b,icon,el('span','fh-phone-app-label',label('app_'+id,EXTRA_APPS.get(id)?.name||id)));
    grid.append(b);
   }
  }
  function accounts(){
   const M=root.FH_ECONOMY_TEXT||{},text=key=>M[key]||label('notAvailable','—');
   const reader=options.economyView||root.FHEconomyView;
   const id=state.characterId||root.FHCharacterRuntime?.character?.id;
   const v=reader?.readForCharacter(id,options.economyStorage||root.localStorage);
   if(!v?.ok){empty(text(v?.reason||'storage_unavailable'));return}
   content.append(el('p','fh-phone-muted',text('moneyReadOnly')));
   const cards=container('fh-phone-accounts-grid');
   for(const [kind,caption,value] of [['cash',text('cashBalance'),v.cashUsd],['bank',text('bankBalance'),v.bankUsd]]){
    const card=container('fh-phone-account-card');card.dataset.kind=kind;
    append(card,el('small','',caption),el('strong','',value));cards.append(card);
   }
   content.append(cards);
   const total=container('fh-phone-account-total');
   append(total,el('span','',text('totalBalance')),el('strong','',v.totalUsd));
   content.append(total,button(label('refreshAccounts','Actualizar'),()=>screen('accounts'),'fh-phone-account-refresh'),
    el('h3','fh-phone-section',text('recentMovements')));
   if(!v.movements.length){empty(text('noMovements'));return}
   for(const m of v.movements){
    const entry=container('fh-phone-account-movement');entry.dataset.status=m.status;
    const details=container('fh-phone-account-movement-detail');
    const op=m.operation==='credit'?text('creditLabel'):m.operation==='debit'?text('debitLabel'):text('transferLabel');
    const direction=m.direction==='incoming'?text('incoming'):m.direction==='outgoing'?text('outgoing'):text('internalTransfer');
    const status=m.status==='rejected'?text('rejectedLabel'):text('confirmedLabel');
    append(details,el('strong','',op+' · '+direction),
      el('small','',status+(m.status==='rejected'?' · '+(M[m.reason]||text('rejected')):'')));
    const sign=m.status==='rejected'?'':m.direction==='incoming'?'+':m.direction==='outgoing'?'−':'';
    append(entry,details,el('strong','fh-phone-account-movement-amount',sign+m.amountUsd));content.append(entry);
   }
  }
  function calendar(){
   const model=calendarModel(state.clock);
   lastCalendarKey=model.key;
   content.append(el('h3','fh-phone-section',label('app_calendar')));
   content.append(el('p','fh-phone-calendar-current',formatCalendarDate(state.clock,locale)));
   content.append(el('strong','fh-phone-calendar-month',formatCalendarMonth(state.clock,locale)));
   const grid=container('fh-phone-calendar-grid'),weekdays=label('calendarWeekdays',[]);
   for(const day of weekdays)grid.append(el('span','fh-phone-calendar-weekday',day));
   for(let i=0;i<model.firstDay;i++)grid.append(el('span','fh-phone-calendar-blank',''));
   for(let day=1;day<=model.days;day++){
    const cell=el('span','fh-phone-calendar-day',day);
    if(day===model.day){cell.classList.add('is-today');cell.setAttribute('aria-current','date')}
    grid.append(cell);
   }
   content.append(grid);
   content.append(el('p','fh-phone-muted',label('calendarGameTime')+' · '+clock()));
  }
  function nextWeatherChange(){
   const next=Number(state.weather?.nextAt);
   const year=Number(state.clock?.year),month=Number(state.clock?.month),day=Number(state.clock?.day);
   if(!Number.isFinite(next)||!Number.isFinite(year)||!Number.isFinite(month)||!Number.isFinite(day))
    return label('weatherUnknownChange');
   const minutes=Date.UTC(year,month-1,day)/60000+(Number(state.clock?.minutes)||0);
   const left=Math.max(0,Math.ceil(next-minutes));
   return left>=60?Math.ceil(left/60)+' '+label('weatherHours'):left+' '+label('weatherMinutes');
  }
  function weatherKey(v){
   if(!v)return 'sin-clima';
   return [v.type,v.phase,Math.round(Number(v.temp)||0),v.fog,
    Math.round((Number(v.snow)||0)*100),Math.round((Number(v.wetness)||0)*100),
    Math.floor((Number(state.clock?.minutes)||0)/5)].join('|');
  }
  function weather(){
   const v=weatherState();
   lastWeatherKey=weatherKey(v);
   content.append(el('h3','fh-phone-section',label('app_weather')));
   const hero=container('fh-phone-weather-detail');
   append(hero,el('span','fh-phone-weather-label',label('weatherNow')),
    el('strong','fh-phone-weather-detail-condition',weatherName(v)),
    el('span','fh-phone-weather-detail-temp',weatherTemperature(v)));
   content.append(hero);
   if(!v){content.append(el('p','fh-phone-muted',label('weatherUnavailableHelp')));return}
   const facts=container('fh-phone-weather-facts');
   function fact(key,value){
    const item=container('fh-phone-weather-fact');
    append(item,el('small','',label(key)),el('strong','',value));
    facts.append(item);
   }
   fact('weatherSeason',label('season_'+v.season));
   const fog=Math.max(0,Math.min(3,Math.floor(Number(v.fog)||0)));
   fact('weatherFog',label('weatherFog'+fog));
   fact('weatherSnowCoverage',Math.round(Math.max(0,Math.min(1,Number(v.snow)||0))*100)+'%');
   fact('weatherWetness',Math.round(Math.max(0,Math.min(1,Number(v.wetness)||0))*100)+'%');
   content.append(facts);
   content.append(el('p','fh-phone-muted',label('weatherNextChange')+': '+nextWeatherChange()));
  }
  function networkCard(net){
   const row=container('fh-phone-entry fh-phone-network-card');
   const heading=container('fh-phone-network-heading');
   const identity=container('fh-phone-network-identity');
   identity.append(el('strong','fh-phone-network-name',safe(net.name||net.routerId,80)));
   // El candado depende de la contraseña configurada, no de la sesión activa.
   const protectedNetwork=net.requiresPassword===true||(net.requiresPassword===undefined&&net.authenticated===false);
   if(protectedNetwork){
    const lock=glyph('lock');
    lock.classList.add('fh-phone-network-lock');
    lock.setAttribute('role','img');
    lock.setAttribute('aria-hidden','false');
    lock.setAttribute('aria-label',label('wifiProtected','Red protegida'));
    identity.append(lock);
   }
   const bars=Math.max(0,Math.min(3,Math.floor(Number(net.bars)||0)));
   const strength=container('fh-phone-network-strength');
   const signal=wifiSignalIcon(bars),quality=el('small','',wifiQuality(bars));
   strength.append(signal,quality);
   heading.append(identity,strength);row.append(heading);
   let status=null,password=null,connect=null;
   if(net.authenticated){
    status=el('small','fh-phone-network-status',net.online?
     label('wifiConnectedStatus','Conectado'):label('offlineNet','Sin servicio'));
    row.append(status);
   }else{
    const form=el('form','fh-phone-network-form');
    const field=container('fh-phone-network-password-field');
    password=el('input');
    password.type='password';password.maxLength=100;
    password.placeholder=label('wifiPassword','Contraseña Wi-Fi');
    password.autocomplete='off';password.spellcheck=false;
    password.setAttribute('aria-label',label('wifiPassword','Contraseña Wi-Fi'));
    const visibility=button('',()=>{
     const visible=password.type==='password';
     password.type=visible?'text':'password';
     visibility.setAttribute('aria-label',label(visible?'wifiHidePassword':'wifiShowPassword',
      visible?'Ocultar contraseña':'Mostrar contraseña'));
     visibility.setAttribute('aria-pressed',String(visible));
     visibility.replaceChildren(glyph(visible?'eyeOff':'eye'));
    },'fh-phone-network-visibility');
    visibility.setAttribute('aria-label',label('wifiShowPassword','Mostrar contraseña'));
    visibility.setAttribute('aria-pressed','false');
    visibility.append(glyph('eye'));
    field.append(password,visibility);
    connect=el('button','fh-phone-primary',label('connect','Conectar'));
    connect.type='submit';
    connect.disabled=true;
    password.addEventListener('input',()=>{connect.disabled=!password.value||row.dataset.inRange==='false'});
    form.addEventListener('submit',event=>{
     event.preventDefault();
     if(!password.value){notice(label('wifiPasswordMissing','Introduce la contraseña'));return;}
     if(row.dataset.inRange==='false'){notice(label('wifiNoSignal','Sin señal'));return;}
     const ok=options.connectWifi?.(net.routerId,password.value)===true;
     notice(label(ok?'wifiConnected':'wifiRejected',ok?'Conectado':'Clave incorrecta'));
     if(ok){save();screen('network');}
    });
    form.append(field,connect);row.append(form);
   }
   row.dataset.routerId=String(net.routerId);
   row.dataset.inRange='true';
   return {row,signal,quality,status,password,connect,
    authenticated:net.authenticated===true,protectedNetwork};
  }
  // Actualizar nodos existentes: escribir una contraseña no debe perder el foco ni su valor.
  function refreshNetworks(){
   if(!networkHost)return;
   const latest=options.networks?.()||[];
   const discovered=new Set();
   for(const net of latest){
    if(!net?.routerId||discovered.has(String(net.routerId)))continue;
    const id=String(net.routerId);discovered.add(id);
    const protectedNetwork=net.requiresPassword===true||(net.requiresPassword===undefined&&net.authenticated===false);
    let entry=networkRows.get(id);
    if(entry&&(entry.authenticated!== (net.authenticated===true)||entry.protectedNetwork!==protectedNetwork)){
     const replacement=networkCard(net);
     entry.row.replaceWith(replacement.row);
     entry=replacement;networkRows.set(id,entry);
    }else if(!entry){
     entry=networkCard(net);networkRows.set(id,entry);networkHost.append(entry.row);
    }
    const bars=Math.max(0,Math.min(3,Math.floor(Number(net.bars)||0)));
    updateWifiSignal(entry.signal,bars);
    entry.quality.textContent=wifiQuality(bars);
    entry.row.dataset.inRange=bars?'true':'false';
    if(entry.status)entry.status.textContent=net.online?
     label('wifiConnectedStatus','Conectado'):label('offlineNet','Sin servicio');
    if(entry.connect)entry.connect.disabled=!entry.password.value||!bars;
   }
   for(const [id,entry] of networkRows){
    if(discovered.has(id))continue;
    // Durante un corte breve se conserva la contraseña en curso y la red muestra 'Sin señal'.
    if(entry.password&&(entry.password.value||document.activeElement===entry.password)){
     updateWifiSignal(entry.signal,0);
     entry.quality.textContent=wifiQuality(0);
     entry.row.dataset.inRange='false';
     entry.connect.disabled=true;
     continue;
    }
    entry.row.remove();networkRows.delete(id);
   }
   if(networkEmpty)networkEmpty.hidden=networkRows.size!==0;
  }
  function network(){
   networkRows=new Map();
   content.append(el('h3','fh-phone-section',label('networkTitle','Conexiones disponibles')));
   networkHost=container('fh-phone-network-list');
   networkEmpty=el('p','fh-phone-empty',label('noNetworks','Sin redes Wi-Fi al alcance.'));
   networkHost.append(networkEmpty);content.append(networkHost);
   refreshNetworks();
   content.append(el('p','fh-phone-muted',options.mobileAvailable?.()!==false?
    label('mobileReady','Red móvil disponible'):label('mobileUnavailable','Sin red móvil')));
  }
 function calls(){
  const enabled=options.mobileAvailable?.()!==false;
  const form=el('form','fh-phone-message-form'),field=el('input');
  field.type='tel';field.maxLength=80;field.placeholder=label('dialNumber','Número o contacto');
  const call=button(label('call','Llamar'),()=>{},'fh-phone-primary');call.type='submit';call.disabled=!enabled;
  form.addEventListener('submit',ev=>{
   ev.preventDefault();const to=safe(field.value,80);if(!enabled||!to)return;
   const c={direction:'outgoing',to,at:Number(state.clock?.minutes)||0,status:'dialing'};
   if(options.onCall?.(c)===false){notice(label('callUnavailable','No se puede llamar'));return;}
   p.calls.push(c);p.calls=p.calls.slice(-100);save();screen('calls');
  });
  form.append(field,call);content.append(form);
  if(!enabled)empty(label('mobileUnavailable','Sin red móvil'));
  for(const c of p.calls.slice().reverse().slice(0,30))
   content.append(el('p','fh-phone-muted',(c.direction==='incoming'?label('incoming','Entrante'):label('outgoing','Saliente'))+' · '+safe(c.to||c.from,80)+' · '+formatClock(c.at)));
 }
 function directory(){
   const tabs=container('fh-phone-tabs');
   [['all','all'],['person','people'],['business','businesses'],['service','services'],['player','players']].forEach(([key,name])=>{
    const b=button(label(name,key),()=>{filter=key;screen('directory')});
    b.setAttribute('aria-pressed',String(filter===key));tabs.append(b);
   });content.append(tabs);
   const contacts=p.contacts.filter(c=>filter==='all'||c.kind===filter);
   if(!contacts.length)return empty(label('noContacts','Sin contactos registrados.'));
   for(const c of contacts){
    const row=container('fh-phone-entry');
    const info=container('fh-phone-entry-text');
    append(info,el('strong','',safe(c.name,80)),el('small','',label(c.kind,c.kind)));
    const open=button(label('write','Mensajes'),()=>{currentContact=c.id;screen('conversation','directory')});
    append(row,info,open);content.append(row);
   }
  }
  function messages(){
   const ids=[...new Set(p.messages.map(m=>m.contactId))];
   if(!ids.length)return empty(label('noMessages','No hay mensajes.'));
   ids.forEach(id=>{
    const c=p.contacts.find(c=>c.id===id),items=p.messages.filter(m=>m.contactId===id),last=items[items.length-1];
    const row=button((c?.name||id)+' · '+safe(last?.body,65),()=>{currentContact=id;screen('conversation','messages')},'fh-phone-conversation-row');
    content.append(row);
   });
  }
  function message(contactId,body,incoming=false){
   const value=safe(body,2000);if(!value)return false;
   p.messages.push({id:'msg_'+stamps()+'_'+p.messages.length,contactId:safe(contactId,80),
    body:value,incoming:!!incoming,time:Number(state.clock?.minutes)||0});
   if(p.messages.length>500)p.messages.splice(0,p.messages.length-500);
   if(incoming){pendingNotice=true;syncNotification()}
   save();if(opened&&(view==='messages'||view==='conversation'))screen(view,previous);return true;
  }
  function receive(contactId,body,contact=null){
   if(contact)addContact({...contact,id:contactId});
   return message(contactId,body,true);
  }
  function send(contactId,body){
  if(options.networkAvailable&&options.networkAvailable()!==true){notice(label('noInternet','Sin internet ni red móvil'));return false;}
   const contact=p.contacts.find(c=>c.id===contactId);
   if(!contact)return false;
   if(contact.kind==='player'&&!options.sendPlayerMessage){
    notice(label('offline','Mensajería multijugador sin conexión.'));return false;
   }
   if(contact.id!=='hamazon'&&contact.id!=='hamazon-delivery'&&!options.onSendMessage){
    notice(label('unavailable','Este contacto no recibe mensajes todavía.'));return false;
   }
   const value=safe(body,2000);if(!value)return false;
   if(contact.kind==='player'){
    const ok=options.sendPlayerMessage?.(contactId,value);
    if(ok!==true){notice(label('offline','Mensajería multijugador sin conexión.'));return false}
   }else if(contact.id!=='hamazon'&&contact.id!=='hamazon-delivery'){
    if(options.onSendMessage(contactId,value)!==true){
     notice(label('unavailable','No se pudo enviar el mensaje.'));return false;
    }
   }
   message(contactId,value,false);
   if(contact.id==='hamazon'||contact.id==='hamazon-delivery'){
    const orders=options.delivery?.()?.orders||[],last=orders[orders.length-1];
    const reply=last?label('lastOrder','Último pedido')+': '+safe(last.name,60)+' · '+safe(last.status,30)
      :label('noOrders','No hay pedidos registrados.');
    message(contactId,reply,true);
   }
   return true;
  }
  function conversation(){
   const c=p.contacts.find(c=>c.id===currentContact);
   if(!c)return empty(label('noContacts','Sin contacto.'));
   content.append(el('h3','fh-phone-section',safe(c.name,80)));
   const log=container('fh-phone-message-log');
   const items=p.messages.filter(m=>m.contactId===c.id);
   if(!items.length)log.append(el('p','fh-phone-empty',label('noMessages','No hay mensajes.')));
   for(const m of items){
    const bubble=el('div','fh-phone-bubble'+(m.incoming?' incoming':' outgoing'),safe(m.body,2000));
    bubble.append(el('small','',formatClock(m.time)));
    log.append(bubble);
   }
   content.append(log);
   const form=el('form','fh-phone-message-form');
   const field=el('input');field.type='text';field.maxLength=2000;field.placeholder=label('messagePlaceholder','Escribir mensaje');
   const submit=button(label('send','Enviar'),()=>{},'fh-phone-primary');submit.type='submit';
   form.addEventListener('submit',event=>{event.preventDefault();if(send(c.id,field.value))field.value=''});
   append(form,field,submit);content.append(form);
  }
  function notes(){
   content.append(button(label('newNote','+ Nueva nota'),()=>{editingNote={id:'',title:'',body:''};screen('editNote','notes')},'fh-phone-primary'));
   if(!p.notes.length)empty(label('noNotes','No has escrito ninguna nota.'));
   for(const n of p.notes.slice().reverse()){
    const row=container('fh-phone-entry');
    const info=button(safe(n.title,100)||label('untitled','Sin título'),()=>{editingNote={...n};screen('editNote','notes')},'fh-phone-entry-text');
    info.append(el('small','',safe(n.body,80)));
    const del=button('×',()=>{p.notes=p.notes.filter(v=>v.id!==n.id);save();screen('notes')},'fh-phone-danger');
    del.setAttribute('aria-label',label('deleteNote','Eliminar nota')+': '+safe(n.title,100));
    append(row,info,del);content.append(row);
   }
   const docs=(options.itemDefs||[]).filter(d=>d.kind==='note'&&state.inventory?.includes(d.id));
   if(!docs.length)return;
   content.append(el('h3','fh-phone-section',label('collectedNotes','Documentos recogidos')));
   for(const def of docs){
    const row=button(safe(def.name,100),()=>{
     currentDocument=def;options.markNoteRead?.(def.id);screen('document','notes');
    },'fh-phone-conversation-row');
    content.append(row);
   }
  }
  function readDocument(){
   if(!currentDocument)return empty(label('noNotes','No hay documentos.'));
   content.append(el('h3','fh-phone-section',safe(currentDocument.name,100)));
   content.append(el('article','fh-phone-document',safe(currentDocument.text||currentDocument.description,5000)));
  }
  function editNote(){
   const n=editingNote||{id:'',title:'',body:''};
   const form=el('form','fh-phone-note-form');
   const title=el('input');title.type='text';title.maxLength=100;title.value=n.title;
   title.placeholder=label('noteTitle','Título');
   title.setAttribute('aria-label',label('noteTitle','Título'));
   const body=el('textarea');body.maxLength=5000;body.rows=10;body.value=n.body;
   body.placeholder=label('noteBody','Contenido');
   body.setAttribute('aria-label',label('noteBody','Contenido'));
   const saveButton=button(label('saveNote','Guardar nota'),()=>{},'fh-phone-primary');saveButton.type='submit';
   form.addEventListener('submit',event=>{
    event.preventDefault();const value=safe(body.value,5000),heading=safe(title.value,100);
    if(!heading&&!value){notice(label('emptyNote','Escribe un título o contenido.'));return}
    const id=n.id||'note_'+stamps()+'_'+p.notes.length;
    const item={id,title:heading||label('untitled','Sin título'),body:value};
    const idx=p.notes.findIndex(entry=>entry.id===id);
    if(idx<0)p.notes.push(item);else p.notes[idx]=item;
    editingNote=null;save();screen('notes');
   });
   append(form,title,body,saveButton);content.append(form);
  }
  function flashlight(){
   const status=options.torchState?.()||{};
   const enabled=!!status.enabled,charge=Math.max(0,Math.min(100,Number(status.charge)||0));
   content.append(el('h3','fh-phone-section',label('flashlight','Linterna')));
   const control=button('',()=>{
    options.toggleTorch?.();screen('flashlight');
   },'fh-phone-primary fh-phone-torch-toggle');
   control.setAttribute('role','switch');
   control.setAttribute('aria-checked',String(enabled));
   control.setAttribute('aria-label',enabled?label('switchOff','Apagar'):label('switchOn','Encender'));
   append(control,el('span','fh-phone-torch-label',label('flashlight','Linterna')),container('fh-phone-switch-track'));
   content.append(control);
   content.append(el('p','fh-phone-readout',enabled?label('torchOn','ENCENDIDA'):label('torchOff','APAGADA')));
   const track=container('fh-phone-battery-track'),fill=container('fh-phone-battery-fill');
   fill.style.width=charge+'%';track.append(fill);
   append(content,track,el('p','fh-phone-muted',label('battery','Batería')+' · '+Math.ceil(charge)+'%'));
  }
  function store(){
   content.append(el('p','fh-phone-muted',label('storeHelp','Aplicaciones disponibles para este dispositivo.')));
   for(const id of allApps()){ 
    const installed=p.installedApps.includes(id);
    const row=container('fh-phone-entry');
    const info=container('fh-phone-entry-text');
    append(info,el('strong','',label('app_'+id,EXTRA_APPS.get(id)?.name||id)),el('small','',installed?label('installed','Instalada'):label('available','Disponible')));
    const b=button(installed?label('remove','Quitar'):label('install','Instalar'),()=>{
     if(installed){if(!uninstallApp(state,id))return}
     else installApp(state,id);
     save();screen('store');
    });
    b.disabled=installed&&BASE_APPS.includes(id);
    append(row,info,b);content.append(row);
   }
  }
  function cartChanged(){
   save();options.onCartChange?.(copy(commerce()));
  }
  function addCart(productId,quantity=1,destinationId='',paymentMethod='prepaid'){
   if(!positiveInt(quantity)||!options.delivery?.()?.products?.some(p=>p.id===productId&&p.shopStatus==='available'))return false;
   const validDest=options.addresses?.()||[];
   if(!validDest.some(a=>a.id===destinationId))return false;
   const methods=['prepaid','cash','card'];
   if(!methods.includes(paymentMethod))return false;
   const list=commerce(),same=list.find(v=>v.productId===productId&&v.destinationId===destinationId&&v.paymentMethod===paymentMethod);
   if(same){if(same.quantity+quantity>20)return false;same.quantity+=quantity}
   else list.push({id:'cart_'+stamps()+'_'+list.length,productId,quantity,destinationId,paymentMethod});
   cartChanged();return true;
  }
  function removeCart(id){const previous=commerce().length;state.commerce.cart=commerce().filter(v=>v.id!==id);
   if(previous===commerce().length)return false;cartChanged();return true}
  function checkoutCart(){
   const runtime=options.delivery?.(),list=commerce().slice();let accepted=0,remaining=[];
   for(const item of list){
    const order=runtime?.placeOrder?.(item.productId,item.paymentMethod,item.quantity,item.destinationId);
    if(order)accepted++;else remaining.push(item);
   }
   state.commerce.cart=remaining;cartChanged();
   return {accepted,failed:remaining.length};
  }
  function hamazon(){
   const d=options.delivery?.(),products=d?.products||[],orders=d?.orders||[],addresses=options.addresses?.()||[];
   const nav=container('fh-phone-tabs');let tab=panel.dataset.hamazonTab||'catalog';
   for(const [id,key] of [['catalog','catalog'],['cart','cart'],['orders','orders']]){
    const b=button(label(key,id),()=>{panel.dataset.hamazonTab=id;screen('hamazon')});
    b.setAttribute('aria-pressed',String(tab===id));nav.append(b);
   }content.append(nav);
   if(tab==='orders'){
    if(!orders.length)return empty(label('noOrders','No hay pedidos registrados.'));
    for(const o of orders.slice().reverse())content.append(el('div','fh-phone-order',
     safe(o.name||o.productId,100)+' × '+o.quantity+' · '+safe(o.status,35)));
    return;
   }
   if(tab==='cart'){
    if(!commerce().length)return empty(label('emptyCart','El carrito está vacío.'));
    for(const item of commerce().slice()){
     const product=products.find(v=>v.id===item.productId);
     const row=container('fh-phone-entry');
     append(row,el('div','fh-phone-entry-text',
      safe(product?.name||item.productId,100)+' × '+item.quantity),
      button(label('remove','Quitar'),()=>{removeCart(item.id);screen('hamazon')},'fh-phone-danger'));
     content.append(row);
    }
    content.append(button(label('checkout','Confirmar pedidos'),()=>{
     const result=checkoutCart();
     notice(label('ordersCreated','Pedidos registrados')+': '+result.accepted+
      (result.failed?' · '+label('failed','No registrados')+': '+result.failed:''));
     screen('hamazon');
    },'fh-phone-primary'));
    return;
   }
   if(!products.length)return empty(label('noCatalog','El catálogo aún no está disponible.'));
   if(!addresses.length)content.append(el('p','fh-phone-error',label('noAddresses','No hay direcciones de entrega válidas.')));
   for(const product of products.filter(v=>v.environment==='interior')){
    const row=container('fh-phone-product'),title=el('strong','',safe(product.name,90));
    const detail=el('small','',product.price==null?label('pricePending','Precio pendiente'):
     '$'+Number(product.price).toFixed(2));
    const fields=el('div','fh-phone-product-fields');
    const qty=el('input');qty.type='number';qty.inputMode='numeric';qty.min='1';qty.max='20';qty.value='1';qty.setAttribute('aria-label',label('quantity','Cantidad'));
    const addr=el('select');addr.setAttribute('aria-label',label('address','Dirección'));
    for(const a of addresses){const opt=el('option','',safe(a.name,80));opt.value=a.id;addr.append(opt)}
    const method=el('select');method.setAttribute('aria-label',label('payment','Pago'));
    for(const [value,key] of [['prepaid','prepaid'],['cash','cash'],['card','card']]){
     const opt=el('option','',label(key,value));opt.value=value;method.append(opt);
    }
    append(fields,qty,addr,method);
    const add=button(label('addCart','Añadir al carrito'),()=>{
     const ok=addCart(product.id,Number(qty.value),addr.value,method.value);
     notice(ok?label('added','Añadido al carrito'):label('invalidPurchase','Comprueba cantidad y destino.'));
    },'fh-phone-primary');
    add.disabled=product.shopStatus!=='available'||!addresses.length;
    append(row,title,detail,fields,add);content.append(row);
   }
  }
  function addContact(contact){
   if(!contact||!safe(contact.id,80)||!CATEGORIES.includes(contact.kind))return false;
   const entry={id:safe(contact.id,80),name:safe(contact.name,80)||safe(contact.id,80),kind:contact.kind};
   const idx=p.contacts.findIndex(c=>c.id===entry.id);
   if(idx>=0)p.contacts[idx]=entry;else p.contacts.push(entry);
   save();return true;
  }
  function syncAvailability(){
  const available=!p.placedAt;
  if(!available&&opened)close();
  if(toggle){toggle.hidden=!available;toggle.style.display=available?'':'none';}
  return available;
 }
 function update(dt=0){
  syncAvailability();
   elapsed+=Number.isFinite(dt)?Math.max(0,dt):0;
   if(elapsed<.5)return;elapsed=0;
   if(blocked()&&opened)close();
   if(clockNode)clockNode.textContent=clock();
   updateStatus();
   if(opened&&view==='home'){
    const value=content?.querySelector('.fh-phone-big-clock');if(value)value.textContent=clock();
    const date=formatCalendarDate(state.clock,locale);
    for(const node of content.querySelectorAll('.fh-phone-home-date,.fh-phone-weather-date'))node.textContent=date;
    const v=weatherState();
    const condition=content.querySelector('.fh-phone-weather-condition');
    const temperature=content.querySelector('.fh-phone-weather-temp');
    if(condition)condition.textContent=weatherName(v);
    if(temperature)temperature.textContent=weatherTemperature(v);
   }
   if(opened&&view==='network')refreshNetworks();
   if(opened&&view==='calendar'&&calendarModel(state.clock).key!==lastCalendarKey)screen('calendar');
   if(opened&&view==='weather'&&weatherKey(weatherState())!==lastWeatherKey)screen('weather');
   if(opened&&view==='flashlight'){
    const state=options.torchState?.()||{},signature=String(state.enabled)+'/'+Math.ceil(Number(state.charge)||0);
    if(lastTorch!==signature){lastTorch=signature;screen('flashlight')}
   }
   for(const order of options.delivery?.()?.orders||[]){
    if(!order?.id)continue;
    const prior=orderSeen.get(order.id);
    if(prior!==order.status){
     orderSeen.set(order.id,order.status);
     if(prior===undefined||prior!==null)
      receive('hamazon-delivery',(label('orderUpdate','Pedido')+' '+safe(order.name,70)+': '+safe(order.status,35)));
    }
   }
  }
  function close(){
   if(!opened)return;opened=false;panel.hidden=true;toggle?.setAttribute('aria-expanded','false');
   document.body.classList.remove('fh-phone-open');
  }
  function open(){
   if(!panel||blocked()||!syncAvailability()||p.battery<=0)return false;
   opened=true;panel.hidden=false;toggle.setAttribute('aria-expanded','true');
   document.body.classList.add('fh-phone-open');updateStatus();screen('home');return true;
  }
  function togglePhone(){return opened?(close(),true):open()}
  function onKeydown(event){
   const target=event.target,typing=target&&(target.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
   if(typing){
    if(opened&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return}
    if(opened)event.stopImmediatePropagation();
    return;
   }
   if(event.key?.toLowerCase()==='c'&&!event.repeat){
    if(blocked())return;
    event.preventDefault();event.stopImmediatePropagation();togglePhone();
   }else if(opened&&event.key==='Escape'){
    event.preventDefault();event.stopImmediatePropagation();close();
   }
  }
  function mount(){
   if(!document||document.getElementById('fhPhoneToggle'))return false;
   toggle=button('',togglePhone,'fh-phone-toggle');toggle.id='fhPhoneToggle';
   toggle.append(glyph('phone'));toggle.setAttribute('data-has-notification','false');
   toggle.setAttribute('aria-label',label('openPhone','Abrir celular'));
   toggle.setAttribute('aria-controls','fhPhonePanel');toggle.setAttribute('aria-expanded','false');
   panel=el('section','fh-phone-panel');panel.id='fhPhonePanel';panel.hidden=true;
   panel.setAttribute('aria-label',label('phone','Celular'));
   const bar=container('fh-phone-statusbar');
   clockNode=el('strong','fh-phone-status-clock',clock());
   const indicators=container('fh-phone-status-icons');
   const battery=container('fh-phone-status-battery');
   statusChargeBar=container('fh-phone-status-battery-fill');statusChargeText=el('span','fh-phone-status-percent','0%');
   battery.append(statusChargeBar);indicators.append(glyph('signal'),battery,statusChargeText);
   indicators.setAttribute('aria-label',label('phoneBattery','Batería del celular'));
   append(bar,clockNode,indicators);
   const head=container('fh-phone-header');
   topTitle=el('strong','fh-phone-title',label('phone','Celular'));
   const exit=button('',close,'fh-phone-close');
   exit.setAttribute('aria-label',label('closePhone','Cerrar celular'));exit.append(glyph('close'));
   append(head,topTitle,exit);
   content=container('fh-phone-content');
   const nav=container('fh-phone-nav'),back=button('',()=>screen(previous),'fh-phone-back');
   back.setAttribute('aria-label',label('back','Volver'));back.hidden=true;back.append(glyph('back'));
   const homeButton=button('',()=>screen('home'),'fh-phone-home');
   homeButton.setAttribute('aria-label',label('app_home','Inicio'));homeButton.append(glyph('home'));
   append(nav,back,homeButton);
   toastNode=el('div','fh-phone-toast');toastNode.hidden=true;
   append(panel,bar,head,content,nav,toastNode);
   updateStatus();
   document.body.append(toggle,panel);
   root.addEventListener?.('keydown',onKeydown,true);
   if(typeof root.addEventListener==='function')root.addEventListener('blur',close);
   return true;
  }
  mount();
  return Object.freeze({
   open,close,toggle:togglePhone,update,syncAvailability,addContact,receiveMessage:receive,sendMessage:send,
    receiveCall:call=>{
     if(!call||p.placedAt||p.battery<=0)return false;
     p.calls.push({from:safe(call.from,80),to:p.accountId,at:Number(state.clock?.minutes)||0,direction:'incoming',status:'ringing'});
     p.calls=p.calls.slice(-100);pendingNotice=true;syncNotification();save();return true;
    },
   addToCart:addCart,removeFromCart:removeCart,checkoutCart,
   syncCartToTerminal:()=>options.onCartChange?.(copy(commerce())),
   get isOpen(){return opened},
   get installedApps(){return p.installedApps.slice()},
   get cart(){return copy(commerce())}
  });
 }
 return {BASE_APPS,AVAILABLE_APPS,registerApp,ensureState,formatClock,calendarModel,formatCalendarDate,formatCalendarMonth,installApp,uninstallApp,createRuntime};
});