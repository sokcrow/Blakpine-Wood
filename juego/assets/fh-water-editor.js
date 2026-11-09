/* Selector de Agua 01 para el editor existente.
 * Mantiene forest-horror-map-v1 y agrega únicamente utilitySkin opcional.
 * Los tipos siguen siendo FHServices.water_main/valve/outlet/drain_outlet.
 */
(function(){
 'use strict';
 const models=window.FHWaterCatalog?.models||[];
 const T=window.FH_WATER_TEXT||{};if(models.length!==8)return;
 const byId=id=>models.find(m=>m.id===id)||null;
 const base=new URL('./forest-horror/biblioteca/agua/',document.baseURI);
 const active={};let opener=null;
 const css=document.createElement('style');css.textContent=`
 #fhWaterPicker[hidden]{display:none!important}#fhWaterPicker{position:fixed;inset:0;z-index:140;background:#020609dd;display:grid;place-items:center;padding:12px}
 #fhWaterPicker .panel{background:#17272b;border:2px solid #719a9d;color:#e8e6d8;width:min(850px,100%);max-height:92dvh;display:flex;flex-direction:column;padding:14px;gap:10px}
 #fhWaterPicker .head{display:flex;justify-content:space-between;align-items:center;gap:10px}#fhWaterPicker h2{margin:0;font:700 18px system-ui}
 #fhWaterPicker button{cursor:pointer;color:#e8e6d8;background:#263b40;border:1px solid #718c92;padding:8px}
 #fhWaterPicker button:focus-visible{outline:2px solid #f0d190;outline-offset:2px}
 #fhWaterPicker .choices{overflow:auto;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
 #fhWaterPicker .choices button{display:flex;flex-direction:column;gap:5px;text-align:left;min-width:0}
 #fhWaterPicker .choices button[aria-pressed=true],#fhWaterPicker .choices button:hover{border-color:#efce8d;background:#344c51}
 #fhWaterPicker img{display:block;width:100%;height:110px;object-fit:contain;image-rendering:pixelated;background:#1b2a2f}
 #fhWaterPicker strong{font:700 12px/1.4 system-ui}#fhWaterPicker small,#fhWaterPicker p{color:#bdd0c9;font:12px/1.4 system-ui;margin:0}
 @media(max-width:600px){#fhWaterPicker .choices{grid-template-columns:repeat(2,minmax(0,1fr))}#fhWaterPicker img{height:90px}#fhWaterPicker .panel{padding:9px}}`;
 document.head.append(css);
 const modal=document.createElement('div');modal.id='fhWaterPicker';modal.hidden=true;
 const pane=document.createElement('section');pane.className='panel';pane.setAttribute('role','dialog');pane.setAttribute('aria-modal','true');pane.setAttribute('aria-label',T.title||'Agua');
 const header=document.createElement('div');header.className='head';
 const title=document.createElement('h2');title.textContent=T.title||'Agua y drenaje';
 const close=document.createElement('button');close.type='button';close.textContent=T.close||'Cerrar';header.append(title,close);
 const list=document.createElement('div');list.className='choices';const note=document.createElement('p');note.textContent=T.note||'';
 pane.append(header,list,note);modal.append(pane);document.body.append(modal);
 function hide(){modal.hidden=true;opener?.focus?.();}close.onclick=hide;
 modal.addEventListener('click',e=>{if(e.target===modal)hide();});
 modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();hide();}});
 function structuralMount(p,rotation,wallId){
  const mount=ForestShared.switchWallMount(current().items,p,{maxDistance:.55,
   ...(rotation===undefined?{}:{rotation}),...(wallId?{wallId}:{})});
  return mount&&['wall','red_wall','property_wall'].includes(current().items.find(w=>w.id===mount.wallId)?.type)?mount:null;
 }
 function setSkin(item,meta,position){
  if(!item||meta.type!==item.type)return false;
  const previousSkin=item.utilitySkin;
  const feet=Number(project.units?.feetPerCell)||5;
  if(meta.mount==='wall'){
   const m=structuralMount(position||{x:item.x,y:item.y},position?undefined:item.rotation,position?undefined:item.wallId);
   if(!m){toast(T.wallRequired||'Se requiere una pared estructural completa.');return false;}
   Object.assign(item,{x:m.point.x,y:m.point.y,rotation:m.rotation,wallId:m.wallId,roomId:m.room?.roomId||item.roomId||''});
  }else{
   // Para equipo de piso, desplazar hacia delante del muro antes de grabar.
   const p=window.FHWaterVisuals?.floorPlacement(item,meta,current().items,feet*0.3048);
   if(p){item.x=p.x;item.y=p.y;}
   delete item.wallId;
  }
  item.utilitySkin=meta.id;item.utilityMountHeightFt=meta.mount==='wall'?meta.mountHeightFt:0;
  item.utilityWidthFt=meta.widthFt;item.utilityHeightFt=meta.heightFt;item.utilityDepthFt=meta.depthFt;
  item.w=meta.widthFt/feet;item.h=meta.depthFt/feet;item.heightFt=meta.heightFt;
  item.blocksMovement=false;
  for(const [key,value] of Object.entries(meta.defaults||{})){
   if(position||item[key]===undefined)item[key]=value;
  }
  if(meta.id==='valvula_secundaria'&&item.parentNetworkId===undefined)item.parentNetworkId='principal';
  if(meta.id==='calentador_agua')item.service={...item.service,hotWaterSource:true};
  else if(previousSkin==='calentador_agua'&&item.service?.hotWaterSource===true){
   item.service={...item.service};delete item.service.hotWaterSource;
  }
  if(meta.id==='coladera_piso'||meta.id==='desague_pared')item.drainMode='automatic';
  if(!item.interact||item.interact.verb!=='use')item.interact={id:'utility_'+item.id,verb:'use',label:'Usar '+meta.name,effects:[]};
  return true;
 }
 function chooseModel(m){
  active[m.type]=m;hide();setCategory('water');chooseTool(m.type);
  toast((T.selected||'Seleccionado: ')+m.name);
 }
 function show(){
  opener=document.activeElement;modal.hidden=false;list.replaceChildren();
  for(const m of models){
   const card=document.createElement('button');card.type='button';card.setAttribute('aria-pressed',String(active[m.type]?.id===m.id));
   const pic=document.createElement('img');pic.alt='';pic.loading='lazy';pic.src=new URL(m.thumbnail,base).href;
   const title=document.createElement('strong');title.textContent=m.name;
   const where=document.createElement('small');where.textContent=m.mount==='floor'?(T.floor||'Piso'):(T.wall||'Pared');
   card.append(pic,title,where);card.onclick=()=>chooseModel(m);list.append(card);
  }
  list.querySelector('button')?.focus();
 }
 function launcher(){
  const tools=document.querySelector('#tools');if(!tools||activeCategory!=='water')return;
  let button=document.getElementById('fhWaterLauncher');if(button)return;
  button=document.createElement('button');button.id='fhWaterLauncher';button.type='button';button.title=T.title||'Agua';
  const icon=document.createElement('span');icon.className='sym';icon.textContent='◉';
  const label=document.createElement('span');label.textContent=T.pick||'Modelos de agua';
  button.append(icon,label);button.onclick=show;tools.append(button);
 }
 const previousCategory=setCategory;
 setCategory=function(category){previousCategory(category);launcher();};
 const previousCreate=createObject;
 createObject=function(type,p){
  const meta=active[type];
  if(meta?.mount==='wall'&&!structuralMount(p)){
   toast(T.wallRequired||'Se necesita una pared estructural.');return null;
  }
  // El editor base exige una pared incluso para drain_outlet y water_outlet;
  // para modelos explícitos de piso construimos el objeto base sin esa restricción.
  const floor=meta?.mount==='floor';
  let item;
  if(floor){
   // Evitar que un selector eléctrico de 'misc' intercepte calentadores/coladeras.
   window.__fhWaterCreatingFloor=true;
   try{item=previousCreate('misc',p);}finally{window.__fhWaterCreatingFloor=false;}
  }else item=previousCreate(type,p);
  if(!item)return null;
  if(floor){
   item.type=type;delete item.modelId;delete item.utilitySkin;
   Object.assign(item,window.FHServices?.defaultsFor(type)||{});
   item.label=window.FH_SERVICES_TEXT?.labels?.[type]||meta.name;
   item.interact={id:'utility_'+item.id,verb:'use',label:'Usar '+item.label,effects:[]};
  }
  if(meta&&!setSkin(item,meta,p))return null;
  return item;
 };
 const previousInspector=openInspector;
 openInspector=function(){
  previousInspector();const it=current().items.find(x=>x.id===selection);if(!it)return;
  const currentMeta=window.FHWaterVisuals?.choose(it);
  if(!currentMeta)return;
  const fields=document.querySelector('#fields');if(!fields)return;
  const label=document.createElement('label');label.textContent=T.choose||'Modelo de agua';label.style.gridColumn='1/-1';
  const select=document.createElement('select');select.style.width='100%';
  for(const m of models.filter(m=>m.type===it.type)){
   const op=document.createElement('option');op.value=m.id;op.textContent=m.name;select.append(op);
  }
  select.value=currentMeta.id;const previous=currentMeta.id;
  select.onchange=()=>{
   const meta=byId(select.value);if(!meta)return;
   if(window.FHStyleEditor&&!window.FHStyleEditor.canEditItem(it)){
    toast(T.noPermission||'No tienes permiso para cambiar este modelo.');select.value=previous;return;
   }
   if(setSkin(it,meta)){record();render();openInspector();}else select.value=previous;
  };
  label.append(select);fields.append(label);
 };
 launcher();window.FHWaterEditor=Object.freeze({setSkin,show});
})();
