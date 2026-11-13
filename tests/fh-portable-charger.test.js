'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const FH=require('../juego/assets/fh-services-core.js');
const Phone=require('../juego/assets/fh-phone.js');

function fixture({battery=20,inventory=['cell_phone_charger'],extras=[],options={},placedAt='',placedMode=''}={}){
 const items=[
  {id:'wall',type:'wall',a:{x:0,y:0},b:{x:8,y:0}},
  {id:'breaker',type:'breaker_panel',x:0,y:0,circuits:[{zoneId:'a',rangeFt:80}]},
  {id:'outlet',type:'power_outlet',x:2,y:0,zoneId:'a'},
  ...extras
 ];
 const project={schema:'forest-horror-map-v1',units:{feetPerCell:5},floors:[{id:'f',items}]};
 const state={inventory:[...inventory],phone:{battery,placedAt,placedMode,placedFloor:0}};
 const sys=FH.createRuntime(project,state,options);
 return {project,items,state,sys};
}
const approx=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`esperado ${expected}, recibido ${actual}`);

test('no permite conectar sin el cargador portátil ni un enchufe alimentado',()=>{
 const missing=fixture({inventory:[]});
 assert.equal(missing.sys.chargePhone(0,'outlet'),false);
 const dark=fixture();
 dark.sys.setService('electricity',false);
 assert.equal(dark.sys.chargePhone(0,'outlet'),false);
 const good=fixture();
 assert.equal(good.sys.chargePhone(0,'outlet'),true);
 assert.equal(good.state.phone.placedMode,'portable');
 assert.equal(good.sys.mobileFor(),false);
 assert.equal(good.sys.statusFor(0,good.items[2]).usedSlots,1);
 assert.equal(good.sys.chargePhone(0,'outlet'),false);
 assert.equal(good.sys.takePhone(),true);
 assert.equal(good.state.phone.placedAt,'');
 assert.equal(good.sys.statusFor(0,good.items[2]).usedSlots,0);
});

test('un enchufe doble ocupado no admite un tercer consumidor',()=>{
 const extras=[
  {id:'router-a',type:'router',x:2.10,y:0,zoneId:'a',outletId:'outlet',rayos:1},
  {id:'router-b',type:'router',x:2.15,y:0,zoneId:'a',outletId:'outlet',rayos:1}
 ];
 const both=fixture({extras});
 assert.equal(both.sys.statusFor(0,both.items[2]).usedSlots,2);
 assert.equal(both.sys.chargePhone(0,'outlet'),false);
 const one=fixture({extras:extras.slice(0,1)});
 assert.equal(one.sys.chargePhone(0,'outlet'),true);
 assert.equal(one.sys.statusFor(0,one.items[2]).usedSlots,2);
});

test('recarga exactamente +1 % cada tres minutos de juego, sin superar 100 %',()=>{
 const {sys,state}=fixture({battery:98});
 assert.equal(sys.chargePhone(0,'outlet'),true);
 sys.tick(2,1);approx(state.phone.battery,98);
 sys.tick(1,1);approx(state.phone.battery,99);
 sys.tick(3,1);approx(state.phone.battery,100);
 sys.tick(40,1);approx(state.phone.battery,100);
});

test('el corte eléctrico pausa la carga sin desbloquear el celular',()=>{
 const {sys,state}=fixture({battery:30});
 assert.equal(sys.chargePhone(0,'outlet'),true);
 sys.tick(2,1);
 sys.setService('electricity',false);
 sys.tick(10,1);approx(state.phone.battery,30);
 assert.equal(state.phone.placedAt,'outlet');
 sys.setService('electricity',true);
 sys.tick(1,1);approx(state.phone.battery,31);
});

test('el progreso parcial persiste tras serializar y restaurar GameState',()=>{
 const {project,sys,state}=fixture({battery:15});
 assert.equal(sys.chargePhone(0,'outlet'),true);
 sys.tick(2,1);
 const snapshot=JSON.parse(JSON.stringify(state));
 const resumed=FH.createRuntime(project,snapshot);
 resumed.tick(1,1);
 approx(snapshot.phone.battery,16);
 assert.equal(snapshot.phone.placedAt,'outlet');
 assert.equal(resumed.statusFor(0,project.floors[0].items[2]).usedSlots,1);
});

test('consume 5 % en reposo; 6.25 % con menú; 7.5 % con linterna incluso con menú',()=>{
 const asleep=fixture({battery:100});asleep.sys.tick(60,1);approx(asleep.state.phone.battery,95);
 const menu=fixture({battery:100,options:{phoneOpen:()=>true}});menu.sys.tick(60,1);approx(menu.state.phone.battery,93.75);
 const torch=fixture({battery:100,options:{torchActive:()=>true}});torch.sys.tick(60,1);approx(torch.state.phone.battery,92.5);
 const both=fixture({battery:100,options:{phoneOpen:()=>true,torchActive:()=>true}});
 both.sys.tick(60,1);approx(both.state.phone.battery,92.5);
});

test('conectar apaga la linterna y la batería agotada también la desactiva',()=>{
 const connected=fixture({battery:12});
 connected.state.flashlight={enabled:true,charge:85};
 assert.equal(connected.sys.chargePhone(0,'outlet'),true);
 assert.equal(connected.state.flashlight.enabled,false);
 const exhausted=fixture({battery:1,options:{torchActive:()=>true}});
 exhausted.state.flashlight={enabled:true};
 exhausted.sys.tick(10,1);
 assert.equal(exhausted.state.phone.battery,0);
 assert.equal(exhausted.state.flashlight.enabled,false);
});

test('el cargador fijo de mapas antiguos también usa +1 % cada tres minutos',()=>{
 const extras=[{id:'old-charger',type:'phone_charger',x:2.1,y:0,outletId:'outlet',chargePerHour:120,rayos:1}];
 const {sys,state}=fixture({battery:20,inventory:[],extras});
 assert.equal(sys.chargePhone(0,'old-charger'),true);
 sys.tick(2,1);approx(state.phone.battery,20);
 sys.tick(1,1);approx(state.phone.battery,21);
 assert.equal(state.phone.placedMode,'legacy');
});

test('el catálogo es un ítem normal de herramienta y normaliza partidas viejas',()=>{
 assert.equal(Phone.CHARGER_ITEM.kind,'tool');
 assert.equal(Phone.CHARGER_ITEM.id,'cell_phone_charger');
 const save={phone:{battery:43.25}};
 const p=Phone.ensureState(save);
 approx(p.battery,43.25);assert.equal(p.chargeElapsedMinutes,0);
 assert.equal(p.placedMode,'');
});

test('el cargador portátil contabiliza electricidad solo al recibir suministro',()=>{
 const {sys,state}=fixture({battery:30});
 assert.equal(sys.chargePhone(0,'outlet'),true);
 const initial=sys.state.meters.kwh;
 sys.tick(3,1);
 assert.ok(sys.state.meters.kwh>initial);
 sys.setService('electricity',false);
 const paused=sys.state.meters.kwh;
 sys.tick(3,1);
 approx(sys.state.meters.kwh,paused);
});
