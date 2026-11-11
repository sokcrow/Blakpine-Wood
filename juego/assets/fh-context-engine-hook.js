/* Adaptador de UI del motor 3D embebido. No cambia el JSON ni el editor 2D. */
(function (global) {
 'use strict';
 const one=(source,before,after,name)=>{
  const n=source.split(before).length-1;
  if(n!==1)throw Error('Integración radial incompatible ('+name+'): '+n);
  return source.replace(before,after);
 };
 function patch(doc) {
  // Conservar el movimiento del jugador aunque un mueble esté seleccionado.
  doc=one(doc,'if(!fhDeliveryUiActive&&!fhDecorationActive)moveUpdate(dt);else{user.vx=user.vz=0;}',
              'if(!fhDeliveryUiActive&&!window.FHStorageRuntime?.isOpen)moveUpdate(dt);else{user.vx=user.vz=0;}','movimiento');
  // Solo el arrastre del mueble captura eventos. Los gestos restantes giran la cámara.
  const pointer="function fhDecorationPointer(event){\n const a=fhDecorationActive;if(!a)return;\n if(event.type==='pointerdown'){";
  const pointerNew="function fhDecorationPointer(event){\n const a=fhDecorationActive;if(!a)return;\n if(event.type==='pointerdown'){\n"+
  "  const rect=$('view').getBoundingClientRect(),ray=new THREE.Raycaster();\n"+
  "  if(!rect.width||!rect.height)return;\n"+
  "  ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),cam);\n"+
  "  if(!ray.intersectObjects(a.roots.map(entry=>entry.root),true).length)return;";
  doc=one(doc,pointer,pointerNew,'selección del mueble');
  const code=String.raw`
let fhDecorMode=false;
const fhDecorModeBtn=document.createElement('button');
fhDecorModeBtn.id='fhDecorModeBtn';fhDecorModeBtn.type='button';
fhDecorModeBtn.style.cssText='position:absolute;left:-10000px;width:1px;height:1px;opacity:0;pointer-events:none';
fhDecorModeBtn.tabIndex=-1;document.body.append(fhDecorModeBtn);
function fhSyncDecorMode(){
 const t=window.FH_INTERACTION_STRINGS||{};
 fhDecorModeBtn.textContent=fhDecorMode?(t.decorateOn||'Decorar: activado'):(t.decorateOff||'Decorar: desactivado');
 fhDecorModeBtn.setAttribute('aria-pressed',String(fhDecorMode));
}
fhDecorModeBtn.addEventListener('click',()=>{
 if(fhDecorationActive)fhFinishDecoration(false);
 fhDecorMode=!fhDecorMode;
 if(!fhDecorMode&&fhStoredUiActive){fhStoredUiActive=false;fhEnsureDecorationUi().storedPanel.hidden=true;}
 fhSyncDecorMode();window.FHInteractionRadial?.hide();
});
fhSyncDecorMode();
function fhContextPoint(x,z,f=currentFloor){
 const rect=$('view').getBoundingClientRect(),p=new THREE.Vector3(x,floorElev[f]+1.28,z).project(cam);
 if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.z>1)
  return {x:rect.left+rect.width*.5,y:rect.top+rect.height*.55};
 return {x:rect.left+(p.x+1)*rect.width*.5,y:rect.top+(1-p.y)*rect.height*.5};
}
let fhContextGesture=null;
function fhRequestContext(kind,source,event){
 fhContextGesture={kind,source,x:event.clientX,y:event.clientY};
 fhContextRefresh();
}
// El mismo Safe Lock gobierna la vista 3D y el botón Usar.
const fhContextCanvas=$('view');
window.FHSafeLock?.bind(fhContextCanvas,{
 onTap:event=>fhRequestContext('tap','canvas',event),
 onHold:event=>fhRequestContext('hold','canvas',event),
 onCancel:()=>window.FHInteractionRadial?.hide()
});
window.FHSafeLock?.bind($('use'),{
 onTap:event=>fhRequestContext('tap','button',event),
 onHold:event=>fhRequestContext('hold','button',event)
},{capture:true,suppressClick:true});
// Click de teclado/accesibilidad: los punteros ya se resolvieron por Safe Lock.
function fhUseButtonClick(event){
 if(window.FHStorageRuntime?.isOpen)return;
 // Fallback para teclado, lectores de pantalla y navegadores sin Pointer Events.
 // Los clicks derivados de puntero son consumidos por FHSafeLock.
 if(playerPose.occupied)return toggleDoor();
 if(!window.FHInteractionRadial?.activatePrimary())toggleDoor();
}
function fhContextOpenElevator(shaft,fromLanding=false){
 const text=window.FH_INTERACTION_STRINGS||{};
 if(!shaft?.cabin){notice(text.elevatorUnavailable||'El ascensor no está disponible.');return false;}
 const cabin=shaft.cabin;
 let result;
 if(fromLanding){
  if(cabin.floor!==currentFloor){notice(text.elevatorNotHere||'El ascensor no está en este piso.');return false;}
  if(cabin.phase==='open'||cabin.phase==='doorsOpening'){notice(text.elevatorAlreadyOpen||'Las puertas ya están abiertas.');return true;}
  if(cabin.phase!=='idle'&&!(cabin.phase==='doorsClosing'&&cabin.targetFloor===currentFloor)){
   notice(text.elevatorCannotOpen||'Las puertas no pueden abrirse en este momento.');return false;
  }
  result=elevatorSystem.call(shaft.id,currentFloor);
 }else result=elevatorSystem.doorControl(shaft.id,'open');
 if(!result.ok){
  notice(result.reason==='noPower'?(text.elevatorNoPower||'El ascensor no tiene energía.'):
   result.reason==='moving'?(text.elevatorCannotOpen||'Las puertas no pueden abrirse en este momento.'):elevatorMessage(result));
  return false;
 }
 notice(result.already||result.alreadyHere?(text.elevatorAlreadyOpen||'Las puertas ya están abiertas.'):(text.elevatorOpening||'Abriendo puertas.'));
 saveProgress();return true;
}
function fhContextRefresh(){
 const radial=window.FHInteractionRadial,t=window.FH_INTERACTION_STRINGS||{};
 if(!radial)return;
 if(peeking||breakerPanelItem||stairTravel||fhDeliveryUiActive||window.FHComputerRuntime?.isOpen||window.FHStorageRuntime?.isOpen||fhStoredUiActive
  ||window.FHPlayerMenu?.isOpen()||$('inventoryPanel')?.classList.contains('open')
  ||$('noteOverlay')?.classList.contains('open')||$('fhLiveDialog')?.classList.contains('open')
  ||$('fhDeliveryDialog')?.classList.contains('open')){
  fhContextGesture=null;radial.syncContext(null);radial.hide();return;
 }
 let key='',title='',point={x:innerWidth*.5,y:innerHeight*.53},actions=[];
 let fhTapRoots=[];
 if(fhDecorMode){
  if(fhDecorationActive){
   const a=fhDecorationActive,it=a.item;
   key='decor:'+a.floor+':'+it.id;title=it.label||it.modelId||it.type||t.furniture;
   point=fhContextPoint(a.preview.x*CELL,a.preview.y*CELL,a.floor);
   actions=[
    {id:'move',label:t.decorateMove||'Mover frente a mí',run:()=>{
      const distance=Math.max(1.15,Math.max(Number(it.w)||1,Number(it.h)||1)*CELL*.65);
      fhRefreshDecorationPreview((user.x-Math.sin(yaw)*distance)/CELL,(user.z-Math.cos(yaw)*distance)/CELL,a.preview.rotation);
    }},
    {id:'fine',label:t.decorateTurnFine||'Girar 15°',run:()=>fhRotateDecoration(15)},
    {id:'turn',label:t.decorateTurn||'Girar 90°',run:()=>fhRotateDecoration(90)},
    {id:'place',label:t.decoratePlace||'Colocar',disabled:!a.valid,run:()=>fhFinishDecoration(true)},
    {id:'cancel',label:t.decorateCancel||'Cancelar',run:()=>fhFinishDecoration(false)}
   ];
   if(it.runtimeDeliveryFurniture)actions.push({id:'store',label:t.decorateStoreItem||'Guardar mueble',run:fhStoreDecoration});
  }else{
   const nearest=fhDecorationNearest(),stored=window.FHDeliveryRuntime?.storedFurniture()||[];
   if(nearest){
    const it=nearest.item;
    key='select:'+currentFloor+':'+it.id;title=it.label||it.modelId||it.type||t.furniture;
    point=fhContextPoint(it.x*CELL,it.y*CELL);
    actions.push({id:'select',label:t.decorateSelect||'Seleccionar / mover',run:()=>fhStartDecoration(it,nearest.floor)});
   }
   if(stored.length)actions.push({id:'stored',label:t.decorateStore||'Muebles guardados',run:()=>{
     fhDecorStoredList();fhStoredUiActive=true;fhEnsureDecorationUi().storedPanel.hidden=false;radial.hide();
   }});
   if(!key&&stored.length){key='stored';title=t.decorate||'Decorar';}
  }
 }else{
  const courier=fhDeliveryNpc,order=(window.FHDeliveryRuntime?.orders||[])
    .find(o=>['waiting','payment','delivering'].includes(o.status));
  if(!playerPose.occupied&&courier&&courier.parent===stories[currentFloor]&&order
    &&Math.hypot(courier.position.x-user.x,courier.position.z-user.z)<2.2){
   const door=fhDeliveryDoorById(order.doorId,order.floor);
   if(door){
    key='courier:'+order.id;title=t.courier||'Repartidor';fhTapRoots=[courier];
    point=fhContextPoint(courier.position.x,courier.position.z);
    actions.push({id:'talk',label:t.talk||'Hablar',run:()=>window.FHDeliveryRuntime?.talkToCourier?.(door)});
   }
  }
  if(!actions.length){
   if(occupiedShaft()){
    const shaft=occupiedShaft();
    key='elevator:inside';title=t.elevator||'Ascensor';
    const landing=shaft.stops.find(stop=>stop.f===currentFloor);
    if(landing){const entry=ForestShared.elevatorEntrancePoint(landing.item,CELL);point=fhContextPoint(entry.x,entry.z);}
    if(!['open','doorsOpening'].includes(shaft.cabin.phase))
     actions.push({id:'elevator-open',label:t.elevatorOpen||'Abrir puertas',run:()=>fhContextOpenElevator(shaft)});
    actions.push({id:'panel',label:t.elevatorPanel||'Panel del ascensor',run:toggleDoor});
   }else if(playerPose.occupied){
    key='pose:'+String(playerPoseItem?.id||'player');title=playerPoseItem?.label||t.furniture||'Mueble';
    if(playerPoseItem){point=fhContextPoint(playerPoseItem.x*CELL,playerPoseItem.y*CELL);fhTapRoots=(renderedByItem[currentFloor]?.get(playerPoseItem.id)||[]).map(entry=>entry?.root||entry).filter(root=>root?.isObject3D);}
    const front=fhSeatFrontTarget(),tv=currentTVCombo();
    if(front?.item)fhTapRoots.push(...(renderedByItem[currentFloor]?.get(front.item.id)||[])
      .map(entry=>entry?.root||entry).filter(root=>root?.isObject3D));
    actions=[{id:'stand',label:$('use').textContent,run:toggleDoor}];
    if(front||tv)actions.push({id:'watch',label:$('watchTv').textContent,run:fhUseFrontFromSeat});
   }else{
    const selected=useTarget(),target=selected?.target;
    const windowNear=window.ForestHorrorStructureAPI?.nearestWindow?.(currentFloor,user.x,user.z,CELL);
    const selectedDistance=selected?.kind==='door'?doorApproachDistance(target):
      selected?.kind==='furniture'?target.score:
      selected?.kind==='stairs'?Math.hypot(user.x-target.x,user.z-target.z):
      selected?.kind==='elevator'?ForestShared.elevatorEntranceDistance(target.item,user.x,user.z,CELL):Infinity;
    // La ventana sólo desplaza al objetivo habitual cuando está claramente más cerca.
    if(windowNear&&windowNear.dist+.15<selectedDistance){
     const it=windowNear.item;
     key='window:'+currentFloor+':'+it.id;title=it.label||window.FH_STRUCTURE_TEXT?.window||'Ventana';
     point=fhContextPoint((it.a.x+it.b.x)*CELL*.5,(it.a.y+it.b.y)*CELL*.5);
     const canExamine=!!window.ForestHorrorStructureAPI?.inspect({floorId:currentFloor,id:it.id});
     actions.push({id:'examine',label:t.examine||'Examinar',disabled:!canExamine,
      ...(canExamine?{run:()=>window.ForestHorrorStructureAPI?.inspectSelected(currentFloor,it.id)}:{})});
    }else if(selected&&target){
     if(selected.kind==='furniture'){
      const it=target.item;key='furniture:'+currentFloor+':'+it.id;
      fhTapRoots=(renderedByItem[currentFloor]?.get(it.id)||[]).map(entry=>entry?.root||entry).filter(root=>root?.isObject3D);
      title=it.label||it.modelId||it.type||t.furniture||'Mueble';
      const anchor=interactableAnchor(it);point=fhContextPoint(anchor.x*CELL,anchor.y*CELL);
     }else if(selected.kind==='door'){
      key='door:'+currentFloor+':'+target.id;title=target.label||t.door||'Puerta';
      point=fhContextPoint(target.cx,target.cz);
     }else if(selected.kind==='elevator'){
      key='elevator:'+target.shaftId;title=t.elevator||'Ascensor';
      const entry=ForestShared.elevatorEntrancePoint(target.item,CELL);
      point=fhContextPoint(entry.x,entry.z);
     }else if(selected.kind==='stairs'){
      key='stairs:'+currentFloor+':'+target.item?.id;title=t.stairs||'Escalera';
      point=fhContextPoint(target.x,target.z);
     }
     if(selected.kind==='elevator'){
      const shaft=elevatorSystem.get(target.shaftId),cabin=shaft?.cabin;
      const quickOpen=cabin?.floor===currentFloor&&(cabin.phase==='idle'||(cabin.phase==='doorsClosing'&&cabin.targetFloor===currentFloor));
      actions.push({id:'primary',label:quickOpen?(t.elevatorOpen||'Abrir puertas'):($('use').textContent||t.interact||'Interactuar'),
       run:()=>quickOpen?fhContextOpenElevator(shaft,true):toggleDoor()});
      if(cabin?.floor===currentFloor&&!quickOpen&&!['open','doorsOpening'].includes(cabin.phase))
       actions.push({id:'elevator-open',label:t.elevatorOpen||'Abrir puertas',run:()=>fhContextOpenElevator(shaft,true)});
     }else actions.push({id:'primary',label:$('use').textContent||t.interact||'Interactuar',run:toggleDoor});
     if(selected.kind==='furniture'&&window.FHStorageRuntime?.supports(target.item)&&target.item.interact?.verb!=='storage'){
      actions.push({id:'storage',label:t.openStorage||'Abrir inventario',run:()=>window.FHStorageRuntime?.open(target.item,currentFloor)});
     }
     if(selected.kind==='door'){
      const canLook=target.kind==='peephole_door'&&!target.open&&isInsideDoor(target);
      // Cuatro sectores constantes; las mecánicas pendientes permanecen deshabilitadas.
      actions.push({id:'peephole',label:t.peepholeShort||'Mirilla',disabled:!canLook,
       ...(canLook?{run:peephole}:{})});
      actions.push({id:'knock',label:t.knock||'Llamar',disabled:true});
      const canExamine=!!window.ForestHorrorStructureAPI?.inspect({floorId:currentFloor,id:target.id});
      actions.push({id:'examine',label:t.examine||'Examinar',disabled:!canExamine,
       ...(canExamine?{run:()=>window.ForestHorrorStructureAPI?.inspectSelected(currentFloor,target.id)}:{})});
     }
    }
   }
  }
 }
 const gesture=fhContextGesture;fhContextGesture=null;
 if(!actions.length){
  radial.syncContext(null);radial.hide();
  // Hold sobre espacio libre: consultar ubicación sin crear un radial vacío.
  if(gesture?.source==='canvas'&&gesture.kind==='hold')window.FHLocationHUD?.peek?.();
  // El botón Usar conserva su comportamiento cuando no hay objetivo.
  if(gesture?.source==='button'&&gesture.kind==='tap')toggleDoor();
  return;
 }
 const context={key,title,actions,x:point.x,y:point.y};
 radial.syncContext(context);
 let hit=gesture?.source==='button';
 if(gesture?.source==='canvas'){
  const reach=Math.max(22,Math.min(48,Math.min(innerWidth,innerHeight)*.11));
  hit=Math.hypot(gesture.x-point.x,gesture.y-point.y)<=reach;
  if(fhTapRoots.length){
   const rect=$('view').getBoundingClientRect();
   if(rect.width&&rect.height){
    const ray=new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(
     (gesture.x-rect.left)/rect.width*2-1,
     -(gesture.y-rect.top)/rect.height*2+1),cam);
    hit=ray.intersectObjects(fhTapRoots,true).length>0;
   }else hit=false;
  }
 }
 if(gesture&&hit){
  if(gesture.kind==='hold'){radial.open(context,'hold');return;}
  radial.hide();
  // Ninguna interacción contextual puede desplazar Levantarse.
  if(playerPose.occupied)return toggleDoor();
  const primary=actions.find(action=>!action.disabled&&typeof action.run==='function');
  primary?.run();
  return;
 }
 // El Hold fuera del objetivo consulta ubicación; sobre el objetivo conserva el radial.
 if(gesture?.source==='canvas'&&gesture.kind==='hold'&&!hit)window.FHLocationHUD?.peek?.();
 if(radial.visible&&radial.target===key)radial.update(context);
 else radial.hide();
}
`;
  doc=one(doc,'function hudUpdate(){',code+'\nfunction hudUpdate(){','HUD');
  // El motor mantiene las posturas; el radial sustituye los avisos redundantes.
  doc=one(doc,"saveProgress();notice(POSTURE_TEXT.standing);","saveProgress();","aviso al levantarse");
  doc=one(doc,"else if(poseStep.phase==='sitting'||poseStep.phase==='lying')notice(poseStep.phase==='sitting'?POSTURE_TEXT.sitting:POSTURE_TEXT.lying,900);","","avisos de postura");
  // La mirilla modifica circleMask antes de este adaptador: integrar aquí los textos de descanso.
  doc=one(doc,"function circleMask(){mctx.clearRect(0,0,innerWidth,innerHeight);if(!peeking||fhDoorConversationView)return;",
    "function circleMask(){mctx.clearRect(0,0,innerWidth,innerHeight);"+
    "if(!peeking&&(window.FHSleep?.needsComfort()||window.FHSleep?.needsBreath())){"+
    "const head=hero.localToWorld(new THREE.Vector3(0,HERO_H*.82,0));"+
    "const ndc=head.clone().project(cam),rect=$('view').getBoundingClientRect();"+
    "const shown=Number.isFinite(ndc.x)&&Number.isFinite(ndc.y)&&ndc.z>-1&&ndc.z<1&&Math.abs(ndc.x)<=1&&Math.abs(ndc.y)<=1;"+
    "const screenX=shown?rect.left+(ndc.x+1)*rect.width*.5:rect.left+rect.width*.54;"+
    "const screenY=shown?rect.top+(1-ndc.y)*rect.height*.5:rect.top+rect.height*.44;"+
    "const x=Math.max(30,Math.min(innerWidth-30,screenX+18)),y=Math.max(30,Math.min(innerHeight-30,screenY-16));"+
    "const fhSleepHead={x:head.x,y:head.y,z:head.z,floor:currentFloor,screenX:x,screenY:y};"+
    "if(window.FHSleep.needsComfort())window.FHSleep.emitComfort(fhSleepHead);"+
    "if(window.FHSleep.needsBreath())window.FHSleep.emitBreath(fhSleepHead);"+
    "}if(!peeking||fhDoorConversationView)return;",
    "proyección del descanso");
  doc=one(doc,'const GameEvents=createEventBus();',
    'if(restored?.fhInventoryStorage)GameState.fhInventoryStorage=restored.fhInventoryStorage;\n'+
    'window.FHStorageRuntime?.init({project:DATA,state:GameState,itemDefs,save:saveProgress,onInventoryChange:()=>renderInventory()});\n'+
    'const GameEvents=createEventBus();','persistencia almacenamiento');
  // El adaptador de computadoras ya añadió su propia cláusula al filtro.
  // Ampliamos esa cláusula sin sustituir la prioridad de interacción de PC.
  doc=one(doc,
    "const interactableItems=DATA.floors.map(f=>(f.items||[]).filter(it=>it.interact||it.type==='light_switch'||it.type==='breaker_panel'||ForestShared.PROP_ACTIONS[it.type]||it.pcTerminal===true||it.modelId==='escritorio_pc'||window.FHComputer?.isPc(it,f.items,Number(DATA.units.feetPerCell)||5))",
    "const interactableItems=DATA.floors.map(f=>(f.items||[]).filter(it=>it.interact||it.type==='light_switch'||it.type==='breaker_panel'||ForestShared.PROP_ACTIONS[it.type]||it.pcTerminal===true||it.modelId==='escritorio_pc'||window.FHComputer?.isPc(it,f.items,Number(DATA.units.feetPerCell)||5)||window.FHStorageRuntime?.supports(it))",
    'detección almacenamiento');
  doc=one(doc,":it.interact?it:{...it,interact:ForestShared.PROP_ACTIONS[it.type]?",
    ":it.interact?it:{...it,interact:window.FHStorageRuntime?.supports(it)?{id:'storage_'+it.id,verb:'storage',label:window.FH_STORAGE_STRINGS?.open||'Abrir inventario',effects:[]}:ForestShared.PROP_ACTIONS[it.type]?",'acción almacenamiento');
  doc=one(doc,'function useFurniture(item,selectedSeat=null){',
    "function useFurniture(item,selectedSeat=null){\n if(item.interact?.verb==='storage')return window.FHStorageRuntime?.open(item,currentFloor);\n if(item.runtimeDeliveryFurniture&&item.interact?.verb==='decorate')return fhStartDecoration(item,currentFloor);",'abrir almacenamiento');
  doc=one(doc,'function toggleDoor(){',
    'function toggleDoor(){if(window.FHStorageRuntime?.isOpen)return;','bloqueo con panel');
  const refresh="window.FHLocationHUD?.update(DATA,currentFloor,{x:user.x/CELL,y:user.z/CELL},FH_ROOF_PLANS[currentFloor])";
  doc=one(doc,refresh,refresh+';fhContextRefresh()','refresco');
  doc=one(doc,"if((k==='e'||k===' ')&&!e.repeat)toggleDoor();",
          "if((k==='e'||k===' ')&&!e.repeat&&!(k===' '&&document.activeElement===$('use'))){if(playerPose.occupied||!window.FHInteractionRadial?.activatePrimary())toggleDoor();}",'teclado');
  doc=one(doc,"$('use').addEventListener('click',toggleDoor);",
          "$('use').addEventListener('click',fhUseButtonClick);",'botón Usar');
  doc=one(doc,"$('pixelBtn').addEventListener('click',()=>{pixelSize=pixelSize===2?3:pixelSize===3?1:2;resize()});",
          "// Pixel 2x fijo en la interfaz del jugador.",'pixel');
  const base=new URL('./juego/assets/',global.document.baseURI).href;
  const css='<link rel="stylesheet" href="'+base+'fh-interaction-radial.css?v=20261107-door-four">';
  const strings='<script src="'+base+'fh-interaction-strings.js?v=20261108-elevator-radial"></'+'script>';
  const safeLock='<script src="'+base+'fh-safe-lock.js?v=20261107-safe-lock-2"></'+'script>';
  const renderer='<script src="'+base+'fh-interaction-radial.js?v=20261107-hold-gate"></'+'script>';
  const storageCss='<link rel="stylesheet" href="'+base+'fh-storage.css?v=20261108-storage-1">';
  const storageStrings='<script src="'+base+'fh-storage-strings.js?v=20261108-storage-1"></'+'script>';
  const storageRuntime='<script src="'+base+'fh-storage-runtime.js?v=20261108-hamazon-1"></'+'script>';
  const hide='<style>#actions,#fhDecorateBtn,#fhDecorStoredBtn{display:none!important}</style>';
  if(!doc.includes('</head>'))throw Error('Falta el cierre de cabecera del motor 3D');
  return doc.replace('</head>',css+strings+safeLock+renderer+storageCss+storageStrings+storageRuntime+hide+'</head>');
 }
 global.FHContextEngine=Object.freeze({patch});
})(typeof window!=='undefined'?window:globalThis);
