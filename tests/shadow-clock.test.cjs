/* Regresión: un solo reloj y encuentros reales de El Alto / La Niña.
 * Ejecutar: node --test tests/shadow-clock.test.cjs
 */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Shadow=require('../juego/assets/fh-shadow-ai.js');
const Weather=require('../juego/assets/fh-weather-core.js');
// Módulo legado del navegador; no se instancia su UI.
global.window=global.window||{};
require('../juego/assets/fh-delivery.js');
const Delivery=global.window.FHDelivery;

function setup(config={},overrides={}){
 const events=[],sprites=new Map();
 const runtime=Shadow.createRuntime({
  config:{firstMin:1,firstMax:1,intervalMin:1,intervalMax:1,
   durationMin:90,durationMax:90,...config},
  random:()=>0.5,
  spawn:(kind,f,x,z,id)=>{sprites.set(id,{kind,f,x,z});return id;},
  move:(id,f,x,z)=>{if(!sprites.has(id))return false;sprites.set(id,{...sprites.get(id),f,x,z});return true;},
  despawn:id=>sprites.delete(id),
  canWalk:overrides.canWalk||(()=>true),
  route:overrides.route||((a,b)=>[a,b]),
  onEvent:(type,payload)=>events.push({type,payload})
 });
 return {runtime,events,sprites};
}
const player={floor:0,x:20,z:20};

test('El Alto y La Niña aparecen de forma automática, alternados',()=>{
 const {runtime,sprites}=setup();
 runtime.tick(0,0,player);
 assert.equal(runtime.read().active.length,0);
 runtime.tick(1,0,player);
 runtime.tick(2,0,player);
 assert.equal(sprites.size,2);
 assert.deepEqual(runtime.read().active.map(a=>a.kind),['el_alto','la_nina']);
 runtime.dispose();
 assert.equal(sprites.size,0);
});

test('un punto inaccesible no genera un enemigo atravesando paredes',()=>{
 const {runtime,events}=setup({},{canWalk:()=>false});
 runtime.tick(0,0,player);runtime.tick(1,0,player);
 assert.equal(runtime.read().active.length,0);
 assert.ok(events.some(e=>e.type==='blocked'));
});

test('hay merodeo, presencia, parpadeo y ataques con espera mínima',()=>{
 const {runtime,events,sprites}=setup({spawnMinDistance:2,spawnMaxDistance:2,
  touchDistance:2.2,attackCooldown:9,intervalMin:50,intervalMax:50});
 runtime.tick(0,0,player);runtime.tick(1,0.04,player);
 assert.equal(sprites.size,1);
 assert.ok(events.some(e=>e.type==='presence'));
 assert.ok(events.some(e=>e.type==='flicker'));
 assert.equal(events.filter(e=>e.type==='attack').length,1);
 runtime.tick(4,0.04,player);
 assert.equal(events.filter(e=>e.type==='attack').length,1);
 runtime.tick(10.1,0.04,player);
 assert.equal(events.filter(e=>e.type==='attack').length,2);
});

test('dormir suspende las Sombras y evita ataques al despertar',()=>{
 const {runtime,sprites}=setup();
 runtime.tick(0,0,player);runtime.tick(1,0,player);
 assert.equal(sprites.size,1);
 runtime.tick(2,0,{...player,sleeping:true});
 assert.equal(sprites.size,0);
 assert.equal(runtime.read().active.length,0);
});

test('reloj: clima avanza una vez; entrega no duplica; cambia de día',()=>{
 const state={clock:{year:2016,month:6,day:1,minutes:1439},weather:{}};
 const weather=Weather.createRuntime({gameState:state,config:{clockSpeed:1}});
 Delivery.tickClock(state,.25,0);
 weather.update(.25);
 assert.equal(state.clock.minutes,1439.25);
 for(let i=0;i<3;i++){Delivery.tickClock(state,.25,0);weather.update(.25)}
 assert.equal(state.clock.day,2);
 assert.equal(state.clock.minutes,0);
});

test('el sueño conserva la velocidad del único reloj',()=>{
 const state={clock:{year:2016,month:6,day:3,minutes:480,minutesPerSecond:4}};
 Weather.createRuntime({gameState:state}).update(.25);
 assert.equal(state.clock.minutes,481);
});


test('no golpea atravesando una puerta cerrada, incluso si está a distancia de contacto',()=>{
 let doorClosed=false;
 const {runtime,events}=setup({
  spawnMinDistance:2,spawnMaxDistance:2,touchDistance:2.2,
  attackCooldown:1,intervalMin:80,intervalMax:80
 },{canWalk:(_floor,x)=>!doorClosed||x<18.7||x>19.3});
 runtime.tick(0,0,player);
 runtime.tick(1,0,player);
 assert.equal(events.filter(e=>e.type==='attack').length,1);
 doorClosed=true;
 runtime.tick(2.1,0,player);
 assert.equal(events.filter(e=>e.type==='attack').length,1);
 doorClosed=false;
 runtime.tick(2.2,0,player);
 assert.equal(events.filter(e=>e.type==='attack').length,2);
 doorClosed=true;
 runtime.tick(3.5,0,player);
 assert.equal(events.filter(e=>e.type==='attack').length,2);
});

test('muros cercanos impiden golpes aunque exista una ruta alternativa',()=>{
 const {runtime,events}=setup({
  spawnMinDistance:2,spawnMaxDistance:2,touchDistance:2.2,
  intervalMin:80,intervalMax:80
 },{canWalk:(_floor,x)=>x<18.7||x>19.3,
   route:(a,b)=>[a,{...a,x:a.x-4,z:a.z+3},{...b,x:b.x+4,z:b.z+3},b]});
 runtime.tick(0,0,player);
 runtime.tick(1,0,player);
 assert.equal(runtime.read().active.length,1);
 assert.equal(events.filter(e=>e.type==='attack').length,0);
});

test('apagón sobrenatural anula linterna y fuentes de la máscara de visión',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const start=html.indexOf('function addShadowEncountersToEngine(doc){');
 const end=html.indexOf(' const assembled=',start);
 assert.ok(start>=0&&end>start);
 const patch=new Function('document','URL',html.slice(start,end)+'\nreturn addShadowEncountersToEngine;')
  ({baseURI:'https://example.org/index.html'},URL);
 const originals=[
  'const tex={},loader=new THREE.TextureLoader();',
  'fhDeliveryNpcTick(dt);',
  'if(!roomLightsDirty&&now-lastRoomLighting<300)return;',
  'ambient.intensity=.37;',
  'const lit=lighting.fixtureLit(entry.floor,entry.room,entry.lamp);',
  'light.intensity=entry?1.58:0;',
  'const flicker=lighting.flicker(now);',
  'lighting.range(currentFloor,room,!lighting.flicker(performance.now()))',
  'params.sources=window.FHLights.sourcesNear(roomLampEntries,lighting,currentFloor,at.x,at.z,LOOK_RADIUS,10);',
  'params.sources=lighting.sourcesNear(roomLampEntries,currentFloor,at.x,at.z,LOOK_RADIUS,7.2,4);'
 ];
 const result=patch('<head></head><script>function verify(){'+originals.join('\n')+'}</script>');
 assert.ok(result.includes('lighting.range(currentFloor,room,!lighting.flicker(performance.now())&&!fhHorrorLightsFail())'));
 const masked='params.sources=fhHorrorLightsFail()?[]:';
 assert.equal(result.split(masked).length-1,2);
 assert.ok(result.includes('ambient.intensity=fhHorrorLightsFail(now)?.075:.37;'));
 assert.equal(result.split('params.sources=lighting.sourcesNear').length-1,0);
 assert.equal(result.split('params.sources=window.FHLights.sourcesNear').length-1,0);
 const src=result.match(/<script>([\s\S]*?)<\/script>/)[1];
 assert.doesNotThrow(()=>new Function(src));
});
