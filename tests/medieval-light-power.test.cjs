/* node --test tests/medieval-light-power.test.cjs */
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const medieval=require('../juego/assets/fh-medieval-lighting.js');
const services=require('../juego/assets/fh-services-core.js');

test('las nueve luminarias medievales funcionan durante un apagón, sin carga ni circuitos',()=>{
 assert.equal(Object.keys(medieval.definitions).length,9);
 for(const [kind,spec] of Object.entries(medieval.definitions)){
  // Los campos eléctricos heredados no convierten una antorcha en aparato eléctrico.
  const it={id:'fixture-'+kind,type:'light_fixture',lightKind:kind,x:2,y:2,zoneId:'main',
   service:{requiresPower:true,rayos:10,watts:9999},lightFuelMinutes:spec.fuelMinutes};
  const map={schema:'forest-horror-map-v1',units:{feetPerCell:5},floors:[{id:'PB',items:[it]}]};
  const state={flags:{power_global:false},inventory:[],clock:{year:2026,month:11,day:23,minutes:100}};
  const power=services.createRuntime(map,state,{electricityEnabled:false});
  assert.equal(services.requiresPower(it),false,kind);
  assert.equal(power.requiresPower(it),false,kind);
  assert.equal(power.statusFor(0,it).power.required,false,kind);
  assert.equal(power.statusFor(0,it).loadingRayos,0,kind);
  assert.equal(power.zoneFor(0,it),'',kind);
  const light=medieval.createRuntime({floors:map.floors,state,clock:()=>100});
  assert.equal(light.lit(0,it),true,kind);
 }
});

test('una lámpara eléctrica moderna sigue exigiendo corriente',()=>{
 const bulb={id:'bulb',type:'light_fixture',lightKind:'bulb',x:2,y:2};
 const map={schema:'forest-horror-map-v1',floors:[{id:'PB',items:[bulb]}]};
 const runtime=services.createRuntime(map,{}, {electricityEnabled:false});
 assert.equal(services.requiresPower(bulb),true);
 assert.equal(runtime.requiresPower(bulb),true);
 assert.equal(runtime.statusFor(0,bulb).power.powered,false);
});

test('editor: iluminación general, fuentes medievales fuera de conexiones eléctricas',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.match(html,/data-layer="lighting">✦ Iluminación/);
 assert.match(html,/data-cat="lighting">✦ Iluminación/);
 assert.match(html,/if\(!isMedievalLight\(it\)\)it\.zoneId=/);
 assert.match(html,/roomCircuitAssignments\(electricalCircuitItems\(objects\),room,zone\)/);
 assert.match(html,/if\(isMedievalLight\(it\)\)return;/);
 assert.match(html,/it\.type==='light_fixture'&&!isMedievalLight\(it\)\)put\('Conectado al circuito'/);
 assert.match(html,/magicSource:window\.FH_MEDIEVAL_LIGHT_TEXT\.fuelSource|magicSource:window\.FH_MEDIEVAL_LIGHT_TEXT\.magicSource/);
});
