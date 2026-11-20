import {firebaseConfig} from './config.js';
import {campaignAccess} from './cartridge-access.js';
import {workspaceStore,EditorWorkspace,libraryURL} from './editor-workspace-model.js';
import {exportCartridge,cartridgeFilename} from './cartridge.js';
import {C,cartridgeError,recoveryError} from './cartridge-strings.js';

const params=new URLSearchParams(location.search);
if(window.parent===window&&params.get('lumenCartridge')==='1'&&params.has('workspace'))void activate();
async function activate(){
 const api=window.LumenEditor,app=document.getElementById('app');
 let editor=null,timer=null,uid=null,accessLost=false;
 app.inert=true;
 window.LUMEN_CARTRIDGE_TEXT=C;
 const say=text=>{document.getElementById('autosave').textContent=text;};
 say(C.workspaceLoading);
 function fail(error){
  accessLost=true;clearTimeout(timer);api?.stop();app.inert=true;
  let panel=document.getElementById('workspace-error');
  if(!panel){panel=document.createElement('section');panel.id='workspace-error';panel.setAttribute('role','alert');document.body.append(panel);}
  const text=document.createElement('p');text.textContent=cartridgeError(error);
  const back=document.createElement('a');back.href='./portal/';back.textContent=C.close;
  panel.replaceChildren(text,back);
 }
 window.addEventListener('beforeunload',event=>{
  if(editor&&(editor.editorDirty||editor.pending||editor.record.needsExport||editor.record.recoveryError)){
   event.preventDefault();event.returnValue='';
  }
 });
 try{
  if(!api)throw Error('EDITOR_UNAVAILABLE');
  const [apps,authSDK,fs]=await Promise.all([
   import('https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js'),
   import('https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js'),
   import('https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js')]);
  const instance=apps.getApps()[0]||apps.initializeApp(firebaseConfig),auth=authSDK.getAuth(instance),db=fs.getFirestore(instance);
  const user=await new Promise((resolve,reject)=>{
   const unsubscribe=authSDK.onAuthStateChanged(auth,next=>{resolve(next);queueMicrotask(()=>unsubscribe());},reject);
  });
  uid=user?.uid;if(!uid)throw Error('CARTRIDGE_ACCESS');
  const verify=async()=>{
   if(accessLost)throw Error('CARTRIDGE_ACCESS');
   return campaignAccess({uid,campaignId:params.get('campaign'),currentUid:()=>auth.currentUser?.uid,
    readCampaign:id=>fs.getDocFromServer(fs.doc(db,'campaigns',id))});
  };
  const context=await verify(),id=params.get('workspace');
  const record=await workspaceStore.read(context,id,p=>api.validate(p));await verify();
  editor=new EditorWorkspace({context,id,record,api,verify});
  const report=record=>say(editor.editorDirty?C.editorDirty:record.recoveryError?C.noStorage+recoveryError({code:record.recoveryError}):C.workspaceSaved);
  const save=async()=>{
   clearTimeout(timer);
   try{const record=await editor.save();report(record);return record;}
   catch(error){if(/ACCESS|IDENTITY/.test(error.message))fail(error);else say(C.noStorage+recoveryError(error));throw error;}
  };
  api.load(record.cartridge.maps.find(m=>m.mapId===record.mapId).project,()=>{
   editor.changed();clearTimeout(timer);timer=setTimeout(()=>{void save().catch(()=>{});},700);
  });
  api.setActions({
   save:()=>save().catch(()=>{}),
   close:async()=>{
    app.inert=true;
    try{await save();if(editor.editorDirty)await save();editor=null;location.href=libraryURL(context.campaignId,id);}
    catch{if(!accessLost)app.inert=false;}
   },
   export:async()=>{
    app.inert=true;clearTimeout(timer);
    try{
     await editor.queue.catch(()=>{});await verify();editor.capture();
     const text=exportCartridge(editor.record.cartridge,context,p=>api.validate(p));
     const link=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
     link.href=url;link.download=cartridgeFilename(context.name);link.click();setTimeout(()=>URL.revokeObjectURL(url),4000);
     editor.record.needsExport=false;await save();say(C.download);
    }catch(error){say(C.error+cartridgeError(error));}
    finally{if(!accessLost)app.inert=false;}
   }
  });
  authSDK.onAuthStateChanged(auth,next=>{if(next?.uid!==uid)fail(Error('CARTRIDGE_ACCESS'));},fail);
  app.inert=false;say(C.workspaceReady);
 }catch(error){fail(error);}
}
