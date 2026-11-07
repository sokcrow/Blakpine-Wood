/* Blakpine Wood — teléfono del jugador. Única sesión por partida; el gameplay sigue activo. */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHPhone=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const BASE_APPS=Object.freeze(['directory','messages','notes','flashlight','store']);
 const AVAILABLE_APPS=Object.freeze([...BASE_APPS,'hamazon']);
 const CATEGORIES=Object.freeze(['person','business','service','player']);
 const EXTRA_APPS=new Map();
 function registerApp(def){
  if(!def||!(/^[a-z][a-z0-9_-]{1,31}$/).test(def.id)||AVAILABLE_APPS.includes(def.id)||
    typeof def.render!=='function'||typeof def.name!=='string'||!def.name.trim())return false;
  EXTRA_APPS.set(def.id,{name:def.name.slice(0,40),icon:String(def.icon||'◇').slice(0,3),render:def.render});
  return true;
 }
 const allApps=()=>[...AVAILABLE_APPS,...EXTRA_APPS.keys()];
 const safe=(value,max=100)=>String(value==null?'':value).trim().slice(0,max);
 const copy=value=>JSON.parse(JSON.stringify(value));
 const validApp=id=>AVAILABLE_APPS.includes(id)||EXTRA_APPS.has(id);
 const positiveInt=value=>Number.isSafeInteger(value)&&value>=1&&value<=20;
 const stamps=()=>Date.now().toString(36);
 function ensureState(state){
  if(!state||typeof state!=='object')throw Error('Estado de partida no disponible');
  const p=state.phone&&typeof state.phone==='object'?state.phone:{};
  p.installedApps=[...new Set([...BASE_APPS,...(Array.isArray(p.installedApps)?p.installedApps:[]).filter(validApp)])];
  p.notes=Array.isArray(p.notes)?p.notes.filter(n=>n&&typeof n==='object').slice(0,200):[];
  p.contacts=Array.isArray(p.contacts)?p.contacts.filter(c=>c&&typeof c==='object').slice(0,200):[];
  p.messages=Array.isArray(p.messages)?p.messages.filter(m=>m&&typeof m==='object').slice(-500):[];
  if(!p.contacts.some(c=>c.id==='hamazon'))p.contacts.unshift({id:'hamazon',name:'Hamazon',kind:'business'});
  if(!p.contacts.some(c=>c.id==='hamazon-delivery'))p.contacts.push({id:'hamazon-delivery',name:'Entregas Hamazon',kind:'service'});
  p.accountId=safe(p.accountId||state.characterId||state.player?.id||state.playerId||'GUARDIA_03',100);
  state.phone=p;
  if(!state.commerce||typeof state.commerce!=='object')state.commerce={};
  state.commerce.cart=Array.isArray(state.commerce.cart)?state.commerce.cart.filter(v=>
   v&&typeof v.productId==='string'&&positiveInt(v.quantity)).slice(0,60):[];
  return p;
 }
 function formatClock(minutes){
  const n=Number(minutes);
  const m=Number.isFinite(n)?((Math.floor(n)%1440)+1440)%1440:480;
  return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
 }
 function installApp(state,id){
  const p=ensureState(state);if(!validApp(id))return false;
  if(!p.installedApps.includes(id))p.installedApps.push(id);
  return true;
 }
 function uninstallApp(state,id){
  if(BASE_APPS.includes(id)||!validApp(id))return false;
  const p=ensureState(state);p.installedApps=p.installedApps.filter(a=>a!==id);return true;
 }
 function createRuntime(options={}){
  const state=options.state||{};
  const p=ensureState(state);
  const document=options.document||root.document;
  const T=options.strings||root.FH_PHONE_TEXT||{};
  const label=(k,f)=>T[k]||f||k;
  const save=()=>{try{options.save?.()}catch(error){root.console?.warn?.('FHPhone: guardado',error)}};
  const clock=()=>formatClock(state.clock?.minutes);
  const commerce=()=>state.commerce.cart;
  let opened=false,view='home',previous='home',filter='all',currentContact='',editingNote=null,currentDocument=null;
  let toggle=null,panel=null,content=null,clockNode=null,toastNode=null,topTitle=null;
  let elapsed=0,toastTimer=null,lastTorch='',orderSeen=new Map((state.delivery?.orders||[]).map(o=>[o.id,o.status]));
  const el=(tag,cls,txt)=>{
   const n=document.createElement(tag);if(cls)n.className=cls;
   if(txt!==undefined)n.textContent=String(txt);
   return n;
  };
  const button=(text,fn,cls)=>{
   const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;
  };
  const append=(host,...nodes)=>{nodes.forEach(n=>host.append(n));return host};
  const container=(cls)=>el('div',cls);
  function notice(message){
   if(!toastNode)return;
   toastNode.textContent=message;
   toastNode.hidden=false;root.clearTimeout?.(toastTimer);
   toastTimer=root.setTimeout?.(()=>{toastNode.hidden=true},2400);
  }
  function blocked(){
   if(!document?.body)return false;
   const body=document.body;
   return body.classList.contains('fh-pc-in-use')||body.classList.contains('breaker-active')||
    body.classList.contains('fh-player-menu-open')||
    document.getElementById('noteOverlay')?.classList.contains('open')||
    document.getElementById('fhDeliveryDialog')?.classList.contains('open')||
    document.getElementById('elevatorPanel')?.classList.contains('open');
  }
  function toolbar(title,back='home'){
   topTitle.textContent=title;
   const go=panel.querySelector('.fh-phone-back');if(go)go.hidden=view==='home';
   previous=back;
  }
  function empty(text){content.append(el('p','fh-phone-empty',text))}
  function screen(name,back='home'){
   view=name;content.replaceChildren();toolbar(label('app_'+name,name),back);
   const handlers={home:home,directory:directory,messages:messages,conversation:conversation,
    notes:notes,editNote:editNote,document:readDocument,flashlight:flashlight,store:store,hamazon:hamazon};
   if(handlers[name])handlers[name]();
   else if(EXTRA_APPS.has(name))EXTRA_APPS.get(name).render({container:content,state,save,back:()=>screen('home')});
   else home();
  }
  function home(){
   const hero=container('fh-phone-clock-card');
   append(hero,el('span','fh-phone-kicker',label('gameTime','HORA DEL JUEGO')),el('strong','fh-phone-big-clock',clock()));
   content.append(hero);
   const grid=container('fh-phone-app-grid');content.append(grid);
   for(const id of p.installedApps){
    const b=button(label('app_'+id,EXTRA_APPS.get(id)?.name||id),()=>screen(id),'fh-phone-app');
    b.dataset.app=id;
    b.append(el('span','fh-phone-app-icon',label('icon_'+id,EXTRA_APPS.get(id)?.icon||'◇')));
    grid.append(b);
   }
  }
  function directory(){
   const tabs=container('fh-phone-tabs');
   [['all','all'],['person','people'],['business','businesses'],['service','services'],['player','players']].forEach(([key,name])=>{
    const b=button(label(name,key),()=>{filter=key;screen('directory')});
    b.setAttribute('aria-pressed',String(filter===key));tabs.append(b);
   });content.append(tabs);
   const contacts=p.contacts.filter(c=>filter==='all'||c.kind===filter);
   if(!contacts.length)return empty(label('noContacts','Sin contactos registrados.'));
   for(const c of contacts){
    const row=container('fh-phone-entry');
    const info=container('fh-phone-entry-text');
    append(info,el('strong','',safe(c.name,80)),el('small','',label(c.kind,c.kind)));
    const open=button(label('write','Mensajes'),()=>{currentContact=c.id;screen('conversation','directory')});
    append(row,info,open);content.append(row);
   }
  }
  function messages(){
   const ids=[...new Set(p.messages.map(m=>m.contactId))];
   if(!ids.length)return empty(label('noMessages','No hay mensajes.'));
   ids.forEach(id=>{
    const c=p.contacts.find(c=>c.id===id),items=p.messages.filter(m=>m.contactId===id),last=items[items.length-1];
    const row=button((c?.name||id)+' · '+safe(last?.body,65),()=>{currentContact=id;screen('conversation','messages')},'fh-phone-conversation-row');
    content.append(row);
   });
  }
  function message(contactId,body,incoming=false){
   const value=safe(body,2000);if(!value)return false;
   p.messages.push({id:'msg_'+stamps()+'_'+p.messages.length,contactId:safe(contactId,80),
    body:value,incoming:!!incoming,time:Number(state.clock?.minutes)||0});
   if(p.messages.length>500)p.messages.splice(0,p.messages.length-500);
   save();if(opened&&(view==='messages'||view==='conversation'))screen(view,previous);return true;
  }
  function receive(contactId,body,contact=null){
   if(contact)addContact({...contact,id:contactId});
   return message(contactId,body,true);
  }
  function send(contactId,body){
   const contact=p.contacts.find(c=>c.id===contactId);
   if(!contact)return false;
   if(contact.kind==='player'&&!options.sendPlayerMessage){
    notice(label('offline','Mensajería multijugador sin conexión.'));return false;
   }
   if(contact.id!=='hamazon'&&contact.id!=='hamazon-delivery'&&!options.onSendMessage){
    notice(label('unavailable','Este contacto no recibe mensajes todavía.'));return false;
   }
   const value=safe(body,2000);if(!value)return false;
   if(contact.kind==='player'){
    const ok=options.sendPlayerMessage?.(contactId,value);
    if(ok!==true){notice(label('offline','Mensajería multijugador sin conexión.'));return false}
   }else if(contact.id!=='hamazon'&&contact.id!=='hamazon-delivery'){
    if(options.onSendMessage(contactId,value)!==true){
     notice(label('unavailable','No se pudo enviar el mensaje.'));return false;
    }
   }
   message(contactId,value,false);
   if(contact.id==='hamazon'||contact.id==='hamazon-delivery'){
    const orders=options.delivery?.()?.orders||[],last=orders[orders.length-1];
    const reply=last?label('lastOrder','Último pedido')+': '+safe(last.name,60)+' · '+safe(last.status,30)
      :label('noOrders','No hay pedidos registrados.');
    message(contactId,reply,true);
   }
   return true;
  }
  function conversation(){
   const c=p.contacts.find(c=>c.id===currentContact);
   if(!c)return empty(label('noContacts','Sin contacto.'));
   content.append(el('h3','fh-phone-section',safe(c.name,80)));
   const log=container('fh-phone-message-log');
   const items=p.messages.filter(m=>m.contactId===c.id);
   if(!items.length)log.append(el('p','fh-phone-empty',label('noMessages','No hay mensajes.')));
   for(const m of items){
    const bubble=el('div','fh-phone-bubble'+(m.incoming?' incoming':' outgoing'),safe(m.body,2000));
    bubble.append(el('small','',formatClock(m.time)));
    log.append(bubble);
   }
   content.append(log);
   const form=el('form','fh-phone-message-form');
   const field=el('input');field.type='text';field.maxLength=2000;field.placeholder=label('messagePlaceholder','Escribir mensaje');
   const submit=button(label('send','Enviar'),()=>{},'fh-phone-primary');submit.type='submit';
   form.addEventListener('submit',event=>{event.preventDefault();if(send(c.id,field.value))field.value=''});
   append(form,field,submit);content.append(form);
  }
  function notes(){
   content.append(button(label('newNote','+ Nueva nota'),()=>{editingNote={id:'',title:'',body:''};screen('editNote','notes')},'fh-phone-primary'));
   if(!p.notes.length)empty(label('noNotes','No has escrito ninguna nota.'));
   for(const n of p.notes.slice().reverse()){
    const row=container('fh-phone-entry');
    const info=button(safe(n.title,100)||label('untitled','Sin título'),()=>{editingNote={...n};screen('editNote','notes')},'fh-phone-entry-text');
    info.append(el('small','',safe(n.body,80)));
    const del=button('×',()=>{p.notes=p.notes.filter(v=>v.id!==n.id);save();screen('notes')},'fh-phone-danger');
    del.setAttribute('aria-label',label('deleteNote','Eliminar nota')+': '+safe(n.title,100));
    append(row,info,del);content.append(row);
   }
   const docs=(options.itemDefs||[]).filter(d=>d.kind==='note'&&state.inventory?.includes(d.id));
   if(!docs.length)return;
   content.append(el('h3','fh-phone-section',label('collectedNotes','Documentos recogidos')));
   for(const def of docs){
    const row=button(safe(def.name,100),()=>{
     currentDocument=def;options.markNoteRead?.(def.id);screen('document','notes');
    },'fh-phone-conversation-row');
    content.append(row);
   }
  }
  function readDocument(){
   if(!currentDocument)return empty(label('noNotes','No hay documentos.'));
   content.append(el('h3','fh-phone-section',safe(currentDocument.name,100)));
   content.append(el('article','fh-phone-document',safe(currentDocument.text||currentDocument.description,5000)));
  }
  function editNote(){
   const n=editingNote||{id:'',title:'',body:''};
   const form=el('form','fh-phone-note-form');
   const title=el('input');title.type='text';title.maxLength=100;title.value=n.title;
   title.placeholder=label('noteTitle','Título');
   title.setAttribute('aria-label',label('noteTitle','Título'));
   const body=el('textarea');body.maxLength=5000;body.rows=10;body.value=n.body;
   body.placeholder=label('noteBody','Contenido');
   body.setAttribute('aria-label',label('noteBody','Contenido'));
   const saveButton=button(label('saveNote','Guardar nota'),()=>{},'fh-phone-primary');saveButton.type='submit';
   form.addEventListener('submit',event=>{
    event.preventDefault();const value=safe(body.value,5000),heading=safe(title.value,100);
    if(!heading&&!value){notice(label('emptyNote','Escribe un título o contenido.'));return}
    const id=n.id||'note_'+stamps()+'_'+p.notes.length;
    const item={id,title:heading||label('untitled','Sin título'),body:value};
    const idx=p.notes.findIndex(entry=>entry.id===id);
    if(idx<0)p.notes.push(item);else p.notes[idx]=item;
    editingNote=null;save();screen('notes');
   });
   append(form,title,body,saveButton);content.append(form);
  }
  function flashlight(){
   const status=options.torchState?.()||{};
   const enabled=!!status.enabled,charge=Math.max(0,Math.min(100,Number(status.charge)||0));
   content.append(el('h3','fh-phone-section',label('flashlight','Linterna')));
   content.append(el('p','fh-phone-readout',enabled?label('torchOn','ENCENDIDA'):label('torchOff','APAGADA')));
   const track=container('fh-phone-battery-track'),fill=container('fh-phone-battery-fill');
   fill.style.width=charge+'%';track.append(fill);
   append(content,track,el('p','fh-phone-muted',label('battery','Batería')+' · '+Math.ceil(charge)+'%'));
   content.append(button(enabled?label('switchOff','Apagar'):label('switchOn','Encender'),()=>{
    options.toggleTorch?.();screen('flashlight');
   },'fh-phone-primary'));
  }
  function store(){
   content.append(el('p','fh-phone-muted',label('storeHelp','Aplicaciones disponibles para este dispositivo.')));
   for(const id of allApps()){ 
    const installed=p.installedApps.includes(id);
    const row=container('fh-phone-entry');
    const info=container('fh-phone-entry-text');
    append(info,el('strong','',label('app_'+id,EXTRA_APPS.get(id)?.name||id)),el('small','',installed?label('installed','Instalada'):label('available','Disponible')));
    const b=button(installed?label('remove','Quitar'):label('install','Instalar'),()=>{
     if(installed){if(!uninstallApp(state,id))return}
     else installApp(state,id);
     save();screen('store');
    });
    b.disabled=installed&&BASE_APPS.includes(id);
    append(row,info,b);content.append(row);
   }
  }
  function cartChanged(){
   save();options.onCartChange?.(copy(commerce()));
  }
  function addCart(productId,quantity=1,destinationId='',paymentMethod='prepaid'){
   if(!positiveInt(quantity)||!options.delivery?.()?.products?.some(p=>p.id===productId&&p.shopStatus==='available'))return false;
   const validDest=options.addresses?.()||[];
   if(!validDest.some(a=>a.id===destinationId))return false;
   const methods=['prepaid','cash','card'];
   if(!methods.includes(paymentMethod))return false;
   const list=commerce(),same=list.find(v=>v.productId===productId&&v.destinationId===destinationId&&v.paymentMethod===paymentMethod);
   if(same){if(same.quantity+quantity>20)return false;same.quantity+=quantity}
   else list.push({id:'cart_'+stamps()+'_'+list.length,productId,quantity,destinationId,paymentMethod});
   cartChanged();return true;
  }
  function removeCart(id){const previous=commerce().length;state.commerce.cart=commerce().filter(v=>v.id!==id);
   if(previous===commerce().length)return false;cartChanged();return true}
  function checkoutCart(){
   const runtime=options.delivery?.(),list=commerce().slice();let accepted=0,remaining=[];
   for(const item of list){
    const order=runtime?.placeOrder?.(item.productId,item.paymentMethod,item.quantity,item.destinationId);
    if(order)accepted++;else remaining.push(item);
   }
   state.commerce.cart=remaining;cartChanged();
   return {accepted,failed:remaining.length};
  }
  function hamazon(){
   const d=options.delivery?.(),products=d?.products||[],orders=d?.orders||[],addresses=options.addresses?.()||[];
   const nav=container('fh-phone-tabs');let tab=panel.dataset.hamazonTab||'catalog';
   for(const [id,key] of [['catalog','catalog'],['cart','cart'],['orders','orders']]){
    const b=button(label(key,id),()=>{panel.dataset.hamazonTab=id;screen('hamazon')});
    b.setAttribute('aria-pressed',String(tab===id));nav.append(b);
   }content.append(nav);
   if(tab==='orders'){
    if(!orders.length)return empty(label('noOrders','No hay pedidos registrados.'));
    for(const o of orders.slice().reverse())content.append(el('div','fh-phone-order',
     safe(o.name||o.productId,100)+' × '+o.quantity+' · '+safe(o.status,35)));
    return;
   }
   if(tab==='cart'){
    if(!commerce().length)return empty(label('emptyCart','El carrito está vacío.'));
    for(const item of commerce().slice()){
     const product=products.find(v=>v.id===item.productId);
     const row=container('fh-phone-entry');
     append(row,el('div','fh-phone-entry-text',
      safe(product?.name||item.productId,100)+' × '+item.quantity),
      button(label('remove','Quitar'),()=>{removeCart(item.id);screen('hamazon')},'fh-phone-danger'));
     content.append(row);
    }
    content.append(button(label('checkout','Confirmar pedidos'),()=>{
     const result=checkoutCart();
     notice(label('ordersCreated','Pedidos registrados')+': '+result.accepted+
      (result.failed?' · '+label('failed','No registrados')+': '+result.failed:''));
     screen('hamazon');
    },'fh-phone-primary'));
    return;
   }
   if(!products.length)return empty(label('noCatalog','El catálogo aún no está disponible.'));
   if(!addresses.length)content.append(el('p','fh-phone-error',label('noAddresses','No hay direcciones de entrega válidas.')));
   for(const product of products.filter(v=>v.environment==='interior')){
    const row=container('fh-phone-product'),title=el('strong','',safe(product.name,90));
    const detail=el('small','',product.price==null?label('pricePending','Precio pendiente'):
     '$'+Number(product.price).toFixed(2));
    const fields=el('div','fh-phone-product-fields');
    const qty=el('input');qty.type='number';qty.inputMode='numeric';qty.min='1';qty.max='20';qty.value='1';qty.setAttribute('aria-label',label('quantity','Cantidad'));
    const addr=el('select');addr.setAttribute('aria-label',label('address','Dirección'));
    for(const a of addresses){const opt=el('option','',safe(a.name,80));opt.value=a.id;addr.append(opt)}
    const method=el('select');method.setAttribute('aria-label',label('payment','Pago'));
    for(const [value,key] of [['prepaid','prepaid'],['cash','cash'],['card','card']]){
     const opt=el('option','',label(key,value));opt.value=value;method.append(opt);
    }
    append(fields,qty,addr,method);
    const add=button(label('addCart','Añadir al carrito'),()=>{
     const ok=addCart(product.id,Number(qty.value),addr.value,method.value);
     notice(ok?label('added','Añadido al carrito'):label('invalidPurchase','Comprueba cantidad y destino.'));
    },'fh-phone-primary');
    add.disabled=product.shopStatus!=='available'||!addresses.length;
    append(row,title,detail,fields,add);content.append(row);
   }
  }
  function addContact(contact){
   if(!contact||!safe(contact.id,80)||!CATEGORIES.includes(contact.kind))return false;
   const entry={id:safe(contact.id,80),name:safe(contact.name,80)||safe(contact.id,80),kind:contact.kind};
   const idx=p.contacts.findIndex(c=>c.id===entry.id);
   if(idx>=0)p.contacts[idx]=entry;else p.contacts.push(entry);
   save();return true;
  }
  function update(dt=0){
   elapsed+=Number.isFinite(dt)?Math.max(0,dt):0;
   if(elapsed<.5)return;elapsed=0;
   if(blocked()&&opened)close();
   if(clockNode)clockNode.textContent=clock();
   if(opened&&view==='home'){
    const value=content?.querySelector('.fh-phone-big-clock');if(value)value.textContent=clock();
   }
   if(opened&&view==='flashlight'){
    const state=options.torchState?.()||{},signature=String(state.enabled)+'/'+Math.ceil(Number(state.charge)||0);
    if(lastTorch!==signature){lastTorch=signature;screen('flashlight')}
   }
   for(const order of options.delivery?.()?.orders||[]){
    if(!order?.id)continue;
    const prior=orderSeen.get(order.id);
    if(prior!==order.status){
     orderSeen.set(order.id,order.status);
     if(prior===undefined||prior!==null)
      receive('hamazon-delivery',(label('orderUpdate','Pedido')+' '+safe(order.name,70)+': '+safe(order.status,35)));
    }
   }
  }
  function close(){
   if(!opened)return;opened=false;panel.hidden=true;toggle?.setAttribute('aria-expanded','false');
   document.body.classList.remove('fh-phone-open');
  }
  function open(){
   if(!panel||blocked())return false;
   opened=true;panel.hidden=false;toggle.setAttribute('aria-expanded','true');
   document.body.classList.add('fh-phone-open');screen('home');return true;
  }
  function togglePhone(){return opened?(close(),true):open()}
  function onKeydown(event){
   const target=event.target,typing=target&&(target.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
   if(typing){
    if(opened&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return}
    if(opened)event.stopImmediatePropagation();
    return;
   }
   if(event.key?.toLowerCase()==='c'&&!event.repeat){
    if(blocked())return;
    event.preventDefault();event.stopImmediatePropagation();togglePhone();
   }else if(opened&&event.key==='Escape'){
    event.preventDefault();event.stopImmediatePropagation();close();
   }
  }
  function mount(){
   if(!document||document.getElementById('fhPhoneToggle'))return false;
   toggle=button('▣',togglePhone,'fh-phone-toggle');toggle.id='fhPhoneToggle';
   toggle.setAttribute('aria-label',label('openPhone','Abrir celular'));
   toggle.setAttribute('aria-controls','fhPhonePanel');toggle.setAttribute('aria-expanded','false');
   panel=el('section','fh-phone-panel');panel.id='fhPhonePanel';panel.hidden=true;
   panel.setAttribute('aria-label',label('phone','Celular'));
   const bar=container('fh-phone-statusbar');
   clockNode=el('strong','fh-phone-status-clock',clock());
   append(bar,clockNode,el('span','',label('gameTime','HORA DEL JUEGO')));
   const head=container('fh-phone-header'),back=button('‹',()=>screen(previous),'fh-phone-back');
   back.setAttribute('aria-label',label('back','Volver'));back.hidden=true;
   topTitle=el('strong','fh-phone-title',label('phone','Celular'));
   append(head,back,topTitle,button('×',close,'fh-phone-close'));
   content=container('fh-phone-content');toastNode=el('div','fh-phone-toast');toastNode.hidden=true;
   append(panel,bar,head,content,toastNode);
   document.body.append(toggle,panel);
   root.addEventListener?.('keydown',onKeydown,true);
   if(typeof root.addEventListener==='function')root.addEventListener('blur',close);
   return true;
  }
  mount();
  return Object.freeze({
   open,close,toggle:togglePhone,update,addContact,receiveMessage:receive,sendMessage:send,
   addToCart:addCart,removeFromCart:removeCart,checkoutCart,
   syncCartToTerminal:()=>options.onCartChange?.(copy(commerce())),
   get isOpen(){return opened},
   get installedApps(){return p.installedApps.slice()},
   get cart(){return copy(commerce())}
  });
 }
 return {BASE_APPS,AVAILABLE_APPS,registerApp,ensureState,formatClock,installApp,uninstallApp,createRuntime};
});