/* Forest Horror: selector de modelos en el editor actual. */
(function(){
 'use strict';
 const T=window.FH_CATALOG_TEXT;
 const base=new URL('./forest-horror/biblioteca/',document.baseURI);
 let items=[],chosen=null,loadOnce=null,launch=null,categoryValue='';
 const style=document.createElement('style');
 style.textContent='#fhCatModal[hidden]{display:none!important}#fhCatModal{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:12px;background:#03070cda}#fhCatModal .fhCatPanel{width:min(770px,100%);max-height:92dvh;padding:12px;display:flex;flex-direction:column;gap:9px;background:#121b2b;border:2px solid #8e9eb7;color:#f3f7ff;box-shadow:0 15px 55px #000c}#fhCatModal .fhCatTop,#fhCatModal .fhCatFilters{display:flex;align-items:center;justify-content:space-between;gap:8px}#fhCatModal h2{font:700 18px system-ui;margin:0}#fhCatModal p{font:12px/1.5 system-ui;color:#b7c7dc;margin:0}#fhCatModal input,#fhCatModal select{flex:1;min-width:0;padding:10px;border:1px solid #7084a2;background:#0b1421;color:white;font:14px system-ui}#fhCatModal .fhCatList{overflow:auto;max-height:66vh;display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:7px}#fhCatModal .fhCatCard{display:flex;flex-direction:column;gap:5px;text-align:left;padding:6px;border-radius:3px;border:1px solid #526885;background:#213149;color:white;min-height:148px}#fhCatModal .fhCatCard img{width:100%;height:93px;object-fit:contain;image-rendering:pixelated;background:#08121d}#fhCatModal .fhCatCard strong{font:700 11px/1.3 system-ui}#fhCatModal .fhCatCard small{font:10px system-ui;color:#b8c9df}#fhCatModal button:focus-visible{outline:2px solid #ffce83;outline-offset:2px}@media(max-width:480px){#fhCatModal .fhCatList{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}#fhCatModal .fhCatCard{min-height:128px;padding:4px}#fhCatModal .fhCatCard img{height:74px}}';
 style.textContent+='#fhCatModal .fhCatCategories{display:flex;gap:5px;overflow-x:auto;padding:2px 0 5px;flex-wrap:nowrap}#fhCatModal .fhCatCategories button{flex:none;min-height:37px;padding:7px 10px;border-radius:3px;background:#202d38;border:1px solid #71838e;color:#f0f3ef;font:600 12px system-ui;white-space:nowrap}#fhCatModal .fhCatCategories button[aria-pressed=true]{border-color:#efc88a;background:#3e392e;color:#ffdeb0}#fhCatModal .fhCatCard[aria-pressed=true]{border:2px solid #efc88a;background:#303d41}';
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
 const categories=el('div');categories.className='fhCatCategories';categories.setAttribute('role','group');categories.setAttribute('aria-label',T.all);
 filters.append(query);
 const results=el('div');results.className='fhCatList';
 panel.append(top,filters,categories,results,el('p',T.hint));modal.append(panel);document.body.append(modal);
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
  const term=query.value.trim().toLocaleLowerCase('es'),cat=categoryValue;
  const matching=items.filter(x=>(!cat||x.category===cat)&&(!term||(x.name+' '+x.id+' '+(x.tags||[]).join(' ')).toLocaleLowerCase('es').includes(term)));
  results.replaceChildren();
  if(!matching.length){results.append(el('p',T.empty));return;}
  for(const item of matching){
   const card=el('button');card.type='button';card.className='fhCatCard';card.setAttribute('aria-pressed',String(chosen?.id===item.id));
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
 function renderCategories(){
  const options=[['',T.all],...[...new Set(items.map(x=>x.category))].sort((a,b)=>a.localeCompare(b,'es')).map(value=>[value,value])];
  categories.replaceChildren(...options.map(([value,label])=>{
   const button=el('button',label);button.type='button';
   button.setAttribute('aria-pressed',String(categoryValue===value));
   button.onclick=()=>{categoryValue=value;renderCategories();render();};
   return button;
  }));
 }
 async function open(){
  modal.hidden=false;query.value='';categoryValue='';categories.replaceChildren();results.replaceChildren(el('p',T.loading));query.focus();
  try{
   await fetchItems();
   renderCategories();render();
  }catch(e){console.warn('[Forest Horror catálogo]',e);results.replaceChildren(el('p',T.error));}
 }
 query.addEventListener('input',render);
 function refreshLauncher(){
  if(!launch)return;
  launch.title=chosen?T.chosen+' '+chosen.name:T.open;
  const name=launch.children[1],symbol=launch.querySelector('.sym');
  if(name)name.textContent=chosen?.name||T.open;
  if(symbol){
   if(chosen){
    const img=el('img');img.alt='';img.src=new URL(chosen.thumbnail,base).href;
    img.style.cssText='width:28px;height:28px;object-fit:contain;image-rendering:pixelated';
    symbol.replaceChildren(img);
   }else symbol.textContent='□';
  }
 }
 function installLauncher(){
  launch=activeCategory==='furniture'?document.querySelector('#tools button[data-tool="misc"]'):null;
  if(!launch)return;
  launch.onclick=open;refreshLauncher();
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
