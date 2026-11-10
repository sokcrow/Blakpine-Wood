/* Usa las herramientas existentes del editor; sincroniza sus cambios con la partida activa. */
(function(){
 'use strict';
 const api=window.FHFurnitureState,T=window.FH_FURNITURE_EDITOR_TEXT;
 const snapshot=()=>({createdAt:project.createdAt,floors:api.capture(project)});
 let baseline=snapshot(),baselineHistoryIndex=historyIndex,hydrating=false,catalog=null;
 let importBoundaries=new Set();
 function saved(){
  const raw=readStorage(ForestShared.gameSaveKey(project));
  if(!raw)return null;
  const character=window.FHCharacterCreation?.current?.();
  const selected=character?window.FHCharacterCreation.selectMapSave(raw,character.id):raw;
  return selected?JSON.parse(selected):null;
 }
 function sync(){
  if(hydrating||baseline.createdAt!==project.createdAt){baseline=snapshot();return;}
  try{
   const payload=saved(),state=payload?.version===1?payload.state:null;
   if(state&&api.syncEdits(baseline,project,state)&&!safeStorage(ForestShared.gameSaveKey(project),JSON.stringify(payload)))toast(T.storageError);
  }catch(error){console.error('[Muebles del editor]',error);toast(T.loadError);}
  baseline=snapshot();
 }
 const previousRecord=record;
 record=function(){
  const oldIndex=historyIndex;
  importBoundaries=new Set([...importBoundaries].filter(index=>index<=oldIndex));
  const result=previousRecord();
  if(historyIndex===oldIndex&&oldIndex===74)importBoundaries=new Set([...importBoundaries].map(index=>index-1).filter(index=>index>0));
  sync();baselineHistoryIndex=historyIndex;return result;
 };
 const previousRestore=restoreHistory;
 restoreHistory=function(){
  const isImport=Math.abs(baselineHistoryIndex-historyIndex)===1&&importBoundaries.has(Math.max(baselineHistoryIndex,historyIndex));
  previousRestore();
  if(isImport)baseline=snapshot();
  else sync();
  baselineHistoryIndex=historyIndex;
 };
 async function hydrate(){
  let state;
  try{state=saved()?.state;}catch(error){toast(T.loadError);return;}
  if(!state)return;
  if(!catalog){
   try{
    const response=await fetch(new URL('./forest-horror/biblioteca/catalogo_muebles.json',document.baseURI));
    if(response.ok)catalog=(await response.json()).furniture||[];
   }catch{/* Los registros Legacy siguen siendo seleccionables sin catálogo. */}
  }
  hydrating=true;
  try{
   const changed=api.hydrate(project,state,catalog||[],(item,product)=>window.FHFurnitureRules.applyCatalogModel(item,product,ForestShared,Number(project.units.feetPerCell)||5));
   if(changed){
    for(const floor of project.floors)window.FHSurfacePlacement?.syncAll(floor.items,Number(project.units.feetPerCell)||5,(item,feet)=>window.FHFurnitureRules.supportSurfacesFor(item,feet));
    record();importBoundaries.add(historyIndex);
    toast(T.imported);
   }
  }finally{hydrating=false;baseline=snapshot();}
 }
 async function open(){
  toast(T.loading);await hydrate();
  const entries=current().items.filter(api.editable);
  modal('<h2>'+escapeAttr(T.title)+'</h2><p>'+escapeAttr(T.hint)+'</p><div id="fhFurnitureObjects" style="max-height:55vh;overflow:auto"></div><div class="actions"><button id="fhFurnitureClose">'+escapeAttr(T.close)+'</button></div>',()=>{
   const list=document.getElementById('fhFurnitureObjects');
   if(!entries.length)list.textContent=T.empty;
   for(const item of entries){
    const button=document.createElement('button');button.type='button';button.style.cssText='display:block;width:100%;text-align:left;margin:6px 0;white-space:normal';
    button.textContent=(item.label||SHORT[item.type]||item.type)+' · '+(item.editorRuntimeSource?T.player:T.map)+' · '+item.id+' · X '+item.x+' / Y '+item.y;
    button.onclick=()=>{
     if(window.FHStyleEditor?.canEditItem(item)===false){toast(window.FH_STYLE_TEXT?.denied||T.loadError);return;}
     closeModal();setCategory('furniture');chooseTool('select');selection=item.id;
     const point=toPixel(item);view.tx=canvas.clientWidth/2-point.x*view.scale;view.ty=canvas.clientHeight/2-point.y*view.scale;
     openInspector();render();
    };
    list.append(button);
   }
   document.getElementById('fhFurnitureClose').onclick=closeModal;
  });
 }
 function launcher(){
  if(activeCategory!=='furniture'||document.getElementById('fhFurnitureObjectsBtn'))return;
  const button=document.createElement('button');button.id='fhFurnitureObjectsBtn';button.type='button';button.textContent=T.open;button.onclick=open;
  document.getElementById('tools').prepend(button);
 }
 const previousCategory=setCategory;
 setCategory=function(category){previousCategory(category);launcher();};
 const previousClose=close3DPreview;
 close3DPreview=function(){previousClose();void hydrate();};
 // El botón de regreso tenía una referencia directa a la función anterior.
 document.getElementById('play3dBack').removeEventListener('click',previousClose);
 document.getElementById('play3dBack').addEventListener('click',close3DPreview);
 const previousProject=makeCurrent3DProject;
 makeCurrent3DProject=function(){
  const data=previousProject();let state=null;
  try{state=data.__runtimeSave?JSON.parse(data.__runtimeSave).state:data.initialGameState;}catch{}
  data.floors.forEach(floor=>{floor.items=api.runtimeItems(floor.items,state);});
  return data;
 };
 launcher();
})();
