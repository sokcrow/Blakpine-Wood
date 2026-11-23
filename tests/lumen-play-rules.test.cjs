// Run against a disposable Firestore emulator, never production.
const {test}=require('node:test'),fs=require('node:fs');
const assert=require('node:assert/strict');
test('Reglas reales: sólo el DM publica; invitado inscrito lee la versión actual; expulsado y externo no acceden',{
 skip:!process.env.FIRESTORE_EMULATOR_HOST,timeout:90000
},async()=>{
 const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
 const sdk=require('firebase/firestore');
 const env=await initializeTestEnvironment({projectId:'demo-lumen-play',firestore:{rules:fs.readFileSync('firestore.rules','utf8')}});
 const cid='a'.repeat(20),roomId='A'.repeat(32),rid='11111111-1111-4111-a111-111111111111';
 const path=(db,...p)=>sdk.doc(db,'campaigns',cid,...p),dm=env.authenticatedContext('dm').firestore(),guest=env.authenticatedContext('guest').firestore();
 const outsider=env.authenticatedContext('outsider').firestore(),removed=env.authenticatedContext('removed').firestore(),anonymous=env.unauthenticatedContext().firestore();
 try{
  await env.withSecurityRulesDisabled(async c=>{
   const db=c.firestore();
   await sdk.setDoc(path(db),{ownerId:'dm',ruleset:'legacy',status:'active'});
   for(const who of ['guest','removed']){
    await sdk.setDoc(path(db,'members',who),{userId:who,status:who==='removed'?'removed':'active'});
    await sdk.setDoc(path(db,'lobbyParticipants',who),{userId:who,roomId,state:'joined'});
   }
  });
  const chunk=path(dm,'worldReleases',rid,'chunks','0');
  await assertSucceeds(sdk.setDoc(chunk,{data:'e30='}));
  await assertFails(sdk.setDoc(chunk,{data:'AAAA'})); // Staged chunks cannot be overwritten either.
  await assertFails(sdk.setDoc(path(guest,'worldReleases',rid,'chunks','1'),{data:'e30='}));
  await assertFails(sdk.setDoc(path(dm,'worldReleases',rid,'chunks','256'),{data:'e30='}));
  await assertFails(sdk.setDoc(path(dm,'worldReleases',rid,'chunks','1'),{data:'A'.repeat(262145)}));
  const manifest={formatVersion:1,ownerUid:'dm',cartridgeId:rid,revision:1,mapId:rid,mapName:'Mapa',chunkCount:1,byteLength:2,sha256:'a'.repeat(64),createdAt:sdk.serverTimestamp()};
  const batch=sdk.writeBatch(dm);
  batch.set(path(dm,'lobby','current'),{hostId:'dm',roomId,status:'waiting',openedAt:sdk.serverTimestamp(),updatedAt:sdk.serverTimestamp()});
  batch.set(path(dm,'worldReleases',rid),manifest);
  batch.set(path(dm,'playSession','current'),{releaseId:rid,roomId,status:'open',updatedAt:sdk.serverTimestamp()});
  await assertSucceeds(batch.commit());
  await assertSucceeds(sdk.getDocFromServer(path(guest,'worldReleases',rid)));
  await assertSucceeds(sdk.getDocFromServer(path(guest,'worldReleases',rid,'chunks','0')));
  for(const db of [outsider,removed,anonymous]){
   await assertFails(sdk.getDocFromServer(path(db,'worldReleases',rid)));
   await assertFails(sdk.getDocFromServer(path(db,'worldReleases',rid,'chunks','0')));
  }
  await assertFails(sdk.updateDoc(path(guest,'playSession','current'),{releaseId:crypto.randomUUID(),updatedAt:sdk.serverTimestamp()}));
  await assertFails(sdk.updateDoc(path(dm,'worldReleases',rid),{revision:2}));
  await assertFails(sdk.setDoc(path(dm,'worldReleases',rid,'chunks','1'),{data:'e30='}));
  await assertFails(sdk.getDocs(sdk.collection(guest,'campaigns',cid,'worldReleases')));
  const next=crypto.randomUUID();
  await assertSucceeds(sdk.setDoc(path(dm,'worldReleases',next,'chunks','0'),{data:'e30='}));
  await assertSucceeds(sdk.setDoc(path(dm,'worldReleases',next),manifest));
  await assertFails(sdk.getDocFromServer(path(guest,'worldReleases',next,'chunks','0')));
  await assertSucceeds(sdk.updateDoc(path(dm,'lobby','current'),{status:'closed',updatedAt:sdk.serverTimestamp()}));
  await assertFails(sdk.getDocFromServer(path(guest,'worldReleases',rid,'chunks','0')));
  await assertSucceeds(sdk.getDocFromServer(path(dm,'worldReleases',rid,'chunks','0')));
 }finally{await env.cleanup();}
});
test('Protocolo real en Firestore: DM e invitado reciben el mapa de 7 MiB idéntico y la expulsión cierra la sesión',{
 skip:!process.env.FIRESTORE_EMULATOR_HOST,timeout:90000
},async()=>{
 const {initializeTestEnvironment}=require('@firebase/rules-unit-testing'),sdk=require('firebase/firestore');
 const {playStore}=await import('../portal/play-session.js'),cartridges=await import('../portal/cartridge.js');
 const env=await initializeTestEnvironment({projectId:'demo-lumen-play',firestore:{rules:fs.readFileSync('firestore.rules','utf8')}});
 const cid='b'.repeat(20),dm=env.authenticatedContext('dm').firestore(),guest=env.authenticatedContext('guest').firestore();
 const context={uid:'dm',ownerUid:'dm',campaignId:cid,rulesetId:'legacy',status:'active'};
 const project=require('./helpers/lumen-large-map.cjs')(true),validate=p=>assert.equal(p.schema,'forest-horror-map-v1');
 let stop=()=>{};
 try{
  await env.withSecurityRulesDisabled(async c=>sdk.setDoc(sdk.doc(c.firestore(),'campaigns',cid),{ownerId:'dm',ruleset:'legacy',status:'active',name:'Prueba'}));
  const doc=cartridges.changeMap(cartridges.createCartridge(context),context,validate,{name:'120 × 120',project,expectedRevision:1});
  const dmStore=playStore(sdk,dm,()=> 'dm');
  await dmStore.publish(doc.cartridge,context,doc.mapId,validate);
  const host=await dmStore.load(cid,validate);
  assert.ok(host.manifest.chunkCount>8);
  await env.withSecurityRulesDisabled(async c=>{
   const db=c.firestore();
   await sdk.setDoc(sdk.doc(db,'campaigns',cid,'members','guest'),{userId:'guest',role:'member',status:'active',joinedAt:sdk.Timestamp.now(),inviteCode:'test',removedAt:null});
   await sdk.setDoc(sdk.doc(db,'campaigns',cid,'lobbyParticipants','guest'),{userId:'guest',state:'joined',roomId:host.session.roomId});
  });
  const guestStore=playStore(sdk,guest,()=> 'guest'),player=await guestStore.load(cid,validate);
  assert.deepEqual(player.payload.project,project);assert.deepEqual(player.payload,host.payload);
  const invalid=new Promise(resolve=>{stop=guestStore.watch(cid,player.context,player.session,resolve);});
  await sdk.updateDoc(sdk.doc(dm,'campaigns',cid,'members','guest'),{status:'removed',removedAt:sdk.serverTimestamp()});
  let timer;try{await Promise.race([invalid,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('watch timeout')),5000);})]);}finally{clearTimeout(timer);}
  await assert.rejects(()=>guestStore.load(cid,validate),/PLAY_ACCESS|permission/i);
 }finally{stop();await env.cleanup();}
});

test('Firestore D&D: sólo el DM confirma tiempo; un invitado inscrito recibe el mismo total',{
 skip:!process.env.FIRESTORE_EMULATOR_HOST,timeout:90000
},async()=>{
 const {initializeTestEnvironment,assertFails}=require('@firebase/rules-unit-testing'),sdk=require('firebase/firestore');
 const {playStore}=await import('../portal/play-session.js'),cart=await import('../portal/cartridge.js');
 const env=await initializeTestEnvironment({projectId:'demo-lumen-dnd',firestore:{rules:fs.readFileSync('firestore.rules','utf8')}});
 const cid='d'.repeat(20),dm=env.authenticatedContext('dm').firestore(),guest=env.authenticatedContext('guest').firestore();
 const context={uid:'dm',ownerUid:'dm',campaignId:cid,rulesetId:'dnd',status:'active'};
 const ref=(db,...p)=>sdk.doc(db,'campaigns',cid,...p);
 try{
  await env.withSecurityRulesDisabled(async c=>sdk.setDoc(ref(c.firestore()),{ownerId:'dm',ruleset:'dnd',status:'active'}));
  const project=JSON.parse(fs.readFileSync('forest-horror/maps/DEMO_DnD_Iluminacion.json')),validate=p=>assert.ok(p.floors.length);
  const doc=cart.changeMap(cart.createCartridge(context),context,validate,{name:'Casa',project,expectedRevision:1});
  const store=playStore(sdk,dm,()=> 'dm');await store.publish(doc.cartridge,context,doc.mapId,validate);
  const host=await store.load(cid,validate);
  await env.withSecurityRulesDisabled(async c=>{
   const db=c.firestore();await sdk.setDoc(ref(db,'members','guest'),{userId:'guest',status:'active'});
   await sdk.setDoc(ref(db,'lobbyParticipants','guest'),{roomId:host.session.roomId,state:'joined'});
  });
  await store.advanceTime(cid,host.session,120,'travel');await store.advanceTime(cid,host.session,30,'work');
  const loaded=await playStore(sdk,guest,()=> 'guest').load(cid,validate);
  assert.equal(loaded.context.rulesetId,'dnd');assert.equal(loaded.session.elapsedMinutes,150);
  assert.equal(loaded.session.workMinutes,30);
  await assertFails(sdk.updateDoc(ref(guest,'playSession','current'),{elapsedMinutes:250,updatedAt:sdk.serverTimestamp()}));
 }finally{await env.cleanup();}
});
