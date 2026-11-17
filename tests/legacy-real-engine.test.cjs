'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=require('./helpers/forest-engine.cjs')().html;
const from=html.indexOf('function fhShadowInside('),to=html.indexOf('const tex={},loader=new THREE.TextureLoader();',from);
assert.ok(from>0&&to>from);
function engine({kind='el_alto',pg=20,both=false}={}){
 const counts={damage:0,notice:0,save:0,choices:0,rng:0},handlers={};
 const context=vm.createContext({console,URL,performance:{now:()=>0},
  DATA:{floors:[{items:[{type:'room',x:0,y:0,w:100,h:100}]}],horror:{
   baseChancePercent:100,dailyIncreasePercent:0,spawnDelayMin:1,spawnDelayMax:1,
   maxActors:both?2:1,detectFt:both?10:5,touchFt:both?10:2,spawnMinDistance:both?2:.35,spawnMaxDistance:both?2:.35,altoSpawnFt:both?7:1}},
  CELL:1,currentFloor:0,user:{x:20,z:20},occupiedShaft:()=>null,
  fhNpcCanWalk:()=>true,fhNpcStairTransitions:()=>[],roomAt:()=>null,
  GameEvents:{emit(type){if(type==='combat:damage')counts.damage++;}},
  notice(){counts.notice++;},saveProgress(){counts.save++;},
  window:{addEventListener(type,fn){handlers[type]=fn;}}});
 vm.runInContext('Object.assign(globalThis,window);window=globalThis;',context);
 for(const file of ['assets/fh-shadow-ai.js','assets/fh-survival-core.js','assets/fh-npc-goap.js',
  'rules/legacy/fh-legacy-combat-bridge.js','core/fh-session-coordinator.js','core/fh-legacy-engine-session.js']){
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../juego',file),'utf8'),context);
 }
 vm.runInContext(`Object.assign(window,{FHShadowAI,FHSurvival,FHNPCGOAP,FHLegacyEngineSession});
 const GameState={clock:{minutes:1320},character:{id:'hero',life:'alive',resources:{pg:${pg},pgMax:20,sp:20,spMax:20,pe:7,peMax:7}},
 horror:{nightSpawns:{firstNight:0,byKind:${both?'{}':JSON.stringify({[kind==='la_nina'?'el_alto':'la_nina']:{lastSpawnNight:0}})}}}};
 window.FHSurvivalRuntime=FHSurvival.createRuntime(GameState,{},1320);
 window.FHShadowActors={spawn:(kind,f,x,z,{id})=>id,move:()=>true,despawn(){}};
 const originalCreate=FHShadowAI.createRuntime;
 window.FHShadowAI={createRuntime(options){return originalCreate({...options,random:()=>nextRandom()})}};
 const originalGoal=FHNPCGOAP.chooseGoal;
 window.FHNPCGOAP={...FHNPCGOAP,chooseGoal(...args){countChoice();return originalGoal(...args)}};`,Object.assign(context,{nextRandom:()=>{const i=counts.rng++;return both&&i===6?.5:0;},countChoice:()=>counts.choices++}));
 vm.runInContext(html.slice(from,to),context);
 function tick(minute,x=20,dt=0){vm.runInContext(`GameState.clock.minutes=${minute};user.x=${x};fhLegacySession.tick(${dt});`,context);}
 const run=code=>vm.runInContext(code,context),settle=()=>new Promise(resolve=>setImmediate(resolve));
 tick(1320);tick(1321);
 counts.damage=counts.notice=counts.save=counts.choices=counts.rng=0;
 return {tick,run,settle,counts,handlers,window:context.window};
}
for(const kind of ['el_alto','la_nina'])test('motor ensamblado: tick → coordinador → puente → ataque original único de '+kind,async()=>{
 const e=engine({kind});e.tick(1322,20.05);
 assert.equal(e.counts.choices,0,'ningún coste antes de la microtarea');
 assert.equal(e.run('fhHorror.read().active[0].pe'),6);
 await e.settle();
 assert.deepEqual(e.counts,{damage:1,notice:1,save:1,choices:1,rng:2});
 assert.equal(e.run(`GameState.character.resources.${kind==='la_nina'?'sp':'pg'}`),18);
 assert.equal(e.run('GameState.character.resources.pe'),7);
 assert.equal(e.run('fhHorror.read().active[0].pe'),5);
 e.tick(1323,20.1);await e.settle();assert.equal(e.counts.damage,1,'cooldown original');
 e.tick(1331,20.15);await e.settle();assert.equal(e.counts.damage,2);
 assert.equal(e.run('fhHorror.read().active[0].pe'),4);
});
test('dos atacantes revalidan: primer daño invalida la revisión pendiente del segundo',async()=>{
 const e=engine({both:true});e.tick(1322,20.05);await e.settle();
 assert.equal(e.counts.choices,1);assert.equal(e.counts.damage,1);
 assert.equal(e.run('fhHorror.read().active.reduce((n,a)=>n+a.pe,0)'),11);
});
test('crítico y muerte impiden ataques posteriores',async()=>{
 const e=engine({pg:1,both:true});e.tick(1322,20.05);await e.settle();
 assert.equal(e.run('GameState.character.resources.pg'),0);
 assert.equal(e.run('!!window.FHSurvivalRuntime.state.critical'),true);
 e.tick(1332,20.1);await e.settle();assert.equal(e.counts.choices,1);
 e.run("GameState.character.life='dead';window.FHSurvivalRuntime.state.critical=null");
 e.tick(1342,20.15);await e.settle();assert.equal(e.counts.choices,1);
});
for(const close of ['fhLegacySession.close()','fhHorror.dispose()',"window.dispatchPageHide()"])
 test('cierre cancela intención sin costes: '+close,async()=>{
  const e=engine();e.tick(1322,20.05);
  if(close.includes('dispatchPageHide'))e.handlers.pagehide();else e.run(close);
  await e.settle();assert.equal(e.counts.choices,0);assert.equal(e.counts.damage,0);
  e.tick(1332,20.1);await e.settle();assert.equal(e.counts.damage,0);
 });
for(const mutation of ["user.x=50","GameState.clock.minutes=1800",
 "window.FHSleep={status:()=>({stage:'asleep'})}","GameState.character={...GameState.character}","GameState.character.id='other'",
 "window.FHSurvivalRuntime={...window.FHSurvivalRuntime,resources:{}}"])
 test('contexto vivo revoca antes de dados/PE: '+mutation,async()=>{
  const e=engine();e.tick(1322,20.05);e.run(mutation);await e.settle();
  assert.equal(e.counts.rng,0);assert.equal(e.counts.choices,0);assert.equal(e.counts.damage,0);
 });
test('ticks repetidos mientras espera nunca ejecutan la ruta directa',async()=>{
 const e=engine();e.tick(1322,20.05);e.tick(1322,20.1);await e.settle();
 assert.equal(e.counts.damage,0);assert.equal(e.counts.rng,0);
 e.tick(1323,20.15);await e.settle();assert.equal(e.counts.damage,1);
});
test('fallo en guardado después del daño no reintenta ni retorna a ruta antigua',async()=>{
 const e=engine();e.run("saveProgress=()=>{throw Error('save')}");e.tick(1322,20.05);await e.settle();
 assert.equal(e.counts.damage,1);assert.equal(e.run('GameState.character.resources.pg'),18);
 e.tick(1323,20.1);await e.settle();assert.equal(e.counts.damage,1);
});
test('documento carga dependencias en orden y cierre explícito antes de retirar iframe',()=>{
 const files=['fh-shadow-ai.js','fh-legacy-combat-bridge.js','fh-session-coordinator.js','fh-legacy-engine-session.js'];
 const positions=files.map(f=>html.indexOf('/'+f+'?v=20261117-legacy-combat'));
 assert.ok(positions.every((p,i)=>p>0&&(!i||p>positions[i-1])));
 const editor=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.match(editor,/FHLegacyCombatSession\?\.close\(\);\n play3DFrame.removeAttribute/);
});
test('reentrada desde aviso conserva una sola ejecución y notificar daño no muta recursos',async()=>{
 const e=engine();
 e.run('const originalNotice=notice;notice=(...args)=>{originalNotice(...args);fhLegacySession.tick(0)}');
 e.tick(1322,20.05);await e.settle();
 assert.equal(e.counts.damage,1);assert.equal(e.counts.choices,1);
 e.run("GameEvents.emit('combat:damage',{resource:'pg',damage:20})");
 assert.equal(e.run('GameState.character.resources.pg'),18);
 assert.equal(e.run('fhHorror.read().active[0].pe'),5);
});
test('cierre/reapertura crea una sesión independiente y nunca revive la anterior',async()=>{
 const old=engine();old.tick(1322,20.05);old.run('fhLegacySession.close()');
 const next=engine();next.tick(1322,20.05);await next.settle();await old.settle();
 assert.equal(old.counts.damage,0);assert.equal(next.counts.damage,1);
 assert.equal(old.run('fhLegacySession.getStatus().closed'),true);
 assert.equal(next.run('fhLegacySession.getStatus().connected'),true);
});
