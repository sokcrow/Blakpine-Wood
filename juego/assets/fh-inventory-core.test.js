'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Inventory = require('./fh-inventory-core.js');

function scene() {
  const world = Inventory.createWorld([
    { id: 'lata', kind: 'consumable', storageCategory: 'food', stackable: true },
    { id: 'camiseta', storageCategory: 'clothing' },
    { id: 'nota', kind: 'note', storageCategory: 'document' },
    { id: 'bateria', kind: 'consumable', storageCategory: 'other', stackable: true }
  ]);
  Inventory.addActor(world, 'jugador');
  Inventory.addActor(world, 'npc');
  Inventory.addBackpack(world, 'bag-01', 6, { kind: 'ground', floorId: 'F1', x: 3, y: 4 });
  return world;
}

test('10 espacios personales sin mochila; muebles con mínimo 6', () => {
  const world = scene();
  assert.equal(Inventory.PERSONAL_SLOTS, 10);
  assert.equal(Inventory.furnitureProfile('buro').slots, 6);
  assert.equal(Inventory.furnitureProfile('armario').slots, 24);
  assert.equal(Inventory.furnitureProfile('refrigerador').slots, 20);
  assert.equal(Inventory.furnitureProfile('despensa_alta').slots, 32);
  assert.equal(Inventory.furnitureProfile('buro', { slots: 2 }).slots, 6);
  assert.equal(Inventory.furnitureProfile('silla_madera'), null);
  assert.equal(Inventory.addFurniture(world, 'c1', 'cajonera').ok, true);
  assert.equal(world.furniture.c1.items.length, 0);
});

test('la mochila conserva contenido al recoger, equipar, soltar y volver a abrir', () => {
  const world = scene();
  assert.deepEqual(Inventory.deposit(world, { kind: 'backpack', id: 'bag-01' }, 'npc', { id: 'lata', quantity: 3 }), {ok:true});
  assert.equal(Inventory.pickupBackpack(world, 'bag-01', 'jugador').ok, true);
  assert.equal(Inventory.resolve(world, { kind: 'backpack', id: 'bag-01' }, 'npc').reason, 'inaccessible');
  assert.equal(Inventory.resolve(world, { kind: 'backpack', id: 'bag-01' }, 'jugador').reason, 'inaccessible');
  assert.equal(Inventory.equipBackpack(world, 'bag-01', 'jugador').ok, true);
  assert.equal(Inventory.resolve(world, { kind: 'backpack', id: 'bag-01' }, 'jugador').ok, true);
  assert.equal(Inventory.resolve(world, { kind: 'backpack', id: 'bag-01' }, 'npc').reason, 'inaccessible');
  assert.equal(Inventory.dropBackpack(world, 'bag-01', 'jugador', { floorId: 'F2', x: 1, y: 2 }).ok, true);
  assert.equal(Inventory.resolve(world, { kind: 'backpack', id: 'bag-01' }, 'npc').ok, true);
  assert.equal(world.backpacks['bag-01'].items[0].quantity, 3);
  assert.equal(world.backpacks['bag-01'].location.floorId, 'F2');
});

test('una mochila equipada como máximo; mochila adicional en inventario personal', () => {
  const world = scene();
  Inventory.addBackpack(world, 'bag-02', 10);
  Inventory.pickupBackpack(world, 'bag-01', 'jugador');
  Inventory.pickupBackpack(world, 'bag-02', 'jugador');
  Inventory.equipBackpack(world, 'bag-01', 'jugador');
  Inventory.equipBackpack(world, 'bag-02', 'jugador');
  assert.equal(world.actors.jugador.equippedBackpackId, 'bag-02');
  assert.equal(world.actors.jugador.personal.filter(e => e.backpackId === 'bag-01').length, 1);
  assert.equal(world.backpacks['bag-01'].location.kind, 'carried');
  assert.equal(Inventory.unequipBackpack(world, 'jugador').ok, true);
  assert.equal(world.actors.jugador.equippedBackpackId, null);
});

test('no se pueden meter mochilas en mochilas ni en muebles', () => {
  const world = scene();
  Inventory.addFurniture(world, 'arm1', 'armario');
  assert.equal(Inventory.deposit(world, { kind: 'backpack', id: 'bag-01' }, 'jugador', { id: 'backpack', backpackId: 'bag-02', quantity: 1 }).reason, 'backpackActionRequired');
  assert.equal(Inventory.deposit(world, { kind: 'furniture', id: 'arm1' }, 'jugador', { id: 'backpack', backpackId: 'bag-02', quantity: 1 }).reason, 'backpackActionRequired');
});

test('transferir es atómico y respeta categorías y topes por categoría', () => {
  const world = scene();
  Inventory.addFurniture(world, 'arm1', 'armario');
  Inventory.addFurniture(world, 'fridge1', 'refrigerador');
  Inventory.deposit(world, {kind:'personal',actorId:'jugador'}, 'jugador', {id:'lata',quantity:4});
  Inventory.deposit(world, {kind:'personal',actorId:'jugador'}, 'jugador', {id:'camiseta',quantity:1});
  assert.equal(Inventory.transfer(world,{kind:'personal',actorId:'jugador'},{kind:'furniture',id:'fridge1'},'jugador','camiseta').reason,'category');
  assert.equal(world.actors.jugador.personal.length,2);
  assert.equal(Inventory.transfer(world,{kind:'personal',actorId:'jugador'},{kind:'furniture',id:'fridge1'},'jugador','lata',2).ok,true);
  assert.equal(world.actors.jugador.personal[0].quantity,2);
  assert.equal(world.furniture.fridge1.items[0].quantity,2);
  assert.equal(Inventory.transfer(world,{kind:'personal',actorId:'jugador'},{kind:'furniture',id:'fridge1'},'jugador','lata',8).reason,'missing');
  assert.equal(world.furniture.fridge1.items[0].quantity,2);
  assert.equal(Inventory.deposit(world,{kind:'furniture',id:'arm1'},'jugador',{id:'lata',quantity:3}).ok,true);
  assert.equal(Inventory.deposit(world,{kind:'furniture',id:'arm1'},'jugador',{id:'lata',quantity:2}).ok,true);
  assert.equal(world.furniture.arm1.items[0].quantity,5);
});

test('inventarios independientes y guardado/restauración sin reiniciar por piso', () => {
  const world=scene();
  Inventory.addFurniture(world,'f1:arm1','armario',{items:[{id:'camiseta',quantity:1}]});
  Inventory.addFurniture(world,'f2:arm1','armario',{items:[{id:'lata',quantity:2}]});
  const save=Inventory.saveWorld(world);
  const restored=Inventory.restoreWorld(save);
  assert.notStrictEqual(restored,world);
  assert.deepEqual(restored.furniture['f2:arm1'].items,[{id:'lata',quantity:2}]);
  assert.deepEqual(restored.furniture['f1:arm1'].items,[{id:'camiseta',quantity:1}]);
  assert.equal(Inventory.resolve(restored,{kind:'furniture',id:'f2:arm1'},'npc').ok,true);
});

test('encimera modular tiene inventario de 6 espacios y restricciones editables', () => {
  const world = scene();
  assert.equal(Inventory.furnitureProfile('encimera_simple').slots, 6);
  assert.deepEqual(Inventory.furnitureProfile('encimera_simple').allowed,
    ['kitchen', 'food', 'hygiene', 'other']);
  assert.equal(Inventory.addFurniture(world, 'cocina:encimera-1', 'encimera_simple').ok, true);
  const ref = { kind: 'furniture', id: 'cocina:encimera-1' };
  assert.equal(Inventory.deposit(world, ref, 'jugador', { id: 'lata', quantity: 2 }).ok, true);
  assert.equal(Inventory.deposit(world, ref, 'jugador', { id: 'camiseta', quantity: 1 }).reason, 'category');
  assert.equal(world.furniture['cocina:encimera-1'].items[0].quantity, 2);
  assert.equal(Inventory.addFurniture(world, 'cocina:encimera-2', 'encimera_simple', {
    slots: 12, allowedCategories: ['food', 'clothing']
  }).ok, true);
  assert.equal(world.furniture['cocina:encimera-2'].slots, 12);
  assert.equal(Inventory.deposit(world, { kind: 'furniture', id: 'cocina:encimera-2' },
    'jugador', { id: 'camiseta', quantity: 1 }).ok, true);
  const saved = Inventory.restoreWorld(Inventory.saveWorld(world));
  assert.equal(saved.furniture['cocina:encimera-1'].items[0].quantity, 2);
  assert.equal(saved.furniture['cocina:encimera-2'].items[0].id, 'camiseta');
});
