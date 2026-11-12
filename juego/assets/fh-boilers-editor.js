/* Blakpine-Wood — selector y propiedades técnicas Agua 04.
 * Configura datos del mapa: la simulación permanece en FHWaterHot.
 */
(function(root){
 'use strict';
 const models=root.FHBoilersCatalog?.models||[];
 const T=root.FH_BOILERS_TEXT||{};
 if(!models.length)return;
 let selected=null,opener=null;
 const css=document.createElement('style');
 css.textContent=`
 #fhBoilersPicker[hidden]{display:none!important}
 #fhBoilersPicker{position:fixed;inset:0;z-index:142;background:#050709e8;display:grid;place-items:center;padding:12px}
 #fhBoilersPicker .fhBoilerPanel{width:min(860px,100%);max-height:92dvh;overflow:auto;background:#171d22;border:2px solid #88979d;padding:15px;color:#f4efe8}
 #fhBoilersPicker .fhBoilerHead{display:flex;justify-content:space-between;gap:12px;align-items:center}
 #fhBoilersPicker .fhBoilerGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
 #fhBoilersPicker button{background:#29343b;color:#f3f0e8;border:1px solid #829097;padding:10px;cursor:pointer;text-align:left}
 #fhBoilersPicker button[aria-pressed=true]{border-color:#e4bb80}
 #fhBoilersPicker button:focus-visible{outline:2px solid #fff4ce;outline-offset:2px}
 #fhBoilersPicker small{display:block;font-size:11px;margin-top:6px;color:#c4c8c7}
 @media(max-width:600px){#fhBoilersPicker .fhBoilerGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
 `;
 document.head.append(css);
 const modal=document.createElement('div');modal.id='fhBoilersPicker';modal.hidden=true;
 const panel=document.createElement('section');panel.className='fhBoilerPanel';panel.setAttribute('role','dialog');
 panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',T.picker||'Calderas');
 const heading=document.createElement('div');heading.className='fhBoilerHead';
 const title=document.createElement('h2');title.textContent=T.picker||'Calderas y agua caliente';
 const close=document.createElement('button');close.type='button';close.textContent=T.close||'Cerrar';
 heading.append(title,close);
 const grid=document.createElement('div');grid.className='fhBoilerGrid';
 const hint=document.createElement('p');hint.textContent=T.hint||'Instalación de agua caliente.';
 panel.append(heading,grid,hint);modal.append(panel);document.body.append(modal);
 function hide(){modal.hidden=true;opener?.focus?.();}
 close.onclick=hide;
 modal.addEventListener('click',e=>{if(e.target===modal)hide();});
 modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();hide();}});
 function show(){
  opener=document.activeElement;modal.hidden=false;grid.replaceChildren();
  for(const m of models){
   const button=document.createElement('button');button.type='button';
   button.setAttribute('aria-pressed',String(selected?.id===m.id));
   const name=document.createElement('strong');name.textContent=m.name;
   const info=document.createElement('small');info.textContent=m.widthFt+' × '+m.heightFt+' × '+m.depthFt+' pies · '+
    (m.kind==='heater'?'Agua caliente':'Accesorio técnico');
   const pending=document.createElement('small');pending.textContent=T.assetPending||'GLB pendiente';
   button.append(name,info,pending);
   button.onclick=()=>{selected=m;hide();setCategory('water');chooseTool('misc');toast('Seleccionado: '+m.name);};
   grid.append(button);
  }
  grid.querySelector('button')?.focus();
 }
 function launcher(){
  if(activeCategory!=='water'||document.getElementById('fhBoilersLauncher'))return;
  const tools=document.getElementById('tools');if(!tools)return;
  const button=document.createElement('button');button.id='fhBoilersLauncher';
  button.type='button';button.textContent=T.picker||'Calderas y agua caliente';button.onclick=show;tools.append(button);
 }
 const oldCategory=setCategory;
 setCategory=function(cat){oldCategory(cat);launcher();};
 const oldCreate=createObject;
 createObject=function(type,pos){
  if(type!=='misc'||activeCategory!=='water'||!selected)return oldCreate(type,pos);
  const model=selected,cell=Math.max(.1,Number(project.units?.feetPerCell)||5);
  let mount=null;
  if(model.placement==='wall'){
   mount=ForestShared.switchWallMount(current().items,pos,{maxDistance:.55});
   if(!mount||!['wall','red_wall','property_wall'].includes(current().items.find(w=>w.id===mount.wallId)?.type)){
    toast('Este equipo necesita una pared estructural.');return null;
   }
  }
  root.__fhBoilerCreating=true;root.__fhWaterCreatingFloor=true;
  let item;
  try{item=oldCreate('misc',mount?.point||pos);}
  finally{root.__fhBoilerCreating=false;root.__fhWaterCreatingFloor=false;}
  if(!item)return null;
  item.type='misc';item.modelId=model.id;item.label=model.name;
  item.placement=model.placement;item.w=model.widthFt/cell;item.h=model.depthFt/cell;
  item.heightFt=model.heightFt;item.blocksMovement=model.placement==='floor';
  if(mount){
   Object.assign(item,{x:mount.point.x,y:mount.point.y,wallId:mount.wallId,
    rotation:mount.rotation,mountHeightFt:model.mountHeightFt||0});
  }
  if(model.kind==='heater'){
   const preset=root.FHWaterHot?.PRESETS[model.id]||{};
   item.service={...item.service,requiresPower:true,requiresWater:true,waterHeating:true,
    onDemand:true,watts:preset.watts||1200};
   item.boilerCapacityLiters=preset.capacityLiters||model.capacityLiters;
   item.initialHotLiters=0;item.targetTemperatureC=55;item.heatCPerMinute=preset.heatCPerMinute||1;
   item.fillLpm=preset.fillLpm||12;item.hotRangeFt=240;
   item.networkId='main';item.hotNetworkId='main';item.pipeLeadFt=10;
   project.plumbing={...project.plumbing,enabled:true};
   item.interact={id:'utility_'+item.id,verb:'use',label:'Inspeccionar '+model.name,effects:[]};
  }
  return item;
 };
 function numberField(fields,it,key,label,fallback,min=0,max=99999){
  const container=document.createElement('label');container.textContent=label;
  const input=document.createElement('input');input.type='number';input.min=String(min);
  input.max=String(max);input.step='any';input.value=String(it[key]??fallback);
  input.onchange=()=>{
   if(root.FHStyleEditor&&!root.FHStyleEditor.canEditItem(it)){openInspector();return;}
   setItemField(it.id,key,Math.max(min,Math.min(max,Number(input.value)||0)));
  };
  container.append(input);fields.append(container);
 }
 function textField(fields,it,key,label,fallback='main'){
  const container=document.createElement('label');container.textContent=label;
  const input=document.createElement('input');input.value=it[key]||fallback;
  input.onchange=()=>{
   if(root.FHStyleEditor&&!root.FHStyleEditor.canEditItem(it)){openInspector();return;}
   setItemField(it.id,key,input.value.trim()||fallback);
  };
  container.append(input);fields.append(container);
 }
 const previousInspector=openInspector;
 openInspector=function(){
  previousInspector();
  const it=current().items.find(x=>x.id===selection);
  if(!it)return;
  const fields=document.getElementById('fields');if(!fields)return;
  if(it.type==='water_outlet'){
   const holder=document.createElement('label');holder.style.gridColumn='1/-1';
   const cb=document.createElement('input');cb.type='checkbox';
   cb.checked=it.hotWaterEnabled===true||it.utilitySkin==='toma_agua_doble';
   cb.onchange=()=>{if(root.FHStyleEditor&&!root.FHStyleEditor.canEditItem(it)){openInspector();return;}
    setItemField(it.id,'hotWaterEnabled',cb.checked);};
   holder.append(cb,document.createTextNode(' '+(T.hotEnabled||'Toma doble de agua')));
   fields.append(holder);
   textField(fields,it,'hotNetworkId',T.outlet||'Red caliente');
   const info=document.createElement('div');info.style.gridColumn='1/-1';
   const status=utilityVisual().runtime?.hotWaterStatus(project.floors.indexOf(current()),it);
   info.textContent=(T.connection?T.connection(status||{}):'');
   fields.append(info);
  }
  const model=root.FHBoilersCatalog?.byId(it.modelId);
  if(!model)return;
  const note=document.createElement('div');note.style.gridColumn='1/-1';
  note.textContent=model.kind==='heater'?'Caldera de agua caliente (calentamiento eléctrico).':
   (T.assetPending||'Accesorio visual');fields.append(note);
  if(model.kind!=='heater')return;
  const preset=root.FHWaterHot?.PRESETS[model.id]||{};
  numberField(fields,it,'boilerCapacityLiters',T.capacity||'Capacidad (litros)',preset.capacityLiters||80);
  numberField(fields,it,'initialHotLiters',T.initial||'Reserva inicial',0);
  numberField(fields,it,'targetTemperatureC',T.temperature||'Temperatura (°C)',55,30,90);
  numberField(fields,it,'heatCPerMinute',T.heatingRate||'Calentamiento (°C/min)',preset.heatCPerMinute||1);
  numberField(fields,it,'fillLpm',T.fillRate||'Llenado (L/min)',preset.fillLpm||12);
  numberField(fields,it,'hotRangeFt',T.range||'Tuberías calientes (pies)',240);
  textField(fields,it,'networkId',T.inlet||'Red fría');
  textField(fields,it,'hotNetworkId',T.outlet||'Red caliente');
  numberField(fields,it,'pipeLeadFt','Conexión hasta la pared (pies)',10);
  const report=document.createElement('div');report.style.gridColumn='1/-1';
  const status=utilityVisual().runtime?.hotWaterStatus(project.floors.indexOf(current()),it);
  report.textContent=T.report?T.report(status||{}):'';
  fields.append(report);
 };
 launcher();
 root.FHBoilersEditor=Object.freeze({show,selected:()=>selected?.id||''});
})(window);
