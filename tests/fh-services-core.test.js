/* Ejecutar: node --test tests/fh-services-core.test.js
 * Pruebas de lógica pura. No requiere Three.js ni navegador.
 */
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const FH=require('../juego/assets/fh-services-core.js');

function fixture(){
 const items=[
  {id:'wall1',type:'wall',a:{x:0,y:0},b:{x:6,y:0}},
  {id:'wall2',type:'wall',a:{x:3,y:0},b:{x:3,y:6}},
  {id:'breaker',type:'breaker_panel',x:0,y:0,circuits:[{zoneId:'a',rangeFt:40}]},
  {id:'plug',type:'power_outlet',x:3,y:3,zoneId:'a',slots:2,capacityRayos:6},
  {id:'strip',type:'power_strip',x:3,y:3.2,outletId:'plug',slots:3,capacityRayos:6},
  {id:'router',type:'router',x:3,y:3.4,outletId:'strip',rayos:2,wifiRadiusFt:25,wifiPassword:'sok'},
  {id:'charger',type:'phone_charger',x:3,y:3.35,outletId:'strip',rayos:1,chargePerHour:50},
  {id:'water',type:'water_main',x:0,y:0,rangeFt:60},
  {id:'valve',type:'water_valve',x:3,y:1,networkId:'house',opened:true},
  {id:'tap',type:'water_outlet',x:3,y:3.1,networkId:'house',radiusFt:5},
  {id:'drain',type:'drain_outlet',x:3,y:3.4,radiusFt:5},
  {id:'drainMain',type:'drain_main',x:0,y:0,rangeFt:60},
  {id:'sink',type:'kitchen',x:3,y:3.3,service:{requiresWater:true,flowLpm:5,drains:true}}
 ];
 const project={schema:'forest-horror-map-v1',units:{feetPerCell:5},floors:[{id:'f0',items}]};
 const state={phone:{battery:20}};
 return {project,state,items,sys:FH.createRuntime(project,state)};
}
test('un televisor antiguo no recibe energía sin conexión',()=>{
 const project={schema:'forest-horror-map-v1',units:{feetPerCell:5},floors:[{id:'f',items:[{id:'tv',type:'tv',x:1,y:1}]}]};
 const sys=FH.createRuntime(project,{});
 assert.equal(sys.statusFor(0,project.floors[0].items[0]).power.powered,false);
});
test('red física de paredes: bifurcación T funciona sin atajo recto',()=>{
 const {sys}=fixture();
 assert.ok(sys.graphs[0].route({x:0,y:0},{x:3,y:3})>3);
 assert.ok(sys.graphs[0].route({x:0,y:0},{x:3,y:3})<7);
});
test('breaker fuera de alcance: no alimenta enchufe',()=>{
 const {sys,items,project,state}=fixture();
 items.find(it=>it.id==='breaker').circuits[0].rangeFt=20;
 const restricted=FH.createRuntime(project,state);
 assert.equal(restricted.statusFor(0,items.find(it=>it.id==='plug')).power.powered,false);
 assert.equal(restricted.statusFor(0,items.find(it=>it.id==='router')).power.powered,false);
});
test('multiconector: ocupa un slot y propaga toda la carga al enchufe',()=>{
 const {sys,items}=fixture();
 assert.equal(sys.statusFor(0,items.find(it=>it.id==='plug')).usedSlots,1);
 assert.equal(sys.statusFor(0,items.find(it=>it.id==='plug')).loadingRayos,2); // El cargador vacío no consume carga
 assert.equal(sys.statusFor(0,items.find(it=>it.id==='strip')).usedSlots,2);
});
test('sobrecarga gradual: el daño se acumula, no se rompe inmediatamente',()=>{
 const {sys,items}=fixture();
 items.push({id:'heavy',type:'misc',x:3,y:3.1,outletId:'strip',service:{requiresPower:true,rayos:10,watts:3000}});
 sys.tick(10,1);
 assert.ok(sys.state.damage.plug>0&&sys.state.damage.plug<100);
 assert.ok(sys.state.damage.strip>0&&sys.state.damage.strip<100);
});
test('Wi-Fi: la contraseña es necesaria y el servicio puede suspenderse',()=>{
 const {sys}=fixture();
 assert.equal(sys.wifiAt(0,3,3.4)[0].online,false);
 assert.equal(sys.connectWifi('router','incorrecta'),false);
 assert.equal(sys.connectWifi('router','sok'),true);
 assert.equal(sys.wifiAt(0,3,3.4)[0].online,true);
 sys.setService('internet',false);
 assert.equal(sys.wifiAt(0,3,3.4)[0].online,false);
});
test('Wi-Fi: el candado depende de la contraseña del router y no de la sesión',()=>{
 const {sys,items,project,state}=fixture();
 const before=sys.wifiAt(0,3,3.4)[0];
 assert.equal(before.requiresPassword,true);
 assert.equal(before.authenticated,false);
 assert.equal(sys.connectWifi('router','sok'),true);
 const connected=sys.wifiAt(0,3,3.4)[0];
 assert.equal(connected.requiresPassword,true);
 assert.equal(connected.authenticated,true);
 items.find(it=>it.id==='router').wifiPassword='';
 const open=FH.createRuntime(project,state).wifiAt(0,3,3.4)[0];
 assert.equal(open.requiresPassword,false);
 assert.equal(open.authenticated,true);
});
test('telefonía móvil independiente del servicio de internet',()=>{
 const {sys}=fixture();
 sys.setService('internet',false);
 assert.equal(sys.mobileFor(),true);
 sys.setService('mobile',false);
 assert.equal(sys.mobileFor(),false);
});
test('teléfono fijo depende del router y contrato',()=>{
 const {sys,items,project,state}=fixture();
 const phone={id:'fixed',type:'landline_phone',routerId:'router',x:3,y:3.2};
 items.push(phone);
 const changed=FH.createRuntime(project,state);
 assert.equal(changed.landlineFor(0,phone),true);
 changed.setService('landline',false);
 assert.equal(changed.landlineFor(0,phone),false);
});
test('toma de agua recibe por tubería y válvula puede cerrarse/reabrirse',()=>{
 const {sys,items}=fixture();
 const sink=items.find(it=>it.id==='sink');
 assert.equal(sys.waterStatus(0,sink).water,true);
 sys.state.enabled.valve=false;
 assert.equal(sys.waterStatus(0,sink).water,false);
 sys.state.enabled.valve=true;
 assert.equal(sys.waterStatus(0,sink).water,true);
});
test('agua: medición de litros y drenaje sin facturas',()=>{
 const {sys,items}=fixture();
 sys.useWaterFixture(0,items.find(it=>it.id==='sink'));
 sys.tick(10,1);
 assert.ok(sys.state.meters.waterLiters>0);
 assert.ok(sys.state.meters.drainLiters>0);
 assert.equal('billing' in sys.state,false);
});
test('celular sale de la mano al cargar; la batería aumenta y puede recuperarse',()=>{
 const {sys,state}=fixture();
 assert.equal(sys.chargePhone(0,'charger'),true);
 assert.equal(sys.chargePhone(0,'charger'),false);
 assert.equal(sys.mobileFor(),false);
 sys.tick(15,1);
 assert.ok(state.phone.battery>20);
 assert.equal(sys.takePhone(),true);
 assert.equal(state.phone.placedAt,'');
 assert.equal(sys.mobileFor(),true);
});
test('corte eléctrico: router y cargador dejan de funcionar',()=>{
 const {sys,items}=fixture();
 sys.setService('electricity',false);
 assert.equal(sys.statusFor(0,items.find(it=>it.id==='router')).power.powered,false);
 assert.equal(sys.chargePhone(0,'charger'),false);
});
test('se conserva el consumo en kWh para conectar tarifas futuras',()=>{
 const {sys}=fixture();sys.tick(20,1);assert.ok(sys.state.meters.kwh>0);
});
test('capacidad y precio no son equivalentes',()=>{
 const {sys}=fixture();
 assert.equal(sys.state.contracts.electricity,'active');
 assert.equal(sys.state.meters.kwh,0);
 assert.equal(sys.state.meters.waterLiters,0);
});

test('grifo instalado pero cerrado no consume agua',()=>{
 const {sys}=fixture();sys.tick(10,1);assert.equal(sys.state.meters.waterLiters,0);
});
test('inodoro usa un pulso de agua y no queda drenando',()=>{
 const {sys,items}=fixture();const toilet={id:'wc',type:'toilet',x:3,y:3.3,service:{requiresWater:true,waterMode:'pulse',litersPerUse:6}};
 items.push(toilet);
 assert.equal(sys.useWaterFixture(0,toilet).liters,6);
 assert.equal(sys.state.meters.waterLiters,6);
 sys.tick(5,1);assert.equal(sys.state.meters.waterLiters,6);
});
test('cargador sin teléfono no factura consumos de carga',()=>{
 const {sys}=fixture();sys.tick(1,1);const standby=sys.state.meters.kwh;
 assert.ok(standby>0); // Router, no cargador.
 const plugged=fixture();plugged.sys.chargePhone(0,'charger');plugged.sys.tick(1,1);
 assert.ok(plugged.sys.state.meters.kwh>standby);
});
test('válvula inicialmente cerrada puede abrirse desde runtime',()=>{
 const {project,state,items}=fixture();items.find(it=>it.id==='valve').opened=false;
 const sys=FH.createRuntime(project,state),sink=items.find(it=>it.id==='sink');
 assert.equal(sys.waterStatus(0,sink).water,false);
 sys.state.enabled.valve=true;
 assert.equal(sys.waterStatus(0,sink).water,true);
});
test('línea de techo opt-in sigue las paredes incluso lejos de ellas',()=>{
 const {project,state,items}=fixture();
 const lamp={id:'lamp',type:'light_fixture',x:5,y:3,service:{requiresPower:true}};
 items.push(lamp);
 const sys=FH.createRuntime(project,state);
 assert.ok(sys.sourceFor(0,lamp,'a'));
});

test('llamada móvil alcanza teléfono fijo por número y router operativo',()=>{
 const {sys,items}=fixture();
 items.push({id:'wallphone',type:'landline_phone',x:3,y:3.5,routerId:'router',phoneNumber:'555-0102'});
 const result=sys.dial('mobile',0,null,'555-0102');
 assert.equal(result.ok,true);assert.equal(result.target.kind,'fixed');
 assert.equal(sys.state.calls.some(c=>c.direction==='incoming'&&c.routerId==='router'),true);
});
test('llamada rechazada si teléfono fijo no tiene internet',()=>{
 const {sys,items}=fixture();
 items.push({id:'wallphone',type:'landline_phone',x:3,y:3.5,routerId:'router',phoneNumber:'555-0102'});
 sys.setService('internet',false);
 assert.equal(sys.dial('mobile',0,null,'555-0102').ok,false);
 assert.equal(sys.state.calls.length,0);
});
test('llamada fija entrante al celular identificado por su cuenta',()=>{
 const {sys,items,state}=fixture();
 state.phone.accountId='guardia';
 const fixed={id:'wallphone',type:'landline_phone',x:3,y:3.5,routerId:'router',phoneNumber:'555-0200'};
 items.push(fixed);
 const result=sys.dial('fixed',0,fixed,'guardia');
 assert.equal(result.ok,true);assert.equal(result.target.kind,'mobile');
});

test('estado del breaker del circuito existente corta enchufes nuevos',()=>{
 const {project,state,items}=fixture();
 items.find(it=>it.id==='breaker').circuits[0].powerFlag='circuit_a_on';
 state.flags={circuit_a_on:false};
 const sys=FH.createRuntime(project,state);
 const socket=items.find(it=>it.id==='plug');
 assert.equal(sys.statusFor(0,socket).power.powered,false);
 state.flags.circuit_a_on=true;
 assert.equal(sys.statusFor(0,socket).power.powered,true);
});

test('el grafo devuelve puntos sobre paredes sin una diagonal entre breaker y toma',()=>{
 const {sys}=fixture(),path=sys.graphs[0].routeDetailed({x:0,y:0},{x:3,y:3},.65);
 assert.ok(path&&path.points.length>=3);
 for(let i=1;i<path.points.length;i++){
  const a=path.points[i-1],b=path.points[i];
  assert.ok(Math.abs(a.x-b.x)<.0001||Math.abs(a.y-b.y)<.0001,'segmento sobre muro');
 }
});
test('sin salida de drenaje no se contabilizan litros de agua evacuada',()=>{
 const {items,project,state}=fixture();
 items.splice(items.findIndex(it=>it.id==='drainMain'),1);
 const sys=FH.createRuntime(project,state),sink=items.find(it=>it.id==='sink');
 sys.useWaterFixture(0,sink);sys.tick(10,1);
 assert.ok(sys.state.meters.waterLiters>0);
 assert.equal(sys.state.meters.drainLiters,0);
});
test('tuberías de redes distintas no se conectan accidentalmente',()=>{
 const {items,project,state}=fixture();
 items.find(it=>it.id==='water').networkId='otra';
 const sys=FH.createRuntime(project,state);
 assert.equal(sys.waterStatus(0,items.find(it=>it.id==='tap')).water,false);
});
function roomNetworkFixture(withParcel=false){
 const items=[
  {id:'bottom',type:'wall',a:{x:0,y:0},b:{x:10,y:0}},
  {id:'first',type:'wall',a:{x:3,y:0},b:{x:3,y:6}},
  {id:'second',type:'wall',a:{x:6,y:0},b:{x:6,y:6}},
  {id:'breaker',type:'breaker_panel',x:0,y:0,circuits:[{zoneId:'main',rangeFt:100}]},
  {id:'socket',type:'power_outlet',x:2,y:0,zoneId:'main',radiusFt:8},
  {id:'roomA',type:'room',roomId:'A',x:0,y:0,w:3,h:6},
  {id:'roomB',type:'room',roomId:'B',x:3,y:0,w:3,h:6},
  {id:'roomC',type:'room',roomId:'C',x:6,y:0,w:4,h:6},
  {id:'r',type:'router',roomId:'A',x:2.5,y:.2,outletId:'socket',wifiRadiusFt:120,ethernetLeadFt:10,ethernetLengthFt:80},
  {id:'b',type:'ethernet_port',roomId:'B',routerId:'r',x:3,y:4,cableLengthFt:80},
  {id:'c',type:'ethernet_port',roomId:'C',routerId:'r',x:6,y:4,cableLengthFt:80}
 ];
 const properties=withParcel?[{id:'lot',floorId:'f0',polygon:[
  {x:-1,y:-1},{x:11,y:-1},{x:11,y:7},{x:-1,y:7}]}]:[];
 const project={schema:'forest-horror-map-v1',properties,units:{feetPerCell:5},floors:[{id:'f0',items}]};
 return {items,project};
}
test('Ethernet sólo llega a habitaciones asignadas desde habitación de origen',()=>{
 const {items,project}=roomNetworkFixture();
 const router=items.find(it=>it.id==='r'),b=items.find(it=>it.id==='b'),c=items.find(it=>it.id==='c');
 const sys=FH.createRuntime(project,{});
 assert.equal(sys.wiredRoute(0,router,b,80),null);
 router.assignedRoomIds=['B'];
 const allowed=FH.createRuntime(project,{});
 assert.ok(allowed.wiredRoute(0,router,b,80));
 assert.equal(allowed.wiredRoute(0,router,c,80),null);
});
test('una parcela permite cablear sus paredes, pero no da Wi-Fi infinito',()=>{
 const {items,project}=roomNetworkFixture(true);
 const sys=FH.createRuntime(project,{}),router=items.find(it=>it.id==='r');
 assert.ok(sys.wiredRoute(0,router,items.find(it=>it.id==='c'),80));
 assert.equal(sys.wifiAt(0,650,1).length,0);
});
test('una pared ligera atenúa menos que una estructural y no corta todo el Wi-Fi',()=>{
 const {items,project}=roomNetworkFixture();
 const router=items.find(it=>it.id==='r');
 const soft=FH.createRuntime(project,{}).wifiAt(0,4.4,.3)[0];
 const partition=items.find(it=>it.id==='first');partition.type='red_wall';
 const heavy=FH.createRuntime(project,{}).wifiAt(0,4.4,.3)[0];
 assert.ok(soft&&heavy);
 assert.ok(soft.dbm>heavy.dbm);
 assert.ok(soft.bars>=2);
});
test('el Wi-Fi tiene tres barras y devuelve calidad para las aplicaciones',()=>{
 const {items,project}=roomNetworkFixture();
 const sys=FH.createRuntime(project,{}),router=items.find(it=>it.id==='r');
 const close=sys.wifiAt(0,router.x,router.y)[0];
 assert.equal(close.bars,3);assert.equal(close.speedFactor,1);
 const distant=sys.wifiAt(0,10,5)[0];
 assert.ok(!distant||distant.bars<=3);
});
test('pisos diferentes debilitan señal aunque sean la misma parcela',()=>{
 const {project}=roomNetworkFixture();
 project.floors.push({id:'f1',elevationFt:12,items:[]});
 project.floors[0].elevationFt=0;
 const sys=FH.createRuntime(project,{});
 const ground=sys.wifiAt(0,2.5,.2)[0];
 const upper=sys.wifiAt(1,2.5,.2)[0];
 assert.ok(ground&&upper);
 assert.ok(ground.dbm>upper.dbm);
});
test('una PC por Ethernet no se conecta si el router sólo cubre otra habitación',()=>{
 const {items,project}=roomNetworkFixture();
 const computer={id:'pc',type:'misc',roomId:'C',x:6,y:4,service:{internetMode:'ethernet'}};
 items.push(computer);
 const sys=FH.createRuntime(project,{});
 assert.equal(sys.internetFor(0,computer).online,false);
});

test('el cable Ethernet no puede salir del perímetro de la parcela',()=>{
 const {items,project}=roomNetworkFixture(true);
 const outside={id:'out',type:'ethernet_port',x:11.5,y:0,routerId:'r',cableLengthFt:80};
 items.push(outside);
 const sys=FH.createRuntime(project,{});
 assert.equal(sys.wiredRoute(0,items.find(it=>it.id==='r'),outside,80),null);
});
test('parcelas superpuestas no conceden permisos de cableado ambiguos',()=>{
 const {items,project}=roomNetworkFixture(true);
 project.properties.push({id:'overlap',floorId:'f0',
  polygon:[{x:0,y:0},{x:10,y:0},{x:10,y:6},{x:0,y:6}]});
 const sys=FH.createRuntime(project,{});
 assert.equal(sys.wiredRoute(0,items.find(it=>it.id==='r'),items.find(it=>it.id==='c'),80),null);
});
test('las aplicaciones reportan menor velocidad si quedan menos barras',()=>{
 const {items,project}=roomNetworkFixture();
 items.find(it=>it.id==='r').wifiRadiusFt=150;
 const sys=FH.createRuntime(project,{});
 const close=sys.wifiAt(0,2.5,.2)[0];
 const distant=sys.wifiAt(0,10,5)[0];
 assert.equal(close.bars,3);
 if(distant)assert.ok(distant.speedFactor<=close.speedFactor);
});



test('la distancia de conexión eléctrica depende del cable del aparato, no del radio del enchufe',()=>{
  const {project,state,items}=fixture();
  const plug=items.find(it=>it.id==='plug');
  plug.radiusFt=.1; // Antes impedía enchufar cualquier equipo a más de 0.1 pies.
  const near={id:'new-near',type:'misc',x:3,y:3.6,outletId:'plug',zoneId:'a',
    service:{requiresPower:true,powerCableFt:5,watts:80}};
  items.push(near);
  const sys=FH.createRuntime(project,state);
  assert.equal(sys.statusFor(0,near).power.powered,true);
  assert.equal(sys.statusFor(0,near).power.via,'plug');
});

test('un cable de menos de cinco pies no alcanza un enchufe lejano',()=>{
  const {project,state,items}=fixture();
  const far={id:'new-far',type:'misc',x:3,y:4.1,outletId:'plug',zoneId:'a',
    service:{requiresPower:true,powerCableFt:5,watts:80}};
  items.push(far);
  const sys=FH.createRuntime(project,state);
  assert.equal(sys.statusFor(0,far).power.powered,false);
});

test('un enchufe admite como máximo dos conexiones y una regleta ocupa una',()=>{
  const {project,state,items}=fixture();
  items.find(it=>it.id==='plug').slots=8; // Un mapa antiguo no debe aumentar la capacidad física.
  const first={id:'new-a',type:'misc',x:3,y:3.3,outletId:'plug',zoneId:'a',
    service:{requiresPower:true,powerCableFt:5}};
  const second={id:'new-b',type:'misc',x:3,y:3.4,outletId:'plug',zoneId:'a',
    service:{requiresPower:true,powerCableFt:5}};
  items.push(first,second);
  const sys=FH.createRuntime(project,state);
  assert.equal(sys.statusFor(0,first).power.powered,true);
  assert.equal(sys.statusFor(0,second).power.powered,false);
  assert.equal(sys.statusFor(0,items.find(it=>it.id==='plug')).usedSlots,2);
  assert.equal(sys.statusFor(0,items.find(it=>it.id==='plug')).slotCapacity,2);
});

test('el multiconector conserva ranuras propias sin aumentar las del enchufe',()=>{
  const {project,state,items}=fixture();
  const client={id:'new-through-strip',type:'misc',x:3,y:3.5,outletId:'strip',zoneId:'a',
    service:{requiresPower:true,powerCableFt:5}};
  items.push(client);
  const sys=FH.createRuntime(project,state);
  assert.equal(sys.statusFor(0,client).power.powered,true);
  assert.equal(sys.statusFor(0,items.find(it=>it.id==='strip')).usedSlots,3);
  assert.equal(sys.statusFor(0,items.find(it=>it.id==='plug')).usedSlots,1);
});

function generatorFixture({kind='emergency',capacity=300,autonomy=72,targets,normal=false}={}){
 const panel={id:'panel',type:'breaker_panel',x:0,y:0,circuits:[{id:'a',zoneId:'a'},{id:'b',zoneId:'b'}]};
 const generator={id:'backup',type:'generator',generatorKind:kind,enabled:true,autonomyHours:autonomy,capacityWatts:capacity,
  targets:targets||[{floorId:'upper',panelId:'panel',circuitId:'a',priority:10},{floorId:'upper',panelId:'panel',circuitId:'b',priority:1}]};
 const roomA={id:'room-a',roomId:'A',type:'room',zoneId:'a',x:0,y:0,w:4,h:4};
 const roomB={id:'room-b',roomId:'B',type:'room',zoneId:'b',x:4,y:0,w:4,h:4};
 const a={id:'lamp-a',type:'light_fixture',roomId:'A',zoneId:'a',x:1,y:1,watts:200};
 const b={id:'lamp-b',type:'light_fixture',roomId:'B',zoneId:'b',x:5,y:1,watts:200};
 const project={schema:'forest-horror-map-v1',units:{feetPerCell:5},floors:[{id:'basement',items:[generator]},
  {id:'upper',items:[{id:'wall',type:'wall',a:{x:0,y:0},b:{x:8,y:0}},panel,roomA,roomB,a,b]}]};
 if(normal)project.floors[0].items.push({...generator,id:'normal',generatorKind:'normal',enabled:false});
 const state={flags:{}},sys=FH.createRuntime(project,state);
 return {project,state,sys,generator,panel,a,b,roomA,roomB};
}
test('generador de emergencia: espera, arranca desde sótano y conserva destinos prioritarios',()=>{
 const {sys,state,generator,a,b}=generatorFixture();
 assert.ok(sys.sourceFor(1,a));assert.ok(sys.sourceFor(1,b));
 sys.tick(60);assert.equal(sys.generatorStatus(0,generator).remainingHours,72);
 state.flags.power_global=false;
 assert.ok(sys.sourceFor(1,a)?.feed);assert.equal(sys.sourceFor(1,b),null);
 assert.equal(sys.generatorStatus(0,generator).watts,200);
 sys.tick(60);assert.equal(sys.generatorStatus(0,generator).remainingHours,71);
 state.flags.power_global=true;sys.tick(60);
 assert.equal(sys.generatorStatus(0,generator).running,false);
 assert.equal(sys.generatorStatus(0,generator).remainingHours,71);assert.ok(sys.sourceFor(1,b));
});
test('generador normal sustituye la red en destinos explícitos; apagado corta y admite respaldo',()=>{
 const {sys,generator,a,b}=generatorFixture({kind:'normal',capacity:500});
 assert.ok(sys.sourceFor(1,a)?.feed);sys.setGeneratorEnabled(0,'backup',false);
 assert.equal(sys.sourceFor(1,a),null);assert.equal(sys.sourceFor(1,b),null);
 sys.setGeneratorEnabled(0,'backup',true);assert.ok(sys.sourceFor(1,a));
 const backup=generatorFixture({normal:true,capacity:500});
 assert.ok(backup.sys.sourceFor(1,backup.a)?.feed);
 assert.equal(backup.sys.generatorStatus(0,backup.generator).running,true);
 backup.sys.setGeneratorEnabled(0,'normal',true);
 assert.equal(backup.sys.generatorStatus(0,backup.generator).running,false);
});
test('reserva se agota a mitad del tick sin regalar consumo eléctrico',()=>{
 const {sys,state,generator,a}=generatorFixture({autonomy:.5,capacity:200});
 state.flags.power_global=false;
 sys.tick(60);
 assert.equal(sys.generatorStatus(0,generator).remainingHours,0);
 assert.equal(sys.generatorStatus(0,generator).running,false);
 assert.equal(sys.sourceFor(1,a),null);assert.ok(Math.abs(sys.state.meters.kwh-.1)<1e-9);
});
test('guardado JSON conserva habilitación y reserva sin recargar ni consumir tiempo cerrado',()=>{
 const {sys,state,project,generator,a}=generatorFixture();state.flags.power_global=false;sys.tick(60);
 sys.setGeneratorEnabled(0,'backup',false);
 const saved=JSON.parse(JSON.stringify(state)),restored=FH.createRuntime(project,saved);
 assert.equal(restored.generatorStatus(0,generator).remainingHours,71);
 assert.equal(restored.generatorStatus(0,generator).enabled,false);assert.equal(restored.sourceFor(1,a),null);
 restored.setGeneratorEnabled(0,'backup',true);assert.ok(restored.sourceFor(1,a));
 assert.equal(restored.generatorStatus(0,generator).remainingHours,71);
});
test('respaldo respeta palancas, cortes de zona, flags del circuito y panel dañado',()=>{
 for(const flag of ['power_breaker:panel:a','power_zone:a','panel','custom']){
  const fx=generatorFixture();fx.panel.powerFlag=flag==='custom'?'custom':'';
  fx.state.flags={power_global:false,[flag]:false};
  assert.equal(FH.createRuntime(fx.project,fx.state).sourceFor(1,fx.a),null,flag);
 }
 const fx=generatorFixture();fx.state.flags.power_global=false;fx.sys.state.damage.panel=100;
 assert.equal(fx.sys.sourceFor(1,fx.a),null);
});
test('destinos ausentes, referencias inválidas y reserva cero no crean electricidad',()=>{
 for(const opts of [{targets:[]},{targets:[{floorId:'missing',panelId:'panel',circuitId:'a'}]},{autonomy:0},{capacity:0}]){
  const {sys,state,a}=generatorFixture(opts);state.flags.power_global=false;
  assert.equal(sys.sourceFor(1,a),null);
 }
});
test('selección por habitación no alimenta otra habitación del mismo circuito',()=>{
 const fx=generatorFixture({capacity:500,targets:[{floorId:'upper',panelId:'panel',circuitId:'a',roomId:'A',priority:1}]});
 fx.b.zoneId='a';fx.roomB.zoneId='a';fx.state.flags.power_global=false;
 assert.ok(fx.sys.sourceFor(1,fx.a));assert.equal(fx.sys.sourceFor(1,fx.b),null);
});
test('capacidad contempla equipos enchufados y reserva la potencia antes de conceder otro destino',()=>{
 const fx=generatorFixture({capacity:400});
 const outlet={id:'outlet',type:'power_outlet',zoneId:'a',roomId:'A',x:1,y:0};
 const pc={id:'pc',type:'misc',zoneId:'a',roomId:'A',outletId:'outlet',x:1,y:.5,service:{requiresPower:true,watts:150}};
 fx.project.floors[1].items.push(outlet,pc);
 fx.state.flags.power_global=false;const sys=FH.createRuntime(fx.project,fx.state);
 assert.equal(sys.statusFor(1,pc).power.powered,true);assert.equal(sys.sourceFor(1,fx.b),null);
 assert.equal(sys.generatorStatus(0,fx.generator).watts,350);
});
test('sin generador opcional un apagón sigue cortando ambos circuitos',()=>{
 const fx=generatorFixture();fx.project.floors[0].items=[];
 const sys=FH.createRuntime(fx.project,fx.state);fx.state.flags.power_global=false;
 assert.equal(sys.sourceFor(1,fx.a),null);assert.equal(sys.sourceFor(1,fx.b),null);
});

test('horas de juego escaladas, pausa y corte de un solo piso',()=>{
 const fx=generatorFixture();fx.state.flags['power_floor:upper']=false;
 fx.sys.tick(10,0);assert.equal(fx.sys.generatorStatus(0,fx.generator).remainingHours,72);
 fx.sys.tick(30,4);assert.equal(fx.sys.generatorStatus(0,fx.generator).remainingHours,70);
 assert.ok(fx.sys.sourceFor(1,fx.a));
});
test('dos habitaciones del mismo circuito reciben prioridades independientes',()=>{
 const fx=generatorFixture({capacity:200,targets:[
  {floorId:'upper',panelId:'panel',circuitId:'a',roomId:'B',priority:1},
  {floorId:'upper',panelId:'panel',circuitId:'a',roomId:'A',priority:9}]});
 fx.b.zoneId='a';fx.roomB.zoneId='a';fx.state.flags.power_global=false;
 const sys=FH.createRuntime(fx.project,fx.state);
 assert.ok(sys.sourceFor(1,fx.a));assert.equal(sys.sourceFor(1,fx.b),null);
 fx.state.flags['light_room:upper:A']=false;
 assert.ok(sys.sourceFor(1,fx.b),'apagar luces prioritarias libera capacidad');
});
test('carga sin datos usa 200 W en generador sin alterar el consumo de mapas antiguos',()=>{
 const fx=generatorFixture({capacity:300});delete fx.a.watts;delete fx.b.watts;
 fx.sys.tick(60);assert.equal(fx.sys.state.meters.kwh,0);
 fx.state.flags.power_global=false;fx.sys.tick(60);
 assert.equal(fx.sys.state.meters.kwh,.2);assert.equal(fx.sys.generatorStatus(0,fx.generator).watts,200);
 assert.equal(fx.sys.sourceFor(1,fx.b),null);
});
test('referencia malformada no bloquea mapas y un generador dañado no suministra',()=>{
 const fx=generatorFixture({targets:[null,{},42]});fx.state.flags.power_global=false;
 assert.equal(fx.sys.sourceFor(1,fx.a),null);
 const valid=generatorFixture();valid.state.flags.power_global=false;valid.sys.state.damage.backup=100;
 assert.equal(valid.sys.sourceFor(1,valid.a),null);
});
test('un destino recortado no transfiere carga a un segundo panel sin capacidad reservada',()=>{
 const fx=generatorFixture({capacity:200});
 const second={id:'other',type:'breaker_panel',x:1,y:0,circuits:[{id:'b',zoneId:'b'}]};
 const other={id:'g2',type:'generator',generatorKind:'emergency',enabled:true,capacityWatts:100,autonomyHours:24,
  targets:[{floorId:'upper',panelId:'other',circuitId:'b',priority:1}]};
 fx.project.floors[1].items.push(second);fx.project.floors[0].items.push(other);fx.state.flags.power_global=false;
 const sys=FH.createRuntime(fx.project,fx.state);
 assert.equal(sys.sourceFor(1,fx.b),null);
 assert.ok(sys.generatorStatus(0,other).watts<=100);
});

function accessoriesFixture({roll=.5,liters=120,rate=5}={}){
 const fx=generatorFixture({capacity:500});
 const ats={id:'ats',type:'generator_ats'},tank={id:'tank',type:'generator_tank',capacityLiters:liters};
 fx.project.floors[0].items.push(ats,tank);
 Object.assign(fx.generator,{atsId:'ats',atsFloorId:'basement',tankId:'tank',tankFloorId:'basement',fuelLitersPerHour:rate});
 let rolls=0;
 fx.sys=FH.createRuntime(fx.project,fx.state,{random:()=>{rolls++;return roll;}});
 return {...fx,ats,tank,rolls:()=>rolls};
}
test('ATS: una tirada por apagón, fallo exacto por debajo de 10 %, sin consumir reserva',()=>{
 const fx=accessoriesFixture({roll:.099999});fx.state.flags.power_global=false;
 for(let i=0;i<10;i++)assert.equal(fx.sys.sourceFor(1,fx.a),null);
 fx.sys.tick(60);assert.equal(fx.rolls(),1);assert.equal(fx.sys.atsStatus(0,fx.ats).mode,'failed');
 assert.equal(fx.sys.tankStatus(0,fx.tank).liters,120);
 fx.sys.setGeneratorEnabled(0,'backup',false);fx.sys.setGeneratorEnabled(0,'backup',true);
 assert.equal(fx.rolls(),1);assert.equal(fx.sys.sourceFor(1,fx.a),null);
});
test('ATS: éxito desde 0.10, retorno de principal y nuevo intento en otro apagón',()=>{
 const fx=accessoriesFixture({roll:.1});fx.state.flags.power_global=false;
 assert.ok(fx.sys.sourceFor(1,fx.a));assert.equal(fx.rolls(),1);
 fx.sys.tick(60);assert.equal(fx.sys.tankStatus(0,fx.tank).liters,115);
 fx.state.flags.power_global=true;fx.sys.tick(60);
 assert.equal(fx.sys.atsStatus(0,fx.ats).mode,'idle');assert.equal(fx.sys.tankStatus(0,fx.tank).liters,115);
 fx.state.flags.power_global=false;assert.ok(fx.sys.sourceFor(1,fx.a));assert.equal(fx.rolls(),2);
});
test('ATS: fallo y transferencia manual persisten sin repetir azar al cargar',()=>{
 const fx=accessoriesFixture({roll:0});fx.state.flags.power_global=false;fx.sys.tick(.1);
 let rolled=0;const state=JSON.parse(JSON.stringify(fx.state));
 const restored=FH.createRuntime(fx.project,state,{random:()=>{rolled++;return .9;}});
 assert.equal(restored.atsStatus(0,fx.ats).mode,'failed');assert.equal(rolled,0);assert.equal(restored.sourceFor(1,fx.a),null);
 assert.equal(restored.activateATSManual(0,'ats'),true);assert.ok(restored.sourceFor(1,fx.a));
 const again=FH.createRuntime(fx.project,JSON.parse(JSON.stringify(state)),{random:()=>{throw Error('no repetir tirada');}});
 assert.equal(again.atsStatus(0,fx.ats).mode,'manual');assert.ok(again.sourceFor(1,fx.a));
});
test('ATS: corte de breaker no inicia apagón; manual sin apagón o tablero dañado se rechaza',()=>{
 const fx=accessoriesFixture();fx.state.flags['power_breaker:panel:a']=false;
 assert.equal(fx.sys.sourceFor(1,fx.a),null);assert.equal(fx.rolls(),0);assert.equal(fx.sys.activateATSManual(0,'ats'),false);
 fx.state.flags.power_global=false;fx.sys.state.damage.ats=100;
 assert.equal(fx.sys.sourceFor(1,fx.b),null);assert.equal(fx.sys.activateATSManual(0,'ats'),false);
});
test('tanque: 120 L a 5 L/h son 24 horas, sin sumar autonomía del generador',()=>{
 const fx=accessoriesFixture();assert.equal(fx.sys.generatorStatus(0,fx.generator).remainingHours,24);
 fx.state.flags.power_global=false;fx.sys.tick(60,12);
 assert.equal(fx.sys.generatorStatus(0,fx.generator).remainingHours,12);assert.equal(fx.sys.tankStatus(0,fx.tank).liters,60);
 const restored=FH.createRuntime(fx.project,JSON.parse(JSON.stringify(fx.state)));
 assert.equal(restored.generatorStatus(0,fx.generator).remainingHours,12);assert.equal(restored.tankStatus(0,fx.tank).liters,60);
});
test('tanque: agotamiento durante un tick, litros nunca negativos y reserva antigua no revive',()=>{
 const fx=accessoriesFixture({liters:2.5,rate:5});fx.state.flags.power_global=false;fx.sys.tick(60);
 assert.equal(fx.sys.tankStatus(0,fx.tank).liters,0);assert.equal(fx.sys.generatorStatus(0,fx.generator).remainingHours,0);
 assert.equal(fx.sys.sourceFor(1,fx.a),null);assert.ok(Math.abs(fx.sys.state.meters.kwh-.2)<1e-9);
 const restored=FH.createRuntime(fx.project,JSON.parse(JSON.stringify(fx.state)));
 assert.equal(restored.sourceFor(1,fx.a),null);
});
test('accesorios: enlaces inválidos, compartidos o consumo cero no suministran energía gratis',()=>{
 for(const change of [fx=>fx.generator.tankId='missing',fx=>fx.generator.atsId='missing',fx=>fx.generator.fuelLitersPerHour=0,
  fx=>fx.project.floors[0].items.push({...fx.generator,id:'other'})]){
  const fx=accessoriesFixture();change(fx);fx.state.flags.power_global=false;
  const runtime=FH.createRuntime(fx.project,fx.state,{random:()=>.5});assert.equal(runtime.sourceFor(1,fx.a),null);
 }
});
test('ATS: enlaces entre pisos funcionan y el estado no afecta a edificios sin ATS',()=>{
 const fx=accessoriesFixture({roll:0});
 fx.project.floors[0].items.splice(fx.project.floors[0].items.indexOf(fx.ats),1);
 fx.project.floors[1].items.push(fx.ats);fx.generator.atsFloorId='upper';fx.state.flags.power_global=false;
 const runtime=FH.createRuntime(fx.project,fx.state,{random:()=>0});
 assert.equal(runtime.sourceFor(1,fx.a),null);assert.equal(runtime.activateATSManual(1,'ats'),true);assert.ok(runtime.sourceFor(1,fx.a));
 const legacy=generatorFixture();legacy.state.flags.power_global=false;assert.ok(legacy.sys.sourceFor(1,legacy.a));
});
