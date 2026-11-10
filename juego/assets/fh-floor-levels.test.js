'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const L=require('./fh-floor-levels.js');
const H=require('./fh-location-hud.js');
const floor=(id,elevationFt,items=[])=>({id,name:id,elevationFt,items,reference:{name:id,data:'ref:'+id}});
const map=()=>({schema:'forest-horror-map-v1',version:2,floors:[floor('ground',0),floor('up',12)]});
const next=(id,elevationFt=0)=>floor(id,elevationFt);

test('mapa heredado: consulta no cambia el JSON, los códigos históricos ni la planta de inicio',()=>{
 const project=map(),before=JSON.stringify(project);
 assert.equal(L.mainId(project),'ground');
 assert.equal(L.code(project,0),'PB');
 assert.equal(H.codeForFloor(project.floors,0),'F1');
 assert.equal(H.codeForFloor(project.floors,1),'F2');
 assert.equal(JSON.stringify(project),before);
 assert.equal(Object.hasOwn(project,'mainFloorId'),false);
});

test('añadir B1 y B2 bajo la planta principal mantiene el ID y la altura del terreno',()=>{
 const p=map(),first=next('b1');
 assert.equal(L.insert(p,'ground','below',first).ok,true);
 assert.deepEqual(p.floors.map(f=>f.id),['b1','ground','up']);
 assert.deepEqual(p.floors.map(f=>f.elevationFt),[-12,0,12]);
 assert.equal(p.mainFloorId,'ground');
 assert.deepEqual(p.floors.map((f,i)=>L.code(p,i)),['B1','PB','P1']);
 assert.equal(H.codeForFloor(p.floors,0,p.mainFloorId),'B1');
 assert.equal(H.codeForFloor(p.floors,1,p.mainFloorId),'PB');
 assert.equal(H.codeForFloor(p.floors,2,p.mainFloorId),'F1');
 assert.equal(L.insert(p,'b1','below',next('b2')).ok,true);
 assert.deepEqual(p.floors.map(f=>f.elevationFt),[-24,-12,0,12]);
 assert.deepEqual(p.floors.map((f,i)=>L.code(p,i)),['B2','B1','PB','P1']);
});

test('insertar piso intermedio desplaza alturas sin reescribir IDs ni items',()=>{
 const p=map();p.floors[1].items.push({id:'tv',type:'tv',x:1,y:2});
 const r=L.insert(p,'ground','above',next('middle'));
 assert.deepEqual(r,{ok:true,index:1,id:'middle'});
 assert.deepEqual(p.floors.map(f=>f.elevationFt),[0,12,24]);
 assert.equal(p.floors[2].items[0].id,'tv');
 assert.equal(p.floors[2].id,'up');
});

test('establecer la planta principal desplaza el origen sin cambiar las distancias entre plantas',()=>{
 const p=map();L.insert(p,'ground','below',next('b1'));
 assert.equal(L.setMain(p,'up').ok,true);
 assert.equal(p.mainFloorId,'up');
 assert.deepEqual(p.floors.map(f=>f.elevationFt),[-24,-12,0]);
 assert.deepEqual(p.floors.map((f,i)=>L.code(p,i)),['B2','B1','PB']);
});

test('reordenar intercambia plantas y sus elevaciones, conservando objetos por ID',()=>{
 const p=map();p.floors[0].items.push({id:'door',type:'door'});
 const r=L.reorder(p,'ground','up');
 assert.equal(r.ok,true);assert.equal(r.index,1);
 assert.deepEqual(p.floors.map(f=>f.id),['up','ground']);
 assert.deepEqual(p.floors.map(f=>f.elevationFt),[-12,0]);
 assert.equal(p.floors[1].items[0].id,'door');
 assert.equal(p.mainFloorId,'ground');
});

test('no permite IDs duplicados ni direcciones inexistentes',()=>{
 const p=map(),before=JSON.stringify(p);
 assert.equal(L.insert(p,'ground','below',next('up')).ok,false);
 assert.equal(L.insert(p,'ghost','below',next('other')).ok,false);
 assert.equal(L.reorder(p,'up','up').ok,false);
 assert.equal(L.setMain(p,'ghost').ok,false);
 assert.equal(JSON.stringify(p),before);
});

test('impide intercalar pisos atravesando escaleras vinculadas',()=>{
 const p=map();p.floors[0].items.push({id:'stairs1',type:'stairs',targetFloorId:'up'});
 assert.match(L.insert(p,'ground','above',next('middle')).reason,/escaleras/i);
 assert.match(L.reorder(p,'ground','up').reason,/escaleras/i);
 assert.equal(p.floors.length,2);
});

test('mantiene elevaciones personalizadas cuando se inserta un nivel',()=>{
 const p=map();p.floors[1].elevationFt=14.5;
 L.insert(p,'ground','above',next('new'));
 assert.deepEqual(p.floors.map(f=>f.elevationFt),[0,12,26.5]);
 assert.equal(L.ordered(p),true);
});

test('el editor conserva módulo, controles y metadatos del JSON v1',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 assert.match(html,/fh-floor-levels\.js/);
 assert.match(html,/function insertFloor\(direction\)/);
 assert.match(html,/function editFloorInfo\(\)/);
 assert.match(html,/slabsForLevels\(\)/);
 assert.match(html,/basementSlabs\(\)/);
 assert.match(html,/mainFloorId:project\.mainFloorId/);
 const script=html.slice(html.indexOf('<script>// /shared + /editor.')+'<script>'.length,html.indexOf('</script>',html.indexOf('<script>// /shared + /editor.')));
 assert.doesNotThrow(()=>new vm.Script(script,{filename:'editor-inline.js'}));
});

test('el parche 3D reconoce las anclas reales del motor empacado y las cambia',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 const start=html.indexOf('function addBuildingLevelsToEngine(doc){');
 const end=html.indexOf('// Restringe las fachadas de niveles vecinos',start);
 assert.ok(start>0&&end>start);
 const fn=new Function('return ('+html.slice(start,end).trim()+')')();
 const parts=Array.from({length:13},(_,i)=>{
  const name='engine-'+String(i).padStart(2,'0')+'.js';
  const raw=fs.readFileSync(path.join(__dirname,name),'utf8');
  return raw.slice(raw.indexOf('+"')+2,raw.lastIndexOf('";'));
 });
 const engine=Buffer.from(parts.join(''),'base64').toString('utf8');
 const result=fn(engine);
 assert.match(result,/const mainFloorIndex=Math\.max\(0,DATA\.floors\.findIndex/);
 assert.doesNotMatch(result,/function fhBasementWalk\(x,z\)/);
 assert.match(result,/const slab=floor<mainFloorIndex&&DATA\.basementSlabs\?\.\[floor\]\?\.enabled/);
 assert.match(result,/surfaceAllowed:\(currentFloor<mainFloorIndex&&DATA\.basementSlabs\?\.\[currentFloor\]/);
 assert.match(result,/DATA\.basementSlabs\?\.\[f\]/);
 assert.equal(result.includes('f===0||!SLABS[f].enabled'),false);
 const first=result.indexOf('<script>'),last=result.indexOf('</script>',first);
 assert.ok(first>=0&&last>first);
 assert.doesNotThrow(()=>new vm.Script(result.slice(first+8,last)));
});

test('los sótanos conservan superficie roja, pasillos, habitaciones, celdas y huecos de escalera',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 const start=html.indexOf('function addBuildingLevelsToEngine(doc){');
 const end=html.indexOf('// Restringe las fachadas de niveles vecinos',start);
 const patch=new Function('return ('+html.slice(start,end).trim()+')')();
 const parts=Array.from({length:13},(_,i)=>{
  const raw=fs.readFileSync(path.join(__dirname,'engine-'+String(i).padStart(2,'0')+'.js'),'utf8');
  return raw.slice(raw.indexOf('+"')+2,raw.lastIndexOf('";'));
 });
 const source=patch(Buffer.from(parts.join(''),'base64').toString('utf8'));
 const from=source.indexOf('function onStructuralSlab(x,z,floor=currentFloor){');
 const until=source.indexOf('function stairSupportHeight(',from);
 assert.ok(from>0&&until>from,'se conserva el predicado compartido del motor');
 const factory=new Function('SLABS','DATA','CELL','mainFloorIndex','stairVoids','ForestShared','currentFloor',
  source.slice(from,until)+'\nreturn onStructuralSlab;');
 const data={basementSlabs:[
  {enabled:true,spans:[{x:0,y:0,w:2,h:2}]},
  null
 ],floors:[
  {id:'b1',items:[
   {type:'hall',x:3,y:0,w:2,h:2},
   {type:'room',spans:[{x:6,y:0,w:2,h:2}]},
   {type:'pavement',cells:[{x:9,y:1}]}
  ]},
  {id:'pb',items:[]}
 ]};
 const empty={enabled:false,spans:[]};
 const stairs=[[],[]];
 const walk=factory([empty,empty],data,1,1,stairs,{stairOnRun:()=>false},0);
 assert.equal(walk(1,1),true,'dentro de la losa roja');
 assert.equal(walk(3.5,1),true,'pasillo fuera de la losa roja');
 assert.equal(walk(6.5,1),true,'habitación con spans');
 assert.equal(walk(9.5,1.5),true,'superficie por celdas');
 assert.equal(walk(12,4),false,'fuera de cualquier superficie');
 stairs[0]=[{x1:0.5,x2:1.5,z1:.5,z2:1.5}];
 assert.equal(walk(1,1),false,'hueco de escalera no admite pasos por la losa');
});

test('deshacer conserva la imagen importada de pisos existentes y recupera la de pisos restaurados',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 const from=html.indexOf('function restoreHistory(){');
 const until=html.indexOf('\nfunction numId(){',from);
 assert.ok(from>0&&until>from);
 const harness=new Function('state',`
  let {project,history,historyIndex,floorRefArchive,loadedImgs,floorIndex}=state;
  let selection='selected';
  const current=()=>project.floors[floorIndex];
  const floorDefault=(id,name,elevationFt)=>({
   id,name,elevationFt,reference:{data:'default'},items:[],ceilingHeightFt:11.5
  });
  const recalcAllSpaces=()=>{},syncStairLinks=()=>{},refreshFloorTabs=()=>{};
  const closeInspector=()=>{},saveSoon=()=>{},render=()=>{},setupImage=()=>{};
  ${html.slice(from,until)}
  restoreHistory();
  return {project,loadedImgs,floorIndex,selection};
 `);
 const ground=floor('ground',0,[{id:'new-edit'}]);
 ground.reference={name:'Nueva referencia',data:'imagen-importada',width:512,height:512};
 const image={id:'image-object'};
 const snapshot={floors:[
  {id:'ground',name:'PB',items:[{id:'before-undo'}],elevationFt:0,ceilingHeightFt:11.5},
  {id:'b1',name:'Sótano',items:[],elevationFt:-12,ceilingHeightFt:11.5}
 ]};
 const state={
  project:{floors:[ground]},
  history:[JSON.stringify(snapshot)],historyIndex:0,floorIndex:0,
  loadedImgs:[image],
  floorRefArchive:new Map([
   ['ground',{name:'Referencia obsoleta',data:'imagen-original'}],
   ['b1',{name:'Referencia recuperada',data:'imagen-sótano'}]
  ])
 };
 const restored=harness(state);
 assert.equal(restored.project.floors[0].reference.data,'imagen-importada');
 assert.equal(restored.project.floors[0].items[0].id,'before-undo');
 assert.equal(restored.loadedImgs[0],image,'se conserva la imagen precargada actual');
 assert.equal(restored.project.floors[1].reference.data,'imagen-sótano');
 assert.equal(restored.project.floors[1].id,'b1');
 assert.equal(restored.floorIndex,0);
});
