/* Forest Horror: selector de modelos en el editor actual. */
(function(){
 'use strict';
 const T=window.FH_CATALOG_TEXT;
 const base=new URL('./forest-horror/biblioteca/',document.baseURI);
 let items=[],chosen=null,loadOnce=null,launch=null;
 const style=document.createElement('style');
 style.textContent='#fhCatModal[hidden]{display:none!important}#fhCatModal{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:12px;background:#03070cda}#fhCatModal .fhCatPanel{width:min(770px,100%);max-height:92dvh;padding:12px;display:flex;flex-direction:column;gap:9px;background:#121b2b;border:2px solid #8e9eb7;color:#f3f7ff;box-shadow:0 15px 55px #000c}#fhCatModal .fhCatTop,#fhCatModal .fhCatFilters{display:flex;align-items:center;justify-content:space-between;gap:8px}#fhCatModal h2{font:700 18px system-ui;margin:0}#fhCatModal p{font:12px/1.5 system-ui;color:#b7c7dc;margin:0}#fhCatModal input,#fhCatModal select{flex:1;min-width:0;padding:10px;border:1px solid #7084a2;background:#0b1421;color:white;font:14px system-ui}#fhCatModal .fhCatList{overflow:auto;max-height:66vh;display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:7px}#fhCatModal .fhCatCard{display:flex;flex-direction:column;gap:5px;text-align:left;padding:6px;border-radius:3px;border:1px solid #526885;background:#213149;color:white;min-height:148px}#fhCatModal .fhCatCard img{width:100%;height:93px;object-fit:contain;image-rendering:pixelated;background:#08121d}#fhCatModal .fhCatCard strong{font:700 11px/1.3 system-ui}#fhCatModal .fhCatCard small{font:10px system-ui;color:#b8c9df}#fhCatModal button:focus-visible{outline:2px solid #ffce83;outline-offset:2px}@media(max-width:480px){#fhCatModal .fhCatList{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}#fhCatModal .fhCatCard{min-height:128px;padding:4px}#fhCatModal .fhCatCard img{height:74px}}';
 document.head.append(style);
 function el(tag,text){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;}
 const modal=el('div');modal.id='fhCatModal';modal.hidden=true;
 const panel=el('section');panel.className='fhCatPanel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',T.title);
 const top=el('div');top.className='fhCatTop';
 const heading=el('div');heading.append(el('h2',T.title),el('p',T.subtitle));
 const closeButton=el('button','✕ '+T.close);closeButton.type='button';
 top.append(heading,closeButton);
 const filters=el('div');filters.className='fhCatFilters';
 const query=el('input');query.type='search';query.placeholder=T.search;query.setAttribute('aria-label',T.search);
 const category=el('select');category.setAttribute('aria-label',T.all);
 filters.append(query,category);
 const results=el('div');results.className='fhCatList';
 panel.append(top,filters,results,el('p',T.hint));modal.append(panel);document.body.append(modal);
 function close(){modal.hidden=true;launch?.focus();}
 closeButton.onclick=close;
 modal.addEventListener('click',e=>{if(e.target===modal)close();});
 modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}});
 function fetchItems(){
  if(!loadOnce)loadOnce=fetch(new URL('catalogo_muebles.json',base).href)
   .then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();})
   .then(doc=>{
    if(doc.schema!=='forest-horror-furniture-catalog-v1'||!Array.isArray(doc.furniture))throw Error('Catálogo inválido');
    items=doc.furniture.filter(x=>x&&/^[a-z0-9_]+$/.test(x.id)&&/^miniaturas\/[a-z0-9_]+\.png$/.test(x.thumbnail));
    return items;
   });
  return loadOnce;
 }
 function render(){
  const term=query.value.trim().toLocaleLowerCase('es'),cat=category.value;
  const matching=items.filter(x=>(!cat||x.category===cat)&&(!term||(x.name+' '+x.id+' '+(x.tags||[]).join(' ')).toLocaleLowerCase('es').includes(term)));
  results.replaceChildren();
  if(!matching.length){results.append(el('p',T.empty));return;}
  for(const item of matching){
   const card=el('button');card.type='button';card.className='fhCatCard';
   const img=el('img');img.alt=item.name;img.loading='lazy';img.src=new URL(item.thumbnail,base).href;
   const label=el('strong',item.name),tag=el('small',item.category);
   card.append(img,label,tag);
   card.onclick=()=>{
    chosen=item;close();setCategory('furniture');chooseTool('misc');refreshLauncher();
    toast(T.chosen+' '+item.name);
   };
   results.append(card);
  }
 }
 async function open(){
  modal.hidden=false;query.value='';category.replaceChildren();results.replaceChildren(el('p',T.loading));query.focus();
  try{
   await fetchItems();
   category.append(new Option(T.all,''));
   for(const value of [...new Set(items.map(x=>x.category))].sort((a,b)=>a.localeCompare(b,'es')))category.append(new Option(value,value));
   render();
  }catch(e){console.warn('[Forest Horror catálogo]',e);results.replaceChildren(el('p',T.error));}
 }
 query.addEventListener('input',render);category.addEventListener('change',render);
 function refreshLauncher(){if(launch)launch.title=chosen?T.chosen+' '+chosen.name:T.open;}
 function installLauncher(){
  if(activeCategory!=='furniture')return;
  const bar=document.getElementById('tools');if(!bar)return;
  launch=el('button',T.open);launch.type='button';launch.id='fhOpenCatalog';launch.className='accent';
  launch.onclick=open;bar.prepend(launch);refreshLauncher();
 }
 const oldCategory=setCategory;
 setCategory=function(cat){oldCategory(cat);installLauncher();};
 const oldCreate=createObject;
 createObject=function(type,pos){
  const item=oldCreate(type,pos);
  if(item&&type==='misc'&&chosen){
   window.FHFurnitureRules.applyCatalogModel(
    item,chosen,ForestShared,Number(project.units?.feetPerCell)||5);
  }
  return item;
 };
 installLauncher();
 window.FHEditorCatalog=Object.freeze({selectedPlacement:()=>chosen?.placement||'floor'});
})();
