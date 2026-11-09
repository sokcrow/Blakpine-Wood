/* Selector de Internet 01. Solo tipo router/ethernet_port/landline_phone.
 * Inyectado DESPUÉS del editor principal: ninguna regla nueva de conectividad.
 */
(function(){
 'use strict';
 const catalog=window.FHInternetCatalog?.models||[],T=window.FH_INTERNET_TEXT||{};
 if(!catalog.length)return;
 const byId=id=>catalog.find(m=>m.id===id);
 const base=new URL('./forest-horror/biblioteca/internet/',document.baseURI);
 const active={};let opener=null;
 const css=document.createElement('style');
 css.textContent='#fhInternetPicker[hidden]{display:none!important}#fhInternetPicker{position:fixed;inset:0;z-index:120;display:grid;place-items:center;background:#020609dc;padding:12px}#fhInternetPicker .panel{background:#19242a;border:2px solid #6e9292;color:#e7e8dc;width:min(780px,100%);max-height:90dvh;padding:12px;display:flex;flex-direction:column;gap:12px}#fhInternetPicker h2{margin:0;font:700 17px system-ui}#fhInternetPicker .options{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;overflow:auto}#fhInternetPicker .options button{background:#26343b;border:1px solid #5b777a;color:#e6e7da;cursor:pointer;text-align:left;padding:8px}#fhInternetPicker .options button[aria-pressed=true]{border-color:#e3c78d}#fhInternetPicker img{width:100%;height:114px;object-fit:contain;image-rendering:pixelated}#fhInternetPicker strong{display:block;font:700 12px system-ui}#fhInternetPicker p{font:12px system-ui;color:#b6c6c2}';document.head.appendChild(css);
 const modal=document.createElement('div');modal.id='fhInternetPicker';modal.hidden=true;
 const panel=document.createElement('section');panel.className='panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
 const header=document.createElement('div');header.style.cssText='display:flex;justify-content:space-between;align-items:center';
 const title=document.createElement('h2');title.textContent=T.title||'Internet';
 const close=document.createElement('button');close.textContent=T.close||'Cerrar';close.type='button';
 const tiles=document.createElement('div');tiles.className='options';const note=document.createElement('p');note.textContent=T.note||'';
 header.append(title,close);panel.append(header,tiles,note);modal.append(panel);document.body.append(modal);
 function hide(){modal.hidden=true;opener?.focus?.();}close.onclick=hide;
 modal.addEventListener('click',e=>{if(e.target===modal)hide()});
 modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();hide()}});
 function setSkin(it,meta,p){
  if(!it||meta.type!==it.type)return false;
  const previousSkin=it.utilitySkin;
  const cell=Number(project.units?.feetPerCell)||5;
  const where=p||{x:it.x,y:it.y};
  if(meta.mount==='wall'){
   const wall=ForestShared.switchWallMount(current().items,where,{maxDistance:.55,...(!p?{rotation:it.rotation}:{})});
   if(!wall||!['wall','red_wall','property_wall'].includes(current().items.find(x=>x.id===wall.wallId)?.type)){
    toast(T.wallRequired||'Se necesita una pared estructural.');return false;
   }
   Object.assign(it,{x:wall.point.x,y:wall.point.y,rotation:wall.rotation,wallId:wall.wallId,
    roomId:wall.room?.roomId||it.roomId});
  }else{
   // Router de sobremesa: si se coloca justo sobre un muro, evitar penetración.
   // El margen se calcula desde la profundidad física del GLB, no del placeholder.
   const wall=ForestShared.switchWallMount(current().items,where,
    {maxDistance:(meta.depthFt/2+.35)/cell,...(it.wallId&&!p?{wallId:it.wallId,rotation:it.rotation}:{})});
   if(wall&&['wall','red_wall','property_wall'].includes(current().items.find(x=>x.id===wall.wallId)?.type)){
    const dx=where.x-wall.point.x,dy=where.y-wall.point.y;
    const along=dx*wall.normal.x+dy*wall.normal.y;
    const min=(meta.depthFt/2+.25)/cell;
    if(along<min){it.x=wall.point.x+wall.normal.x*min;it.y=wall.point.y+wall.normal.y*min;}
   }
   delete it.wallId;
  }
  it.utilitySkin=meta.id;
  it.utilityMountHeightFt=meta.mountHeightFt;
  it.utilityWidthFt=meta.widthFt;
  it.utilityHeightFt=meta.heightFt;
  it.utilityDepthFt=meta.depthFt;
  it.w=meta.widthFt/cell;it.h=meta.depthFt/cell;
  it.blocksMovement=false;
  for(const [key,value] of Object.entries(meta.defaults||{})){
   if(it[key]===undefined)it[key]=value;
  }
  if(meta.type==='ethernet_port')it.portSlots=meta.id==='toma_rj45_doble'?2:1;
  if(meta.id==='gateway_red')it.ethernetPorts=5;
  else if(previousSkin==='gateway_red'&&it.ethernetPorts===5)delete it.ethernetPorts;
  if(meta.type==='router')it.service={...it.service,requiresPower:true};
  return true;
 }
 function show(type){
  const choices=catalog.filter(m=>m.type===type);if(!choices.length)return;
  opener=document.activeElement;modal.hidden=false;tiles.replaceChildren();
  for(const m of choices){
   const b=document.createElement('button');b.type='button';b.setAttribute('aria-pressed',String(active[type]?.id===m.id));
   const image=document.createElement('img');image.src=new URL(m.thumbnail,base).href;image.alt='';
   const label=document.createElement('strong');label.textContent=m.name;
   const caption=document.createElement('p');caption.textContent=m.mount==='wall'?(T.wall||'Pared'):(T.floor||'Piso o mueble');
   b.append(image,label,caption);b.onclick=()=>{active[type]=m;hide();toast((T.selected||'Modelo seleccionado: ')+m.name)};tiles.append(b);
  }
  tiles.querySelector('button')?.focus();
 }
 const oldChoose=chooseTool;
 chooseTool=function(tool){oldChoose(tool);if(['router','ethernet_port','landline_phone'].includes(tool))show(tool);};
 const oldCreate=createObject;
 createObject=function(type,p){
  const m=active[type]||byId(window.FHInternetVisuals?.DEFAULT[type]);
  if(m?.mount==='wall'){
   const mount=ForestShared.switchWallMount(current().items,p,{maxDistance:.55});
   if(!mount||!['wall','red_wall','property_wall'].includes(current().items.find(x=>x.id===mount.wallId)?.type)){
    toast(T.wallRequired||'Se necesita una pared estructural.');return null;
   }
  }
  const item=oldCreate(type,p);
  if(item&&m)setSkin(item,m,p);
  return item;
 };
 const oldInspector=openInspector;
 openInspector=function(){
  oldInspector();const item=current().items.find(v=>v.id===selection);
  if(!item||!['router','ethernet_port','landline_phone'].includes(item.type))return;
  const fields=document.getElementById('fields');if(!fields)return;
  const label=document.createElement('label');label.textContent=T.choose||'Modelo 3D del dispositivo';
  label.style.gridColumn='1/-1';const select=document.createElement('select');select.style.width='100%';
  for(const meta of catalog.filter(m=>m.type===item.type)){
   const option=document.createElement('option');option.value=meta.id;option.textContent=meta.name;select.append(option);
  }
  select.value=byId(item.utilitySkin)?.type===item.type?item.utilitySkin:window.FHInternetVisuals.DEFAULT[item.type];
  const before=select.value;
  select.onchange=()=>{
   const meta=byId(select.value);if(!meta)return;
   if(window.FHStyleEditor&&!window.FHStyleEditor.canEditItem(item)){toast(T.noPermission||'No tienes permiso para modificarlo.');select.value=before;return;}
   if(setSkin(item,meta)){record();render();openInspector();}else select.value=before;
  };
  label.append(select);fields.append(label);
 };
 window.FHInternetEditor=Object.freeze({setSkin,show});
})();
