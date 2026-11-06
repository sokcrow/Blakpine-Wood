'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const src=fs.readFileSync(path.join(__dirname,'fh-delivery.js'),'utf8');
const index=fs.readFileSync(path.join(__dirname,'../..','index.html'),'utf8');
const strings=fs.readFileSync(path.join(__dirname,'fh-delivery-strings.js'),'utf8');

function node(tag){
 const children=[],classes=new Set();
 const el={tag,children,handlers:{},hidden:false,id:'',textContent:'',style:{},
  classList:{
   add(...names){names.forEach(n=>classes.add(n))},
   remove(...names){names.forEach(n=>classes.delete(n))},
   contains(name){return classes.has(name)},
   toggle(name,on){on?classes.add(name):classes.delete(name);return !!on}
  },
  append(...items){this.children.push(...items)},
  replaceChildren(...items){this.children.splice(0,this.children.length,...items)},
  addEventListener(name,callback){this.handlers[name]=callback},
  setAttribute(name,value){this[name]=value}
 };
 el.querySelector=selector=>el.parts?.[selector];
 Object.defineProperty(el,'innerHTML',{set(html){
  this.html=html;
  if(this.id==='fhDeliveryDialog')this.parts={
   '#fhDeliveryPortrait':node('div'),
   '#fhDeliveryName':node('div'),
   '#fhDeliveryText':node('div'),
   '#fhDeliveryActions':node('div')
  };
 }});
 return el;
}
function fakeImage(){return node('img')}
function setup(){
 const overlay=node('div'),head=node('head'),body=node('body');
 const document={baseURI:'https://example.test/juego/assets/',head,body,
  createElement:node,getElementById:id=>id==='peekOverlay'?overlay:null};
 const win={addEventListener(){},FH_DELIVERY_TEXT:{
  talkThroughDoor:'Hablar con el repartidor',
  peepholeGreeting:()=> 'Buenas. Traigo un pedido.',
  peepholePackage:name=>'Paquete: '+name,
  askPackage:'¿Qué trae?',askPayment:'¿Cómo se paga?',
  openDoor:'Abrir la puerta',closeTalk:'Terminar conversación'
 }};
 const fetch=async()=>({ok:true,json:async()=>({furniture:[]})});
 vm.runInNewContext(src,{window:win,document,URL,Date,Image:fakeImage,fetch,console,setTimeout});
 const state={},product={id:'mesa',name:'Mesa',kind:'furniture',parcelSize:'pequena',unboxMinutes:10};
 const order=win.FHDelivery.createOrder(state,product,{doorId:'puerta1',paymentMethod:'card'});
 order.status='waiting';
 let frozen=false,opened=0;
 const runtime=win.FHDelivery.createRuntime({state,freeze:v=>{frozen=v},
  baseUrl:'https://example.test/juego/assets/fh-delivery.js',
  openDoor(){opened++;runtime.onPeepholeExit()},spriteUrl:()=>'https://example.test/sprite.webp'});
 const dialog=()=>body.children.find(n=>n.id==='fhDeliveryDialog');
 const action=label=>dialog().querySelector('#fhDeliveryActions').children.find(n=>n.textContent===label);
 return {runtime,overlay,dialog,action,order,get frozen(){return frozen},get opened(){return opened}};
}

test('mirar primero: el botón Hablar no abre el diálogo ni cierra la mirilla',()=>{
 const ui=setup(),door={id:'puerta1'};
 assert.equal(ui.runtime.onPeephole(door),true);
 assert.equal(ui.overlay.children.length,1);
 assert.equal(ui.overlay.children[0].hidden,false);
 assert.equal(ui.overlay.children[0].textContent,'Hablar con el repartidor');
 assert.equal(ui.dialog().classList.contains('open'),false);
 assert.equal(ui.frozen,false);
 assert.equal(ui.runtime.onPeephole({id:'otra-puerta'}),false);
 assert.equal(ui.overlay.children[0].hidden,true);
});

test('hablar abre un panel compacto sin sprite; cerrar conserva la mirilla',()=>{
 const ui=setup();ui.runtime.onPeephole({id:'puerta1'});
 let prevented=false;
 ui.overlay.children[0].handlers.click({stopPropagation(){prevented=true}});
 assert.equal(prevented,true);
 assert.equal(ui.dialog().classList.contains('open'),true);
 assert.equal(ui.dialog().classList.contains('peephole'),true);
 assert.equal(ui.dialog().html.includes('fhDeliveryPortrait'),false);
 assert.equal(ui.overlay.children[0].hidden,true);
 assert.equal(ui.frozen,true);
 ui.action('Terminar conversación').onclick();
 assert.equal(ui.dialog().classList.contains('open'),false);
 assert.equal(ui.overlay.children[0].hidden,false);
 assert.equal(ui.frozen,false);
 assert.equal(ui.opened,0);
});

test('preguntar mantiene panel compacto y abrir sale de la mirilla',()=>{
 const ui=setup();ui.runtime.onPeephole({id:'puerta1'});
 ui.runtime.talkThroughPeephole();
 ui.action('¿Qué trae?').onclick();
 assert.equal(ui.dialog().classList.contains('peephole'),true);
 ui.action('Abrir la puerta').onclick();
 assert.equal(ui.opened,1);
 assert.equal(ui.overlay.children[0].hidden,true);
 assert.equal(ui.dialog().classList.contains('open'),false);
});

test('salir de la mirilla limpia el diálogo, pero no abre la puerta',()=>{
 const ui=setup();ui.runtime.onPeephole({id:'puerta1'});
 ui.runtime.talkThroughPeephole();
 ui.runtime.onPeepholeExit();
 assert.equal(ui.dialog().classList.contains('open'),false);
 assert.equal(ui.overlay.children[0].hidden,true);
 assert.equal(ui.frozen,false);
 assert.equal(ui.opened,0);
 assert.equal(ui.runtime.talkThroughPeephole(),false);
});

test('tras abrir la puerta se conserva el diálogo normal de pago',()=>{
 const ui=setup();ui.runtime.onPeephole({id:'puerta1'});
 ui.runtime.onPeepholeExit();
 assert.equal(ui.runtime.onDoorOpened({id:'puerta1'}),true);
 assert.equal(ui.dialog().classList.contains('open'),true);
 assert.equal(ui.dialog().classList.contains('peephole'),false);
});

test('la integración del motor conserva sprite 3D y limpieza de mirilla',()=>{
 assert.match(index,/FHDeliveryRuntime\?\.onPeephole\(d\)/);
 assert.match(index,/FHDeliveryRuntime\?\.onPeepholeExit\(\)/);
 assert.match(index,/function fhShowDeliveryNpc\(/);
 assert.match(index,/stories\[door\.f\]\.add\(sprite\)/);
 assert.match(strings,/talkThroughDoor:'Hablar con el repartidor'/);
});
