/* Tests sin navegador: contratos del teléfono y sus integraciones con la partida. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Phone=require('./fh-phone.js');

function setup(overrides={}){
 const state={clock:{minutes:480},...overrides};
 const orders=[];let saves=0,cartChanges=0;
 const products=[{id:'mesa',shopStatus:'available',name:'Mesa'}, {id:'sin-glb',shopStatus:'error'}];
 const runtime=Phone.createRuntime({state,
  delivery:()=>({products,orders,placeOrder:(id,method,quantity,destination)=>{
   if(id==='sin-glb')return null;
   const order={id:'pedido-'+(orders.length+1),productId:id,method,quantity,destination,status:'scheduled',name:'Mesa'};
   orders.push(order);return order;
  }}),
  addresses:()=>[{id:'hab-1',name:'Habitación 1'}],
  save:()=>saves++,onCartChange:()=>cartChanges++
 });
 return {state,runtime,orders,stats:()=>({saves,cartChanges})};
}
test('muestra la hora de la partida, no la del sistema',()=>{
 assert.equal(Phone.formatClock(480),'08:00');
 assert.equal(Phone.formatClock(1441),'00:01');
 assert.equal(Phone.formatClock(-1),'23:59');
});
test('el teléfono nace con aplicaciones esenciales y conserva versiones anteriores',()=>{
 const state={};
 const data=Phone.ensureState(state);
 assert.deepEqual(data.installedApps,Phone.BASE_APPS);
 assert.ok(data.contacts.some(c=>c.id==='hamazon'));
 assert.deepEqual(state.commerce.cart,[]);
 const old={phone:{installedApps:['notes','hamazon','app-desconocida'],notes:[{id:'n',title:'x',body:'y'}]},commerce:{cart:[]}};
 Phone.ensureState(old);
 assert.ok(old.phone.installedApps.includes('hamazon'));
 assert.equal(old.phone.installedApps.includes('app-desconocida'),false);
 assert.equal(old.phone.notes[0].body,'y');
});
test('la tienda instala Hamazon sin permitir eliminar apps básicas',()=>{
 const state={};
 assert.equal(Phone.installApp(state,'hamazon'),true);
 assert.equal(Phone.installApp(state,'hamazon'),true);
 assert.equal(state.phone.installedApps.filter(a=>a==='hamazon').length,1);
 assert.equal(Phone.uninstallApp(state,'notes'),false);
 assert.equal(Phone.uninstallApp(state,'hamazon'),true);
 assert.equal(Phone.installApp(state,'app-falsa'),false);
});
test('carrito único, validación y pedidos reales del runtime de Hamazon',()=>{
 const {runtime,state,orders,stats}=setup();
 assert.equal(runtime.addToCart('mesa',2,'hab-1','cash'),true);
 assert.equal(runtime.addToCart('mesa',1,'hab-1','cash'),true);
 assert.equal(runtime.cart[0].quantity,3);
 assert.equal(runtime.addToCart('mesa',18,'hab-1','cash'),false);
 assert.equal(runtime.addToCart('sin-glb',1,'hab-1','cash'),false);
 assert.equal(runtime.addToCart('mesa',1,'destino-falso','cash'),false);
 const result=runtime.checkoutCart();
 assert.deepEqual(result,{accepted:1,failed:0});
 assert.equal(orders[0].quantity,3);
 assert.equal(runtime.cart.length,0);
 assert.deepEqual(state.commerce.cart,[]);
 assert.deepEqual(stats(),{saves:3,cartChanges:3});
});
test('mensajes de jugadores no fingen conexión; contactos y NPC admiten eventos',()=>{
 const {runtime,state}=setup();
 assert.equal(runtime.addContact({id:'p-1',name:'Otro jugador',kind:'player'}),true);
 assert.equal(runtime.sendMessage('p-1','hola'),false);
 assert.equal(state.phone.messages.length,0);
 assert.equal(runtime.receiveMessage('npc-1','¿Quién anda ahí?',{name:'Vigilante',kind:'person'}),true);
 assert.equal(state.phone.messages.length,1);
 assert.equal(state.phone.contacts.find(c=>c.id==='npc-1').name,'Vigilante');
 assert.equal(runtime.sendMessage('hamazon','¿Dónde está mi pedido?'),true);
 assert.equal(state.phone.messages.length,3);
 assert.equal(state.phone.messages[2].incoming,true);
});
test('notifica una vez cuando llegan nuevos pedidos y cambia el estado',()=>{
 const {runtime,state,orders}=setup();
 orders.push({id:'o-1',name:'Mesa',status:'scheduled'});
 runtime.update(.6);
 assert.equal(state.phone.messages.length,1);
 runtime.update(.6);
 assert.equal(state.phone.messages.length,1);
 orders[0].status='delivered';
 runtime.update(.6);
 assert.equal(state.phone.messages.length,2);
});
test('los puntos de enlace permanecen dentro del motor sin alterar forest-horror-map-v1',()=>{
 const main=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
 const terminal=fs.readFileSync(path.resolve(__dirname,'fh-terminal.html'),'utf8');
 const css=fs.readFileSync(path.resolve(__dirname,'fh-phone.css'),'utf8');
 assert.match(main,/phone:initial\.phone/);
 assert.match(main,/commerce:initial\.commerce/);
 assert.match(main,/window\.FHPhoneRuntime=window\.FHPhone\?\.createRuntime/);
 assert.match(main,/window\.FHPhoneRuntime\?\.update\(dt\)/);
 assert.match(terminal,/setHamazonCart\(items\)/);
 assert.match(terminal,/hamazon-cart-checkout/);
 assert.match(css,/#flashlightToggle\{display:none!important\}/);
 assert.doesNotMatch(main,/forest-horror-map-v2/);
});
