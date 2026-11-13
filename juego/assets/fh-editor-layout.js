/* Distribución del editor. Los nodos originales conservan sus manejadores y datos. */
(function(root){
 'use strict';
 // El mismo cálculo se prueba sin navegador. Se reserva el botón de acceso completo.
 function visibleCount(widths,available,toggleWidth,gap=6,allInPanel=false){
  if(allInPanel)return 0;
  const total=widths.reduce((sum,w)=>sum+w,0)+Math.max(0,widths.length-1)*gap;
  if(total<=available)return widths.length;
  let used=toggleWidth,count=0;
  for(const width of widths){if(used+gap+width>available)break;used+=gap+width;count++;}
  return count;
 }
 // render() sustituye algunos nodos de texto en cada fotograma. Sólo su contenido
 // efectivo puede cambiar el ancho; las mutaciones estructurales sí requieren medir.
 function mutationsAffectLayout(records){
  return records.some(record=>{
   if(record.type==='characterData')return record.oldValue!==record.target.data;
   if(record.type!=='childList')return false;
   const before=[...record.removedNodes],after=[...record.addedNodes];
   if([...before,...after].some(node=>node.nodeType!==3))return true;
   return before.map(node=>node.textContent).join('')!==after.map(node=>node.textContent).join('');
  });
 }
 function handoffToDialog(doc,closePanels){
  const overlay=doc.getElementById('overlay');
  if(!overlay?.classList.contains('show'))return false;
  closePanels();
  if(!overlay.contains(doc.activeElement)){
   overlay.querySelector('input:not([type=hidden]):not(:disabled),select:not(:disabled),textarea:not(:disabled),button:not(:disabled)')?.focus();
  }
  return true;
 }
 function preservePanelInput(entries,active,widthBefore,widthAfter){
  if(!active||!widthBefore||Math.abs(widthBefore-widthAfter)>1)return false;
  const editable=active.isContentEditable||active.tagName==='TEXTAREA'||active.tagName==='SELECT'||
   active.tagName==='INPUT'&&!['button','submit','reset','checkbox','radio','range','color','file'].includes(active.type);
  return !!editable&&[...entries].some(entry=>!entry.panel.hidden&&entry.panel.contains(active));
 }
 if(typeof module==='object'&&module.exports)module.exports={visibleCount,mutationsAffectLayout,handoffToDialog,preservePanelInput};
 if(!root.document)return;
 const doc=root.document,T=root.FH_EDITOR_LAYOUT_TEXT,$=id=>doc.getElementById(id);
 const body=doc.body,app=$('app'),stage=$('stage'),inspector=$('inspector'),fields=$('fields');
 const panels=new Set();
 let compact=false,portrait=false,sidebarExpanded=true,frame=0,selectionFrame=0;
 let layoutWidth=0,viewportDeferred=false;
 let inspectedItem=null,inspectedFloor=null,inspectedValue='';
 function element(tag,id,text){const el=doc.createElement(tag);if(id)el.id=id;if(text)el.textContent=text;return el;}
 function button(id,text){const el=element('button',id,text);el.type='button';return el;}
 function visible(el){return !!el.getClientRects().length&&!el.hidden&&getComputedStyle(el).display!=='none';}
 function viewport(){const v=root.visualViewport;return {x:v?.offsetLeft||0,y:v?.offsetTop||0,w:v?.width||innerWidth,h:v?.height||innerHeight};}
 function positionPanel(entry){
  if(entry.panel.hidden)return;
  const v=viewport(),r=entry.trigger.getBoundingClientRect(),panel=entry.panel;
  // CSS env() en el margen protege muescas también para los popovers en la capa superior.
  const safe=getComputedStyle(body);
  const leftInset=Math.max(12,parseFloat(safe.getPropertyValue('--fh-safe-left'))||0);
  const rightInset=Math.max(12,parseFloat(safe.getPropertyValue('--fh-safe-right'))||0);
  const inset=Math.max(12,parseFloat(safe.getPropertyValue('--fh-safe-top'))||0,parseFloat(safe.getPropertyValue('--fh-safe-bottom'))||0);
  const width=Math.min(entry.width||420,v.w-leftInset-rightInset);
  panel.style.width=width+'px';panel.style.maxHeight=Math.max(44,v.h-inset*2)+'px';
  const height=Math.min(panel.scrollHeight,v.h-inset*2);
  const below=r.bottom+6;
  const top=below+height<=v.y+v.h-inset?below:Math.max(v.y+inset,r.top-height-6);
  panel.style.left=Math.max(v.x+leftInset,Math.min(r.left,v.x+v.w-width-rightInset))+'px';
  panel.style.top=top+'px';
 }
 function closePanel(entry,restoreFocus=false){
  if(entry.panel.hidden)return;
  entry.panel.hidePopover?.();entry.panel.hidden=true;
  entry.trigger.setAttribute('aria-expanded','false');panels.delete(entry);
  if(restoreFocus&&visible(entry.trigger))entry.trigger.focus();
 }
 function closePanels(restoreFocus=false){for(const entry of [...panels].reverse())closePanel(entry,restoreFocus);}
 function openPanel(entry){
  // Cerrar otros paneles, excepto un ancestro (selector de niveles en Acciones).
  for(const other of [...panels])if(!other.panel.contains(entry.trigger))closePanel(other);
  entry.panel.hidden=false;entry.panel.showPopover?.();
  entry.trigger.setAttribute('aria-expanded','true');panels.add(entry);
  positionPanel(entry);
 }
 function makePanel(trigger,id,title,width){
  trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',id);
  const panel=element('section',id);panel.className='fh-editor-panel';panel.hidden=true;
  panel.setAttribute('popover','manual');panel.setAttribute('aria-label',title);
  const head=element('div');head.className='fh-panel-head';
  const close=button('',T.close);head.append(element('strong','',title),close);
  const contents=element('div');contents.className='fh-panel-items';panel.append(head,contents);
  const entry={trigger,panel,contents,width};
  // Se ejecuta después del onclick original: cubre también Conexiones en Opciones.
  contents.addEventListener('click',e=>{
   if(e.target.closest('button'))handoffToDialog(doc,closePanels);
  });
  close.onclick=()=>closePanel(entry,true);
  trigger.onclick=()=>entry.panel.hidden?openPanel(entry):closePanel(entry,true);
  trigger.addEventListener('keydown',e=>{
   if(e.key==='ArrowDown'){e.preventDefault();openPanel(entry);contents.querySelector('button:not(:disabled),input,select')?.focus();}
  });
  return entry;
 }
 function installBar(container,label,forcePanel=()=>false){
  const toggle=button('',label+' ▾');toggle.className='fh-overflow-toggle';
  const entry=makePanel(toggle,'fhMore-'+container.id,label,container.id==='tools'?540:420);
  const observer=new MutationObserver(records=>{if(mutationsAffectLayout(records))schedule();});
  const watch=()=>observer.observe(container,{childList:true,subtree:true,characterData:true,characterDataOldValue:true});
  const bar={container,entry,fit(){
   observer.disconnect();
   try{
    // setCategory() reconstruye #tools. No se conservan referencias a herramientas anteriores.
    const attached=entry.panel.parentNode===container;
    const items=[...container.children].filter(el=>el!==toggle&&el!==entry.panel);
    if(attached)items.push(...entry.contents.children);
    if(!items.length)return;
    if(!attached){entry.contents.replaceChildren();entry.panel.hidden=true;panels.delete(entry);toggle.setAttribute('aria-expanded','false');}
    const focused=doc.activeElement;
    for(const item of items)container.append(item);
    container.append(toggle,entry.panel);toggle.hidden=false;
    container.classList.add('fh-measuring');
    const style=getComputedStyle(container),gap=parseFloat(style.columnGap)||6;
    const available=container.clientWidth-parseFloat(style.paddingLeft||0)-parseFloat(style.paddingRight||0);
    const widths=items.map(item=>item.getBoundingClientRect().width);
    const count=visibleCount(widths,available,toggle.getBoundingClientRect().width,gap,forcePanel());
    items.slice(count).forEach(item=>entry.contents.append(item));
    toggle.hidden=count===items.length;
    container.classList.remove('fh-measuring');
    if(toggle.hidden)closePanel(entry);
    if(focused&&items.some(item=>item===focused||item.contains(focused))){
     if(entry.contents.contains(focused)&&entry.panel.hidden)toggle.focus();else focused.focus({preventScroll:true});
    }
   }finally{watch();}
  }};
  // Dejar que el botón ejecute primero su acción; un diálogo no debe quedar debajo del popover.
  container.addEventListener('click',e=>{
   const chosen=e.target.closest('button');if(!chosen)return;
   const controlled=doc.getElementById(chosen.getAttribute('aria-controls')||'');
   const nestedTrigger=controlled?.classList.contains('fh-editor-panel');
   if(entry.contents.contains(chosen)&&!nestedTrigger){
    const restore=entry.panel.contains(doc.activeElement)||doc.activeElement===doc.body;
    closePanels();if(restore)toggle.focus();
   }
   handoffToDialog(doc,closePanels);
  });
  watch();return bar;
 }
 // El inspector comparte fila con el mapa; nunca se monta encima de él.
 const workspace=element('div','fhWorkspace');stage.before(workspace);workspace.append(stage,inspector);
 inspector.setAttribute('aria-label',T.properties);inspector.setAttribute('role','complementary');
 const empty=element('p','fhInspectorEmpty',T.empty);inspector.insertBefore(empty,fields);
 const notice=element('section','fhOrientationNotice');notice.setAttribute('role','status');
 notice.append(element('strong','',T.rotate),element('p','',T.portraitHint));workspace.append(notice);
 const palette=$('palette'),paletteBar=element('div','fhPaletteBar');palette.prepend(paletteBar);
 const properties=button('fhPropertiesToggle',T.properties),options=button('fhOptionsToggle','⚙ '+T.more);
 properties.setAttribute('aria-controls','inspector');properties.setAttribute('aria-expanded','true');
 paletteBar.append($('categories'),properties,options);
 const optionsPanel=makePanel(options,'fhEditOptions',T.options,520);
 palette.append(optionsPanel.panel);optionsPanel.contents.append($('layerSwitch'),$('circuitTools'),$('paletteFoot'));
 const diagnostics=element('div');
 const diagnosticToggle=$('previewDiagnosticToggle');diagnosticToggle.textContent=T.previewDiagnostics+' ▾';
 diagnostics.append(diagnosticToggle,$('previewDiagnosticOptions'));optionsPanel.contents.append(diagnostics);
 const hint=element('details');hint.append(element('summary','',T.help),$('stageHint'));optionsPanel.contents.append(hint);
 // Un selector de nivel completo, incluso si se crean decenas de pisos.
 const floorTabs=$('floorTabs'),floorPicker=element('div','fhFloorPicker'),floorButton=button('fhFloorToggle',T.floors);
 floorTabs.before(floorPicker);floorPicker.append(floorButton);
 const floorPanel=makePanel(floorButton,'fhFloorPanel',T.floors,340);floorPicker.append(floorPanel.panel);floorPanel.contents.append(floorTabs);
 floorTabs.addEventListener('click',e=>{if(e.target.closest('button'))closePanels(true);});
 // La barra principal prioriza las acciones de navegación y prueba que ya existen.
 const subbar=$('subbar');
 const essentials=[floorPicker,$('undoBtn'),$('redoBtn'),$('fitBtn'),$('testBtn')];
 subbar.prepend(...essentials);
 $('undoBtn').setAttribute('aria-label',T.undo);$('redoBtn').setAttribute('aria-label',T.redo);
 $('headActions').prepend($('menuBtn'));
 const headBar=installBar($('headActions'),T.more);
 const actionBar=installBar(subbar,T.actions);
 const categoryBar=installBar($('categories'),T.categories,()=>compact);
 const toolBar=installBar($('tools'),T.tools,()=>compact);
 // Acceso directo a seleccionar y mover, sin cambiar el grupo o su comportamiento.
 const quick=element('div','fhQuickTools');
 for(const [tool,title,symbol] of [['select',T.selection,'☞'],['pan',T.pan,'✋']]){
  const b=button('',symbol);b.dataset.editorTool=tool;b.title=title;b.setAttribute('aria-label',title);
  b.onclick=()=>{chooseTool(tool);closePanels();};quick.append(b);
 }
 paletteBar.prepend(quick);
 function updateProperties(){
  const shown=!portrait&&(compact?body.classList.contains('fh-properties-open'):sidebarExpanded);
  properties.setAttribute('aria-expanded',String(shown));
  properties.title=shown?T.collapse:T.expand;
  inspector.inert=!shown;body.classList.toggle('fh-sidebar-collapsed',!sidebarExpanded);
 }
 properties.onclick=()=>{
  closePanels();
  if(compact)body.classList.toggle('fh-properties-open');else sidebarExpanded=!sidebarExpanded;
  updateProperties();schedule();
  if(properties.getAttribute('aria-expanded')==='true'){
   inspector.setAttribute('tabindex','-1');inspector.focus({preventScroll:true});
  }
 };
 // Cerrar el inspector no deselecciona el objeto, igual que en el editor existente.
 const originalClose=closeInspector;
 closeInspector=function(){
  originalClose();
  if(selection){if(compact)body.classList.remove('fh-properties-open');else sidebarExpanded=false;}
  else clearInspector();
  updateProperties();schedule();
 };
 $('inspClose').onclick=()=>closeInspector();
 function clearInspector(){
  inspectedItem=null;inspectedFloor=null;inspectedValue='';
  fields.replaceChildren();$('inspTitle').textContent=T.emptyTitle;empty.hidden=false;
  $('inspectorActions').hidden=true;inspector.dataset.empty='true';
 }
 const originalOpen=openInspector;
 openInspector=function(){
  originalOpen();
  const item=current().items.find(item=>item.id===selection);
  if(!item){clearInspector();return;}
  inspectedItem=item;inspectedFloor=current();inspectedValue=JSON.stringify(item);
  empty.hidden=true;$('inspectorActions').hidden=false;inspector.dataset.empty='false';
  // No se abre automáticamente en móvil. En escritorio respeta la contracción elegida.
  updateProperties();
 };
 function syncSelection(){
  selectionFrame=0;
  const item=current().items.find(item=>item.id===selection);
  if(!item){if(inspectedItem||!inspector.dataset.empty)clearInspector();}
  else if(item!==inspectedItem||current()!==inspectedFloor)openInspector();
  // Comparar sólo en reposo evita serializar áreas grandes durante el gesto.
  else if(!pointerStates.size&&!action&&!inspector.contains(doc.activeElement)&&JSON.stringify(item)!==inspectedValue)openInspector();
  const currentCategory=$('categories').querySelector('[data-cat].active');
  const currentTool=$('tools').querySelector('[data-tool].active');
  const categoryLabel=currentCategory?.textContent.trim()||T.categories;
  const toolLabel=currentTool?.title||SHORT[activeTool]||activeTool;
  setText(categoryBar.entry.trigger,(compact?categoryLabel:T.more+' '+T.categories.toLocaleLowerCase('es'))+' ▾');
  setText(toolBar.entry.trigger,(compact?T.tools+': '+toolLabel:T.more+' '+T.tools.toLocaleLowerCase('es')+(currentTool&&toolBar.entry.contents.contains(currentTool)?': '+toolLabel:''))+' ▾');
  toolBar.entry.trigger.title=T.tools+': '+toolLabel;
  for(const el of $('tools').querySelectorAll('[data-tool]'))el.setAttribute('aria-pressed',String(el.dataset.tool===activeTool));
  for(const el of $('categories').querySelectorAll('[data-cat]'))el.setAttribute('aria-pressed',String(el.dataset.cat===activeCategory));
  for(const el of quick.children)el.setAttribute('aria-pressed',String(el.dataset.editorTool===activeTool));
  setText($('fhFloorToggle'),current().name+' ▾');
  for(const entry of panels)positionPanel(entry);
 }
 function setText(el,text){if(el.textContent!==text)el.textContent=text;}
 function requestSelectionSync(){if(!selectionFrame)selectionFrame=requestAnimationFrame(syncSelection);}
 inspector.addEventListener('focusout',requestSelectionSync);
 const originalRender=render;
 render=function(...args){const result=originalRender(...args);requestSelectionSync();return result;};
 function applyViewport(v){
  app.style.height=v.h+'px';app.style.top=v.y+'px';app.style.left=v.x+'px';app.style.width=v.w+'px';
 }
 function layout(){
  frame=0;
  const v=viewport();
  // El teclado puede emitir resize, scroll y ResizeObserver. Ninguna de esas
  // rutas debe mover los nodos del campo enfocado ni cerrar su popover.
  if(preservePanelInput(panels,doc.activeElement,layoutWidth,v.w)){
   viewportDeferred=true;applyViewport(v);
   for(const entry of panels)positionPanel(entry);
   resize();return;
  }
  viewportDeferred=false;layoutWidth=v.w;
  if(panels.size)closePanels(true);
  const nextPortrait=v.w<600&&v.h>v.w,nextCompact=v.h<=500||v.w<900;
  if(nextCompact!==compact||nextPortrait!==portrait){
   closePanels();body.classList.remove('fh-properties-open');
   if(inspector.contains(doc.activeElement))properties.focus();
  }
  compact=nextCompact;portrait=nextPortrait;
  body.classList.add('fh-editor');body.classList.toggle('fh-compact',compact);body.classList.toggle('fh-portrait',portrait);
  applyViewport(v);
  notice.hidden=!portrait;stage.inert=portrait;
  updateProperties();
  // Primero las filas interiores; después las barras que contienen sus lanzadores.
  for(const bar of [categoryBar,toolBar,actionBar,headBar])if(visible(bar.container))bar.fit();
  syncSelection();resize();
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(layout);}
 doc.addEventListener('focusout',()=>{if(viewportDeferred)schedule();});
 const sizes=new ResizeObserver(schedule);
 for(const el of [app,stage,$('headActions'),subbar,$('categories'),$('tools')])sizes.observe(el);
 root.visualViewport?.addEventListener('resize',schedule);root.visualViewport?.addEventListener('scroll',schedule);
 root.addEventListener('resize',schedule);
 doc.fonts?.ready.then(schedule);
 doc.addEventListener('pointerdown',e=>{
  if(![...panels].some(entry=>entry.panel.contains(e.target)||entry.trigger.contains(e.target)))closePanels();
 },true);
 doc.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&panels.size){e.preventDefault();e.stopImmediatePropagation();closePanels(true);}
 },true);
 // El editor sólo pide pantalla completa; la ruta compartida de Probar 3D se conserva.
 const fullscreen=$('editorLandscapeBtn');fullscreen.textContent='⛶';fullscreen.title=T.fullscreen;fullscreen.setAttribute('aria-label',T.fullscreen);
 fullscreen.onclick=async()=>{
  try{
   if(doc.fullscreenElement)await doc.exitFullscreen();
   else if(doc.documentElement.requestFullscreen)await doc.documentElement.requestFullscreen();
   else toast(T.fullscreenUnavailable);
  }catch{toast(T.fullscreenUnavailable);}
 };
 clearInspector();layout();
 root.FHEditorLayout=Object.freeze({refresh:schedule});
})(typeof window==='undefined'?globalThis:window);
