/* Blakpine-Wood: puente del motor 3D a FHServices; sin tarifas ni cambios al Base64. */
(function(root){
 'use strict';
 const once=(doc,before,after,where)=>{
  const n=doc.split(before).length-1;
  if(n!==1)throw Error('Hook de servicios incompatible: '+where+' ('+n+')');
  return doc.replace(before,after);
 };
 function patch(doc){
  // El motor embebido conserva una lista de frentes anterior al editor.
  // Sincronizarla antes del selector: evita que éste apunte hacia la pared
  // mientras Agua/Electricidad exigen interactuar desde el frente del GLB.
  const facing='const FACING_OBJECT_TYPES=new Set([';
  if(doc.includes(facing))doc=once(doc,facing,facing+
   "'power_outlet','router','landline_phone','water_main','water_valve','water_outlet','drain_outlet',",
   'frentes de instalaciones');
  const base=new URL('./juego/assets/',root.document.baseURI).href;
  const potable='<script src="'+base+'fh-water-potable.js?v=20261113-sotano-bombeo"></'+'script>';
  const hot='<script src="'+base+'fh-water-hot.js?v=20261113-sotano-bombeo"></'+'script>';
  const boilerCatalog='<script src="'+base+'fh-boilers-catalog.js?v=20261112-boilers-04"></'+'script>';
  const boilerStrings='<script src="'+base+'fh-boilers-strings.js?v=20261113-sotano-bombeo"></'+'script>';
  const core='<script src="'+base+'fh-services-core.js?v=20261113-pocket-items-1"></'+'script>';
  const equipment='<script src="'+base+'fh-equipment-core.js?v=20261113-pocket-items-1"></'+'script>';
  const exteriorCore='<script src="'+base+'fh-exterior-grid.js?v=20261111-pole-collision-1"></'+'script>';
   const exteriorVisual='<script src="'+base+'fh-exterior-visuals.js?v=20261111-exterior-03"></'+'script>';
   const strings='<script src="'+base+'fh-services-strings.js?v=20261113-portable-phone-1"></'+'script>';
  // El motor incrusta subdocumentos HTML como cadenas: hay varios </head>.
  // Insertar en el primer cierre (cabecera del documento exterior), como
  // hacen los otros adaptadores, y no exigir una ocurrencia única.
  const outerHead=doc.indexOf('</head>');
  if(outerHead<0)throw Error('Hook de servicios incompatible: falta cabecera exterior');
  const miniCore='<script src="'+base+'fh-repair-minigames-core.js?v=20261111-repair-1"></'+'script>';
  const miniStrings='<script src="'+base+'fh-repair-minigames-strings.js?v=20261111-repair-1"></'+'script>';
  const miniCss='<link rel="stylesheet" href="'+base+'fh-repair-minigames.css?v=20261111-repair-1">';
  const miniHud='<script src="'+base+'fh-repair-minigames.js?v=20261111-repair-1"></'+'script>';
  doc=doc.slice(0,outerHead)+exteriorCore+exteriorVisual+potable+hot+boilerCatalog+boilerStrings+core+equipment+strings+miniCore+miniStrings+miniCss+miniHud+doc.slice(outerHead);

  const pc='window.FHComputerRuntime=window.FHComputer?.createRuntime({';
  const pcOptions=[
   'networkFor:(stationId,f)=>{',
   ' const item=(DATA.floors[f]?.items||[]).find(v=>String(v.id)===String(stationId));',
   ' return item?.service?.internetMode&&item.service.internetMode!=="none"?window.FHServicesRuntime?.internetFor(f,item):null;',
   '},',
   'powerAvailable:(item,f)=>window.FHServicesRuntime?.statusFor(f,item).power.powered===true,'
  ].join('\n');
  doc=once(doc,pc,pc+'\n'+pcOptions,'computadoras');
  const phone='window.FHPhoneRuntime=window.FHPhone?.createRuntime({';
  const start=[
   // createGameState enumera propiedades y descarta services al cargar un guardado.
   // Recuperar la instancia seleccionada por readGameSave ANTES de crear runtime.
   'const fhServicesSaved=(restored||DATA.initialGameState)?.services;',
   'if(fhServicesSaved&&typeof fhServicesSaved==="object"&&!Array.isArray(fhServicesSaved))GameState.services=structuredClone(fhServicesSaved);',
   'window.FHServicesRuntime=window.FHServices?.createRuntime(DATA,GameState,{phoneOpen:()=>window.FHPhoneRuntime?.isOpen===true,torchActive:()=>lighting.state.enabled===true,isPc:(it,f)=>window.FHComputer?.isPc(it,DATA.floors[f]?.items||[],Number(DATA.units.feetPerCell)||5)});',
   'let fhServicesSaveAccum=0;',
   'let fhServicesATSRevision=window.FHServicesRuntime?.state.atsRevision;',
   'if(DATA.floors.some(f=>(f.items||[]).some(it=>it.type==="generator_ats")))saveProgress();',
   'window.FHServicesGame={',
   ' receiveFixedCall:(routerId,from)=>{',
   '  const target=DATA.floors.flatMap((floor,f)=>(floor.items||[]).filter(it=>it.type==="landline_phone"&&it.routerId===routerId&&window.FHServicesRuntime?.landlineFor(f,it)));',
   '  if(!target.length)return false;',
   '  const calls=window.FHServicesRuntime.state.calls ||= [];',
   '  calls.push({from:String(from||""),to:routerId,direction:"incoming",at:GameState.clock?.minutes||0});',
   '  notice("Llamada recibida en teléfono fijo.");saveProgress();return true;',
   ' },',
   ' repair:(it,f)=>{',
   '  const service=window.FHServicesRuntime;',
   '  if(!service||!window.FHRepairMiniGames?.supports(it))return false;',
   '  return window.FHRepairMiniGames.open({item:it,floor:f,service,onRepaired:()=>{fhServicesSyncVisuals();saveProgress();}});',
   ' },',
   ' chargeAt:(it,f,mode)=>{',
   '  window.FHServicesGame.chargerChoice=mode;',
   '  try{return window.FHServicesGame.handle(it,f)}finally{window.FHServicesGame.chargerChoice="";}',
   ' },',
   ' handle:(it,f)=>{',
   '  const service=window.FHServicesRuntime,T=window.FH_SERVICES_TEXT||{};',
   '  if(!service){notice(T.noPower||"Sin electricidad.");return true;}',
   '  if(Number(service.state.damage[it.id])>0&&window.FHRepairMiniGames?.supports(it))return window.FHServicesGame.repair(it,f);',
   '  if(it.type==="generator"){',
   '   const status=service.generatorStatus(f,it);if(!status)return false;',
   '   service.setGeneratorEnabled(f,it.id,!status.enabled);notice(T.generator.status(service.generatorStatus(f,it)));',
   '   fhServicesSyncVisuals();saveProgress();return true;',
   '  }',
   '  if(it.type==="generator_ats"){service.activateATSManual(f,it.id);notice(T.generator.atsStatus(service.atsStatus(f,it)));saveProgress();return true;}',
   '  if(it.type==="generator_tank"){notice(T.generator.tankStatus(service.tankStatus(f,it)));return true;}',
   '  const status=service.statusFor(f,it);',
   '  if(service.hotWater?.isBoiler(it)){notice(window.FH_BOILERS_TEXT?.report?.(service.hotWaterStatus(f,it))||"Caldera de agua caliente.");return true;}',
   '  if(it.type==="water_cistern"||it.type==="water_tinaco"){',
   '   const liters=Math.max(0,Number(status.water.liters)||0);',
   '   const capacity=Math.max(0,Number(it.capacityLiters)||0);',
   '   notice(window.FH_WATER_TEXT?.tankStatus?.(liters,capacity)||"Depósito potable: "+liters+" / "+capacity+" L");return true;',
   '  }',
   '  if(it.type==="phone_charger"){',
   '   if(service.phone.placedAt===it.id){service.takePhone();notice(T.phoneTaken||"Celular recuperado.");}',
   '   else if(service.chargePhone(f,it.id)){notice(T.phonePlaced||"Celular conectado al cargador.");}',
   '   else notice(T.chargerMissing||"El cargador no tiene corriente.");',
   '   window.FHPhoneRuntime?.syncAvailability?.();window.FHPhoneRuntime?.close?.();updateFlashlightUI();visibilityDirty=true;saveProgress();return true;',
   '  }',
   '  if(service.requiresPower(it)&&!status.power.powered){notice(T.noPower||"Sin electricidad.");return true;}',
   '  if(it.service?.requiresWater===true&&!status.water.water){notice(T.noWater||"Sin agua.");return true;}',
   '  if(it.service?.requiresWater===true){',
   '   const result=service.useWaterFixture(f,it);',
   '   if(result.ok){notice(result.mode==="pulse"?"Descarga de agua registrada.":result.opened?"Agua abierta.":"Agua cerrada.");saveProgress();}',
   '  }',
   '  if(it.type==="water_valve"){',
   '   const old=service.state.enabled[it.id];service.state.enabled[it.id]=old===undefined?it.opened===false:!old;',
   '   notice(service.state.enabled[it.id]?"Válvula abierta.":"Válvula cerrada.");saveProgress();return true;',
   '  }',
   '  if(it.type==="landline_phone"){',
   '   if(!service.landlineFor(f,it)){notice(T.noInternet||"Teléfono fuera de servicio.");return true;}',
   '   const calls=service.state.calls||=[];',
   '   const pending=calls.find(c=>c.direction==="incoming"&&(c.routerId||c.to)===it.routerId&&!c.answered);',
   '   if(pending){pending.answered=true;notice("Llamada atendida: "+pending.from);saveProgress();return true;}',
   '   const number=window.prompt?.("Número telefónico:");',
   '   if(number&&number.trim()){',
   '    const result=service.dial("fixed",f,it,number.trim());',
   '    if(!result.ok){notice("Número fuera de servicio.");return true;}',
   '    if(result.target.kind==="mobile")window.FHPhoneRuntime?.receiveCall?.({from:it.phoneNumber||it.id});',
   '    notice("Llamando a "+number.trim().slice(0,80));saveProgress();}',
   '   return true;',
   '  }',
   '  if(it.type==="power_outlet"){',
   '   const own=service.phone.placedAt===it.id&&service.phone.placedMode==="portable";',
   '   if(own){service.takePhone();window.FHPhoneRuntime?.syncAvailability?.();notice(T.phoneTaken);saveProgress();return true;}',
   '   if(!service.phone.placedAt&&(GameState.inventory?.includes("cell_phone_charger")||GameState.inventory?.includes("cell_phone_fast_charger"))){',
   '    if(service.chargePhone(f,it.id,window.FHServicesGame.chargerChoice||(GameState.inventory.includes("cell_phone_charger")?"cell_phone_charger":"cell_phone_fast_charger"))){window.FHPhoneRuntime?.syncAvailability?.();window.FHPhoneRuntime?.close?.();updateFlashlightUI();visibilityDirty=true;notice(T.phonePlaced);saveProgress();}',
   '    else notice(T.chargerCannotConnect);',
   '    return true;',
   '   }',
   '  }',
   '  if(it.type==="power_outlet"||it.type==="power_strip"){',
   '   notice((status.power.powered?"⚡ ":"⚡ Sin energía · ")+',
   '     (T.usedSlots||"Conexiones utilizadas")+": "+status.usedSlots+"/"+(status.slotCapacity||it.slots||2)+',
   '     " · "+Math.round(status.loadingRayos)+"/"+(it.capacityRayos||6)+" rayos");return true;',
   '  }',
   '  if(it.type==="router"){notice(status.internet.online?"Router con internet.":"Router sin conexión a internet.");return true;}',
   '  if(it.type==="drain_outlet"||it.type==="drain_main"){',
   '   notice(it.type==="drain_main"?"Salida principal del drenaje.":status.drain.draining?"Drenaje conectado.":"Drenaje sin salida.");return true;',
   '  }',
   '  if(it.type==="water_main"||it.type==="water_outlet"){',
   '    notice(status.water.water?"Agua disponible.":"Sin suministro de agua.");return true;',
   '  }',
   '  if(it.type==="ethernet_port"){const t=window.FH_INTERNET_TEXT||{};notice(status.internet.online?(t.portConnected||"Puerto conectado")+": "+status.usedSlots+"/"+status.portSlots:(t.portOffline||"Puerto Ethernet sin conexión"));return true;}',
   '  return false;',
   ' }',
   '};',
   'const fhExteriorVisuals=window.FHExteriorVisuals?.install({THREE,DATA,CELL,stories,service:window.FHServicesRuntime,applyFOW:installVisibility});',
    'const fhServicesVisuals=[];',
   'for(let f=0;f<DATA.floors.length;f++){',
   ' for(const it of DATA.floors[f].items||[]){',
   '  if(!window.FHServices?.INFRA.has(it.type))continue;',
   '  // Los equipos Agua 02/03 usan sus GLB, no crear cajas de infraestructura.',
   '  if(window.FHWaterVisuals?.choose(it))continue;',
   '  if(["generator","generator_ats","generator_tank"].includes(it.type)){',
   '   const entry=renderedByItem[f]?.get?.(it.id)?.[0],mesh=entry?.root||entry;',
   '   if(mesh){mesh.userData.fhServiceItem=it.id;fhServicesVisuals.push({mesh,it,f});}continue;',
   '  }',
   '  if(it.type==="power_outlet"){',
   '   const existing=renderedByItem[f]?.get?.(it.id)||[];',
   '   if(existing.length){',
   '    for(const entry of existing){const mesh=entry?.root||entry;if(!mesh)continue;',
   '     mesh.userData.fhServiceItem=it.id;fhServicesVisuals.push({mesh,it,f});}',
   '    continue;',
   '   }',
   '  }',
   '  const mat=new THREE.MeshStandardMaterial({color:({power_outlet:0xd9bd74,power_strip:0xa89e8a,phone_charger:0x98b6a2,',
   '   water_main:0x528bac,water_valve:0x529dbb,water_outlet:0x76b1c8,water_cistern:0x4f7088,water_tinaco:0x7391a0,drain_outlet:0x52707f,drain_main:0x456b80,router:0x678c98,',
   '   ethernet_port:0x6c9d9a,landline_phone:0x9099a7})[it.type]||0x999999,roughness:1});',
   '  const wall=["power_outlet","water_main","water_valve","water_outlet","drain_outlet","drain_main","ethernet_port","landline_phone"].includes(it.type);',
   '  const mesh=new THREE.Mesh(new THREE.BoxGeometry(Math.max(.11,Number(it.w||.3)*CELL),wall?.14:.28,Math.max(.11,Number(it.h||.3)*CELL)),mat);',
   '  mesh.position.set(it.x*CELL,wall?1.05:.20,it.y*CELL);',
   '  mesh.rotation.y=(Number(it.rotation)||0)*Math.PI/180;',
   '  mesh.userData.fhServiceItem=it.id;',
   '  stories[f]?.add(mesh);fhServicesVisuals.push({mesh,it,f});',
   '  renderedByItem[f]?.set?.(it.id,[{root:mesh}]);',
   ' }',
   '}',
   'function fhServicesSyncVisuals(){',
    ' fhExteriorVisuals?.update();',
   ' const service=window.FHServicesRuntime,session=window.FHComputerRuntime?.session;',
   ' if(session&&service){const item=service.itemAt(session.floor,session.stationId);if(!item||!service.statusFor(session.floor,item).power.powered)window.FHComputerRuntime.close();}',
   ' if(typeof watchingTvId!=="undefined"&&watchingTvId&&service){const tv=service.itemAt(currentFloor,watchingTvId);if(!tv||!service.statusFor(currentFloor,tv).power.powered){watchingTvId=null;GameState.flags.tv_on=false;}}',
   ' for(const entry of fhServicesVisuals){',
   '  if(entry.it.type==="generator"){const status=service?.generatorStatus(entry.f,entry.it);entry.mesh.material?.color?.setHex(status?.running?0x7a9d66:status?.enabled?0xb19756:0x555b60);entry.mesh.userData.generatorStatus=status;}',
   '  if(!["phone_charger","power_outlet"].includes(entry.it.type))continue;',
   '  const hasPhone=window.FHServicesRuntime?.phone.placedAt===entry.it.id&&',
   '   (entry.it.type==="phone_charger"||window.FHServicesRuntime?.phone.placedMode==="portable");',
   '  if(hasPhone&&!entry.phone){',
   '   entry.phone=new THREE.Mesh(new THREE.BoxGeometry(.17,.035,.29),new THREE.MeshStandardMaterial({color:0x242d35}));',
   '   entry.mesh.add(entry.phone);entry.phone.position.set(0,.18,0);',
   '  }',
   '  if(entry.phone)entry.phone.visible=hasPhone;',
   ' }',
   '}'
  ].join('\n');
  const phoneOptions=[
   'networks:()=>{',
   ' const f=currentFloor,px=user.x/CELL,pz=user.z/CELL;',
   ' return (window.FHServicesRuntime?.wifiAt(f,px,pz)||[]).map(n=>({...n,name:window.FHServicesRuntime.itemAt(n.floor,n.routerId)?.label||n.routerId}));',
   '},',
   'networkDelayMs:()=>{',
   ' const service=window.FHServicesRuntime;',
   ' const best=(service?.wifiAt(currentFloor,user.x/CELL,user.z/CELL)||[]).find(n=>n.online);',
   ' return best?Math.round(Math.min(1800,Math.max(0,(1/Math.max(.1,best.speedFactor)-1)*500))):0;',
   '},',
   'connectWifi:(id,password)=>window.FHServicesRuntime?.connectWifi(id,password)===true,',
   'mobileAvailable:()=>window.FHServicesRuntime?.mobileFor()===true,',
   'phoneEquipped:()=>window.FHEquipmentCore?.hasEquipped(GameState,"cell_phone")!==false,',
   'networkAvailable:()=>window.FHServicesRuntime?.mobileFor()===true||',
   ' (window.FHServicesRuntime?.wifiAt(currentFloor,user.x/CELL,user.z/CELL)||[]).some(n=>n.online),',
   'onCall:c=>{',
   ' const result=window.FHServicesRuntime?.dial("mobile",currentFloor,null,c.to);',
   ' if(!result?.ok)return false;',
   ' if(result.target.kind==="mobile")window.FHPhoneRuntime?.receiveCall?.({from:GameState.phone?.phoneNumber||"celular"});',
   ' saveProgress();return true;},'
  ].join('\n');
  doc=once(doc,phone,start+'\n'+phone+'\n'+phoneOptions,'inicialización');

  doc=once(doc,'window.FHPhoneRuntime?.update(dt);',
   'window.FHServicesRuntime?.tick(dt,Number(GameState.clock?.minutesPerSecond)||1);fhServicesSyncVisuals();if(fhServicesATSRevision!==window.FHServicesRuntime?.state.atsRevision){fhServicesATSRevision=window.FHServicesRuntime?.state.atsRevision;saveProgress();}'+
   'fhServicesSaveAccum+=dt;if(fhServicesSaveAccum>=15){fhServicesSaveAccum=0;saveProgress();}'+
   'window.FHPhoneRuntime?.update(dt);','actualización');

  doc=once(doc,'function useFurniture(item,selectedSeat=null){',
   'function useFurniture(item,selectedSeat=null){'+
   'if(window.FHServicesGame?.handle(item,currentFloor))return;','interacción');

  // Los equipos eléctricos antiguos también requieren una conexión real.
  doc=once(doc,'window.FHStorageRuntime?.supports(it))',
   'window.FHStorageRuntime?.supports(it)||window.FHServices?.INFRA.has(it.type))','selección');

  const gesture='const gesture=fhContextGesture;fhContextGesture=null;';
  const warning=[
   'if(key.startsWith("furniture:")){',
   ' const sid=key.slice(key.lastIndexOf(":")+1);',
   ' const it=(DATA.floors[currentFloor]?.items||[]).find(v=>String(v.id)===sid);',
   ' if(it){const st=window.FHServicesRuntime?.statusFor(currentFloor,it);',
   '  if(it.type==="generator"){const status=window.FHServicesRuntime?.generatorStatus(currentFloor,it);if(status)actions=[{id:"generator",label:window.FH_SERVICES_TEXT.generator.action(status),run:()=>window.FHServicesGame.handle(it,currentFloor)},{id:"generator-status",label:window.FH_SERVICES_TEXT.generator.inspect,run:()=>notice(window.FH_SERVICES_TEXT.generator.status(window.FHServicesRuntime.generatorStatus(currentFloor,it)))}];}',
   '  if(it.type==="generator_ats"){const status=window.FHServicesRuntime.atsStatus(currentFloor,it);const t=window.FH_SERVICES_TEXT.generator;actions=[{id:"ats-status",label:t.atsStatus(status),run:()=>notice(t.atsStatus(window.FHServicesRuntime.atsStatus(currentFloor,it)))},{id:"ats-manual",label:t.manual,disabled:!status.connected||!status.outage||status.damaged,run:()=>window.FHServicesGame.handle(it,currentFloor)}];}',
   '  if(it.type==="generator_tank")actions=[{id:"tank-status",label:window.FH_SERVICES_TEXT.generator.inspect,run:()=>window.FHServicesGame.handle(it,currentFloor)}];',
   '  if(it.type==="power_outlet"&&(GameState.inventory?.includes("cell_phone_charger")||GameState.inventory?.includes("cell_phone_fast_charger")||GameState.phone?.placedAt===it.id&&GameState.phone?.placedMode==="portable")){',
   '   const take=GameState.phone?.placedAt===it.id&&GameState.phone?.placedMode==="portable";',
   '   const t=window.FH_SERVICES_TEXT;',
   '   actions=take?[{id:"phone-take",label:t.takePhone,run:()=>window.FHServicesGame.handle(it,currentFloor)}]:[];',
   '   if(!take&&GameState.inventory?.includes("cell_phone_charger"))actions.push({id:"phone-charge",label:t.chargerAction,run:()=>window.FHServicesGame.chargeAt(it,currentFloor,"cell_phone_charger")});',
   '   if(!take&&GameState.inventory?.includes("cell_phone_fast_charger"))actions.push({id:"phone-fast",label:t.chargerFastAction,run:()=>window.FHServicesGame.chargeAt(it,currentFloor,"cell_phone_fast_charger")});',
   '  }',
   '  if(Number(window.FHServicesRuntime?.state.damage[it.id])>0&&window.FHRepairMiniGames?.supports(it)){',
   '   actions=[{id:"repair",label:window.FH_REPAIR_MINI_TEXT.title,run:()=>window.FHServicesGame.repair(it,currentFloor)}];',
   '  }else if(window.FHServicesRuntime?.requiresPower(it)&&!st?.power.powered||it.service?.requiresWater===true&&!st?.water.water){',
   '   actions=[{id:"blocked",label:window.FHServicesRuntime?.requiresPower(it)&&!st?.power.powered?"🔴⚡ Sin electricidad":"🔴💧 Sin agua",disabled:true}];',
   '  }',
   ' }',
   '}'
  ].join('\n');
  doc=once(doc,gesture,warning+'\n'+gesture,'radial');
  const television=' const tv=combo.tv;';
  if(doc.includes(television))doc=once(doc,television,television+'\n if(window.FHServicesRuntime?.statusFor(currentFloor,tv)?.power.powered!==true){notice(window.FH_SERVICES_TEXT?.noPower||"Sin electricidad.");return {ok:false,reason:"noPower"};}','televisor');
  const elevator="return lighting.powered(stop.f,stop.item.zoneId||'');";
  if(doc.includes(elevator))doc=once(doc,elevator,'return window.FHServicesRuntime?.statusFor(stop.f,stop.item).power.powered===true;','ascensor');
  else if(doc.includes('const elevatorSystem=ForestShared.createElevatorMachine'))throw Error('No se encontró la consulta de suministro del elevador');

  // El motor original se conserva en Base64. Estos ajustes operan sobre
  // su documento 3D decodificado, y no alteran ni su esquema ni los bundles.
  // Los fixtures parciales de servicios no contienen el motor completo.
  if(doc.includes('function createGameState(initial={}){')&&doc.includes('function makeInventorySprite(def,id,{large=false}={}){')){
  doc=once(doc,"flashlight:initial.flashlight&&typeof initial.flashlight==='object'?{...initial.flashlight}:null,hidden:",
   "flashlight:initial.flashlight&&typeof initial.flashlight==='object'?{...initial.flashlight}:null,phone:initial.phone&&typeof initial.phone==='object'?{...initial.phone}:null,equipment:initial.equipment&&typeof initial.equipment==='object'?structuredClone(initial.equipment):null,hidden:",'persistencia del celular');
  doc=once(doc,"const itemDefs=[...(DATA.itemDefs||[])];",
   "const itemDefs=window.FHEquipmentCore.itemDefinitions(DATA.itemDefs||[]);",'catálogo de equipamiento');
  doc=once(doc,"const GameState=createGameState(restored||DATA.initialGameState);",
   "const GameState=createGameState(restored||DATA.initialGameState);\nwindow.FHEquipmentCore.ensure(GameState);",'equipamiento inicial');
  doc=once(doc,"const GameEvents=createEventBus();",
   "window.FHEquipmentGame={state:GameState,itemDefs,save:saveProgress,refresh:()=>{renderInventory();window.FHPhoneRuntime?.syncAvailability?.()}};\nconst GameEvents=createEventBus();",'API de equipamiento');
  const oldLight=" state.flashlight={enabled:!!f.enabled,charge:clampLight(Number.isFinite(Number(f.charge))?Number(f.charge):100,0,100)};\n const light=state.flashlight;";
  const newLight=[
   " const oldCharge=Number.isFinite(Number(f.charge))?Number(f.charge):100;",
   " const phone=state.phone&&typeof state.phone==='object'?state.phone:{};",
   " if(!Number.isFinite(Number(phone.battery)))phone.battery=clampLight(oldCharge,0,100);",
   " state.phone=phone;",
   " state.flashlight={enabled:!!f.enabled};",
   " const light=state.flashlight;",
   " Object.defineProperty(light,'charge',{enumerable:true,configurable:true,",
   "  get:()=>clampLight(Number(state.phone.battery)||0,0,100),",
   "  set:value=>{state.phone.battery=clampLight(Number(value)||0,0,100)}});"
  ].join("\n");
  doc=once(doc,oldLight,newLight,'batería compartida');
  doc=once(doc,
   "function tick(dt){if(!light.enabled)return false;const old=light.charge;light.charge=clampLight(light.charge-clampLight(dt,0,.10)*(Number(config.drainPerSecond)||.30),0,100);if(light.charge===0)light.enabled=false;return old!==light.charge}",
   "function tick(dt){if(!light.enabled)return false;if(light.charge<=0||state.phone.placedAt){light.enabled=false;return true;}return false}",'descarga duplicada de linterna');
  doc=once(doc,
   "function toggleFlashlight(){if(light.charge<=0){light.enabled=false;return {ok:false,reason:'empty'}}light.enabled=!light.enabled;return {ok:true,enabled:light.enabled,charge:light.charge}}",
   "function toggleFlashlight(){if(light.charge<=0||state.phone.placedAt){light.enabled=false;return {ok:false,reason:'empty'}}light.enabled=!light.enabled;return {ok:true,enabled:light.enabled,charge:light.charge}}",
   'linterna conectada');
  const sprite=" if(def?.icon){const label=document.createElement('span');label.className='itemIconText';label.textContent=def.icon;node.append(label);}";
  const spriteWithImage=[
   " if(window.FHEquipmentCore?.ICONS[id]){",
   "  const img=document.createElement('img');img.className='fh-charger-item-art';",
   "  img.src=new URL('./juego/assets/'+window.FHEquipmentCore.ICONS[id],document.baseURI).href;",
   "  img.alt=def?.name||'Cargador de celular';",
   "  img.style.width=large?'82%':'92%';img.style.height='92%';img.style.objectFit='contain';img.style.imageRendering='pixelated';",
   "  node.append(img);",
   " }else if(def?.icon){const label=document.createElement('span');label.className='itemIconText';label.textContent=def.icon;node.append(label);}"
  ].join("\n");
  doc=once(doc,sprite,spriteWithImage,'ícono en inventario');

  const equipmentUI=[
   "function fhRearPockets(){",
   " const core=window.FHEquipmentCore,eq=core?.ensure(GameState);if(!eq)return;",
   " const host=$('inventoryPanel');if(!host)return;",
   " let section=host.querySelector('#fhRearPockets');",
   " if(!section){section=document.createElement('section');section.id='fhRearPockets';host.append(section)}",
   " section.replaceChildren();",
   " const title=document.createElement('h3');title.textContent='Equipamiento · bolsillos traseros';section.append(title);",
   " for(const slot of core.SLOTS){",
   "  const id=eq[slot],selected=selectedInventoryId&&['cell_phone','wallet'].includes(selectedInventoryId)?selectedInventoryId:(GameState.inventory.includes('cell_phone')?'cell_phone':GameState.inventory.includes('wallet')?'wallet':'');",
   "  const b=document.createElement('button');b.type='button';b.style.cssText='min-height:44px;margin:4px;padding:8px;border:1px solid #677784;background:#18222c;color:#eee';",
   "  b.textContent=(slot==='rearLeft'?'Bolsillo trasero izquierdo: ':'Bolsillo trasero derecho: ')+(id?(itemDefs.find(x=>x.id===id)?.name||id):'Vacío')+(id?' · Quitar':selected?' · Equipar '+(itemDefs.find(x=>x.id===selected)?.name||selected):'');",
   "  b.onclick=()=>{const result=id?core.unequip(GameState,slot):core.equip(GameState,selected,slot);",
   "   if(!result.ok){notice(result.reason==='full'?'Inventario lleno.':'No se puede cambiar el equipamiento.');return;}core.sweepWallet(GameState,itemDefs);renderInventory();window.FHPhoneRuntime?.syncAvailability?.();saveProgress();};",
   "  if(id&&core.ICONS[id]){const img=document.createElement('img');img.src=new URL('./juego/assets/'+core.ICONS[id],document.baseURI).href;img.alt='';img.style.cssText='width:28px;height:28px;object-fit:contain;image-rendering:pixelated;vertical-align:middle;margin-right:8px';b.prepend(img)}",
   "  section.append(b);",
   " }",
   " if(!core.walletAvailable(GameState))return;",
   " const heading=document.createElement('h4');heading.textContent='Cartera · efectivo y tarjetas';section.append(heading);",
   " if(!eq.wallet.items.length){const empty=document.createElement('p');empty.textContent='Cartera vacía.';section.append(empty)}",
   " for(const id of eq.wallet.items){const b=document.createElement('button');b.type='button';b.style.cssText='min-height:44px;margin:4px;padding:8px';b.textContent=(itemDefs.find(x=>x.id===id)?.name||id)+' · Sacar';",
   "  b.onclick=()=>{const result=core.moveFromWallet(GameState,id);if(!result.ok){notice('Inventario lleno.');return;}renderInventory();saveProgress()};section.append(b)}",
   "}"
  ].join("\n");
  doc=once(doc,"function renderInventory(){",equipmentUI+"\nfunction renderInventory(){",'interfaz de bolsillos');
  doc=once(doc," updateInventoryActions(def,selectedInventoryId);\n}",
   " updateInventoryActions(def,selectedInventoryId);\n fhRearPockets();\n}",'render de equipamiento');
  doc=once(doc," if(def.kind==='note'){",
   " if(window.FHEquipmentCore?.walletAvailable(GameState)&&['cash','card','physical_cash','physical_card'].includes(def.storageCategory||def.walletCategory)){",
   "  secondary.hidden=false;secondary.textContent='Guardar en cartera';secondary.onclick=()=>{const result=window.FHEquipmentCore.moveToWallet(GameState,id,itemDefs);if(result.ok){renderInventory();saveProgress()}};",
   " }",
   " if(def.kind==='note'){",'acción de cartera');

  }
  // Recoger dinero y tarjetas con cartera equipada no consume espacios generales.
  if(doc.includes("GameEvents.on('item:given',({id})=>{notice(INTERACTION_TEXT.itemFound")){
  doc=once(doc,"GameEvents.on('item:given',({id})=>{notice(INTERACTION_TEXT.itemFound(ForestShared.itemDefById(itemDefs,id)?.name||id));renderInventory();});",
   "GameEvents.on('item:given',({id})=>{window.FHEquipmentCore?.sweepWallet(GameState,itemDefs);notice(INTERACTION_TEXT.itemFound(ForestShared.itemDefById(itemDefs,id)?.name||id));renderInventory();});",'recogida de tarjeta o efectivo');
  }
  // fixturePowered ya consulta sourceFor; no recalcular los enchufes por cada foco.
  doc=root.FHInternetVisuals?.patchEngineDoc(doc)||doc;
  doc=root.FHElectricVisuals?.patchEngineDoc(doc)||doc;
  return root.FHWaterVisuals?.patchEngineDoc(doc)||doc;
 }
 root.FHServicesEngine=Object.freeze({patch});
})(typeof window!=='undefined'?window:globalThis);

