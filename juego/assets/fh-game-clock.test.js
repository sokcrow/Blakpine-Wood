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

test('estar acostado sin cumplir seis horas de vigilia no activa la aceleración',()=>{
 const {game,sleep,step}=gameClock();
 sleep.pose({stage:'asleep'});
 assert.equal(sleep.state.sleeping,false);
 step(1);
 assert.equal(game.clock.minutes,481);
 assert.equal(game.clock.minutesPerSecond,1);
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
});
