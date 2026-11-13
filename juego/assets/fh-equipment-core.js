/* Blakpine-Wood — dos bolsillos traseros y cartera física; estado serializable. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHEquipmentCore=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const SLOTS=Object.freeze(['rearLeft','rearRight']);
 const ALLOWED=new Set(['cell_phone','wallet']);
 const CARD_CATEGORIES=new Set(['card','cash','physical_card','physical_cash']);
 const ICONS=Object.freeze({
  cell_phone_charger:'items/cargador-celular.png',
  cell_phone_fast_charger:'items/cargador-rapido.png',
  cell_phone:'items/celular.png',
  wallet:'items/cartera.png'
 });
 const DEFS=Object.freeze([
  {id:'cell_phone_charger',kind:'tool',name:'Cargador de celular',description:'Carga 1 % cada 3 minutos de juego en un enchufe con corriente.',stackable:false,icon:'🔌'},
  {id:'cell_phone_fast_charger',kind:'tool',name:'Cargador de carga rápida',description:'Carga un 50 % más rápido que el cargador normal.',stackable:false,icon:'⚡'},
  {id:'cell_phone',kind:'tool',name:'Celular',description:'Se equipa en uno de los bolsillos traseros.',stackable:false,icon:'▣'},
  {id:'wallet',kind:'tool',name:'Cartera',description:'Guarda efectivo físico y tarjetas en su inventario interior.',stackable:false,icon:'▤'}
 ]);
 function ensure(state){
  if(!state||typeof state!=='object')throw Error('Estado de partida inválido');
  state.inventory=Array.isArray(state.inventory)?state.inventory:[];
  const legacy=!state.equipment||typeof state.equipment!=='object';
  const eq=!legacy?state.equipment:{};
  for(const slot of SLOTS)if(!ALLOWED.has(eq[slot]))eq[slot]='';
  // Partidas antiguas: el celular y la cartera iniciales no se pierden.
  if(legacy&&!state.inventory.includes('cell_phone'))eq.rearLeft='cell_phone';
  if(legacy&&!state.inventory.includes('wallet'))eq.rearRight='wallet';
  eq.wallet=eq.wallet&&typeof eq.wallet==='object'?eq.wallet:{};
  eq.wallet.items=Array.isArray(eq.wallet.items)?eq.wallet.items.filter(x=>typeof x==='string'):[];
  state.equipment=eq;
  return eq;
 }
 function hasEquipped(state,id){const eq=ensure(state);return SLOTS.some(slot=>eq[slot]===id)}
 function equip(state,id,slot){
  const eq=ensure(state);
  if(!ALLOWED.has(id)||!SLOTS.includes(slot)||eq[slot]||!state.inventory.includes(id)||hasEquipped(state,id))
   return {ok:false,reason:'notAvailable'};
  state.inventory.splice(state.inventory.indexOf(id),1);eq[slot]=id;return {ok:true};
 }
 function unequip(state,slot,maxSlots=10){
  const eq=ensure(state);
  if(!SLOTS.includes(slot)||!eq[slot])return {ok:false,reason:'empty'};
  const id=eq[slot];
  if(new Set(state.inventory).size>=maxSlots&&!state.inventory.includes(id))return {ok:false,reason:'full'};
  eq[slot]='';state.inventory.push(id);return {ok:true,id};
 }
 function walletAvailable(state){return hasEquipped(state,'wallet')}
 function category(def){return def?.storageCategory||def?.walletCategory||''}
 function moveToWallet(state,id,itemDefs=[]){
  const eq=ensure(state);
  if(!walletAvailable(state))return {ok:false,reason:'walletNotEquipped'};
  const def=itemDefs.find(d=>d.id===id);
  if(!CARD_CATEGORIES.has(category(def)))return {ok:false,reason:'notWalletItem'};
  const at=state.inventory.indexOf(id);
  if(at<0)return {ok:false,reason:'missing'};
  state.inventory.splice(at,1);eq.wallet.items.push(id);
  return {ok:true};
 }
 function moveFromWallet(state,id,maxSlots=10){
  const eq=ensure(state);
  const at=eq.wallet.items.indexOf(id);
  if(at<0)return {ok:false,reason:'missing'};
  if(new Set(state.inventory).size>=maxSlots&&!state.inventory.includes(id))return {ok:false,reason:'full'};
  eq.wallet.items.splice(at,1);state.inventory.push(id);return {ok:true};
 }
 function itemDefinitions(existing=[]){
  return [...existing,...DEFS.filter(def=>!existing.some(d=>d.id===def.id)).map(d=>({...d}))];
 }
 return {SLOTS,DEFS,ICONS,ensure,hasEquipped,equip,unequip,walletAvailable,moveToWallet,moveFromWallet,itemDefinitions};
});