'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Clock=require('../juego/rules/dnd/fh-dnd-clock.js'),Weather=require('../juego/assets/fh-weather-core.js');
const Lights=require('../juego/assets/fh-medieval-lighting.js');
const Adapter=require('../juego/rules/dnd/fh-dnd-save-adapter.js');
const Engine=require('../juego/rules/dnd/fh-dnd-engine.js'),Combat=require('../juego/rules/dnd/fh-dnd-combat.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} ≈ ${b}`);
const initial=()=>({clock:{year:2026,month:11,day:24,minutes:480},dnd:Combat.initialState()});
test('D&D: navegador inactivo, cama y tiempo real no avanzan el reloj; Legacy sigue 1 min/s',()=>{
 const game=initial(),clock=Clock.create({gameState:game});
 const weather=Weather.createRuntime({gameState:game,config:{advanceClock:false}});
 // Incluso un guardado antiguo dormido con 4 min/s no acelera D&D.
 game.clock.minutesPerSecond=4;
 for(let i=0;i<14400;i++)weather.update(.25);
 assert.equal(game.clock.minutes,480);assert.equal(clock.view().second,0);
 const legacy=initial(),runtime=Weather.createRuntime({gameState:legacy});
 for(let i=0;i<4;i++)runtime.update(.25);
 assert.equal(legacy.clock.minutes,481);assert.equal(legacy.dndTime,undefined);
});
test('distancia real: 30 pies = 6 s; velocidad de ficha, fracciones e inválidos',()=>{
 const game=initial();let speed=30;
 const clock=Clock.create({gameState:game,readSpeed:()=>speed});
 for(let i=0;i<60;i++)clock.move(.1524);
 near(game.clock.minutes,480.1);
 speed=15;clock.move(4.572);near(game.clock.minutes,480.2);
 const before=game.clock.minutes;
 for(const value of [NaN,Infinity,0,-1,'2'])assert.equal(clock.move(value),false);
 speed=0;assert.equal(clock.move(1),false);assert.equal(game.clock.minutes,before);
});
test('ronda simultánea: movimientos y acciones no suman por actor; cerrar añade 6 s una vez',()=>{
 const game=initial(),clock=Clock.create({gameState:game});
 clock.setMode('rounds');
 for(let actor=0;actor<5;actor++){clock.move(9.144);clock.action();}
 assert.equal(game.clock.minutes,480);assert.equal(clock.wait(60),false);
 clock.endRound();near(game.clock.minutes,480.1);assert.equal(clock.view().round,2);
 clock.setMode('exploration');assert.equal(clock.endRound(),false);
 clock.action();near(game.clock.minutes,480.2);
});
test('esperas y descanso cruzan medianoche, año y febrero bisiesto; rechaza duraciones arbitrarias',()=>{
 const game=initial();Object.assign(game.clock,{month:12,day:31,minutes:1380});
 const clock=Clock.create({gameState:game});clock.wait(480);
 assert.deepEqual([game.clock.year,game.clock.month,game.clock.day,game.clock.minutes],[2027,1,1,420]);
 Object.assign(game.clock,{year:2028,month:2,day:28,minutes:1439});clock.wait(1);
 assert.equal(game.clock.day,29);assert.equal(game.clock.minutes,0);
 const before=JSON.stringify(game);for(const duration of [NaN,Infinity,-1,0,481,'10'])assert.equal(clock.wait(duration),false);
 assert.equal(JSON.stringify(game),before);
});
test('antorcha: no gasta por frames, consume segundos y esperas ficticias; apagada se conserva',()=>{
 const game=initial(),torch={id:'torch',type:'light_fixture',lightKind:'torch_hand',lightOn:true};
 let lights;const clock=Clock.create({gameState:game,beforeAdvance:()=>lights?.tick(),changed:()=>lights?.tick()});
 lights=Lights.createRuntime({floors:[{items:[torch]}],state:game,clock:clock.minute});
 clock.wait(1);near(lights.view('torch').remaining,59,'primer avance anterior al primer fotograma');
 for(let i=0;i<10000;i++)lights.tick();near(lights.view('torch').remaining,59);
 clock.action();near(lights.view('torch').remaining,58.9);
 clock.wait(10);near(lights.view('torch').remaining,48.9);
 lights.act(0,torch,'off');clock.wait(60);near(lights.view('torch').remaining,48.9);
 lights.act(0,torch,'on');clock.wait(60);assert.equal(lights.lit(0,torch),false);
 assert.equal(lights.view('torch').remaining,0);
});
test('guardado v1: migra reloj antiguo; conserva fecha, segundos y ronda sin tiempo offline',()=>{
 const game=Adapter.initial({initialGameState:initial()});game.clock.minutesPerSecond=4;
 const clock=Clock.create({gameState:game});clock.move(1.524);clock.setMode('rounds');clock.endRound();
 const captured=JSON.parse(JSON.stringify(Adapter.capture(game,{})));
 const restored=Adapter.restore(captured.world,captured.rules.data,{}),next=Clock.create({gameState:restored});
 assert.deepEqual(next.view(),clock.view());assert.equal(restored.clock.minutesPerSecond,0);
 assert.equal(restored.dnd.player.hp,game.dnd.player.hp);
 assert.equal(next.action(),false);next.endRound();near(restored.clock.minutes,game.clock.minutes+.1);
});
test('ataque resuelto (incluso falla) consume 6 s; fuera de alcance y tiradas solas consumen 0',()=>{
 const game=initial(),clock=Clock.create({gameState:game});let allowed=false;
 const dummy={id:'target',floor:0,x:0,z:0};
 const engine=Engine.create({gameState:game,identity:{characterId:'hero',rulesetId:'dnd'},
  sessionId:'time-test',readPlayer:()=>({floor:0,x:0,z:0}),readMinute:clock.minute,
  targetPort:{read:()=>dummy,list:()=>[dummy],canAttack:()=>allowed,receiveHit(){}},
  time:clock,save(){},notice(){},random:()=>0,document:null});
 assert.equal(engine.attack(),null);assert.equal(game.clock.minutes,480);
 allowed=true;assert.equal(engine.attack().hit,false);near(game.clock.minutes,480.1);
 engine.rollSave('dex');engine.rollSkill('perception');near(game.clock.minutes,480.1);
 clock.setMode('rounds');engine.attack();near(game.clock.minutes,480.1);
 clock.endRound();near(game.clock.minutes,480.2);engine.close();
});
test('el motor completo compila; caminar bloqueado, deslizar en muro y corriente usan distancia aceptada',()=>{
 const prepared=require('./helpers/forest-engine.cjs')();
 let html=require('../juego/assets/fh-medieval-light-engine.js').patchEngineDoc(prepared.html,'https://example.test/');
 html=require('../juego/core/fh-multimode-save-hook.js').patch(html,'https://example.test/');
 for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(match[1].trim())new vm.Script(match[1]);
 const begin=html.indexOf('function walk('),end=html.indexOf('\nlet noticeTimeout',begin);
 const game=initial(),clock=Clock.create({gameState:game});
 const env={window:{},fhDndClock:clock,user:{x:0,z:0},currentFloor:0,DATA:{},CELL:1.524,
  fhWeatherEnabled:false,fhWeather:null,canWalk:()=>false};
 vm.createContext(env);vm.runInContext(html.slice(begin,end),env);
 assert.equal(env.walk(1,1),0);assert.equal(game.clock.minutes,480);
 env.canWalk=(x,z)=>z===0;
 const moved=env.walk(1,1);near(moved,1);near(game.clock.minutes,480+1/.3048*6/30/60);
 env.canWalk=()=>true;const before=game.clock.minutes;env.walk(2,0,true);
 assert.equal(game.clock.minutes,before,'corriente automática no consume movimiento voluntario');
 const tick=html.slice(html.indexOf('if(!fhDndClock)window.FHUnifiedSleep?.before(GameState);'));
 assert.match(tick,/if\(!fhDndClock\)window.FHUnifiedSleep\?\.after\(GameState\)/);
 assert.match(html,/advanceClock:false/);assert.match(html,/time:fhDndClock/);
 assert.match(html,/clock:\(\)=>fhDndClock\?fhDndClock.minute\(\)/);
 assert.throws(()=>require('../juego/core/fh-multimode-save-hook.js').patch(html,'https://example.test/'),/SAVE_ENGINE_HOOK_MISMATCH/);
});
