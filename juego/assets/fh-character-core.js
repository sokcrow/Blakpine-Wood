/* Blakpine Wood — identidad y puntuaciones del personaje. Independiente del mapa. */
(function (global) {
 'use strict';
 const KEY='blakpine_character_active_v1';
 const SCORES=Object.freeze(['FOR','AGI','VOL','PRU','ING','ARC','SOC']);
 const initialSkills=()=>global.FHSkills?.emptyPoints?.()||{};
 const normalizedSkills=raw=>global.FHSkills?.normalizePoints?.(raw)||(
  raw&&typeof raw==='object'&&!Array.isArray(raw)?clone(raw):{});
 const RELATIONS=Object.freeze(['hermano','hermana','madre','padre','pareja','amigo','amiga','otro']);
 const clone=value=>JSON.parse(JSON.stringify(value));
 const unique=xs=>Array.isArray(xs)&&new Set(xs).size===xs.length;
 const validKeys=xs=>unique(xs)&&xs.every(k=>SCORES.includes(k));
 function calculate(strengths,weaknesses,bonus={}) {
  if(!validKeys(strengths)||!validKeys(weaknesses)||strengths.length!==2||weaknesses.length!==2)
   throw Error('Selecciona dos fortalezas y dos debilidades distintas.');
  if(strengths.some(k=>weaknesses.includes(k)))throw Error('Una fortaleza no puede ser una debilidad.');
  if(!bonus||typeof bonus!=='object'||Array.isArray(bonus)||Object.keys(bonus).some(k=>!SCORES.includes(k)))
   throw Error('La distribución de puntos no es válida.');
  const result={};let spent=0,maxed=0;
  for(const k of SCORES){
   const additional=Object.hasOwn(bonus,k)?bonus[k]:0;
   if(!Number.isInteger(additional)||additional<0||(weaknesses.includes(k)&&additional!==0))
    throw Error('No puedes repartir puntos en las debilidades.');
   const score=(strengths.includes(k)?5:weaknesses.includes(k)?1:3)+additional;
   if(score>6)throw Error('Ningún Score puede superar 6.');
   result[k]=score;spent+=additional;if(score===6)maxed++;
  }
  if(spent!==4||maxed>2||SCORES.reduce((sum,k)=>sum+result[k],0)!==25)
   throw Error('La distribución debe gastar 4 puntos y tener como máximo dos Scores en 6.');
  return result;
 }
 function resources(scores) {
  return {pgMax:26+2*scores.FOR,spMax:14+2*scores.VOL,peMax:6+scores.FOR+scores.AGI,evasionPct:5+5*scores.AGI};
 }
 function createProfile(input) {
  if(!input||!['resident','newcomer'].includes(input.origin))throw Error('Origen inválido.');
  const name=String(input.name||'').trim().replace(/\s+/g,' ');
  if(name.length<2||name.length>60)throw Error('El nombre debe tener entre 2 y 60 caracteres.');
  if(!RELATIONS.includes(input.relationship))throw Error('Vínculo inválido.');
  const missingName=String(input.missingName||'').trim().replace(/\s+/g,' ');
  if(missingName.length>60)throw Error('Nombre de la persona desaparecida demasiado largo.');
  const strengths=[...input.strengths],weaknesses=[...input.weaknesses],bonus={...input.bonus};
  const scores=calculate(strengths,weaknesses,bonus);
  const r=resources(scores);
  const id=typeof global.crypto?.randomUUID==='function'?global.crypto.randomUUID():
   'bw_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,12);
  return {
   version:1,id,life:'alive',name,origin:input.origin,
   missingPerson:{name:missingName||null,relationship:input.relationship,deadlineDays:365},
   allocation:{strengths,weaknesses,bonus},
   scores,skills:initialSkills(),resources:{pg:r.pgMax,pgMax:r.pgMax,sp:r.spMax,spMax:r.spMax,pe:r.peMax,peMax:r.peMax},
   profession:null,traits:[],workHistory:[],
   employment:{hasJob:input.origin==='resident',jobId:null,pendingAssignment:input.origin==='resident'},
   housing:{propertyId:null,pendingAssignment:true},
   economy:null,createdAt:new Date().toISOString()
  };
 }
 function storage() {try{return global.localStorage||null}catch{return null}}
 function load() {
  try{
   const raw=storage()?.getItem(KEY);if(!raw)return null;
   const value=JSON.parse(raw);
   if(value?.version!==1||typeof value.id!=='string'||!value.id||
      !['alive','dead'].includes(value.life)||typeof value.name!=='string'||
      !value.scores||SCORES.some(k=>!Number.isInteger(value.scores[k])))return null;
   value.skills=normalizedSkills(value.skills);
   return clone(value);
  }catch{return null}
 }
 function store(profile) {
  const store=storage();
  if(!store)throw Error('Almacenamiento no disponible.');
  const saved=clone(profile);
  saved.skills=normalizedSkills(saved.skills);
  store.setItem(KEY,JSON.stringify(saved));
  return saved;
 }
 function current(){const profile=load();return profile?.life==='alive'?profile:null}
 function markDead(id) {
  const profile=load();
  if(!profile||profile.life!=='alive'||profile.id!==id)return false;
  profile.life='dead';profile.diedAt=new Date().toISOString();store(profile);return true;
 }
 function selectMapSave(raw,characterId) {
  if(typeof raw!=='string'||!raw||!characterId)return null;
  try{
   const payload=JSON.parse(raw);
   return payload?.version===1&&payload?.state?.characterId===characterId?raw:null;
  }catch{return null}
 }
 function syncResourcesFromSave(raw,characterId) {
  const profile=current();
  if(!profile||profile.id!==characterId||!selectMapSave(raw,characterId))return false;
  try{
   const incoming=JSON.parse(raw).state.character?.resources;
   if(!incoming||typeof incoming!=='object')return false;
   let updated=false;
   for(const key of ['pg','sp','pe']){
    if(!Number.isFinite(incoming[key]))continue;
    const bound=profile.resources[key+'Max'];
    const value=Math.min(bound,Math.max(0,incoming[key]));
    if(profile.resources[key]!==value){profile.resources[key]=value;updated=true}
   }
   if(updated)store(profile);
   return updated;
  }catch{return false}
 }
 function syncSkillsFromSave(raw,characterId) {
  const profile=current();
  if(!profile||profile.id!==characterId||!selectMapSave(raw,characterId))return false;
  try{
   const incoming=JSON.parse(raw).state.character?.skills;
   if(!incoming||typeof incoming!=='object'||Array.isArray(incoming))return false;
   const next=normalizedSkills(incoming);
   if(JSON.stringify(profile.skills)===JSON.stringify(next))return false;
   profile.skills=next;store(profile);return true;
  }catch{return false}
 }
 global.FHCharacterCore=Object.freeze({KEY,SCORES,RELATIONS,calculate,resources,createProfile,load,store,current,markDead,selectMapSave,syncResourcesFromSave,syncSkillsFromSave});
})(typeof window!=='undefined'?window:globalThis);
