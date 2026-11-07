const assert=require('node:assert/strict');
const test=require('node:test');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');

const code=fs.readFileSync(path.join(__dirname,'fh-delivery.js'),'utf8');
const engine=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const terminal=fs.readFileSync(path.join(__dirname,'fh-terminal.html'),'utf8');
const ctx={
 window:{addEventListener(){},FH_DELIVERY_TEXT:{}},
 document:{baseURI:'https://example.test/juego/assets/'},
 URL,Date,console,setTimeout:(fn)=>{fn();return 1}
};
ctx.window.window=ctx.window;
vm.runInNewContext(code,ctx);
const D=ctx.window.FHDelivery;

const product={id:'silla',modelId:'silla',kind:'furniture',name:'Silla',parcelSize:'mediana',
 unboxMinutes:20,price:12.5};

test('un pedido agrupa unidades y calcula total; los pedidos antiguos siguen siendo de una unidad',()=>{
 const state={clock:{minutes:480}};
 const order=D.createOrder(state,product,{quantity:3,leadMinutes:60,paymentMethod:'cash',
  floor:1,doorId:'door-1',roomId:'habitacion-3',destinationId:'room:piso-2:habitacion-3',destinationName:'Habitación 3'});
 assert.equal(order.quantity,3);
 assert.equal(order.totalPrice,37.5);
 assert.equal(order.payment.amount,37.5);
 assert.equal(order.deliveryAtMinutes,540);
 assert.equal(order.destinationName,'Habitación 3');
 assert.equal(order.floor,1);
 const old=D.createOrder(state,product,{leadMinutes:60});
 assert.equal(old.quantity,1);
 assert.equal(old.payment.amount,12.5);
});

test('el runtime valida dirección y cantidad antes de registrar y agrupa al desempaquetar',async()=>{
 const address={id:'property:planta1:parcelaA',kind:'property',name:'Parcela A',
  floor:0,doorId:'door-a',propertyId:'parcelaA'};
 const door={id:'door-a',f:0,kind:'peephole_door',cx:0,cz:0,norm:{x:1,z:0}};
 const state={clock:{minutes:480}};
 const sent={orders:[],addresses:[],clocks:[]};
 const terminalApi={setHamazonProducts(){},setHamazonOrders(value){sent.orders=value},
  setHamazonAddresses(value){sent.addresses=value},setHamazonClock(value){sent.clocks.push(value)},
  setGameClock(){}};
 const furnitureCatalog={furniture:[{...product,glb:'modelos_glb/silla.glb'}]};
 const deliveryCatalog={furniture:[{id:'caja_carton_mediana',parcelSize:'mediana',
  name:'Caja mediana',widthFt:5,depthFt:5,heightFt:5}]};
 ctx.fetch=async url=>({ok:true,json:async()=>String(url).includes('catalogo_delivery')?deliveryCatalog:furnitureCatalog});
 // fetch es una variable global del contexto en que se evalúa el runtime.
 const runtime=D.createRuntime({
  state,cell:1,feetPerCell:5,baseUrl:'https://example.test/juego/assets/fh-delivery.js',
  validateProduct:async()=>true,computer:{terminalApi:()=>terminalApi},
  deliveryAddresses:()=>[address],doorById:(id,f)=>id===door.id&&f===0?door:null,
  save(){},notice(){},npcBusy:()=>true,
  replacePackage(item,p,order){return{floor:0,item:{id:'delivered_'+order.id,modelId:p.modelId,
   x:item.x,y:item.y,rotation:0,runtimeDeliveryFurniture:{orderId:order.id,productId:p.id}}}},
  hasRuntimeItem(){return false},restoreFurniture(record){return{id:record.id}}
 });
 for(let i=0;i<30&&(!runtime.ready||runtime.products[0]?.shopStatus!=='available');i++)await Promise.resolve();
 assert.equal(runtime.ready,true);
 assert.equal(runtime.products[0].shopStatus,'available');
 runtime.syncTerminal();
 assert.equal(sent.addresses.length,1);
 assert.equal(runtime.placeOrder('silla','prepaid',3,'does-not-exist'),null);
 for(const quantity of [0,1.5,21,-2])assert.equal(runtime.placeOrder('silla','prepaid',quantity,address.id),null);
 assert.equal(state.delivery.orders.length,0);
 const order=runtime.placeOrder('silla','card',3,address.id);
 assert.ok(order);
 assert.equal(order.status,'scheduled');
 assert.equal(order.quantity,3);
 assert.equal(order.doorId,'door-a');
 assert.equal(order.destinationName,'Parcela A');
 assert.equal(order.deliveryAtMinutes,540);
 assert.equal(sent.orders[0].quantity,3);
 assert.equal(sent.orders[0].destinationName,'Parcela A');
 runtime.update(59);
 assert.equal(state.clock.minutes,539);
 assert.equal(D.nextDueOrder(state),null);
 runtime.update(1);
 assert.equal(state.clock.minutes,540);
 assert.equal(D.nextDueOrder(state).id,order.id);
 assert.ok(sent.clocks.includes(540));

 order.status='delivered';
 const pack={id:'package_'+order.id,x:2,y:3,rotation:0,runtimePackage:{orderId:order.id,productId:'silla'}};
 state.delivery.packages.push({id:pack.id,orderId:order.id,floor:0,x:2,y:3});
 assert.equal(runtime.openPackage(pack),true);
 assert.equal(state.delivery.packages.length,0);
 assert.equal(state.delivery.furnishings.length,3);
 assert.equal(state.delivery.furnishings.filter(r=>r.stored===true).length,2);
 assert.equal(new Set(state.delivery.furnishings.map(r=>r.id)).size,3);
 assert.equal(runtime.storedFurniture().length,2);
 assert.equal(order.status,'unboxed');
 assert.equal(state.clock.minutes,560);
});

test('mapa y terminal conectan direcciones, compra y reloj sin cambiar formato del mapa',()=>{
 assert.match(engine,/function fhDeliveryAddresses\(\)/);
 assert.match(engine,/fhDeliveryRoomAtDoor/);
 assert.match(engine,/deliveryAddresses:fhDeliveryAddresses/);
 assert.match(terminal,/setHamazonAddresses\(items\)/);
 assert.match(terminal,/setHamazonClock\(minutes\)/);
 assert.match(terminal,/destinationId:address\.value/);
 assert.match(terminal,/quantity:count/);
 assert.match(terminal,/data-delivery-at/);
 const scripts=[...terminal.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 for(const match of scripts)if(match[1].trim())assert.doesNotThrow(()=>new vm.Script(match[1]));
});
