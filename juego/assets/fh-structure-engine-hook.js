/* Adaptador acotado: motor 3D empaquetado en Base64 sin modificar engine-XX.js.
 * Conecta PG al estado de partida y a las referencias de colisión originales.
 */
(function(global){
'use strict';
const scriptUrl=new URL(document.currentScript?.src||'./juego/assets/fh-structure-engine-hook.js',document.baseURI);
function one(doc,oldValue,newValue){
 const n=doc.split(oldValue).length-1;
 if(n!==1)throw Error('Hook PG incompatible ('+n+'): '+oldValue.slice(0,100));
 return doc.replace(oldValue,newValue);
}
function patch(source){
 if(typeof source!=='string')throw new TypeError('Documento de motor requerido');
 let doc=source;
 doc=one(doc,'ForestShared.loadProject(DATA);',
  'ForestShared.loadProject(DATA);window.FHStructureHealth.validateMap(DATA);');
 // El estado se guarda en la misma estructura de la partida, sin alterar el JSON del mapa.
 doc=one(doc,"return {flags:{...(initial.flags||{})},inventory:",
  "return {structures:structuredClone(initial.structures||{}),flags:{...(initial.flags||{})},inventory:");
 doc=one(doc,"if(d.open===true&&d.passable!==false)continue;",
  "if(d.destroyed===true||d.open===true&&d.passable!==false)continue;");
 doc=one(doc,"const GameEvents=createEventBus();",
  `const GameEvents=createEventBus();
const fhHealthRuntime=window.FHStructureHealth.createRuntime({
 data:DATA,state:GameState,doorList,blockers,events:GameEvents,
 save:()=>saveProgress(),refresh:()=>{visibilityDirty=true;}
});
window.FHStructureHealthRuntime=fhHealthRuntime;`);
 doc=one(doc,"function windowModel(f,it){const fhWinVisualStart=stories[f].children.length;",
  "function windowModel(f,it){const fhWinVisualStart=stories[f].children.length;const fhHealthBlockStart=blockers[f].length,fhHealthVisualStart=stories[f].children.length;");
 doc=one(doc,"}\nfunction doorTarget(d){",
  " window.FHStructureHealthRuntime?.registerWindow(f,it,blockers[f].slice(fhHealthBlockStart),stories[f].children.slice(fhHealthVisualStart));\n}\nfunction doorTarget(d){");
 doc=one(doc,"window.FHArchitectureSkins?.decorateDoor(d,it,THREE,installVisibility);return d;",
  "window.FHStructureHealthRuntime?.registerDoor(d,it);window.FHArchitectureSkins?.decorateDoor(d,it,THREE,installVisibility);return d;");
 doc=one(doc," d.passable=!!d.open&&(d.family!=='garage'||d.angle>=.85);\n}\n\nfunction debugGrid",
  " d.passable=d.destroyed===true||!!d.open&&(d.family!=='garage'||d.angle>=.85);\n}\n\nfunction debugGrid");
 const button=`// Inspector de PG dentro del juego (ratón, toque y teclado), sin golpes automáticos.
const fhStructureText=window.FH_STRUCTURE_TEXT;
function fhInspectStructure(){
 const near=fhHealthRuntime.nearest(currentFloor,user.x,user.z,CELL);
 if(!near){notice(fhStructureText.noTarget,2200);return null;}
 const it=near.item;
 const state=fhHealthRuntime.getState(currentFloor,it.id);
 if(!state)return null;
 const name=it.type==='window'?fhStructureText.window:fhStructureText.door;
 const condition=state.destroyed?fhStructureText.destroyed:state.pg===state.maxPG?fhStructureText.intact:fhStructureText.damaged;
 const reader=fhHealthRuntime.getState(currentFloor,it.id,'reader');
 const readerText=reader?' · '+(it.accessDevice==='pin'?fhStructureText.readerPin:fhStructureText.readerCard)+
  ': '+reader.pg+'/'+reader.maxPG+' '+fhStructureText.pg+
  (reader.destroyed?' ('+fhStructureText.destroyed+')':''):'';
 notice(name+': '+state.pg+'/'+state.maxPG+' '+fhStructureText.pg+' · '+condition+readerText,4300);
 return {item:it,...state,reader};
}
const fhInspectButton=document.createElement('button');
fhInspectButton.type='button';fhInspectButton.id='fhStructureHealthInspect';
fhInspectButton.textContent=fhStructureText.button;
fhInspectButton.title=fhStructureText.buttonTitle;
fhInspectButton.setAttribute('aria-label',fhStructureText.buttonTitle);
fhInspectButton.style.cssText='position:fixed;right:10px;top:78px;z-index:25;min-width:44px;min-height:44px;padding:6px 9px;border:2px solid #798c85;border-radius:3px;background:#142027e8;color:#e6e2d4;font:bold 12px monospace;image-rendering:pixelated;cursor:pointer';
fhInspectButton.addEventListener('click',fhInspectStructure);
document.body.append(fhInspectButton);
window.addEventListener('keydown',e=>{
 if(e.key.toLowerCase()!=='p'||e.repeat||e.altKey||e.ctrlKey||e.metaKey)return;
 if(e.target?.closest?.('input,textarea,[contenteditable="true"]'))return;
 fhInspectStructure();
});
window.ForestHorrorStructureAPI=Object.freeze({
 takeDamage:args=>fhHealthRuntime.takeDamage(args),
 inspect:args=>fhHealthRuntime.getState(args?.floorId,args?.id,args?.part||'structure'),
 inspectNear:fhInspectStructure
});
`;
 doc=one(doc,"window.ForestHorrorGame={source:'JSON arquitect",
  button+"\nwindow.ForestHorrorGame={source:'JSON arquitect");
 const base=new URL('../../',scriptUrl);
 const healthScript='<script src="'+new URL('juego/assets/fh-structure-health.js?v=20261107-structure-pg',base).href+'"></scr'+'ipt>';
 const stringScript='<script src="'+new URL('juego/assets/fh-structure-strings.js?v=20261107-structure-pg',base).href+'"></scr'+'ipt>';
 const headEnd=doc.indexOf('</head>');
 if(headEnd<0)throw Error('Motor 3D sin cierre del encabezado');
 doc=doc.slice(0,headEnd)+healthScript+stringScript+doc.slice(headEnd);
 return doc;
}
global.FHStructureHealthEngine=Object.freeze({patch});
})(window);
