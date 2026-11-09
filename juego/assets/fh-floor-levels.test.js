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
 assert.match(result,/function fhBasementWalk\(x,z\)/);
 assert.match(result,/DATA\.basementSlabs\?\.\[f\]/);
 assert.equal(result.includes('f===0||!SLABS[f].enabled'),false);
 const first=result.indexOf('<script>'),last=result.indexOf('</script>',first);
 assert.ok(first>=0&&last>first);
 assert.doesNotThrow(()=>new vm.Script(result.slice(first+8,last)));
});
