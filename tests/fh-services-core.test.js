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

