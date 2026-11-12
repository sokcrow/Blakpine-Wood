/* Forest Horror — reglas y sesión de computadoras fijas RAVEN/OS.
 * El montaje no depende de Hamazon. Sin laptop ni cambio de esquema de mapas.
 */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHComputer=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const APPS=Object.freeze(['mail','map','cams','files','hamazon']);
 const safeText=(value,fallback='')=>String(value==null?fallback:value).slice(0,100);
 function isLegacyPc(item){
  return !!item&&(item.pcTerminal===true||item.modelId==='escritorio_pc')&&item.pcAssemblyRequired!==true;
 }
 function isPc(item,items,feetPerCell=5,assembly=root.FHPcAssembly){
  return !!item&&(isLegacyPc(item)||item.pcTerminal===true||item.modelId==='escritorio_pc'||
   !!assembly?.isTerminalCandidate?.(item,items,feetPerCell));
 }
 function inspect(item,items,feetPerCell=5,assembly=root.FHPcAssembly){
  if(!isPc(item,items,feetPerCell,assembly))return {ready:false,reason:'not-a-pc',missing:[]};
  if(isLegacyPc(item))return {ready:true,legacy:true,missing:[]};
  if(!assembly?.inspect)return {ready:false,reason:'assembly-unavailable',missing:[]};
  const result=assembly.inspect(item,items,feetPerCell);
  return {ready:!!result.ready,legacy:false,missing:result.missing||[],components:result.components||{}};
 }
 function sessionFor(item,items,options={}){
  const assembly=options.assembly||root.FHPcAssembly;
  const hardware=inspect(item,items,options.feetPerCell||5,assembly);
  const state=options.state||{};
  const userId=safeText(state.phone?.accountId||state.characterId||state.player?.id||state.playerId||options.defaultUserId||'GUARDIA_03');
  const apps=Array.isArray(item?.pcApps)
   ?APPS.filter(app=>item.pcApps.includes(app)):APPS.slice();
  const ids=Array.isArray(item?.pcConnections?.cameras)?item.pcConnections.cameras.filter(v=>typeof v==='string'):[];
  const cameras=(Array.isArray(options.cameras)?options.cameras:[])
   .filter(cam=>ids.includes(cam.id))
   .map(cam=>({id:safeText(cam.id),place:safeText(cam.place||cam.label||cam.id),online:cam.online!==false,mode:['manual','automatic','fixed'].includes(cam.mode)?cam.mode:'fixed',angleDeg:Number.isFinite(Number(cam.angleDeg))?Number(cam.angleDeg):0}));
  const mails=Array.isArray(state.computer?.mails)?state.computer.mails:null;
  return {
   ...hardware,
   stationId:safeText(item?.id||('pc_'+(item?.modelId||'estacion')+'_'+(item?.x??0)+'_'+(item?.y??0))),
   floor:Number.isInteger(options.floor)?options.floor:0,
   userId,apps,cameras,
   mails:mails?mails.slice(0,100):null
  };
 }
 // Única fuente de verdad del consumo y estado por estación; no calcula facturas.
 function createPowerStore(options={}){
  const entries=options.entries||new Map();
  const now=options.now||Date.now;
  const random=options.random||Math.random;
  const notify=options.onChange||(()=>{});
  function read(key){
   const entry=entries.get(key)||{mode:'off',startedAt:0,readyAt:0,durationMs:0};
   if((entry.mode==='booting'||entry.mode==='waking')&&now()>=entry.readyAt){
    entry.mode='on';entries.set(key,entry);notify(key,{...entry});
   }
   return {...entry};
  }
  function change(key,mode,ms=0){
   const startedAt=now();
   const entry={mode,startedAt,readyAt:startedAt+ms,durationMs:ms};
   entries.set(key,entry);notify(key,{...entry});return read(key);
  }
  function start(key){
   const entry=read(key);
   if(entry.mode==='off'){
    const seed=Math.max(0,Math.min(1,Number(random())||0));
    return change(key,'booting',5000+Math.floor(seed*5000));
   }
   if(entry.mode==='sleep')return change(key,'waking',650);
   return entry;
  }
  function sleep(key){
   const entry=read(key);
   return entry.mode==='on'?change(key,'sleep'):entry;
  }
  function shutdown(key){return change(key,'off')}
  function draw(key){
   const mode=read(key).mode;
   return mode==='off'?0:mode==='sleep'?.15:1;
  }
  return Object.freeze({read,start,sleep,shutdown,draw});
 }
 function createRuntime(options={}){
  const assembly=options.assembly||root.FHPcAssembly;
  const TEXT=options.strings||root.FH_COMPUTER_TEXT||root.FH_DELIVERY_TEXT||{};
  const host=options.hostWindow||root;
  const powerStore=options.powerStore||createPowerStore({
   now:options.now,random:options.random,onChange:options.onPowerChange
  });
  let frame=null,active=null,activeKey='',opened=false;
  const floorItems=f=>options.floorItems?.(f)||[];
  const say=(value,ms=2900)=>options.notice?.(value,ms);
  const stationKey=(session,floor)=>String(floor)+':'+(session.stationId||session.id||('pc_'+(session.modelId||'estacion')+'_'+(session.x??0)+'_'+(session.y??0)));
  function isStation(item,floor=options.currentFloor?.()||0){
   return isPc(item,floorItems(floor),options.feetPerCell||5,assembly);
  }
  function terminalApi(){try{return frame?.contentWindow?.ForestTerminal3D||null}catch{return null}}
  function applySession(){
   if(!opened||!active)return;
   const api=terminalApi();if(!api)return;
   const network=options.networkFor?.(active.stationId,active.floor)||null;
    const apps=network?.online===false?active.apps.filter(app=>!['mail','hamazon'].includes(app)):active.apps;
    api.setSession?.({stationId:active.stationId,userId:active.userId,apps,cameras:active.cameras});
    if(network?.online===false)say(TEXT.noInternet||'Esta computadora no tiene conexión a internet.');
   if(active.mails)api.setMails?.(active.mails);
   options.onTerminalReady?.(api,active);
   if(api.setPowerState)api.setPowerState(powerStore.read(activeKey));
   else api.power?.(powerStore.read(activeKey).mode!=='off');
   api.open?.();
  }
  function close(){
   if(!frame||!opened)return;
   frame.parentElement.classList.remove('open');
   frame.ownerDocument?.body?.classList.remove('fh-pc-in-use');
   frame.parentElement.setAttribute('aria-hidden','true');
   opened=false;active=null;activeKey='';
   options.freeze?.(false);options.onClose?.();
  }
  function action(command,stationId){
   if(!opened||!active||String(stationId)!==active.stationId)return false;
   if(command==='reposo')powerStore.sleep(activeKey);
   else if(command==='apagar')powerStore.shutdown(activeKey);
   else if(command!=='salir')return false;
   if(command!=='salir')terminalApi()?.setPowerState?.(powerStore.read(activeKey));
   close();
   return true;
  }
  function receiveMessage(event){
   if(!frame||event.source!==frame.contentWindow)return;
   if(event.origin&&event.origin!==new URL(frame.src).origin)return;
   const data=event.data;
   if(data?.type!=='FOREST_TERMINAL_EVENT'||!opened||!active)return;
   if(data.name==='camara-giro'){
    const detail=data.detail||{};
    if(detail.stationId!==active.stationId||powerStore.read(activeKey).mode!=='on')return;
    const camera=active.cameras.find(v=>v.id===detail.id&&v.mode==='manual'&&v.online);
    if(!camera||!Number.isFinite(Number(detail.angleDeg)))return;
    const angle=Math.max(-45,Math.min(45,Number(detail.angleDeg)));
    options.onCameraControl?.(camera.id,angle,active);
    camera.angleDeg=angle;
    return;
   }
   if(data.name!=='control')return;
   action(data.detail?.action,data.detail?.stationId);
  }
  function ensureFrame(){
   if(frame)return frame;
   const doc=options.document||root.document;
   if(!doc)return null;
   const style=doc.createElement('style');
   style.textContent='#fhPcOverlay{position:fixed;inset:0;inset:0 env(safe-area-inset-right) 0 env(safe-area-inset-left);z-index:160;background:#070b0d;display:none}'+
    '#fhPcOverlay.open{display:block}#fhPcFrame{width:100%;height:100%;border:0;display:block}'+
    'body.fh-pc-in-use #fhMenuToggle,body.fh-pc-in-use #fhPlayerMenuLayer,body.fh-pc-in-use #hud,'+
    'body.fh-pc-in-use #actions,body.fh-pc-in-use #stick,body.fh-pc-in-use #inventoryPanel,'+
    'body.fh-pc-in-use #fhContextRadial,body.fh-pc-in-use #fhPeekTalk{visibility:hidden!important;pointer-events:none!important}';
   doc.head.append(style);
   const wrap=doc.createElement('div');wrap.id='fhPcOverlay';wrap.setAttribute('aria-hidden','true');
   frame=doc.createElement('iframe');frame.id='fhPcFrame';frame.title='RAVEN/OS';
   frame.setAttribute('allow','fullscreen');
   frame.src=new URL('fh-terminal.html?v=20261107-raven-16x10',options.baseUrl||doc.baseURI).href;
   wrap.append(frame);doc.body.append(wrap);
   frame.addEventListener('load',applySession);
   host.addEventListener?.('message',receiveMessage);
   return frame;
  }
  function open(item,floor=options.currentFloor?.()||0){
    if(options.powerAvailable?.(item,floor)===false){
     say(TEXT.noPower||'Esta computadora no tiene electricidad.');return false;
    }
   const session=sessionFor(item,floorItems(floor),{
    state:options.state,assembly,feetPerCell:options.feetPerCell,
    floor,cameras:options.cameras?.()||[],defaultUserId:options.defaultUserId
   });
   if(!session.ready){
    if(session.reason==='assembly-unavailable')say(TEXT.pcSystemMissing||'No se pudo verificar la computadora.');
    else if(session.missing.length){
     const names=session.missing.map(k=>TEXT.pcMissingNames?.[k]||k);
     say(TEXT.pcMissing?.(names)||'Faltan componentes de la computadora.');
    }else say(TEXT.unavailable||'No hay una computadora funcional aquí.');
    return false;
   }
   const view=ensureFrame();
   if(!view){say(TEXT.terminalError||'No se pudo abrir RAVEN/OS.');return false;}
   active=session;activeKey=stationKey(session,floor);
   powerStore.start(activeKey);
   opened=true;
   view.parentElement.classList.add('open');view.parentElement.setAttribute('aria-hidden','false');
   view.ownerDocument?.body?.classList.add('fh-pc-in-use');
   options.freeze?.(true);options.onOpen?.(item,floor,session);
   // La carga del iframe puede terminar después; el reloj de la PC no se pausa.
   if(terminalApi())applySession();
   return true;
  }
  return Object.freeze({
   isPc:isStation,open,close,action,terminalApi,
   powerFor:(item,floor=options.currentFloor?.()||0)=>powerStore.read(stationKey(item,floor)),
   consumptionFor:(item,floor=options.currentFloor?.()||0)=>powerStore.draw(stationKey(item,floor)),
   get frame(){return frame},get isOpen(){return opened},
   get session(){return active?{...active,apps:[...active.apps],cameras:active.cameras.map(x=>({...x}))}:null}
  });
 }
 return {APPS,isLegacyPc,isPc,inspect,sessionFor,createPowerStore,createRuntime};
});
