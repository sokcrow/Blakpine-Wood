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
 if(!Array.isArray(d.furnishings))d.furnishings=[];
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
  environment:p.environment==='exterior'?'exterior':'interior',
  shopStatus:p.implemented===false||p.shopStatus==='error'||!p.glb?'error':'checking',
  glb:p.glb?String(p.glb):'',
  thumbnail:p.thumbnail?new URL(String(p.thumbnail),base).href:''};
}
function createOrder(state,product,options={}){
 const d=ensureState(state),now=finite(state.clock.minutes,0),seq=d.orders.length+1;
 const method=['cash','card','prepaid'].includes(options.paymentMethod)?options.paymentMethod:'prepaid';
 const order={id:'hamazon_'+Date.now().toString(36)+'_'+seq,kind:product.kind,productId:product.id,modelId:product.modelId,name:product.name,
  parcelSize:product.parcelSize,unboxMinutes:product.unboxMinutes,price:product.price,paymentMethod:method,
  payment:{required:method!=='prepaid',method,status:method==='prepaid'?'paid':'pending',amount:product.price},
  status:'placed',createdAtMinutes:now,deliveryAtMinutes:now+Math.max(0,finite(options.leadMinutes,0)),
  floor:Number.isInteger(options.floor)?options.floor:0,doorId:options.doorId||'',apartmentId:options.apartmentId||'',propertyId:options.propertyId||'',packageId:null};
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
 let products=[],boxes=[],pcItem=null,pcFloor=0,dialog=null,npcOrder=null,ready=false,lastTerminalClock='',activePeepholeDoor=null,peekTalkButton=null,typedDialogue=null;
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
  deliveryAtMinutes:o.deliveryAtMinutes,eta:Number.isFinite(Number(o.deliveryAtMinutes))?formatMinutes(o.deliveryAtMinutes):''}))}
 function syncOrdersToTerminal(){try{options.computer?.terminalApi()?.setHamazonOrders(terminalOrders())}catch{}}
 function syncProductsToTerminal(){try{options.computer?.terminalApi()?.setHamazonProducts(products)}catch{}}
 function syncClockToTerminal(force=false){try{
  const api=options.computer?.terminalApi();if(!api?.setGameClock)return;
  const clock=formatClock(state);if(!force&&clock===lastTerminalClock)return;api.setGameClock(clock);lastTerminalClock=clock;
 }catch{}}
 async function verifyCatalogProducts(){
  // Comprobar el GLB real con el mismo cargador del escenario; no basta con que exista el archivo.
  // Tres cargas a la vez: los modelos registrados ocupan menos de 1 MB en el catálogo actual.
  let cursor=0;
  const jobs=products.filter(p=>p.shopStatus==='checking');
  async function worker(){
   while(cursor<jobs.length){
    const p=jobs[cursor++];
    try{
     const valid=await options.validateProduct?.(p);
     p.shopStatus=valid===true?'available':'error';
    }catch(error){
     p.shopStatus='error';
     console.warn('Hamazon: modelo GLB no disponible',p.modelId,String(error?.message||error));
    }
   }
  }
  await Promise.all([worker(),worker(),worker()]);
  syncProductsToTerminal();
 }
 async function loadCatalogs(){
  try{
   const furnitureUrl=new URL('../../forest-horror/biblioteca/catalogo_muebles.json',base);
   const deliveryUrl=new URL('../../forest-horror/biblioteca/catalogo_delivery.json',base);
   const f=await fetch(furnitureUrl).then(r=>r.ok?r.json():Promise.reject(Error(r.status)));
   const d=await fetch(deliveryUrl).then(r=>r.ok?r.json():Promise.reject(Error(r.status))).catch(err=>{console.warn('Hamazon: catálogo de paquetería no disponible',err);return {furniture:[]}});
   const catalogBase=new URL('../../forest-horror/biblioteca/',base);
   products=(f.furniture||[]).filter(p=>!p.environment||p.environment==='interior').map(p=>normalizeProduct({...p,kind:'furniture'},catalogBase));
   boxes=(d.furniture||[]).map(p=>({...p,modelId:p.id,parcelSize:p.parcelSize||parcelSize(p)}));
   ready=true;syncProductsToTerminal();syncOrdersToTerminal();resume();void verifyCatalogProducts();
  }catch(err){console.warn('Hamazon: catálogo de muebles no disponible',err)}
 }
 function onComputerOpen(item,floor=0){pcItem=item;pcFloor=floor;}
 function onComputerClose(){pcItem=null;}
 function openPc(item,floor=0){return !!options.computer?.open(item,floor);}
 function closePc(){options.computer?.close();}
 function syncTerminal(){syncProductsToTerminal();syncOrdersToTerminal();syncClockToTerminal(true);}
  function chooseDoor(){
  const door=options.findDoor?.(pcItem,pcFloor);return door||null;
 }
 function announceDoorArrival(order,door){
  if(typeof options.knock==='function'){
   const ring=()=>{if(delivery.npc.activeOrderId===order.id&&order.status==='waiting')options.knock(door,order)};
   const delay=Math.max(0,finite(options.knockDelayMs,0));
   if(delay)setTimeout(ring,delay);else ring();
  }else say(TEXT.orderWaiting||'Llaman a la puerta.',2600);
 }
 function onNpcArrived(orderId){
  const order=orderById(state,orderId),door=order&&options.doorById?.(order.doorId,order.floor);
  if(!order||!door||order.status!=='en_route'||delivery.npc.activeOrderId!==orderId)return false;
  order.status='waiting';delivery.npc.state='waiting_at_door';delivery.npc.pose='door_idle';
  options.showNpc?.(order,door,'door_idle');announceDoorArrival(order,door);
  save();syncOrdersToTerminal();return true;
 }
 function onNpcRouteBlocked(orderId){
  const order=orderById(state,orderId);
  if(!order||order.status!=='en_route'||delivery.npc.activeOrderId!==orderId)return false;
  order.status='route_blocked';delivery.npc.state='route_blocked';delivery.npc.pose='thinking';
  save();syncOrdersToTerminal();return true;
 }
 function activateNext(){
  if(delivery.orders.some(o=>['en_route','waiting','payment','delivering'].includes(o.status))||options.npcBusy?.())return null;
  const next=nextDueOrder(state);if(!next)return null;
  const door=options.doorById?.(next.doorId,next.floor);if(!door)return null;
  const travel=options.startNpcRoute?.(next,door);
  if(travel===false){
   next.status='route_blocked';say(TEXT.noNpcRoute||'El repartidor no encuentra una ruta segura.',3200);
   save();syncOrdersToTerminal();return null;
  }
  delivery.npc={activeOrderId:next.id,doorId:door.id,state:travel===true?'traveling':'waiting_at_door',pose:travel===true?'walk':'idle'};
  npcOrder=next;next.status=travel===true?'en_route':'waiting';
  if(travel!==true){options.showNpc?.(next,door,'idle');announceDoorArrival(next,door)}
  save();syncOrdersToTerminal();return next;
 }
 function placeOrder(productId,paymentMethod){
  const p=productById(productId);if(!p){say(TEXT.productMissing||'Producto no disponible.');return null}
  if(p.environment!=='interior'){say(TEXT.shopOutside||'Los objetos de exterior no están disponibles en Hamazon.');return null}
  if(p.shopStatus!=='available'){
   say(p.shopStatus==='checking'?(TEXT.shopLoading||'Modelo en comprobación.'):(TEXT.shopModelError||'El modelo no funciona o sigue en implementación.'),3000);
   return null;
  }
  const door=chooseDoor();if(!door){say(TEXT.noDeliveryDoor||'No hay puerta de entrega.',3600);return null}
  const address=options.resolveDoorAddress?.(door,pcItem,pcFloor)||{};
   const order=createOrder(state,p,{paymentMethod,leadMinutes:leadMinutesFor(p),floor:door.f,doorId:door.id,apartmentId:door.apartmentId||pcItem?.apartmentId||'',propertyId:address.id||''});
  order.status='scheduled';
  const eta=formatMinutes(order.deliveryAtMinutes);
  say((TEXT.orderScheduled||((n,t)=>'Pedido registrado: '+n+'. Entrega estimada: '+t+'.'))(p.name,eta),3200);
  save();syncOrdersToTerminal();update(0);return order;
 }
 function ensureDialog(){
  if(dialog)return dialog;
  const style=document.createElement('style');style.textContent=
   '#fhDeliveryDialog{position:fixed;z-index:70;inset:0;display:none;align-items:flex-end;justify-content:center;padding:18px;background:#0004;pointer-events:auto}'+
   '#fhDeliveryDialog.open{display:flex}#fhDeliveryCard{width:min(740px,94vw);max-height:56dvh;overflow:auto;background:rgba(9,15,16,.86);border:1px solid rgba(223,218,199,.4);border-radius:20px;color:#f1efe9;padding:18px 22px 13px;box-shadow:0 12px 40px #000a;font:normal clamp(16px,2.2vw,21px)/1.48 Georgia,serif}'+
   '#fhDeliveryName{color:#e5d4ae;font:600 14px/1.4 Georgia,serif;margin:0 0 7px}#fhDeliveryText{min-height:40px}#fhDeliveryActions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}#fhDeliveryActions.fh-waiting{visibility:hidden;pointer-events:none}#fhDeliveryActions button{border:1px solid #806c59;background:#292a2b;color:#f2e4cf;border-radius:8px;min-height:44px;padding:10px 13px;font:600 13px/1.4 system-ui,sans-serif;touch-action:manipulation}#fhDeliveryActions button:focus-visible{outline:2px solid #f1ddaa;outline-offset:2px}'+
   '#fhDeliveryDialog.peephole{background:transparent;pointer-events:none;padding:10px;align-items:flex-end;justify-content:flex-end}'+
   '#fhDeliveryDialog.peephole #fhDeliveryCard{pointer-events:auto;width:min(470px,calc(100vw - 20px));max-height:min(46dvh,310px);overflow:auto;display:block;padding:12px 15px;background:rgba(9,15,16,.92);border-radius:16px}'+
   '#fhDeliveryDialog.peephole #fhDeliveryText{min-height:0;font:normal clamp(14px,1.8vw,18px)/1.4 Georgia,serif}'+
   '#fhDeliveryDialog.peephole #fhDeliveryActions{margin-top:7px;gap:5px}'+
   '#fhDeliveryDialog.peephole #fhDeliveryActions button{min-height:40px;padding:7px 9px}'+
   '#fhPeekTalk{position:absolute;bottom:calc(max(25px,env(safe-area-inset-bottom)) + 55px);right:max(12px,env(safe-area-inset-right));z-index:2;min-height:44px;border:2px solid #b99e70;background:#141a22f2;color:#f5e4c8;padding:9px 13px;font:700 13px system-ui;box-shadow:3px 3px #0009;touch-action:manipulation}#fhPeekTalk[hidden]{display:none!important}'+
   '@media (orientation:landscape) and (max-height:480px){#fhDeliveryDialog.peephole #fhDeliveryCard{width:min(450px,57vw);max-height:70dvh}}';
  document.head.append(style);
  const root=document.createElement('div');root.id='fhDeliveryDialog';root.innerHTML='<div id="fhDeliveryCard"><div id="fhDeliveryName"></div><div id="fhDeliveryText"></div><div id="fhDeliveryActions"></div></div>';
  document.body.append(root);dialog=root;return root;
 }
 function ensurePeekTalkButton(){
  if(peekTalkButton)return peekTalkButton;
  const overlay=document.getElementById('peekOverlay');
  if(!overlay)return null;
  ensureDialog();
  const button=document.createElement('button');
  button.id='fhPeekTalk';button.type='button';button.hidden=true;
  button.textContent=TEXT.talkThroughDoor;
  button.setAttribute('aria-label',TEXT.talkThroughDoor);
  button.addEventListener('click',event=>{event.stopPropagation();talkThroughPeephole()});
  overlay.append(button);peekTalkButton=button;
  return button;
 }
 function syncPeekTalkButton(){
  const button=ensurePeekTalkButton();
  if(button)button.hidden=!activePeepholeDoor||!!dialog?.classList.contains('open');
 }
 function setDialog(order,pose,text,actions,throughPeephole=false){
  const root=ensureDialog(),body=root.querySelector('#fhDeliveryText'),buttons=root.querySelector('#fhDeliveryActions');
  typedDialogue?.dispose();typedDialogue=null;
  root.querySelector('#fhDeliveryName').textContent=TEXT.courierName||'Repartidor';
  buttons.replaceChildren();buttons.classList.add('fh-waiting');
  for(const action of actions){
   const button=document.createElement('button');button.type='button';button.textContent=action.label;
   button.onclick=()=>{typedDialogue?.dispose();typedDialogue=null;action.run()};
   buttons.append(button);
  }
  root.classList.toggle('peephole',throughPeephole);
   options.dialogPose?.(pose,order);
  root.classList.add('open');syncPeekTalkButton();options.freeze?.(true);
  const live=global.FHLiveText;
  if(live?.typeInto)typedDialogue=live.typeInto(body,{text,mood:'normal'},{
   onComplete:()=>buttons.classList.remove('fh-waiting'),
   onReadyAdvance:()=>buttons.querySelector('button')?.focus({preventScroll:true})
  });
  if(!typedDialogue){body.textContent=text;buttons.classList.remove('fh-waiting');}
 }
 function closeDialog(){
  typedDialogue?.dispose();typedDialogue=null;
  const wasOpen=!!dialog?.classList.contains('open');
  dialog?.classList.remove('open','peephole');
  if(wasOpen)options.endDoorEvent?.();
  activePeepholeDoor=null;
  global.FHLiveText?.flushNotice?.();
  if(!options.computer?.isOpen)options.freeze?.(false);
  syncPeekTalkButton();
 }
 function onPeephole(door){
  const order=activeOrderForDoor(state,door?.id);
  activePeepholeDoor=order?door:null;
  if(order)npcOrder=order;
  syncPeekTalkButton();return !!order;
 }
 function onPeepholeExit(){
  activePeepholeDoor=null;
  if(dialog?.classList.contains('open'))closeDialog();
  syncPeekTalkButton();
 }
 function destinationName(order,door){
  const address=options.resolveDoorAddress?.(door,null,order.floor)||{};
  const id=order.propertyId||address.id||'';
  return String((id&&options.propertyNameById?.(id))||address.name||'').trim().slice(0,80);
 }
 function talkMenu(order,door,opened=false){
  const name=destinationName(order,door),destination=(TEXT.propertyDestination||((v)=>v))(name);
  const back=()=>talkMenu(order,door,opened);
  const answer=(message,pose='greeting')=>setDialog(order,pose,message,[
   {label:TEXT.backToQuestions||'Volver a preguntar',run:back},
   {label:TEXT.closeTalk||'Terminar conversación',run:closeDialog}
  ],!opened);
  const actions=[
   {label:TEXT.askIdentity||'¿Quién es?',run:()=>answer(TEXT.identityAnswer||'Soy el repartidor de Hamazon.')},
   {label:TEXT.askPackage||'¿Qué trae?',run:()=>answer((TEXT.peepholePackage||((v)=>v))(productById(order.productId)?.name||order.name),'clipboard')},
   {label:TEXT.askDestination||'¿Para quién es?',run:()=>answer((TEXT.destinationAnswer||((v)=>v))(destination))},
   {label:TEXT.askPayment||'¿Cómo se paga?',run:()=>answer(paymentText(order),order.paymentMethod==='cash'?'cash':'card')}
  ];
  if(!opened)actions.push({label:TEXT.openDoor||'Abrir la puerta',run:()=>{
   if(options.openDoor?.(door)===false)answer(TEXT.doorNotOpened||'No pude abrir la puerta.');
  }});
  else actions.push({label:TEXT.continueDelivery||'Recibir la entrega',run:()=>{
   if(order.status==='delivering')return showHandover(order,door);
   if(order.payment?.required&&order.payment.status!=='paid')return showPayment(order,door);
   return deliver(order,door);
  }});
  actions.push({label:TEXT.closeTalk||'Terminar conversación',run:closeDialog});
  const greet=opened?(TEXT.doorGreeting||TEXT.peepholeGreeting||(()=>'')):(TEXT.peepholeGreeting||(()=>'')); 
  setDialog(order,opened?'greeting':'peephole_front',greet(destination),actions,!opened);
 }
 function talkThroughPeephole(){
  const door=activePeepholeDoor,order=activeOrderForDoor(state,door?.id);
  if(!door||!order){onPeepholeExit();return false}
  talkMenu(order,door,false);return true;
 }
 function showPayment(order,door){
  order.status='payment';delivery.npc.state='payment';delivery.npc.pose=order.paymentMethod==='card'?'card':'cash';
  options.showNpc?.(order,door,delivery.npc.pose);save();syncOrdersToTerminal();
  setDialog(order,delivery.npc.pose,TEXT.paymentPending||paymentText(order),[
   {label:order.paymentMethod==='card'?(TEXT.cardConfirm||'Pagar con tarjeta'):(TEXT.cashConfirm||'Entregar efectivo'),run:()=>confirmPayment(order,door)},
   {label:TEXT.backToQuestions||'Volver a preguntar',run:()=>talkMenu(order,door,true)},
   {label:TEXT.closeTalk||'Terminar conversación',run:closeDialog}
  ]);return true;
 }
 function onDoorOpened(door){
  const order=activeOrderForDoor(state,door?.id);if(!order)return false;
  options.showNpc?.(order,door,'greeting');talkMenu(order,door,true);return true;
 }
 function interruptDialogue(){
  if(!dialog?.classList.contains('open'))return false;
  closeDialog();return true;
 }
 function paymentText(order){return order.paymentMethod==='cash'?(TEXT.cash||'Pago en efectivo.'):order.paymentMethod==='card'?(TEXT.card||'Pago con tarjeta.'):(TEXT.prepaid||'Pedido pagado.')}
 function confirmPayment(order,door){order.payment.status='paid';say(TEXT.paymentConfirmed||'Pago confirmado.',1400);save();deliver(order,door)}
 function makePackageItem(order,box,place,packageId='package_'+order.id){return {id:packageId,type:'misc',modelId:box.id,label:box.name||'Paquete Hamazon',x:place.x/options.cell,y:place.z/options.cell,
   w:finite(box.widthFt,2.5)/options.feetPerCell,h:finite(box.depthFt,2.5)/options.feetPerCell,heightFt:finite(box.heightFt,2.5),
   rotation:finite(place.rotation,0),blocksMovement:false,runtimeDecoratable:true,runtimePackage:{orderId:order.id,productId:order.productId},interact:{id:'open_'+packageId,verb:'open',label:TEXT.packageAction||'Abrir paquete',effects:[]}}}
 function finalizeDelivery(order,door,product,box){
  const place=options.packagePlacement?.(door,box)||{floor:door.f,x:door.cx,z:door.cz};
  const packageId='package_'+order.id,item=makePackageItem(order,box,place,packageId);
  options.spawnRuntimeItem?.(item,place.floor);
  order.packageId=packageId;order.status='delivered';delivery.packages.push({id:packageId,orderId:order.id,floor:place.floor,x:item.x,y:item.y,rotation:item.rotation||0,modelId:box.id});
  delivery.npc={activeOrderId:null,doorId:null,state:'leaving',pose:'walk'};options.hideNpc?.(order,door);closeDialog();
  say(TEXT.packageDelivered||'Paquete entregado.',3000);save();syncOrdersToTerminal();setTimeout(()=>update(0),650);return true;
 }
 function showHandover(order,door){
  const product=productById(order.productId),box=boxBySize(order.parcelSize);
  if(!product||!box)return false;
  setDialog(order,'clipboard',TEXT.handover||'Aquí tiene su entrega. Confirme la recepción.',[
   {label:TEXT.receivePackage||'Recibir paquete',run:()=>finalizeDelivery(order,door,product,box)},
   {label:TEXT.backToQuestions||'Volver a preguntar',run:()=>talkMenu(order,door,true)},
   {label:TEXT.closeTalk||'Terminar conversación',run:closeDialog}
  ]);return true;
 }
 function deliver(order,door){
  const product=productById(order.productId),box=boxBySize(order.parcelSize);
  if(!product||!box){say(TEXT.packageMissing||'No se pudo preparar el paquete.');return false}
  order.status='delivering';delivery.npc={activeOrderId:order.id,doorId:door.id,state:'handover',pose:'clipboard'};
  options.showNpc?.(order,door,'clipboard');save();syncOrdersToTerminal();
  return showHandover(order,door);
 }
 function isPackage(item){return !!item?.runtimePackage?.orderId}
 function isDeliveredFurniture(item){return !!item?.runtimeDeliveryFurniture?.orderId}
 function runtimePoseRecord(item,floor,orderId,productId){
  const record={id:item.id,orderId,productId,floor:Number.isInteger(floor)?floor:0,x:finite(item.x),y:finite(item.y),rotation:finite(item.rotation),modelId:item.modelId||productId};
  if(item.support)record.support=clone(item.support);if(item.wallId)record.wallId=item.wallId;return record;
 }
 function updateRuntimeItem(item,floor){
  if(!item)return false;
  let record=null;
  if(isPackage(item))record=delivery.packages.find(x=>x.id===item.id);
  else if(isDeliveredFurniture(item))record=delivery.furnishings.find(x=>x.id===item.id);
  if(!record)return false;
  Object.assign(record,{floor:Number.isInteger(floor)?floor:record.floor,x:finite(item.x),y:finite(item.y),rotation:finite(item.rotation)});
  if(item.support)record.support=clone(item.support);else delete record.support;
  if(item.wallId)record.wallId=item.wallId;else delete record.wallId;
  save();return true;
 }
 function storedFurniture(){
  return delivery.furnishings.filter(record=>record.stored===true).map(record=>{
   const order=orderById(state,record.orderId),product=productById(record.productId||order?.productId);
   return {...clone(record),name:product?.name||order?.name||record.id};
  });
 }
 function setFurnitureStored(item,floor,stored){
  if(!isDeliveredFurniture(item))return false;
  const record=delivery.furnishings.find(value=>value.id===item.id);
  if(!record)return false;
  Object.assign(record,{floor:Number.isInteger(floor)?floor:record.floor,
   x:finite(item.x),y:finite(item.y),rotation:finite(item.rotation),stored:!!stored});
  if(item.support)record.support=clone(item.support);else delete record.support;
  if(item.wallId)record.wallId=item.wallId;else delete record.wallId;
  save();return true;
 }
 function retrieveStoredFurniture(id,position={}){
  const record=delivery.furnishings.find(value=>value.id===id&&value.stored===true);
  if(!record||options.hasRuntimeItem?.(id,Number.isInteger(position.floor)?position.floor:record.floor))return false;
  const order=orderById(state,record.orderId),product=productById(record.productId||order?.productId);
  if(!order||!product)return false;
  const floor=Number.isInteger(position.floor)?position.floor:record.floor;
  const placement={...clone(record),floor,
   x:finite(position.x,record.x),y:finite(position.y,record.y),
   rotation:finite(position.rotation,record.rotation)};
  delete placement.support;delete placement.wallId;
  return options.restoreFurniture?.(placement,product,order)||false;
 }
 function openPackage(item){
  const order=orderById(state,item?.runtimePackage?.orderId);if(!order||order.status!=='delivered')return false;
  const p=productById(order.productId);if(!p)return false;
  const result=options.replacePackage?.(item,p,order);if(result===false)return false;
  order.status='unboxed';delivery.packages=delivery.packages.filter(x=>x.id!==item.id);
  const replacement=result&&typeof result==='object'&&result.item?result:null;
  if(replacement?.item){
   const next=replacement.item,record=runtimePoseRecord(next,replacement.floor,order.id,p.id);
   delivery.furnishings=delivery.furnishings.filter(x=>x.orderId!==order.id&&x.id!==record.id);delivery.furnishings.push(record);
  }
  advanceTime(state,order.unboxMinutes);
  say((TEXT.packageOpened||((n)=>n))(p.name,order.unboxMinutes),3800);save();syncOrdersToTerminal();update(0);return true;
 }
 function update(dt=0){
  if(dt>0)tickClock(state,dt,clockRate);
  syncClockToTerminal();
  if(!ready)return false;
  return !!activateNext();
 }
 function resume(){
  if(!ready)return false;
  for(const pack of delivery.packages){
   const order=orderById(state,pack.orderId);if(!order||order.status!=='delivered'||options.hasRuntimeItem?.(pack.id,pack.floor))continue;
   const box=boxBySize(order.parcelSize);if(!box)continue;
   const place={floor:pack.floor,x:finite(pack.x,0)*options.cell,z:finite(pack.y,0)*options.cell,rotation:finite(pack.rotation,0)};
   const item=makePackageItem(order,box,place,pack.id);if(pack.support)item.support=clone(pack.support);if(pack.wallId)item.wallId=pack.wallId;
   options.spawnRuntimeItem?.(item,pack.floor);
  }
  for(const record of delivery.furnishings){
   if(record.stored===true)continue;
   const order=orderById(state,record.orderId),product=productById(record.productId||order?.productId);
   if(!order||order.status!=='unboxed'||!product||options.hasRuntimeItem?.(record.id,record.floor))continue;
   options.restoreFurniture?.(record,product,order);
  }
  const traveling=delivery.orders.find(o=>o.status==='en_route');
  if(traveling&&!options.npcBusy?.()){
   const door=options.doorById?.(traveling.doorId,traveling.floor);
   const outcome=door?options.startNpcRoute?.(traveling,door):false;
   if(outcome===false){traveling.status='route_blocked';save();syncOrdersToTerminal();}
   else if(outcome==null){traveling.status='scheduled';activateNext();}
  }
  const waiting=delivery.orders.find(o=>['waiting','payment','delivering'].includes(o.status));
  if(waiting){const door=options.doorById?.(waiting.doorId,waiting.floor);if(door)options.showNpc?.(waiting,door,waiting.status==='payment'?(waiting.paymentMethod==='card'?'card':'cash'):waiting.status==='delivering'?'clipboard':'idle')}
  else if(!traveling)update(0);
  return true;
 }
 function isPc(item,floor=options.currentFloor?.()??pcFloor){return options.computer?.isPc(item,floor)??
  (!!item&&(item.pcTerminal===true||item.modelId==='escritorio_pc'||
   !!global.FHPcAssembly?.isTerminalCandidate(item,options.floorItems?.(floor),options.feetPerCell||5)))}
 function actionLabel(item){return isPc(item)?(global.FH_COMPUTER_TEXT?.pcAction||'Usar PC'):isPackage(item)?(TEXT.packageAction||'Abrir paquete'):isDeliveredFurniture(item)?(TEXT.decorateAction||'Mover / decorar'):null}
 function onMessage(event){
  const frame=options.computer?.frame;
  if(!frame||event.source!==frame.contentWindow||event.data?.type!=='FOREST_TERMINAL_EVENT')return;
  const {name,detail}=event.data;if(name==='hamazon-order'){
   const order=placeOrder(detail?.productId,detail?.paymentMethod);
   frame.contentWindow?.postMessage({type:'FOREST_TERMINAL_RESPONSE',name:'hamazon-order-result',detail:{ok:!!order}},'*');
  }
  if(name==='zoom'&&detail?.on===false)closePc();
 }
 global.addEventListener('message',onMessage);
 loadCatalogs();
 return {isPc,isPackage,isDeliveredFurniture,updateRuntimeItem,storedFurniture,setFurnitureStored,retrieveStoredFurniture,actionLabel,openPc,closePc,onComputerOpen,onComputerClose,syncTerminal,onPeephole,onPeepholeExit,talkThroughPeephole,onDoorOpened,onNpcArrived,onNpcRouteBlocked,interruptDialogue,openPackage,placeOrder,advanceTime,formatClock,update,resume,activateNext,
  get dialogOpen(){return !!dialog?.classList.contains('open')},get products(){return products.map(clone)},get orders(){return delivery.orders.map(clone)},get ready(){return ready}};
}
global.FHDelivery=Object.freeze({ensureState,parcelSize,normalizeProduct,createOrder,activeOrderForDoor,advanceTime,tickClock,formatMinutes,formatClock,nextDueOrder,createRuntime});
})(window);
