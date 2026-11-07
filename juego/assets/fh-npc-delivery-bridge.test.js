'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'fh-delivery.js'),'utf8');

async function setup(mode){
 const counters={rings:0,shown:0,routed:0};
 const win={FH_DELIVERY_TEXT:{},addEventListener(){}};
 const context={window:win,document:{baseURI:'https://example.test/juego/assets/',getElementById:()=>null},
  URL,Date,console,setTimeout:fn=>{fn();return 1},
  fetch:async()=>({ok:true,json:async()=>({furniture:[]})})};
 vm.runInNewContext(source,context);
 const state={clock:{minutes:480}},door={id:'doorA',f:0};
 const runtime=win.FHDelivery.createRuntime({state,baseUrl:'https://example.test/juego/assets/fh-delivery.js',
  doorById:id=>id===door.id?door:null,startNpcRoute:mode===undefined?undefined:()=>{counters.routed++;return mode},
  showNpc(){counters.shown++},knock(){counters.rings++},save(){},notice(){}
 });
 for(let i=0;i<30&&!runtime.ready;i++)await Promise.resolve();
 assert.equal(runtime.ready,true);
 const order=win.FHDelivery.createOrder(state,
  {id:'mesa',name:'Mesa',kind:'furniture',parcelSize:'pequena',unboxMinutes:10},
  {doorId:door.id,leadMinutes:0,floor:0});
 order.status='scheduled';
 return {runtime,order,state,counters,door};
}
test('GOAP: Hamazon no llama, conversa ni entrega antes de que llegue el NPC',async()=>{
 const w=await setup(true);
 w.runtime.activateNext();
 assert.equal(w.order.status,'en_route');
 assert.equal(w.counters.rings,0);
 assert.equal(w.counters.shown,0);
 assert.equal(w.runtime.onPeephole(w.door),false);
 assert.equal(w.runtime.onNpcArrived('incorrecto'),false);
 assert.equal(w.runtime.onNpcArrived(w.order.id),true);
 assert.equal(w.order.status,'waiting');
 assert.equal(w.counters.rings,1);
 assert.equal(w.counters.shown,1);
 assert.equal(w.runtime.onNpcArrived(w.order.id),false);
 assert.equal(w.counters.rings,1);
});
test('Un mapa viejo sin portal conserva la entrega tradicional',async()=>{
 const w=await setup(undefined);
 w.runtime.activateNext();
 assert.equal(w.order.status,'waiting');
 assert.equal(w.counters.rings,1);
 assert.equal(w.counters.shown,1);
});
test('Ruta imposible no crea un repartidor en la puerta',async()=>{
 const w=await setup(false);
 w.runtime.activateNext();
 assert.equal(w.order.status,'route_blocked');
 assert.equal(w.counters.rings,0);
 assert.equal(w.counters.shown,0);
 assert.equal(w.runtime.onNpcArrived(w.order.id),false);
});

test('La ruta bloqueada durante el trayecto no deja el pedido como en camino',async()=>{
 const w=await setup(true);
 w.runtime.activateNext();
 assert.equal(w.order.status,'en_route');
 assert.equal(w.runtime.onNpcRouteBlocked(w.order.id),true);
 assert.equal(w.order.status,'route_blocked');
 assert.equal(w.runtime.onNpcArrived(w.order.id),false);
 assert.equal(w.counters.rings,0);
});
