/* Ejecutar: node juego/assets/fh-style-property.test.js (sin dependencias). */
(function(root,factory){
 const run=factory();
 if(typeof module==='object'&&module.exports)module.exports=run;
 if(typeof require==='function'&&typeof module==='object'&&require.main===module){
  const report=run(require('./fh-style-property.js'));
  console.log('Forest Horror · acabados y propiedades: '+report.passed+'/'+report.total+' OK');
 }
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHklEQVR42mM4s2dmnUMo8SQDSaqBJMOoDaM2DBkbACXcmhAa31gwAAAAAElFTkSuQmCC';
 function rect(type,x,y,w,h){
  return [
   {id:type+'-1',type,a:{x,y},b:{x:x+w,y}},
   {id:type+'-2',type,a:{x:x+w,y},b:{x:x+w,y:y+h}},
   {id:type+'-3',type,a:{x:x+w,y:y+h},b:{x,y:y+h}},
   {id:type+'-4',type,a:{x,y:y+h},b:{x,y}},
  ];
 }
 return function run(P){
  let passed=0,total=0;
  const check=(name,condition)=>{total++;if(!condition)throw Error('FALLÓ: '+name);passed++;};
  const outer=rect('red_wall',0,0,10,10),border=rect('property_wall',2,2,6,6);
  const room={id:'room',type:'room',x:2.25,y:2.25,w:5.5,h:5.5,label:'Sala'};
  const map={schema:'forest-horror-map-v1',buildingOwnerId:'principal',buildingOwners:{},
    floors:[{id:'floor1',items:[...outer,...border,room]}],properties:[],patterns:[],styleSystem:1};
  P.reconcileProperties(map,'floor1');map.properties[0].ownerId='inquilino';
  check('Un edificio rojo',P.buildings(map,'floor1').length===1);
  check('Una propiedad amarilla',map.properties.length===1);
  check('Herencia espacial',P.propertyAt(map,'floor1',{x:4,y:4}).ownerId==='inquilino');
  check('Interior/exterior automático: ladrillo',P.wallStyle(map,'floor1',outer[0],'B').preset==='ladrillo');
  check('Interior/exterior automático: pintura',P.wallStyle(map,'floor1',outer[0],'A').preset==='pintura-lisa');
  check('Cara del arrendatario',P.canPaintWall(map,'floor1',border[0],'A','inquilino'));
  check('Cara del dueño principal',P.canPaintWall(map,'floor1',border[0],'B','principal'));
  check('Cara del arrendatario restringida al otro dueño',!P.canPaintWall(map,'floor1',border[0],'A','principal'));
  check('Habitación pertenece a propiedad',P.canPaintRoom(map,'floor1',room,'inquilino'));
  check('Dueño principal no invade habitación',!P.canPaintRoom(map,'floor1',room,'principal'));
  check('PNG 16x16 validado',P.pngInfo(PNG).width===16);
  map.patterns=[{id:'mi_tapiz',width:16,height:16,png:PNG}];
  check('Catálogo válido',P.validatePatterns(map.patterns));
  P.paintWall(map,'floor1',border[0],'A',{preset:'tapiz',color:'#8899AA',pattern:'mi_tapiz'},'inquilino');
  check('Pintar cara A no altera B',border[0].finish.A.pattern==='mi_tapiz'&&!border[0].finish.B);
  P.paintFloor(map,'floor1',room,{preset:'azulejo',color:'#F0F0EF'},'inquilino');
  const saved=JSON.stringify(map),again=JSON.parse(saved);
  check('PNG idéntico tras importar',again.patterns[0].png===PNG);
  check('Acabado de pared idéntico tras importar',P.wallStyle(again,'floor1',again.floors[0].items[4],'A').pattern==='mi_tapiz');
  check('Piso idéntico tras importar',P.floorStyle(again.floors[0].items.at(-1)).preset==='azulejo');
  check('Permisos idénticos tras importar',P.canPaintWall(again,'floor1',again.floors[0].items[4],'A','inquilino'));
  map.buildingOwners.floor1_building_1='propietario_2';
  check('Propietario individual de edificio',P.buildings(map,'floor1')[0].ownerId==='propietario_2');
  check('La fachada se edita sólo por ese dueño',P.canPaintWall(map,'floor1',outer[0],'B','propietario_2')&&!P.canPaintWall(map,'floor1',outer[0],'B','principal'));
  const span={id:'span',type:'wall',a:{x:1,y:5},b:{x:9,y:5}};
  map.floors[0].items.push(span);
  let n=0;P.splitAtPropertyLimits(map,'floor1',()=>String(++n));
  check('Segmentos que cruzan propiedad se dividen',map.floors[0].items.filter(i=>i.id==='span'||/^[0-9]+$/.test(i.id)).length>=3);
  const bad={...map,properties:[...map.properties,{...map.properties[0],id:'overlap'}]};
  check('Propiedad solapada niega edición',!P.canPaintWall(bad,'floor1',border[0],'A','inquilino'));
  const roomCross={id:'cross',type:'room',x:1,y:1,w:4,h:4};
  check('Habitación atravesada por propiedad se niega al principal',!P.canPaintRoom(map,'floor1',roomCross,'propietario_2'));
  let failed=false;try{P.validatePatterns([{id:'fraud',png:'data:image/png;base64,AAA'}]);}catch{failed=true}
  check('PNG inválido rechazado',failed);
  return {passed,total};
 };
});
