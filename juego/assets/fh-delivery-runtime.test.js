const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'fh-delivery.js'),'utf8');

(async()=>{
 const furnitureCatalog={furniture:[{id:'mesa_pequena',name:'Mesa pequeña',widthFt:2.75,depthFt:2.75,heightFt:2.5,placement:'floor',blocksMovement:true}]};
 const deliveryCatalog={furniture:[{id:'caja_carton_mediana',name:'Caja mediana',widthFt:5,depthFt:5,heightFt:5,parcelSize:'mediana'}]};
 const fakeFetch=async url=>({ok:true,json:async()=>String(url).includes('catalogo_delivery')?deliveryCatalog:furnitureCatalog});
 const context={
  window:{addEventListener(){},FH_DELIVERY_TEXT:{}},
  document:{baseURI:'https://example.test/juego/assets/'},
  URL,Date,console,structuredClone,fetch:fakeFetch,setTimeout:(fn)=>{fn();return 1}
 };
 context.window.window=context.window;vm.runInNewContext(code,context);
 const D=context.window.FHDelivery,state={clock:{minutes:480}};
 let restored=null;
 const runtime=D.createRuntime({
  state,baseUrl:'https://example.test/juego/assets/fh-delivery.js',cell:1.524,feetPerCell:5,
  save(){},notice(){},hasRuntimeItem(){return false},doorById(){return null},
  replacePackage(item,p,order){return {item:{id:'delivered_'+order.id,modelId:p.id,x:item.x,y:item.y,rotation:item.rotation||0,runtimeDeliveryFurniture:{orderId:order.id,productId:p.id}},floor:0}},
  restoreFurniture(record,p,order){restored={record,p,order};return true}
 });
 for(let i=0;i<30&&!runtime.ready;i++)await Promise.resolve();
 assert.equal(runtime.ready,true);
 const product=runtime.products[0],order=D.createOrder(state,product,{leadMinutes:0,doorId:'door1',floor:0});
 order.status='delivered';order.packageId='package_'+order.id;
 const pack={id:order.packageId,x:2,y:3,rotation:90,runtimePackage:{orderId:order.id,productId:product.id}};
 state.delivery.packages.push({id:pack.id,orderId:order.id,floor:0,x:2,y:3,rotation:90,modelId:'caja_carton_mediana'});
 assert.equal(runtime.openPackage(pack),true);
 assert.equal(state.delivery.packages.length,0);
 assert.equal(state.delivery.furnishings.length,1);
 assert.equal(state.delivery.furnishings[0].x,2);
 assert.equal(state.delivery.furnishings[0].y,3);
 assert.equal(state.delivery.furnishings[0].rotation,90);
 assert.equal(state.clock.minutes,500);
 const moved={id:state.delivery.furnishings[0].id,x:4,y:5,rotation:180,runtimeDeliveryFurniture:{orderId:order.id,productId:product.id}};
 assert.equal(runtime.updateRuntimeItem(moved,0),true);
 assert.equal(state.delivery.furnishings[0].x,4);
 assert.equal(state.delivery.furnishings[0].y,5);
 assert.equal(state.delivery.furnishings[0].rotation,180);
 assert.equal(runtime.setFurnitureStored(moved,0,true),true);
 assert.equal(state.delivery.furnishings[0].stored,true);
 assert.equal(runtime.storedFurniture().length,1);
 assert.equal(runtime.storedFurniture()[0].name,'Mesa pequeña');
 restored=null;
 runtime.resume();assert.equal(restored,null,'no debe recrear un mueble almacenado al cargar');
 const returned=runtime.retrieveStoredFurniture(moved.id,{floor:0,x:8,y:7});
 assert.ok(returned,'puede restaurar un mueble almacenado para su colocación');
 assert.equal(restored.record.x,8);assert.equal(restored.record.y,7);
 assert.equal(state.delivery.furnishings[0].stored,true,'no abandonar almacenaje antes de colocar');
 assert.equal(runtime.setFurnitureStored(returned,0,false),true);
 assert.equal(state.delivery.furnishings[0].stored,false);
 assert.equal(runtime.storedFurniture().length,0);
 restored=null;
 runtime.resume();assert.ok(restored);assert.equal(restored.record.id,moved.id);
 console.log('PASS fh-delivery runtime persistence');
})().catch(error=>{console.error(error);process.exitCode=1});
