/* Forest Horror — pedidos Hamazon y Delivery Man.
 * Runtime solamente: no modifica forest-horror-map-v1.
 */
(function(global){
'use strict';
const TEXT=global.FH_DELIVERY_TEXT||{};
const BOX_IDS={pequena:'caja_carton_pequena',mediana:'caja_carton_mediana',grande:'caja_carton_grande'};
const UNBOX_MINUTES={pequena:10,mediana:20,grande:40};
const DEFAULT_DELIVERY_LEAD_MINUTES=60;
const clone=v=>JSON.parse(JSON.stringify(v));
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
function ensureState(state){
 if(!state.delivery||typeof state.delivery!=='object')state.delivery={};
 const d=state.delivery;
 if(!Array.isArray(d.orders))d.orders=[];
 if(!Array.isArray(d.packages))d.packages=[];
 if(!d.npc||typeof d.npc!=='object')d.npc={activeOrderId:null,doorId:null,state:'idle',pose:'idle'};
 if(!state.clock||typeof state.clock!=='object')state.clock={minutes:8*60};
 if(!Number.isFinite(Number(state.clock.minutes)))state.clock.minutes=8*60;
 return d;
}
function parcelSize(product){
 const w=finite(product?.widthFt,1),d=finite(product?.depthFt,1),h=finite(product?.heightFt,1);
 if(w<=2.5&&d<=2.5&&h<=2.5)return 'pequena';
 if(w<=5&&d<=5&&h<=5)return 'mediana';
 return 'grande';
}
function normalizeProduct(p,base){
 const size=p.parcelSize||parcelSize(p);
 return {id:String(p.id||''),productId:String(p.id||''),modelId:String(p.modelId||p.id||''),kind:String(p.kind||'furniture'),
  name:String(p.name||p.id||''),category:String(p.category||''),widthFt:finite(p.widthFt,1),depthFt:finite(p.depthFt,1),heightFt:finite(p.heightFt,1),
  parcelSize:size,unboxMinutes:Math.max(0,finite(p.unboxMinutes,UNBOX_MINUTES[size]||0)),price:p.price==null?null:finite(p.price,0),
  placement:String(p.placement||'floor'),supportSurfaces:Array.isArray(p.supportSurfaces)?clone(p.supportSurfaces):[],blocksMovement:p.blocksMovement!==false,
  thumbnail:p.thumbnail?new URL(String(p.thumbnail),base).href:''};
}
function createOrder(state,product,options={}){
 const d=ensureState(state),now=finite(state.clock.minutes,0),seq=d.orders.length+1;
 const method=['cash','card','prepaid'].includes(options.paymentMethod)?options.paymentMethod:'prepaid';
 const order={id:'hamazon_'+Date.now().toString(36)+'_'+seq,kind:product.kind,productId:product.id,modelId:product.modelId,name:product.name,
  parcelSize:product.parcelSize,unboxMinutes:product.unboxMinutes,price:product.price,paymentMethod:method,
  payment:{required:method!=='prepaid',method,status:method==='prepaid'?'paid':'pending',amount:product.price},
  status:'placed',createdAtMinutes:now,deliveryAtMinutes:now+Math.max(0,finite(options.leadMinutes,0)),
  floor:Number.isInteger(options.floor)?options.floor:0,doorId:options.doorId||'',apartmentId:options.apartmentId||'',packageId:null};
 d.orders.push(order);return order;
}
function activeOrderForDoor(state,doorId){
 const d=ensureState(state);
 return d.orders.find(o=>o.doorId===doorId&&['waiting','payment','delivering'].includes(o.status))||null;
}
function orderById(state,id){return ensureState(state).orders.find(o=>o.id===id)||null}
function advanceTime(state,minutes){ensureState(state);state.clock.minutes=Math.max(0,finite(state.clock.minutes,0)+Math.max(0,finite(minutes,0)));return state.clock.minutes}
function tickClock(state,seconds,minutesPerSecond=1){const dt=Math.max(0,finite(seconds,0)),rate=Math.max(0,finite(minutesPerSecond,1));return advanceTime(state,dt*rate)}
function formatMinutes(minutes){const m=((Math.floor(finite(minutes,0))%(24*60))+(24*60))%(24*60);return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
function formatClock(state){return formatMinutes(state?.clock?.minutes)}
function nextDueOrder(state){
 const d=ensureState(state),now=finite(state.clock.minutes,0),pending=new Set(['scheduled','queued','placed']);
 return d.orders.filter(o=>pending.has(o.status)&&finite(o.deliveryAtMinutes,now)<=now)
  .sort((a,b)=>finite(a.deliveryAtMinutes,now)-finite(b.deliveryAtMinutes,now)||finite(a.createdAtMinutes,0)-finite(b.createdAtMinutes,0))[0]||null;
}
function createRuntime(options){
 const state=options.state,delivery=ensureState(state),base=options.baseUrl||document.baseURI;
 let products=[],boxes=[],pcItem=null,pcFloor=0,terminal=null,dialog=null,npcOrder=null,ready=false;
 const clockRate=Math.max(0,finite(options.clockMinutesPerSecond,1));
 const defaultLeadMinutes=Math.max(0,finite(options.deliveryLeadMinutes,DEFAULT_DELIVERY_LEAD_MINUTES));
 const productById=id=>products.find(p=>p.id===id)||null;
 const boxBySize=size=>boxes.find(b=>b.parcelSize===size)||boxes.find(b=>b.id===BOX_IDS[size])||null;
 const save=()=>options.save?.();
 const say=(m,ms)=>options.notice?.(m,ms);
 function leadMinutesFor(product){
  const configured=typeof options.deliveryLeadMinutes==='function'?options.deliveryLeadMinutes(product,state):defaultLeadMinutes;
  return Math.max(0,finite(configured,DEFAULT_DELIVERY_LEAD_MINUTES));
 }
 function terminalOrders(){return delivery.orders.map(o=>({id:o.id,productId:o.productId,name:o.name,status:o.status,paymentMethod:o.paymentMethod,
  deliveryAtMinutes:o.deliveryAtMinutes,eta:formatMinutes(o.deliveryAtMinutes)}))}
 function syncOrdersToTerminal(){try{terminal?.contentWindow?.ForestTerminal3D?.setHamazonOrders(terminalOrders())}catch{}}
 function syncProductsToTerminal(){try{terminal?.contentWindow?.ForestTerminal3D?.setHamazonProducts(products)}catch{}}
 async function loadCatalogs(){
  try{
   const furnitureUrl=new URL('../../forest-horror/biblioteca/catalogo_muebles.json',base);
   const deliveryUrl=new URL('../../forest-horror/biblioteca/catalogo_delivery.json',base);
   const f=await fetch(furnitureUrl).then(r=>r.ok?r.json():Promise.reject(Error(r.status)));
   const d=await fetch(deliveryUrl).then(r=>r.ok?r.json():Promise.reject(Error(r.status))).catch(err=>{console.warn('Hamazon: catálogo de paquetería no disponible',err);return {furniture:[]}});
   const catalogBase=new URL('../../forest-horror/biblioteca/',base);
   products=(f.furniture||[]).map(p=>normalizeProduct({...p,kind:'furniture'},catalogBase));
   boxes=(d.furniture||[]).map(p=>({...p,modelId:p.id,parcelSize:p.parcelSize||parcelSize(p)}));
   ready=true;syncProductsToTerminal();syncOrdersToTerminal();resume();
  }catch(err){console.warn('Hamazon: catálogo de muebles no disponible',err)}
 }
 function ensureTerminal(){
  if(terminal)return terminal;
  const style=document.createElement('style');style.textContent=
   '#fhPcOverlay{position:fixed;inset:0;z-index:60;background:#070b0d;display:none}#fhPcOverlay.open{display:block}'+
   '#fhPcFrame{width:100%;height:100%;border:0;display:block}#fhPcExit{position:absolute;z-index:5;right:max(10px,env(safe-area-inset-right));bottom:max(10px,env(safe-area-inset-bottom));'+
   'border:2px solid #b59b6e;background:#171d1c;color:#f1dfb8;padding:9px 13px;font:700 11px monospace;box-shadow:3px 4px #0009}';
  document.head.append(style);
  const wrap=document.createElement('div');wrap.id='fhPcOverlay';wrap.setAttribute('aria-hidden','true');
  const frame=document.createElement('iframe');frame.id='fhPcFrame';frame.title='RAVEN/OS · Hamazon';frame.setAttribute('allow','fullscreen');
  frame.src=new URL('fh-terminal.html',base).href;
  const exit=document.createElement('button');exit.id='fhPcExit';exit.textContent=TEXT.pcClose||'Salir de la PC';exit.onclick=closePc;
  wrap.append(frame,exit);document.body.append(wrap);terminal=frame;
  frame.addEventListener('load',()=>{const api=frame.contentWindow?.ForestTerminal3D;if(!api)return;api.setHamazonProducts(products);api.setHamazonOrders(terminalOrders());api.power(true);api.open();});
  return frame;
 }
 function openPc(item,floor=0){pcItem=item;pcFloor=floor;const frame=ensureTerminal(),wrap=frame.parentElement;wrap.classList.add('open');wrap.setAttribute('aria-hidden','false');options.freeze?.(true);setTimeout(()=>{const api=frame.contentWindow?.ForestTerminal3D;api?.setHamazonProducts(products);api?.setHamazonOrders(terminalOrders());api?.power(true);api?.open();},0);return true}
 function closePc(){if(!terminal)return;terminal.parentElement.classList.remove('open');terminal.parentElement.setAttribute('aria-hidden','true');options.freeze?.(false);pcItem=null}
 function chooseDoor(){
  const door=options.findDoor?.(pcItem,pcFloor);return door||null;
 }
 function activateNext(){
  if(delivery.orders.some(o=>['waiting','payment','delivering'].includes(o.status)))return null;
  const next=nextDueOrder(state);if(!next)return null;
  const door=options.doorById?.(next.doorId,next.floor);if(!door)return null;
  next.status='waiting';delivery.npc={activeOrderId:next.id,doorId:door.id,state:'waiting_at_door',pose:'idle'};
  npcOrder=next;options.showNpc?.(next,door,'idle');say(TEXT.orderWaiting||'Llaman a la puerta.',2600);save();syncOrdersToTerminal();return next;
 }
 function placeOrder(productId,paymentMethod){
  const p=productById(productId);if(!p){say(TEXT.productMissing||'Producto no disponible.');return null}
  const door=chooseDoor();if(!door){say(TEXT.noDeliveryDoor||'No hay puerta de entrega.',3600);return null}
  const order=createOrder(state,p,{paymentMethod,leadMinutes:leadMinutesFor(p),floor:door.f,doorId:door.id,apartmentId:door.apartmentId||pcItem?.apartmentId||''});
  order.status='scheduled';
  const eta=formatMinutes(order.deliveryAtMinutes);
  say((TEXT.orderScheduled||((n,t)=>'Pedido registrado: '+n+'. Entrega estimada: '+t+'.'))(p.name,eta),3200);
  save();syncOrdersToTerminal();update(0);return order;
 }
 function ensureDialog(){
  if(dialog)return dialog;
  const style=document.createElement('style');style.textContent=
   '#fhDeliveryDialog{position:fixed;z-index:70;inset:0;display:none;align-items:flex-end;justify-content:center;padding:18px;background:#0005;pointer-events:auto}'+
   '#fhDeliveryDialog.open{display:flex}#fhDeliveryCard{width:min(520px,94vw);background:#11151aeF;border:1px solid #a98d67;color:#eee1ca;padding:13px;box-shadow:0 14px 50px #000d;font:13px/1.45 Georgia,serif}'+
   '#fhDeliveryPortrait{height:min(48vh,420px);background:linear-gradient(#1110,#1118);display:flex;align-items:flex-end;justify-content:center;overflow:hidden;margin:-8px -8px 10px}'+
   '#fhDeliveryPortrait img{height:100%;max-width:100%;object-fit:contain}#fhDeliveryPortrait .fallback{font:700 14px monospace;color:#9fa9b7;padding:30px}'+
   '#fhDeliveryText{min-height:40px}#fhDeliveryActions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}#fhDeliveryActions button{border:1px solid #806c59;background:#292a2b;color:#f2e4cf;padding:9px 11px;font:700 12px system-ui}';
  document.head.append(style);
  const root=document.createElement('div');root.id='fhDeliveryDialog';root.innerHTML='<div id="fhDeliveryCard"><div id="fhDeliveryPortrait"></div><div id="fhDeliveryText"></div><div id="fhDeliveryActions"></div></div>';
  document.body.append(root);dialog=root;return root;
 }
 function spriteUrl(pose){return options.spriteUrl?.(pose)||''}
 function setDialog(order,pose,text,actions){
  const root=ensureDialog(),portrait=root.querySelector('#fhDeliveryPortrait'),body=root.querySelector('#fhDeliveryText'),buttons=root.querySelector('#fhDeliveryActions');
  portrait.replaceChildren();const url=spriteUrl(pose);
  if(url){const img=new Image();img.src=url;img.alt='Repartidor de Hamazon';portrait.append(img)}else{const f=document.createElement('div');f.className='fallback';f.textContent='DELIVERY MAN · '+pose.toUpperCase();portrait.append(f)}
  body.textContent=text;buttons.replaceChildren();
  for(const a of actions){const b=document.createElement('button');b.type='button';b.textContent=a.label;b.onclick=a.run;buttons.append(b)}
  root.classList.add('open');options.freeze?.(true);
 }
 function closeDialog(){if(!dialog)return;dialog.classList.remove('open');if(!terminal?.parentElement?.classList.contains('open'))options.freeze?.(false)}
 function onPeephole(door){
  const order=activeOrderForDoor(state,door?.id);if(!order)return false;npcOrder=order;
  const product=productById(order.productId),greeting=(TEXT.peepholeGreeting||(()=>''))(order.apartmentId);
  setDialog(order,'peephole_front',greeting,[
   {label:TEXT.askPackage||'¿Qué trae?',run:()=>setDialog(order,'peephole_front',(TEXT.peepholePackage||((n)=>n))(product?.name||order.name),peepholeActions(order,door))},
   {label:TEXT.askPayment||'¿Cómo se paga?',run:()=>setDialog(order,order.paymentMethod==='cash'?'cash':order.paymentMethod==='card'?'card':'peephole_front',paymentText(order),peepholeActions(order,door))},
   {label:TEXT.openDoor||'Abrir la puerta',run:()=>{closeDialog();options.openDoor?.(door)}},
   {label:TEXT.closeTalk||'Terminar conversación',run:closeDialog}
  ]);return true;
 }
 function peepholeActions(order,door){return [
  {label:TEXT.openDoor||'Abrir la puerta',run:()=>{closeDialog();options.openDoor?.(door)}},
  {label:TEXT.closeTalk||'Terminar conversación',run:closeDialog}
 ]}
 function paymentText(order){return order.paymentMethod==='cash'?(TEXT.cash||'Pago en efectivo.'):order.paymentMethod==='card'?(TEXT.card||'Pago con tarjeta.'):(TEXT.prepaid||'Pedido pagado.')}
 function onDoorOpened(door){
  const order=activeOrderForDoor(state,door?.id);if(!order)return false;
  if(order.payment?.required&&order.payment.status!=='paid'){
   order.status='payment';delivery.npc.state='payment';delivery.npc.pose=order.paymentMethod==='card'?'card':'cash';options.showNpc?.(order,door,delivery.npc.pose);save();syncOrdersToTerminal();
   setDialog(order,delivery.npc.pose,TEXT.paymentPending||paymentText(order),[
    {label:order.paymentMethod==='card'?(TEXT.cardConfirm||'Pagar con tarjeta'):(TEXT.cashConfirm||'Entregar efectivo'),run:()=>confirmPayment(order,door)},
    {label:TEXT.closeTalk||'Ahora no',run:closeDialog}
   ]);return true;
  }
  deliver(order,door);return true;
 }
 function confirmPayment(order,door){order.payment.status='paid';say(TEXT.paymentConfirmed||'Pago confirmado.',1400);save();deliver(order,door)}
 function makePackageItem(order,box,place,packageId='package_'+order.id){return {id:packageId,type:'misc',modelId:box.id,label:box.name||'Paquete Hamazon',x:place.x/options.cell,y:place.z/options.cell,
   w:finite(box.widthFt,2.5)/options.feetPerCell,h:finite(box.depthFt,2.5)/options.feetPerCell,heightFt:finite(box.heightFt,2.5),
   rotation:0,blocksMovement:false,runtimePackage:{orderId:order.id,productId:order.productId},interact:{id:'open_'+packageId,verb:'open',label:TEXT.packageAction||'Abrir paquete',effects:[]}}}
 function finalizeDelivery(order,door,product,box){
  const place=options.packagePlacement?.(door,box)||{floor:door.f,x:door.cx,z:door.cz};
  const packageId='package_'+order.id,item=makePackageItem(order,box,place,packageId);
  options.spawnRuntimeItem?.(item,place.floor);
  order.packageId=packageId;order.status='delivered';delivery.packages.push({id:packageId,orderId:order.id,floor:place.floor,x:item.x,y:item.y,modelId:box.id});
  delivery.npc={activeOrderId:null,doorId:null,state:'leaving',pose:'walk'};options.hideNpc?.(order,door);closeDialog();
  say(TEXT.packageDelivered||'Paquete entregado.',3000);save();syncOrdersToTerminal();setTimeout(()=>update(0),650);return true;
 }
 function deliver(order,door){
  const product=productById(order.productId),box=boxBySize(order.parcelSize);if(!product||!box){say(TEXT.packageMissing||'No se pudo preparar el paquete.');return false}
  order.status='delivering';delivery.npc={activeOrderId:order.id,doorId:door.id,state:'handover',pose:'clipboard'};options.showNpc?.(order,door,'clipboard');save();syncOrdersToTerminal();
  setDialog(order,'clipboard',TEXT.handover||'Aquí tiene su entrega. Confirme la recepción.',[
   {label:TEXT.receivePackage||'Recibir paquete',run:()=>finalizeDelivery(order,door,product,box)},
   {label:TEXT.closeTalk||'Ahora no',run:closeDialog}
  ]);return true;
 }
 function isPackage(item){return !!item?.runtimePackage?.orderId}
 function openPackage(item){
  const order=orderById(state,item?.runtimePackage?.orderId);if(!order||order.status!=='delivered')return false;
  const p=productById(order.productId);if(!p)return false;
  const result=options.replacePackage?.(item,p,order);if(result===false)return false;
  order.status='unboxed';delivery.packages=delivery.packages.filter(x=>x.id!==item.id);advanceTime(state,order.unboxMinutes);
  say((TEXT.packageOpened||((n)=>n))(p.name,order.unboxMinutes),3800);save();syncOrdersToTerminal();update(0);return true;
 }
 function update(dt=0){
  if(dt>0)tickClock(state,dt,clockRate);
  if(!ready)return false;
  return !!activateNext();
 }
 function resume(){
  if(!ready)return false;
  for(const pack of delivery.packages){
   const order=orderById(state,pack.orderId);if(!order||order.status!=='delivered'||options.hasRuntimeItem?.(pack.id,pack.floor))continue;
   const box=boxBySize(order.parcelSize);if(!box)continue;
   const place={floor:pack.floor,x:finite(pack.x,0)*options.cell,z:finite(pack.y,0)*options.cell};
   options.spawnRuntimeItem?.(makePackageItem(order,box,place,pack.id),pack.floor);
  }
  const waiting=delivery.orders.find(o=>['waiting','payment','delivering'].includes(o.status));
  if(waiting){const door=options.doorById?.(waiting.doorId,waiting.floor);if(door)options.showNpc?.(waiting,door,waiting.status==='payment'?(waiting.paymentMethod==='card'?'card':'cash'):waiting.status==='delivering'?'clipboard':'idle')}
  else update(0);
  return true;
 }
 function isPc(item){return !!item&&(item.pcTerminal===true||item.modelId==='escritorio_pc')}
 function actionLabel(item){return isPc(item)?(TEXT.pcAction||'Usar PC'):isPackage(item)?(TEXT.packageAction||'Abrir paquete'):null}
 function onMessage(event){
  if(!terminal||event.source!==terminal.contentWindow||event.data?.type!=='FOREST_TERMINAL_EVENT')return;
  const {name,detail}=event.data;if(name==='hamazon-order')placeOrder(detail?.productId,detail?.paymentMethod);
  if(name==='zoom'&&detail?.on===false)closePc();
 }
 global.addEventListener('message',onMessage);
 loadCatalogs();
 return {isPc,isPackage,actionLabel,openPc,closePc,onPeephole,onDoorOpened,openPackage,placeOrder,advanceTime,formatClock,update,resume,activateNext,
  get products(){return products.map(clone)},get orders(){return delivery.orders.map(clone)},get ready(){return ready}};
}
global.FHDelivery=Object.freeze({ensureState,parcelSize,normalizeProduct,createOrder,activeOrderForDoor,advanceTime,tickClock,formatMinutes,formatClock,nextDueOrder,createRuntime});
})(window);
