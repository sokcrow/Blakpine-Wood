/* Prueba de contrato del diálogo del repartidor sin navegador ni dependencias externas. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');

class Classes{
 constructor(){this.values=new Set()}
 add(...xs){xs.forEach(x=>this.values.add(x))}
 remove(...xs){xs.forEach(x=>this.values.delete(x))}
 toggle(x,value=!this.values.has(x)){value?this.values.add(x):this.values.delete(x);return value}
 contains(x){return this.values.has(x)}
}
class Element{
 constructor(doc,tag){this.doc=doc;this.tag=tag;this.children=[];this.classList=new Classes();this.listeners={};this.style={};this.isConnected=true;this._text=''}
 set id(v){this._id=v;this.doc.ids[v]=this}get id(){return this._id||''}
 set className(v){this.classList.values=new Set(String(v).split(/\s+/))}
 get textContent(){return this.children.length?this.children.map(x=>x.textContent).join(''):this._text}
 set textContent(v){this._text=String(v);this.children=[]}
 set innerHTML(html){
  this.children=[];
  if(html.includes('fhDeliveryCard')){
   const card=this.doc.createElement('div');card.id='fhDeliveryCard';this.append(card);
   for(const id of ['fhDeliveryName','fhDeliveryText','fhDeliveryActions']){
    const child=this.doc.createElement('div');child.id=id;card.append(child);
   }
  }else if(html.includes('fh-panel')){
   const panel=this.doc.createElement('div');panel.className='fh-panel';this.append(panel);
   for(const cls of ['fh-speaker','fh-text','fh-measure','fh-reveal','fh-next']){
    const child=this.doc.createElement('div');child.className=cls;panel.append(child);
   }
  }
 }
 append(...elements){for(const el of elements){this.children.push(el);el.parent=this}}
 appendChild(el){this.append(el);return el}
 replaceChildren(...children){this._text='';this.children=[];this.append(...children)}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);this.isConnected=false}
 querySelector(selector){
  const matching=e=>selector[0]==='#'?e.id===selector.slice(1):selector[0]==='.'?e.classList.contains(selector.slice(1)):e.tag===selector;
  const visit=root=>{for(const child of root.children){if(matching(child))return child;const result=visit(child);if(result)return result}return null};
  return visit(this);
 }
 setAttribute(){}
 addEventListener(event,fn){(this.listeners[event]??=[]).push(fn)}
 removeEventListener(event,fn){this.listeners[event]=(this.listeners[event]||[]).filter(f=>f!==fn)}
 focus(){this.focused=true}
}
async function setup(method,checkout={}){
 const document={ids:{},baseURI:'https://example.test/juego/assets/',createElement(tag){return new Element(this,tag)},getElementById(id){return this.ids[id]||null}};
 document.head=document.createElement('head');document.body=document.createElement('body');
 const listeners={};let timerId=0;
 const window={document,console,performance:{now:()=>0},matchMedia:()=>({matches:false}),setTimeout(){return ++timerId},clearTimeout(){},
  addEventListener(name,fn){(listeners[name]??=[]).push(fn)},
  removeEventListener(name,fn){listeners[name]=(listeners[name]||[]).filter(f=>f!==fn)}};
 window.window=window;
 const furniture={furniture:[{id:'mesa',name:'Mesa',widthFt:2,depthFt:2,heightFt:2,price:20,glb:'modelos_glb/mesa.glb',environment:'interior'}]};
 const boxes={furniture:[{id:'caja_carton_pequena',name:'Caja',widthFt:1,depthFt:1,heightFt:1,parcelSize:'pequena'}]};
 const fetch=async url=>({ok:true,json:async()=>String(url).includes('catalogo_delivery')?boxes:furniture});
 const sandbox={window,document,URL,fetch,console,setTimeout:window.setTimeout,clearTimeout:window.clearTimeout};
 for(const name of ['fh-live-text-strings.js','fh-live-text.js','fh-delivery-strings.js','fh-delivery.js'])
  vm.runInNewContext(read(name),sandbox,{filename:name});
 const state={clock:{minutes:480}},door={id:'door1',f:0,cx:2,cz:3,norm:{x:1,z:0},apartmentId:'apto_4okzw_a4qn2l'};
 const effects={knocks:0,opened:0,created:[],freezes:[],ended:0};let runtime;
 runtime=window.FHDelivery.createRuntime({
  state,baseUrl:document.baseURI,cell:1.524,feetPerCell:5,deliveryLeadMinutes:0,
  validateProduct:async product=>product.id==='mesa',
  findDoor:()=>door,doorById:()=>door,notice(){},save(){},showNpc(){},hideNpc(){},
  resolveDoorAddress:()=>({id:'parcel_test',name:'Apartamento 5 A'}),
  propertyNameById:id=>id==='parcel_test'?'Apartamento 5 A':'',endDoorEvent(){effects.ended++;},
  listDeliveryAddresses:()=>[
   {id:'property:parcel_test',doorId:door.id,floor:0,propertyId:'parcel_test',propertyName:'Apartamento 5 A',label:'Apartamento 5 A'},
   {id:'room:f1:sala',doorId:door.id,floor:0,propertyId:'parcel_test',propertyName:'Apartamento 5 A',roomId:'sala',label:'Apartamento 5 A · Sala'}
  ],
  replacePackage:(item,p,order)=>({item:{id:'delivered_'+item.id,x:item.x,y:item.y,rotation:0,runtimeDeliveryFurniture:{orderId:order.id,productId:p.id}},floor:0}),
  knock(){effects.knocks++;return true},freeze:v=>effects.freezes.push(v),
  openDoor(){effects.opened++;runtime.onDoorOpened(door)},
  packagePlacement:()=>({floor:0,x:3,z:5}),spawnRuntimeItem:item=>effects.created.push(item)
 });
 for(let n=0;n<50&&!runtime.ready;n++)await Promise.resolve();
 assert.equal(runtime.ready,true);
 for(let n=0;n<50&&runtime.products[0]?.shopStatus!=='available';n++)await Promise.resolve();
 assert.equal(runtime.products[0].shopStatus,'available');
 const order=runtime.placeOrder('mesa',method,checkout);
 const press=key=>{
  const event={key,repeat:false,target:document.getElementById('fhDeliveryText'),preventDefault(){},stopImmediatePropagation(){this.stopped=true}};
  for(const handler of [...listeners.keydown||[]]){handler(event);if(event.stopped)break}
 };
 const clickChoice=index=>{
  const buttons=document.getElementById('fhDeliveryActions');
  if(buttons.classList.contains('fh-waiting'))press('e');
  assert.equal(buttons.classList.contains('fh-waiting'),false,'E revela el texto completo');
  buttons.children[index].onclick();
 };
 return {runtime,order,door,document,effects,press,clickChoice,state};
}
for(const payment of ['cash','card','prepaid']){
 test('repartidor: diálogo de puerta y entrega ('+payment+')',async()=>{
  const env=await setup(payment),{runtime,order,door,document,effects,clickChoice,press}=env;
  assert.equal(order.status,'waiting');
  assert.equal(order.propertyId,'parcel_test');
  assert.equal(effects.knocks,1);
  assert.equal(runtime.onPeephole(door),true);
  assert.equal(runtime.talkThroughPeephole(),true);
  const root=document.getElementById('fhDeliveryDialog'),body=document.getElementById('fhDeliveryText');
  assert.equal(root.classList.contains('open'),true);
  assert.equal(document.getElementById('fhDeliveryName').textContent,'Repartidor de paquetería');
  assert.ok(body.querySelector('.fh-measure'));
  assert.ok(body.querySelector('.fh-reveal'));
  press('e'); // Mostrar saludo completo antes de preguntar.
  assert.match(body.textContent,/Apartamento 5 A/);
  assert.doesNotMatch(body.textContent,/apto_4okzw_a4qn2l/);
  clickChoice(0); // ¿Quién es?
  assert.match(body.textContent,/repartidor de Hamazon/i);
  clickChoice(0); // Volver a preguntar.
  clickChoice(1); // ¿Qué trae?
  assert.match(body.textContent,/paquete/i);
  clickChoice(0); // Volver a preguntar.
  clickChoice(2); // ¿Para qué apartamento?
  assert.match(body.textContent,/Apartamento 5 A/);
  assert.equal(effects.ended,0,'ninguna pregunta debe terminar el evento');
  clickChoice(0); // Volver a preguntar.
  clickChoice(4); // Abrir la puerta.
  assert.equal(effects.opened,1);
  assert.equal(root.classList.contains('peephole'),false);
  assert.equal(runtime.dialogOpen,true,'abrir la puerta conserva el diálogo');
  assert.equal(effects.ended,0,'abrir la puerta no termina el evento');
  clickChoice(4); // Continuar con la entrega.
  if(payment==='prepaid')assert.equal(order.status,'delivering');
  else{
   assert.equal(order.status,'payment');
   clickChoice(0); // Entregar efectivo / Pagar con tarjeta.
   assert.equal(order.status,'delivering');
  }
  clickChoice(0); // Recibir paquete.
  assert.equal(order.status,'delivered');
  assert.equal(effects.created.length,1);
  assert.equal(root.classList.contains('open'),false);
  assert.equal(effects.ended,1,'la vista de puerta termina al recibir el paquete');
  assert.equal(effects.freezes.at(-1),false);
 });
}
test('un ataque interrumpe el diálogo sin completar el pedido',async()=>{
 const {runtime,order,door,effects}=await setup('prepaid');
 runtime.onPeephole(door);
 runtime.talkThroughPeephole();
 assert.equal(runtime.interruptDialogue(),true);
 assert.equal(runtime.dialogOpen,false);
 assert.equal(effects.ended,1);
 assert.equal(order.status,'waiting');
 assert.equal(effects.created.length,0);
});

test('Hamazon entrega tres unidades a la habitación seleccionada usando una sola puerta',async()=>{
 const env=await setup('prepaid',{quantity:3,addressId:'room:f1:sala'});
 const {runtime,order,door,effects,clickChoice,state}=env;
 assert.equal(order.quantity,3);
 assert.equal(order.propertyId,'parcel_test');
 assert.equal(order.roomId,'sala');
 assert.equal(order.addressLabel,'Apartamento 5 A · Sala');
 assert.equal(order.doorId,'door1');
 runtime.onPeephole(door);
 runtime.talkThroughPeephole();
 clickChoice(4); // Abrir
 clickChoice(4); // Continuar
 clickChoice(0); // Recibir
 assert.equal(order.status,'delivered');
 assert.equal(effects.created.length,3,'tres cajas, una visita');
 assert.equal(new Set(effects.created.map(c=>c.id)).size,3,'cajas con IDs independientes');
 assert.equal(state.delivery.packages.length,3);
 for(const [i,pack] of effects.created.entries()){
  assert.equal(runtime.openPackage(pack),true,'cada caja se puede abrir');
  assert.equal(order.unboxedCount,i+1);
  assert.equal(order.status,i===2?'unboxed':'delivered');
 }
 assert.equal(state.delivery.packages.length,0);
 assert.equal(state.delivery.furnishings.length,3);
 assert.equal(new Set(state.delivery.furnishings.map(r=>r.id)).size,3,'muebles independientes');
});
test('Hamazon valida cantidad y dirección sin modificar pedidos anteriores',async()=>{
 const {runtime,order}=await setup('prepaid');
 const before=runtime.orders.length;
 assert.equal(order.quantity,1,'pedidos sin cantidad conservan 1');
 for(const quantity of [0,-1,1.5,21,'incorrecto']){
  assert.equal(runtime.placeOrder('mesa','prepaid',{quantity}),null);
 }
 assert.equal(runtime.placeOrder('mesa','prepaid',{quantity:2,addressId:'room:f1:inexistente'}),null);
 assert.equal(runtime.orders.length,before);
 const second=runtime.placeOrder('mesa','cash',{quantity:2,addressId:'property:parcel_test'});
 assert.ok(second);
 assert.equal(second.quantity,2);
 assert.equal(second.propertyId,'parcel_test');
 assert.equal(second.payment.amount,40);
});
