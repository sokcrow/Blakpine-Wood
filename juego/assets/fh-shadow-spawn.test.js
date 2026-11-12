'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Shadows=require('./fh-shadow-ai.js');

const DAY=1440,at=(day,hour=22,minute=0)=>day*DAY+hour*60+minute;
const player=(resources={})=>({floor:0,x:20,z:20,pg:100,pgMax:100,sp:100,spMax:100,...resources});
function scene({state={},config={},random=()=>.99,canWalk=()=>true}={}){
 const events=[],sprites=new Map();
 const runtime=Shadows.createRuntime({
  state,random,config:{spawnMinDistance:1,spawnMaxDistance:1,spawnDelayMin:0,spawnDelayMax:0,...config},
  spawn:(kind,f,x,z,id)=>{sprites.set(id,{kind,f,x,z});return id;},
  move:(id,f,x,z)=>{if(!sprites.has(id))return false;sprites.set(id,{...sprites.get(id),f,x,z});return true;},
  despawn:id=>sprites.delete(id),
  canWalk,insideAt:()=>true,route:(from,to)=>[from,to],
  onEvent:(type,detail)=>events.push({type,...detail})
 });
 const roll=(kind,night)=>events.find(e=>e.type==='night_roll'&&e.kind===kind&&e.night===night);
 return {runtime,events,sprites,roll,state};
}
function rolls(events){return events.filter(e=>e.type==='night_roll')}
function sequence(values){let i=0;return ()=>values[i++]??.99}

test('defaults: ambas tienen 3% base, horario 22:00–05:00 y tres días de enfriamiento',()=>{
 assert.equal(Shadows.DEFAULTS.baseChancePercent,3);
 assert.equal(Shadows.DEFAULTS.dailyIncreasePercent,3);
 assert.equal(Shadows.DEFAULTS.cooldownDays,3);
 assert.equal(Shadows.DEFAULTS.huntStartMinute,1320);
 assert.equal(Shadows.DEFAULTS.huntEndMinute,300);
 const {runtime,events}=scene();
 runtime.tick(at(0,21,59),0,player());
 assert.equal(rolls(events).length,0);
 runtime.tick(at(0,22),0,player());
 assert.deepEqual(rolls(events).map(e=>[e.kind,e.percent]),[['el_alto',3],['la_nina',3]]);
 runtime.tick(at(0,23),0,player());
 runtime.tick(at(1,0),0,player());
 runtime.tick(at(1,4,59),0,player());
 assert.equal(rolls(events).length,2,'no hay nuevas tiradas durante la noche, tampoco a medianoche');
 runtime.tick(at(1,5),0,player());
 runtime.tick(at(1,21,59),0,player());
 assert.equal(rolls(events).length,2);
 runtime.tick(at(1,22),0,player());
 assert.deepEqual(rolls(events).slice(-2).map(e=>e.percent),[6,6]);
});

test('la tasa aumenta 3 puntos por día sin aparición y se limita al 100%',()=>{
 const {runtime,roll}=scene({state:{nightSpawns:{firstNight:0,byKind:{}}}});
 runtime.tick(at(4,22),0,player());
 assert.equal(roll('el_alto',4).percent,15);
 assert.equal(roll('la_nina',4).percent,15);
 runtime.tick(at(40,22),0,player());
 assert.equal(roll('el_alto',40).percent,100);
 assert.equal(roll('la_nina',40).percent,100);
});

test('PS inferior a 75% y 50% da +3 y +6 SOLO a La Niña; los límites son estrictos',()=>{
 for(const [sp,expected] of [[75,3],[74.9,6],[50,6],[49.9,9],[0,9]]){
  const {runtime,roll}=scene();
  runtime.tick(at(0,22),0,player({sp}));
  assert.equal(roll('la_nina',0).percent,expected);
  assert.equal(roll('el_alto',0).percent,3);
 }
});

test('PG inferior a 75% y 50% da +3 y +6 SOLO a El Alto',()=>{
 for(const [pg,expected] of [[75,3],[74.9,6],[50,6],[49.9,9],[0,9]]){
  const {runtime,roll}=scene();
  runtime.tick(at(0,22),0,player({pg}));
  assert.equal(roll('el_alto',0).percent,expected);
  assert.equal(roll('la_nina',0).percent,3);
 }
});

test('porcentaje inválido o PG/PS sin máximo no produce bonificaciones accidentales',()=>{
 const {runtime,roll}=scene();
 runtime.tick(at(0,22),0,player({spMax:0,pgMax:undefined}));
 assert.equal(roll('la_nina',0).percent,3);
 assert.equal(roll('el_alto',0).percent,3);
});

test('una tirada exitosa solo genera aparición en el horario programado',()=>{
 const {runtime,events,sprites}=scene({random:()=>0,
  config:{spawnDelayMin:60,spawnDelayMax:60,maxActors:1}});
 runtime.tick(at(0,22),0,player());
 assert.equal(sprites.size,0,'no aparece instantáneamente con retraso de una hora');
 runtime.tick(at(0,22,59),0,player());
 assert.equal(sprites.size,0);
 runtime.tick(at(0,23),0,player());
 assert.equal(sprites.size,1);
 assert.equal(events.filter(e=>e.type==='night_appear').length,1);
});

test('una aparición fuerza 0% durante tres noches completas, luego vuelve con acumulado',()=>{
 const state={nightSpawns:{firstNight:0,byKind:{la_nina:{lastSpawnNight:0}}}};
 const {runtime,roll,sprites}=scene({state,random:()=>0,config:{maxActors:1}});
 runtime.tick(at(0,22),0,player());
 assert.equal(roll('el_alto',0).percent,3);
 assert.equal(sprites.size,1,'El Alto aparece la primera noche');
 for(const night of [1,2,3]){
  runtime.tick(at(night,5),0,player());
  runtime.tick(at(night,22),0,player());
  assert.equal(roll('el_alto',night).percent,0,'enfriamiento nocturno estricto');
 }
 runtime.tick(at(4,5),0,player());
 runtime.tick(at(4,22),0,player());
 assert.equal(roll('el_alto',4).percent,12);
 assert.equal(state.nightSpawns.byKind.el_alto.lastSpawnNight,4);
});

test('los enfriamientos de ambas Sombras son independientes',()=>{
 const state={nightSpawns:{firstNight:0,byKind:{la_nina:{lastSpawnNight:0}}}};
 const {runtime,roll}=scene({state});
 runtime.tick(at(1,22),0,player());
 assert.equal(roll('la_nina',1).percent,0);
 assert.equal(roll('el_alto',1).percent,6);
});

test('dos éxitos independientes permiten a ambas Sombras coexistir una noche',()=>{
 const rng=sequence([0,0,0,0,0,0,0.5,0]);
 const {runtime,sprites,events}=scene({random:rng});
 runtime.tick(at(0,22),0,player());
 assert.deepEqual([...sprites.values()].map(s=>s.kind),['el_alto','la_nina']);
 assert.equal(runtime.read().active.length,2);
 assert.equal(events.filter(e=>e.type==='night_appear').length,2);
});

test('termina la caza exactamente a las 05:00, sin reaparición durante el día',()=>{
 const state={nightSpawns:{firstNight:0,byKind:{la_nina:{lastSpawnNight:0}}}};
 const {runtime,events}=scene({state,random:()=>0});
 runtime.tick(at(0,22),0,player());
 assert.equal(runtime.read().active.length,1);
 runtime.tick(at(1,4,59),0,player());
 assert.equal(runtime.read().active.length,1);
 runtime.tick(at(1,5),0,player());
 assert.equal(runtime.read().active.length,0);
 assert.equal(events.filter(e=>e.type==='despawn').at(-1).reason,'amanecer');
 runtime.tick(at(1,14),0,player());
 assert.equal(runtime.read().active.length,0);
});

test('estado serializado: recargar no vuelve a tirar, ni borra la espera ni el enfriamiento',()=>{
 const state={nightSpawns:{firstNight:0,byKind:{la_nina:{lastSpawnNight:0}}}};
 const first=scene({state,random:()=>0,config:{spawnDelayMin:120,spawnDelayMax:120}});
 first.runtime.tick(at(0,22),0,player());
 assert.equal(first.roll('el_alto',0).percent,3);
 assert.equal(first.runtime.read().active.length,0);
 const saved=JSON.parse(JSON.stringify(state));
 const resumed=scene({state:saved,random:()=>.99});
 resumed.runtime.tick(at(0,23),0,player());
 assert.equal(rolls(resumed.events).length,0);
 resumed.runtime.tick(at(1,0),0,player());
 assert.equal(resumed.runtime.read().active.length,1);
 assert.equal(saved.nightSpawns.byKind.el_alto.lastSpawnNight,0);
 const reloaded=scene({state:JSON.parse(JSON.stringify(saved)),random:()=>0});
 reloaded.runtime.tick(at(1,1),0,player());
 assert.equal(rolls(reloaded.events).length,0);
 assert.equal(reloaded.runtime.read().active.length,0,'no duplica un encuentro ya registrado');
 reloaded.runtime.tick(at(1,22),0,player());
 assert.equal(reloaded.roll('el_alto',1).percent,0);
});

test('cargar entre medianoche y 05:00 sigue perteneciendo a la noche anterior',()=>{
 const {runtime,roll}=scene();
 runtime.tick(at(1,1),0,player());
 assert.equal(roll('el_alto',0).percent,3);
 runtime.tick(at(1,4),0,player());
 assert.equal(rolls(runtime.read().active).length,0);
 runtime.tick(at(1,22),0,player());
 assert.equal(roll('el_alto',1).percent,6);
});

test('si el edificio no admite aparición, no inventa sombras ni entra en un bucle por fotograma',()=>{
 const {runtime,events,roll}=scene({random:()=>0,canWalk:()=>false});
 runtime.tick(at(0,22),0,player());
 assert.equal(roll('el_alto',0).success,true);
 assert.equal(events.filter(e=>e.type==='blocked').length,2);
 runtime.tick(at(0,22,1),0,player());
 assert.equal(events.filter(e=>e.type==='blocked').length,2);
 runtime.tick(at(0,22,5),0,player());
 assert.equal(events.filter(e=>e.type==='blocked').length,4);
 assert.equal(runtime.read().active.length,0);
});
