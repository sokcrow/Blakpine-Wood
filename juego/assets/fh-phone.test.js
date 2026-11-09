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

test('calendario de 2016: lunes y febrero bisiesto',()=>{
 const d=Phone.calendarModel({year:2016,month:10,day:31});
 assert.equal(d.date.getUTCDay(),1);
 assert.equal(d.firstDay,5);
 assert.equal(d.days,31);
 assert.match(Phone.formatCalendarDate({year:2016,month:10,day:31}),/lunes.*31.*octubre.*2016/i);
 assert.equal(Phone.calendarModel({year:2016,month:2,day:29}).days,29);
 assert.equal(Phone.calendarModel(null).year,2016);
});
test('las aplicaciones nuevas conservan Hamazon y partidas anteriores',()=>{
 const state={phone:{installedApps:['hamazon','notes'],notes:[],contacts:[],messages:[]}};
 Phone.ensureState(state);
 for(const id of ['calendar','weather','hamazon'])assert.ok(state.phone.installedApps.includes(id));
 assert.equal(Phone.uninstallApp(state,'calendar'),false);
 assert.ok(Phone.BASE_APPS.includes('accounts'));
 assert.ok(state.phone.installedApps.includes('accounts'));
});
function fakePhoneDocument(){
 function node(tag){
  const e={tagName:tag.toUpperCase(),id:'',className:'',children:[],style:{},dataset:{},
   hidden:false,attributes:{},listeners:{},textContent:''};
  e.classList={contains(c){return e.className.split(/\s+/).includes(c)},
   add(c){if(!this.contains(c))e.className=(e.className+' '+c).trim()},
   remove(c){e.className=e.className.split(/\s+/).filter(x=>x!==c).join(' ')}};
  e.append=(...kids)=>{for(const kid of kids){if(kid.parentNode)kid.remove();kid.parentNode=e;e.children.push(kid)}};
  e.replaceChildren=(...kids)=>{for(const old of e.children)old.parentNode=null;e.children=[];e.append(...kids)};
  e.remove=()=>{if(e.parentNode){const siblings=e.parentNode.children;const i=siblings.indexOf(e);if(i>=0)siblings.splice(i,1);e.parentNode=null}};
  e.replaceWith=next=>{if(!e.parentNode)return;const p=e.parentNode,i=p.children.indexOf(e);if(i<0)return;next.parentNode=p;p.children.splice(i,1,next);e.parentNode=null};
  e.setAttribute=(key,value)=>{e.attributes[key]=String(value)};
  e.addEventListener=(name,fn)=>{e.listeners[name]=fn};
  e.querySelectorAll=selector=>{
   const cls=selector.split(',').map(x=>x.trim().replace(/^\./,''));
   const hits=[];
   function visit(p){for(const child of p.children){
    if(cls.some(c=>child.classList.contains(c)))hits.push(child);visit(child);
   }}
   visit(e);return hits;
  };
  e.querySelector=selector=>e.querySelectorAll(selector)[0]||null;
  return e;
 }
 const body=node('body');
 return {body,createElement:node,createElementNS:(_ns,tag)=>node(tag),
  getElementById(id){
   let result=null;
   function visit(p){if(p.id===id){result=p;return}
    for(const c of p.children)if(!result)visit(c)}
   visit(body);return result;
  }};
}
test('Wi-Fi protegido: entrada usable, iconos y candado permanente tras conectar',()=>{
 require('./fh-phone-strings.js');
 const doc=fakePhoneDocument(),net={
  routerId:'router-test',name:'Router Wi-Fi',bars:3,requiresPassword:true,authenticated:false,online:false
 };
 let attempts=0,saves=0;
 const phone=Phone.createRuntime({state:{},document:doc,strings:globalThis.FH_PHONE_TEXT,
  networks:()=>[net],save:()=>saves++,
  connectWifi:(id,password)=>{
   attempts++;assert.equal(id,'router-test');
   if(password!=='sok')return false;
   net.authenticated=true;net.online=true;return true;
  }});
 assert.equal(phone.open(),true);
 const app=doc.body.querySelectorAll('.fh-phone-app').find(x=>x.dataset.app==='network');
 assert.ok(app);app.listeners.click();
 const card=doc.body.querySelector('.fh-phone-network-card');
 assert.ok(card);
 assert.ok(card.querySelector('.fh-phone-network-lock'),'la red protegida tiene candado');
 assert.equal(card.querySelector('.fh-phone-network-strength').children[1].textContent,'Excelente');
 assert.equal(card.querySelector('.fh-phone-network-signal').children.length,4);
 assert.equal(card.querySelector('.fh-phone-network-signal').children[0].tagName,'PATH');
 const form=card.querySelector('.fh-phone-network-form');
 const field=card.querySelector('.fh-phone-network-password-field');
 const password=field.children[0],visibility=field.children[1],connect=form.children[1];
 assert.equal(password.type,'password');
 assert.equal(password.attributes['aria-label'],'Contraseña Wi-Fi');
 assert.equal(connect.disabled,true);
 password.value='equivocada';password.listeners.input();assert.equal(connect.disabled,false);
 visibility.listeners.click();
 assert.equal(password.type,'text');
 assert.equal(visibility.attributes['aria-pressed'],'true');
 visibility.listeners.click();
 assert.equal(password.type,'password');
 form.listeners.submit({preventDefault(){}});
 assert.equal(attempts,1);assert.equal(saves,0);
 password.value='sok';password.listeners.input();
 form.listeners.submit({preventDefault(){}});
 assert.equal(attempts,2);assert.equal(saves,1);
 const connected=doc.body.querySelector('.fh-phone-network-card');
 assert.ok(connected.querySelector('.fh-phone-network-lock'),'el candado persiste al autenticar');
 assert.equal(connected.querySelector('.fh-phone-network-status').textContent,'Conectado');
 assert.equal(connected.querySelector('.fh-phone-network-form'),null);
});
test('Wi-Fi abierto: sin candado ni formulario, calidad sin contador de barras',()=>{
 require('./fh-phone-strings.js');
 const doc=fakePhoneDocument();
 const phone=Phone.createRuntime({state:{},document:doc,strings:globalThis.FH_PHONE_TEXT,
  networks:()=>[{routerId:'abierto',name:'Red libre',bars:2,requiresPassword:false,authenticated:true,online:true}]});
 assert.equal(phone.open(),true);
 doc.body.querySelectorAll('.fh-phone-app').find(x=>x.dataset.app==='network').listeners.click();
 const card=doc.body.querySelector('.fh-phone-network-card');
 assert.ok(card);
 assert.equal(card.querySelector('.fh-phone-network-lock'),null);
 assert.equal(card.querySelector('.fh-phone-network-form'),null);
 assert.equal(card.querySelector('.fh-phone-network-strength').children[1].textContent,'Buena');
 assert.equal(card.querySelector('.fh-phone-network-status').textContent,'Conectado');
});
test('ondas Wi-Fi cambian en tiempo real sin perder contraseña ni foco',()=>{
 require('./fh-phone-strings.js');
 const doc=fakePhoneDocument();
 const net={routerId:'radio1',name:'Red protegida',requiresPassword:true,bars:3,authenticated:false,online:false};
 const phone=Phone.createRuntime({state:{},document:doc,strings:globalThis.FH_PHONE_TEXT,networks:()=>[net]});
 assert.equal(phone.open(),true);
 doc.body.querySelectorAll('.fh-phone-app').find(x=>x.dataset.app==='network').listeners.click();
 const row=doc.body.querySelector('.fh-phone-network-card');
 const input=row.querySelector('.fh-phone-network-password-field').children[0];
 const icon=row.querySelector('.fh-phone-network-signal');
 input.value='contrasena-en-progreso';input.listeners.input();
 doc.activeElement=input;
 const bar=i=>icon.children[i].attributes.opacity;
 assert.deepEqual([bar(0),bar(1),bar(2)],['1','1','1']);
 net.bars=1;phone.update(.55);
 assert.equal(doc.body.querySelector('.fh-phone-network-card'),row);
 assert.equal(input.value,'contrasena-en-progreso');
 assert.equal(doc.activeElement,input);
 assert.deepEqual([bar(0),bar(1),bar(2)],['1','.2','.2']);
 assert.equal(row.querySelector('.fh-phone-network-strength').children[1].textContent,'Débil');
 net.bars=2;phone.update(.55);
 assert.deepEqual([bar(0),bar(1),bar(2)],['1','1','.2']);
 assert.equal(row.querySelector('.fh-phone-network-strength').children[1].textContent,'Buena');
 net.bars=3;phone.update(.55);
 assert.deepEqual([bar(0),bar(1),bar(2)],['1','1','1']);
 assert.equal(row.querySelector('.fh-phone-network-strength').children[1].textContent,'Excelente');
});
test('pérdida temporal de señal conserva la contraseña y recupera Conectar',()=>{
 require('./fh-phone-strings.js');
 const doc=fakePhoneDocument();
 let networks=[{routerId:'radio1',name:'Router',requiresPassword:true,bars:3,authenticated:false}];
 const phone=Phone.createRuntime({state:{},document:doc,strings:globalThis.FH_PHONE_TEXT,networks:()=>networks});
 assert.equal(phone.open(),true);
 doc.body.querySelectorAll('.fh-phone-app').find(x=>x.dataset.app==='network').listeners.click();
 const row=doc.body.querySelector('.fh-phone-network-card');
 const input=row.querySelector('.fh-phone-network-password-field').children[0];
 const submit=row.querySelector('.fh-phone-network-form').children[1];
 input.value='clave';input.listeners.input();assert.equal(submit.disabled,false);
 networks=[];phone.update(.55);
 assert.equal(doc.body.querySelector('.fh-phone-network-card'),row);
 assert.equal(input.value,'clave');
 assert.equal(row.querySelector('.fh-phone-network-strength').children[1].textContent,'Sin señal');
 assert.equal(submit.disabled,true);
 networks=[{routerId:'radio1',name:'Router',requiresPassword:true,bars:2,authenticated:false}];
 phone.update(.55);
 assert.equal(doc.body.querySelector('.fh-phone-network-card'),row);
 assert.equal(input.value,'clave');
 assert.equal(submit.disabled,false);
});
test('redes nuevas, desaparecidas y cortes de internet se actualizan sin reabrir Redes',()=>{
 require('./fh-phone-strings.js');
 const doc=fakePhoneDocument();
 const a={routerId:'a',name:'Red A',bars:2,authenticated:true,requiresPassword:false,online:true};
 const b={routerId:'b',name:'Red B',bars:1,authenticated:true,requiresPassword:true,online:false};
 let networks=[a];
 const phone=Phone.createRuntime({state:{},document:doc,strings:globalThis.FH_PHONE_TEXT,networks:()=>networks});
 assert.equal(phone.open(),true);
 doc.body.querySelectorAll('.fh-phone-app').find(x=>x.dataset.app==='network').listeners.click();
 const original=doc.body.querySelector('.fh-phone-network-card');
 a.online=false;phone.update(.55);
 assert.equal(original.querySelector('.fh-phone-network-status').textContent,'Red Wi-Fi sin internet');
 networks=[a,b];phone.update(.55);
 assert.equal(doc.body.querySelectorAll('.fh-phone-network-card').length,2);
 assert.equal(doc.body.querySelectorAll('.fh-phone-network-lock').length,1);
 networks=[b];phone.update(.55);
 assert.equal(doc.body.querySelectorAll('.fh-phone-network-card').length,1);
 assert.equal(doc.body.querySelector('.fh-phone-network-name').textContent,'Red B');
 networks=[];phone.update(.55);
 assert.equal(doc.body.querySelectorAll('.fh-phone-network-card').length,0);
 assert.equal(doc.body.querySelector('.fh-phone-empty').hidden,false);
});
test('Wi-Fi móvil: formulario apilado y targets táctiles de ancho completo',()=>{
 const css=fs.readFileSync(path.resolve(__dirname,'fh-phone.css'),'utf8');
 assert.match(css,/#fhPhonePanel \.fh-phone-network-card\{\s*flex-direction:column/);
 assert.match(css,/#fhPhonePanel \.fh-phone-network-form\{display:flex;flex-direction:column/);
 assert.match(css,/#fhPhonePanel \.fh-phone-network-password-field input\{[\s\S]*?width:100%/);
 assert.match(css,/#fhPhonePanel \.fh-phone-network-form \.fh-phone-primary\{[\s\S]*?width:100%/);
 assert.match(css,/#fhPhonePanel \.fh-phone-network-visibility\{[\s\S]*?width:44px;height:44px/);
});
test('widget muestra el estado del juego y el calendario se abre',()=>{
 require('./fh-phone-strings.js');
 const doc=fakePhoneDocument();
 const state={clock:{year:2016,month:10,day:31,minutes:480},
  weather:{nextAt:Date.UTC(2016,9,31)/60000+900}};
 const current={type:'tormenta',phase:'lluvia',season:'otono',temp:8,fog:1,snow:0,wetness:.5};
 const phone=Phone.createRuntime({state,document:doc,strings:globalThis.FH_PHONE_TEXT,weather:()=>current});
 assert.equal(phone.open(),true);
 const widget=doc.body.querySelector('.fh-phone-weather-widget');
 assert.ok(widget);
 assert.match(widget.querySelector('.fh-phone-weather-condition').textContent,/Tormenta/);
 assert.equal(widget.querySelector('.fh-phone-weather-temp').textContent,'8 °C');
 widget.listeners.click();
 assert.ok(doc.body.querySelector('.fh-phone-weather-detail'));
 phone.close();phone.open();
 const calendar=doc.body.querySelectorAll('.fh-phone-app').find(x=>x.dataset.app==='calendar');
 assert.ok(calendar);
 calendar.listeners.click();
 const grid=doc.body.querySelector('.fh-phone-calendar-grid');
 assert.equal(grid.children.length,43);
 assert.ok(grid.querySelector('.is-today'));
});
test('el celular conserva el estilo y consulta el clima del motor',()=>{
 const main=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
 const css=fs.readFileSync(path.resolve(__dirname,'fh-phone.css'),'utf8');
 assert.match(main,/year:2016,month:6,day:1,minutes:480/);
 assert.match(main,/weather:\(\)=>window\.FHWeatherRuntime\?\.view\?\.\(\)\|\|null/);
 assert.match(main,/window\.FHWeatherRuntime=fhWeather/);
 assert.match(css,/\.fh-phone-weather-widget/);
 assert.match(css,/\.fh-phone-calendar-grid/);
 assert.match(main,/forest-horror-map-v1/);
});

test('Cuentas muestra el saldo del personaje, rechazos y permite refrescar sin cobrar',()=>{
 const E=require('./fh-economy-core.js'),View=require('./fh-economy-view.js');
 require('./fh-economy-strings.js');
 require('./fh-phone-strings.js');
 let state=E.ensureOwner(E.createEconomy(),{ownerType:'character',ownerId:'ana'}).state;
 const cash=E.accountId('character','ana','cash'),bank=E.accountId('character','ana','bank');
 const req=(id,amountCents)=>({id,amountCents,category:'test',gameMinutes:480});
 state=E.credit(state,{...req('start',5000),to:bank,externalRef:'system:initial'}).state;
 state=E.debit(state,{...req('rejected',7000),from:cash,externalRef:'system:payment'}).state;
 let writes=0,raw=E.serialize(state);
 const storage={getItem:()=>raw,setItem(){writes++}};
 const doc=fakePhoneDocument();
 const phone=Phone.createRuntime({state:{clock:{minutes:480},characterId:'ana'},
  document:doc,strings:globalThis.FH_PHONE_TEXT,economyView:View,economyStorage:storage});
 assert.equal(phone.open(),true);
 const app=doc.body.querySelectorAll('.fh-phone-app').find(x=>x.dataset.app==='accounts');
 assert.ok(app,'La aplicación Cuentas aparece en el inicio');
 app.listeners.click();
 assert.deepEqual(doc.body.querySelectorAll('.fh-phone-account-card').map(x=>x.children[1].textContent),
  ['$0.00','$50.00']);
 assert.equal(doc.body.querySelector('.fh-phone-account-total').children[1].textContent,'$50.00');
 const movements=doc.body.querySelectorAll('.fh-phone-account-movement');
 assert.equal(movements.length,2);
 assert.equal(movements[0].dataset.status,'rejected');
 assert.match(movements[0].children[0].children[1].textContent,/Fondos insuficientes/);
 assert.equal(writes,0);
 state=E.credit(state,{...req('new',225),to:cash,externalRef:'system:grant'}).state;
 raw=E.serialize(state);
 doc.body.querySelector('.fh-phone-account-refresh').listeners.click();
 assert.deepEqual(doc.body.querySelectorAll('.fh-phone-account-card').map(x=>x.children[1].textContent),
  ['$2.25','$50.00']);
 assert.equal(writes,0);
});
