import {authorize,validateCartridge,changeMap,copy,newId} from './cartridge.js';
import {IndexedDBBackend,RecoveryError,recoveryStore} from './cartridge-recovery.js';

const workspaceId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
const storageFailure=error=>{
 if(error instanceof RecoveryError)return error;
 return new RecoveryError(error?.name==='QuotaExceededError'?'RECOVERY_QUOTA':
  error?.name==='SecurityError'||error?.name==='NotAllowedError'?'RECOVERY_PERMISSION':'RECOVERY_UNAVAILABLE',error);
};
export function editorURL(campaignId,id){
 if(!/^[A-Za-z0-9]{20}$/.test(campaignId)||!workspaceId(id))throw Error('EDITOR_WORKSPACE');
 return '../index.html?editor=1&lumenCartridge=1&campaign='+campaignId+'&workspace='+id;
}
export function libraryURL(campaignId,id){
 editorURL(campaignId,id);
 return './portal/#mapas/'+campaignId+'/'+id;
}
// Separate drafts preserve an opened physical file without overwriting a newer recovery.
export class WorkspaceStore {
 constructor(backend){this.backend=backend;}
 key(context,id){authorize(context);if(!workspaceId(id))throw Error('EDITOR_WORKSPACE');return JSON.stringify([context.uid,context.campaignId,id]);}
 validate(record,context,validate){
  if(record?.version!==1||record.uid!==context.uid||record.campaignId!==context.campaignId||
    typeof record.needsExport!=='boolean'||!Number.isSafeInteger(record.recoveryFloor)||record.recoveryFloor<0||
    typeof record.pendingRecovery!=='boolean'||(record.recoveryToken!==null&&typeof record.recoveryToken!=='string'))throw Error('EDITOR_WORKSPACE');
  validateCartridge(record.cartridge,context,validate);
  if(!record.cartridge.maps.some(m=>m.mapId===record.mapId))throw Error('MAP_MISSING');
  return record;
 }
 async create(context,cartridge,mapId,validate,{needsExport=true,recoveryToken=null,recoveryFloor=0}={}){
  const id=newId(),record={version:1,uid:context.uid,campaignId:context.campaignId,
   cartridge:copy(cartridge),mapId,needsExport,recoveryToken,recoveryFloor,pendingRecovery:false,recoveryError:null};
  const saved=await this.save(context,id,record,validate,null);
  return {id,...saved};
 }
 async read(context,id,validate){
  const record=await this.backend.read(this.key(context,id)).catch(error=>{throw storageFailure(error);});
  return copy(this.validate(record,context,validate));
 }
 async save(context,id,record,validate,expectedToken){
  this.validate(record,context,validate);const value=copy(record);
  return this.backend.update(this.key(context,id),previous=>{
   if((previous?.token??null)!==expectedToken)throw new RecoveryError('RECOVERY_CONFLICT');
   const next={...value,token:newId()};return {record:next,result:copy(next)};
  }).catch(error=>{throw storageFailure(error);});
 }
}
export const workspaceStore=new WorkspaceStore(new IndexedDBBackend(globalThis.indexedDB,'lumen-editor-workspace-v1'));

export class EditorWorkspace {
 constructor({context,id,record,api,verify,workspaces=workspaceStore,recoveries=recoveryStore}){
  Object.assign(this,{context,id,record,api,verify,workspaces,recoveries});this.editorDirty=false;this.queue=Promise.resolve();this.pending=0;
 }
 changed(){this.editorDirty=true;}
 capture(){
  if(!this.editorDirty)return;
  const r=this.record,map=r.cartridge.maps.find(m=>m.mapId===r.mapId);
  const next=changeMap(r.cartridge,this.context,p=>this.api.validate(p),{
   mapId:r.mapId,name:map.name,project:this.api.read(),expectedRevision:r.cartridge.revision}).cartridge;
  if(r.recoveryFloor>=next.revision){next.revision=r.recoveryFloor+1;next.updatedAt=new Date().toISOString();}
  r.cartridge=next;r.needsExport=true;r.pendingRecovery=true;this.editorDirty=false;
 }
 save(){
  this.pending++;
  const task=this.queue.catch(()=>{}).then(async()=>{
   const context=await this.verify();authorize(context);
   if(context.uid!==this.context.uid||context.campaignId!==this.context.campaignId)throw Error('CARTRIDGE_ACCESS');
   this.capture();const r=this.record;
   // Commit the workspace first: conflicts/quota in recovery never discard the editing copy.
   this.record=await this.workspaces.save(this.context,this.id,r,p=>this.api.validate(p),r.token);
   if(this.record.pendingRecovery){
    try{
     const previous=await this.recoveries.read(this.context,this.record.cartridge.cartridgeId,p=>this.api.validate(p));
     const same=JSON.stringify(previous.snapshots[0]?.cartridge)===JSON.stringify(this.record.cartridge);
     const saved=same?previous:await this.recoveries.save(this.record.cartridge,this.context,p=>this.api.validate(p),{
       expectedToken:this.record.recoveryToken,activeMapId:this.record.mapId});
     this.record.recoveryToken=saved.token;this.record.pendingRecovery=false;this.record.recoveryError=null;
    }catch(error){this.record.recoveryError=error.code||error.message;}
    this.record=await this.workspaces.save(this.context,this.id,this.record,p=>this.api.validate(p),this.record.token);
   }
   if(!this.editorDirty)this.api.saved();
   return this.record;
  });
  this.queue=task;return task.finally(()=>{this.pending--;});
 }
}
