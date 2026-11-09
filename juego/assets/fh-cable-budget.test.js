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
test('los límites 30/60/120 ft dependen del tipo y no se amplían con overrides',()=>{
 for(const [type,feet] of [['small',30],['medium',60],['large',120]]){
  const breaker=panel('p',0,0,type,999),inside={id:'inside',type:'light_fixture',zoneId:'a',x:feet/5,y:0};
  const outside={...inside,id:'outside',x:feet/5+.01};
  const system=run([line({x:0,y:0},{x:30,y:0}),breaker,inside,outside]);
  assert.equal(system.sourceFor(0,inside).rangeFt,feet);
  assert.equal(system.statusFor(0,inside).power.powered,true);
  assert.equal(system.statusFor(0,outside).power.powered,false);
 }
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
 const items=[line({x:0,y:0},{x:12,y:0}),near,far,first,second,panel('p')];
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
 const breaker=panel('p'),outlet={id:'plug',type:'power_outlet',zoneId:'a',x:5,y:0,slots:2};
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
 const small=panel('small',0,8,'small'),medium=panel('medium',0,8,'medium');
 const lamp={id:'l',type:'light_fixture',zoneId:'a',x:1,y:0};
 const system=run([line({x:0,y:0},{x:1,y:0}),small,medium,lamp]);
 assert.equal(system.sourceFor(0,lamp).panel.id,'medium');assert.equal(system.sourceFor(0,lamp).feet,45);
});
