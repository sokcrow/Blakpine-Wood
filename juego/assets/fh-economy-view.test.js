'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('./fh-economy-core.js');
const View=require('./fh-economy-view.js');
function storage(initial=E.createEconomy()){
 const values=new Map([[E.STORAGE_KEY,JSON.stringify(initial)]]);
 let writes=0;
 return {getItem:key=>values.get(key)||null,setItem:(key,value)=>{writes++;values.set(key,value)},
  get writes(){return writes},values};
}
function sample(){
 let state=E.createEconomy();
 for(const [ownerType,ownerId] of [['character','alice'],['character','bob'],['npc','merchant']]){
  state=E.ensureOwner(state,{ownerType,ownerId}).state;
 }
 const aliceCash=E.accountId('character','alice','cash');
 const aliceBank=E.accountId('character','alice','bank');
 const bobBank=E.accountId('character','bob','bank');
 const npc=E.accountId('npc','merchant','cash');
 const metadata=(id,amountCents)=>({id,amountCents,category:'test',gameMinutes:480});
 state=E.credit(state,{...metadata('alice-seed',12000),to:aliceCash,externalRef:'system:seed'}).state;
 state=E.credit(state,{...metadata('bob-seed',3000),to:bobBank,externalRef:'system:seed'}).state;
 state=E.transfer(state,{...metadata('alice-deposit',2000),from:aliceCash,to:aliceBank}).state;
 state=E.transfer(state,{...metadata('alice-buy',3000),from:aliceCash,to:npc}).state;
 state=E.transfer(state,{...metadata('alice-reject',10000),from:aliceCash,to:npc}).state;
 return {state,aliceCash,aliceBank,bobBank,npc};
}

test('cuentas de un personaje: efectivo, banco, total e historial filtrado',()=>{
 const {state}=sample(),db=storage(state);
 const result=View.readForCharacter('alice',db);
 assert.equal(result.ok,true);
 assert.equal(result.cashUsd,'$70.00');
 assert.equal(result.bankUsd,'$20.00');
 assert.equal(result.totalUsd,'$90.00');
 assert.deepEqual(result.movements.map(x=>x.id),['alice-reject','alice-buy','alice-deposit','alice-seed']);
 assert.equal(result.movements[0].status,'rejected');
 assert.equal(result.movements[0].reason,'insufficient_funds');
 assert.equal(result.movements[2].direction,'transfer');
 assert.equal(result.movements[3].direction,'incoming');
 assert.equal(db.writes,0,'consultar no debe guardar ni alterar cuentas');
});
test('cambiar personaje no mezcla saldos ni movimientos de otros',()=>{
 const {state}=sample(),db=storage(state);
 const alice=View.readForCharacter('alice',db);
 const bob=View.readForCharacter('bob',db);
 assert.equal(bob.cashUsd,'$0.00');assert.equal(bob.bankUsd,'$30.00');
 assert.deepEqual(bob.movements.map(x=>x.id),['bob-seed']);
 assert.ok(alice.movements.every(x=>x.id!=='bob-seed'));
 assert.equal(View.readForCharacter('merchant',db).reason,'account_missing');
});
test('identidad ausente y economía corrupta no muestran dinero inventado',()=>{
 assert.equal(View.readForCharacter('',storage()).reason,'no_character');
 assert.equal(View.readForCharacter('new',storage()).reason,'account_missing');
 const broken={getItem:()=>'{not json',setItem(){throw Error('no writes')}};
 assert.equal(View.readForCharacter('alice',broken).reason,'economy_corrupt');
 const denied={getItem(){throw Error('security')},setItem(){}};
 assert.equal(View.readForCharacter('alice',denied).reason,'storage_unavailable');
});
test('el total puede superar MAX_SAFE_INTEGER sin perder exactitud',()=>{
 let state=E.ensureOwner(E.createEconomy(),{ownerType:'character',ownerId:'big'}).state;
 for(const [id,kind] of [['one','cash'],['two','bank']]){
  state=E.credit(state,{id,category:'seed',gameMinutes:0,amountCents:Number.MAX_SAFE_INTEGER,
   to:E.accountId('character','big',kind),externalRef:'system:seed'}).state;
 }
 const result=View.readForCharacter('big',storage(state));
 assert.equal(result.ok,true);
 assert.equal(result.totalUsd,'$180,143,985,094,819.82');
});
