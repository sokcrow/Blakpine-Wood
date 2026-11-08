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
 doc=one(doc,"exteriorProxies.push({source,clone,f,item:it});",
  "exteriorProxies.push({source,clone,f,item:it});window.FHStructureHealthRuntime?.registerExteriorProxy(f,it,clone);");
 doc=one(doc,"window.FHArchitectureSkins?.decorateDoor(d,it,THREE,installVisibility);return d;",
  "window.FHStructureHealthRuntime?.registerDoor(d,it);window.FHArchitectureSkins?.decorateDoor(d,it,THREE,installVisibility);return d;");
 doc=one(doc," d.passable=!!d.open&&(d.family!=='garage'||d.angle>=.85);\n}\n\nfunction debugGrid",
  " d.passable=d.destroyed===true||!!d.open&&(d.family!=='garage'||d.angle>=.85);\n}\n\nfunction debugGrid");
 // El adaptador de cómics puede envolver el aviso en un bloque. El guard
 // de la puerta no depende de cómo se presenta ese aviso.
 doc=one(doc," if(d.stairBlockFlag&&GameState.flags[d.stairBlockFlag])",
  " if(d.destroyed)return notice(window.FH_STRUCTURE_TEXT.destroyed,1800);\n if(d.stairBlockFlag&&GameState.flags[d.stairBlockFlag])");
 doc=one(doc,"if(!d||d.kind!=='peephole_door')return notice(",
  "if(!d||d.destroyed||d.kind!=='peephole_door')return notice(");
 const inspector=`// Inspección de PG desde el objetivo seleccionado del radial.
const fhStructureText=window.FH_STRUCTURE_TEXT;
function fhInspectStructure(floorId,id){
 const floor=typeof floorId==='number'?DATA.floors[floorId]:DATA.floors.find(f=>f.id===floorId);
 const it=floor?.items?.find(item=>item.id===id);
 if(!it)return null;
 const state=fhHealthRuntime.getState(floorId,id);
 if(!state)return null;
 const name=it.type==='window'?fhStructureText.window:fhStructureText.door;
 const condition=state.destroyed?fhStructureText.destroyed:state.pg===state.maxPG?fhStructureText.intact:fhStructureText.damaged;
 const reader=fhHealthRuntime.getState(floorId,id,'reader');
 const readerText=reader?' · '+(it.accessDevice==='pin'?fhStructureText.readerPin:fhStructureText.readerCard)+
  ': '+reader.pg+'/'+reader.maxPG+' '+fhStructureText.pg+
  (reader.destroyed?' ('+fhStructureText.destroyed+')':''):'';
 notice(name+': '+state.pg+'/'+state.maxPG+' '+fhStructureText.pg+' · '+condition+readerText,4300);
 return {item:it,...state,reader};
}
window.ForestHorrorStructureAPI=Object.freeze({
 takeDamage:args=>fhHealthRuntime.takeDamage(args),
 inspect:args=>fhHealthRuntime.getState(args?.floorId,args?.id,args?.part||'structure'),
 inspectSelected:(floorId,id)=>fhInspectStructure(floorId,id),
 nearestWindow:(f,x,z,cell)=>fhHealthRuntime.nearest(f,x,z,cell,2.4,'window')
});
`;
 doc=one(doc,"window.ForestHorrorGame={source:'JSON arquitect",
  inspector+"\nwindow.ForestHorrorGame={source:'JSON arquitect");
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

