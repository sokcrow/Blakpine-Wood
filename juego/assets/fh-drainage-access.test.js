const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const D=require('./fh-drainage.js');
require('./fh-natural-light.js');
const A=require('./fh-drainage-access.js');
const units={columns:120,rows:120,feetPerCell:5};
function project(door=true){
 const section=D.makeSection('straight',{x:15,y:15},units,'sewer');
 return {schema:'forest-horror-map-v1',units,mainFloorId:'ground',
  floors:[
   {id:'drain',elevationFt:-12,items:[section]},
   {id:'ground',elevationFt:0,items:door?[{id:'door',type:'door',a:{x:12,y:12},b:{x:15,y:12}}]:[]}
  ]};
}
function append(map,pair){
 map.floors[pair.sourceIndex].items.push(pair.source);
 map.floors[pair.destinationIndex].items.push(pair.destination);
}
test('respiradero enlaza planta baja y drenaje con ida/vuelta y coordenadas seguras',()=>{
 const map=project(),pair=A.makePair(map,1,{x:15,y:15},'street',(()=>{let i=0;return()=>String(++i)})());
 assert.equal(pair.source.drainageAccess.kind,'street');
 assert.equal(pair.destination.drainageAccess.kind,'sewer');
 assert.equal(pair.source.y,pair.destination.y);
 assert.equal(pair.source.x,pair.destination.x);
 assert.equal(D.waterAt(map,0,{x:pair.destination.x,y:pair.destination.y},0),null);
 append(map,pair);
 assert.equal(A.validateProject(map),true);
 assert.equal(A.resolve(map,1,pair.source)?.floorIndex,0);
 assert.equal(A.resolve(map,0,pair.destination)?.floorIndex,1);
 assert.equal(A.resolve(map,1,pair.source)?.item.id,pair.destination.id);
});
test('protege el JSON: no modifica mapas antiguos y rechaza pares huérfanos',()=>{
 const legacy=project();
 assert.equal(A.validateProject(legacy),true);
 const p=A.makePair(legacy,1,{x:15,y:15},'street',(()=>{let i=0;return()=>String(++i)})());
 append(legacy,p);
 legacy.floors[0].items=legacy.floors[0].items.filter(it=>it.id!==p.destination.id);
 assert.equal(A.resolve(legacy,1,p.source),null);
 assert.throws(()=>A.validateProject(legacy),/sin vínculo válido/);
});
test('no crea entradas flotantes, sin nivel inferior, en pisos equivocados o encima de agua sin drenaje',()=>{
 const p=project();
 assert.throws(()=>A.makePair(p,1,{x:50,y:50},'street',()=>'x'),/encima de un tramo/);
 assert.throws(()=>A.makePair(p,0,{x:15,y:15},'street',()=>'x'),/nivel inferior/);
 const p3=project();p3.mainFloorId='drain';
 assert.throws(()=>A.makePair(p3,1,{x:15,y:15},'street',()=>'x'),/planta baja/);
 const p4=project();p4.floors[1].items.push({id:'room',type:'room',x:10,y:10,w:10,h:10});
 assert.throws(()=>A.makePair(p4,1,{x:15,y:15},'street',()=>'x'),/dentro de una habitación/);
});
test('acceso de edificio requiere puerta o hueco cerca y conserva colisiones nativas',()=>{
 const noDoor=project(false);
 assert.throws(()=>A.makePair(noDoor,1,{x:15,y:15},'building',()=>'x'),/puerta o hueco/);
 const yes=project(true);let seq=0;
 const pair=A.makePair(yes,1,{x:15,y:15},'building',()=>String(++seq));
 append(yes,pair);
 assert.equal(A.validateProject(yes),true);
 assert.equal(A.resolve(yes,0,pair.destination).kind,'building');
 assert.equal(pair.source.blocksMovement,false);
 assert.equal(pair.destination.blocksMovement,false);
});
test('no duplica accesos ni permite identificadores repetidos',()=>{
 const p=project();let i=0;
 const one=A.makePair(p,1,{x:15,y:15},'street',()=>String(++i));append(p,one);
 assert.throws(()=>A.makePair(p,1,{x:15,y:15},'street',()=>String(++i)),/Ya existe/);
 assert.throws(()=>A.makePair(project(),1,{x:15,y:15},'street',()=> 'repetido'),/únicos/);
});
test('luz filtrada: 5 ft brillante + 5 ft tenue; noche, techo y puerta no generan sol',()=>{
 const p=project();let i=0;
 append(p,A.makePair(p,1,{x:15,y:15},'street',()=>String(++i)));
 const day=A.lightSources(p,0,720,{light:1},()=>true);
 assert.equal(day.length,1);assert.equal(day[0].bright,1);assert.equal(day[0].range,2);
 assert.equal(A.lightSources(p,0,0,{light:1},()=>true).length,0);
 assert.equal(A.lightSources(p,0,720,{light:1},()=>false).length,0);
 assert.equal(A.lightSources(p,1,720,{light:1},()=>true).length,0);
 const other=project();i=0;append(other,A.makePair(other,1,{x:15,y:15},'building',()=>String(++i)));
 assert.equal(A.lightSources(other,0,720,{light:1},()=>true).length,0);
});
test('permiso NPC explícito: no entra sin capacidad y no atraviesa inundación sin nadar',()=>{
 const p=project();let i=0,one=A.makePair(p,1,{x:15,y:15},'street',()=>String(++i));
 assert.equal(A.canNpcUse(one.source,{}),false);
 assert.equal(A.canNpcUse(one.source,{canEnterDrainage:true}),true);
 assert.equal(A.canNpcUse(one.source,{canEnterDrainage:true},{flooded:true}),false);
 assert.equal(A.canNpcUse(one.source,{capabilities:{canEnterDrainage:true,canSwim:true}},{flooded:true}),true);
});
test('lluvia por rejillas exteriores: crea gotas y solo las muestra bajo lluvia',()=>{
 const p=project();let i=0,one=A.makePair(p,1,{x:15,y:15},'street',()=>String(++i));append(p,one);
 class M{constructor(params){Object.assign(this,params)}}
 class B{constructor(){}}
 class Mesh{constructor(geometry,material){this.geometry=geometry;this.material=material;this.visible=true;this.position={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z}};}}
 const Three={MeshLambertMaterial:M,MeshBasicMaterial:M,Mesh,BoxGeometry:B};
 const scene={children:[],add(x){this.children.push(x)}};
 A.attachFloor(Three,p,scene,0,1.524);
 const drops=scene.children.filter(x=>x.material?.color===0x9bc4da);
 assert.equal(drops.length,6);assert.ok(drops.every(x=>x.visible===false));
 A.updateVisuals(.05,{phase:'lluvia',intensity:1},p,()=>true);
 assert.ok(drops.every(x=>x.visible===true));
 A.updateVisuals(.05,{phase:'nieve',intensity:1},p,()=>true);
 assert.ok(drops.every(x=>x.visible===false));
 A.updateVisuals(.05,{phase:'lluvia',intensity:1},p,()=>false);
 assert.ok(drops.every(x=>x.visible===false));
});
test('contrato motor/editor: menú, validación, interacción nativa, control de FOW y lluvia',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 const editor=fs.readFileSync(path.join(__dirname,'fh-drainage-editor.js'),'utf8');
 for(const marker of ['drain_street_access','drain_building_access','FHDrainageAccess?.draw2D',
  'FHDrainageAccess?.attachFloor','FHDrainageAccess?.validateProject','addDrainAccessToEngine',
  'changeFloor(link.floorIndex)','permitted=canWalk(x,z)','FHDrainageAccess?.lightSources',
  'FHDrainageAccess?.updateVisuals','FHDrainageEditor?.beforeRemove']){
  assert.ok(html.includes(marker),'Integración ausente: '+marker);
 }
 assert.match(editor,/function beforeRemove\(/);
 assert.match(editor,/A\(\)\.makePair\(/);
 assert.match(html,/'parking_decal','drain_access','opening','spawn'/);
});
