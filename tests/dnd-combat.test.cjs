'use strict';
/* Etapa 3.4: DnD real, coordinación, persistencia y Sombras del motor compartido. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const combat=require('../juego/rules/dnd/fh-dnd-combat.js');
const saveAdapter=require('../juego/rules/dnd/fh-dnd-save-adapter.js');
const {create:coordinator}=require('../juego/core/fh-session-coordinator.js');
const {createRuntime:shadows}=require('../juego/assets/fh-shadow-ai.js');
const {create:dndEngine}=require('../juego/rules/dnd/fh-dnd-engine.js');
const persistence=require('../juego/core/fh-multimode-persistence.js');
const hook=require('../juego/core/fh-multimode-save-hook.js');
const root=path.resolve(__dirname,'..');
const id={mapId:'demo',characterId:'hero',rulesetId:'dnd',rulesetVersion:1,saveId:'principal'};
const memory=()=>{const data=new Map();return {
 data,getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)
};};

test('D20: acierto, fallo, bonificaciones, defensa, resistencia y daño acotado',()=>{
 const state=combat.initialState(),a=combat.combatant({hp:20,energy:6,
  attackBonus:2,damageBonus:1,damageDie:8}),
  b=combat.combatant({hp:5,energy:4,defense:12,resistance:3});
 const intent={rulesetId:'dnd',action:'attack',actionId:'a',
  actor:{kind:'player',id:'hero'},target:{kind:'creature',id:'shadow'},dice:{hit:10,damage:8}};
 const hit=combat.evaluate(intent,{actor:a,target:b},state);
 assert.equal(hit.total,12);assert.equal(hit.hit,true);assert.equal(hit.cost,0);
 assert.equal(hit.damage,5);assert.equal(hit.defeated,true);
 const miss=combat.evaluate({...intent,dice:{hit:9,damage:8}},{actor:a,target:b},state);
 assert.equal(miss.hit,false);assert.equal(miss.damage,0);assert.equal(miss.cost,0);
 const resisted=combat.evaluate({...intent,dice:{hit:10,damage:2}},
  {actor:a,target:{...b,resistance:100}},state);
 assert.equal(resisted.hit,true);assert.equal(resisted.damage,0);
});
test('D20: límites de dados, modificadores, coste e inputs maliciosos',()=>{
 assert.equal(combat.rollDie(20,()=>0),1);
 assert.equal(combat.rollDie(20,()=>.99999),20);
 for(const v of [-1,1,NaN,Infinity])assert.throws(()=>combat.rollDie(20,()=>v),/DND_RANDOM_INVALID/);
 for(const sides of [0,1,101,1.5])assert.throws(()=>combat.rollDie(sides,()=>0),/DND_DIE_INVALID/);
 assert.throws(()=>combat.combatant({hp:8,energy:1,defense:-1}),/DND_COMBATANT_INVALID/);
 const state=combat.initialState(),world={actor:state.player,target:combat.combatant({hp:8,energy:4})};
 const intent={rulesetId:'dnd',action:'attack',actionId:'b',
  actor:{kind:'player',id:'hero'},target:{kind:'creature',id:'enemy'},dice:{hit:21,damage:4}};
 assert.throws(()=>combat.evaluate(intent,world,state),/DND_DICE_OUT_OF_RANGE/);
 assert.throws(()=>combat.evaluate({...intent,dice:{hit:20,damage:0}},world,state),/DND_DICE_OUT_OF_RANGE/);
 const withoutEnergy=combat.evaluate({...intent,dice:{hit:20,damage:1}},
  {actor:{...world.actor,energy:0,energyCost:1},target:world.target},state);
 assert.equal(withoutEnergy.hit,true);
 assert.equal(withoutEnergy.cost,0,'los campos DnD v1 no condicionan ataques');
});
test('coordinador: efecto único, rechazos y revocación de sesión',()=>{
 const state=combat.initialState(),enemy=combat.combatant({hp:8,energy:4,defense:10});
 let writes=0,revision=0,rng=0;
 const port=coordinator().bindDndCombat({
  sessionId:'session',playerId:'hero',rulesAdapter:combat,
  readContext:()=>({sessionId:'session',playerId:'hero',rulesetId:'dnd',revision,
   minute:30,state}),readWorld:()=>({actor:state.player,target:enemy}),
  roll:s=>{rng++;return s;},apply:()=>{writes++;revision++;}
 });
 const action={sessionId:'session',rulesetId:'dnd',action:'attack',actionId:'once',
  revision:0,actor:{kind:'player',id:'hero'},target:{kind:'creature',id:'shadow'}};
 const cap={authorize:()=>true,execute:()=>null};
 const first=port.requestAttack(action,cap),replay=port.requestAttack(action,cap);
 assert.equal(first,replay);assert.equal(writes,1);assert.equal(rng,2);
 assert.throws(()=>port.requestAttack({...action,target:{kind:'creature',id:'other'}},cap),/DND_ACTION_CONFLICT/);
 assert.throws(()=>port.requestAttack({...action,actionId:'old'},cap),/DND_NOT_AUTHORIZED/);
 port.close();
 assert.throws(()=>port.requestAttack({...action,actionId:'closed'},cap),/DND_SESSION_CLOSED/);
});
test('guardado/restauración: estado DnD duradero sin recursos ni estadísticas Legacy',()=>{
 const storage=memory();
 const game=saveAdapter.initial({initialGameState:{character:{resources:{pg:99}},
  stats:{hit:100},skills:{repair:20},clock:{minutes:1320}}});
 assert.equal(game.character,undefined);assert.equal(game.stats,undefined);
 assert.equal(game.skills,undefined);assert.equal(game.clock.minutes,1320);
 game.dnd.player.hp=9;game.dnd.player.energy=3;
 game.dnd.actors.enemy=combat.combatant({hp:4,energy:3,defense:13});
 const one=persistence.create({role:'frame',identity:id,sessionId:'s1',adapter:saveAdapter,
  storage,send:()=>{}});
 const oldLegacy='fh_game_v1_legacy';
 storage.setItem(oldLegacy,'NO_TOCAR');
 const original=JSON.stringify(game);
 const write=one.write(game,{});
 assert.ok(write.json.includes('blakpine-multimode-save'));
 assert.equal(storage.getItem(oldLegacy),'NO_TOCAR');
 assert.equal(JSON.stringify(game),original);
 one.close();
 const two=persistence.create({role:'frame',identity:id,sessionId:'s2',adapter:saveAdapter,
  storage,send:()=>{}});
 const restored=two.restore({initialGameState:{}});
 assert.equal(restored.dnd.player.hp,9);assert.equal(restored.dnd.player.energy,3);
 assert.equal(restored.dnd.actors.enemy.defense,13);
 assert.equal(restored.stats,undefined);
 assert.equal(storage.getItem(oldLegacy),'NO_TOCAR');
 two.close();
});
test('no se aceptan sobres DnD corruptos ni claves de otros modos',()=>{
 const storage=memory(),frame=persistence.create({role:'frame',identity:id,
  sessionId:'s1',adapter:saveAdapter,storage,send:()=>{}});
 const game=saveAdapter.initial({initialGameState:{}});
 frame.write(game,{});
 const other={...id,rulesetId:'moon-system'};
 assert.throws(()=>persistence.create({role:'frame',identity:other,sessionId:'s1',
  adapter:saveAdapter,storage,send:()=>{}}),/SAVE_ADAPTER_UNAVAILABLE/);
 const raw=JSON.parse(storage.getItem(frame.key));raw.state.rules.data.player.hp=-4;
 storage.setItem(frame.key,JSON.stringify(raw));
 assert.throws(()=>frame.restore({initialGameState:{}}),/SAVE_STATE_INCOMPATIBLE/);
});
test('motor compartido real de Sombras: DnD acierta, no gasta energía v1 y conserva contacto',()=>{
 const state={nightSpawns:{firstNight:0,byKind:{la_nina:{lastSpawnNight:0}}}};
 const removed=[];
 const shadow=shadows({state,config:{baseChancePercent:100,dailyIncreasePercent:0,
  spawnDelayMin:0,spawnDelayMax:0,spawnMinDistance:.35,spawnMaxDistance:.35,
  altoSpawnFt:1,detectFt:10,touchFt:10,attackCooldown:1,maxActors:1},
  spawn:(kind,f,x,z,id)=>id,move:()=>true,despawn:id=>removed.push(id),
  canWalk:()=>true,insideAt:()=>true,route:(from,to)=>[to],
  random:()=>.1,chooseAttack:()=> 'normal'});
 const game={dnd:combat.initialState()};let minute=1320,x=20,writes=0;
 const session=dndEngine({shadowRuntime:shadow,gameState:game,identity:id,sessionId:'real',
  readPlayer:()=>({floor:0,x,z:20,pg:20,pgMax:20,sp:20,spMax:20}),
  readMinute:()=>minute,save:()=>writes++,notice:()=>{},random:()=>.99,document:null});
 session.tick(0);
 assert.equal(shadow.read().active.length,1);
 minute=1321;x=20.07;session.tick(.016);
 const actor=shadow.read().active[0];
 assert.ok(game.dnd.revision>=1,'ataque de Sombras se enruta por DnD');
 assert.equal(game.dnd.actors[actor.id].energy,4,'sin coste de energía para la Sombra DnD');
 assert.equal(shadow.read().active[0].pe,6,'PE Legacy de la Sombra no se gasta por DnD');
 const previousWrites=writes;
 const attack=session.attack(actor.id);
 assert.equal(attack.hit,true);
 assert.equal(attack.damage,4);
 assert.equal(game.dnd.actors[actor.id].hp,4);
 assert.equal(game.dnd.player.energy,6,'sin gasto de energía DnD');
 assert.equal(writes,previousWrites+1);
 minute=1323;
 const finish=session.attack(actor.id);
 assert.equal(finish.defeated,true);
 assert.equal(finish.cost,0);
 assert.equal(game.dnd.player.energy,6);
 assert.equal(writes,previousWrites+2);
 assert.equal(shadow.read().active.length,0);
 assert.ok(removed.includes(actor.id),'el motor elimina al actor derrotado');
 const hp=game.dnd.player.hp;
 session.close();session.tick(0);
 assert.equal(game.dnd.player.hp,hp);
});
test('integración: el hook de guardado instala combate DnD sobre el motor REAL ensamblado',()=>{
 const {html}=require('./helpers/forest-engine.cjs')();
 const patched=hook.patch(html,'https://example.test/');
 assert.match(patched,/const fhLegacySession=DATA.__multimodeSave\?\.identity.rulesetId==='dnd'\?/);
 assert.match(patched,/window\.FHDndEngine\.create/);
 assert.match(patched,/window\.FHLegacyEngineSession\.create/);
 assert.match(patched,/fhLegacySession\.tick\(dt\)/);
 assert.match(patched,/window\.FHMultimodePersistence\.create/);
 assert.match(patched,/rules\/dnd\/fh-dnd-engine\.js/);
 assert.match(patched,/if\(fhMultimode\?\.identity.rulesetId==='dnd'\)GameState.dnd/);
 assert.throws(()=>hook.patch(patched,'https://example.test/'),/SAVE_ENGINE_HOOK_MISMATCH/);
});
test('contratos y selector: DnD únicamente; las habilidades generales permanecen iguales',()=>{
 const read=p=>fs.readFileSync(path.join(root,p),'utf8');
 const dnd=JSON.parse(read('contratos/multimodo/ejemplos/reglas/dnd.json'));
 const legacy=JSON.parse(read('contratos/multimodo/ejemplos/reglas/legacy.json'));
 const moon=JSON.parse(read('contratos/multimodo/ejemplos/reglas/moon-system.json'));
 assert.equal(dnd.status,'implemented');
 assert.equal(legacy.status,'planned');assert.equal(moon.status,'planned');
 const selector=read('juego/assets/fh-multimode-selector.js'),index=read('index.html');
 assert.match(selector,/registry\.register\(\{adapter:globalThis\.FHDndCombat,start:launchDndWorld\}\)/);
 assert.match(index,/launchDndWorld:\(prepared,mode\)=>/);
 assert.match(index,/FHMultimodeSaveAdapters=Object\.freeze\(\{dnd:/);
 assert.match(index,/FHMultimodeCombatAdapters=Object\.freeze\(\{dnd:/);
 const skills=read('juego/assets/fh-skills.js');
 assert.ok(skills.length>1000);
});
