/* Interfaz multimodo: lee contratos reales, no modifica el editor ni interpreta combate. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHMultimodeSelector=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const worlds=Object.freeze([
  Object.freeze({id:'ciudad-moderna',path:'contratos/multimodo/ejemplos/mundos/ciudad-moderna.json',label:'modern'}),
  Object.freeze({id:'distopia',path:'contratos/multimodo/ejemplos/mundos/distopia.json',label:'dystopian'}),
  Object.freeze({id:'villa-medieval',path:'contratos/multimodo/ejemplos/mundos/villa-medieval.json',label:'medieval'})
 ]);
 const rules=Object.freeze([
  Object.freeze({id:'legacy',path:'contratos/multimodo/ejemplos/reglas/legacy.json',label:'legacy'}),
  Object.freeze({id:'dnd',path:'contratos/multimodo/ejemplos/reglas/dnd.json',label:'dnd'}),
  Object.freeze({id:'moon-system',path:'contratos/multimodo/ejemplos/reglas/moon-system.json',label:'moon'})
 ]);
 const mapPath='forest-horror/maps/DEMO_Interacciones.json';
 const medievalMapPath='forest-horror/maps/DEMO_DnD_Iluminacion.json';
 const resources=Object.freeze(Object.fromEntries([
  ...worlds.map(item=>[item.path,'world']),
  ...rules.map(item=>[item.path,'rules']),
  [mapPath,'map'],[medievalMapPath,'map']
 ]));
 function binding(world,rule){
  const w=worlds.find(item=>item.id===world),r=rules.find(item=>item.id===rule);
  if(!w||!r)throw new TypeError('MODE_CHOICE_INVALID');
  return {kind:'blakpine-mode-selection-v1',version:1,worldProfile:w.path,rulesetManifest:r.path};
 }
 function createRuntime({io,worldLoader,registry,modeSelection,coordinator}={}){
  if(typeof io?.readJson!=='function'||typeof worldLoader?.prepare!=='function'||
   typeof registry?.resolve!=='function'||typeof modeSelection?.readSelection!=='function'){
   throw new TypeError('MODE_RUNTIME_DEPENDENCIES_MISSING');
  }
  const loadedWorlds=new Map(),loadedRules=new Map();
  let loading=null;
  async function load(){
   if(loading)return loading;
   loading=(async()=>{
    await Promise.all([
     ...worlds.map(async item=>{
      try{
       const profile=await io.readJson(item.path);
       if(profile.id!==item.id)throw new TypeError('WORLD_ID_MISMATCH');
       const description=await worldLoader.prepare(profile);
       loadedWorlds.set(item.id,{profile,description});
      }catch(error){loadedWorlds.set(item.id,{error});}
     }),
     ...rules.map(async item=>{
      try{
       const manifest=await io.readJson(item.path);
       if(manifest.id!==item.id)throw new TypeError('RULES_ID_MISMATCH');
       loadedRules.set(item.id,{manifest});
      }catch(error){loadedRules.set(item.id,{error});}
     })
    ]);
   })();
   return loading;
  }
  function world(id){return loadedWorlds.get(id)||null;}
  function rule(id){return loadedRules.get(id)||null;}
  function canStart(worldId,ruleId){
   const w=world(worldId),r=rule(ruleId);
   return !!(w?.description?.scenario?.status==='map-available'&&r?.manifest&&registry.resolve(r.manifest));
  }
  async function prepare(worldId,ruleId){
   if(!canStart(worldId,ruleId))throw new TypeError('MODE_NOT_AVAILABLE');
   const selection=binding(worldId,ruleId);
   const mode=await modeSelection.readSelection(selection,io);
   if(mode.kind!=='multimode'||mode.worldProfile.id!==worldId||
    mode.rulesetManifest.id!==ruleId)throw new TypeError('MODE_ID_MISMATCH');
   const entry=registry.resolve(mode.rulesetManifest);
   if(!entry||!mode.worldProfile.map)throw new TypeError('MODE_NOT_AVAILABLE');
   const description=await worldLoader.prepare(mode.worldProfile);
   if(description.scenario.status!=='map-available')throw new TypeError('WORLD_MAP_MISSING');
   if(entry.kind==='native')return Object.freeze({entry,payload:description,mode});
   if(typeof coordinator?.create!=='function')throw new TypeError('MODE_COORDINATOR_MISSING');
   const prepared=await coordinator.create({
    readSelection:input=>modeSelection.readSelection(input,io),
    worldLoader,rulesAdapter:entry.adapter
   }).prepare(selection);
   if(prepared.kind!=='prepared')throw new TypeError('MODE_PREPARATION_FAILED');
   return Object.freeze({entry,payload:prepared,mode});
  }
  return Object.freeze({load,world,rule,canStart,prepare});
 }
 function mount({validateMap,launchLegacyWorld,launchLegacyCurrent,launchDndWorld,
  launchDndCurrent}={}){
  const d=document,t=globalThis.FH_MULTIMODE_TEXT;
  const trigger=d.getElementById('fhModesBtn'),overlay=d.getElementById('fhModesOverlay'),
   closeButton=d.getElementById('fhModesClose'),status=d.getElementById('fhModesStatus'),
   worldBox=d.getElementById('fhWorldOptions'),rulesBox=d.getElementById('fhRulesOptions'),
   start=d.getElementById('fhModesStart'),local=d.getElementById('fhModesLegacyLocal'),
   dndLocal=d.getElementById('fhModesDndLocal');
  if(!trigger||!overlay||!t||typeof launchLegacyWorld!=='function'||
   typeof launchLegacyCurrent!=='function'||typeof validateMap!=='function')return null;
  const registry=globalThis.FHModeAdapterRegistry.create();
  registry.registerNativeLegacy(launchLegacyWorld);
  if(typeof launchDndWorld==='function'&&globalThis.FHDndCombat?.status==='implemented'){
   registry.register({adapter:globalThis.FHDndCombat,start:launchDndWorld});
  }
  globalThis.FHMultimodeAdapters=registry;
  let runtime=null,loaded=false,busy=false,selectedWorld='ciudad-moderna',selectedRule='legacy';
  function setStatus(message){status.textContent=message;}
  function renderChoices(box,items,type){
   box.replaceChildren();
   for(const item of items){
    const row=type==='world'?runtime?.world(item.id):runtime?.rule(item.id);
    const available=type==='world'?row?.description?.scenario?.status==='map-available':
     !!(row?.manifest&&registry.resolve(row.manifest));
    const button=d.createElement('button'),name=d.createElement('strong'),hint=d.createElement('small');
    button.type='button';button.className='fh-modes-choice';button.dataset[type]=item.id;
    button.disabled=busy||!available;
    button.setAttribute('aria-pressed',String((type==='world'?selectedWorld:selectedRule)===item.id));
    name.textContent=(type==='world'?row?.profile?.label:row?.manifest?.label) || t[item.label];
    hint.textContent=available?(type==='world'?t.demo:t.available):
     (type==='world'&&row?.description?.scenario?.status==='declarative-only'?t.noMap:
      type==='world'?t.missing:t.adapterPending);
    button.append(name,hint);
    button.addEventListener('click',()=>{
     if(button.disabled)return;
     if(type==='world')selectedWorld=item.id;
     else{
      selectedRule=item.id;
      // Sólo el editor independiente sigue el selector de vista previa.
      // En campañas el modo procede del contexto verificado por Firebase.
      if(new URLSearchParams(globalThis.location?.search||'').get('lumenCartridge')!=='1')
       globalThis.FHEditorCatalog?.setRuleset?.(selectedRule);
     }
     render();
    });
    box.append(button);
   }
  }
  function render(){
   renderChoices(worldBox,worlds.filter(world=>world.id!=='villa-medieval'),'world');
   renderChoices(rulesBox,rules,'rule');
   start.disabled=busy||!runtime?.canStart(selectedWorld,selectedRule);
   local.disabled=busy;
   if(dndLocal){
    dndLocal.disabled=busy||typeof launchDndCurrent!=='function'||
     globalThis.FHDndCombat?.status!=='implemented'||
     globalThis.FHDndSaveAdapter?.status!=='implemented';
    dndLocal.textContent=t.dndCurrent;
   }
  }
  async function load(){
   if(loaded)return;
   loaded=true;
   if(location.protocol!=='https:'){setStatus(t.offline);render();return;}
   try{
    const io=globalThis.FHMultimodeResourceReader.createBrowser({
     baseURL:new URL('./',location.href).href,
     resources:{...resources},
     validate:globalThis.FHMultimodeSchemaValidator.validate,validateMap
    });
    runtime=createRuntime({
     io,worldLoader:globalThis.FHWorldProfileLoader.create(io),registry,
     modeSelection:globalThis.FHModeSelection,coordinator:globalThis.FHSessionCoordinator
    });
    await runtime.load();
    setStatus(runtime.canStart('ciudad-moderna','legacy')?t.ready:t.failed);
   }catch(error){
    console.error('[Blakpine multimodo] No se pudieron leer los perfiles:',error);
    runtime=null;setStatus(t.failed);
   }
   render();
  }
  function open(){
   if(!overlay.hidden)return;
   overlay.hidden=false;trigger.setAttribute('aria-expanded','true');
   setStatus(!loaded?t.loading:location.protocol!=='https:'?t.offline:runtime?.canStart('ciudad-moderna','legacy')?t.ready:t.failed);
   render();closeButton.focus();
   void load();
  }
  function close(){
   if(busy||overlay.hidden)return;
   overlay.hidden=true;trigger.setAttribute('aria-expanded','false');trigger.focus();
  }
  async function startSelected(){
   if(busy||!runtime?.canStart(selectedWorld,selectedRule))return;
   busy=true;setStatus(t.starting);render();
   try{
    const prepared=await runtime.prepare(selectedWorld,selectedRule);
    busy=false;overlay.hidden=true;trigger.setAttribute('aria-expanded','false');
    await prepared.entry.start(prepared.payload,prepared.mode);
   }catch(error){
    console.error('[Blakpine multimodo] Error al iniciar:',error);
    busy=false;overlay.hidden=false;trigger.setAttribute('aria-expanded','true');
    setStatus(t.launchError);render();start.focus();
   }
  }
  trigger.addEventListener('click',open);
  closeButton.addEventListener('click',close);
  start.addEventListener('click',()=>{void startSelected();});
  local.addEventListener('click',()=>{
   if(busy)return;
   overlay.hidden=true;trigger.setAttribute('aria-expanded','false');
   launchLegacyCurrent();
  });
  dndLocal?.addEventListener('click',()=>{
   if(busy||dndLocal.disabled)return;
   overlay.hidden=true;trigger.setAttribute('aria-expanded','false');
   launchDndCurrent();
  });
  overlay.addEventListener('pointerdown',event=>{if(event.target===overlay)close();});
  overlay.addEventListener('keydown',event=>{
   if(event.key==='Escape'){event.preventDefault();close();return;}
   if(event.key!=='Tab')return;
   const buttons=[...overlay.querySelectorAll('button:not([disabled])')];
   if(!buttons.length)return;
   if(event.shiftKey&&d.activeElement===buttons[0]){
    event.preventDefault();buttons[buttons.length-1].focus();
   }else if(!event.shiftKey&&d.activeElement===buttons[buttons.length-1]){
    event.preventDefault();buttons[0].focus();
   }
  });
  render();
  return Object.freeze({open,close,registry,getRuntime:()=>runtime});
 }
 return Object.freeze({worlds,rules,resources,binding,createRuntime,mount});
});