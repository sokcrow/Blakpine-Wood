const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const cid='a'.repeat(20),context={uid:'dm',ownerUid:'dm',campaignId:cid,rulesetId:'legacy',status:'active'};
async function fixture(){
 const cartridge=await import('../portal/cartridge.js'),play=await import('../portal/play-session.js');
 const project=JSON.parse(fs.readFileSync('forest-horror/maps/DEMO_Ascensor_5_Pisos.json'));
 project.future={unicode:'Árbol 🌲 — 地図'.repeat(40000)};project.floors[1].future={services:['water','power']};
 const validate=p=>{assert.equal(p.schema,'forest-horror-map-v1');p.validatorMutation=true;};
 const result=cartridge.changeMap(cartridge.createCartridge(context),context,validate,{name:'Sótano 🌲',project,expectedRevision:1});
 return {...play,doc:result.cartridge,mapId:result.mapId,validate,project};
}
function memoryStore(play){
 const data=new Map([[`campaigns/${cid}`,{ownerId:'dm',ruleset:'legacy',status:'active',name:'Prueba'}]]);
 const listeners=new Map(),batches=[];let uid='dm',readHook=null;
 const snapshot=path=>({exists:()=>data.has(path),data:()=>structuredClone(data.get(path)),metadata:{fromCache:false}});
 const writes=()=>{const ops=[];return {set:(r,d)=>ops.push([r,structuredClone(d)]),commit:async()=>{batches.push(ops);for(const [r,d]of ops)data.set(r,d);}};};
 const sdk={doc:(_db,...parts)=>parts.join('/'),serverTimestamp:()=>0,
  getDocFromServer:async path=>{await readHook?.(path);return snapshot(path);},writeBatch:writes,
  runTransaction:async(_db,fn)=>{const b=writes();await fn({...b,get:async path=>snapshot(path)});await b.commit();},
  onSnapshot:(path,_options,cb,error)=>{const list=listeners.get(path)||[];list.push({cb,error});listeners.set(path,list);return ()=>{list.splice(list.findIndex(x=>x.cb===cb),1);};}};
 const store=play.playStore(sdk,{},()=>uid);
 function member(){data.set(`campaigns/${cid}/members/player`,{userId:'player',status:'active'});
  data.set(`campaigns/${cid}/lobbyParticipants/player`,{userId:'player',state:'joined',roomId:data.get(`campaigns/${cid}/lobby/current`).roomId});}
 return {store,data,batches,member,setUid:v=>uid=v,setReadHook:fn=>readHook=fn,
  emit:(path,metadata={fromCache:false})=>{for(const {cb}of [...(listeners.get(path)||[])])cb({...snapshot(path),metadata});},
  countListeners:()=>[...listeners.values()].reduce((n,a)=>n+a.length,0)};
}
test('Publicación conserva JSON completo, Unicode, pisos y campos futuros sin mutar cartucho',async()=>{
 const f=await fixture(),before=JSON.stringify(f.doc),packed=await f.packMap(f.doc,context,f.mapId,f.validate);
 assert.ok(packed.chunks.length>1);assert.ok(packed.chunks.every(s=>s.length<=f.CHUNK_SIZE));
 const restored=await f.unpackMap(packed.manifest,packed.chunks,context,f.validate);
 assert.deepEqual(restored.project,f.project);assert.equal(JSON.stringify(f.doc),before);
 assert.equal(restored.revision,f.doc.revision);assert.equal(restored.mapId,f.mapId);
});
test('No abre descargas truncadas, mezcladas, corruptas o de otra campaña/propietario',async()=>{
 const f=await fixture(),p=await f.packMap(f.doc,context,f.mapId,f.validate);
 for(const chunks of [p.chunks.slice(1),[...p.chunks].reverse(),p.chunks.map((c,i)=>i===0?'A'+c.slice(1):c)]){
  await assert.rejects(()=>f.unpackMap(p.manifest,chunks,context,f.validate),/PLAY_INVALID/);
 }
 await assert.rejects(()=>f.unpackMap(p.manifest,p.chunks,{...context,campaignId:'b'.repeat(20)},f.validate),/PLAY_INVALID/);
 await assert.rejects(()=>f.unpackMap(p.manifest,p.chunks,{...context,ownerUid:'other'},f.validate),/PLAY_INVALID/);
 await assert.rejects(()=>f.unpackMap({...p.manifest,revision:99},p.chunks,context,f.validate),/PLAY_INVALID/);
});
test('DM publica y DM/invitado cargan exactamente el mismo mapa desde documentos numerados',async()=>{
 const f=await fixture(),m=memoryStore(f),rid=await m.store.publish(f.doc,context,f.mapId,f.validate);
 assert.match(rid,/^[a-f0-9-]{36}$/);assert.ok(m.batches.every(b=>b.length<=8));
 const dm=await m.store.load(cid,f.validate);m.member();m.setUid('player');
 const guest=await m.store.load(cid,f.validate);
 assert.deepEqual(guest.payload,dm.payload);assert.deepEqual(guest.payload.project,f.project);
 assert.equal(guest.manifest.sha256,dm.manifest.sha256);assert.equal(guest.context.uid,'player');
 await assert.rejects(()=>m.store.publish(f.doc,{...context,uid:'player'},f.mapId,f.validate),/PLAY_ACCESS/);
});
test('Abrir otra vez la misma versión reutiliza su publicación; editar genera una nueva',async()=>{
 const f=await fixture(),m=memoryStore(f),one=await m.store.publish(f.doc,context,f.mapId,f.validate),batches=m.batches.length;
 assert.equal(await m.store.publish(f.doc,context,f.mapId,f.validate),one);assert.equal(m.batches.length,batches);
 const edited=structuredClone(f.doc);edited.revision++;edited.maps[0].project.title='Cambio';
 assert.notEqual(await m.store.publish(edited,context,f.mapId,f.validate),one);
});
test('Invitado necesita membresía activa e inscripción en la sala actual; revocación y cierre bloquean entrada',async()=>{
 const f=await fixture(),m=memoryStore(f);await m.store.publish(f.doc,context,f.mapId,f.validate);m.setUid('player');
 await assert.rejects(()=>m.store.load(cid,f.validate),/PLAY_ACCESS/);
 m.member();await m.store.load(cid,f.validate);
 for(const [path,patch]of [
  [`members/player`,{status:'removed'}],[`lobbyParticipants/player`,{state:'left'}],
  [`lobbyParticipants/player`,{roomId:'B'.repeat(32)}],[`lobby/current`,{status:'closed'}],
  ['',{status:'archived'}]]){
  const key=`campaigns/${cid}`+(path?'/'+path:''),old=m.data.get(key);m.data.set(key,{...old,...patch});
  await assert.rejects(()=>m.store.load(cid,f.validate),/PLAY_ACCESS|PLAY_CLOSED/);m.data.set(key,old);
 }
});
test('Cambio de cuenta, mapa o sala durante descarga invalida la entrada',async()=>{
 const f=await fixture();
 for(const kind of ['account','release','room']){
  const m=memoryStore(f);await m.store.publish(f.doc,context,f.mapId,f.validate);m.member();m.setUid('player');let changed=false;
  m.setReadHook(path=>{if(!changed&&path.includes('/chunks/')){changed=true;
   if(kind==='account')m.setUid('other');
   if(kind==='release')m.data.get(`campaigns/${cid}/playSession/current`).releaseId=crypto.randomUUID();
   if(kind==='room'){m.data.get(`campaigns/${cid}/lobby/current`).roomId='B'.repeat(32);m.member();}
  }});
  await assert.rejects(()=>m.store.load(cid,f.validate),/PLAY_ACCESS|PLAY_CHANGED/);
 }
});
test('Fallos de publicación no reemplazan la versión jugable anterior',async()=>{
 const f=await fixture(),m=memoryStore(f);await m.store.publish(f.doc,context,f.mapId,f.validate);
 const before=structuredClone(m.data.get(`campaigns/${cid}/playSession/current`));
 m.setReadHook(path=>{if(path===`campaigns/${cid}`)throw Error('permission-denied');});
 await assert.rejects(()=>m.store.publish(f.doc,context,f.mapId,f.validate),/permission-denied/);
 assert.deepEqual(m.data.get(`campaigns/${cid}/playSession/current`),before);
});
test('Escuchas cierran el motor al perder permisos y se retiran todas al salir',async()=>{
 const f=await fixture(),m=memoryStore(f);await m.store.publish(f.doc,context,f.mapId,f.validate);m.member();m.setUid('player');
 const loaded=await m.store.load(cid,f.validate);let invalid=0;
 const stop=m.store.watch(cid,loaded.context,loaded.session,()=>invalid++);
 assert.equal(m.countListeners(),5);
 m.emit(`campaigns/${cid}`,{fromCache:true});assert.equal(invalid,0);
 m.emit(`campaigns/${cid}`);m.emit(`campaigns/${cid}`,{fromCache:true});
 assert.equal(invalid,1);assert.equal(m.countListeners(),0);stop();assert.equal(invalid,1);
 const stop2=m.store.watch(cid,loaded.context,loaded.session,()=>invalid++);
 m.data.get(`campaigns/${cid}/members/player`).status='removed';m.emit(`campaigns/${cid}/members/player`);
 assert.equal(invalid,2);assert.equal(m.countListeners(),0);stop2();
});
