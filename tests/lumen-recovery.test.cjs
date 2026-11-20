const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),from=html.indexOf('const ForestShared=(()=>{'),to=html.indexOf("\n'use strict';",from);
const shared=vm.runInNewContext(html.slice(from,to)+';ForestShared'),validate=p=>shared.loadProject(p);
const context={uid:'dm',ownerUid:'dm',campaignId:'a',rulesetId:'legacy',status:'active'};
// Atomic backend port tests recovery policy independently of the browser API.
class MemoryBackend {
 records=new Map();failure=null;
 async read(key){return structuredClone(this.records.get(key));}
 async list(){return [...this.records].map(([key,record])=>({key,record:structuredClone(record)}));}
 async update(key,transform){if(this.failure)throw this.failure;const {record,result}=transform(await this.read(key));this.records.set(key,structuredClone(record));return result;}
}
async function setup(){const m=await import('../portal/cartridge.js'),r=await import('../portal/cartridge-recovery.js');return {m,r};}
test('Dos instantáneas, reapertura, cuenta/campaña/cartucho y conflicto entre pestañas',async()=>{
 const {m,r}=await setup(),backend=new MemoryBackend(),store=new r.RecoveryStore(backend),doc=m.createCartridge(context);
 const a=await store.save(doc,context,validate);
 doc.revision++;const b=await store.save(doc,context,validate,{expectedToken:a.token});
 doc.revision++;await store.save(doc,context,validate,{expectedToken:b.token});
 const reopen=await new r.RecoveryStore(backend).read(context,doc.cartridgeId,validate);
 assert.deepEqual(reopen.snapshots.map(s=>s.revision),[3,2]);
 assert.equal((await store.list({...context,campaignId:'b'},validate)).length,0);
 assert.equal((await store.list({...context,uid:'other',ownerUid:'other'},validate)).length,0);
 await assert.rejects(()=>store.save(doc,context,validate,{expectedToken:b.token}),/CONFLICT/);
 assert.deepEqual((await store.read(context,doc.cartridgeId,validate)).snapshots,reopen.snapshots);
 assert.equal(r.recoveryDiffers(reopen.snapshots[0],{...doc,revision:1}),true);
 assert.equal(r.recoveryDiffers(reopen.snapshots[0],doc),false);
});
test('Corrupción del último snapshot conserva predecesor validado; identidades ajenas rechazadas',async()=>{
 const {m,r}=await setup(),backend=new MemoryBackend(),store=new r.RecoveryStore(backend),doc=m.createCartridge(context);
 const a=await store.save(doc,context,validate);doc.revision++;await store.save(doc,context,validate,{expectedToken:a.token});
 const key=r.recoveryKey(context,doc.cartridgeId);backend.records.get(key).snapshots[0].cartridge.ownerUid='foreign';
 const found=await store.read(context,doc.cartridgeId,validate);assert.equal(found.corrupt,true);assert.equal(found.snapshots[0].revision,1);
 await assert.rejects(()=>store.save({...doc,campaignId:'b'},context,validate),/IDENTITY/);
 assert.equal((await store.read(context,'missing',validate)).snapshots.length,0);
});
test('Cuota, permiso y ausencia de IndexedDB fallan sin borrar el documento ni su recuperación',async()=>{
 const {m,r}=await setup(),backend=new MemoryBackend(),store=new r.RecoveryStore(backend),doc=m.createCartridge(context);
 const a=await store.save(doc,context,validate),before=JSON.stringify(doc);
 for(const [name,code] of [['QuotaExceededError','RECOVERY_QUOTA'],['SecurityError','RECOVERY_PERMISSION']]){
  backend.failure=Object.assign(new Error('denied'),{name});
  await assert.rejects(()=>store.save(doc,context,validate,{expectedToken:a.token}),e=>e.code===code);
  assert.equal(JSON.stringify(doc),before);assert.equal((await store.read(context,doc.cartridgeId,validate)).snapshots[0].revision,1);
 }
 const absent=new r.RecoveryStore(new r.IndexedDBBackend(null));
 await assert.rejects(()=>absent.save(doc,context,validate),e=>e.code==='RECOVERY_UNAVAILABLE');
 assert.equal(m.exportCartridge(doc,context,validate),before);
});
test('No se reutiliza un ID de cartucho ajeno por clave',async()=>{
 const {m,r}=await setup(),backend=new MemoryBackend(),store=new r.RecoveryStore(backend),doc=m.createCartridge(context);
 backend.records.set(r.recoveryKey(context,doc.cartridgeId),{token:'foreign',snapshots:[{cartridge:{...doc,cartridgeId:'other'},revision:1,savedAt:new Date().toISOString()}]});
 assert.equal((await store.read(context,doc.cartridgeId,validate)).snapshots.length,0);
});
