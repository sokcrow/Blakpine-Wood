/* Blakpine-Wood — lectura del dinero del personaje activo para el HUD y el teléfono.
 * No modifica cuentas, transacciones ni mapas.
 */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHEconomyView=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
 'use strict';
 const E=root.FHEconomyCore||(typeof require==='function'?require('./fh-economy-core.js'):null);
 function readForCharacter(characterId,storage,limit=20){
  if(typeof characterId!=='string'||!characterId.trim())return {ok:false,reason:'no_character'};
  if(!E)return {ok:false,reason:'storage_unavailable'};
  try{
   const state=E.openStore(storage).read();
   const cashId=E.accountId('character',characterId,'cash');
   const bankId=E.accountId('character',characterId,'bank');
   const cashCents=E.getBalance(state,cashId),bankCents=E.getBalance(state,bankId);
   if(cashCents===null||bankCents===null)return {ok:false,reason:'account_missing'};
   const total=BigInt(cashCents)+BigInt(bankCents);
   const totalUsd='$'+(total/100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,',')+
    '.'+(total%100n).toString().padStart(2,'0');
   const ids=new Set([cashId,bankId]);
   const cap=Number.isSafeInteger(limit)?Math.max(0,Math.min(100,limit)):20;
   const movements=state.transactions.filter(t=>ids.has(t.from)||ids.has(t.to)).slice(-cap||undefined).reverse()
    .slice(0,cap).map(t=>{
     const fromOwn=ids.has(t.from),toOwn=ids.has(t.to);
     const direction=fromOwn&&toOwn?'transfer':toOwn?'incoming':'outgoing';
     return {id:t.id,operation:t.operation,category:t.category,status:t.status,
      reason:t.reason,direction,amountCents:t.amountCents,amountUsd:E.formatUsd(t.amountCents),
      gameMinutes:t.gameMinutes};
    });
   return {ok:true,characterId,cashCents,bankCents,cashUsd:E.formatUsd(cashCents),
    bankUsd:E.formatUsd(bankCents),totalUsd,movements};
  }catch(error){
   return {ok:false,reason:['economy_corrupt','storage_unavailable'].includes(error?.message)
    ?error.message:'storage_unavailable'};
  }
 }
 return Object.freeze({readForCharacter});
});
