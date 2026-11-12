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
    b.append(img,name,size);b.onclick=()=>activate(entry);
    choices.append(b);
   }
  }catch(error){catalog=null;choices.textContent=T.error;console.warn('[Electricidad 03]',error);}
 }
 function activate(entry){
  // Los objetos eléctricos se colocan y seleccionan en Iluminación, no en Muebles.
  setCategory('lighting');selected=entry;chooseTool('misc');
  const tools=document.querySelector('#tools');
  if(tools){
   let button=document.getElementById('fhExteriorPlaceTool');
   if(!button){button=document.createElement('button');button.type='button';button.id='fhExteriorPlaceTool';button.dataset.tool='misc';
    button.onclick=()=>chooseTool('misc');tools.append(button);}
   button.textContent=T.place+' '+entry.name;button.title=entry.name;button.classList.add('active');
  }
  hide();toast(T.selected+entry.name);
 }
 function launcher(){
  const tools=document.querySelector('#tools');if(activeCategory!=='lighting'||!tools||document.getElementById('fhExteriorLauncher'))return;
  const button=document.createElement('button');button.id='fhExteriorLauncher';button.type='button';button.textContent=T.picker;
  button.onclick=open;tools.append(button);
 }
 const beforeCategory=setCategory;
 setCategory=function(category){selected=null;beforeCategory(category);launcher();};
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
   G.compactFootprint(item,Number(project.units?.feetPerCell)||5,true);
   item.exteriorCableFt=90;item.exteriorFeedFt=90;item.exteriorGridEnabled=true;
   item.exteriorKind=G.roleFor(item);
   if(G.roleFor(item)==='lamp'){item.exteriorBrightFt=30;item.exteriorDimFt=30;}
  }
  if(panelItem&&item.exteriorAutoConnect===undefined)item.exteriorAutoConnect=true;
  return item;
 };
 function permission(item){return !root.FHStyleEditor||root.FHStyleEditor.canEditItem(item);}
 function addInput(fields,item,key,label,kind='number',fallback=90,max=1000){
  const holder=document.createElement('label');holder.textContent=label;
  const input=document.createElement('input');input.type=kind;input.value=kind==='checkbox'?'':item[key]??fallback;
  if(kind==='checkbox')input.checked=item[key]===undefined?fallback===true:item[key]===true;
  input.onchange=()=>{
   if(!permission(item)){openInspector();return;}
   item[key]=kind==='checkbox'?input.checked:Math.max(0,Math.min(max,Number(input.value)||0));
   record();render();openInspector();
  };
  holder.append(input);fields.append(holder);
 }
 // Vista de conexiones físicas; no presume que el contrato esté pagado en la partida.
 let topologyKey='',topologyCache=null;
 function topology(){
  const key=JSON.stringify([project.units?.feetPerCell,(project.floors||[]).map(f=>[f.id,f.elevationFt,
   (f.items||[]).filter(it=>G.isExternal(it)||it.type==='breaker_panel').map(it=>
    [it.id,it.modelId,it.type,it.x,it.y,it.enabled,it.exteriorGridEnabled,it.exteriorCableFt,
     it.exteriorFeedFt,it.exteriorAutoConnect,it.powerSource,it.exteriorCapacityWatts,
     it.exteriorLinkMode,it.exteriorParentId,it.exteriorConnectionMode,it.exteriorNodeId,it.exteriorDemandWatts])])]);
  if(topologyKey!==key||!topologyCache){topologyKey=key;topologyCache=G.createRuntime(project,{});}
  return topologyCache;
 }
 function statusLine(fields,text){
  const msg=document.createElement('div');msg.className='tip';msg.style.gridColumn='1/-1';
  msg.textContent=text;fields.append(msg);
 }
 function drawGrid(ctx,z,toPixel){
  if(typeof toPixel!=='function')return;
  const grid=topology();const sameFloor=f=>f===floorIndex;
  ctx.save();
  // Cobertura prevista, no un estado de partida: la simulación apagará las luces sin corriente.
  if(typeof ctx.beginPath==='function'&&typeof ctx.fill==='function'){
   const a=toPixel({x:0,y:0}),b=toPixel({x:1,y:1});
   const sx=Math.abs(b.x-a.x),sy=Math.abs(b.y-a.y),cell=Math.max(.1,Number(project.units?.feetPerCell)||5);
   for(const node of grid.nodes){
    if(node.role!=='lamp'||!sameFloor(node.f)||!grid.energized(node))continue;
    const p=toPixel(node.it),bright=Math.max(1,Math.min(120,Number(node.it.exteriorBrightFt)||30))/cell;
    const dim=Math.max(0,Math.min(120,Number(node.it.exteriorDimFt)||30))/cell;
    for(const [r,alpha] of [[bright+dim,.075],[bright,.16]]){
     ctx.beginPath();
     if(typeof ctx.ellipse==='function')ctx.ellipse(p.x,p.y,r*sx,r*sy,0,0,2*Math.PI);
     else if(typeof ctx.arc==='function')ctx.arc(p.x,p.y,r*sx,0,2*Math.PI);
     else continue;
     ctx.fillStyle='#ffd38e';ctx.globalAlpha=alpha;ctx.fill();ctx.globalAlpha=1;
    }
   }
  }
  ctx.lineWidth=Math.max(.8,1.8/z);
  for(const link of grid.links()){
   if(!sameFloor(link.from.f)||!sameFloor(link.to.f))continue;
   const a=toPixel(link.from.it),b=toPixel(link.to.it);
   ctx.beginPath();ctx.setLineDash(link.powered?[]:[4/z,4/z]);
   ctx.strokeStyle=link.powered?'#85ce96':'#ab7770';ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
  for(const link of grid.panelLinks()){
   if(!sameFloor(link.f)||!sameFloor(link.node.f))continue;
   const a=toPixel(link.node.it),b=toPixel(link.panel);
   ctx.beginPath();ctx.setLineDash(link.powered?[]:[4/z,4/z]);
   ctx.strokeStyle=link.powered?'#85ce96':'#ab7770';ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
  ctx.restore();
 }

 function sourcePicker(fields,item,entries,value,onChange,label){
  const holder=document.createElement('label');holder.textContent=label;
  const select=document.createElement('select');
  for(const [id,title] of entries){
   const option=document.createElement('option');option.value=id;option.textContent=title;select.append(option);
  }
  select.value=value;select.onchange=()=>{
   if(!permission(item)){openInspector();return;}
   onChange(select.value);record();render();openInspector();
  };
  holder.append(select);fields.append(holder);
 }
 function availableNodes(item){
  return topology().nodes.filter(n=>n.f===floorIndex&&n.it!==item)
   .map(n=>[n.id,(T.roles[n.role]||T.infrastructure)+' · '+(n.it.label||n.id)]);
 }
 const beforeInspector=openInspector;
 openInspector=function(){
  beforeInspector();
  const item=current().items.find(v=>v.id===selection);if(!item)return;
  const fields=document.getElementById('fields');if(!fields)return;
  if(G.isExternal(item)){
   const role=G.roleFor(item),grid=topology(),node=grid.nodes.find(n=>n.it===item);
   const title=document.getElementById('inspTitle');if(title)title.textContent=(T.roles[role]||T.infrastructure)+' · '+(item.label||item.modelId);
   const connected=!!node&&grid.energized(node);
   if(!grid.hasTransformers)statusLine(fields,T.noTransformer);
   else if(!connected)statusLine(fields,T.nodeDisconnected);
   else {
    const info=grid.consumers(node);
    statusLine(fields,T.nodeConnected+' · '+info.posts+' '+T.nodesDownstream+
      ' · '+info.lamps+' '+T.lampsDownstream+' · '+info.breakers.length+' '+T.breakersInReach);
    if(role==='transformer'&&!info.breakers.length)statusLine(fields,T.noBreakers);
   }
   if(role==='transformer'){
    addInput(fields,item,'exteriorCapacityWatts',T.capacityWatts, 'number',
      G.CONFIG[item.modelId]?.capacityWatts||12000,1000000);
   }else{
    const entries=[['auto',T.linkAuto],['off',T.linkOff],
     ...availableNodes(item).map(([id,title])=>['node:'+id,title])];
    const mode=item.exteriorLinkMode||'auto';
    const val=mode==='manual'?'node:'+String(item.exteriorParentId||''):mode;
    sourcePicker(fields,item,entries,val,choice=>{
     item.exteriorLinkMode=choice.startsWith('node:')?'manual':choice;
     item.exteriorParentId=choice.startsWith('node:')?choice.slice(5):'';
    },T.linkParent);
    if(role==='lamp')statusLine(fields,connected?T.lampOn:T.lampOff);
   }
   addInput(fields,item,'exteriorCableFt',T.cable);
   addInput(fields,item,'exteriorFeedFt',T.feed);
   addInput(fields,item,'exteriorGridEnabled',T.enabled,'checkbox',true);
   if(G.roleFor(item)==='lamp'){
    addInput(fields,item,'exteriorBrightFt',T.bright,'number',30,120);
    addInput(fields,item,'exteriorDimFt',T.dim,'number',30,120);
   }
  }
  if(item.type==='breaker_panel'){
   const grid=topology(),link=grid.panelConnection(floorIndex,item);
   const allowed=item.exteriorAutoConnect===true||item.powerSource===undefined||item.powerSource?.kind==='utility';
   statusLine(fields,!grid.hasTransformers?T.noTransformer:
    item.exteriorConnectionMode==='off'?T.linkOff:
    !allowed?T.breakerNotConfigured:!link?T.breakerOutOfRange:
    link.reason==='capacity'?T.capacityExceeded+' ('+link.demandWatts+' W / '+link.availableWatts+' W)':
    link.powered?T.breakerConnected+' '+Math.round(link.feet)+' '+T.feet+
      ' · '+T.transformerLabel+' '+link.transformerId:T.nodeDisconnected);
   const selectedMode=item.exteriorConnectionMode||'auto';
   sourcePicker(fields,item,[['auto',T.linkAuto],['off',T.linkOff],
    ...availableNodes(item).map(([id,title])=>['node:'+id,title])],
    selectedMode==='manual'?'node:'+String(item.exteriorNodeId||''):selectedMode,
    choice=>{
     item.exteriorConnectionMode=choice.startsWith('node:')?'manual':choice;
     item.exteriorNodeId=choice.startsWith('node:')?choice.slice(5):'';
     if(choice!=='off')item.exteriorAutoConnect=true;
    },T.breakerSource);
   addInput(fields,item,'exteriorAutoConnect',T.auto,'checkbox',false);
   addInput(fields,item,'exteriorFeedFt',T.feed);
   addInput(fields,item,'exteriorDemandWatts',T.demandWatts,'number',item.capacityWatts??2400,1000000);
  }
  if(item.type==='generator'&&item.generatorKind==='emergency'){
   addInput(fields,item,'electricCapacityHours',T.batteryCapacity,'number',item.autonomyHours??24);
   addInput(fields,item,'initialElectricChargeHours',T.batteryInitial,'number',item.electricCapacityHours??item.autonomyHours??24);
   addInput(fields,item,'rechargeHoursPerHour',T.recharge,'number',4);
   const note=document.createElement('small');note.textContent=T.batteryNote;fields.append(note);
  }
 };
 launcher();root.FHExteriorEditor=Object.freeze({open,drawGrid});
})(window);
