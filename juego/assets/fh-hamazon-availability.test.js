/* Pruebas de la categoría Interiores y del bloqueo de pedidos con GLB inválido. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const library=path.join(root,'forest-horror/biblioteca');
const main=JSON.parse(fs.readFileSync(path.join(library,'catalogo_muebles.json'),'utf8'));
const boxes=JSON.parse(fs.readFileSync(path.join(library,'catalogo_delivery.json'),'utf8'));
const deliveryCode=fs.readFileSync(path.join(__dirname,'fh-delivery.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const shop=fs.readFileSync(path.join(__dirname,'fh-terminal.html'),'utf8');

test('Los 78 artículos y las tres cajas tienen ambiente interior y los GLB del repositorio existen',()=>{
 assert.equal(main.furniture.length,78);
 for(const entry of main.furniture){
  assert.equal(entry.environment,'interior',entry.id);
  assert.ok(entry.category,entry.id+' conserva categoría anterior');
  assert.ok(fs.existsSync(path.join(library,entry.glb)),entry.id+' conserva GLB real');
 }
 for(const box of boxes.furniture){
  const source=main.furniture.find(x=>x.id===box.id);
  assert.equal(JSON.stringify(source),JSON.stringify(box),'Las dos fichas de la caja deben ser idénticas');
 }
});

test('Hamazon tiene categoría Interiores, selector de subcategorías y estado ERROR distinto de AGOTADO',()=>{
 const script=[...shop.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .filter(x=>x[1].trim()).map(x=>x[1]);
 for(const js of script)new vm.Script(js,{filename:'fh-terminal-inline.js'});
 assert.match(shop,/function renderHamazon\(body\)/);
 assert.match(shop,/let fhHamazonCategory='all'/);
 assert.match(shop,/p\.shopStatus==='available'/);
 assert.match(shop,/buy\.disabled=status!=='available'/);
 assert.match(shop,/hamazon-zone/);
 assert.match(index,/validateProduct:async product=>/);
 assert.match(index,/FHAssets\.load\(product\.modelId\)/);
 assert.match(deliveryCode,/if\(p\.shopStatus!=='available'\)/);
 assert.match(deliveryCode,/filter\(p=>!p\.environment\|\|p\.environment==='interior'\)/);
});

test('El estado de compra se libera solo después de validar el GLB, no si falla o es exterior',async()=>{
 const catalog={furniture:[
  {id:'silla_madera',name:'Silla de madera',category:'Asientos',environment:'interior',glb:'modelos_glb/silla_madera.glb',widthFt:2,depthFt:2,heightFt:3},
  {id:'silla_rota',name:'Silla rota',environment:'interior',glb:'modelos_glb/silla_rota.glb'},
  {id:'sin_modelo',name:'Sin modelo',environment:'interior'},
  {id:'farola_exterior',name:'Farola',environment:'exterior',glb:'modelos_glb/farola_exterior.glb'}
 ]};
 const delivery={furniture:[]};
 let releaseValidation=null;
 const hold=new Promise(resolve=>releaseValidation=resolve);
 const notices=[];
 const terminalProducts=[];
 const context={
  window:{addEventListener(){},FH_DELIVERY_TEXT:{}},
  document:{baseURI:'https://example.test/juego/assets/'},
  URL,Date,console,structuredClone,
  fetch:async url=>({ok:true,json:async()=>String(url).includes('catalogo_delivery')?delivery:catalog}),
  setTimeout
 };
 context.window.window=context.window;
 vm.runInNewContext(deliveryCode,context,{filename:'fh-delivery.js'});
 const state={clock:{minutes:480}};
 const rt=context.window.FHDelivery.createRuntime({
  state,baseUrl:'https://example.test/juego/assets/fh-delivery.js',
  cell:1.524,save(){},notice(message){notices.push(message)},
  validateProduct:async product=>product.id==='silla_madera'?(await hold,true):false,
  computer:{terminalApi(){return {setHamazonProducts(products){terminalProducts.push(products.map(p=>({id:p.id,status:p.shopStatus})))},setHamazonOrders(){},setGameClock(){}}}},
  findDoor(){return {id:'front',f:0,apartmentId:'room-01'}},
  doorById(){return null}
 });
 rt.onComputerOpen({id:'pc'},0);
 for(let i=0;i<40&&!rt.ready;i++)await Promise.resolve();
 assert.equal(rt.ready,true);
 assert.equal(rt.products.length,3,'Exterior no debe entrar al catálogo comercial');
 assert.equal(rt.products[0].environment,'interior');
 assert.equal(rt.products[0].shopStatus,'checking');
 assert.equal(rt.products[2].shopStatus,'error','Falta el GLB y debe aparecer ERROR');
 assert.equal(rt.placeOrder('silla_madera','prepaid'),null,'Nunca se compra mientras se comprueba');
 assert.equal(rt.placeOrder('sin_modelo','prepaid'),null);
 assert.equal(rt.placeOrder('farola_exterior','prepaid'),null);
 assert.equal(state.delivery.orders.length,0);
 releaseValidation();
 for(let i=0;i<40&&rt.products[0].shopStatus!=='available';i++)await Promise.resolve();
 assert.equal(rt.products[0].shopStatus,'available');
 assert.equal(rt.products[1].shopStatus,'error');
 assert.equal(rt.placeOrder('silla_rota','prepaid'),null);
 const result=rt.placeOrder('silla_madera','prepaid');
 assert.ok(result);
 assert.equal(state.delivery.orders.length,1);
 assert.equal(result.modelId,'silla_madera');
 assert.equal(result.status,'scheduled');
 for(let i=0;i<40&&!terminalProducts.some(batch=>batch[0]?.status==='available');i++)await Promise.resolve();
 assert.ok(terminalProducts.some(batch=>batch[0]?.status==='available'),'El terminal recibe el estado validado');
 assert.ok(notices.length>=3);
});
