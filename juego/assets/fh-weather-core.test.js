'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Weather=require('./fh-weather-core.js');
test('calendario o estación fija',()=>{
 assert.equal(Weather.seasonFor({month:1}),'invierno');
 assert.equal(Weather.seasonFor({month:7}),'verano');
 assert.equal(Weather.seasonFor({month:1},{season:'primavera'}),'primavera');
});
test('variantes de precipitación sin nieve en verano',()=>{
 assert.equal(Weather.precipitation('tormenta',-5,'invierno'),'nieve');
 assert.equal(Weather.precipitation('llovizna',1,'invierno'),'aguanieve');
 assert.equal(Weather.precipitation('lluvia',-5,'verano'),'lluvia');
 assert.equal(Weather.precipitation('soleado',-5,'invierno'),'ninguna');
});
test('transiciones vecinas y duración mínima',()=>{
 for(const name of Weather.TYPES)for(const n of [0,.25,.5,.75,.999]){
  const next=Weather.chooseType('otono',name,()=>n);
  assert.ok(Math.abs(Weather.TYPES.indexOf(next)-Weather.TYPES.indexOf(name))<=1);
 }
 const state={clock:{year:2026,month:10,day:10,minutes:480}};
 const r=Weather.createRuntime({gameState:state,config:{minHours:3,maxHours:3}});
 const first=r.view().type;
 for(let i=0;i<100;i++)r.update(.04);
 assert.equal(r.view().type,first);
 assert.ok(state.clock.minutes>480);
});
test('persistencia, fecha y tormenta de nieve sin rayos',()=>{
 const lastAt=Date.UTC(2026,11,31)/60000+1439;
 const state={clock:{year:2026,month:12,day:31,minutes:1439},
  weather:{seed:55,type:'tormenta',fog:0,snow:.3,wetness:.4,
   nextAt:lastAt+600,lastAt}};
 const r=Weather.createRuntime({gameState:state,config:{season:'invierno'}});
 for(let i=0;i<300;i++)r.update(.25);
 assert.equal(state.clock.month,1);
 assert.equal(state.clock.day,1);
 assert.equal(state.clock.year,2027);
 assert.equal(r.view().phase,'nieve');
 assert.equal(r.view().lightning,false);
 assert.ok(state.weather.snow>=.3);
 const loaded=JSON.parse(JSON.stringify(state));
 assert.equal(Weather.createRuntime({gameState:loaded}).view().snow,state.weather.snow);
});
test('integración de clima, esquema v1 y preview',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
 assert.match(html,/forest-horror-map-v1/);
 assert.match(html,/function addWeatherToEngine\(doc\)/);
 assert.match(html,/fh-weather-core\.js/);
 assert.match(html,/weather:clone\(project\.weather/);
});
test('fecha inicial 2016 sin alterar relojes guardados',()=>{
 const nuevo={};
 Weather.createRuntime({gameState:nuevo,config:{advanceClock:false}});
 assert.equal(nuevo.clock.year,2016);
 assert.equal(nuevo.clock.month,6);
 assert.equal(nuevo.clock.day,1);
 const previo={clock:{year:2026,month:11,day:8,minutes:480}};
 Weather.createRuntime({gameState:previo,config:{advanceClock:false}});
 assert.equal(previo.clock.year,2026);
 assert.equal(previo.clock.day,8);
});
