'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const api=require('./fh-exterior-grid.js');
const fixture=(items,services={},flags={})=>api.createRuntime({units:{feetPerCell:5},floors:[{id:'calle',elevationFt:0,items}]},{services,flags});
const obj=(id,modelId,x,y=0,extra={})=>({id,type:'misc',modelId,x,y,...extra});
const tx=(id='trafo',x=0,extra={})=>obj(id,'transformador_poste_simple',x,0,extra);
const lamp=(id,x)=>obj(id,'poste_luz_con_brazo',x);
const panel=(id,x,extra={})=>({id,type:'breaker_panel',x,y:0,...extra});

test('catálogo técnico: ocho tipos con roles definidos y sin activar mobiliario ajeno',()=>{
 assert.equal(Object.keys(api.CONFIG).length,8);
 assert.equal(api.roleFor(obj('a','caja_distribucion_exterior',0)),'junction');
 assert.equal(api.roleFor({modelId:'generador_portatil'}),null);
});
test('cable desde transformador a poste y breaker: conexión real por distancia',()=>{
 const p=panel('casa',18); // 90 pies desde transformador, 40 pies desde poste
 const grid=fixture([tx(),obj('poste','poste_luz_concreto',10),lamp('alumbrado',15),p]);
 assert.equal(grid.hasTransformers,true);
 assert.equal(grid.nodes.length,3);
 assert.equal(grid.links().length,2);
 assert.equal(grid.links().every(e=>e.powered),true);
 assert.equal(grid.panelConnection(0,p)?.powered,true);
 assert.equal(grid.panelLinks().length,1);
});
test('una casa fuera de cobertura y postes separados no reciben corriente',()=>{
 const p=panel('casa',32),grid=fixture([tx(),lamp('lejos',35),p]);
 assert.equal(grid.links().length,0);
 assert.equal(grid.energized(grid.nodes[1]),false);
 assert.equal(grid.panelConnection(0,p),null);
});
test('un apagón, contrato suspendido o transformador dañado desconecta la red',()=>{
 const items=[tx(),lamp('farola',4),panel('casa',5)];
 for(const state of [{flags:{power_global:false}},{services:{contracts:{electricity:'suspended'}}},
  {services:{damage:{trafo:100}}},{services:{enabled:{trafo:false}}}]){
  const grid=fixture(items,state.services||{},state.flags||{});
  assert.equal(grid.energized(grid.nodes[1]),false);
  assert.equal(grid.panelConnection(0,items[2])?.powered,false);
 }
});
test('deshabilitar un eslabón intermedio deja sin corriente su ramal',()=>{
 const grid=fixture([tx(),obj('intermedio','poste_luz_concreto',10,0,{exteriorGridEnabled:false}),lamp('final',20)]);
 assert.equal(grid.links().length,2);
 assert.equal(grid.energized(grid.nodes[2]),false);
});
test('no hay electricidad exterior si no hay transformador, aunque existan postes',()=>{
 const grid=fixture([lamp('farola',0),panel('casa',1)]);
 assert.equal(grid.hasTransformers,false);
 assert.equal(grid.panelConnection(0,panel('casa',1)),null);
 assert.equal(grid.energized(grid.nodes[0]),false);
});
test('una conexión de generador respeta la distancia sin modificar combustible',()=>{
 const g={id:'generador',type:'generator',x:10,y:0};
 const grid=fixture([tx(),g]);
 assert.equal(grid.generatorConnection(0,g)?.powered,true);
 assert.equal(grid.generatorConnection(0,{...g,x:100}),null);
 assert.deepEqual(Object.keys(g).sort(),['id','type','x','y']);
});
test('la fuente más cercana energizada prevalece sobre un transformador averiado',()=>{
 const p=panel('p',12),grid=fixture([tx('averiado',10),tx('activo',0),p],{damage:{averiado:100}});
 assert.equal(grid.panelConnection(0,p)?.powered,true);
 assert.equal(grid.panelConnection(0,p)?.nodeId,'activo');
});

test('la carga eléctrica se inicializa y persiste al margen de un tanque de combustible',()=>{
 const g={generatorKind:'emergency',autonomyHours:12,electricCapacityHours:8};
 assert.equal(api.initialElectricCharge(g,{remainingHours:2},false),2); // Estado previo sin tanque.
 assert.equal(api.initialElectricCharge(g,{remainingHours:2},true),8); // Las 2 h procedían del combustible.
 assert.equal(api.initialElectricCharge(g,{electricChargeHours:3},true),3);
 const restored=JSON.parse(JSON.stringify({electricChargeHours:3,fuelLiters:45}));
 assert.equal(api.initialElectricCharge(g,restored,true),3);
});
test('la recarga automática no genera combustible y no supera la capacidad',()=>{
 const gen={generatorKind:'emergency',electricCapacityHours:10,rechargeHoursPerHour:4,tankId:'tanque'};
 const saved={electricChargeHours:1};const fuelTank={liters:27};
 const before=JSON.stringify(fuelTank);
 assert.equal(api.changeElectricCharge(saved,gen,2,'charge'),9);
 assert.equal(api.changeElectricCharge(saved,gen,20,'charge'),10);
 assert.equal(JSON.stringify(fuelTank),before);
 assert.equal(api.changeElectricCharge(saved,gen,3,'discharge'),7);
 assert.equal(api.changeElectricCharge(saved,gen,200,'discharge'),0);
 assert.equal(api.changeElectricCharge(saved,gen,1,'discharge'),0);
});
test('una pérdida de red impide recargar la reserva del generador',()=>{
 const g={id:'emergencia',type:'generator',x:3,y:0,generatorKind:'emergency'};
 const items=[tx(),g];const saved={electricChargeHours:0};
 for(const flags of [{},{power_global:false}]){
  const grid=fixture(items,{},flags),eligible=grid.generatorConnection(0,g)?.powered===true;
  if(eligible)api.changeElectricCharge(saved,g,1,'charge');
 }
 assert.equal(saved.electricChargeHours,4); // Sólo la hora con transformador activo.
});
test('la batería y el combustible no se mezclan al descargar',()=>{
 const saved={electricChargeHours:6},tank={liters:4};const g={electricCapacityHours:12};
 api.changeElectricCharge(saved,g,2,'discharge');
 assert.equal(saved.electricChargeHours,4);
 assert.equal(tank.liters,4);
});


test('enlace manual selecciona el poste solicitado y nunca conecta por decoración',()=>{
 const a=tx(),b=obj('p1','poste_luz_concreto',8),c=lamp('farola',16);
 c.exteriorLinkMode='manual';c.exteriorParentId='p1';
 const grid=fixture([a,b,c]);
 const link=grid.links().find(l=>l.to.id==='farola');
 assert.equal(link?.from.id,'p1');
 assert.equal(link?.manual,true);
 assert.equal(grid.energized(grid.nodes[2]),true);
});
test('una desconexión manual apaga una rama, sin reconectar a escondidas',()=>{
 const a=tx(),b=obj('p1','poste_luz_concreto',10,{exteriorLinkMode:'off'}),
  c=lamp('farola',20);
 c.exteriorLinkMode='manual';c.exteriorParentId='p1';
 const grid=fixture([a,b,c]);
 assert.equal(grid.links().length,0);
 assert.equal(grid.energized(grid.nodes[1]),false);
 assert.equal(grid.energized(grid.nodes[2]),false);
});
test('una referencia manual inexistente no inventa un cable ni cambia el JSON',()=>{
 const l=lamp('lampara',5);l.exteriorLinkMode='manual';l.exteriorParentId='ausente';
 const before=JSON.stringify(l),grid=fixture([tx(),l]);
 assert.equal(grid.links().length,0);
 assert.equal(grid.energized(grid.nodes[1]),false);
 assert.equal(JSON.stringify(l),before);
});
test('capacidad distinta entre transformador sencillo, doble y de superficie',()=>{
 const ids=['transformador_poste_simple','transformador_poste_doble','transformador_caja_superficie'];
 const expected=[12000,30000,60000];
 ids.forEach((id,i)=>{
  const grid=fixture([obj('t',id,0)]);
  assert.equal(grid.capacityWatts(grid.nodes[0]),expected[i]);
 });
});
test('un transformador corta el exceso de demanda y no deja pasar más watts',()=>{
 const first=panel('a',2,{capacityWatts:7500}),second=panel('b',3,{capacityWatts:7500});
 const grid=fixture([tx(),first,second]);
 assert.equal(grid.panelConnection(0,first)?.powered,true);
 assert.equal(grid.panelConnection(0,second)?.powered,false);
 assert.equal(grid.panelConnection(0,second)?.reason,'capacity');
 assert.equal(grid.panelConnection(0,second)?.availableWatts,4500);
});
test('transformador de mayor capacidad alimenta ambos edificios sin apagón',()=>{
 const first=panel('a',2,{capacityWatts:7500}),second=panel('b',3,{capacityWatts:7500});
 const grid=fixture([obj('t','transformador_poste_doble',0),first,second]);
 assert.equal(grid.panelConnection(0,first)?.powered,true);
 assert.equal(grid.panelConnection(0,second)?.powered,true);
 assert.equal(grid.consumers(grid.nodes[0]).breakers.length,2);
});
test('breaker con enlace específico se conecta a ese nodo aunque haya otro cercano',()=>{
 const one=tx('t1',0),two=tx('t2',14);
 const p=panel('casa',12,{exteriorConnectionMode:'manual',exteriorNodeId:'t1'});
 const grid=fixture([one,two,p]);
 assert.equal(grid.panelConnection(0,p)?.nodeId,'t1');
 p.exteriorConnectionMode='off';
 const gridOff=fixture([one,two,p]);
 assert.equal(gridOff.panelConnection(0,p),null);
});
test('fallo eléctrico interrumpe farola y alimentación de breaker hasta restablecimiento',()=>{
 const state={flags:{}},p=panel('casa',7);
 const project={units:{feetPerCell:5},floors:[{id:'calle',elevationFt:0,
  items:[tx(),lamp('l',5),p]}]};
 const grid=api.createRuntime(project,state);
 assert.equal(grid.energized(grid.nodes[1]),true);
 assert.equal(grid.panelConnection(0,p)?.powered,true);
 state.flags.power_global=false;
 assert.equal(grid.energized(grid.nodes[1]),false);
 assert.equal(grid.panelConnection(0,p)?.powered,false);
 state.flags.power_global=true;
 assert.equal(grid.panelConnection(0,p)?.powered,true);
});
