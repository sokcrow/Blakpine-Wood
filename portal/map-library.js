import {authorize,createCartridge,importCartridge,exportCartridge,changeMap,cartridgeFilename} from './cartridge.js';
import {C,cartridgeError} from './cartridge-strings.js';
const sessions=new Map();
const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let active=null;
function warn() {
 const pending=[...sessions.values()].filter(s=>s.dirty||s.editorDirty);
 const el=document.getElementById('cartridge-warning');
 el.hidden=!pending.length;el.textContent=pending.length?C.unsaved+' '+pending.map(s=>s.campaignName).join(', '):'';
}
window.addEventListener('beforeunload',e=>{
 if([...sessions.values()].some(s=>s.dirty||s.editorDirty)){e.preventDefault();e.returnValue='';}
});
export function clearMapLibraries() {
 active?.dispose();active=null;sessions.clear();warn();
}
export async function mountMapLibrary({element,context,campaignName,verify,onError}) {
 authorize(context);
 const key=JSON.stringify([context.uid,context.campaignId]);
 let state=sessions.get(key);
 if(!state){state={doc:null,exported:null,dirty:false,editorDirty:false,mapId:null,campaignName};sessions.set(key,state);}
 const view=new MapLibrary(element,state,context,verify,onError);active=view;
 await view.mount();return ()=>{view.dispose();if(active===view)active=null;};
}
class MapLibrary {
 constructor(root,state,context,verify,onError){Object.assign(this,{root,state,context,verify,onError});this.alive=true;this.lock=false;this.api=null;this.timer=null;}
 async access(){const current=await this.verify();authorize(current);if(!this.alive||current.uid!==this.context.uid||current.campaignId!==this.context.campaignId)throw Error('CARTRIDGE_ACCESS');return current;}
 async mount(){
  this.root.innerHTML='<h1>'+C.title+'</h1><p>'+C.intro+'</p><div class="actions" id="cartridge-actions"></div><p id="cartridge-status" role="status"></p><div id="cartridge-maps"></div><section id="map-editor" hidden><label for="map-name">'+C.name+'</label><input id="map-name" maxlength="160"><div class="actions"><button id="map-save">'+C.save+'</button><button id="map-close">'+C.close+'</button></div></section><p id="editor-loading" role="status">'+C.loading+'</p><iframe id="lumen-editor" title="'+C.title+'" src="../index.html?editor=1&amp;lumenCartridge=1" hidden></iframe>';
  this.frame=this.root.querySelector('iframe');
  const api=await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('EDITOR_UNAVAILABLE')),45000);
   this.frame.onload=()=>{clearTimeout(timeout);const api=this.frame.contentWindow?.LumenEditor;api?resolve(api):reject(Error('EDITOR_UNAVAILABLE'));};
   this.frame.onerror=()=>{clearTimeout(timeout);reject(Error('EDITOR_UNAVAILABLE'));};
  });
  if(!this.alive)return;
  this.api=api;this.frame.contentWindow.LUMEN_CARTRIDGE_TEXT=C;
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
 setDoc(doc,exported=null){this.state.doc=doc;this.state.exported=exported;this.state.dirty=JSON.stringify(doc)!==exported;this.state.editorDirty=false;this.state.mapId=null;this.hideEditor();warn();this.paint();this.onMutation?.();}
 hideEditor(){this.root.querySelector('#map-editor').hidden=true;this.frame.hidden=true;}
 edit(mapId){
  this.capture();const s=this.state,map=s.doc.maps.find(m=>m.mapId===mapId);if(!map)throw Error('MAP_MISSING');
  s.mapId=mapId;this.root.querySelector('#map-editor').hidden=false;this.frame.hidden=false;
  const input=this.root.querySelector('#map-name');input.value=map.name;input.oninput=()=>this.changed();
  this.api.load(map.project,()=>this.changed());
 }
 add(project,name){const result=changeMap(this.state.doc,this.context,this.validate,{name,project,expectedRevision:this.state.doc.revision});this.state.doc=result.cartridge;this.state.dirty=true;warn();this.paint();this.onMutation?.();return result.mapId;}
 async pick(cartridge){
  const input=document.createElement('input');input.type='file';input.accept=cartridge?'.lumen.json':'.json';
  input.onchange=()=>this.run(async()=>{
   const file=input.files?.[0];if(!file)return;
   if(cartridge&&!file.name.toLowerCase().endsWith('.lumen.json')){this.say(C.fileExtension,true);return;}
   const text=await file.text();await this.access();
   if(cartridge){const doc=importCartridge(text,this.context,this.validate);if(this.state.doc&&!confirm(C.replace))return;await this.openDocument(doc);}
   else {const project=JSON.parse(text);this.validate(project);this.capture();const name=prompt(C.name,project.title||C.defaultName);if(name!==null)this.add(project,name);}
  });input.click();
 }
 async openDocument(doc){this.setDoc(doc,JSON.stringify(doc));}
 paint(){
  if(!this.alive||!this.api)return;
  const s=this.state,actions=this.root.querySelector('#cartridge-actions');actions.replaceChildren();
  const action=(title,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=title;b.onclick=()=>this.run(fn);actions.append(b);};
  action(C.create,async()=>{this.capture();if(s.doc&&!confirm(C.replace))return;this.setDoc(createCartridge(this.context));});
  action(C.open,()=>this.pick(true));
  if(s.doc){
   action(C.add,async()=>{this.capture();const name=prompt(C.name,C.defaultName);if(name===null)return;const id=this.add(this.api.create(),name);this.edit(id);});
   action(C.importMap,()=>this.pick(false));
   action(C.export,async()=>{
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
    const row=document.createElement('article');row.className='campaign';row.innerHTML='<h2>'+escape(map.name)+'</h2>';
    for(const [title,fn] of [[C.edit,()=>this.edit(map.mapId)],[C.rename,()=>{
     this.capture();const name=prompt(C.name,map.name);if(name===null)return;
     s.doc=changeMap(s.doc,this.context,this.validate,{mapId:map.mapId,name,expectedRevision:s.doc.revision}).cartridge;s.dirty=true;warn();this.paint();this.onMutation?.();
    }]]){const b=document.createElement('button');b.textContent=title;b.onclick=()=>this.run(fn);row.append(b);}
    list.append(row);
   }
  }
  this.paintRecovery?.(actions);warn();
 }
 dispose(){if(!this.alive)return;clearTimeout(this.timer);try{this.capture();}catch(e){this.onError?.(e);}this.alive=false;this.frame?.remove();}
}
export {MapLibrary};
