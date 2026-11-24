/* Adaptador del documento 3D existente. Inserta el comportamiento sin reescribir el motor. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHMedievalLightEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function patchEngineDoc(source,baseURI){
  if(typeof source!=='string')throw TypeError('MEDIEVAL_ENGINE_DOCUMENT_REQUIRED');
  let doc=source;
  function inject(before,after){
   const count=typeof before==='string'?doc.split(before).length-1:[...doc.matchAll(before)].length;
   if(count!==1)throw Error('MEDIEVAL_LIGHTING_HOOK_MISSING: '+String(before).slice(0,70)+' count '+count);
   doc=doc.replace(before,after);
  }
  inject("function fixtureLit(floor,room,fixture){",
    "function fixtureLit(floor,room,fixture){\n  if(window.FHMedievalLighting?.isMedieval(fixture?.lightKind))return window.FHMedievalRuntime?.lit(floor,fixture)===true;");
  inject("const GameState=createGameState(restored||DATA.initialGameState);",
    "const GameState=createGameState(restored||DATA.initialGameState);\nGameState.medievalLighting=structuredClone(restored?.medievalLighting||DATA.initialGameState?.medievalLighting||{});");
  inject(/const lighting=ForestShared\.createLightingSystem\(DATA\.floors,GameState(?:,\{[^\r\n]*\})?\);/g,
    declaration=>declaration+"\nconst fhMedievalRuntime=window.FHMedievalLighting.createRuntime({floors:DATA.floors,state:GameState,\n  clock:()=>window.FHMedievalLighting.absoluteMinute(GameState.clock),\n  player:()=>({floor:currentFloor,x:user.x,z:user.z}),lights:window.FHLights,cell:CELL});\nwindow.FHMedievalRuntime=fhMedievalRuntime;");
  inject("const GameEvents=createEventBus();",`const GameEvents=createEventBus();
const fhMedievalUI=window.FHMedievalLightUI.create({runtime:fhMedievalRuntime,state:GameState,
 canUse:(floor,item)=>floor===currentFloor&&(fhMedievalRuntime.isCarried(item.id)||furnitureTarget()?.item.id===item.id),
 changed:result=>{roomLightsDirty=true;visibilityDirty=true;renderInventory();
  if(result.ok)saveProgress();else notice(window.FH_MEDIEVAL_LIGHT_TEXT[result.reason]||window.FH_MEDIEVAL_LIGHT_TEXT.missing);}});
const fhDropButton=document.createElement('button');
fhDropButton.type='button';fhDropButton.id='fhMedievalDropTorch';
fhDropButton.textContent=window.FH_MEDIEVAL_LIGHT_TEXT.drop;fhDropButton.hidden=true;
fhDropButton.style.cssText='position:fixed;right:12px;bottom:88px;z-index:14;min-height:44px;padding:8px 14px;background:#32251c;color:#ffe3ad;border:1px solid #b99961;cursor:pointer';
document.body.append(fhDropButton);
fhDropButton.onclick=()=>{if(fhMedievalRuntime.drop()){notice(window.FH_MEDIEVAL_LIGHT_TEXT.dropped);roomLightsDirty=true;visibilityDirty=true;saveProgress();}else notice(window.FH_MEDIEVAL_LIGHT_TEXT.wrongFloor);};`);
  inject("function useFurniture(item,selectedSeat=null){",`function useFurniture(item,selectedSeat=null){
 if(item.medievalFuel){
  const result=performInteraction(item,GameState,GameEvents,Date.now()/1000,itemDefs);
  if(result.ok){visibilityDirty=true;renderInventory();saveProgress();}else if(result.text)notice(result.text);
  return result;
 }
 if(item.type==='light_fixture'&&window.FHMedievalLighting.isMedieval(item.lightKind)){
  return {ok:fhMedievalUI.open(currentFloor,item)};
 }`);
  inject("function moveUpdate(dt){","function moveUpdate(dt){if(fhMedievalUI.isOpen()){user.vx=user.vz=0;user.walking=false;return;}");
  inject("function furniture(f,a){",`function furniture(f,a){
 if(a.type==='light_fixture'&&window.FHMedievalLighting.isMedieval(a.lightKind)){
  const g=new THREE.Group();stories[f].add(g);g.position.set(a.x*CELL,0,a.y*CELL);
  furnitureSightRoots[f].push({item:a,root:g});return g;
 }
 if(window.FHMedievalLighting.fuelItems[a.medievalFuel]){
  const g=new THREE.Group();stories[f].add(g);g.position.set(a.x*CELL,.03,a.y*CELL);
  g.rotation.y=-(Number(a.rotation)||0)*Math.PI/180;
  window.FHMedievalFireVisual.attachFuel(THREE,g,a);furnitureSightRoots[f].push({item:a,root:g});return g;
 }`);
  const pickup="(item.type!=='battery_pickup'||!GameState.used[item.interact?.id])";
  doc=doc.split(pickup).join("((item.type!=='battery_pickup'&&!item.medievalFuel)||!GameState.used[item.interact?.id])");
  inject("lighting.tick(dt);",`lighting.tick(dt);
if(fhMedievalRuntime.tick()){roomLightsDirty=true;visibilityDirty=true;fhMedievalUI.refresh();saveProgress();}
window.FHMedievalFireVisual.tick(dt,fhMedievalRuntime);
for(const e of roomLampEntries)if(window.FHMedievalLighting.isMedieval(e.lamp?.lightKind)){
 const carried=fhMedievalRuntime.isCarried(e.lamp.id);
 if(carried)e.root.visible=false;else if(e.fhWasCarried)visibilityDirty=true;
 e.fhWasCarried=carried;
 if(e.carriedRoot){
  const held=fhMedievalRuntime.isCarried(e.lamp.id);e.carriedRoot.visible=held&&!peeking;
  if(held)e.carriedRoot.position.set(user.x+.28,floorElev[currentFloor],user.z);
 }
 if(!fhMedievalRuntime.isCarried(e.lamp?.id)){
  e.x=Number(e.lamp.x)*CELL;e.z=Number(e.lamp.y)*CELL;
  e.root.position.set(e.x,0,e.z);
 }
}
fhDropButton.hidden=!fhMedievalRuntime.hasCarried();`);
  // Procedural light geometry stays as a fallback; only medieval fixtures load their GLB.
  inject("const py=Math.min(Math.max(1.9,(Number(DATA.floors[fi].ceilingHeightFt)||11.5)*.3048-.19),\n   Math.max(1.6,entry.heightFt*.3048));","const py=window.FHMedievalLighting.isMedieval(entry.lamp?.lightKind)?\n Math.max(.15,entry.heightFt*.3048):\n Math.min(Math.max(1.9,(Number(DATA.floors[fi].ceilingHeightFt)||11.5)*.3048-.19),\n   Math.max(1.6,entry.heightFt*.3048));");
  inject("box(root,MAT.metal,0,y,0,width,.09,depth);",
    "if(!window.FHMedievalLighting.isMedieval(entry.lamp?.lightKind))box(root,MAT.metal,0,y,0,width,.09,depth);\n else {const model=new THREE.Group();root.add(model);window.FHAssets?.attach(model,entry.lamp);window.FHMedievalFireVisual.attach(THREE,lit,entry.lamp,fi);}");
  // Wall-mounted antiques use the real model; no false electrical wall sconce behind it.
  inject("if(wall)box(root,MAT.edge,0,y+.06,-depth*.48,.18,.22,.065);",
    "if(wall&&!window.FHMedievalLighting.isMedieval(entry.lamp?.lightKind))box(root,MAT.edge,0,y+.06,-depth*.48,.18,.22,.065);");
  inject("box(lit,lampGlowOn,0,y-.061,wall?depth*.1:0,glowWidth,.035,glowDepth);",
   "if(!window.FHMedievalLighting.isMedieval(entry.lamp?.lightKind))box(lit,lampGlowOn,0,y-.061,wall?depth*.1:0,glowWidth,.035,glowDepth);");
  inject("box(dark,lampGlowOff,0,y-.061,wall?depth*.1:0,glowWidth,.035,glowDepth);",
   "if(!window.FHMedievalLighting.isMedieval(entry.lamp?.lightKind))box(dark,lampGlowOff,0,y-.061,wall?depth*.1:0,glowWidth,.035,glowDepth);");
  inject("roomLampEntries.push({...entry,root,lit,dark});",`let carriedRoot=null;
 if(entry.lamp?.lightKind==='torch_hand'){
  carriedRoot=new THREE.Group();scene.add(carriedRoot);carriedRoot.visible=false;
  const carriedModel=new THREE.Group();carriedRoot.add(carriedModel);
  window.FHAssets?.attach(carriedModel,entry.lamp);
  window.FHMedievalFireVisual.attach(THREE,carriedRoot,entry.lamp,fi);
 }
 roomLampEntries.push({...entry,root,lit,dark,carriedRoot});`);
  // Several engine paths update lit/dark. Neither requires rewriting: their
  // groups now contain fire or electric geometry according to the fixture kind.
  inject(/const itemDefs=[^\r\n]+;/g,declaration=>declaration+`
for(const id of Object.keys(window.FHMedievalLighting.fuelItems))if(!itemDefs.some(d=>d.id===id))
 itemDefs.push(window.FHMedievalLighting.fuelDefinition(id,window.FH_MEDIEVAL_LIGHT_TEXT));`);
  const script=(file)=>'<script src="'+new URL('./juego/assets/'+file+'?v=20261124-fuel-fire',baseURI).href+'"></'+'script>';
  // El HTML embebido puede contener otros </head> dentro de scripts: modificar sólo la cabecera inicial.
  const headEnd=doc.indexOf('</head>');
  if(headEnd<0)throw Error('MEDIEVAL_LIGHTING_HEAD_MISSING');
  doc=doc.slice(0,headEnd)+script('fh-medieval-lighting.js')+
   script('fh-medieval-light-strings.js')+script('fh-medieval-fire-vfx.js')+script('fh-medieval-light-ui.js')+doc.slice(headEnd);
  return doc;
 }
 return Object.freeze({patchEngineDoc});
});
