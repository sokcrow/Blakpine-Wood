/* Electricidad 02: autoría de modelos y enlaces; el suministro vive en FHServices. */
(function(global){
 'use strict';
 const T=global.FH_SERVICES_TEXT.generator;
 const base=new URL('../../forest-horror/biblioteca/',document.currentScript.src);
 let models=[],pending=null,selected=null,opener=null;
 function setModel(item,model,mount=null){
  if(!item||!model||item.type!==model.type)return false;
  if(model.placement==='wall'&&!mount)return false;
  const feet=Math.max(.1,Number(project.units.feetPerCell)||5);
  Object.assign(item,{modelId:model.id,label:model.name,w:model.widthFt/feet,h:model.depthFt/feet,
   heightFt:model.heightFt,placement:model.placement,mountHeightFt:model.mountHeightFt||0,
   blocksMovement:model.blocksMovement!==false});
  if(mount)Object.assign(item,{x:mount.point.x,y:mount.point.y,rotation:mount.rotation,wallId:mount.wallId,
   roomId:mount.room?.roomId||mount.room?.id||item.roomId||''});
  return true;
 }
 function mountFor(item,point){
  const mount=ForestShared.switchWallMount(current().items,point||{x:item.x,y:item.y},
   {maxDistance:.55,...(!point?{rotation:item.rotation,wallId:item.wallId}:{} )});
  return mount&&['wall','red_wall','property_wall'].includes(current().items.find(w=>w.id===mount.wallId)?.type)?mount:null;
 }
 function load(){
  if(!pending)pending=fetch(new URL('generadores/catalogo_generadores.json',base)).then(r=>{
   if(!r.ok)throw Error(T.loadError);return r.json();
  }).then(doc=>{
   if(doc.schema!=='forest-horror-furniture-catalog-v1'||doc.furniture?.length!==8)throw Error(T.loadError);
   models=doc.furniture;return models;
  }).catch(e=>{pending=null;throw e;});
  return pending;
 }
 const style=document.createElement('style');style.textContent=`
 #fhGeneratorPicker[hidden]{display:none!important}#fhGeneratorPicker{position:fixed;inset:0;background:#020609df;z-index:138;display:grid;place-items:center;padding:12px}
 #fhGeneratorPicker section{background:#172227;color:#eee9db;border:2px solid #738889;width:min(850px,100%);max-height:92dvh;overflow:auto;padding:14px}
 #fhGeneratorPicker header{display:flex;align-items:center;justify-content:space-between;gap:12px}#fhGeneratorPicker h2{font:700 18px system-ui}
 #fhGeneratorPicker .models{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
 #fhGeneratorPicker button{background:#29383d;color:inherit;border:1px solid #748483;padding:8px;cursor:pointer}
 #fhGeneratorPicker button:focus-visible{outline:2px solid #e7bd81;outline-offset:2px}#fhGeneratorPicker img{width:100%;height:110px;object-fit:contain;image-rendering:pixelated}
 #fhGeneratorPicker strong,#fhGeneratorPicker small{display:block;font:12px/1.4 system-ui}#fhGeneratorPicker strong{font-weight:700}
 @media(max-width:600px){#fhGeneratorPicker .models{grid-template-columns:repeat(2,minmax(0,1fr))}}
 `;document.head.append(style);
 const overlay=document.createElement('div');overlay.id='fhGeneratorPicker';overlay.hidden=true;
 const panel=document.createElement('section');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',T.picker);
 const header=document.createElement('header'),title=document.createElement('h2'),close=document.createElement('button');
 title.textContent=T.picker;close.textContent=T.close;close.type='button';header.append(title,close);
 const choices=document.createElement('div');choices.className='models';panel.append(header,choices);overlay.append(panel);document.body.append(overlay);
 function hide(){overlay.hidden=true;opener?.focus?.();}close.onclick=hide;
 overlay.addEventListener('click',e=>{if(e.target===overlay)hide();});
 overlay.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.stopPropagation();hide();}
  if(e.key==='Tab'){
   const buttons=[...panel.querySelectorAll('button')],first=buttons[0],last=buttons.at(-1);
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
 });
 async function open(){
  opener=document.activeElement;overlay.hidden=false;choices.textContent=T.loading;close.focus();
  try{
   await load();choices.replaceChildren();
   for(const model of models){
    const button=document.createElement('button');button.type='button';
    const img=document.createElement('img');img.alt='';img.src=new URL(model.thumbnail,base).href;
    const name=document.createElement('strong');name.textContent=model.name;
    const size=document.createElement('small');size.textContent=`${model.widthFt} × ${model.heightFt} × ${model.depthFt} ${T.feet}`;
    button.append(img,name,size);button.onclick=()=>{selected=model;chooseTool(model.type==='generator'&&model.generatorRole==='emergency'?'generator_emergency':model.type);hide();};choices.append(button);
   }
  }catch(error){choices.textContent=T.loadError;console.warn('[Generadores]',error);}
 }
 function launcher(){
  const tools=document.querySelector('#tools');if(!tools||activeCategory!=='lighting'||document.getElementById('fhGeneratorLauncher'))return;
  const button=document.createElement('button');button.id='fhGeneratorLauncher';button.type='button';button.textContent=T.picker;button.onclick=open;tools.append(button);
 }
 const priorCategory=setCategory;setCategory=function(category){priorCategory(category);launcher();};
 const priorCreate=createObject;
 createObject=function(type,point){
  const effective=type==='generator_emergency'?'generator':type;
  const defaults={generator:'generador_portatil',generator_emergency:'generador_emergencia_compacto',generator_ats:'tablero_transferencia_automatica',generator_tank:'tanque_combustible_generador'};
  const model=selected?.type===effective&&(effective!=='generator'||(type==='generator_emergency')===(selected.generatorRole==='emergency'))?
   selected:models.find(m=>m.id===defaults[type]);
  let mount=null;
  if(effective==='generator_ats'){
   mount=mountFor({},point);if(!mount){toast(T.wallRequired);return null;}
  }
  const item=priorCreate(type,point);if(item&&model)setModel(item,model,mount);
  return item;
 };
 function canEdit(item){return !global.FHStyleEditor||global.FHStyleEditor.canEditItem(item);}
 function attachPanelInspector(panel,fields){
  const P=global.FH_SERVICES_TEXT.powerSource,owner=current();
  const heading=document.createElement('strong');heading.textContent=P.title;heading.style.gridColumn='1/-1';fields.append(heading);
  for(const [key,label,emergency] of [['powerSource',P.primary,false],['backupSource',P.backup,true]]){
   const holder=document.createElement('label');holder.textContent=label;
   const select=document.createElement('select');
   const add=(ref,text)=>{const option=document.createElement('option');option.value=JSON.stringify(ref);option.textContent=text;select.append(option);};
   add({kind:'none'},P.none);if(!emergency)add({kind:'utility'},P.utility);
   for(const floor of project.floors)for(const gen of floor.items.filter(it=>it.type==='generator'&&(it.generatorKind==='emergency')===emergency))
    add({kind:'generator',floorId:floor.id,itemId:gen.id},(floor.name||floor.id)+' · '+(gen.label||gen.id));
   const ref=panel[key]||(key==='powerSource'?{kind:'utility'}:{kind:'none'}),value=JSON.stringify(ref);
   if(![...select.options].some(o=>o.value===value))add(ref,P.missing+' · '+(ref.itemId||''));
   select.value=value;select.onchange=()=>{
    if(key==='backupSource'&&panel.powerSource===undefined)setItemField(panel.id,'powerSource',{kind:'utility'});
    setItemField(panel.id,key,JSON.parse(select.value));openInspector();
   };holder.append(select);fields.append(holder);
  }
  fields.append(makeField(P.feedRange,'sourceCableFt',panel.sourceCableFt??90,'number'));
  const status=utilityVisual().runtime?.panelStatus(project.floors.indexOf(owner),panel);
  const report=document.createElement('div');report.style.cssText='grid-column:1/-1;white-space:pre-line';
  report.textContent=(status?.legacy?P.legacy:P.hint)+'\n'+(status?.circuits||[]).map(c=>{
   const f=project.floors.find(f=>f.id===c.floorId),source=c.source.kind==='generator'?c.source.label:c.source.kind==='utility'?P.utility:P.missing;
   return c.zoneId+' · '+(c.powered?P.on:P.off)+'\n'+P.origin(source,c.source.floorId||owner.id)+'\n'+P.route(f?.name||c.floorId,c.verticalFt,c.rangeFt)+'\n'+P.feed(c.sourceFeet);
  }).join('\n');fields.append(report);
 }
 function attachCircuitFields(panel,spec,card){
  const P=global.FH_SERVICES_TEXT.powerSource;
  const holder=document.createElement('label');holder.textContent=P.floor;const select=document.createElement('select');
  for(const floor of project.floors){const option=document.createElement('option');option.value=floor.id;option.textContent=floor.name||floor.id;select.append(option);}
  select.value=spec.floorId||current().id;
  select.onchange=()=>{if(!canEdit(panel)){openInspector();return;}spec.floorId=select.value;delete spec.floorIndex;if(panel.powerSource===undefined)panel.powerSource={kind:'utility'};record();openInspector();};
  holder.append(select);card.append(holder);
  for(const [key,label,value] of [['rangeFt',P.range,spec.rangeFt??global.FHServices.rangeFor(panel,spec)],['priority',P.priority,spec.priority??0]]){
   const row=document.createElement('label');row.textContent=label;const input=document.createElement('input');input.type='number';input.value=value;
   input.onchange=()=>{if(!canEdit(panel)){openInspector();return;}spec[key]=Math.max(0,Number(input.value)||0);record();openInspector();};row.append(input);card.append(row);
  }
 }
 function drawPanelSources(c,z){
  const P=global.FH_SERVICES_TEXT.powerSource,runtime=utilityVisual().runtime;
  c.save();c.lineWidth=2/z;c.setLineDash([5/z,3/z]);c.font=(11/z)+'px system-ui';
  for(const floor of project.floors)for(const panel of floor.items.filter(it=>it.type==='breaker_panel')){
   if(current()===floor)for(const spec of panel.circuits||[]){
    const target=project.floors.find(f=>f.id===spec.floorId);if(!target||target===floor)continue;
    const point=toPixel(panel);c.fillStyle='#e9c66c';c.fillText(P.vertical(target.name||target.id),point.x+7/z,point.y+14/z);
   }
   for(const [key,color] of [['powerSource','#e9c66c'],['backupSource','#83c8ac']]){
    const ref=panel[key];if(ref?.kind!=='generator')continue;
    const sourceFloor=project.floors.find(f=>f.id===ref.floorId),gen=sourceFloor?.items.find(it=>it.type==='generator'&&it.id===ref.itemId);
    if(!gen||current()!==floor&&current()!==sourceFloor)continue;
    const status=runtime?.panelStatus(project.floors.indexOf(floor),panel);
    const live=status?.circuits.some(c=>c.powered&&c.source.itemId===gen.id&&c.source.floorId===sourceFloor.id);
    const a=toPixel(gen),b=toPixel(panel);c.strokeStyle=live?color:'#777e88';c.fillStyle=live?color:'#777e88';
    c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,a.y);c.lineTo(b.x,b.y);c.stroke();
    const text=(gen.label||gen.id)+' → '+(panel.label||panel.id)+(floor!==sourceFloor?' · '+P.vertical((current()===floor?sourceFloor:floor).name):'');
    c.fillText(text,(a.x+b.x)/2+5/z,(a.y+b.y)/2-6/z);
   }
  }
  c.restore();
 }
 function attachInspector(item,fields){
  if(item.type==='breaker_panel'){attachPanelInspector(item,fields);return;}
  if(!['generator','generator_ats','generator_tank'].includes(item.type))return;
  if(models.length){
   const holder=document.createElement('label');holder.textContent=T.chooseModel;
   const select=document.createElement('select'),none=document.createElement('option');none.value='';none.textContent=T.noLink;select.append(none);
   for(const model of models.filter(m=>m.type===item.type)){
    const option=document.createElement('option');option.value=model.id;option.textContent=model.name;select.append(option);
   }
   select.value=item.modelId||'';
   select.onchange=()=>{
    if(global.FHStyleEditor&&!global.FHStyleEditor.canEditItem(item)){select.value=item.modelId||'';toast(global.FH_SERVICES_TEXT.invalidLink);return;}
    const model=models.find(m=>m.id===select.value);if(!model){select.value=item.modelId||'';return;}
    const mount=model.placement==='wall'?mountFor(item):null;
    if(setModel(item,model,mount)){record();render();openInspector();}else{toast(T.wallRequired);select.value=item.modelId||'';}
   };
   holder.append(select);fields.append(holder);
  }
  if(item.type==='generator'){
   for(const [prefix,type,label] of [['ats','generator_ats',T.atsLink],['tank','generator_tank',T.tankLink]]){
    if(prefix==='ats'&&item.generatorKind!=='emergency'&&!item.atsId)continue;
    const holder=document.createElement('label');holder.textContent=label;const select=document.createElement('select');
    const none=document.createElement('option');none.value='';none.textContent=T.noLink;select.append(none);
    const currentId=item[prefix+'Id'],floorId=item[prefix+'FloorId']||current().id;
    for(const floor of project.floors)for(const prop of floor.items.filter(x=>x.type===type)){
     const busy=project.floors.some(f=>f.items.some(g=>g!==item&&g.type==='generator'&&g[prefix+'Id']===prop.id&&(g[prefix+'FloorId']||f.id)===floor.id));
     if(busy)continue;
     const option=document.createElement('option');option.value=JSON.stringify({id:prop.id,floorId:floor.id});option.textContent=(floor.name||floor.id)+' · '+(prop.label||prop.id);select.append(option);
    }
    const value=currentId?JSON.stringify({id:currentId,floorId}):'';
    if(value&&![...select.options].some(o=>o.value===value)){const option=document.createElement('option');option.value=value;option.textContent=global.FH_SERVICES_TEXT.invalidLink+' · '+currentId;select.append(option);}
    select.value=value;select.onchange=()=>{setItemField(item.id,prefix+'Link',select.value?JSON.parse(select.value):null);openInspector();};holder.append(select);fields.append(holder);
   }
   fields.append(makeField(T.fuelRate,'fuelLitersPerHour',item.fuelLitersPerHour??1,'number'));
   const tankFloor=project.floors.find(f=>f.id===(item.tankFloorId||current().id));
   const tank=tankFloor?.items.find(t=>t.type==='generator_tank'&&t.id===item.tankId),rate=Math.max(0,Number(item.fuelLitersPerHour??1));
   if(tank){const estimate=document.createElement('small');estimate.textContent=T.estimate(rate>0?Math.min(Math.max(0,Number(tank.initialFuelLiters??tank.capacityLiters)||0),Math.max(0,Number(tank.capacityLiters)||0))/rate:0);fields.append(estimate);}
   const note=document.createElement('small');note.textContent=T.fuelNote;note.style.gridColumn='1/-1';fields.append(note);
  }else if(item.type==='generator_tank'){
   fields.append(makeField(T.fuelCapacity,'capacityLiters',item.capacityLiters??0,'number'),makeField(T.initialFuel,'initialFuelLiters',item.initialFuelLiters??item.capacityLiters??0,'number'));
  }else{const note=document.createElement('small');note.textContent=T.atsNote;note.style.gridColumn='1/-1';fields.append(note);}
 }
 load().catch(error=>console.warn('[Generadores]',error));launcher();
 global.FHGeneratorsEditor=Object.freeze({setModel,open,load,attachInspector,attachCircuitFields,drawPanelSources});
})(window);
