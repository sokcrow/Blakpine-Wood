import {copy, validateCartridge, newId} from './cartridge.js';
import {makeLobbyId, isWaitingLobby, isJoinedParticipant} from './lobby-model.js';

// Immutable releases keep a slow download from mixing maps or revisions.
export const CHUNK_SIZE = 262144;
export const MAX_CHUNKS = 256;
const fail = () => { throw Error('PLAY_INVALID'); };
const uid = v => typeof v === 'string' && v.length > 0 && v.length <= 256;
const releaseId = v => typeof v === 'string' && /^[a-f0-9-]{36}$/.test(v);
export async function digest(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b=>b.toString(16).padStart(2,'0')).join('');
}
export async function packMap(cartridge, context, mapId, validate) {
  validateCartridge(cartridge, context, validate);
  const map = cartridge.maps.find(m=>m.mapId===mapId);
  if(!map)throw Error('MAP_MISSING');
  const payload = {formatVersion:1,campaignId:context.campaignId,ownerUid:context.uid,
    cartridgeId:cartridge.cartridgeId,revision:cartridge.revision,mapId:map.mapId,mapName:map.name,project:copy(map.project)};
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  if(bytes.length > CHUNK_SIZE*MAX_CHUNKS*3/4)throw Error('PLAY_TOO_LARGE');
  const parts=[];
  for(let i=0;i<bytes.length;i+=8192)parts.push(String.fromCharCode(...bytes.subarray(i,i+8192)));
  const base64=btoa(parts.join('')), chunks=[];
  for(let i=0;i<base64.length;i+=CHUNK_SIZE)chunks.push(base64.slice(i,i+CHUNK_SIZE));
  return {payload,chunks,manifest:{formatVersion:1,ownerUid:context.uid,cartridgeId:payload.cartridgeId,
    revision:payload.revision,mapId:payload.mapId,mapName:payload.mapName,
    chunkCount:chunks.length,byteLength:bytes.length,sha256:await digest(bytes)}};
}
export function validManifest(m) {
  return m?.formatVersion===1 && uid(m.ownerUid) && uid(m.cartridgeId) && uid(m.mapId) &&
    typeof m.mapName==='string' && m.mapName.length>0 && m.mapName.length<=160 &&
    Number.isSafeInteger(m.revision) && m.revision>0 && Number.isInteger(m.chunkCount) &&
    m.chunkCount>0 && m.chunkCount<=MAX_CHUNKS && Number.isInteger(m.byteLength) &&
    m.byteLength>0 && m.byteLength<=CHUNK_SIZE*MAX_CHUNKS*3/4 && /^[a-f0-9]{64}$/.test(m.sha256);
}
export async function unpackMap(manifest, chunks, context, validate) {
  if(!validManifest(manifest)||manifest.ownerUid!==context.ownerUid||chunks.length!==manifest.chunkCount)fail();
  if(chunks.some((s,i)=>typeof s!=='string'||!s.length||s.length>CHUNK_SIZE||
      (i<chunks.length-1&&s.length!==CHUNK_SIZE)||!/^[A-Za-z0-9+/]*={0,2}$/.test(s)))fail();
  let bytes;
  try{bytes=Uint8Array.from(atob(chunks.join('')),c=>c.charCodeAt(0));}catch{fail();}
  if(bytes.length!==manifest.byteLength||await digest(bytes)!==manifest.sha256)fail();
  let payload;
  try{payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail();}
  if(payload.formatVersion!==1||payload.campaignId!==context.campaignId||payload.ownerUid!==context.ownerUid||
      ['cartridgeId','revision','mapId','mapName'].some(k=>payload[k]!==manifest[k]))fail();
  validate(copy(payload.project));
  return payload;
}
export function sameSession(a,b) {
  return a?.status==='open' && b?.status==='open' && a.releaseId===b.releaseId && a.roomId===b.roomId;
}

// Firebase SDK is injected so the actual publication/read protocol can be tested.
export function playStore(fs,db,currentUid) {
  const ref=(cid,...parts)=>fs.doc(db,'campaigns',cid,...parts);
  const server=async r=>{const s=await fs.getDocFromServer(r);return s.exists()?s.data():null;};
  async function access(cid,expectedUid=currentUid()) {
    if(!expectedUid||currentUid()!==expectedUid||!/^[A-Za-z0-9]{20}$/.test(cid))throw Error('PLAY_ACCESS');
    const campaign=await server(ref(cid));
    if(!campaign||campaign.status!=='active'||campaign.ruleset!=='legacy')throw Error('PLAY_ACCESS');
    const context={uid:expectedUid,ownerUid:campaign.ownerId,campaignId:cid,rulesetId:campaign.ruleset,status:campaign.status,name:campaign.name};
    if(context.uid!==context.ownerUid){
      const [member,room,participant]=await Promise.all([
        server(ref(cid,'members',expectedUid)),server(ref(cid,'lobby','current')),
        server(ref(cid,'lobbyParticipants',expectedUid))]);
      if(member?.userId!==expectedUid||member?.status!=='active'||!isWaitingLobby(room)||
          !isJoinedParticipant(participant,room.roomId))throw Error('PLAY_ACCESS');
      context.roomId=room.roomId;
    }
    if(currentUid()!==expectedUid)throw Error('PLAY_ACCESS');
    return context;
  }
  async function publish(cartridge, context, mapId, validate) {
    const expectedUid=context.uid;
    const fresh=await access(context.campaignId,expectedUid);
    if(fresh.ownerUid!==expectedUid)throw Error('PLAY_ACCESS');
    const packed=await packMap(cartridge,fresh,mapId,validate),cid=context.campaignId;
    const [previous,previousRoom]=await Promise.all([server(ref(cid,'playSession','current')),server(ref(cid,'lobby','current'))]);
    if(previous?.status==='open'&&releaseId(previous.releaseId)&&isWaitingLobby(previousRoom)&&previousRoom.roomId===previous.roomId){
      const manifest=await server(ref(cid,'worldReleases',previous.releaseId));
      if(validManifest(manifest)&&manifest.sha256===packed.manifest.sha256){
        await access(cid,expectedUid);return previous.releaseId;
      }
    }
    const rid=newId();
    const release=ref(cid,'worldReleases',rid);
    // Chunk batches stay below Firestore's request size and rules access limits.
    for(let i=0;i<packed.chunks.length;i+=8){
      await access(cid,expectedUid);
      const batch=fs.writeBatch(db);
      packed.chunks.slice(i,i+8).forEach((data,j)=>batch.set(ref(cid,'worldReleases',rid,'chunks',String(i+j)),{data}));
      await batch.commit();
    }
    await access(cid,expectedUid);
    await fs.runTransaction(db,async tx=>{
      const roomRef=ref(cid,'lobby','current'),roomSnap=await tx.get(roomRef);
      if(currentUid()!==expectedUid)throw Error('PLAY_ACCESS');
      const room=roomSnap.exists()?roomSnap.data():null;
      const roomId=isWaitingLobby(room)?room.roomId:makeLobbyId();
      if(!isWaitingLobby(room))tx.set(roomRef,{hostId:expectedUid,roomId,status:'waiting',openedAt:fs.serverTimestamp(),updatedAt:fs.serverTimestamp()});
      tx.set(release,{...packed.manifest,createdAt:fs.serverTimestamp()});
      tx.set(ref(cid,'playSession','current'),{releaseId:rid,roomId,status:'open',updatedAt:fs.serverTimestamp()});
    });
    return rid;
  }
  async function load(cid,validate) {
    const expectedUid=currentUid(),context=await access(cid,expectedUid);
    const session=await server(ref(cid,'playSession','current'));
    if(session?.status!=='open'||!releaseId(session.releaseId))throw Error('PLAY_CLOSED');
    if(context.roomId&&session.roomId!==context.roomId)throw Error('PLAY_CLOSED');
    const room=await server(ref(cid,'lobby','current'));
    if(!isWaitingLobby(room)||session.roomId!==room.roomId)throw Error('PLAY_CLOSED');
    const manifest=await server(ref(cid,'worldReleases',session.releaseId));
    if(!validManifest(manifest))fail();
    const chunks=[];
    // Fetch only numbered documents; no collection query or additional index required.
    for(let i=0;i<manifest.chunkCount;i+=8){
      const group=await Promise.all(Array.from({length:Math.min(8,manifest.chunkCount-i)},(_,j)=>
        server(ref(cid,'worldReleases',session.releaseId,'chunks',String(i+j)))));
      chunks.push(...group.map(d=>d?.data));
    }
    const payload=await unpackMap(manifest,chunks,context,validate);
    const latestContext=await access(cid,expectedUid);
    const [latest,latestRoom]=await Promise.all([server(ref(cid,'playSession','current')),server(ref(cid,'lobby','current'))]);
    if(!sameSession(session,latest)||!isWaitingLobby(latestRoom)||latestRoom.roomId!==session.roomId||
        (latestContext.roomId&&latestContext.roomId!==session.roomId)||currentUid()!==expectedUid)throw Error('PLAY_CHANGED');
    return {context,session,payload,manifest};
  }
  function watch(cid,context,session,onInvalid) {
    let live=true;const stops=[];
    const stop=()=>{live=false;stops.splice(0).forEach(fn=>fn());};
    function observe(r,valid){if(!live)return;let confirmed=false;stops.push(fs.onSnapshot(r,{includeMetadataChanges:true},s=>{
      if(!live)return;
      if(s.metadata?.fromCache&&!confirmed)return;
      if(!s.metadata?.fromCache)confirmed=true;
      if(s.metadata?.fromCache||currentUid()!==context.uid||!s.exists()||!valid(s.data())){stop();onInvalid();}
    },()=>{if(live){stop();onInvalid();}}));}
    observe(ref(cid),c=>c.status==='active'&&c.ownerId===context.ownerUid&&c.ruleset==='legacy');
    observe(ref(cid,'playSession','current'),s=>sameSession(s,session));
    observe(ref(cid,'lobby','current'),r=>isWaitingLobby(r)&&r.roomId===session.roomId);
    if(context.uid!==context.ownerUid){
      observe(ref(cid,'members',context.uid),m=>m.status==='active'&&m.userId===context.uid);
      observe(ref(cid,'lobbyParticipants',context.uid),p=>isJoinedParticipant(p,session.roomId));
    }
    return stop;
  }
  return {access,publish,load,watch};
}
