/* Electricidad 03 · Herramienta exterior sobre el editor de mapas existente. */
(function(root){
 'use strict';
 const G=root.FHExteriorGrid,T=root.FH_EXTERIOR_TEXT;
 if(!G||!T)return;
 const base=new URL('./forest-horror/biblioteca/',document.baseURI);
 let selected=null,catalog=null,opener=null;
 const style=document.createElement('style');style.textContent=`
 #fhExteriorPicker[hidden]{display:none!important}#fhExteriorPicker{position:fixed;inset:0;z-index:143;display:grid;place-items:center;padding:10px;background:#020609df}
 #fhExteriorPicker section{width:min(830px,100%);max-height:93dvh;overflow:auto;padding:14px;border:2px solid #738889;background:#172227;color:#eee9db}
 #fhExteriorPicker header{display:flex;justify-content:space-between;align-items:center}#fhExteriorPicker h2{font:700 17px system-ui;margin:0 0 8px}
 #fhExteriorPicker button{background:#29383d;color:inherit;border:1px solid #748483;padding:8px;cursor:pointer}
 #fhExteriorPicker button:focus-visible{outline:2px solid #e7bd81;outline-offset:2px}
 #fhExteriorPicker .choices{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
 #fhExteriorPicker .choices button{display:flex;flex-direction:column;gap:6px;text-align:left}
 #fhExteriorPicker img{width:100%;height:118px;object-fit:contain;image-rendering:pixelated;background:#202c30}
 #fhExteriorPicker strong{font:700 12px/1.3 system-ui}#fhExteriorPicker small,#fhExteriorPicker p{color:#c0c9bd;font:12px/1.4 system-ui}
 @media(max-width:600px){#fhExteriorPicker .choices{grid-template-columns:repeat(2,minmax(0,1fr))}#fhExteriorPicker img{height:86px}}
 `;document.head.append(style);
 const overlay=document.createElement('div');overlay.id='fhExteriorPicker';overlay.hidden=true;
 const panel=document.createElement('section');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',T.picker);
 const header=document.createElement('header'),heading=document.createElement('h2'),close=document.createElement('button');
 heading.textContent=T.picker;close.textContent=T.close;close.type='button';header.append(heading,close);
 const choices=document.createElement('div');choices.className='choices';const note=document.createElement('p');note.textContent=T.hint;
 panel.append(header,choices,note);overlay.append(panel);document.body.append(overlay);
 function hide(){overlay.hidden=true;opener?.focus?.();}close.onclick=hide;
 overlay.addEventListener('click',event=>{if(event.target===overlay)hide();});
 overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();hide();}});
 async function open(){
  opener=document.activeElement;overlay.hidden=false;choices.textContent=T.loading;close.focus();
  try{
   if(!catalog)catalog=fetch(new URL('catalogo_muebles.json',base).href)
    .then(response=>{if(!response.ok)throw Error(T.error);return response.json();})
    .then(data=>(data.furniture||[]).filter(entry=>G.CONFIG[entry.id]));
   const entries=await catalog;choices.replaceChildren();
   for(const entry of entries){
    const b=document.createElement('button'),img=document.createElement('img'),name=document.createElement('strong'),size=document.createElement('small');
    b.type='button';img.alt='';img.src=new URL(entry.thumbnail,base).href;name.textContent=entry.name;
    size.textContent=[entry.widthFt,entry.heightFt,entry.depthFt].join(' × ')+' '+T.feet;
    b.append(img,name,size);b.onclick=()=>{selected=entry;setCategory('furniture');chooseTool('misc');hide();toast(T.selected+entry.name);};
    choices.append(b);
   }
  }catch(error){catalog=null;choices.textContent=T.error;console.warn('[Electricidad 03]',error);}
 }
 function launcher(){
  const tools=document.querySelector('#tools');if(activeCategory!=='lighting'||!tools||document.getElementById('fhExteriorLauncher'))return;
  const button=document.createElement('button');button.id='fhExteriorLauncher';button.type='button';button.textContent=T.picker;
  button.onclick=open;tools.append(button);
 }
 const beforeCategory=setCategory;
 setCategory=function(category){if(category!=='furniture')selected=null;beforeCategory(category);launcher();};
 // Elegir un mueble normal desarma la selección del poste anterior.
 document.getElementById('fhCatModal')?.addEventListener('click',event=>{
  if(event.target.closest?.('.fhCatCard'))selected=null;
 },true);
 const beforeChoose=chooseTool;
 chooseTool=function(tool){if(tool!=='misc')selected=null;return beforeChoose(tool);};
 const beforeCreate=createObject;
 createObject=function(type,at){
  const selectedExterior=type==='misc'?selected:null;
  const panelItem=type==='breaker_panel';
  if(selectedExterior)root.__fhExteriorCreatingFloor=true;
  let item;
  try{item=beforeCreate(type,at);}finally{root.__fhExteriorCreatingFloor=false;}
  if(!item)return item;
  if(selectedExterior){
   root.FHFurnitureRules.applyCatalogModel(item,selectedExterior,ForestShared,Number(project.units?.feetPerCell)||5);
   item.exteriorCableFt=90;item.exteriorFeedFt=90;item.exteriorGridEnabled=true;
   if(G.roleFor(item)==='lamp'){item.exteriorBrightFt=30;item.exteriorDimFt=30;}
  }
  if(panelItem&&item.exteriorAutoConnect===undefined)item.exteriorAutoConnect=true;
  return item;
 };
 function permission(item){return !root.FHStyleEditor||root.FHStyleEditor.canEditItem(item);}
 function addInput(fields,item,key,label,kind='number',fallback=90){
  const holder=document.createElement('label');holder.textContent=label;
  const input=document.createElement('input');input.type=kind;input.value=kind==='checkbox'?'':item[key]??fallback;
  if(kind==='checkbox')input.checked=item[key]===undefined?fallback===true:item[key]===true;
  input.onchange=()=>{
   if(!permission(item)){openInspector();return;}
   item[key]=kind==='checkbox'?input.checked:Math.max(0,Math.min(1000,Number(input.value)||0));
   record();render();openInspector();
  };
  holder.append(input);fields.append(holder);
 }
 const beforeInspector=openInspector;
 openInspector=function(){
  beforeInspector();
  const item=current().items.find(v=>v.id===selection);if(!item)return;
  const fields=document.getElementById('fields');if(!fields)return;
  if(G.isExternal(item)){
   addInput(fields,item,'exteriorCableFt',T.cable);
   addInput(fields,item,'exteriorFeedFt',T.feed);
   addInput(fields,item,'exteriorGridEnabled',T.enabled,'checkbox',true);
   if(G.roleFor(item)==='lamp'){
    addInput(fields,item,'exteriorBrightFt','Radio brillante (pies)','number',30);
    addInput(fields,item,'exteriorDimFt','Radio tenue adicional (pies)','number',30);
   }
  }
  if(item.type==='breaker_panel'){
   addInput(fields,item,'exteriorAutoConnect',T.auto,'checkbox',false);
   addInput(fields,item,'exteriorFeedFt',T.feed);
  }
  if(item.type==='generator'&&item.generatorKind==='emergency'){
   addInput(fields,item,'electricCapacityHours',T.batteryCapacity,'number',item.autonomyHours??24);
   addInput(fields,item,'initialElectricChargeHours',T.batteryInitial,'number',item.electricCapacityHours??item.autonomyHours??24);
   addInput(fields,item,'rechargeHoursPerHour',T.recharge,'number',4);
   const note=document.createElement('small');note.textContent=T.batteryNote;fields.append(note);
  }
 };
 launcher();root.FHExteriorEditor=Object.freeze({open});
})(window);
