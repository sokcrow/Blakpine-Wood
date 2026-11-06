/* Forest Horror: catálogo visual de puertas y ventanas para el editor 2D. */
(function(){
 'use strict';
 const T=window.FH_ARCHITECTURE_TEXT;
 const scriptUrl=new URL(document.currentScript?.src||'./juego/assets/fh-architecture-editor-catalog.js',document.baseURI);
 const base=new URL('../../forest-horror/biblioteca/arquitectura/',scriptUrl);
 const allowed=/^(puerta_madera|puerta_metal|puerta_mirilla|puerta_cristal_simple|puerta_cristal_antipanico|puerta_cristal_tintada|ventana_clasica|ventana_dividida)$/;
 let catalogPromise=null,models=[],openingTool='door',opener=null,lastDoorModel='puerta_madera';
 const active={door:'puerta_madera',peephole_door:'puerta_mirilla',window:'ventana_clasica'};
 const css=document.createElement('style');
 css.textContent='#fhArchCatalog[hidden]{display:none!important}#fhArchCatalog{position:fixed;inset:0;z-index:91;display:flex;align-items:center;justify-content:center;padding:12px;background:#05080de8}#fhArchCatalog .fhArchPanel{display:flex;flex-direction:column;gap:10px;width:min(680px,100%);max-height:92dvh;padding:14px;background:#131b25;border:2px solid #8a978d;box-shadow:0 18px 55px #000c;color:#f4eddd}#fhArchCatalog .fhArchTop{display:flex;align-items:center;justify-content:space-between;gap:10px}#fhArchCatalog h2{font:700 17px system-ui;margin:0}#fhArchCatalog p{font:12px/1.5 system-ui;margin:0;color:#d0d5d0}#fhArchCatalog .fhArchList{display:grid;grid-template-columns:repeat(auto-fill,minmax(125px,1fr));gap:8px;overflow-y:auto}#fhArchCatalog button:focus-visible,.fhArchInspector button:focus-visible{outline:3px solid #efca88;outline-offset:2px}.fhArchCard{display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0;padding:7px;background:#27323b;border:2px solid #56646a;border-radius:3px;color:#f7f0e4;text-align:center;cursor:pointer}.fhArchCard[aria-pressed=true]{border-color:#f1bf78;background:#3f3a31}.fhArchCard img{display:block;width:100%;height:94px;object-fit:contain;image-rendering:pixelated;background:#0e171e}.fhArchCard span{font:600 11px/1.35 system-ui}.fhArchCard small{font:11px system-ui;color:#e3ad86}.fhArchInspector{grid-column:1/-1;display:grid;gap:7px}.fhArchInspector>strong{font:700 12px system-ui}.fhArchInspector .fhArchList{display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:6px}.fhArchInspector .fhArchCard{padding:5px}.fhArchInspector .fhArchCard img{height:77px}@media(max-width:480px){#fhArchCatalog .fhArchList{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}#fhArchCatalog .fhArchCard img{height:74px}#fhArchCatalog .fhArchCard{padding:4px}}';
 document.head.append(css);
 const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
 const modal=el('div');modal.id='fhArchCatalog';modal.hidden=true;
 const panel=el('section');panel.className='fhArchPanel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
 const top=el('div');top.className='fhArchTop';
 const title=el('h2');title.id='fhArchTitle';panel.setAttribute('aria-labelledby',title.id);
 const closeButton=el('button',T.closeCatalog);closeButton.type='button';closeButton.onclick=close;
 const description=el('p',T.selectModel);
 const list=el('div');list.className='fhArchList';
 top.append(title,closeButton);panel.append(top,description,list);modal.append(panel);document.body.append(modal);
 function catalog(){
  if(!catalogPromise)catalogPromise=fetch(new URL('catalogo_arquitectura.json',base).href)
   .then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();})
   .then(doc=>{
    if(doc.schema!=='forest-horror-architecture-catalog-v1'||!Array.isArray(doc.architecture))throw Error('Catálogo inválido');
    models=doc.architecture.filter(m=>allowed.test(m.id)&&m.thumbnail==='miniaturas/'+m.id+'.png'&&['door','peephole_door','window'].includes(m.type));
    return models;
   }).catch(error=>{catalogPromise=null;throw error;});
  return catalogPromise;
 }
 function subset(tool){return models.filter(m=>tool==='door'?m.type==='door'||m.type==='peephole_door':m.type===tool);}
 function currentModel(it){
  if(it.type==='window')return it.windowSkin==='dividida'?'ventana_dividida':'ventana_clasica';
  if(it.type==='peephole_door')return 'puerta_mirilla';
  if(it.architectureSkin&&it.variant==='glass'&&allowed.test(it.architectureSkin))return it.architectureSkin;
  return it.variant==='metal'?'puerta_metal':it.variant==='glass'?'puerta_cristal_simple':'puerta_madera';
 }
 function modelCard(model,selected,onClick){
  const button=el('button');button.type='button';button.className='fhArchCard';
  button.setAttribute('aria-pressed',String(model.id===selected));button.title=model.name;
  const img=el('img');img.alt='';img.loading='lazy';img.src=new URL(model.thumbnail,base).href;
  img.onerror=()=>{img.hidden=true;button.append(el('small',T.imageUnavailable));};
  button.append(img,el('span',model.name));button.onclick=()=>onClick(model);
  return button;
 }
 function close(){modal.hidden=true;opener?.focus?.();}
 modal.addEventListener('click',e=>{if(e.target===modal)close();});
 modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}});
 function refreshToolbar(){
  for(const tool of ['door','peephole_door','window']){
   const button=document.querySelector('#tools button[data-tool="'+tool+'"]');
   if(!button)continue;
   const model=models.find(m=>m.id===active[tool]);
   if(!model)continue;
   button.title=model.name;
   const name=button.children[1],symbol=button.querySelector('.sym');
   if(name)name.textContent=model.name;
   if(symbol){const img=el('img');img.alt='';img.src=new URL(model.thumbnail,base).href;img.style.cssText='width:28px;height:28px;object-fit:contain;image-rendering:pixelated';symbol.replaceChildren(img);}
  }
 }
 function choosePlacement(model){
  const tool=model.type;
  active[tool]=model.id;
  if(tool==='door'||tool==='peephole_door')lastDoorModel=model.id;
  oldChooseTool(tool);
  refreshToolbar();
  close();
 }
 function show(tool){
  openingTool=tool;opener=document.activeElement;modal.hidden=false;
  title.textContent=tool==='window'?T.windowModels:T.doorModels;
  list.replaceChildren(el('p',T.loadingModels));closeButton.focus();
  catalog().then(()=>{
   if(modal.hidden||openingTool!==tool)return;
   const available=subset(tool);
   if(!available.length){list.replaceChildren(el('p',T.noModels));return;}
   list.replaceChildren(...available.map(m=>modelCard(m,tool==='door'?lastDoorModel:active[tool],choosePlacement)));
  }).catch(error=>{
   console.warn('[Forest Horror arquitectura catálogo]',error);
   if(modal.hidden||openingTool!==tool)return;
   const fallback=el('button',T.useOriginalTool);fallback.type='button';
   fallback.onclick=()=>{oldChooseTool(tool);close();};
   list.replaceChildren(el('p',T.catalogError),fallback);
  });
 }
 function applyModel(it,model){
  if(it.type==='window'){it.windowSkin=model.variant;return;}
  if(it.type==='peephole_door'){it.variant='wood';delete it.architectureSkin;return;}
  if(it.type==='door'){
   it.variant=model.variant;
   if(model.variant==='glass')it.architectureSkin=model.architectureSkin||model.id;
   else delete it.architectureSkin;
  }
 }
 function changeModel(it,model){
  if(window.FHStyleEditor&&!window.FHStyleEditor.canEditItem(it)){toast(T.notAllowed);return;}
  const original=JSON.parse(JSON.stringify(it));
  applyModel(it,model);
  const errors=['door','peephole_door'].includes(it.type)?ForestShared.doorErrors(it):[];
  if(errors.length){
   for(const key of Object.keys(it))delete it[key];
   Object.assign(it,original);toast(errors[0]);return;
  }
  record();openInspector();render();
 }
 function augmentInspector(){
  const it=current().items.find(item=>item.id===selection);
  if(!it||!['window','door','peephole_door'].includes(it.type))return;
  // Las puertas de cochera y escaparate aún no tienen miniaturas aprobadas.
  if(it.type==='door'&&(it.variant==='garage'||it.variant==='storefront'||ForestShared.doorSpec(it).family==='garage'))return;
  const fields=document.getElementById('fields');
  const labels=[...fields.querySelectorAll('label')];
  const anchor=labels.find(label=>label.textContent.startsWith(it.type==='window'?'Marco de ventana':'Variante de acabado'));
  if(!anchor)return;
  const previousId=it.id;
  catalog().then(()=>{
   if(selection!==previousId||!anchor.isConnected)return;
   const gallery=el('section');gallery.className='fhArchInspector';
   const caption=el('strong',it.type==='window'?T.windowModels:T.doorModels);
   const tiles=el('div');tiles.className='fhArchList';
   const choices=models.filter(m=>m.type===it.type);
   tiles.append(...choices.map(m=>modelCard(m,currentModel(it),selected=>{
    if(selected.id!==currentModel(it))changeModel(it,selected);
   })));
   gallery.append(caption,tiles);
   anchor.replaceWith(gallery);
   if(it.type==='door'){
    const glassLabel=labels.find(label=>label.textContent.startsWith(T.glassDesign));
    glassLabel?.remove();
   }
  }).catch(error=>{console.warn('[Forest Horror arquitectura inspector]',error);});
 }
 const oldSetCategory=setCategory,oldChooseTool=chooseTool,oldCreateSegment=createSegment,oldOpenInspector=openInspector;
 setCategory=function(cat){oldSetCategory(cat);installToolLaunchers();};
 createSegment=function(type,a,b){
  const item=oldCreateSegment(type,a,b);
  if(item&&active[type]){
   const model=models.find(m=>m.id===active[type]);
   if(model)applyModel(item,model);
   else if(type==='window')item.windowSkin='clasica';
   else if(type==='door')item.variant='wood';
   else if(type==='peephole_door')item.variant='wood';
  }
  return item;
 };
 openInspector=function(){oldOpenInspector();augmentInspector();};
 function installToolLaunchers(){
  for(const tool of ['door','peephole_door','window']){
   const button=document.querySelector('#tools button[data-tool="'+tool+'"]');
   if(button)button.onclick=()=>show(tool);
  }
  refreshToolbar();
 }
 installToolLaunchers();
 window.FHArchitectureEditorCatalog=Object.freeze({currentModel,applyModel});
})();
