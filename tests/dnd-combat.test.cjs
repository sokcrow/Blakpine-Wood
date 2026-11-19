'use strict';
/* DnD prototipo: entrenamiento neutral, coordinación y persistencia sin Sombras. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const combat=require('../juego/rules/dnd/fh-dnd-combat.js');
const saveAdapter=require('../juego/rules/dnd/fh-dnd-save-adapter.js');
const {create:coordinator}=require('../juego/core/fh-session-coordinator.js');
const dummy=require('../juego/units/fh-training-dummy.js');
const targetPort=require('../juego/core/fh-combat-target-port.js');
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
 assert.equal(combat.defaults.playerAttackCooldownMinutes,undefined,'sin cooldown artificial');
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
test('DnD v1 restaura sin Sombras y no guarda horror aunque exista en estado anterior',()=>{
 const game=saveAdapter.initial({initialGameState:{clock:{minutes:70},horror:{nightSpawns:{firstNight:1}},
  character:{resources:{pg:80}},skills:{sigilo:3}}});
 assert.equal(game.horror,undefined);
 const fromV1={runtime:{clock:{minutes:85},horror:{nightSpawns:{byKind:{la_nina:{}}}}}};
 assert.equal(saveAdapter.validateWorldState(fromV1),true,'lectura compatible con v1');
 const rulesV1=combat.initialState();
 rulesV1.actors['fh-shadow-1']=combat.combatant({hp:7,energy:4});
 rulesV1.actors['other-v1']=combat.combatant({hp:3,energy:4});
 const restored=saveAdapter.restore(fromV1,rulesV1,{initialGameState:{}});
 assert.equal(restored.horror,undefined,'sin Sombras en el estado DnD activo');
 assert.equal(restored.clock.minutes,85);
 assert.equal(restored.dnd.actors['fh-shadow-1'],undefined);
 assert.equal(restored.dnd.actors['other-v1'].hp,3,'preservar otros datos v1');
 restored.horror={active:[{id:'sombra'}]};
 const captured=saveAdapter.capture(restored);
 assert.equal(captured.world.runtime.horror,undefined);
 assert.equal(captured.rules.data.actors['fh-shadow-1'],undefined);
 assert.equal(rulesV1.actors['fh-shadow-1'].hp,7,'no mutar guardado anterior');
 assert.equal(restored.horror.active.length,1,'capture no muta la entrada');
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
function trainingScene(){
 class Node {
  constructor(){this.children=[];this.rotation={};this.position={set:(x,y,z)=>{this.xyz=[x,y,z]}};}
  add(value){this.children.push(value);}
 }
 class Mesh extends Node{constructor(g,m){super();this.geometry=g;this.material=m;}}
 class Data{constructor(x){this.value=x;}}
 const THREE={Group:Node,Mesh,MeshLambertMaterial:Data,BoxGeometry:Data,
  CylinderGeometry:Data,TorusGeometry:Data,SphereGeometry:Data};
 const project={floors:[{items:[{type:'training_dummy',id:'dummy-1',x:2,y:2}]}]};
 const runtime=dummy.createRuntime({project,THREE,stories:[new Node()],
  floorElev:[0],cell:1.524,rulesetId:'dnd'});
 const physics={contact:true,visible:true};
 const port=targetPort.create({readRuntime:()=>runtime,maxDistanceMeters:1.524,
  canContact:()=>physics.contact,canSee:()=>physics.visible});
 return {runtime,port,physics};
}
function trainingEngine({random=()=>.99}={}){
 const scene=trainingScene(),game=saveAdapter.initial({initialGameState:{
  clock:{minutes:1320},horror:{nightSpawns:{firstNight:1}},stats:{hit:99}}});
 const actor={floor:0,x:3.1,z:3.048};let writes=0;
 const session=dndEngine({targetPort:scene.port,gameState:game,identity:id,sessionId:'train',
  readPlayer:()=>actor,readMinute:()=>1320,save:()=>writes++,notice:()=>{},
  random,document:null});
 return {...scene,game,actor,session,get writes(){return writes;}};
}
test('DnD → coordinador → Training Dummy: impacto D20, daño nominal y PG intactos',()=>{
 const t=trainingEngine();
 assert.equal(t.port.read('dummy-1').type,'training_dummy');
 const attack=t.session.attack('dummy-1');
 assert.equal(attack.hit,true);
 assert.equal(attack.roll,20);assert.equal(attack.damageRoll,4);
 assert.equal(attack.damage,4);assert.equal(attack.defeated,false);
 assert.equal(attack.cost,0);assert.equal(t.game.dnd.player.energy,6);
 assert.equal(t.runtime.get('dummy-1').hitsReceived,1);
 assert.equal(t.runtime.get('dummy-1').lastIncomingDamage,4);
 assert.equal(t.runtime.get('dummy-1').hp,1);
 assert.equal(t.runtime.get('dummy-1').maxHp,1);
 assert.equal(t.runtime.get('dummy-1').indestructible,true);
 assert.equal(t.writes,1);
 assert.equal(t.game.horror,undefined,'no crear estado de Sombras con guardado DnD');
 t.session.close();
});
test('DnD falla D20 contra Dummy sin aplicar impacto ni reducir PG',()=>{
 const t=trainingEngine({random:()=>0});
 const result=t.session.attack('dummy-1');
 assert.equal(result.roll,1);assert.equal(result.hit,false);
 assert.equal(result.damage,0);assert.equal(result.defeated,false);
 assert.equal(t.runtime.get('dummy-1').hp,1);
 assert.equal(t.runtime.get('dummy-1').hitsReceived,0);
 assert.equal(t.writes,1);
 t.session.close();
});
test('fuera de alcance, contacto bloqueado y falta de visibilidad impiden lanzar dados',()=>{
 let rolls=0;
 const t=trainingEngine({random:()=>{rolls++;return .99;}});
 t.actor.x=80;
 assert.equal(t.session.attack('dummy-1'),null);
 t.actor.x=3.1;t.physics.contact=false;
 assert.equal(t.session.attack('dummy-1'),null);
 t.physics.contact=true;t.physics.visible=false;
 assert.equal(t.session.attack('dummy-1'),null);
 t.physics.visible=true;
 assert.equal(t.session.attack('inexistente'),null);
 assert.equal(rolls,0);assert.equal(t.writes,0);
 assert.equal(t.runtime.get('dummy-1').hitsReceived,0);
 t.session.close();
});
test('DnD mantiene Dummy indestructible tras impactos repetidos y ningún monstruo prestado',()=>{
 const t=trainingEngine();
 for(let i=0;i<30;i++){
  const result=t.session.attack();
  assert.equal(result.hit,true);assert.equal(result.defeated,false);
 }
 assert.equal(t.runtime.get('dummy-1').hp,1);
 assert.equal(t.runtime.get('dummy-1').alive,true);
 assert.equal(t.runtime.get('dummy-1').hitsReceived,30);
 assert.equal(t.game.dnd.actors['dummy-1'],undefined);
 assert.deepEqual(t.game.dnd.actors,{});
 assert.equal(t.game.dnd.player.energy,6);
 assert.equal(t.writes,30);
 t.session.close();
});
test('HUD DnD permite seleccionar Dummy y atacar mediante botón sin usar Sombras',()=>{
 const t=trainingScene(),game={dnd:combat.initialState()};
 const elements=[];
 function element(tag){
  const e={tagName:tag.toUpperCase(),style:{},value:'',disabled:false,textContent:'',
   children:[],listeners:{},setAttribute(){},append(...kids){this.children.push(...kids)},
   replaceChildren(...kids){this.children=kids;this.value=kids[0]?.value||'';},
   addEventListener(type,fn){this.listeners[type]=fn;},remove(){}};
  elements.push(e);return e;
 }
 const doc={body:{append(){}},createElement:element,addEventListener(){},
  removeEventListener(){}};
 const session=dndEngine({targetPort:t.port,gameState:game,identity:id,sessionId:'hud',
  readPlayer:()=>({floor:0,x:3.1,z:3.048}),readMinute:()=>1320,
  save:()=>{},notice:()=>{},random:()=>.99,document:doc});
 const select=elements.find(e=>e.tagName==='SELECT'),button=elements.find(e=>e.tagName==='BUTTON');
 assert.equal(select.value,'dummy-1');
 assert.equal(select.children.length,1);
 button.listeners.click();
 assert.equal(t.runtime.get('dummy-1').hitsReceived,1);
 assert.equal(t.runtime.get('dummy-1').hp,1);
 session.close();
});
test('coordinador registra una sola vez impacto de Dummy con actionId repetido',()=>{
 const t=trainingScene(),state=combat.initialState();let revision=0,rolls=0;
 const coordinatorPort=coordinator().bindDndCombat({
  sessionId:'dedup',playerId:'hero',rulesAdapter:combat,
  readContext:()=>({sessionId:'dedup',playerId:'hero',rulesetId:'dnd',revision,minute:50,state}),
  readWorld:()=>({actor:state.player,target:{type:'training_dummy',hp:1,maxHp:1,defense:10,resistance:0}}),
  roll:s=>{rolls++;return s;},
  apply:(result,intent)=>{t.port.receiveHit(intent.target.id,result);revision++;}
 });
 const intent={sessionId:'dedup',rulesetId:'dnd',action:'attack',actionId:'same',
  revision:0,actor:{kind:'player',id:'hero'},target:{kind:'training_dummy',id:'dummy-1'}};
 const cap={authorize:()=>true,execute:()=>null};
 const first=coordinatorPort.requestAttack(intent,cap),again=coordinatorPort.requestAttack(intent,cap);
 assert.equal(first,again);assert.equal(rolls,2);
 assert.equal(t.runtime.get('dummy-1').hitsReceived,1);
 assert.equal(t.runtime.get('dummy-1').hp,1);
 coordinatorPort.close();
});
test('prototipo de DnD calcula daño sin capar por el 1 PG del Dummy',()=>{
 const state=combat.initialState(),attacker=combat.combatant({hp:20,energy:6,attackBonus:3,
  damageBonus:2,damageDie:8});
 const target={type:'training_dummy',hp:1,maxHp:1,defense:15,resistance:1};
 const result=combat.evaluate({rulesetId:'dnd',action:'attack',actionId:'dmg',
  actor:{kind:'player',id:'hero'},target:{kind:'training_dummy',id:'dummy-1'},
  dice:{hit:12,damage:8}},{actor:attacker,target},state);
 assert.equal(result.hit,true);assert.equal(result.total,15);
 assert.equal(result.damage,9,'8 + 2 - 1; no capar por la vida 1 del Dummy');
 assert.equal(result.defeated,false);
});
test('DnD rechaza Sombras y objetivos ajenos incluso con API aparente',()=>{
 const t=trainingScene();
 assert.equal(t.port.read('shadow-1'),null);
 assert.equal(t.port.canAttack('shadow-1',{floor:0,x:3,z:3}),false);
 assert.throws(()=>dndEngine({shadowRuntime:{read(){return {active:[{id:'shadow-1'}]}}},
  gameState:{dnd:combat.initialState()},identity:id,sessionId:'invalid',
  readPlayer:()=>({floor:0,x:3,z:3}),readMinute:()=>0,save:()=>{},notice:()=>{}}),
  /DND_ENGINE_INVALID/);
});
test('integración: el hook de guardado instala combate DnD sobre el motor REAL ensamblado',()=>{
 const {html}=require('./helpers/forest-engine.cjs')();
 const patched=hook.patch(html,'https://example.test/');
 assert.match(patched,/const fhLegacySession=DATA.__multimodeSave\?\.identity.rulesetId==='dnd'\?/);
 assert.match(patched,/window\.FHDndEngine\.create/);
 assert.match(patched,/FHCombatTargetPort\.create/);
 assert.match(patched,/fhWorldClearTrainingLine/);
 assert.match(patched,/FHShadowAI\?\.createRuntime/);
 assert.match(patched,/targetPort:fhDndTargetPort,gameState:GameState/);
 assert.match(patched,/identity.rulesetId==='dnd'\?null:window.FHShadowAI/);
 assert.match(patched,/window\.FHLegacyEngineSession\.create/);
 assert.match(patched,/fhLegacySession\.tick\(dt\)/);
 assert.match(patched,/window\.FHMultimodePersistence\.create/);
 assert.match(patched,/rules\/dnd\/fh-dnd-engine\.js/);
 assert.match(patched,/core\/fh-combat-target-port\.js/);
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
