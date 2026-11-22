import {recoveryStore,recoveryDiffers} from './cartridge-recovery.js';
import {authorize,createCartridge,importCartridge,exportCartridge,changeMap,cartridgeFilename} from './cartridge.js';
import {C,cartridgeError,recoveryError} from './cartridge-strings.js';
import {P} from './play-strings.js';
import {workspaceStore,editorURL} from './editor-workspace-model.js';
const sessions=new Map();
const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function mapAction(label,icon,handler,primary=false){
 const button=document.createElement('button');button.type='button';
 button.className=primary?'map-action map-action-primary':'map-action';
 button.innerHTML='<svg aria-hidden="true" focusable="false"><use href="../juego/assets/fh-action-icons.svg#'+icon+'"></use></svg><span>'+escape(label)+'</span>';
 button.onclick=handler;return button;
}
let active=null;
let navigatingToEditor=false;
function warn() {
 const pending=[...sessions.values()].filter(s=>s.dirty||s.editorDirty||s.recoveryError);
 const el=document.getElementById('cartridge-warning');
 el.hidden=!pending.length;el.textContent=pending.length?pending.map(s=>s.campaignName+': '+(s.recoveryError?C.noStorage:s.editorDirty?C.editorDirty:C.unsaved)).join(' '):'';
}
window.addEventListener('beforeunload',e=>{
 if(navigatingToEditor)return;
 if([...sessions.values()].some(s=>s.dirty||s.editorDirty)){e.preventDefault();e.returnValue='';}
});
export function clearMapLibraries() {
 active?.dispose(true);active=null;sessions.clear();warn();
}
export function confirmDiscardMapLibraries(){
 return ![...sessions.values()].some(s=>s.dirty||s.editorDirty||s.recoveryError)||confirm(C.leaveUnsaved);
}
export async function mountMapLibrary({element,context,campaignName,verify,onError,publish,workspaceId}) {
 authorize(context);
 const key=JSON.stringify([context.uid,context.campaignId]);
 let state=sessions.get(key);
 if(!state){state={doc:null,exported:null,dirty:false,editorDirty:false,mapId:null,campaignName,recoveryTokens:new Map(),saveQueue:Promise.resolve(),recoveryError:null};sessions.set(key,state);}
 const view=new MapLibrary(element,state,context,verify,onError);active=view;
 view.publish=publish;
 try{await view.mount();if(workspaceId)await view.resume(workspaceId);}
 catch(error){view.dispose(true);if(active===view)active=null;throw error;}
 return ()=>{const result=view.dispose();if(result!==false&&active===view)active=null;return result;};
}
class MapLibrary {
 constructor(root,state,context,verify,onError){Object.assign(this,{root,state,context,verify,onError});this.alive=true;this.lock=false;this.api=null;this.timer=null;}
 async access(){const current=await this.verify();authorize(current);if(!this.alive||current.uid!==this.context.uid||current.campaignId!==this.context.campaignId)throw Error('CARTRIDGE_ACCESS');return current;}
 async mount(){
  this.root.innerHTML='<p class="kicker">'+escape(this.state.campaignName)+'</p><h1>'+C.title+'</h1><p>'+C.intro+'</p><div class="actions" id="cartridge-actions"></div><div class="actions" id="cartridge-map-actions"></div><p id="cartridge-status" role="status"></p><div id="cartridge-maps"></div><div id="recovery-list"></div><section id="map-editor" hidden><label for="map-name">'+C.name+'</label><input id="map-name" maxlength="160"><div class="actions"><button id="map-save">'+C.save+'</button><button id="map-close">'+C.close+'</button></div></section><p id="editor-loading" role="status">'+C.loading+'</p><iframe id="lumen-editor" title="'+C.title+'" src="../index.html?editor=1&amp;lumenCartridge=1" hidden></iframe>';
  this.frame=this.root.querySelector('iframe');
  const api=await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('EDITOR_UNAVAILABLE')),45000);
   this.frame.onload=()=>{clearTimeout(timeout);const api=this.frame.contentWindow?.LumenEditor;api?resolve(api):reject(Error('EDITOR_UNAVAILABLE'));};
   this.frame.onerror=()=>{clearTimeout(timeout);reject(Error('EDITOR_UNAVAILABLE'));};
  });
  if(!this.alive)return;
  this.api=api;this.frame.contentWindow.LUMEN_CARTRIDGE_TEXT=C;
   // El modo procede de la campaña verificada por Firebase, no de la URL.
   api.setRuleset(this.context.rulesetId);
  this.root.querySelector('#editor-loading').hidden=true;
  this.root.querySelector('#map-save').onclick=()=>this.run(async()=>{this.capture();this.say(C.working);this.api.saved();});
  this.root.querySelector('#map-close').onclick=()=>this.run(async()=>{this.capture();this.hideEditor();this.paint();});
  this.paint();
 }
 say(text,bad=false){if(!this.alive)return;const el=this.root.querySelector('#cartridge-status');el.textContent=text;el.className=bad?'error':'';}
 async run(fn){if(this.lock||!this.alive)return;this.lock=true;try{await this.access();await fn();}catch(e){this.say(C.error+cartridgeError(e),true);this.onError?.(e);}finally{this.lock=false;}}
 validate=p=>this.api.validate(p);
 changed(){this.state.editorDirty=true;warn();clearTimeout(this.timer);this.timer=setTimeout(()=>{try{this.capture();}catch(e){this.say(C.error+cartridgeError(e),true);}},700);}
 capture(){
  if(!this.api||!this.state.editorDirty)return;
  const s=this.state,map=s.doc.maps.find(m=>m.mapId===s.mapId);
  const result=changeMap(s.doc,this.context,this.validate,{mapId:s.mapId,name:this.root.querySelector('#map-name').value||map.name,project:this.api.read(),expectedRevision:s.doc.revision});
  s.doc=result.cartridge;s.editorDirty=false;s.dirty=JSON.stringify(s.doc)!==s.exported;warn();this.onMutation?.();
 }
 setDoc(doc,exported=null,save=true){this.state.doc=doc;this.state.exported=exported;this.state.dirty=JSON.stringify(doc)!==exported;this.state.editorDirty=false;this.state.mapId=null;this.hideEditor();warn();this.paint();if(save)this.onMutation?.();}
 hideEditor(){this.root.querySelector('#map-editor').hidden=true;this.frame.hidden=true;}
 async edit(mapId){
  this.capture();const s=this.state,map=s.doc.maps.find(m=>m.mapId===mapId);if(!map)throw Error('MAP_MISSING');
  await s.saveQueue;await this.access();
  const workspace=await workspaceStore.create(this.context,s.doc,mapId,this.validate,{
   needsExport:s.dirty,recoveryToken:s.recoveryTokens.get(s.doc.cartridgeId)??null,recoveryFloor:s.recoveryFloor||0});
  await this.access();navigatingToEditor=true;
  try{location.href=editorURL(this.context.campaignId,workspace.id);}catch(error){navigatingToEditor=false;throw error;}
 }
 async resume(id){
  await this.access();const record=await workspaceStore.read(this.context,id,this.validate);await this.access();
  const s=this.state;
  if(s.doc&&s.dirty&&JSON.stringify(s.doc)!==JSON.stringify(record.cartridge)&&!confirm(C.replace))return;
  s.recoveryTokens.set(record.cartridge.cartridgeId,record.recoveryToken);
  s.recoveryFloor=record.recoveryFloor;s.recoveryError=record.recoveryError;
  this.setDoc(record.cartridge,record.needsExport?null:JSON.stringify(record.cartridge),false);
  this.say(record.recoveryError?C.noStorage+recoveryError({code:record.recoveryError}):C.workspaceSaved,!!record.recoveryError);
 }
 add(project,name){const result=changeMap(this.state.doc,this.context,this.validate,{name,project,expectedRevision:this.state.doc.revision});this.state.doc=result.cartridge;this.state.dirty=true;warn();this.paint();this.onMutation?.();return result.mapId;}
 async pick(cartridge){
  const input=document.createElement('input');input.type='file';input.accept=cartridge?'.lumen.json':'.json';
  input.onchange=()=>this.run(async()=>{
   const file=input.files?.[0];if(!file)return;
   if(cartridge&&!file.name.toLowerCase().endsWith('.lumen.json')){this.say(C.fileExtension,true);return;}
   const text=await file.text();await this.access();
   if(cartridge){this.capture();const doc=importCartridge(text,this.context,this.validate);if(this.state.doc&&!confirm(C.replace))return;await this.openDocument(doc);}
   else {const project=JSON.parse(text);this.validate(project);this.capture();const name=prompt(C.name,project.title||C.defaultName);if(name!==null)this.add(project,name);}
  });input.click();
 }
 async openDocument(doc){
  await this.state.saveQueue;
  let recovered=null;
  try{
   const record=await recoveryStore.read(this.context,doc.cartridgeId,this.validate);
   await this.access();this.state.recoveryTokens.set(doc.cartridgeId,record.token);
   this.state.recoveryError=null;
   const latest=record.snapshots[0];
   if(recoveryDiffers(latest,doc)&&confirm(C.newer))recovered=latest;
   this.state.recoveryFloor=latest?.revision||0;
   if(record.corrupt)this.say(C.recoveryDiscard,true);
  }catch(e){
   if(!this.alive||e.message==='CARTRIDGE_ACCESS')throw e;
   this.state.recoveryError=e.code||e.message;
   this.say(C.noStorage+recoveryError(e),true);
  }
  // Opening a physical file never writes over a different local recovery implicitly.
  this.setDoc(recovered?.cartridge||doc,JSON.stringify(doc),false);
  if(recovered)this.say(C.recovery+' · '+C.revision+' '+recovered.revision);
 }
 onMutation(){
  const s=this.state;if(!s.doc)return;
  // A deliberate choice of an older physical file creates a new revision on its first edit.
  if(s.recoveryFloor>=s.doc.revision){s.doc.revision=s.recoveryFloor+1;s.doc.updatedAt=new Date().toISOString();}
  const doc=JSON.parse(JSON.stringify(s.doc)),activeMapId=s.mapId;
  s.saveQueue=s.saveQueue.then(async()=>{
   try{
    const result=await recoveryStore.save(doc,this.context,this.validate,{expectedToken:s.recoveryTokens.get(doc.cartridgeId)??null,activeMapId});
    s.recoveryTokens.set(doc.cartridgeId,result.token);s.recoveryError=null;
    if(s.doc?.cartridgeId===doc.cartridgeId&&s.doc?.revision===doc.revision)this.say(C.recovery+' · '+C.revision+' '+result.snapshot.revision);
   }catch(e){s.recoveryError=e.code||e.message;this.say(C.noStorage+recoveryError(e),true);}
   warn();
  });
  this.say(C.localPending);
 }
 paintRecovery(actions){
  const action=(text,icon,fn)=>actions.append(mapAction(text,icon,()=>this.run(fn)));
  action(C.recover,'restore',async()=>{
   await this.state.saveQueue;
   const records=await recoveryStore.list(this.context,this.validate);await this.access();
   const list=this.root.querySelector('#recovery-list');list.replaceChildren();
   if(!records.length){this.say(C.recoveryNone);return;}
   for(const record of records){
    const snapshot=record.snapshots[0],b=document.createElement('button');
    b.textContent=C.recover+' · '+snapshot.cartridge.cartridgeId+' · '+C.revision+' '+snapshot.revision+' · '+snapshot.savedAt;
    b.onclick=()=>this.run(async()=>{
     this.capture();await this.state.saveQueue;
     if(this.state.doc&&!confirm(C.replace))return;
     // Re-read atomically observed token; never restore a stale list item.
     const latest=await recoveryStore.read(this.context,record.cartridgeId,this.validate);await this.access();
     const chosen=latest.snapshots[0];if(!chosen)throw Error('RECOVERY_INVALID');
     this.state.recoveryTokens.set(record.cartridgeId,latest.token);
     this.state.recoveryFloor=chosen.revision;
     this.setDoc(chosen.cartridge,null,false);
     this.say(C.recovery+' · '+C.revision+' '+chosen.revision);list.replaceChildren();
    });list.append(b);
   }
  });
  action(C.persistence,'save',async()=>{
   let granted=false;try{granted=await navigator.storage?.persist?.()===true;}catch{}
   this.say(granted?C.persistentYes:C.persistentNo);
  });
 }
 paint(){
  if(!this.alive||!this.api)return;
  const s=this.state,actions=this.root.querySelector('#cartridge-actions');actions.replaceChildren();
  const mapActions=this.root.querySelector('#cartridge-map-actions');mapActions.replaceChildren();
  const action=(where,title,icon,fn,primary=false)=>where.append(mapAction(title,icon,()=>this.run(fn),primary));
  action(actions,C.create,'plus',async()=>{this.capture();if(s.doc&&!confirm(C.replace))return;this.setDoc(createCartridge(this.context));},!s.doc);
  action(actions,C.open,'folder',()=>this.pick(true));
  if(s.doc){
   action(mapActions,C.add,'plus',async()=>{this.capture();const name=prompt(C.name,C.defaultName);if(name===null)return;const id=this.add(this.api.create(),name);await this.edit(id);},true);
   action(mapActions,C.importMap,'upload',()=>this.pick(false));
   action(actions,C.export,'box',async()=>{
    this.capture();const text=exportCartridge(s.doc,this.context,this.validate),blob=new Blob([text],{type:'application/json'});
    const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=cartridgeFilename(s.campaignName);a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);
    s.exported=text;s.dirty=false;warn();this.say(C.download);
   });
  }
  const list=this.root.querySelector('#cartridge-maps');list.replaceChildren();
  if(s.doc){
   const p=document.createElement('p');p.textContent=C.revision+' '+s.doc.revision+' · '+s.doc.maps.length+' '+C.maps;list.append(p);
   if(!s.doc.maps.length){const empty=document.createElement('p');empty.textContent=C.empty;list.append(empty);}
   for(const map of s.doc.maps){
    const row=document.createElement('article');row.className='campaign map-entry';row.innerHTML='<h2>'+escape(map.name)+'</h2>';
    const controls=document.createElement('div');controls.className='map-entry-actions';
    for(const [title,icon,fn] of [[C.edit,'edit',()=>this.edit(map.mapId)],[C.rename,'settings',()=>{
     this.capture();const name=prompt(C.name,map.name);if(name===null)return;
     s.doc=changeMap(s.doc,this.context,this.validate,{mapId:map.mapId,name,expectedRevision:s.doc.revision}).cartridge;s.dirty=true;if(s.mapId===map.mapId)this.root.querySelector('#map-name').value=name;warn();this.paint();this.onMutation?.();
    }]])controls.append(mapAction(title,icon,()=>this.run(fn),icon==='edit'));
    if(this.publish){
     const start=mapAction(P.publish,'play',()=>this.run(async()=>{
      this.capture();if(!confirm(P.confirm))return;
      this.say(P.publishing);
      try{await this.publish(s.doc,map.mapId,this.validate);}
      catch(error){this.say(error.message==='PLAY_TOO_LARGE'?P.large:P.firebase,true);}
     }));controls.append(start);
    }
    row.append(controls);list.append(row);
   }
  }
  this.paintRecovery?.(actions);warn();
 }
 dispose(force=false){if(!this.alive)return true;clearTimeout(this.timer);try{this.capture();}catch(e){this.say(C.error+cartridgeError(e),true);this.onError?.(e);if(!force)return false;}this.alive=false;this.api?.stop?.();this.root.classList?.remove('lumen-playing');this.frame?.remove();return true;}
}
export {MapLibrary};
