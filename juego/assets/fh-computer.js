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
  const userId=safeText(state.player?.id||state.playerId||options.defaultUserId||'GUARDIA_03');
  const apps=Array.isArray(item?.pcApps)
   ?APPS.filter(app=>item.pcApps.includes(app)):APPS.slice();
  const ids=Array.isArray(item?.pcConnections?.cameras)?item.pcConnections.cameras.filter(v=>typeof v==='string'):[];
  const cameras=(Array.isArray(options.cameras)?options.cameras:[])
   .filter(cam=>ids.includes(cam.id))
   .map(cam=>({id:safeText(cam.id),place:safeText(cam.place||cam.label||cam.id),online:cam.online!==false}));
  const mails=Array.isArray(state.computer?.mails)?state.computer.mails:null;
  return {
   ...hardware,
   stationId:safeText(item?.id),
   floor:Number.isInteger(options.floor)?options.floor:0,
   userId,apps,cameras,
   mails:mails?mails.slice(0,100):null
  };
 }
 function createRuntime(options={}){
  const assembly=options.assembly||root.FHPcAssembly;
  const TEXT=options.strings||root.FH_DELIVERY_TEXT||{};
  let frame=null,active=null,opened=false;
  const floorItems=f=>options.floorItems?.(f)||[];
  const say=(value,ms=2900)=>options.notice?.(value,ms);
  function isStation(item,floor=options.currentFloor?.()||0){
   return isPc(item,floorItems(floor),options.feetPerCell||5,assembly);
  }
  function terminalApi(){try{return frame?.contentWindow?.ForestTerminal3D||null}catch{return null}}
  function applySession(){
   if(!opened||!active)return;
   const api=terminalApi();if(!api)return;
   api.setSession?.({stationId:active.stationId,userId:active.userId,apps:active.apps,cameras:active.cameras});
   if(active.mails)api.setMails?.(active.mails);
   options.onTerminalReady?.(api,active);
   api.power?.(true);api.open?.();
  }
  function ensureFrame(){
   if(frame)return frame;
   const doc=options.document||root.document;
   if(!doc)return null;
   const style=doc.createElement('style');
   style.textContent='#fhPcOverlay{position:fixed;inset:0;z-index:60;background:#070b0d;display:none}'+
    '#fhPcOverlay.open{display:block}#fhPcFrame{width:100%;height:100%;border:0;display:block}'+
    '#fhPcExit{position:absolute;z-index:5;right:max(10px,env(safe-area-inset-right));bottom:max(10px,env(safe-area-inset-bottom));'+
    'border:2px solid #b59b6e;background:#171d1c;color:#f1dfb8;padding:9px 13px;font:700 11px monospace;box-shadow:3px 4px #0009}';
   doc.head.append(style);
   const wrap=doc.createElement('div');wrap.id='fhPcOverlay';wrap.setAttribute('aria-hidden','true');
   frame=doc.createElement('iframe');frame.id='fhPcFrame';frame.title='RAVEN/OS';frame.setAttribute('allow','fullscreen');
   frame.src=new URL('fh-terminal.html',options.baseUrl||doc.baseURI).href;
   const exit=doc.createElement('button');exit.id='fhPcExit';exit.textContent=TEXT.pcClose||'Salir de la PC';exit.onclick=close;
   wrap.append(frame,exit);doc.body.append(wrap);
   frame.addEventListener('load',applySession);
   return frame;
  }
  function open(item,floor=options.currentFloor?.()||0){
   const session=sessionFor(item,floorItems(floor),{
    state:options.state,assembly,feetPerCell:options.feetPerCell,
    floor,cameras:options.cameras?.()||[],defaultUserId:options.defaultUserId
   });
   if(!session.ready){
    if(session.reason==='assembly-unavailable')say(TEXT.pcSystemMissing||'No se pudo verificar la computadora.');
    else if(session.missing.length){
     const names=session.missing.map(k=>TEXT.pcMissingNames?.[k]||k);
     say(TEXT.pcMissing?.(names)||'Faltan componentes de la computadora.');
    }else say(TEXT.pcUnavailable||'No hay una computadora funcional aquí.');
    return false;
   }
   const view=ensureFrame();if(!view){say(TEXT.terminalError||'No se pudo abrir RAVEN/OS.');return false;}
   active=session;opened=true;
   view.parentElement.classList.add('open');view.parentElement.setAttribute('aria-hidden','false');
   options.freeze?.(true);options.onOpen?.(item,floor,session);
   // La primera visita espera al evento load; las siguientes reutilizan el iframe.
   if(terminalApi())applySession();
   return true;
  }
  function close(){
   if(!frame||!opened)return;
   frame.parentElement.classList.remove('open');
   frame.parentElement.setAttribute('aria-hidden','true');
   opened=false;active=null;options.freeze?.(false);options.onClose?.();
  }
  return Object.freeze({
   isPc:isStation,open,close,terminalApi,
   get frame(){return frame},get isOpen(){return opened},
   get session(){return active?{...active,apps:[...active.apps],cameras:active.cameras.map(x=>({...x}))}:null}
  });
 }
 return {APPS,isLegacyPc,isPc,inspect,sessionFor,createRuntime};
});
