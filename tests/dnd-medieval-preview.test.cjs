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
const sheetCore=require('../juego/rules/dnd/fh-dnd-sheet.js');
const manager=require('../juego/assets/fh-dnd-character-manager.js');
const sheet=require('../juego/rules/dnd/fh-dnd-engine.js');
const save=require('../juego/rules/dnd/fh-dnd-save-adapter.js');
const lights=require('../juego/assets/fh-medieval-lighting.js');

test('El mapa es válido para ForestShared.validate del editor real',()=>{
 const html=fromRoot('index.html');
 const start=html.indexOf('const ForestShared=(()=>{');
 const end=html.indexOf('})();',html.indexOf('return {DOOR_VARIANTS',start));
 assert.ok(start>=0&&end>start);
 const source=html.slice(start,end+5)+'\nForestShared';
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

function wizard(){
 return sheetCore.createCharacter({
  name:'Ada',classId:'wizard',level:1,backgroundId:'sage',speciesId:'human',
  abilities:{str:8,dex:14,con:12,int:17,wis:13,cha:10},
  hp:7,maxHp:7,armorClass:12,
  saveProficiencies:['int','wis'],skillProficiencies:['arcana','history'],
  hitDice:{sides:6,total:1,available:1},
  attacks:[{id:'dagger',name:'Daga',ability:'dex',damageCount:1,damageDie:4,
   damageType:'piercing',rangeFt:5,proficient:true}],
  spellcasting:{ability:'int',slots:{1:2}}
 });
}
test('La partida recibe la ficha elegida: maga con ataques y salvaciones DnD, sin PE',()=>{
 const character=wizard(),selected={...map,__dndCharacter:{id:'dnd_ada12345',sheet:character}};
 const state=save.initial(selected),initial=combat.initialState(character);
 assert.deepEqual(state.dnd,initial);
 const stats=sheet.readStats(state.dnd.player);
 assert.equal(stats.name,'Ada');assert.equal(stats.classId,'wizard');
 assert.equal(stats.hp,7);assert.equal(stats.armorClass,12);
 assert.equal(stats.abilities.int.score,17);assert.equal(stats.saves.int,5);
 assert.equal(stats.skills.arcana,5);assert.equal(Object.keys(stats.skills).length,18);
 assert.equal(Object.keys(stats.saves).length,6);assert.equal(stats.attacks[0].attackBonus,4);
 assert.equal(Object.hasOwn(state,'character'),false);
 assert.equal(Object.hasOwn(state.dnd.player,'energy'),false);
 assert.equal(state.dnd.player.spellcasting.slots[1],2);
 state.dnd.player.hp-=3;
 assert.equal(sheet.readStats(state.dnd.player).hp,4);
 const runtime=lights.createRuntime({floors:map.floors,state,clock:()=>100});
 const torch=map.floors[0].items.find(i=>i.lightKind==='torch_hand');
 runtime.interact(0,torch);
 const saved=save.capture(state);
 assert.equal(saved.rules.rulesetId,'dnd');
 assert.equal(saved.rules.data.player.hp,4);
 assert.equal(saved.world.runtime.medievalLighting[torch.id].carried,true);
 assert.equal(Object.hasOwn(saved.world.runtime,'character'),false);
 assert.equal(Object.hasOwn(saved.rules.data.player,'energy'),false);
 const restored=save.restore(saved.world,saved.rules.data,selected);
 assert.equal(restored.dnd.player.hp,4);
 assert.equal(restored.dnd.player.classId,'wizard');
 assert.equal(restored.medievalLighting[torch.id].carried,true);
});
test('Biblioteca DnD permite varios personajes sin tocar perfiles Legacy',()=>{
 const values=new Map([['blakpine_character_active_v1','legacy_untouched']]);
 const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 const lib=manager.registry(storage);
 const first=lib.upsert({name:'Ada',character:wizard()});
 const rogue=sheetCore.createCharacter({name:'Bram',classId:'rogue',level:1,
  abilities:{str:10,dex:17,con:12,int:12,wis:12,cha:10},hp:9,armorClass:14,
  saveProficiencies:['dex','int'],skillProficiencies:['stealth','acrobatics'],
  hitDice:{sides:8,total:1,available:1},
  attacks:[{id:'rapier',name:'Estoque',ability:'dex',damageCount:1,
   damageDie:8,damageType:'piercing',rangeFt:5,proficient:true}]});
 const second=lib.upsert({name:'Bram',character:rogue});
 assert.notEqual(first.id,second.id);assert.equal(lib.list().length,2);
 assert.equal(lib.current().name,'Bram');
 assert.equal(lib.select(first.id).sheet.classId,'wizard');
 assert.equal(lib.select(second.id).sheet.classId,'rogue');
 assert.equal(values.get('blakpine_character_active_v1'),'legacy_untouched');
});
