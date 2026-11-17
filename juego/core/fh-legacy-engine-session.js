/* Lifecycle owned by the engine closure. No resolver or resource mutators here. */
(function(root,factory){
 'use strict';
 const api=factory(typeof module==='object'&&module.exports
  ?require('./fh-session-coordinator.js'):root.FHSessionCoordinator);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHLegacyEngineSession=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(coordinator){
 'use strict';
 let sequence=0;
 function create({shadowRuntime,gameState,readPlayer,readMinute,readSurvival}){
  const sessionId=globalThis.crypto?.randomUUID?.()||'legacy-engine-'+(++sequence);
  let closed=false,binding=null,character=null,playerId=null,resources=null,survival=null;
  let revision=0,previous='';
  function close(){
   if(closed)return;
   closed=true;binding?.close();shadowRuntime?.dispose();
  }
  function readContext(){
   if(closed)return null;
   if(gameState.character!==character||character?.id!==playerId||character?.resources!==resources||
    readSurvival()!==survival||survival?.resources!==resources){close();return null;}
   const player=readPlayer(),minute=readMinute();
   const fingerprint=JSON.stringify([minute,player,resources,character.life]);
   if(previous!==fingerprint){previous=fingerprint;revision++;}
   return {sessionId,playerId,rulesetId:'legacy',revision,minute,player};
  }
  function tick(dt){
   if(closed)return;
   if(!binding){
    character=gameState.character;playerId=character?.id;resources=character?.resources;survival=readSurvival();
    if(shadowRuntime?.read().enabled===false)return;
    if(!character?.id||!resources||survival?.resources!==resources){close();return;}
    try{binding=coordinator.create().bindLegacyCombat({sessionId,playerId,
     shadowRuntime,readContext});}
    catch(error){close();throw error;}
   }
   const context=readContext();
   if(context)shadowRuntime.tick(context.minute,dt,context.player);
  }
  return Object.freeze({tick,close,getStatus:()=>({connected:!!binding&&!closed,closed})});
 }
 return Object.freeze({create});
});
