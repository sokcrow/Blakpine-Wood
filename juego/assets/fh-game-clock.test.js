'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Weather=require('./fh-weather-core.js');

function gameClock({enabled=false,clock={year:2026,month:11,day:11,minutes:480}}={}){
 const window={};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'fh-unified-sleep.js'),'utf8'),{window});
 const game={clock:{...clock}};
 // El reloj pertenece a GameState, no depende de dibujar la meteorología.
 const weather=Weather.createRuntime({gameState:game,config:{enabled}});
 const sleep=window.FHUnifiedSleep;
 function step(realSeconds){
  const ticks=Math.round(realSeconds/.25);
  assert.ok(Math.abs(ticks*.25-realSeconds)<1e-9,'el test usa intervalos de 0.25 s');
  for(let i=0;i<ticks;i++){
   sleep.before(game);
   weather.update(.25);
   sleep.after(game);
  }
 }
 return {window,game,weather,sleep,step};
}

test('vigilia: un segundo real equivale a un minuto con el clima desactivado',()=>{
 const {game,sleep,step}=gameClock();
 step(1);
 assert.equal(game.clock.minutes,481);
 assert.equal(game.clock.minutesPerSecond,1);
 assert.equal(sleep.state.awakeMinutes,1);
});

test('sueño: 0.25 segundos reales equivalen a un minuto del juego',()=>{
 const {game,sleep,step}=gameClock({enabled:true});
 sleep.state.awakeMinutes=360;
 sleep.pose({stage:'asleep'});
 assert.equal(sleep.state.sleeping,true);
 step(.25);
 assert.equal(game.clock.minutes,481);
 assert.equal(game.clock.minutesPerSecond,4);
 assert.equal(sleep.state.sleepMinutes,1);
 sleep.pose({stage:'awake'});
 step(1);
 assert.equal(game.clock.minutes,482);
 assert.equal(game.clock.minutesPerSecond,1);
});

test('al alcanzar asleep sin seis horas previas, la aceleración sí se activa',()=>{
 const {game,sleep,step}=gameClock();
 sleep.pose({stage:'resting'});
 step(.25);
 assert.equal(game.clock.minutes,480.25);
 sleep.pose({stage:'drowsy'});
 step(.25);
 assert.equal(game.clock.minutes,480.5);
 sleep.pose({stage:'asleep'});
 assert.equal(sleep.state.awakeMinutes<360,true);
 assert.equal(sleep.state.sleeping,true);
 step(.25);
 assert.equal(game.clock.minutes,481.5);
 assert.equal(game.clock.minutesPerSecond,4);
});

test('el consenso multijugador impide acelerar si hay alguien despierto',()=>{
 const {window,game,sleep,step}=gameClock();
 sleep.state.awakeMinutes=360;
 sleep.pose({stage:'asleep'});
 window.FHMultiplayerSleepConsensus={allSleeping:false};
 step(.25);
 assert.equal(game.clock.minutes,480.25);
 assert.equal(game.clock.minutesPerSecond,1);
 window.FHMultiplayerSleepConsensus={allSleeping:true};
 step(.25);
 assert.equal(game.clock.minutes,481.25);
 assert.equal(game.clock.minutesPerSecond,4);
});

test('dormir ocho horas toma dos minutos reales y retorna al ritmo normal',()=>{
 const {game,sleep,step}=gameClock({enabled:false});
 sleep.state.awakeMinutes=360;
 sleep.pose({stage:'asleep'});
 step(120);
 assert.equal(game.clock.minutes,960);
 assert.equal(sleep.state.sleeping,false);
 assert.equal(sleep.state.awakeMinutes,0);
 assert.equal(sleep.state.restedMinutes,480);
 step(.25);
 assert.equal(game.clock.minutes,960.25);
 assert.equal(game.clock.minutesPerSecond,1);
});

test('el reloj cruza medianoche sin perder minutos incluso con clima apagado',()=>{
 const {game,step}=gameClock({enabled:false,clock:{year:2026,month:12,day:31,minutes:1439.75}});
 step(.25);
 assert.equal(game.clock.year,2027);
 assert.equal(game.clock.month,1);
 assert.equal(game.clock.day,1);
 assert.equal(game.clock.minutes,0);
});

test('integración: el adaptador no condiciona el reloj a activar meteorología',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 assert.ok(html.includes('"const fhWeatherEnabled=DATA.weather?.enabled===true;"'));
 assert.ok(html.includes('"const fhWeather=window.FHWeatherCore?.createRuntime({gameState:GameState,config:DATA.weather||{}});"'));
 assert.ok(html.includes('"window.FHWeatherRuntime=fhWeatherEnabled?fhWeather:null;"'));
 for(const symbol of ['fhWeatherExposure','fhWeatherRenderer','fhWeatherAudio']){
  assert.ok(html.includes('const '+symbol+'=fhWeatherEnabled&&fhWeather?'),symbol+' debe mantenerse desactivado');
 }
 assert.ok(html.includes('weather:()=>fhWeatherEnabled?fhWeather?.view():null'));
 assert.ok(html.includes('window.FHUnifiedSleep?.before(GameState);if(fhWeather?.update(dt))visibilityDirty=true;window.FHUnifiedSleep?.after(GameState)'));
 assert.ok(html.includes('fh-unified-sleep.js?v=20261111-unified2'),'el navegador debe recibir la versión corregida del reloj');
});


// Ejercita el controlador real de cama y el mismo orden de actualización de 3D.
test('integración de cama: solo al terminar transición entra 4×, despierto vuelve a 1×',()=>{
 const {window,game,weather,sleep}=gameClock({enabled:false});
 const nodes=new Map();
 const body={classList:{toggle(){},remove(){}},appendChild(node){node.parentNode=this;nodes.set(node.id,node);}};
 window.document={body,documentElement:{clientWidth:800,clientHeight:600},
  getElementById:id=>nodes.get(id)||null,
  createElement:()=>({id:'',style:{},setAttribute(){},parentNode:null})};
 window.innerWidth=800;window.innerHeight=600;
 window.FHLiveText={clearKind(){}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'fh-sleep.js'),'utf8'),{window});
 const controller=window.FHSleep;
 const dt=1/60;
 function frame(phase='lying',verb='lie',type='bed'){
  sleep.before(game);
  weather.update(dt);
  sleep.after(game);
  const status=controller.update(dt,phase,verb,type,{emit(){}});
  sleep.pose(status);
  return status;
 }
 // La animación transcurre antes de acelerar, sin simular 6 horas de vigilia.
 for(let i=0;i<300;i++)frame();
 assert.equal(controller.status().stage,'drowsy');
 assert.equal(game.clock.minutesPerSecond,1);
 assert.equal(sleep.state.sleeping,false);
 for(let i=0;i<360;i++)frame();
 assert.equal(controller.status().stage,'asleep');
 assert.equal(sleep.state.sleeping,true);
 assert.ok(sleep.state.awakeMinutes<360,'un personaje recién creado puede dormirse visualmente');
 const before=game.clock.minutes;
 for(let i=0;i<60;i++)frame();
 assert.ok(Math.abs(game.clock.minutes-before-4)<1e-6,'1 s real dormido equivale a 4 minutos de juego');
 assert.equal(game.clock.minutesPerSecond,4);
 assert.equal(controller.requestWake(()=>({ok:true})).waking,true);
 const wakingBefore=game.clock.minutes;
 frame();
 assert.equal(controller.status().stage,'waking');
 assert.equal(game.clock.minutesPerSecond,1);
 for(let i=0;i<59;i++)frame();
 assert.ok(Math.abs(game.clock.minutes-wakingBefore-1)<1e-6,'vuelve a 1 minuto/s sin fotograma extra a 4×');
});

// El tiempo del mundo solo debe actualizarse una vez en cada fotograma.
test('integración 3D: fuente única del reloj y detección explícita del controlador de cama',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 const match=html.match(/const tickAfter='([^']*)';/);
 assert.ok(match);
 assert.equal((match[1].match(/fhWeather\?\.update\(dt\)/g)||[]).length,1);
 assert.ok(html.includes('window.FHSleep?.update(dt,playerPose.state.phase,playerPose.state.verb,playerPoseItem?.type,GameEvents)'));
 assert.ok(html.includes('window.FHUnifiedSleep?.pose(window.FHSleep?.status())'));
});
