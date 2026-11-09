/* Electricidad 01 - selector acotado al editor actual.
 * El JSON conserva forest-horror-map-v1 y añade utilitySkin opcional.
 */
(function(){
 'use strict';
 const models=window.FHElectricCatalog?.models||[];
 const T=window.FH_ELECTRIC_TEXT||{};if(models.length!==8)return;
 const byId=id=>models.find(m=>m.id===id)||null;
 const base=new URL('./forest-horror/biblioteca/electricidad/',document.baseURI);
 const active={};let opener=null;
 const style=document.createElement('style');style.textContent=`
 #fhElectricPicker[hidden]{display:none!important}#fhElectricPicker{position:fixed;inset:0;z-index:135;background:#020609df;display:grid;place-items:center;padding:12px}
 #fhElectricPicker .body{background:#172227;border:2px solid #738889;color:#eee9db;max-height:94dvh;width:min(850px,100%);padding:15px;display:flex;flex-direction:column;gap:11px}
 #fhElectricPicker .head{display:flex;justify-content:space-between;align-items:center;gap:12px}
 #fhElectricPicker h2{margin:0;font:700 18px system-ui}#fhElectricPicker button{cursor:pointer;color:#eee9db;background:#29383d;border:1px solid #748483;padding:8px}
 #fhElectricPicker button:focus-visible{outline:2px solid #e7bd81;outline-offset:2px}
 #fhElectricPicker .models{overflow:auto;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
 #fhElectricPicker .models button{text-align:left;min-width:0;display:flex;flex-direction:column;gap:5px}
 #fhElectricPicker .models button:hover,#fhElectricPicker .models button[aria-pressed=true]{border-color:#e9bc73;background:#374442}
 #fhElectricPicker img{width:100%;height:116px;object-fit:contain;background:#202c30;image-rendering:pixelated}
 #fhElectricPicker strong{font:700 12px/1.3 system-ui}#fhElectricPicker small,#fhElectricPicker p{font:12px/1.4 system-ui;color:#c0c9bd;margin:0}
 #fhElectricLauncher{background:#33413f!important;border-color:#c2a576!important}
 @media(max-width:600px){#fhElectricPicker .models{grid-template-columns:repeat(2,minmax(0,1fr))}#fhElectricPicker img{height:90px}#fhElectricPicker .body{padding:9px}}`;
 document.head.appendChild(style);
 const overlay=document.createElement('div');overlay.id='fhElectricPicker';overlay.hidden=true;
 const panel=document.createElement('section');panel.className='body';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',T.title);
 const head=document.createElement('div');head.className='head';const title=document.createElement('h2');title.textContent=T.title||'Electricidad';
 const close=document.createElement('button');close.type='button';close.textContent=T.close||'Cerrar';head.append(title,close);
 const choices=document.createElement('div');choices.className='models';const note=document.createElement('p');note.textContent=T.note||'';
 panel.append(head,choices,note);overlay.append(panel);document.body.append(overlay);
 function hide(){overlay.hidden=true;opener?.focus?.();}close.onclick=hide;
 overlay.addEventListener('click',e=>{if(e.target===overlay)hide()});overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();hide();}});
 function structuralWall(p,rotation,wallId){
  const m=ForestShared.switchWallMount(current().items,p,{maxDistance:.55,
   ...(rotation!==undefined?{rotation}:{}),...(wallId?{wallId}:{})});
  return m&&['wall','red_wall','property_wall'].includes(current().items.find(w=>w.id===m.wallId)?.type)?m:null;
 }
 function setSkin(it,meta,point){
  if(!it||meta.type!==it.type)return false;
  if(meta.mount==='wall'){
   const m=structuralWall(point||{x:it.x,y:it.y},point?undefined:it.rotation,point?undefined:it.wallId);
   if(!m){toast(T.wallRequired||'Necesita una pared estructural.');return false;}
   Object.assign(it,{x:m.point.x,y:m.point.y,rotation:m.rotation,wallId:m.wallId,roomId:m.room?.roomId||it.roomId||''});
  }else if(meta.mount==='ceiling'){delete it.wallId;}
  it.utilitySkin=meta.id;it.utilityMountHeightFt=meta.mount==='ceiling'?0:meta.mountHeightFt;
  it.utilityWidthFt=meta.widthFt;it.utilityHeightFt=meta.heightFt;it.utilityDepthFt=meta.depthFt;
  const cell=Number(project.units?.feetPerCell)||5;
  it.w=meta.widthFt/cell;it.h=meta.depthFt/cell;it.blocksMovement=false;
  if(meta.type==='misc'){delete it.modelId;it.type='misc';it.placement='wall';
    it.interact={id:'electric_'+it.id,verb:'examine',label:'Revisar '+meta.name,effects:[]};}
  if(meta.type==='breaker_panel'){
   const defaults=meta.defaults||{};
   // Al cambiar el modelo no alterar circuitos, alcance ni capacidades del panel.
   if(point&&meta.id==='breaker_pequeno')it.breakerType='small';
   if(!it.breakerType)it.breakerType=defaults.breakerType;
   if(it.rangeFt===undefined)it.rangeFt=defaults.rangeFt;
   if(it.capacityWatts===undefined)it.capacityWatts=defaults.capacityWatts;
  }else for(const [key,value] of Object.entries(meta.defaults||{})){
   if(it[key]===undefined)it[key]=value;
  }
  return true;
 }
 function selectModel(meta){
  active[meta.type]=meta;
  // Las tres piezas con tipo misc usan el mueble libre de forma explícita.
  // No se altera el modelo genérico de todos los misc.
  if(meta.type==='misc')setCategory('furniture');else setCategory('lighting');
  chooseTool(meta.type);
  hide();toast((T.selected||'Seleccionado: ')+meta.name);
 }
 function open(){
  opener=document.activeElement;overlay.hidden=false;choices.replaceChildren();
  for(const m of models){
   const b=document.createElement('button');b.type='button';b.setAttribute('aria-pressed',String(active[m.type]?.id===m.id));
   const img=document.createElement('img');img.src=new URL(m.thumbnail,base).href;img.alt='';
   const title=document.createElement('strong');title.textContent=m.name;
   const where=document.createElement('small');where.textContent=m.mount==='ceiling'?(T.ceiling||'Techo'):(T.wall||'Pared');
   b.append(img,title,where);b.onclick=()=>selectModel(m);choices.append(b);
  }
  choices.querySelector('button')?.focus();
 }
 function launcher(){
  const container=document.querySelector('#tools');if(!container||activeCategory!=='lighting')return;
  let b=document.getElementById('fhElectricLauncher');if(b)return;
  b=document.createElement('button');b.id='fhElectricLauncher';b.type='button';b.title=T.title||'Electricidad';
  const sym=document.createElement('span');sym.className='sym';sym.textContent='⚡';
  const txt=document.createElement('span');txt.textContent=T.pickDecor||'Aparatos eléctricos';
  b.append(sym,txt);b.onclick=open;container.append(b);
 }
 const previousSetCategory=setCategory;
 setCategory=function(cat){previousSetCategory(cat);launcher();};
 const prevCreate=createObject;
 createObject=function(type,p){
  const meta=window.__fhWaterCreatingFloor?null:active[type];
  if(meta?.mount==='wall'&&!structuralWall(p)){
   toast(T.wallRequired||'Necesita una pared estructural.');return null;
  }
  const item=prevCreate(type,p);
  if(item&&meta&&meta.type==='misc'){item.type='misc';delete item.modelId;}
  if(item&&meta&&!setSkin(item,meta,p))return null;
  return item;
 };
 const previousInspector=openInspector;
 openInspector=function(){
  previousInspector();const item=current().items.find(it=>it.id===selection);
  if(!item)return;
  const recognized=byId(item.utilitySkin);
  if(!recognized||recognized.type!==item.type||item.type==='breaker_panel')return;
  const fields=document.getElementById('fields');if(!fields)return;
  const label=document.createElement('label');label.textContent=T.choose||'Apariencia del dispositivo';label.style.gridColumn='1/-1';
  const select=document.createElement('select');select.style.width='100%';
  for(const m of models.filter(m=>m.type===item.type)){
   const opt=document.createElement('option');opt.value=m.id;opt.textContent=m.name;select.append(opt);
  }
  select.value=recognized.id;const previous=recognized.id;
  select.onchange=()=>{
   const meta=byId(select.value);if(!meta)return;
   if(window.FHStyleEditor&&!window.FHStyleEditor.canEditItem(item)){
    toast(T.noPermission||'No tienes permiso para modificar este dispositivo.');select.value=previous;return;
   }
   if(setSkin(item,meta)){record();render();openInspector();}
   else select.value=previous;
  };
  label.append(select);fields.append(label);
 };
 launcher();window.FHElectricEditor=Object.freeze({setSkin,open});
})();
