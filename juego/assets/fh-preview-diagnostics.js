/* Diagnóstico local del arranque y de los fotogramas de la vista 3D. */
(function(root){
 'use strict';
 const BUILD='3d-diag-20261109-2',LIMIT=80;
 const T=root.FH_PREVIEW_TEXT||{};
 function configureEditor({toggle,options,checkbox,label,hint,onToggle}){
  if(!toggle||!options||!checkbox)return;
  const key='fh_preview_diagnostics_visible_v1';
  try{checkbox.checked=root.localStorage?.getItem(key)==='1';}catch{checkbox.checked=false;}
  if(label)label.textContent=T.showDiagnostic;
  if(hint)hint.textContent=T.diagnosticAutomatic;
  toggle.setAttribute('aria-label',T.diagnosticOptions);
  toggle.title=T.diagnosticOptions;
  const sync=()=>{toggle.textContent=options.hidden?'▾':'▴';toggle.setAttribute('aria-expanded',String(!options.hidden));};
  toggle.addEventListener('click',()=>{options.hidden=!options.hidden;sync();onToggle?.();});
  checkbox.addEventListener('change',()=>{try{root.localStorage?.setItem(key,checkbox.checked?'1':'0');}catch{}});
  sync();
 }
 function createRuntime(host){
  let stage='resources',frames=0,lastPulse=0,failed=false,rendererRef=null;
  const send=entry=>host.parent.postMessage({type:'FOREST_PREVIEW_DIAGNOSTIC',build:BUILD,stage,...entry},'*');
  const clean=value=>String(value||'').slice(0,4000);
  function resource(url){
   try{
    const u=new URL(String(url),host.document.baseURI);
    if(u.protocol==='http:'||u.protocol==='https:')return u.origin+u.pathname;
    return u.protocol==='data:'?'data:':u.href.split(/[?#]/)[0];
   }
   catch{return clean(url)}
  }
  function fatal(error,details={}){
   if(failed)return;
   failed=true;
   send({kind:'fatal',message:clean(error?.message||error),stack:clean(error?.stack),...details});
   host.parent.postMessage({type:'FOREST_PREVIEW_ERROR',message:[T.diagnosticStages?.[stage]||stage,
    clean(error?.message||error),details.url,details.line].filter(Boolean).join(' · ')},'*');
  }
  function snapshot(){
   const game=host.ForestHorrorGame;if(!game)return null;
   try{
    const position=game.position||{},state=game.gameState||{},info=rendererRef?.info;
    return {x:position.x,z:position.z,floor:game.floor,fps:game.metrics?.fps,
     posture:game.posture?.phase,walkable:game.canWalk?.(position.x,position.z),hidden:!!state.hidden,
     menu:!!host.FHPlayerMenu?.isOpen?.(),phone:!!host.FHPhoneRuntime?.isOpen,
     dialogue:!!host.FHLiveText?.isDialogOpen?.(),critical:host.FHSurvivalRuntime?.state?.critical?.status||'',
     calls:info?.render?.calls,geometries:info?.memory?.geometries,textures:info?.memory?.textures,
     width:rendererRef?.domElement?.width,height:rendererRef?.domElement?.height};
   }catch(error){send({kind:'resource',message:T.snapshotFailure,stack:clean(error?.stack)});return null;}
  }
  host.addEventListener('error',event=>{
   const target=event.target;
   if(target&&target!==host&&(target.src||target.href)){
    const required=target.tagName==='SCRIPT';
    const entry={kind:required?'fatal':'resource',message:T.resourceFailure,url:resource(target.src||target.href)};
    if(required)fatal(entry.message,entry);else send(entry);
   }else fatal(event.error||event.message,{url:resource(event.filename||''),line:event.lineno||0,column:event.colno||0});
  },true);
  host.addEventListener('unhandledrejection',event=>fatal(event.reason||T.unknown));
  host.addEventListener('webglcontextlost',event=>fatal(T.contextLost),true);
  const api={
   stage(value){
    stage=value;if(!frames&&!failed)send({kind:'stage'});
    if(value==='firstFrame')for(const [name,file] of [['FHPlayerMenu','fh-player-menu.js'],
     ['FHLocationHUD','fh-location-hud.js'],['FHInteractionRadial','fh-interaction-radial.js']]){
     if(!host[name])send({kind:'resource',message:T.missingModule+': '+name,url:resource('juego/assets/'+file)});
    }
   },
   get failed(){return failed;},
   fatal,
   frame(){
    if(failed)return;
    frames++;
    const now=Date.now();
    if(frames===1){stage='playing';host.parent.postMessage({type:'FOREST_PREVIEW_RUNNING'},'*');}
    if(frames===1||now-lastPulse>=1000){lastPulse=now;send({kind:'frame',frames,state:snapshot()});}
   },
   watchThree(three,renderer){
    rendererRef=renderer;
    const manager=three.DefaultLoadingManager,previous=manager.onError;
    const previousStart=manager.onStart;
    manager.onStart=function(url,...rest){send({kind:'resource-start',url:resource(url)});previousStart?.call(this,url,...rest);};
    manager.onError=function(url){send({kind:'resource',message:T.resourceFailure,url:resource(url)});previous?.call(this,url);};
    // Three.js puede imprimir un fallo de shader sin lanzar una excepción.
    if(renderer?.debug)renderer.debug.checkShaderErrors=true;
   },
   resource(url,error){send({kind:'resource',url:resource(url),message:clean(error?.message||error||T.resourceFailure)});}
  };
  const oldError=host.console.error;
  host.console.error=function(...args){
   oldError.apply(this,args);
   const message=args.map(v=>typeof v==='string'?v:v?.message||'').join(' ');
   if(/THREE\.WebGLProgram|VALIDATE_STATUS|shader error|Error creating WebGL context/i.test(message))fatal(message);
   else if(/GLB|GLTFLoader/.test(message))send({kind:'resource',message:clean(message),stack:clean(args.find(v=>v?.stack)?.stack)});
  };
  const oldWarn=host.console.warn;
  host.console.warn=function(...args){
   oldWarn?.apply(this,args);
   const message=args.map(v=>typeof v==='string'?v:v?.message||'').join(' ');
   if(/GLB|GLTFLoader|Electricidad 01|Internet 01|Agua 01|Forest Arquitectura/.test(message)){
    send({kind:'resource',message:clean(message),stack:clean(args.find(v=>v?.stack)?.stack)});
   }
  };
  send({kind:'stage'});
  return Object.freeze(api);
 }
 function mount({container,frame,onFailure,showDuringPlay=false}){
  const doc=container.ownerDocument,entries=[];
  let lastFrame=0,running=false,disposed=false,failed=false,warnings=0;
  const panel=doc.createElement('details');panel.id='fh-preview-diagnostics';
  panel.hidden=!showDuringPlay;panel.open=showDuringPlay;
  panel.style.cssText='position:absolute;z-index:20;right:8px;bottom:8px;max-width:calc(100% - 16px);color:#eee;background:#101218f2;border:1px solid #9a9da6;padding:10px;font:13px/1.4 system-ui;touch-action:auto';
  panel.addEventListener('toggle',()=>{panel.style.width=panel.open?'min(620px, calc(100% - 16px))':'auto';});
  const summary=doc.createElement('summary');summary.textContent=T.diagnosticTitle+' · '+BUILD;summary.style.cursor='pointer';
  const pre=doc.createElement('pre');pre.style.cssText='max-height:45vh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;user-select:text;-webkit-user-select:text;font:12px/1.4 monospace';
  const stateLine=doc.createElement('p');stateLine.style.cssText='overflow-wrap:anywhere;white-space:pre-wrap';
  const copy=doc.createElement('button');copy.type='button';copy.textContent=T.copyDiagnostic;
  const back=doc.createElement('button');back.type='button';back.textContent=T.diagnosticBack;
  back.addEventListener('click',()=>doc.getElementById('play3dBack')?.click());
  panel.append(summary,stateLine,pre,copy,back);container.appendChild(panel);
  const label=stage=>T.diagnosticStages?.[stage]||String(stage||'');
  function history(){return entries.map(e=>[
   e.time,label(e.stage),T.diagnosticKinds?.[e.kind]||e.kind,e.message,e.url,e.line?e.line+':'+e.column:'',e.stack
  ].filter(Boolean).join(' · ')).join('\n');}
  function text(){return [BUILD,stateLine.textContent,history()].filter(Boolean).join('\n');}
  function record(entry){
   if(disposed)return;
   if(entry.kind==='fatal'&&failed)return;
   const safe={time:new Date().toISOString(),kind:String(entry.kind||'stage').slice(0,30),stage:String(entry.stage||'').slice(0,80)};
   for(const key of ['message','url','stack'])if(entry[key])safe[key]=String(entry[key]).slice(0,4000);
   safe.line=Number(entry.line)||0;safe.column=Number(entry.column)||0;
   entries.push(safe);if(entries.length>LIMIT)entries.splice(entries.findIndex(e=>e.kind!=='fatal'),1);
   if(safe.kind==='resource'){warnings++;summary.textContent=T.diagnosticTitle+' · '+BUILD+' · '+T.diagnosticWarnings+': '+warnings;panel.hidden=false;panel.open=true;}
   pre.textContent=history();
   if(entry.kind==='fatal'&&!failed){failed=true;panel.hidden=false;panel.open=true;onFailure?.(safe.message||T.unknown);}
  }
  function receive(event){
   if(event.source!==frame.contentWindow||event.data?.type!=='FOREST_PREVIEW_DIAGNOSTIC')return;
   const data=event.data;
   if(data.kind==='frame'){
    lastFrame=Date.now();
    if(data.state&&T.diagnosticState)stateLine.textContent=T.diagnosticState(data.state);
    if(!running){running=true;record({kind:'stage',stage:'playing',message:T.firstFrame});}
   }else record(data);
  }
  root.addEventListener('message',receive);
  const visible=()=>{lastFrame=Date.now();};
  doc.addEventListener('visibilitychange',visible);
  const timer=root.setInterval(()=>{
   // Un rAF suspendido al cambiar de pestaña no es un fallo del juego.
   if(doc.hidden){lastFrame=Date.now();return;}
   if(running&&!failed&&Date.now()-lastFrame>8000)record({kind:'fatal',stage:'frame',message:T.frameStopped});
  },1000);
  copy.addEventListener('click',async()=>{
   try{await root.navigator.clipboard.writeText(text());copy.textContent=T.diagnosticCopied;}
   catch{copy.textContent=T.diagnosticSelect;}
  });
  record({kind:'stage',stage:'prepare'});
  return {record,dispose(){disposed=true;root.clearInterval(timer);root.removeEventListener('message',receive);doc.removeEventListener('visibilitychange',visible);panel.remove();}};
 }
 const api={BUILD,createRuntime,mount,configureEditor};
 root.FHPreviewDiagnostics=Object.freeze(api);
 if(root.parent&&root.parent!==root&&root.document.currentScript?.hasAttribute('data-fh-runtime')){
  root.FHPreviewDiagnostics=createRuntime(root);
 }
})(window);
