'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const EQ=require('../juego/assets/fh-equipment-core.js');
const FH=require('../juego/assets/fh-services-core.js');

function electrical(inventory=['cell_phone_charger','cell_phone_fast_charger'],equipped=true){
 const project={schema:'forest-horror-map-v1',units:{feetPerCell:5},floors:[{id:'f',items:[
  {id:'wall',type:'wall',a:{x:0,y:0},b:{x:7,y:0}},
  {id:'panel',type:'breaker_panel',x:0,y:0,circuits:[{zoneId:'z',rangeFt:40}]},
  {id:'plug',type:'power_outlet',x:2,y:0,zoneId:'z'}
 ]}]};
 const state={inventory:[...inventory],phone:{battery:20},equipment:equipped?{rearLeft:'cell_phone',rearRight:'wallet'}:{rearLeft:'',rearRight:''}};
 return {state,project,sys:FH.createRuntime(project,state)};
}
test('nuevos ítems del catálogo conservan IDs e iconos distintos',()=>{
 const defs=EQ.itemDefinitions([]);
 assert.deepEqual(defs.map(x=>x.id),['cell_phone_charger','cell_phone_fast_charger','cell_phone','wallet']);
 assert.equal(Object.keys(EQ.ICONS).length,4);
 assert.equal(EQ.itemDefinitions(defs).length,4);
});
test('equipamiento inicial independiente de los 10 espacios de inventario',()=>{
 const state={inventory:['cell_phone_charger','cell_phone_fast_charger'],equipment:{rearLeft:'cell_phone',rearRight:'wallet'}};
 const eq=EQ.ensure(state);
 assert.equal(eq.rearLeft,'cell_phone');assert.equal(eq.rearRight,'wallet');
 assert.equal(state.inventory.length,2);
 assert.equal(EQ.hasEquipped(state,'wallet'),true);
});
test('desequipar pasa el ítem al inventario y equipar lo vuelve al bolsillo',()=>{
 const state={inventory:[],equipment:{rearLeft:'cell_phone',rearRight:'wallet'}};
 assert.equal(EQ.unequip(state,'rearLeft').ok,true);
 assert.deepEqual(state.inventory,['cell_phone']);
 assert.equal(EQ.equip(state,'cell_phone','rearLeft').ok,true);
 assert.deepEqual(state.inventory,[]);
 assert.equal(EQ.equip(state,'wallet','rearLeft').ok,false);
});
test('la cartera admite solo categorías de dinero y tarjetas',()=>{
 const state={inventory:['debit-card','cash-note','key'],equipment:{rearLeft:'cell_phone',rearRight:'wallet'}};
 const defs=[{id:'debit-card',storageCategory:'card'},{id:'cash-note',storageCategory:'cash'},{id:'key',kind:'key'}];
 assert.equal(EQ.moveToWallet(state,'debit-card',defs).ok,true);
 assert.equal(EQ.moveToWallet(state,'cash-note',defs).ok,true);
 assert.equal(EQ.moveToWallet(state,'key',defs).ok,false);
 assert.deepEqual(state.equipment.wallet.items,['debit-card','cash-note']);
 assert.deepEqual(state.inventory,['key']);
 assert.equal(EQ.moveFromWallet(state,'debit-card').ok,true);
 assert.deepEqual(state.inventory,['key','debit-card']);
});
test('sin cartera equipada los billetes y tarjetas siguen ocupando inventario',()=>{
 const state={inventory:['cash-note'],equipment:{rearLeft:'cell_phone',rearRight:''}};
 assert.equal(EQ.moveToWallet(state,'cash-note',[{id:'cash-note',storageCategory:'cash'}]).ok,false);
 assert.deepEqual(state.inventory,['cash-note']);
});
test('la cartera y sus contenidos sobreviven a la serialización',()=>{
 const state={inventory:[],equipment:{rearLeft:'cell_phone',rearRight:'wallet',wallet:{items:['bank-card','cash-note']}}};
 EQ.ensure(state);
 const restored=JSON.parse(JSON.stringify(state));
 assert.deepEqual(EQ.ensure(restored).wallet.items,['bank-card','cash-note']);
});
test('el cargador rápido carga al 1 % cada dos minutos, el normal cada tres',()=>{
 for(const [charger,minutes] of [['cell_phone_charger',3],['cell_phone_fast_charger',2]]){
  const {sys,state}=electrical();
  assert.equal(sys.chargePhone(0,'plug',charger),true);
  sys.tick(minutes-1,1);assert.equal(state.phone.battery,20);
  sys.tick(1,1);assert.equal(state.phone.battery,21);
  assert.equal(state.phone.chargerItemId,charger);
 }
});
test('el cargador rápido no funciona si no se tiene o no hay celular equipado',()=>{
 const missing=electrical(['cell_phone_charger']);
 assert.equal(missing.sys.chargePhone(0,'plug','cell_phone_fast_charger'),false);
 const unequipped=electrical(['cell_phone_fast_charger'],false);
 assert.equal(unequipped.sys.chargePhone(0,'plug','cell_phone_fast_charger'),false);
});
