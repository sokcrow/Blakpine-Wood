import {authorize,validateCartridge,copy,newId} from './cartridge.js';
export class RecoveryError extends Error {
 constructor(code,cause){super(code,{cause});this.code=code;}
}
const storageError=e=>e instanceof RecoveryError?e:new RecoveryError(
 e?.name==='QuotaExceededError'?'RECOVERY_QUOTA':e?.name==='SecurityError'||e?.name==='NotAllowedError'?'RECOVERY_PERMISSION':'RECOVERY_UNAVAILABLE',e);
export const recoveryKey=(context,cartridgeId)=>{
 authorize(context);return JSON.stringify([context.uid,context.campaignId,cartridgeId]);
};
export function validSnapshots(record,context,validateMap,cartridgeId) {
 const result=[];
 for(const snapshot of Array.isArray(record?.snapshots)?record.snapshots:[]){
  try{
   validateCartridge(snapshot.cartridge,context,validateMap);
   if(snapshot.cartridge.cartridgeId!==cartridgeId||snapshot.revision!==snapshot.cartridge.revision||
      !Number.isFinite(Date.parse(snapshot.savedAt)))continue;
   result.push(copy(snapshot));
  }catch{/* Preserve a valid predecessor when the newest stored snapshot is corrupt. */}
 }
 return result.slice(0,2);
}
export function recoveryDiffers(snapshot,doc){
 if(!snapshot)return false;
 const saved=snapshot.cartridge;
 return JSON.stringify(saved)!==JSON.stringify(doc) &&
  (saved.revision>=doc.revision||Date.parse(saved.updatedAt)>Date.parse(doc.updatedAt));
}
// The backend exposes atomic read/update; IndexedDB is the production implementation.
export class RecoveryStore {
 constructor(backend){this.backend=backend;}
 async read(context,cartridgeId,validateMap){
  try{
   const record=await this.backend.read(recoveryKey(context,cartridgeId));
   const snapshots=validSnapshots(record,context,validateMap,cartridgeId);
   return {token:record?.token??null,snapshots,corrupt:!!record&&snapshots.length!==(record.snapshots?.length||0)};
  }catch(e){throw storageError(e);}
 }
 async list(context,validateMap){
  authorize(context);
  try{
   const records=await this.backend.list();
   const result=[];
   for(const {key,record} of records){
    let parts;try{parts=JSON.parse(key);}catch{continue;}
    if(!Array.isArray(parts)||parts[0]!==context.uid||parts[1]!==context.campaignId)continue;
    const snapshots=validSnapshots(record,context,validateMap,parts[2]);
    if(snapshots.length)result.push({cartridgeId:parts[2],token:record.token,snapshots});
   }
   return result;
  }catch(e){throw storageError(e);}
 }
 async save(doc,context,validateMap,{expectedToken=null,activeMapId=null}={}){
  validateCartridge(doc,context,validateMap);
  const cartridge=copy(doc),key=recoveryKey(context,doc.cartridgeId);
  try{
   return await this.backend.update(key,previous=>{
    if((previous?.token??null)!==expectedToken)throw new RecoveryError('RECOVERY_CONFLICT');
    const valid=validSnapshots(previous,context,validateMap,doc.cartridgeId);
    const snapshot={revision:doc.revision,savedAt:new Date().toISOString(),activeMapId,cartridge};
    const snapshots=valid.filter(s=>JSON.stringify(s.cartridge)!==JSON.stringify(cartridge));
    const record={token:newId(),snapshots:[snapshot,...snapshots].slice(0,2)};
    return {record,result:{token:record.token,snapshot:copy(snapshot)}};
   });
  }catch(e){throw storageError(e);}
 }
}
export class IndexedDBBackend {
 constructor(indexedDB=globalThis.indexedDB){this.factory=indexedDB;this.pending=null;}
 open(){
  if(!this.factory)return Promise.reject(new RecoveryError('RECOVERY_UNAVAILABLE'));
  if(!this.pending)this.pending=new Promise((resolve,reject)=>{
   let request,blocked=false;try{request=this.factory.open('lumen-cartridge-recovery-v1',1);}catch(e){reject(e);return;}
   request.onupgradeneeded=()=>request.result.createObjectStore('cartridges');
   request.onerror=()=>reject(request.error);
   request.onblocked=()=>{blocked=true;reject(new RecoveryError('RECOVERY_BLOCKED'));};
   request.onsuccess=()=>{if(blocked){request.result.close();return;}request.result.onversionchange=()=>{request.result.close();this.pending=null;};resolve(request.result);};
  }).catch(e=>{this.pending=null;throw e;});
  return this.pending;
 }
 async read(key){
  const db=await this.open();return new Promise((resolve,reject)=>{
   const tx=db.transaction('cartridges','readonly'),r=tx.objectStore('cartridges').get(key);
   let value;r.onsuccess=()=>{value=r.result;};tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(tx.error);tx.onerror=()=>{};
  });
 }
 async list(){
  const db=await this.open();return new Promise((resolve,reject)=>{
   const tx=db.transaction('cartridges','readonly'),r=tx.objectStore('cartridges').openCursor(),records=[];
   r.onsuccess=()=>{const c=r.result;if(c){records.push({key:c.key,record:c.value});c.continue();}};
   tx.oncomplete=()=>resolve(records);tx.onabort=()=>reject(tx.error);tx.onerror=()=>{};
  });
 }
 async update(key,transform){
  const db=await this.open();return new Promise((resolve,reject)=>{
   const tx=db.transaction('cartridges','readwrite'),store=tx.objectStore('cartridges'),r=store.get(key);
   let result,problem;
   r.onsuccess=()=>{try{const transformed=transform(r.result);result=transformed.result;store.put(transformed.record,key);}catch(e){problem=e;tx.abort();}};
   tx.oncomplete=()=>resolve(result);tx.onabort=()=>reject(problem||tx.error);tx.onerror=()=>{};
  });
 }
}
export const recoveryStore=new RecoveryStore(new IndexedDBBackend());
