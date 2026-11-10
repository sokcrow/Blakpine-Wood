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
 assert.deepEqual(p.floors.map(f=>f.elevationFt),[-10,0,12]);
 assert.equal(p.mainFloorId,'ground');
 assert.deepEqual(p.floors.map((f,i)=>L.code(p,i)),['B1','PB','P1']);
 assert.equal(H.codeForFloor(p.floors,0,p.mainFloorId),'B1');
 assert.equal(H.codeForFloor(p.floors,1,p.mainFloorId),'PB');
 assert.equal(H.codeForFloor(p.floors,2,p.mainFloorId),'F1');
 assert.equal(L.insert(p,'b1','below',next('b2')).ok,true);
 assert.deepEqual(p.floors.map(f=>f.elevationFt),[-20,-10,0,12]);
 assert.deepEqual(p.floors.map((f,i)=>L.code(p,i)),['B2','B1','PB','P1']);
});

test('insertar piso intermedio NO desplaza alturas existentes ni sus items',()=>{
 const p=map();p.floors[1].items.push({id:'tv',type:'tv',x:1,y:2});
 const r=L.insert(p,'ground','above',next('middle'));
 assert.deepEqual(r,{ok:true,index:1,id:'middle'});
 assert.deepEqual(p.floors.map(f=>f.elevationFt),[0,10,12]);
 assert.equal(p.floors[2].items[0].id,'tv');
 assert.equal(p.floors[2].id,'up');
});

test('establecer PB sólo cambia el nivel de referencia, no las alturas físicas',()=>{
 const p=map();L.insert(p,'ground','below',next('b1'));
 assert.equal(L.setMain(p,'up').ok,true);
 assert.equal(p.mainFloorId,'up');
 assert.deepEqual(p.floors.map(f=>f.elevationFt),[-10,0,12]);
 assert.deepEqual(p.floors.map((f,i)=>L.code(p,i)),['B2','B1','PB']);
});

test('reordenar intercambia plantas y sus elevaciones, conservando objetos por ID',()=>{
 const p=map();p.floors[0].items.push({id:'door',type:'door'});
 const r=L.reorder(p,'ground','up');
 assert.equal(r.ok,true);assert.equal(r.index,1);
 assert.deepEqual(p.floors.map(f=>f.id),['up','ground']);
 assert.deepEqual(p.floors.map(f=>f.elevationFt),[0,12]);
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
 assert.deepEqual(p.floors.map(f=>f.elevationFt),[0,10,14.5]);
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
 assert.match(html,/mainFloorId:'floor1',floors:\[floorDefault\('floor1','Piso 1',0,0\),floorDefault\('floor2','Piso 2',10,1\)\]/);
 assert.match(html,/FHFloorLevels\.setElevation\(project,f\.id,elev\)/);
 assert.match(html,/Marcar como nivel suelo \(PB\)/);
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
 assert.match(result,/const groundElevationFt=DATA\.mainFloorId\?/);
 assert.match(result,/const floorElev=DATA\.floors\.map\(\(f,i\)=>\(Number\.isFinite/);
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

test('PB explícito conserva alturas personalizadas y clasifica por elevación física',()=>{
 const p={floors:[floor('b2',-20),floor('b1',-10),floor('pb',25),floor('p1',35)]};
 const before=p.floors.map(f=>f.elevationFt);
 assert.equal(L.setMain(p,'pb').ok,true);
 assert.deepEqual(p.floors.map(f=>f.elevationFt),before);
 assert.deepEqual(p.floors.map((_,i)=>L.code(p,i)),['B2','B1','PB','P1']);
});

test('fijar elevación permite bajar piso, ordena por altura y mantiene los demás y sus IDs',()=>{
 const p={floors:[floor('ground',0,[{id:'piano'}]),floor('upper',10,[{id:'chair'}]),floor('top',20)]};
 const result=L.setElevation(p,'upper',-10);
 assert.deepEqual(result,{ok:true,index:0});
 assert.deepEqual(p.floors.map(f=>f.id),['upper','ground','top']);
 assert.deepEqual(p.floors.map(f=>f.elevationFt),[-10,0,20]);
 assert.equal(p.floors[0].items[0].id,'chair');
 assert.equal(p.floors[1].items[0].id,'piano');
 assert.equal(p.mainFloorId,'ground');
 assert.deepEqual(p.floors.map((_,i)=>L.code(p,i)),['B1','PB','P1']);
});

test('puede establecer PB aun si el mapa legado llegó desordenado, y ordenarlo sin mutar alturas',()=>{
 const p={floors:[floor('main',0),floor('basement',-10),floor('top',15)]};
 const before=new Map(p.floors.map(f=>[f.id,f.elevationFt]));
 assert.equal(L.ordered(p),false);
 assert.equal(L.setMain(p,'main').ok,true);
 assert.equal(p.mainFloorId,'main');
 assert.equal(L.sortByElevation(p).ok,true);
 assert.deepEqual(p.floors.map(f=>f.id),['basement','main','top']);
 for(const f of p.floors)assert.equal(f.elevationFt,before.get(f.id));
 assert.deepEqual(p.floors.map((_,i)=>L.code(p,i)),['B1','PB','P1']);
});

test('intercambiar dos niveles cambia sólo sus dos alturas, sin mover los otros',()=>{
 const p={floors:[floor('b1',-10),floor('pb',0),floor('p1',10),floor('p2',20)]};
 L.setMain(p,'pb');
 const r=L.reorder(p,'p1','down');
 assert.equal(r.ok,true);
 assert.deepEqual(p.floors.map(f=>f.id),['b1','p1','pb','p2']);
 assert.deepEqual(p.floors.map(f=>f.elevationFt),[-10,0,10,20]);
 assert.equal(p.floors.find(f=>f.id==='b1').elevationFt,-10);
 assert.equal(p.floors.find(f=>f.id==='p2').elevationFt,20);
 assert.equal(p.mainFloorId,'pb');
});

test('no inventa hueco de 10 pies ni mueve pisos existentes si están demasiado juntos',()=>{
 const p={floors:[floor('ground',0),floor('upper',10)]};
 const before=JSON.stringify(p);
 const candidate=next('between');
 assert.match(L.insert(p,'ground','above',candidate).reason,/No caben 10 pies/);
 assert.equal(JSON.stringify(p),before);
 assert.equal(candidate.elevationFt,0);
 assert.equal(L.insert(p,'ground','below',next('basement')).ok,true);
 assert.deepEqual(p.floors.map(f=>f.elevationFt),[-10,0,10]);
});

test('editar alturas duplicadas y atravesar conexiones de escaleras falla sin mutación parcial',()=>{
 const p={floors:[floor('ground',0,[{id:'stairs',type:'stairs',targetFloorId:'upper'}]),floor('upper',10),floor('roof',20)]};
 const before=JSON.stringify(p);
 assert.match(L.setElevation(p,'upper',0).reason,/existe un piso/i);
 assert.match(L.setElevation(p,'upper',-10).reason,/escaleras/i);
 assert.match(L.reorder(p,'upper','down').reason,/escaleras/i);
 assert.match(L.insert(p,'ground','above',next('middle')).reason,/No caben 10 pies/);
 assert.equal(JSON.stringify(p),before);
 const ok=L.setMain(p,'roof');assert.equal(ok.ok,true);
 assert.deepEqual(p.floors.map(f=>f.elevationFt),[0,10,20]);
});

test('referencia de suelo del motor 3D se calcula sin cambiar los valores JSON originales',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 const start=html.indexOf('function addBuildingLevelsToEngine(doc){');
 const end=html.indexOf('// Restringe las fachadas de niveles vecinos',start);
 const fn=new Function('return ('+html.slice(start,end).trim()+')')();
 const parts=Array.from({length:13},(_,i)=>{
  const raw=fs.readFileSync(path.join(__dirname,'engine-'+String(i).padStart(2,'0')+'.js'),'utf8');
  return raw.slice(raw.indexOf('+"')+2,raw.lastIndexOf('";'));
 });
 const engine=fn(Buffer.from(parts.join(''),'base64').toString('utf8'));
 const lines=engine.match(/const groundElevationFt=[^\n]+;\n const floorElev=[^\n]+;/);
 assert.ok(lines,'el motor incluye origen relativo PB');
 const compute=new Function('DATA','mainFloorIndex',lines[0]+'\nreturn floorElev;');
 const project={mainFloorId:'upper',floors:[{id:'ground',elevationFt:0},{id:'upper',elevationFt:20}]};
 const y=compute(project,1);
 assert.ok(Math.abs(y[0]+6.096)<.000001);
 assert.equal(y[1],0);
 assert.deepEqual(project.floors.map(f=>f.elevationFt),[0,20]);
 const old={floors:[{id:'ground',elevationFt:4},{id:'upper',elevationFt:16}]};
 const oldY=compute(old,0);
 assert.ok(Math.abs(oldY[0]-1.2192)<.000001);
 assert.ok(Math.abs(oldY[1]-4.8768)<.000001);
});
