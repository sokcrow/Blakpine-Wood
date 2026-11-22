'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const fromRoot=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const map=JSON.parse(fromRoot('forest-horror/maps/DEMO_DnD_Iluminacion.json'));
const world=JSON.parse(fromRoot('contratos/multimodo/ejemplos/mundos/villa-medieval.json'));
const selector=require('../juego/assets/fh-multimode-selector.js');
const combat=require('../juego/rules/dnd/fh-dnd-combat.js');
const sheet=require('../juego/rules/dnd/fh-dnd-engine.js');
const save=require('../juego/rules/dnd/fh-dnd-save-adapter.js');
const lights=require('../juego/assets/fh-medieval-lighting.js');

test('El mapa es válido para ForestShared.validate del editor real',()=>{
 const html=fromRoot('index.html');
 const start=html.indexOf('const ForestShared=(()=>{');
 const end=html.indexOf('})();',html.indexOf('return {DOOR_VARIANTS',start));
 assert.ok(start>=0&&end>start);
 const source=html.slice(start,end+5)+'\\nForestShared';
 const shared=vm.runInNewContext(source);
 const result=shared.validate(map);
 assert.equal(result.ok,true,JSON.stringify(result.errors));
});

test('La villa medieval declara y permite cargar un mapa real v1',()=>{
 assert.equal(world.map?.schema,'forest-horror-map-v1');
 assert.equal(world.map.path,'forest-horror/maps/DEMO_DnD_Iluminacion.json');
 assert.equal(selector.resources[world.map.path],'map');
 assert.equal(map.schema,'forest-horror-map-v1');
 assert.ok(map.createdAt);
 assert.equal(map.floors.length,1);
 assert.ok(map.floors[0].items.some(i=>i.type==='spawn'));
 assert.ok(map.floors[0].items.some(i=>i.type==='training_dummy'));
 assert.ok(map.floors[0].items.some(i=>i.type==='door'));
 assert.ok(map.floors[0].items.some(i=>i.type==='wall'));
});

test('Las nueve luminarias usan GLB existentes, IDs únicos y presets reales',()=>{
 const items=map.floors[0].items,fixtures=items.filter(i=>i.type==='light_fixture');
 assert.equal(fixtures.length,9);
 assert.equal(new Set(items.map(i=>i.id)).size,items.length);
 assert.equal(new Set(fixtures.map(i=>i.lightKind)).size,9);
 for(const item of fixtures){
  const preset=lights.preset(item.lightKind);
  assert.ok(preset,item.id);
  assert.equal(item.modelId,preset.modelId);
  assert.equal(item.lightRadiusFt,preset.radiusFt);
  assert.equal(item.lightDimFalloffFt,preset.dimFt);
  assert.equal(item.lightFuelMinutes,preset.fuelMinutes);
  assert.equal(item.interact?.verb,'use');
  assert.ok(item.w>0&&item.h>0);
 }
});

test('La partida DnD arranca sin energía eléctrica y el combustible usa el inventario real',()=>{
 const state=save.initial(map);
 const initial=state.inventory.length;
 let minute=100;
 const runtime=lights.createRuntime({floors:map.floors,state,clock:()=>minute});
 const wall=map.floors[0].items.find(i=>i.lightKind==='torch_wall');
 const crystal=map.floors[0].items.find(i=>i.lightKind==='magic_crystal');
 assert.equal(state.flags.power_global,false);
 assert.equal(runtime.lit(0,wall),true);
 assert.equal(runtime.lit(0,crystal),true);
 runtime.tick();minute+=60;runtime.tick();
 assert.equal(runtime.view(wall.id).remaining,0);
 assert.equal(runtime.lit(0,wall),false);
 assert.equal(runtime.lit(0,crystal),true);
 assert.equal(runtime.interact(0,wall).action,'refueled');
 assert.equal(state.inventory.length,initial-1);
 assert.equal(runtime.lit(0,wall),true);
});

test('La ficha del personaje lee DnD y persiste separada de Legacy',()=>{
 const state=save.initial(map);
 const initial=combat.initialState();
 assert.deepEqual(state.dnd,initial);
 const stats=sheet.readStats(state.dnd.player);
 assert.deepEqual({pg:stats.pg,pe:stats.pe,hitDie:stats.hitDie,defense:stats.defense},
  {pg:combat.defaults.playerHp,pe:combat.defaults.playerEnergy,hitDie:20,defense:combat.defaults.defense});
 assert.equal(Object.hasOwn(state,'character'),false);
 state.dnd.player.hp-=3;
 assert.equal(sheet.readStats(state.dnd.player).pg,initial.player.hp-3);
 const runtime=lights.createRuntime({floors:map.floors,state,clock:()=>100});
 const torch=map.floors[0].items.find(i=>i.lightKind==='torch_hand');
 runtime.interact(0,torch);
 const saved=save.capture(state);
 assert.equal(saved.rules.rulesetId,'dnd');
 assert.equal(saved.rules.data.player.hp,combat.defaults.playerHp-3);
 assert.equal(saved.world.runtime.medievalLighting[torch.id].carried,true);
 assert.equal(Object.hasOwn(saved.world.runtime,'character'),false);
 const restored=save.restore(saved.world,saved.rules.data,map);
 assert.equal(restored.dnd.player.hp,combat.defaults.playerHp-3);
 assert.equal(restored.medievalLighting[torch.id].carried,true);
});
