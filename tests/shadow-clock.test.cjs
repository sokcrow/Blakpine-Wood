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
 const selected=overrides.state?.seq===1?'la_nina':'el_alto';
 const inactive=selected==='la_nina'?'el_alto':'la_nina';
 const exclude=config.maxActors===2?{}:{[inactive]:{lastSpawnNight:0}};
 const state={nightSpawns:{firstNight:0,byKind:exclude},...(overrides.state||{})};
 const realRuntime=Shadow.createRuntime({
  config:{baseChancePercent:100,dailyIncreasePercent:0,spawnDelayMin:1,spawnDelayMax:1,maxActors:1,
   ...config},
  state,random:overrides.random||(()=>0.5),
  insideAt:overrides.insideAt,canPhase:overrides.canPhase,chooseAttack:overrides.chooseAttack,
  spawn:(kind,f,x,z,id)=>{sprites.set(id,{kind,f,x,z});return id;},
  move:(id,f,x,z)=>{if(!sprites.has(id))return false;sprites.set(id,{...sprites.get(id),f,x,z});return true;},
  despawn:id=>sprites.delete(id),
  canWalk:overrides.canWalk||(()=>true),
  route:overrides.route||((a,b)=>[a,b]),
  onEvent:(type,payload)=>events.push({type,payload})
 });
 const runtime={...realRuntime,tick:(minute,dt,player)=>realRuntime.tick(1320+minute,dt,player)};
 return {runtime,events,sprites};
}
const player={floor:0,x:20,z:20};

test('El Alto y La Niña tienen tiradas independientes y pueden coexistir',()=>{
 const {runtime,sprites}=setup({maxActors:2});
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

test('Sombras: la proximidad inmóvil no ataca y moverse dentro de 5 ft sí',()=>{
 const {runtime,events}=setup({
  spawnMinDistance:.35,spawnMaxDistance:.35,attackCooldown:9,
  intervalMin:50,intervalMax:50
 },{random:()=>0});
 runtime.tick(0,0,player);runtime.tick(1,0,player);
 runtime.tick(2,0,player);
 assert.equal(events.filter(e=>e.type==='attack').length,0);
 runtime.tick(3,0,{...player,x:player.x+.05});
 const hits=events.filter(e=>e.type==='attack');
 assert.equal(hits.length,1);
 assert.equal(hits[0].payload.resource,'pg');
 assert.equal(hits[0].payload.damage,1);
 assert.equal(hits[0].payload.category,'Sombras');
 runtime.tick(3.2,0,{...player,x:player.x+.1});
 assert.equal(events.filter(e=>e.type==='attack').length,1,'respeta los 9 minutos originales de recarga');
});
test('Sombras: La Niña provoca una pesadilla sin aplicar daño a un jugador dormido',()=>{
 const {runtime,sprites,events}=setup({
  spawnMinDistance:.35,spawnMaxDistance:.35,maxActors:1,intervalMin:50,intervalMax:50
 },{random:()=>0,state:{seq:1}});
 runtime.tick(0,0,player);
 runtime.tick(1,0,{...player,sleeping:true});
 assert.equal(sprites.size,1,'el sueño ya no hace desaparecer a las Sombras');
 assert.equal(events.filter(e=>e.type==='nightmare').length,1);
 assert.equal(events.filter(e=>e.type==='attack').length,0);
 runtime.tick(2,0,{...player,sleeping:true});
 assert.equal(events.filter(e=>e.type==='nightmare').length,1,'una sola pesadilla por aparición');
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


test('Sombras: una puerta cerrada impide drenar a través de ella',()=>{
 let doorClosed=false;
 const {runtime,events}=setup({
  spawnMinDistance:.35,spawnMaxDistance:.35,
  attackCooldown:1,intervalMin:80,intervalMax:80
 },{random:()=>0,canWalk:(_floor,x)=>!doorClosed||x<20.15||x>20.24});
 runtime.tick(0,0,player);
 runtime.tick(1,0,player);
 doorClosed=true;
 runtime.tick(2,0,{...player,x:20.04});
 assert.equal(events.filter(e=>e.type==='attack').length,0);
 doorClosed=false;
 runtime.tick(3,0,{...player,x:20.08});
 assert.equal(events.filter(e=>e.type==='attack').length,1);
});
test('Sombras: un muro impide atacar aunque la IA encuentre una ruta alternativa',()=>{
 let blocked=false;
 const {runtime,events}=setup({
  spawnMinDistance:.35,spawnMaxDistance:.35,intervalMin:80,intervalMax:80
 },{random:()=>0,canWalk:(_floor,x)=>!blocked||x<20.15||x>20.24,
   route:(a,b)=>[a,{...a,x:a.x+4,z:a.z+3},{...b,x:b.x+4,z:b.z+3},b]});
 runtime.tick(0,0,player);
 runtime.tick(1,0,player);
 blocked=true;
 runtime.tick(2,0,{...player,x:20.04});
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
 const result=patch('<head></head><script>function verify(){const GameState=createGameState(restored||DATA.initialGameState);'+originals.join('\n')+'}</script>');
 assert.ok(result.includes('lighting.range(currentFloor,room,!lighting.flicker(performance.now())&&!fhHorrorLightsFail())'));
 const masked='params.sources=fhHorrorLightsFail()?[]:';
 assert.equal(result.split(masked).length-1,2);
 assert.ok(result.includes('ambient.intensity=fhHorrorLightsFail(now)?.075:.37;'));
 assert.equal(result.split('params.sources=lighting.sourcesNear').length-1,0);
 assert.equal(result.split('params.sources=window.FHLights.sourcesNear').length-1,0);
 const src=result.match(/<script>([\s\S]*?)<\/script>/)[1];
 assert.doesNotThrow(()=>new Function(src));
});

test('El motor ignora únicamente la cama ocupada al comprobar la pesadilla',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const patch=html.slice(html.indexOf('function addShadowEncountersToEngine(doc){'),
  html.indexOf(' const assembled=',html.indexOf('function addShadowEncountersToEngine(doc){')));
 const match=patch.match(/const insert=("(?:\\.|[^"\\])*");/);
 assert.ok(match,'se encuentra el hook del motor de Sombras');
 const source=JSON.parse(match[1]);
 const start=source.indexOf('function fhShadowNightmareClear(');
 const end=source.indexOf('let fhHorrorFlickerUntil=',start);
 assert.ok(start>=0&&end>start,'existe la verificación de cama');
 let closed=false,seenCollision=false;
 const collider=(x,z,params)=>{
  seenCollision=true;
  assert.deepEqual(params.objects.map(o=>o.id),['mesa'],
   'la excepción es exclusiva de la cama ocupada');
  assert.equal(params.doors.length,1,'las puertas reales conservan su colisión');
  return closed&&x>20.15&&x<20.25;
 };
 const factory=new Function('playerPoseItem','elevatorPortals','elevatorSystem',
  'furnitureColliders','doorList','blockers','ForestShared','MAX_X','MAX_Z',
  'PLAYER_RADIUS','WALL_THICK','SLABS','onStructuralSlab','fhShadowInside',
  source.slice(start,end)+'return fhShadowNightmareClear;');
 const clear=factory({id:'cama',type:'bed'},[[]],{get:()=>null},
  [[{id:'cama'},{id:'mesa'}]],[[{id:'puerta',closed:true}]],[[]],
  {solidAt:collider},100,100,.2,.12,[{enabled:false}],()=>true,()=>true);
 const actor={floor:0,x:20.35,z:20},player={floor:0,x:20,z:20};
 assert.equal(clear(actor,player),true,'la cama ya no impide el contacto onírico');
 assert.ok(seenCollision);
 closed=true;
 assert.equal(clear(actor,player),false,'la puerta cerrada sigue deteniendo la pesadilla');
});
