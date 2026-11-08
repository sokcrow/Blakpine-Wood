/* Blakpine-Wood — inspector de inventario de muebles.
 * Sólo edita item.storage: el gameplay pertenece a FHInventoryCore.
 */
(function (root) {
 'use strict';
 const CATEGORIES=Object.freeze({
  food:'Alimentos',drink:'Bebidas',kitchen:'Utensilios de cocina',hygiene:'Higiene y limpieza',
  clothing:'Ropa',medicine:'Medicinas',document:'Documentos',tool:'Herramientas',other:'Otros'
 });
 const FURNITURE_TYPES=new Set(['misc','chair','sofa','bed','tv','table','dining','kitchen','bath','toilet']);
 const copy=v=>JSON.parse(JSON.stringify(v));
 const getCore=()=>root.FHInventoryCore||(typeof require==='function'?require('./fh-inventory-core.js'):null);
 function canConfigure(item,core=getCore()){
  return !!(core&&item?.modelId&&FURNITURE_TYPES.has(item.type)&&!item.runtimePackage);
 }
 function getProfile(item,core=getCore()){
  return canConfigure(item,core)?core.furnitureProfile(item.modelId,item.storage||{}):null;
 }
 function validateConfig(item,settings,defs=[],core=getCore()){
  if(!canConfigure(item,core))return {ok:false,reason:'notFurniture'};
  if(!settings || typeof settings!=='object')return {ok:false,reason:'invalid'};
  if(!Number.isInteger(settings.slots)||settings.slots<core.MIN_FURNITURE_SLOTS||settings.slots>512)
   return {ok:false,reason:'slots'};
  if(settings.allowedCategories!==undefined && settings.allowedCategories!==null &&
     (!Array.isArray(settings.allowedCategories)||settings.allowedCategories.some(cat=>!Object.hasOwn(CATEGORIES,cat))))
   return {ok:false,reason:'category'};
  for(const [cat,value] of Object.entries(settings.categoryLimits||{})){
   if(!Object.hasOwn(CATEGORIES,cat)||!Number.isInteger(value)||value<0||value>512)
    return {ok:false,reason:'limit'};
  }
  const contents=settings.initialItems||[];
  if(!Array.isArray(contents))return {ok:false,reason:'invalidContents'};
  const known=new Set(defs.map(def=>def.id));
  if(contents.some(entry=>!entry||!known.has(entry.id)||!Number.isInteger(entry.quantity)||entry.quantity<1||entry.quantity>999))
   return {ok:false,reason:'unknownItem'};
  const world=core.createWorld(defs);
  const result=core.addFurniture(world,'__inspector__',item.modelId,{...settings,items:contents});
  if(!result.ok)return result;
  return {ok:true,items:copy(world.furniture.__inspector__.items)};
 }
 function attachInspector(item,host,options={}){
  const core=getCore();
  if(!host||!canConfigure(item,core))return false;
  const doc=host.ownerDocument||root.document;
  const configured=getProfile(item,core);
  const defs=Array.isArray(options.project?.itemDefs)?options.project.itemDefs.filter(d=>d&&typeof d.id==='string'&&d.id):[];
  const tag=(name,text)=>{const el=doc.createElement(name);if(text!==undefined)el.textContent=text;return el;};
  const add=(parent,...children)=>{parent.append(...children);return parent;};
  const wrap=(title,control)=>add(tag('label'),tag('span',title),control);
  const section=tag('section');section.className='fh-storage-editor';
  add(section,tag('strong','Almacenamiento del mueble'));
  const hint=tag('p',configured?'Un inventario compartido por mueble.':'Este modelo no tiene inventario predeterminado.');
  hint.className='fh-storage-hint';section.append(hint);
  const refresh=()=>{options.record?.();options.openInspector?.();};
  const error=reason=>({
   slots:'La capacidad debe ser de 6 a 512 espacios.',
   full:'No hay espacio para el contenido inicial.',
   category:'Un objeto inicial no está permitido en esta categoría.',
   categoryFull:'Se alcanzó el límite de una categoría.',
   limit:'El límite de categoría no es válido.',
   unknownItem:'Selecciona ítems declarados en el proyecto y cantidades válidas.',
   notStackable:'Un objeto no apilable solo puede tener cantidad 1.',
   invalidContents:'El contenido inicial no es válido.'
  })[reason]||'No se pudo guardar la configuración del inventario.';
  const edit=(change)=>{
   if(options.canEdit?.(item)===false){options.toast?.('No puedes modificar este mueble.');return;}
   const base=item.storage||{};
   const current=core.furnitureProfile(item.modelId,base);
   const draft={...copy(base),enabled:true,
    slots:base.slots??current?.slots??core.MIN_FURNITURE_SLOTS,
    ...change};
   const result=validateConfig(item,draft,defs,core);
   if(!result.ok){options.toast?.(error(result.reason));options.openInspector?.();return;}
   draft.initialItems=result.items;
   item.storage=draft;
   refresh();
  };
  if(!configured){
   const enable=tag('button','Habilitar inventario');enable.type='button';
   enable.onclick=()=>edit({slots:core.MIN_FURNITURE_SLOTS,allowedCategories:null,initialItems:[]});
   section.append(enable);host.append(section);return true;
  }
  const settings=item.storage||{},profile=configured;
  const capacity=tag('input');capacity.type='number';capacity.min=String(core.MIN_FURNITURE_SLOTS);
  capacity.max='512';capacity.step='1';capacity.value=String(profile.slots);
  capacity.onchange=()=>edit({slots:Number(capacity.value)});
  section.append(wrap('Capacidad (espacios)',capacity));
  const categories=tag('fieldset');categories.className='fh-storage-categories';
  const legend=tag('legend','Categorías permitidas');categories.append(legend);
  for(const [id,label] of Object.entries(CATEGORIES)){
   const check=tag('input');check.type='checkbox';check.checked=!profile.allowed||profile.allowed.includes(id);
   check.onchange=()=>{
    const allowed=profile.allowed?[...profile.allowed]:Object.keys(CATEGORIES);
    const next=check.checked?[...new Set([...allowed,id])]:allowed.filter(cat=>cat!==id);
    edit({allowedCategories:next});
   };
   const row=wrap(label,check);row.className='fh-storage-check';categories.append(row);
  }
  section.append(categories);
  const limits=tag('details');
  const summary=tag('summary','Límites por categoría (en espacios)');limits.append(summary);
  const details=tag('p','Vacío = límite predeterminado del modelo. Cero = no admite esa categoría.');
  details.className='fh-storage-hint';limits.append(details);
  const defaults=core.FURNITURE[item.modelId]?.limits||{};
  for(const [id,label] of Object.entries(CATEGORIES)){
   const row=tag('label');row.className='fh-storage-limit';
   const limit=tag('input');limit.type='number';limit.min='0';limit.max='512';limit.step='1';
   limit.placeholder=defaults[id]===undefined?'Sin límite':String(defaults[id]);
   limit.value=settings.categoryLimits?.[id]===undefined?'':String(settings.categoryLimits[id]);
   limit.onchange=()=>{
    const next={...(settings.categoryLimits||{})};
    if(limit.value.trim()==='')delete next[id];else next[id]=Number(limit.value);
    edit({categoryLimits:next});
   };
   row.append(tag('span',label),limit);limits.append(row);
  }
  section.append(limits);
  const initial=tag('fieldset');initial.className='fh-storage-items';
  initial.append(tag('legend','Contenido inicial'));
  const items=Array.isArray(settings.initialItems)?settings.initialItems:[];
  for(const [index,entry] of items.entries()){
   const row=tag('div');row.className='fh-storage-item';
   const selection=tag('select');selection.setAttribute('aria-label','Objeto inicial '+(index+1));
   // Preservar la posibilidad de retirar referencias antiguas sin eliminarlas automáticamente.
   if(!defs.some(d=>d.id===entry.id)){
    const missing=tag('option',entry.id+' (no declarado)');missing.value=entry.id;selection.append(missing);
   }
   for(const def of defs){
    const opt=tag('option',def.name||def.id);opt.value=def.id;selection.append(opt);
   }
   selection.value=entry.id;
   selection.onchange=()=>{
    const next=copy(items);next[index].id=selection.value;edit({initialItems:next});
   };
   const amount=tag('input');amount.type='number';amount.min='1';amount.max='999';amount.step='1';
   amount.value=String(entry.quantity);amount.setAttribute('aria-label','Cantidad de '+entry.id);
   amount.onchange=()=>{const next=copy(items);next[index].quantity=Number(amount.value);edit({initialItems:next});};
   const remove=tag('button','Quitar');remove.type='button';
   remove.onclick=()=>edit({initialItems:items.filter((_,i)=>i!==index)});
   row.append(selection,amount,remove);initial.append(row);
  }
  if(defs.length){
   const addButton=tag('button','＋ Agregar objeto');addButton.type='button';
   addButton.onclick=()=>edit({initialItems:[...items,{id:defs[0].id,quantity:1}]});
   initial.append(addButton);
  } else {
   const message=tag('p','No hay ítems definidos en el proyecto. Puedes configurar la capacidad y categorías.');
   message.className='fh-storage-hint';initial.append(message);
  }
  section.append(initial);
  if(item.storage){
   const reset=tag('button',core.FURNITURE[item.modelId]?'Restablecer valores del modelo':'Desactivar inventario');
   reset.type='button';reset.className='fh-storage-reset';
   reset.onclick=()=>{
    if(options.canEdit?.(item)===false){options.toast?.('No puedes modificar este mueble.');return;}
    delete item.storage;refresh();
   };
   section.append(reset);
  }
  host.append(section);return true;
 }
 const API={canConfigure,getProfile,validateConfig,attachInspector,CATEGORIES};
 root.FHStorageEditor=Object.freeze(API);
 if(typeof module==='object'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
