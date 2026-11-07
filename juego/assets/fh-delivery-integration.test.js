const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const terminal=fs.readFileSync(path.join(__dirname,'fh-terminal.html'),'utf8');
const bridge=fs.readFileSync(path.join(__dirname,'fh-glb-bridge.js'),'utf8');
const delivery=fs.readFileSync(path.join(__dirname,'fh-delivery.js'),'utf8');
const decoration=fs.readFileSync(path.join(__dirname,'fh-decoration.js'),'utf8');

let passed=0;
function test(name,fn){fn();passed++;console.log('PASS',name)}

test('RAVEN/OS incluye Hamazon y emite pedidos al host',()=>{
 assert.match(terminal,/hamazon:'HAMAZON'/);
 assert.match(terminal,/function renderHamazon/);
 assert.match(terminal,/emit\('hamazon-order'/);
 assert.match(terminal,/FOREST_TERMINAL_EVENT/);
 assert.match(terminal,/setHamazonProducts\(items\)/);
 assert.match(terminal,/setHamazonOrders\(items\)/);
});

test('La PC del catálogo se convierte en interacción jugable',()=>{
 assert.match(index,/it\.modelId==='escritorio_pc'/);
 assert.match(index,/FHComputerRuntime\.open/);
});

test('Mirilla y puerta están conectadas al Delivery Man',()=>{
 assert.match(index,/FHDeliveryRuntime\?\.onPeephole\(d\)/);
 assert.match(index,/FHDeliveryRuntime\?\.onDoorOpened\(d\)/);
});

test('Paquetes GLB se registran y se pueden desempaquetar',()=>{
 assert.match(index,/function fhSpawnRuntimeItem/);
 assert.match(index,/FHDeliveryRuntime\?\.isPackage\(item\)/);
 assert.match(index,/applyCatalogModel\(next,product/);
 assert.match(bridge,/catalogo_delivery\.json/);
});

test('El catálogo de cajas es opcional para no romper muebles normales',()=>{
 assert.match(bridge,/loadDocument\(deliveryCatalogUrl, true\)/);
 assert.match(bridge,/Catálogo de paquetería no disponible/);
});

test('Las ocho poses originales del repartidor existen en el repositorio y están conectadas',()=>{
 for(const file of ['delivery_normal_idle.png','delivery_normal_walk.png','delivery_normal_thinking.png','delivery_door_idle.png','delivery_door_greeting.png','delivery_door_signature.png','delivery_door_cash.png','delivery_door_card.png']){
  assert.ok(index.includes(file),file);
  const data=fs.readFileSync(path.join(root,'juego/assets/npc',file));
  assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a',file+' debe ser PNG');
  assert.ok(data.length>10000,file+' no debe ser un recurso vacío');
 }
 assert.match(index,/finalPose:'door_idle'/);
 assert.match(index,/fhSetDeliveryNpcPose\('greeting'\)/);
});

test('Los pedidos esperan su ETA antes de llamar a la puerta',()=>{
 assert.match(delivery,/order\.status='scheduled'/);
 assert.match(delivery,/function nextDueOrder\(/);
 assert.match(delivery,/deliveryAtMinutes/);
 assert.match(index,/clockMinutesPerSecond:1,deliveryLeadMinutes:60/);
 assert.match(index,/FHDeliveryRuntime\?\.update\(dt\)/);
 assert.match(terminal,/LLEGA /);
 assert.match(terminal,/setGameClock\(value\)/);
 assert.match(delivery,/syncClockToTerminal/);
});

test('La caja no bloquea la entrada hasta existir decoración runtime',()=>{
 assert.match(delivery,/blocksMovement:false,runtimeDecoratable:true,runtimePackage/);
});

test('La caja y el mueble entregado usan modo decoración sin cambiar el layout',()=>{
 assert.match(index,/function fhStartDecoration\(/);
 assert.match(index,/function fhMoveDecoration\(/);
 assert.match(index,/function fhRotateDecoration\(/);
 assert.match(index,/#fhDecorateBtn,#fhDecorStoredBtn\{position:fixed/);
 assert.match(index,/#fhDecorControls,#fhDecorStoredPanel\{position:fixed/);
 assert.match(index,/fhDecorationTick\(\);if\(!fhDeliveryUiActive&&!fhDecorationActive\)moveUpdate\(dt\)/);
 assert.match(delivery,/runtimeDecoratable:true,runtimePackage/);
 assert.match(index,/runtimeDecoratable:true,runtimeDeliveryFurniture/);
 assert.match(decoration,/function candidate\(/);
 assert.match(decoration,/function footprintPoints\(/);
});

test('Mover paquetes y muebles se guarda en el estado de delivery',()=>{
 assert.match(delivery,/if\(!Array\.isArray\(d\.furnishings\)\)d\.furnishings=\[\]/);
 assert.match(delivery,/function updateRuntimeItem\(/);
 assert.match(delivery,/delivery\.furnishings\.push\(record\)/);
 assert.match(delivery,/options\.restoreFurniture\?\.\(record,product,order\)/);
 assert.match(index,/restoreFurniture:fhRestoreDeliveredFurniture/);
});

test('Abrir la caja conserva la posición y entra a decoración del mueble',()=>{
 assert.match(index,/x:item\.x,y:item\.y/);
 assert.match(index,/setTimeout\(\(\)=>fhStartDecoration\(next,f,\{fresh:true\}\),0\)/);
 assert.match(index,/return \{item:next,floor:f\}/);
 assert.match(index,/fhRefreshDecorationPreview\(/);
 assert.match(index,/function fhStoreDecoration\(/);
 assert.match(index,/decorateRequired/);
});

test('La economía sigue desacoplada',()=>{
 assert.match(delivery,/price:p\.price==null\?null/);
 assert.match(delivery,/payment:\{required:method!=='prepaid'/);
});

test('Una estación nueva requiere piezas y el motor permite usarla sentado',()=>{
 const pc=fs.readFileSync(path.join(__dirname,'fh-pc-assembly.js'),'utf8');
 const furnitureRules=fs.readFileSync(path.join(__dirname,'fh-furniture-rules.js'),'utf8');
 assert.match(pc,/function inspect\(/);
 assert.match(pc,/function frontTarget\(/);
 assert.match(furnitureRules,/pcAssemblyRequired=true/);
 const computer=fs.readFileSync(path.join(__dirname,'fh-computer.js'),'utf8');
 assert.match(computer,/pcAssemblyRequired!==true/);
 assert.match(index,/fh-pc-assembly\.js/);
 assert.match(index,/floorItems:f=>DATA\.floors/);
 assert.match(index,/fhUseFrontFromSeat/);
 assert.match(index,/watchHudAfter/);
});
test('Hamazon espera confirmación del motor antes de declarar éxito',()=>{
 assert.match(delivery,/FOREST_TERMINAL_RESPONSE/);
 assert.match(terminal,/hamazon-order-result/);
 assert.doesNotMatch(terminal,/say\('Pedido enviado a Hamazon\.'/);
});
test('Mesas de cualquier modelo con piezas cercanas se vuelven estaciones interactuables',()=>{
 const pc=fs.readFileSync(path.join(__dirname,'fh-pc-assembly.js'),'utf8');
 assert.match(pc,/function isTerminalCandidate\(/);
 assert.match(pc,/function isWorkSurface\(/);
 assert.match(pc,/function nearAnchor\(/);
 assert.match(index,/window\.FHComputer\?\.isPc\(it,f\.items/);
 assert.match(index,/currentFloor:\(\)=>currentFloor/);
 const computer=fs.readFileSync(path.join(__dirname,'fh-computer.js'),'utf8');
 assert.match(computer,/FHPcAssembly/);
 assert.match(computer,/isLegacyPc/);
});
test('Las estaciones PC controlan RAVEN/OS sin usar el runtime de Hamazon',()=>{
 const computer=fs.readFileSync(path.join(__dirname,'fh-computer.js'),'utf8');
 assert.match(index,/fh-computer\.js/);
 assert.match(index,/FHComputerRuntime=window\.FHComputer\?\.createRuntime/);
 assert.match(index,/computer:window\.FHComputerRuntime/);
 assert.match(delivery,/options\.computer\?\.terminalApi/);
 assert.doesNotMatch(delivery,/function ensureTerminal\(/);
 assert.match(computer,/function createRuntime\(/);
 assert.match(terminal,/setSession\(session=\{\}\)/);
 assert.match(terminal,/sessionApps=Array\.isArray\(session\.apps\)/);
});
test('RAVEN/OS conserva identidad del jugador y restringe cámaras por estación',()=>{
 const computer=fs.readFileSync(path.join(__dirname,'fh-computer.js'),'utf8');
 assert.match(index,/fh-computer-strings\.js/);
 assert.match(terminal,/fh-computer-strings\.js/);
 assert.match(computer,/state\.computer\?\.mails/);
 assert.match(computer,/item\?\.pcConnections\?\.cameras/);
 assert.match(terminal,/sessionUserId=String\(session\.userId/);
 assert.match(terminal,/if\(!DATA\.cameras\.length\)/);
 assert.match(terminal,/if\(!sessionApps\.includes\(app\)\)/);
});
console.log(passed+' pruebas correctas');
