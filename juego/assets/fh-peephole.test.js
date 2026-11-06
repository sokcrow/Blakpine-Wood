'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'fh-delivery.js'),'utf8');
const visitorSrc=fs.readFileSync(path.join(__dirname,'fh-visitor.js'),'utf8');
const deliveryStrings=fs.readFileSync(path.join(__dirname,'fh-delivery-strings.js'),'utf8');
const visitorStrings=fs.readFileSync(path.join(__dirname,'fh-visitor-strings.js'),'utf8');
const index=fs.readFileSync(path.join(__dirname,'../..','index.html'),'utf8');

function node(tag){
 const children=[],classes=new Set();
 const el={tag,children,handlers:{},hidden:false,id:'',textContent:'',style:{},
  classList:{
   add(...names){names.forEach(n=>classes.add(n))},
   remove(...names){names.forEach(n=>classes.delete(n))},
   contains:name=>classes.has(name),
   toggle(name,on){on?classes.add(name):classes.delete(name);return !!on}
  },
  append(...items){children.push(...items)},
  replaceChildren(...items){children.splice(0,children.length,...items)},
  addEventListener(name,callback){this.handlers[name]=callback},
  setAttribute(name,value){this[name]=value}
 };
 el.querySelector=selector=>{
  const id=selector.replace(/^#/,'');
  function find(root){for(const child of root.children){if(child.id===id)return child;const nested=find(child);if(nested)return nested;}return null}
  return find(el)||el.parts?.[selector]||null;
 };
 Object.defineProperty(el,'innerHTML',{set(html){
  this.html=html;
  if(this.id==='fhDeliveryDialog'){
   this.parts={'#fhDeliveryText':node('div'),'#fhDeliveryActions':node('div')};
   const card=node('div');card.id='fhDeliveryCard';
   card.append(this.parts['#fhDeliveryText'],this.parts['#fhDeliveryActions']);
   this.replaceChildren(card);
  }
 }});
 return el;
}
function setup(){
 const overlay=node('div'),head=node('head'),body=node('body');
 const document={baseURI:'https://example.test/juego/assets/',head,body,
  createElement:node,getElementById:id=>id==='peekOverlay'?overlay:null};
 const win={addEventListener(){}};
 const fetch=async()=>({ok:true,json:async()=>({furniture:[]})});
 const context={window:win,document,URL,Date,fetch,console,setTimeout};
 for(const code of [deliveryStrings,visitorStrings,visitorSrc,src])vm.runInNewContext(code,context);
 const state={},product={id:'mesa',name:'Mesa',kind:'furniture',parcelSize:'pequena',unboxMinutes:10};
 const order=win.FHDelivery.createOrder(state,product,{doorId:'puerta1',paymentMethod:'card'});order.status='waiting';
 let frozen=false,opened=0;
 const runtime=win.FHDelivery.createRuntime({state,freeze:v=>{frozen=v},
  baseUrl:'https://example.test/juego/assets/fh-delivery.js',
  openDoor(){opened++;runtime.onPeepholeExit()}
 });
 win.FHVisitorRuntime=win.FHVisitor.createRuntime({
  resolveEvent:door=>runtime.visitorEvent(door)||door.visitorEvent,
  openDoor(){opened++;runtime.onPeepholeExit()},
  freeze:v=>{frozen=v}
 });
 const visitor=()=>body.children.find(n=>n.id==='fhVisitorDialog');
 const delivery=()=>body.children.find(n=>n.id==='fhDeliveryDialog');
 const visitorActions=()=>visitor()?.querySelector('#fhVisitorActions').children||[];
 const action=label=>visitorActions().find(n=>n.textContent===label);
 return {runtime,visitor,delivery,action,visitorActions,overlay,order,
  get frozen(){return frozen},get opened(){return opened}};
}

test('mirilla: descripción antes del diálogo y siempre opción de abrir',()=>{
 const ui=setup();
 assert.equal(ui.runtime.onPeephole({id:'puerta1'}),true);
 assert.equal(ui.visitor().classList.contains('open'),true);
 assert.equal(ui.visitor().classList.contains('peephole'),true);
 assert.match(ui.visitor().querySelector('#fhVisitorText').textContent,/golpes/i);
 assert.ok(ui.action('Escuchar'));assert.ok(ui.action('Abrir la puerta'));
 assert.equal(ui.visitor().querySelector('#fhDeliveryPortrait'),null);
 assert.equal(ui.frozen,true);
 ui.action('Escuchar').onclick();
 assert.match(ui.visitor().querySelector('#fhVisitorText').textContent,/Hamazon/);
 assert.ok(ui.action('¿Qué trae?'));assert.ok(ui.action('¿Cómo se paga?'));
});

test('diálogo contextual no duplica sprites y deja abrir desde cada respuesta',()=>{
 const ui=setup();ui.runtime.onPeephole({id:'puerta1'});
 ui.action('Escuchar').onclick();
 ui.action('¿Qué trae?').onclick();
 assert.match(ui.visitor().querySelector('#fhVisitorText').textContent,/Mesa/);
 assert.ok(ui.action('Abrir la puerta'));
 ui.action('Abrir la puerta').onclick();
 assert.equal(ui.opened,1);
 assert.equal(ui.visitor().classList.contains('open'),false);
 assert.equal(ui.frozen,false);
});

test('cerrar conversación no abre la puerta y al salir de mirilla limpia el panel',()=>{
 const ui=setup();ui.runtime.onPeephole({id:'puerta1'});
 ui.action('No abrir').onclick();
 assert.equal(ui.opened,0);
 assert.equal(ui.visitor().classList.contains('open'),false);
 ui.runtime.onPeephole({id:'puerta1'});
 ui.runtime.onPeepholeExit();
 assert.equal(ui.visitor().classList.contains('open'),false);
 assert.equal(ui.frozen,false);
 assert.equal(ui.opened,0);
});

test('apertura normal conserva pago sin retrato en el panel',()=>{
 const ui=setup();ui.runtime.onDoorOpened({id:'puerta1'});
 assert.equal(ui.delivery().classList.contains('open'),true);
 assert.equal(ui.delivery().querySelector('#fhDeliveryPortrait'),null);
 assert.match(ui.delivery().querySelector('#fhDeliveryText').textContent,/pago/i);
});

test('evento configurable sin NPC conserva opciones contextuales y apertura',()=>{
 const ui=setup(),ev={id:'silencio',description:'Alguien araña la madera.',
  choices:[{id:'preguntar',label:'¿Qué ocurre?',reply:'No responde.'}]};
 assert.equal(ui.runtime.onPeephole({id:'puerta-sin-pedido',visitorEvent:ev}),true);
 assert.ok(ui.action('¿Qué ocurre?'));assert.ok(ui.action('Abrir la puerta'));
 ui.action('¿Qué ocurre?').onclick();
 assert.equal(ui.visitor().querySelector('#fhVisitorText').textContent,'No responde.');
 assert.ok(ui.action('Abrir la puerta'));
});

test('integración: el motor usa un solo flujo y aplica visión a NPC dinámicos',()=>{
 assert.match(index,/FHVisitorRuntime=window\.FHVisitor\?\.createRuntime/);
 assert.match(index,/FHVisitorRuntime\?\.onDoorAttempt\(d\)/);
 assert.match(index,/fhDeliveryNpcSight\(at,opaque,params\)/);
 assert.match(index,/sameFloor&&litPointVisible/);
 assert.match(index,/visitorEvent:it\.visitorEvent\|\|null/);
 assert.match(index,/visitorStrings\+visitorModule\+deliveryStrings/);
});
