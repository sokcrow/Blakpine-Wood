'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Equipment=require('../juego/assets/fh-equipment-core.js');
const CHARGERS=['cell_phone_charger','cell_phone_fast_charger'];

test('partida antigua sin cargadores recibe ambos y conserva el resto',()=>{
 const save={inventory:['key','note'],equipment:{rearLeft:'cell_phone',rearRight:'wallet',wallet:{items:['card']}}};
 const result=Equipment.grantStarterChargers(save);
 assert.deepEqual(result,{changed:true,granted:2,pending:[]});
 assert.deepEqual(save.inventory,['key','note',...CHARGERS]);
 assert.deepEqual(save.equipment.wallet.items,['card']);
});

test('partida nueva y carga repetida no duplican cargadores',()=>{
 const state={inventory:[],equipment:{rearLeft:'cell_phone',rearRight:'wallet'}};
 assert.equal(Equipment.grantStarterChargers(state).granted,2);
 assert.deepEqual(Equipment.grantStarterChargers(state),{changed:false,granted:0,pending:[]});
 assert.deepEqual(state.inventory,CHARGERS);
});

test('si ya existe un cargador no crea otra unidad',()=>{
 const state={inventory:['cell_phone_charger'],equipment:{rearLeft:'cell_phone',rearRight:'wallet'}};
 assert.equal(Equipment.grantStarterChargers(state).granted,1);
 assert.deepEqual(state.inventory,CHARGERS);
 assert.equal(state.inventory.filter(x=>x==='cell_phone_charger').length,1);
});

test('si se pierde o usa después de entregarse, cargar partida no regala otro',()=>{
 const state={inventory:[],equipment:{rearLeft:'cell_phone',rearRight:'wallet'}};
 Equipment.grantStarterChargers(state);
 state.inventory.splice(state.inventory.indexOf('cell_phone_charger'),1);
 const restored=JSON.parse(JSON.stringify(state));
 assert.equal(Equipment.grantStarterChargers(restored).granted,0);
 assert.deepEqual(restored.inventory,['cell_phone_fast_charger']);
});

test('al estar lleno, difiere la entrega sin superar los diez espacios',()=>{
 const state={inventory:Array.from({length:10},(_,i)=>'existing-'+i),equipment:{rearLeft:'cell_phone',rearRight:'wallet'}};
 const first=Equipment.grantStarterChargers(state);
 assert.equal(first.granted,0);assert.deepEqual(first.pending,CHARGERS);
 assert.equal(state.inventory.length,10);
 state.inventory.pop();
 const second=Equipment.grantStarterChargers(state);
 assert.equal(second.granted,1);assert.deepEqual(second.pending,['cell_phone_fast_charger']);
 assert.equal(state.inventory.length,10);
 state.inventory.pop();
 const third=Equipment.grantStarterChargers(state);
 assert.equal(third.granted,1);assert.deepEqual(third.pending,[]);
 assert.equal(state.inventory.length,10);
});

test('el guardado conserva el recibo incluso si faltan cargadores en inventario',()=>{
 const save={inventory:['note']};
 Equipment.grantStarterChargers(save);
 const saved=JSON.parse(JSON.stringify(save));
 assert.equal(saved.equipment.starterChargersV1.cell_phone_charger,true);
 assert.equal(saved.equipment.starterChargersV1.cell_phone_fast_charger,true);
 assert.equal(Equipment.grantStarterChargers(saved).changed,false);
});

test('dos identificadores existentes se respetan sin modificación del inventario',()=>{
 const state={inventory:[...CHARGERS,'key'],equipment:{rearLeft:'cell_phone',rearRight:'wallet'}};
 assert.equal(Equipment.grantStarterChargers(state).granted,0);
 assert.deepEqual(state.inventory,[...CHARGERS,'key']);
 assert.equal(Equipment.grantStarterChargers(state).changed,false);
});
