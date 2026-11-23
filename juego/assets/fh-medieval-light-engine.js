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
    declaration=>declaration+"\nconst fhMedievalRuntime=window.FHMedievalLighting.createRuntime({floors:DATA.floors,state:GameState,ruleset:DATA.__multimodeSave?.identity.rulesetId,\n  clock:()=>window.FHMedievalLighting.absoluteMinute(GameState.clock),\n  player:()=>({floor:currentFloor,x:user.x,z:user.z}),lights:window.FHLights,cell:CELL});\nwindow.FHMedievalRuntime=fhMedievalRuntime;");
  inject("const GameEvents=createEventBus();","const GameEvents=createEventBus();\n"+"const fhDropButton=document.createElement('button');\nfhDropButton.type='button';fhDropButton.id='fhMedievalDropTorch';\nfhDropButton.textContent=window.FH_MEDIEVAL_LIGHT_TEXT.drop;fhDropButton.hidden=true;\nfhDropButton.style.cssText='position:fixed;right:12px;bottom:88px;z-index:14;min-height:44px;padding:8px 14px;background:#32251c;color:#ffe3ad;border:1px solid #b99961;cursor:pointer';\ndocument.body.append(fhDropButton);\nfhDropButton.onclick=()=>{if(fhMedievalRuntime.drop()){notice(window.FH_MEDIEVAL_LIGHT_TEXT.dropped);roomLightsDirty=true;visibilityDirty=true;saveProgress();}else notice(window.FH_MEDIEVAL_LIGHT_TEXT.wrongFloor);};");
  inject("function useFurniture(item,selectedSeat=null){",
    "function useFurniture(item,selectedSeat=null){\n if(item.type==='light_fixture'&&window.FHMedievalLighting.isMedieval(item.lightKind)){\n  const result=fhMedievalRuntime.interact(currentFloor,item);\n  const t=window.FH_MEDIEVAL_LIGHT_TEXT;notice((t[result.action||result.reason]||t.missing)+(result.material?' · '+result.units+' × '+result.material:'')+(result.remaining!=null?' · '+Math.ceil(result.remaining)+' min':''));\n  roomLightsDirty=true;visibilityDirty=true;if(result.ok)saveProgress();return result;\n }");
  inject("lighting.tick(dt);","lighting.tick(dt);\nif(fhMedievalRuntime.tick()){roomLightsDirty=true;visibilityDirty=true;saveProgress();}\nfor(const e of roomLampEntries)if(window.FHMedievalLighting.isMedieval(e.lamp?.lightKind)){\n e.root.visible=!fhMedievalRuntime.isCarried(e.lamp?.id);\n if(!fhMedievalRuntime.isCarried(e.lamp?.id)){\n  e.x=Number(e.lamp.x)*CELL;e.z=Number(e.lamp.y)*CELL;\n  e.root.position.set(e.x,0,e.z);\n }\n}\nfhDropButton.hidden=!fhMedievalRuntime.hasCarried();");
  // Procedural light geometry stays as a fallback; only medieval fixtures load their GLB.
  inject("const py=Math.min(Math.max(1.9,(Number(DATA.floors[fi].ceilingHeightFt)||11.5)*.3048-.19),\n   Math.max(1.6,entry.heightFt*.3048));","const py=window.FHMedievalLighting.isMedieval(entry.lamp?.lightKind)?\n Math.max(.15,entry.heightFt*.3048):\n Math.min(Math.max(1.9,(Number(DATA.floors[fi].ceilingHeightFt)||11.5)*.3048-.19),\n   Math.max(1.6,entry.heightFt*.3048));");
  inject("box(root,MAT.metal,0,y,0,width,.09,depth);",
    "if(!window.FHMedievalLighting.isMedieval(entry.lamp?.lightKind))box(root,MAT.metal,0,y,0,width,.09,depth);\n else {const model=new THREE.Group();root.add(model);window.FHAssets?.attach(model,entry.lamp);}");
  // Wall-mounted antiques use the real model; no false electrical wall sconce behind it.
  inject("if(wall)box(root,MAT.edge,0,y+.06,-depth*.48,.18,.22,.065);",
    "if(wall&&!window.FHMedievalLighting.isMedieval(entry.lamp?.lightKind))box(root,MAT.edge,0,y+.06,-depth*.48,.18,.22,.065);");
  const script=(file)=>'<script src="'+new URL('./juego/assets/'+file+'?v=20261123-campaign',baseURI).href+'"></'+'script>';
  // El HTML embebido puede contener otros </head> dentro de scripts: modificar sólo la cabecera inicial.
  const headEnd=doc.indexOf('</head>');
  if(headEnd<0)throw Error('MEDIEVAL_LIGHTING_HEAD_MISSING');
  doc=doc.slice(0,headEnd)+script('fh-medieval-lighting.js')+
   script('fh-medieval-light-strings.js')+doc.slice(headEnd);
  return doc;
 }
 return Object.freeze({patchEngineDoc});
});
