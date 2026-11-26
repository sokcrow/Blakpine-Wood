'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const sheet=require('../juego/rules/dnd/fh-dnd-sheet.js');
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

test('Ficha SRD 5.2.1: seis características, PG, CA, salvaciones, 18 habilidades; SIN PE',()=>{
 const player=sheet.createPilot(),s=sheet.overview(player);
 assert.equal(combat.validState(combat.initialState()),true);
 assert.equal(combat.initialState().player.classId,'unassigned','no hay clase predeterminada');
 assert.equal(player.classId,'fighter');assert.equal(player.level,1);
 assert.deepEqual(player.abilities,{str:17,dex:14,con:14,int:8,wis:10,cha:12});
 assert.equal(player.hp,12);assert.equal(s.armorClass,17);
 assert.equal(s.proficiency,2);assert.equal(s.initiative,2);assert.equal(s.speedFt,30);
 assert.equal(Object.keys(s.saves).length,6);assert.equal(Object.keys(s.skills).length,18);
 assert.equal(s.saves.str,5);assert.equal(s.saves.con,4);assert.equal(s.saves.dex,2);
 assert.equal(s.skills.athletics,5);assert.equal(s.skills.perception,2);
 assert.equal(s.passivePerception,12);
 assert.equal(s.attacks[0].attackBonus,5);assert.equal(s.attacks[0].damageDie,8);
 for(const key of ['pe','energy','energyCost','maxEnergy'])assert.equal(Object.hasOwn(player,key),false);
 assert.equal(player.spellcasting,null);assert.equal(player.features.secondWind.current,2);
 assert.equal(player.skillProficiencies.length,8);
 assert.equal(player.features.humanOriginFeat,'skilled');
 assert.equal(player.features.humanSkillful,'medicine');
 assert.equal(player.languages.length,3);
});

test('d20: competencias, pruebas, salvaciones, 1/20 no son autofallo/autoéxito fuera del ataque',()=>{
 const player=sheet.createPilot();
 const save=sheet.testD20(player,'save','str',{dc:5,random:()=>0});
 assert.equal(save.roll,1);assert.equal(save.modifier,5);assert.equal(save.success,true);
 const failure=sheet.testD20(player,'skill','arcana',{dc:30,random:()=>.999});
 assert.equal(failure.roll,20);assert.equal(failure.modifier,-1);assert.equal(failure.success,false);
 const advantage=sheet.testD20(player,'skill','perception',{dc:12,advantage:true,
  random:(()=>{let i=0;return ()=>i++?.85:.05})()});
 assert.deepEqual(advantage.dice,[2,18]);assert.equal(advantage.roll,18);
 const both=sheet.testD20(player,'save','dex',{dc:10,advantage:true,disadvantage:true,random:()=>.1});
 assert.equal(both.dice.length,1);
 assert.throws(()=>sheet.testD20(player,'save','str',{dc:0}),/DND_DC_INVALID/);
});

test('D&D ataque: contra CA, 1 siempre falla, 20 siempre acierta y duplica dados',()=>{
 const state=combat.initialState(sheet.createPilot()),actor=state.player;
 const enemy=combat.combatant({hp:50,armorClass:19});
 const intent={rulesetId:'dnd',action:'attack',actionId:'uno',
  actor:{kind:'player',id:'hero'},target:{kind:'creature',id:'enemy'}};
 const world={actor,target:enemy};
 const result=dice=>combat.evaluate({...intent,dice},world,state);
 assert.equal(result({hit:13,damage:[5],criticalDamage:[]}).hit,false); // 13+5 < 19
 assert.equal(result({hit:1,damage:[8],criticalDamage:[]}).hit,false);
 const crit=result({hit:20,damage:[8],criticalDamage:[7]});
 assert.equal(crit.hit,true);assert.equal(crit.critical,true);assert.equal(crit.damage,18);
 assert.equal(crit.total,25);assert.equal(crit.armorClass,19);
 assert.equal(Object.hasOwn(crit,'cost'),false);
 assert.throws(()=>result({hit:21,damage:[8],criticalDamage:[]}),/DND_DICE_OUT_OF_RANGE/);
 assert.throws(()=>result({hit:20,damage:[8],criticalDamage:[]}),/DND_DICE_OUT_OF_RANGE/);
});

test('Daño D&D: resistencia divide entre dos, vulnerabilidad duplica, inmunidad anula',()=>{
 const state=combat.initialState(sheet.createPilot());
 const intent={rulesetId:'dnd',action:'attack',actionId:'damage',
  actor:{kind:'player',id:'hero'},target:{kind:'creature',id:'enemy'},
  dice:{hit:15,damage:[8],criticalDamage:[]}};
 const target=opts=>combat.combatant({hp:50,armorClass:10,...opts});
 const hit=t=>combat.evaluate(intent,{actor:state.player,target:t},state);
 assert.equal(hit(target({})).damage,11);
 assert.equal(hit(target({resistances:['bludgeoning']})).damage,5);
 assert.equal(hit(target({vulnerabilities:['bludgeoning']})).damage,22);
 assert.equal(hit(target({immunities:['bludgeoning']})).damage,0);
 assert.throws(()=>combat.combatant({hp:8,armorClass:-1}),/DND_COMBATANT_INVALID/);
});

test('Coordinador: una aplicación por acción, protección contra repetición y sesión cerrada',()=>{
 const state=combat.initialState(sheet.createPilot()),enemy=combat.combatant({hp:35,armorClass:10});
 let writes=0,revision=0,rolls=0;
 const port=coordinator().bindDndCombat({sessionId:'session',playerId:'hero',rulesAdapter:combat,
  readContext:()=>({sessionId:'session',playerId:'hero',rulesetId:'dnd',revision,minute:30,state}),
  readWorld:()=>({actor:state.player,target:enemy}),roll:sides=>{rolls++;return Math.min(sides,10);},
  apply:()=>{writes++;revision++;}
 });
 const intent={sessionId:'session',rulesetId:'dnd',action:'attack',actionId:'once',
  revision:0,actor:{kind:'player',id:'hero'},target:{kind:'creature',id:'enemy'}};
 const cap={authorize:()=>true,execute:()=>null};
 const first=port.requestAttack(intent,cap);
 assert.equal(port.requestAttack(intent,cap),first);
 assert.equal(rolls,2);assert.equal(writes,1);
 assert.throws(()=>port.requestAttack({...intent,target:{kind:'creature',id:'other'}},cap),/DND_ACTION_CONFLICT/);
 assert.throws(()=>port.requestAttack({...intent,actionId:'old'},cap),/DND_NOT_AUTHORIZED/);
 port.close();
 assert.throws(()=>port.requestAttack({...intent,actionId:'closed'},cap),/DND_SESSION_CLOSED/);
});

test('Guardado/restauración: la ficha D&D sobrevive sin personaje/scores ni PE Legacy',()=>{
 const storage=memory(),game=saveAdapter.initial({__dndCharacter:{
  id:'hero',sheet:sheet.createPilot()},initialGameState:{
  character:{resources:{pg:99,pe:99}},stats:{hit:100},skills:{repair:20},clock:{minutes:1320}}});
 assert.equal(game.character,undefined);assert.equal(game.stats,undefined);assert.equal(game.skills,undefined);
 game.dnd.player.hp=9;game.dnd.actors.enemy=combat.combatant({hp:4,armorClass:13});
 const first=persistence.create({role:'frame',identity:id,sessionId:'s1',adapter:saveAdapter,storage,send:()=>{}});
 storage.setItem('fh_game_v1_legacy','NO_TOCAR');
 first.write(game,{});first.close();
 const second=persistence.create({role:'frame',identity:id,sessionId:'s2',adapter:saveAdapter,storage,send:()=>{}});
 const restored=second.restore({initialGameState:{}});
 assert.equal(restored.dnd.player.hp,9);assert.equal(restored.dnd.actors.enemy.armorClass,13);
 assert.equal(restored.dnd.player.energy,undefined);
 assert.equal(storage.getItem('fh_game_v1_legacy'),'NO_TOCAR');
 second.close();
});

test('Migración segura: antiguos guardados con PE se limpian y Sombras se descartan',()=>{
 const old={revision:2,actionSequence:3,lastPlayerMinute:9,
  player:{hp:19,maxHp:20,energy:6,maxEnergy:6},actors:{
   'fh-shadow-1':{hp:7,maxHp:8,energy:4},
   'enemy-1':{hp:3,maxHp:6,defense:13,damageDie:6}
  }};
 assert.equal(saveAdapter.validateRulesetState(old),true);
 const cleaned=saveAdapter.restore({runtime:{clock:{minutes:85},horror:{active:true}}},old,
  {initialGameState:{},__dndCharacter:{id:'hero',sheet:sheet.createPilot()}});
 assert.equal(cleaned.horror,undefined);
 assert.equal(cleaned.dnd.player.hp,12); // No importar la vida ficticia 20/20.
 assert.equal(cleaned.dnd.player.energy,undefined);
 assert.equal(cleaned.dnd.actors['fh-shadow-1'],undefined);
 assert.equal(cleaned.dnd.actors['enemy-1'].armorClass,13);
 assert.equal(saveAdapter.capture(cleaned).rules.data.player.energy,undefined);
});

test('Sobre corrupto se rechaza antes de escribir y Moon usa un adaptador distinto',()=>{
 const storage=memory(),frame=persistence.create({role:'frame',identity:id,
  sessionId:'s1',adapter:saveAdapter,storage,send:()=>{}});
 const game=saveAdapter.initial({initialGameState:{}});
 frame.write(game,{});
 assert.throws(()=>persistence.create({role:'frame',identity:{...id,rulesetId:'moon-system'},
  sessionId:'s1',adapter:saveAdapter,storage,send:()=>{}}),/SAVE_ADAPTER_UNAVAILABLE/);
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
 const scene=trainingScene(),game=saveAdapter.initial({__dndCharacter:{
  id:'hero',sheet:sheet.createPilot()},initialGameState:{
  clock:{minutes:1320},horror:{nightSpawns:{firstNight:1}},stats:{hit:99}}});
 const actor={floor:0,x:3.1,z:3.048};let writes=0;
 const session=dndEngine({targetPort:scene.port,gameState:game,identity:id,sessionId:'train',
  readPlayer:()=>actor,readMinute:()=>1320,save:()=>writes++,notice:()=>{},
  random,document:null});
 return {...scene,game,actor,session,get writes(){return writes;}};
}

test('DnD → coordinador → Dummy: tirada y crítico con PG del blanco intactos',()=>{
 const t=trainingEngine();
 const result=t.session.attack('dummy-1');
 assert.equal(result.hit,true);assert.equal(result.critical,true);assert.equal(result.roll,20);
 assert.equal(result.damage,19); // 8+8+3 con mayal.
 assert.equal(t.runtime.get('dummy-1').hitsReceived,1);
 assert.equal(t.runtime.get('dummy-1').hp,1);
 assert.equal(t.writes,1);
 assert.equal(t.game.horror,undefined);assert.equal(t.game.dnd.player.energy,undefined);
 t.session.close();
});
test('DnD: 1 natural falla frente al blanco y no descuenta su PG',()=>{
 const t=trainingEngine({random:()=>0});
 const result=t.session.attack('dummy-1');
 assert.equal(result.roll,1);assert.equal(result.hit,false);assert.equal(result.damage,0);
 assert.equal(t.runtime.get('dummy-1').hp,1);assert.equal(t.runtime.get('dummy-1').hitsReceived,0);
 t.session.close();
});
test('Contacto, distancia y visibilidad del blanco se verifican antes de tirar',()=>{
 let rolls=0;
 const t=trainingEngine({random:()=>{rolls++;return .99;}});
 t.actor.x=80;assert.equal(t.session.attack('dummy-1'),null);
 t.actor.x=3.1;t.physics.contact=false;assert.equal(t.session.attack('dummy-1'),null);
 t.physics.contact=true;t.physics.visible=false;assert.equal(t.session.attack('dummy-1'),null);
 t.physics.visible=true;assert.equal(t.session.attack('inexistente'),null);
 assert.equal(rolls,0);assert.equal(t.writes,0);
 t.session.close();
});
test('Un Dummy no se convierte en enemigo ni se destruye con muchos ataques',()=>{
 const t=trainingEngine();
 for(let i=0;i<12;i++)assert.equal(t.session.attack().hit,true);
 assert.equal(t.runtime.get('dummy-1').hp,1);
 assert.equal(t.runtime.get('dummy-1').hitsReceived,12);
 assert.deepEqual(t.game.dnd.actors,{});assert.equal(t.game.dnd.player.energy,undefined);
 t.session.close();
});
test('HUD: objetivo, ataques y habilidades y salvaciones DnD funcionan por botón',testContext=>{
 const textContext={};require('node:vm').runInNewContext(fs.readFileSync(path.join(root,'juego/rules/dnd/fh-dnd-strings.js'),'utf8'),textContext);
 const previousText=globalThis.FH_DND_TEXT;globalThis.FH_DND_TEXT=textContext.FH_DND_TEXT;
 testContext.after(()=>{globalThis.FH_DND_TEXT=previousText;});
 const t=trainingScene(),game={dnd:combat.initialState(sheet.createPilot())},nodes=[];
 function element(tag){
  const e={tagName:tag.toUpperCase(),style:{},value:'',disabled:false,textContent:'',
   children:[],listeners:{},attributes:{},setAttribute(key,value){this.attributes[key]=value;},append(...kids){this.children.push(...kids);},
   replaceChildren(...kids){this.children=kids;this.value=kids[0]?.value||'';},
   addEventListener(type,fn){this.listeners[type]=fn;},querySelectorAll(){return [];},remove(){}};
  nodes.push(e);return e;
 }
 const doc={baseURI:'https://example.test/',body:{append(){}},createElement:element,addEventListener(){},removeEventListener(){}};
 const session=dndEngine({targetPort:t.port,gameState:game,identity:id,sessionId:'hud',
  readPlayer:()=>({floor:0,x:3.1,z:3.048}),readMinute:()=>1320,
  save:()=>{},notice:()=>{},random:()=>.99,document:doc});
 const select=nodes.find(e=>e.tagName==='SELECT'),button=nodes.find(e=>e.tagName==='BUTTON');
 assert.equal(select.value,'dummy-1');
 const icons=nodes.filter(e=>e.tagName==='IMG'&&e.className.includes('dnd-stat-icon-image'));
 assert.equal(icons.length,6);
 for(const icon of icons){assert.equal(icon.attributes.width,'32');assert.equal(icon.attributes.height,'32');}
 const details=nodes.filter(e=>e.tagName==='IMG'&&e.className==='dnd-detail-icon');
 assert.equal(details.length,24,'6 salvaciones y 18 habilidades');
 for(const icon of details){assert.equal(icon.attributes.width,'24');assert.equal(icon.attributes.height,'24');}
 assert.ok(details.some(e=>e.src.endsWith('/skills/animal_handling.png')));
 assert.ok(details.some(e=>e.src.endsWith('/skills/sleight_of_hand.png')));
 const box=nodes.find(e=>e.className==='fh-dnd-status');
 assert.ok(box.children.some(e=>e.className==='dnd-sheet-layout'));
 assert.ok(nodes.some(e=>e.className==='dnd-sheet-tools'));
 assert.ok(nodes.some(e=>e.className==='dnd-field'));
 const ability=nodes.find(e=>e.className==='dnd-stat-card dnd-ability-card');
 assert.equal(ability.children[2].textContent,'+3');
 assert.equal(ability.children[3].textContent,'Modificador');
 assert.equal(ability.children[4].textContent,'Puntuación 17');
 const weapon=nodes.find(e=>e.className==='dnd-weapon');
 assert.equal(weapon.children[1].textContent,'Daño 1d8+3');
 const bonus=nodes.find(e=>e.className==='dnd-attack-bonus');
 assert.equal(bonus.children[0].textContent,'Ataque');
 assert.equal(bonus.children[1].textContent,'+5');
 button.listeners.click();assert.equal(t.runtime.get('dummy-1').hitsReceived,1);
 const save=session.rollSave('str',10);assert.equal(save.success,true);
 const skill=session.rollSkill('perception',10);assert.equal(skill.success,true);
 session.close();
});
test('Coordinador deduplica el mismo actionId y aplica una vez',()=>{
 const t=trainingScene(),state=combat.initialState(sheet.createPilot());let revision=0,rolls=0;
 const port=coordinator().bindDndCombat({sessionId:'dedup',playerId:'hero',rulesAdapter:combat,
  readContext:()=>({sessionId:'dedup',playerId:'hero',rulesetId:'dnd',revision,minute:50,state}),
  readWorld:()=>({actor:state.player,target:{type:'training_dummy',hp:1,maxHp:1,
    armorClass:10,resistances:[],vulnerabilities:[],immunities:[]}}),
  roll:sides=>{rolls++;return sides;},
  apply:(result,intent)=>{t.port.receiveHit(intent.target.id,result);revision++;}
 });
 const intent={sessionId:'dedup',rulesetId:'dnd',action:'attack',actionId:'same',
  revision:0,actor:{kind:'player',id:'hero'},target:{kind:'training_dummy',id:'dummy-1'}};
 const cap={authorize:()=>true,execute:()=>null};
 const first=port.requestAttack(intent,cap),again=port.requestAttack(intent,cap);
 assert.equal(first,again);assert.equal(rolls,3);
 assert.equal(t.runtime.get('dummy-1').hitsReceived,1);
 port.close();
});
test('DnD rechaza Sombras y la ruta Legacy no se activa como combate DnD',()=>{
 const t=trainingScene();
 assert.equal(t.port.read('shadow-1'),null);
 assert.throws(()=>dndEngine({shadowRuntime:{read(){}},gameState:{dnd:combat.initialState(sheet.createPilot())},
  identity:id,sessionId:'invalid',readPlayer:()=>({floor:0,x:3,z:3}),
  readMinute:()=>0,save:()=>{},notice:()=>{}}),/DND_ENGINE_INVALID/);
});
test('Hook del motor real: prepara scripts de ficha antes de combate DnD',()=>{
 const {html}=require('./helpers/forest-engine.cjs')();
 const patched=hook.patch(html,'https://example.test/');
 assert.match(patched,/rules\/dnd\/fh-dnd-sheet\.js/);
 assert.match(patched,/rules\/dnd\/fh-dnd-engine\.js/);
 assert.match(patched,/window\.FHDndEngine\.create/);
 assert.match(patched,/if\(fhMultimode\?\.identity.rulesetId==='dnd'\)GameState.dnd/);
 assert.throws(()=>hook.patch(patched,'https://example.test/'),/SAVE_ENGINE_HOOK_MISMATCH/);
});
test('Selección DnD conserva aislamiento frente a Legacy y Moon',()=>{
 const read=p=>fs.readFileSync(path.join(root,p),'utf8');
 const dnd=JSON.parse(read('contratos/multimodo/ejemplos/reglas/dnd.json'));
 assert.equal(dnd.status,'implemented');
 assert.equal(JSON.parse(read('contratos/multimodo/ejemplos/reglas/legacy.json')).status,'planned');
 assert.equal(JSON.parse(read('contratos/multimodo/ejemplos/reglas/moon-system.json')).status,'planned');
 const index=read('index.html');
 assert.match(index,/fh-dnd-sheet\.js/);
 assert.match(index,/isDnd\?await window\.FHDndCharacterManager\.ensureCharacter/);
 assert.match(index,/__dndCharacter:/);
});
