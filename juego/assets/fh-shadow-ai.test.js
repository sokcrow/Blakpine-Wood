'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Shadows=require('./fh-shadow-ai.js');

const PLAYER={floor:0,x:20,z:20};
function scene(kind='el_alto',config={},overrides={}){
 const events=[],actors=new Map();
 const runtime=Shadows.createRuntime({
  state:{seq:kind==='la_nina'?1:0,...(overrides.state||{})},
  config:{firstMin:1,firstMax:1,intervalMin:100,intervalMax:100,
   durationMin:90,durationMax:90,maxActors:1,
   spawnMinDistance:.35,spawnMaxDistance:.35,...config},
  random:overrides.random||(()=>0),
  spawn:(type,f,x,z,id)=>{actors.set(id,{type,f,x,z});return id;},
  move:(id,f,x,z)=>{if(!actors.has(id))return false;actors.set(id,{...actors.get(id),f,x,z});return true;},
  despawn:id=>actors.delete(id),
  canWalk:overrides.canWalk||(()=>true),
  canPhase:overrides.canPhase,
  insideAt:overrides.insideAt,
  nextRoom:overrides.nextRoom,
  canReachSleeping:overrides.canReachSleeping,
  route:overrides.route||((a,b)=>[a,b]),
  chooseAttack:overrides.chooseAttack,
  onEvent:(type,payload)=>events.push({type,payload})
 });
 runtime.tick(0,0,PLAYER);
 runtime.tick(1,0,PLAYER);
 return {runtime,events,actors};
}
const sent=(events,name)=>events.filter(e=>e.type===name).map(e=>e.payload);
const movePlayer=(runtime,x,minute=2,options={})=>runtime.tick(minute,0,{...PLAYER,x,...options});

test('Sombras es la categoría de ambas criaturas con 6 PE iniciales',()=>{
 for(const kind of Shadows.TYPES){
  const {runtime}=scene(kind);
  assert.deepEqual(runtime.read().active.map(a=>[a.kind,a.category,a.pe]),[[kind,'Sombras',6]]);
 }
});

test('permanecer inmóvil impide recibir daño aunque la Sombra esté a distancia de contacto',()=>{
 const {runtime,events}=scene();
 runtime.tick(2,0,PLAYER);runtime.tick(3,0,PLAYER);
 assert.equal(sent(events,'attack').length,0);
 movePlayer(runtime,20.05,4);
 assert.equal(sent(events,'attack').length,1);
});

test('La Niña drena exclusivamente 1d4 PS; El Alto 1d4 PG',()=>{
 for(const kind of Shadows.TYPES){
  const {runtime,events}=scene(kind);
  movePlayer(runtime,20.05);
  const hit=sent(events,'attack')[0];
  assert.ok(hit);
  assert.equal(hit.category,'Sombras');
  assert.equal(hit.resource,kind==='la_nina'?'sp':'pg');
  assert.equal(hit.damage,1);
  assert.equal(hit.dice,1);
  assert.equal(hit.pe,6);
 }
});

test('el GOAP puede potenciar a 2d4 por 1 PE, pero nunca gastar energía inexistente',()=>{
 for(const pe of [6,0]){
  const {runtime,events}=scene('la_nina',{pe},{chooseAttack:()=> 'potenciado'});
  movePlayer(runtime,20.05);
  const attack=sent(events,'attack')[0],remaining=runtime.read().active[0].pe;
  assert.equal(attack.dice,pe?2:1);
  assert.equal(attack.damage,pe?2:1);
  assert.equal(attack.peSpent,pe?1:0);
  assert.equal(remaining,pe?pe-1:0);
 }
});

test('se conserva la espera entre ataques incluso si el jugador sigue moviéndose',()=>{
 const {runtime,events}=scene('la_nina',{attackCooldown:9});
 movePlayer(runtime,20.05,2);
 movePlayer(runtime,20.1,3);
 assert.equal(sent(events,'attack').length,1);
 movePlayer(runtime,20.15,11);
 assert.equal(sent(events,'attack').length,2);
});

test('La Niña atraviesa una puerta sin abrirla y paga exactamente 1 PE',()=>{
 const door={closed:true};
 const {runtime,events}=scene('la_nina',{spawnMinDistance:.9},{
  canWalk:(_f,x)=>x<20.36||x>20.43,
  canPhase:(kind)=>kind==='la_nina'
 });
 runtime.tick(2,.1,PLAYER);
 runtime.tick(3,.1,PLAYER);
 assert.equal(sent(events,'phase').length,1);
 assert.equal(runtime.read().active[0].pe,5);
 assert.equal(door.closed,true);
});

test('La Niña no atraviesa muros y El Alto no atraviesa puertas',()=>{
 for(const kind of Shadows.TYPES){
  const {runtime,events}=scene(kind,{spawnMinDistance:.9},{
   canWalk:(_f,x)=>x<20.7||x>20.76,
   canPhase:()=>false
  });
  for(let i=2;i<=7;i++)runtime.tick(i,.1,PLAYER);
  assert.equal(sent(events,'phase').length,0);
  assert.equal(runtime.read().active[0].pe,6);
 }
});

test('El Alto puede atravesar muros a cambio de 1 PE',()=>{
 const {runtime,events}=scene('el_alto',{spawnMinDistance:.9},{
  canWalk:(_f,x)=>x<20.7||x>20.76,
  canPhase:kind=>kind==='el_alto'
 });
 for(let i=2;i<=5;i++)runtime.tick(i,.1,PLAYER);
 assert.equal(sent(events,'phase').length,1);
 assert.equal(runtime.read().active[0].pe,5);
});

test('los obstáculos no permiten daños al otro lado, incluso a menos de 2 ft',()=>{
 let closed=false;
 const {runtime,events}=scene('el_alto',{},{
  canWalk:(_f,x)=>!closed||x<20.15||x>20.24
 });
 closed=true;
 movePlayer(runtime,20.05);
 assert.equal(sent(events,'attack').length,0);
 closed=false;
 movePlayer(runtime,20.08,3);
 assert.equal(sent(events,'attack').length,1);
});

test('La Niña da una única pesadilla al jugador dormido y no drena al dormir',()=>{
 const {runtime,events}=scene('la_nina');
 runtime.tick(2,0,{...PLAYER,sleeping:true});
 runtime.tick(3,0,{...PLAYER,sleeping:true});
 assert.equal(sent(events,'nightmare').length,1);
 assert.equal(sent(events,'attack').length,0);
 assert.equal(runtime.read().active.length,1);
});

test('5 minutos a 2 ft causan pérdida de interés: buscar cuarto o deambular',()=>{
 for(const kind of Shadows.TYPES){
  const {runtime,events}=scene(kind,{},{
   nextRoom:()=>({floor:0,x:23,z:20})
  });
  runtime.tick(6,0,PLAYER);
  assert.equal(sent(events,'interest_lost').length,1);
  assert.equal(runtime.read().active[0].mode,kind==='la_nina'?'search':'roam');
 }
});

test('ascensor y salida al exterior rompen la persecución sin alterar el mapa',()=>{
 for(const flag of ['inElevator','outside']){
  const {runtime,events}=scene('la_nina');
  runtime.tick(2,0,{...PLAYER,[flag]:true});
  assert.equal(runtime.read().active.length,0);
  assert.equal(sent(events,'despawn').length,1);
  assert.equal(sent(events,'despawn')[0].reason,flag==='inElevator'?'elevador':'exterior');
 }
});

test('sombras cruzan entre pisos únicamente por un nodo de escalera autorizado',()=>{
 const moved=[];
 const sceneOptions={
  route:(from,to)=>{
   if(from.floor!==to.floor)return [from,{floor:to.floor,x:from.x,z:from.z,transition:true},to];
   return [from,to];
  }
 };
 const {runtime,actors}=scene('la_nina',{spawnMinDistance:.9},sceneOptions);
 runtime.tick(2,.1,{...PLAYER,floor:1});
 assert.equal(runtime.read().active.length,1);
 assert.equal(runtime.read().active[0].floor,1);
 assert.equal([...actors.values()][0].f,1);
});

test('una escalera inexistente no autoriza teletransporte entre pisos',()=>{
 const {runtime}=scene('la_nina',{spawnMinDistance:.9},{
  route:(from,to)=>from.floor===to.floor?[from,to]:[from,{floor:to.floor,x:to.x,z:to.z}]
 });
 runtime.tick(2,.1,{...PLAYER,floor:1});
 assert.equal(runtime.read().active[0].floor,0);
});

test('Caminar con fotogramas pequeños sigue contando como movimiento a 240 FPS',()=>{
 const {runtime,events}=scene('la_nina');
 for(let frame=1;frame<=4;frame++){
  runtime.tick(1+frame/240,1/240,{...PLAYER,x:PLAYER.x+frame*.004});
 }
 assert.equal(sent(events,'attack').length,1,
  'un desplazamiento acumulado mayor de 0.015 m tiene que habilitar el ataque');
});

test('Microdesplazamientos no activan ataque si el jugador se queda inmóvil',()=>{
 const {runtime,events}=scene('el_alto');
 runtime.tick(2,.004,{...PLAYER,x:PLAYER.x+.004});
 runtime.tick(3,.004,{...PLAYER,x:PLAYER.x+.004});
 runtime.tick(4,.004,{...PLAYER,x:PLAYER.x+.004});
 assert.equal(sent(events,'attack').length,0);
});

test('Dormir en una cama permite pesadilla con verificación específica, sin drenaje',()=>{
 const {runtime,events}=scene('la_nina',{},{
  canWalk:(_f,x)=>x>20.2,
  canReachSleeping:()=>true
 });
 runtime.tick(2,0,{...PLAYER,sleeping:true});
 assert.equal(sent(events,'nightmare').length,1);
 assert.equal(sent(events,'attack').length,0);
});

test('Una puerta cerrada impide la pesadilla aunque el jugador duerma en cama',()=>{
 let doorOpen=false;
 const {runtime,events}=scene('la_nina',{},{
  canWalk:(_f,x)=>x>20.2,
  canReachSleeping:()=>doorOpen
 });
 runtime.tick(2,0,{...PLAYER,sleeping:true});
 assert.equal(sent(events,'nightmare').length,0);
 doorOpen=true;
 runtime.tick(3,0,{...PLAYER,sleeping:true});
 assert.equal(sent(events,'nightmare').length,1);
});
