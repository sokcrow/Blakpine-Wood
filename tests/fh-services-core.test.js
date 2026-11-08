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
  {id:'sink',type:'kitchen',x:3,y:3.3,service:{requiresWater:true,flowLpm:5,drains:true}}
 ];
 const project={schema:'forest-horror-map-v1',units:{feetPerCell:5},floors:[{id:'f0',items}]};
 const state={phone:{battery:20}};
 return {project,state,items,sys:FH.createRuntime(project,state)};
}
test('compatibilidad: mapa anterior sin dispositivos usa estado heredado',()=>{
 const project={schema:'forest-horror-map-v1',units:{feetPerCell:5},floors:[{id:'f',items:[{id:'tv',type:'tv',x:1,y:1}]}]};
 const sys=FH.createRuntime(project,{});
 assert.equal(sys.statusFor(0,project.floors[0].items[0]).power.legacy,true);
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
 assert.equal(sys.statusFor(0,items.find(it=>it.id==='plug')).loadingRayos,3);
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
 const {sys}=fixture();
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
