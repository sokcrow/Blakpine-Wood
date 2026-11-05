const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const terminal=fs.readFileSync(path.join(__dirname,'fh-terminal.html'),'utf8');
const bridge=fs.readFileSync(path.join(__dirname,'fh-glb-bridge.js'),'utf8');
const delivery=fs.readFileSync(path.join(__dirname,'fh-delivery.js'),'utf8');

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
 assert.match(index,/FHDeliveryRuntime\.openPc/);
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

test('Las siete poses del Delivery Man están conectadas',()=>{
 for(const file of ['delivery_idle.webp','delivery_walk.webp','delivery_thinking.webp','delivery_clipboard.webp','delivery_peephole.webp','delivery_cash.webp','delivery_card.webp']){
  assert.ok(index.includes(file),file);
 }
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
 assert.match(delivery,/blocksMovement:false,runtimePackage/);
});

test('La economía sigue desacoplada',()=>{
 assert.match(delivery,/price:p\.price==null\?null/);
 assert.match(delivery,/payment:\{required:method!=='prepaid'/);
});

console.log(passed+' pruebas correctas');
