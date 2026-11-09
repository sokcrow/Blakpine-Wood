'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const FH=require('./fh-services-core.js');
const line=(a,b)=>({id:'wall-'+a.x+','+a.y+':'+b.x+','+b.y,type:'wall',a,b});
const panel=(id,x=0,y=0,type='small',range)=>({id,type:'breaker_panel',breakerType:type,x,y,zoneId:'a',circuits:[{id:'c-'+id,zoneId:'a',...(range===undefined?{}:{rangeFt:range})}]});
const run=(items,state={},feetPerCell=5)=>FH.createRuntime({schema:'forest-horror-map-v1',units:{feetPerCell},floors:[{id:'f',items}]},state);

test('dos lados de un tile de 5 ft consumen 10 ft, sin atajo diagonal',()=>{
 const breaker=panel('p',0,0,'small',10),lamp={id:'lamp',type:'light_fixture',zoneId:'a',x:1,y:1,wallId:'w'};
 const items=[line({x:0,y:0},{x:1,y:0}),line({x:1,y:0},{x:1,y:1}),breaker,lamp];
 const system=run(items),source=system.sourceFor(0,lamp);
 assert.equal(source.feet,10);assert.equal(system.statusFor(0,lamp).power.powered,true);
 assert.ok(source.route.points.some(p=>p.x===1&&p.y===0));
 breaker.circuits[0].rangeFt=9.99;assert.equal(run(items).statusFor(0,lamp).power.powered,false);
});
test('el acercamiento del breaker a la pared y el ramal de techo también gastan cable',()=>{
 const breaker=panel('p',0,.2,'small',15),lamp={id:'lamp',type:'light_fixture',zoneId:'a',x:2,y:1};
 const items=[line({x:0,y:0},{x:2,y:0}),breaker,lamp];
 assert.equal(run(items).powerRoute(0,breaker,lamp).feet,16);
 assert.equal(run(items).statusFor(0,lamp).power.powered,false);
 breaker.circuits[0].rangeFt=16;assert.equal(run(items).statusFor(0,lamp).power.powered,true);
});
test('los límites 90/180/360 ft dependen del tipo y no se amplían con overrides',()=>{
 for(const [type,feet] of [['small',90],['medium',180],['large',360]]){
  const breaker=panel('p',0,0,type,999),inside={id:'inside',type:'light_fixture',zoneId:'a',x:feet/5,y:0};
  const outside={...inside,id:'outside',x:feet/5+.01};
  const system=run([line({x:0,y:0},{x:feet/5+1,y:0}),breaker,inside,outside]);
  assert.equal(system.sourceFor(0,inside).rangeFt,feet);
  assert.equal(system.statusFor(0,inside).power.powered,true);
  assert.equal(system.statusFor(0,outside).power.powered,false);
 }
});
test('alcances predeterminados, vatios y valores explícitos de mapas anteriores',()=>{
 for(const [type,feet,watts] of [['small',90,1200],['medium',180,2400],['large',360,4800]]){
  const breaker=panel('p',0,0,type);
  assert.equal(FH.rangeFor(breaker),feet);
  assert.equal(FH.rangeFor(breaker,breaker.circuits[0]),feet);
  assert.equal(FH.LIMITS[type].capacityWatts,watts);
  breaker.rangeFt=18;
  assert.equal(FH.rangeFor(breaker),18,'respetar distancia explícita en panel');
  assert.equal(FH.rangeFor(breaker,{rangeFt:0}),0,'0 ft explícitos deben mantenerse');
  assert.equal(FH.rangeFor(breaker,{rangeFt:12}),12,'prioridad al circuito');
  assert.equal(FH.rangeFor(breaker,{rangeFt:9999}),feet,'nunca superar el máximo');
 }
});
test('un mapa existente con alcance cero continúa sin suministrar energía',()=>{
 const breaker=panel('old',0,0,'large',0);
 const lamp={id:'lamp',type:'light_fixture',zoneId:'a',x:1,y:0};
 assert.equal(run([line({x:0,y:0},{x:1,y:0}),breaker,lamp]).statusFor(0,lamp).power.powered,false);
});
test('puertas abiertas y cerradas no interrumpen la electricidad ni regalan su longitud',()=>{
 for(const open of [false,true]){
  const breaker=panel('p',0,0,'small',10),lamp={id:'l',type:'light_fixture',zoneId:'a',x:2,y:0};
  const system=run([line({x:0,y:0},{x:1,y:0}),{id:'d',type:'door',a:{x:1,y:0},b:{x:2,y:0},open},breaker,lamp]);
  assert.equal(system.sourceFor(0,lamp).feet,10);assert.equal(system.statusFor(0,lamp).power.powered,true);
 }
});
test('una zona con varias habitaciones no se energiza completa por tener un breaker',()=>{
 const near={id:'a',type:'room',roomId:'a',zoneId:'a',x:0,y:0,w:4,h:2};
 const far={id:'b',type:'room',roomId:'b',zoneId:'a',x:8,y:0,w:4,h:2};
 const first={id:'l1',type:'light_fixture',roomId:'a',x:2,y:1},second={id:'l2',type:'light_fixture',roomId:'b',x:10,y:1};
 const items=[line({x:0,y:0},{x:12,y:0}),near,far,first,second,panel('p',0,0,'small',30)];
 assert.equal(run(items).statusFor(0,first).power.powered,true);
 assert.equal(run(items).statusFor(0,second).power.powered,false);
 items.push(panel('p2',12));assert.equal(run(items).statusFor(0,second).power.powered,true);
});
test('luces, aparatos de catálogo y electrónicos antiguos están sin energía por defecto',()=>{
 const items=[{id:'lamp',type:'light_fixture',x:0,y:0},
  {id:'tv',type:'tv',x:0,y:0,service:{requiresPower:false}},
  ...['refrigerador','microondas','monitor_crt','gabinete_pc','escritorio_pc','camara_seguridad','teclado_pc'].map(modelId=>({id:modelId,type:'misc',modelId,x:0,y:0,service:{requiresPower:false}}))];
 const system=run(items);
 for(const item of items){assert.equal(system.requiresPower(item),true,item.id);assert.equal(system.statusFor(0,item).power.powered,false,item.id)}
});
test('un multiconector no extiende el alcance del breaker: se suma también el cable del aparato',()=>{
 const breaker=panel('p',0,0,'small',30),outlet={id:'plug',type:'power_outlet',zoneId:'a',x:5,y:0,slots:2};
 const strip={id:'strip',type:'power_strip',x:5.8,y:0,outletId:'plug',radiusFt:5,slots:3};
 const a={id:'a',type:'tv',x:6,y:0,outletId:'strip'},b={id:'b',type:'tv',x:6.1,y:0,outletId:'strip'};
 const system=run([line({x:0,y:0},{x:10,y:0}),breaker,outlet,strip,a,b]);
 assert.equal(system.statusFor(0,a).power.feet,30);assert.equal(system.statusFor(0,a).power.powered,true);
 assert.equal(system.statusFor(0,b).power.powered,false);
 system.state.enabled.p=false;assert.equal(system.statusFor(0,a).power.powered,false);
 system.state.enabled.p=true;system.state.enabled.plug=false;assert.equal(system.statusFor(0,a).power.powered,false);
});
test('la escala del mapa determina los pies recorridos por lado',()=>{
 const breaker=panel('p'),lamp={id:'l',type:'light_fixture',zoneId:'a',x:1,y:1};
 const items=[line({x:0,y:0},{x:1,y:0}),line({x:1,y:0},{x:1,y:1}),breaker,lamp];
 assert.equal(run(items,{},10).sourceFor(0,lamp).feet,20);
});
test('dos breakers en el mismo punto conservan su alcance propio en la caché',()=>{
 const small=panel('small',0,8,'small',30),medium=panel('medium',0,8,'medium');
 const lamp={id:'l',type:'light_fixture',zoneId:'a',x:1,y:0};
 const system=run([line({x:0,y:0},{x:1,y:0}),small,medium,lamp]);
 assert.equal(system.sourceFor(0,lamp).panel.id,'medium');assert.equal(system.sourceFor(0,lamp).feet,45);
});
for(const withStrip of [false,true]){
 test('el aparato elige un breaker que cubre todo el cable, con multiconector='+withStrip,()=>{
  const small=panel('small',5,0,'small',30),large=panel('large',0,0,'large');
  const outlet={id:'plug',type:'power_outlet',zoneId:'a',x:5,y:0,radiusFt:40,slots:2};
  const strip={id:'strip',type:'power_strip',x:5,y:1,outletId:'plug',radiusFt:40,slots:3};
  // Caso especial de cable largo: el alcance pertenece al aparato, no al enchufe.
  const tv={id:'tv',type:'tv',x:5,y:7,outletId:withStrip?'strip':'plug',service:{powerCableFt:40}};
  const items=[line({x:0,y:0},{x:6,y:0}),small,large,outlet,...(withStrip?[strip]:[]),tv];
  const system=run(items);
  assert.equal(system.sourceFor(0,outlet).panel.id,'small','el panel cercano llega al enchufe');
  assert.equal(system.statusFor(0,tv).power.powered,true);
  assert.equal(system.statusFor(0,tv).power.breakerId,'large');assert.equal(system.statusFor(0,tv).power.feet,60);
  assert.equal(run(items.filter(it=>it!==small)).statusFor(0,tv).power.powered,true);
  system.state.enabled.large=false;assert.equal(system.statusFor(0,tv).power.powered,false);
 });
}
