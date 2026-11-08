/* Blakpine-Wood — orquestador de reparación sin interfaz ni reglas de inventario.
 * La aplicación NO proporciona adaptador de consumo hasta aprobar su economía:
 * sin confirmación verificable no se tira ni se recuperan PG.
 */
(function(root){
 'use strict';
 const Skills=root.FHSkills||(
  typeof module==='object'&&module.exports&&typeof require==='function'?require('./fh-skills.js'):null);
 const Repair=root.FHRepair||(
  typeof module==='object'&&module.exports&&typeof require==='function'?require('./fh-repair.js'):null);
 if(!Skills?.roll||!Skills?.odds||!Repair?.validateJob)
  throw Error('FHRepairRuntime requiere FHSkills y FHRepair.');
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 function kitPG(level){
  if(!Number.isSafeInteger(level)||level<1||!Number.isSafeInteger(level*5))
   throw new RangeError('El nivel de kit debe ser un entero positivo válido.');
  return level*5;
 }
 function checkConfig(config){
  const pct=config?.failureRecoveryPct;
  if(!finite(pct)||pct<0||pct>=100)
   return {ok:false,reason:'failure-recovery-unconfigured'};
  return {ok:true,percentage:pct};
 }
 function odds({job,character,skillOptions={}}={}){
  const invalid=Repair.validateJob(job);
  if(invalid.length)return {ok:false,reason:'invalid-job',errors:invalid};
  if(Repair.resolveStatus(job)!=='configured')
   return {ok:false,reason:'skill-pending'};
  if(!character||typeof character!=='object'||Array.isArray(character))
   return {ok:false,reason:'missing-character'};
  try{
   const {difficultyPenaltyPerPoint,advantage,disadvantage}=skillOptions||{};
   const options={difficulty:job.difficulty,
    ...(difficultyPenaltyPerPoint===undefined?{}:{difficultyPenaltyPerPoint}),
    ...(advantage===undefined?{}:{advantage}),
    ...(disadvantage===undefined?{}:{disadvantage})};
   return {ok:true,skill:job.requiredSkillId,...Skills.odds(character,job.requiredSkillId,options)};
  }catch(error){return {ok:false,reason:'invalid-skill-options',message:String(error.message||error)};}
 }
 function preflight({job,kit,character,health,config,skillOptions}={}){
  const c=checkConfig(config);
  if(!c.ok)return c;
  const probs=odds({job,character,skillOptions});
  if(!probs.ok)return probs;
  if(!kit||typeof kit!=='object'||kit.id!==job.compatibleKitId)
   return {ok:false,reason:'incompatible-kit'};
  let full;
  try{full=kitPG(kit.level);}catch{return {ok:false,reason:'invalid-kit-level'};}
  // El trabajo debe declarar capacidad al menos igual a la recuperación del kit.
  if(job.recoverablePG<full)return {ok:false,reason:'insufficient-job-capacity'};
  const target=job.target,part=target.part||'structure';
  if(!health||typeof health.getState!=='function'||typeof health.restorePG!=='function')
   return {ok:false,reason:'structure-system-unavailable'};
  const before=health.getState(target.floorId,target.itemId,part);
  if(!before||!finite(before.maxPG)||!finite(before.pg)||before.maxPG<=0)
   return {ok:false,reason:'invalid-target'};
  if(before.pg>=before.maxPG)return {ok:false,reason:'already-full'};
  return {ok:true,job,kit,pgFromKit:full,percentage:c.percentage,
   odds:probs,before,part};
 }
 function perform({job,kit,character,health,config,skillOptions={},consumeKitUse,
  state,saveState,rng}={}){
  const check=preflight({job,kit,character,health,config,skillOptions});
  if(!check.ok)return check;
  if(!state||typeof state!=='object'||Array.isArray(state))
   return {ok:false,reason:'missing-save-state'};
  if(typeof consumeKitUse!=='function')
   return {ok:false,reason:'inventory-consumption-pending'};
  if(typeof saveState!=='function')
   return {ok:false,reason:'save-pending'};
  const receipts=Array.isArray(state.repairReceipts)?state.repairReceipts:[];
  let spent;
  try{spent=consumeKitUse({
   kitId:job.compatibleKitId,level:kit.level,quantity:1,jobId:job.id,
   floorId:job.target.floorId,itemId:job.target.itemId
  });}catch(error){return {ok:false,reason:'consumption-error',message:String(error.message||error)};}
  // No aceptar simples booleanos: se exige consumo de una unidad y recibo único.
  if(!spent||spent.ok!==true||spent.consumedUses!==1||
    typeof spent.receiptId!=='string'||spent.receiptId.length<1||
    spent.receiptId.length>120||/[^\x20-\x7e]/.test(spent.receiptId))
   return {ok:false,reason:'consumption-not-confirmed'};
  if(receipts.includes(spent.receiptId))
   return {ok:false,reason:'receipt-reused'};
  state.repairReceipts=receipts.concat([spent.receiptId]);
  // Persistir el uso del kit ANTES del resultado, incluso si el RNG externo falla.
  saveState();
  const options={difficulty:job.difficulty,...skillOptions};
  if(rng!==undefined)options.rng=rng;
  let rolled;
  try{rolled=Skills.roll(character,job.requiredSkillId,options);}
  catch(error){return {ok:false,reason:'roll-error-after-consumption',message:String(error.message||error)};}
  const successful=rolled.success===true;
  // Fallo sobre PG=0: nunca reconstruir, aunque haya porcentaje parcial.
  const proposed=successful?check.pgFromKit:
   check.before.destroyed?0:check.pgFromKit*check.percentage/100;
  let repairResult=null;
  if(proposed>0){
   repairResult=health.restorePG({
    floorId:job.target.floorId,id:job.target.itemId,part:check.part,
    amount:proposed,allowRebuild:successful
   });
  }
  return {ok:true,success:successful,outcome:rolled.outcome,roll:rolled,
   odds:check.odds,kitPG:check.pgFromKit,
   recoveredPG:repairResult?.ok?repairResult.recovered:0,
   rebuilt:repairResult?.ok?repairResult.rebuilt:false,
   pg:repairResult?.ok?repairResult.pg:check.before.pg,
   maxPG:check.before.maxPG,
   consumed:{kitId:kit.id,consumedUses:1,receiptId:spent.receiptId}};
 }
 const api=Object.freeze({kitPG,checkConfig,odds,preflight,perform});
 root.FHRepairRuntime=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
