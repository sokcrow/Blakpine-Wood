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
              'if(!fhDeliveryUiActive)moveUpdate(dt);else{user.vx=user.vz=0;}','movimiento');
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
function fhContextData(){
 const t=window.FH_INTERACTION_STRINGS||{};
 if(peeking||breakerPanelItem||stairTravel||fhDeliveryUiActive||window.FHComputerRuntime?.isOpen||fhStoredUiActive){
  return null;
 }
 let key='',title='',point={x:innerWidth*.5,y:innerHeight*.53},actions=[],hitRoots=[];
 const rootsFor=id=>id?(renderedByItem[currentFloor]?.get(id)||[]):[];
 if(fhDecorMode){
  if(fhDecorationActive){
   const a=fhDecorationActive,it=a.item;
   key='decor:'+a.floor+':'+it.id;title=it.label||it.modelId||it.type||t.furniture;
   point=fhContextPoint(a.preview.x*CELL,a.preview.y*CELL,a.floor);
   hitRoots=a.roots.map(entry=>entry.root).filter(Boolean);
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
    hitRoots=rootsFor(it.id);
    actions.push({id:'select',label:t.decorateSelect||'Seleccionar / mover',run:()=>fhStartDecoration(it,nearest.floor)});
   }
   if(stored.length)actions.push({id:'stored',label:t.decorateStore||'Muebles guardados',run:()=>{
     fhDecorStoredList();fhStoredUiActive=true;fhEnsureDecorationUi().storedPanel.hidden=false;window.FHInteractionRadial?.hide();
   }});
   if(!key&&stored.length){key='stored';title=t.decorate||'Decorar';}
  }
 }else{
  const courier=fhDeliveryNpc,order=(window.FHDeliveryRuntime?.orders||[])
    .find(o=>['waiting','payment','delivering'].includes(o.status));
  if(courier&&courier.parent===stories[currentFloor]&&order
    &&Math.hypot(courier.position.x-user.x,courier.position.z-user.z)<2.2){
   const door=fhDeliveryDoorById(order.doorId,order.floor);
   if(door){
    key='courier:'+order.id;title=t.courier||'Repartidor';
    point=fhContextPoint(courier.position.x,courier.position.z);
    hitRoots=[courier];
    actions.push({id:'talk',label:t.talk||'Hablar',run:()=>window.FHDeliveryRuntime?.talkToCourier?.(door)});
   }
  }
  if(!actions.length){
   if(occupiedShaft()){
    key='elevator:inside';title=t.elevator||'Ascensor';
    hitRoots=[elevatorCabMeshes.get(occupiedShaft().id)].filter(Boolean);
    actions=[{id:'panel',label:$('use').textContent,run:toggleDoor}];
   }else if(playerPose.occupied){
    key='pose:'+String(playerPoseItem?.id||'player');title=playerPoseItem?.label||t.furniture||'Mueble';
    hitRoots=rootsFor(playerPoseItem?.id);
    const front=fhSeatFrontTarget(),tv=currentTVCombo();
    actions=[{id:'stand',label:$('use').textContent,run:toggleDoor}];
    if(front||tv)actions.push({id:'watch',label:$('watchTv').textContent,run:fhUseFrontFromSeat});
   }else{
    const selected=useTarget(),target=selected?.target;
    if(selected&&target){
     if(selected.kind==='furniture'){
      const it=target.item;key='furniture:'+currentFloor+':'+it.id;
      title=it.label||it.modelId||it.type||t.furniture||'Mueble';
      const anchor=interactableAnchor(it);point=fhContextPoint(anchor.x*CELL,anchor.y*CELL);
      hitRoots=rootsFor(it.id);
     }else if(selected.kind==='door'){
      key='door:'+currentFloor+':'+target.id;title=target.label||t.door||'Puerta';
      point=fhContextPoint(target.cx,target.cz);
      hitRoots=rootsFor(target.id);
     }else if(selected.kind==='elevator'){
      key='elevator:'+target.shaftId;title=t.elevator||'Ascensor';
      point=fhContextPoint(target.x,target.z);
      hitRoots=rootsFor(target.item?.id);
     }else if(selected.kind==='stairs'){
      key='stairs:'+currentFloor+':'+target.item?.id;title=t.stairs||'Escalera';
      point=fhContextPoint(target.x,target.z);
      hitRoots=rootsFor(target.item?.id);
     }
     actions.push({id:'primary',label:$('use').textContent||t.interact||'Interactuar',run:toggleDoor});
     if(selected.kind==='door'){
      const canLook=target.kind==='peephole_door'&&!target.open&&isInsideDoor(target);
      // Cuatro sectores constantes; las mecánicas pendientes permanecen deshabilitadas.
      actions.push({id:'peephole',label:t.peepholeShort||'Mirilla',disabled:!canLook,
       ...(canLook?{run:peephole}:{})});
      actions.push({id:'knock',label:t.knock||'Llamar',disabled:true});
      actions.push({id:'examine',label:t.examine||'Examinar',disabled:true});
     }
    }
   }
  }
 }
 return actions.length?{key,title,actions,x:point.x,y:point.y,hitRoots}:null;
}
function fhContextRefresh(){
 const radial=window.FHInteractionRadial;
 if(radial?.visible)radial.update(fhContextData());
}
// El Raycaster de Three.js r128 incluye mallas ocultas por el corte de cámara.
// La intersección válida más cercana debe ser visible en toda su jerarquía.
function fhRadialVisibleHit(intersections,root){
 return intersections.find(hit=>{
  for(let object=hit.object;object;object=object.parent){
   if(object.visible===false)return false;
   if(object===root)return true;
  }
  return false;
 })||null;
}
// Solo el objeto 3D pulsado puede autorizar la apertura del radial.
function fhContextTap(event){
 const radial=window.FHInteractionRadial,context=fhContextData();
 if(!radial||!context?.hitRoots?.length)return false;
 const rect=$('view').getBoundingClientRect();
 if(!rect.width||!rect.height)return false;
 const ray=new THREE.Raycaster();
 ray.setFromCamera(new THREE.Vector2(
  (event.clientX-rect.left)/rect.width*2-1,
  -(event.clientY-rect.top)/rect.height*2+1),cam);
 const closest=fhRadialVisibleHit(ray.intersectObjects(stories[currentFloor].children,true),stories[currentFloor]);
 if(!closest)return false;
 for(let object=closest.object;object;object=object.parent){
  if(context.hitRoots.includes(object)){
   const storedButton=$('fhDecorStoredBtn');if(storedButton)storedButton.hidden=true;
   return radial.open({...context,x:event.clientX,y:event.clientY});
  }
  if(object===stories[currentFloor])break;
 }
 return false;
}
`;
  doc=one(doc,'function hudUpdate(){',code+'\nfunction hudUpdate(){','HUD');
  // El botón ya existe en el motor: conservarlo únicamente para el inventario
  // de muebles guardados cuando el jugador activa Decorar en su menú.
  doc=one(doc,'ui.storedButton.hidden=!eligible||!hasStored;',
    'ui.storedButton.hidden=!fhDecorMode||!eligible||!hasStored||!!window.FHInteractionRadial?.visible;',
    'entrada a muebles guardados');
  doc=one(doc,
    "storedButton.onclick=()=>{fhStoredUiActive=!fhStoredUiActive;storedPanel.hidden=!fhStoredUiActive;if(fhStoredUiActive)fhDecorStoredList()};",
    "storedButton.onclick=()=>{window.FHInteractionRadial?.hide();fhStoredUiActive=!fhStoredUiActive;storedPanel.hidden=!fhStoredUiActive;if(fhStoredUiActive)fhDecorStoredList()};",
    'no superponer el panel de muebles guardados');
  // Un tap corto sobre el canvas, no un arrastre ni un pellizco de cámara.
  const viewAnchor="const view=$('view'),cameraTouches=new Map();let pinchDistance=0,wasPinching=false;";
  const viewClick=String.raw`
const fhRadialPresses=new Map();
view.addEventListener('pointerdown',event=>{
 if(event.button!==undefined&&event.button!==0)return;
 if(fhRadialPresses.size)for(const press of fhRadialPresses.values())press.multiple=true;
 fhRadialPresses.set(event.pointerId,{
  x:event.clientX,y:event.clientY,time:performance.now(),multiple:fhRadialPresses.size>0
 });
});
view.addEventListener('pointerup',event=>{
 const press=fhRadialPresses.get(event.pointerId);
 fhRadialPresses.delete(event.pointerId);
 // Este mismo tap cerró un menú: no abrir otro hasta un nuevo toque.
 if(window.FHInteractionRadial?.consumeOutsidePress(event.pointerId))return;
 if(!press||press.multiple||fhRadialPresses.size)return;
 if(performance.now()-press.time>550||Math.hypot(event.clientX-press.x,event.clientY-press.y)>12)return;
 fhContextTap(event);
});
view.addEventListener('pointercancel',event=>fhRadialPresses.delete(event.pointerId));
`;
  doc=one(doc,viewAnchor,viewAnchor+viewClick,'tap sobre objetivo 3D');
  const refresh="window.FHLocationHUD?.update(DATA,currentFloor,{x:user.x/CELL,y:user.z/CELL})";
  doc=one(doc,refresh,refresh+';fhContextRefresh()','refresco');
  doc=one(doc,"if((k==='e'||k===' ')&&!e.repeat)toggleDoor();",
          "if((k==='e'||k===' ')&&!e.repeat){if(!window.FHInteractionRadial?.activatePrimary())toggleDoor();}",'teclado');
  doc=one(doc,"$('pixelBtn').addEventListener('click',()=>{pixelSize=pixelSize===2?3:pixelSize===3?1:2;resize()});",
          "// Pixel 2x fijo en la interfaz del jugador.",'pixel');
  const base=new URL('./juego/assets/',global.document.baseURI).href;
  const css='<link rel="stylesheet" href="'+base+'fh-interaction-radial.css?v=20261107-click-fix-review">';
  const strings='<script src="'+base+'fh-interaction-strings.js?v=20261107-click-fix-review"></'+'script>';
  const renderer='<script src="'+base+'fh-interaction-radial.js?v=20261107-click-fix-review"></'+'script>';
  const hide='<style>#actions,#fhDecorateBtn{display:none!important}</style>';
  if(!doc.includes('</head>'))throw Error('Falta el cierre de cabecera del motor 3D');
  return doc.replace('</head>',css+strings+renderer+hide+'</head>');
 }
 global.FHContextEngine=Object.freeze({patch});
})(typeof window!=='undefined'?window:globalThis);
