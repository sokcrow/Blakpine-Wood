const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const Natural=require('./fh-natural-light.js');
const Weather=require('./fh-weather-renderer.js');
const Location=require('./fh-location-hud.js');
const html=fs.readFileSync(__dirname+'/../../index.html','utf8');
const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const copy=v=>JSON.parse(JSON.stringify(v));
function walls(x,y,w,h,prefix='w',type='red_wall'){
 return [[x,y,x+w,y],[x+w,y,x+w,y+h],[x+w,y+h,x,y+h],[x,y+h,x,y]].map(([x,y,u,v],i)=>({id:prefix+i,type,a:{x,y},b:{x:u,y:v}}));
}
function setup(){
 let id=0;
 const project={units:{columns:20,rows:20},mainFloorId:'pb',floors:[
  {id:'pb',elevationFt:0,items:[...walls(1,1,18,18,'outer'),...walls(5,5,10,10,'court')]},
  {id:'up',elevationFt:10,items:walls(1,1,18,18,'upper')},
  {id:'top',elevationFt:20,items:[]}
 ]};
 const env={project,structuredClone,window:{},rounded:(v,n=3)=>Math.round(v*10**n)/10**n,clone:copy,numId:()=> 'new'+(++id),floorIndex:0,
  STRUCTURAL_TYPES:new Set(['red_wall','wall','property_wall','half_wall','fence','door','peephole_door','window','opening']),DOOR_TYPES:new Set(['door','peephole_door']),
  SEGMENT_TYPES:new Set(['red_wall','wall','door']),AREA_TYPES:new Set(['room','outside','building']),spaceCache:[],sanitizeId:x=>x,roomHasPosition:(it,p)=>env.areaHasPoint(it,p),
  current:()=>project.floors[0],selection:null,closeModal:()=>{},closeInspector:()=>{},openInspector:()=>{},toast:()=>{}
 };
 vm.createContext(env);
 vm.runInContext(cut('const ForestShared=(()=>{','const SCHEMA=')+'\nthis.shared=ForestShared;',env);
 env.ForestShared=env.shared;
 vm.runInContext(cut('function areaHasPoint(','function areaCenter('),env);
 vm.runInContext(cut('function roomShapeSpans(','// Red arquitectónica:'),env);
 vm.runInContext(cut('function rasterBoundary(','function recalcAllSpaces('),env);
 vm.runInContext(cut('const roofCache=','// Copia el perímetro rojo'),env);
 vm.runInContext(fs.readFileSync(__dirname+'/fh-courtyard-strings.js','utf8'),env);
 env.record=()=>env.rebuildFloorSpaces(0);
 return env;
}
const at=(spans,x,y)=>spans.some(sp=>x>=sp.x&&x<sp.x+sp.w&&y>=sp.y&&y<sp.y+sp.h);
test('activar patio elimina aviso sellado y conserva todos los muros; desactivar lo devuelve a interior',()=>{
 const e=setup(),before=copy(e.project.floors[0].items);
 assert.ok(e.detectFloorRegions(0).pending.length);
 e.editCourtyardAt({x:7,y:7},true);
 const patio=e.current().items.find(it=>it.courtyard);assert.ok(patio);
 assert.equal(e.spaceCache[0].pending.some(reg=>at(reg.spans,7,7)),false);
 assert.deepEqual(copy(e.current().items.filter(it=>it.a)),before);
 e.editCourtyardAt({x:7,y:7},false);
 assert.equal(e.current().items.some(it=>it.courtyard),false);
 assert.equal(e.spaceCache[0].pending.some(reg=>at(reg.spans,7,7)),true);
});
test('las losas superiores dejan el patio abierto y mantienen el anillo exterior',()=>{
 const e=setup();e.editCourtyardAt({x:7,y:7},true);
 for(const level of [0,1]){const slab=e.buildingSlabs(level);assert.equal(at(slab.spans,7,7),false);assert.equal(at(slab.spans,3,3),true);}
 e.editCourtyardAt({x:7,y:7},false);assert.equal(at(e.buildingSlabs(0).spans,7,7),true,'invalida caché al desactivar');
});
test('un cobertizo interior incluso mayor que el jardín restante no hereda el exterior',()=>{
 const e=setup();e.editCourtyardAt({x:7,y:7},true);
 e.current().items.push(...walls(6,6,8,8,'shed'));
 e.rebuildFloorSpaces(0);
 const patio=e.current().items.find(it=>it.courtyard);
 assert.equal(at(patio.spans,5.5,5.5),true);assert.equal(at(patio.spans,9,9),false);
 assert.equal(e.spaceCache[0].pending.some(reg=>at(reg.spans,9,9)),true);
 const slab=e.buildingSlabs(0);assert.equal(at(slab.spans,9,9),true);assert.equal(at(slab.spans,5.5,5.5),false);
 e.current().items=e.current().items.filter(it=>!it.id.startsWith('shed'));e.rebuildFloorSpaces(0);
 assert.equal(at(e.current().items.find(it=>it.courtyard).spans,9,9),true,'al quitar el cobertizo se reconecta el patio');
});
test('JSON conserva la decisión exterior y su proyección a plantas superiores sin duplicarla',()=>{
 const e=setup();e.editCourtyardAt({x:7,y:7},true);const saved=copy(e.project);
 e.project.floors=saved.floors;e.rebuildFloorSpaces(0);
 assert.equal(e.current().items.filter(it=>it.courtyard).length,1);
 const first=e.courtyardFloorItems(e.project.floors[1].items,1),second=e.courtyardFloorItems(first,1);
 assert.equal(first.filter(it=>it.inheritedCourtyard).length,1);assert.equal(second.length,first.length);
});
test('luz natural y clima reconocen el patio cerrado, pero el cobertizo queda protegido',()=>{
 const e=setup();e.editCourtyardAt({x:7,y:7},true);e.current().items.push(...walls(9,9,3,3,'shed'));e.rebuildFloorSpaces(0);
 const floor=e.current(),mask=Natural.computeAccess(floor,e.project.units);
 const sample=(x,y)=>mask.exteriorMask[Math.floor(y*mask.scale)*mask.width+Math.floor(x*mask.scale)];
 assert.equal(sample(7,7),1);assert.equal(sample(10,10),0);
 floor.items.push({id:'building',type:'building',x:1,y:1,w:18,h:18});
 const exposure=Weather.createExteriorExposure({floors:[floor],units:e.project.units,cell:1,slabs:[],natural:Natural});
 assert.equal(exposure(0,7,7),true);assert.equal(exposure(0,10,10),false);
 const classifier=e.shared.createExteriorClassifier(floor,{enabled:true,spans:e.buildingSlabs(0).spans});
 assert.equal(classifier.outside(7,7),true);assert.equal(classifier.outside(10,10),false);
 const location=Location.resolve(e.project,0,{x:7,y:7});
 assert.equal(location.kind,'exterior');assert.equal(location.secondary,'Patio exterior');
});
test('el toggle conserva identidad y nombre de habitación y actualiza las puertas hacia exterior',()=>{
 const e=setup();e.current().items=e.current().items.filter(it=>it.id!=='court0');
 e.current().items.push({id:'c1',type:'red_wall',a:{x:5,y:5},b:{x:7,y:5}},
  {id:'door',type:'door',a:{x:7,y:5},b:{x:8,y:5}},
  {id:'c2',type:'red_wall',a:{x:8,y:5},b:{x:15,y:5}});
 e.rebuildFloorSpaces(0);
 const room=e.current().items.find(it=>it.type==='room'&&e.areaHasPoint(it,{x:7,y:7}));
 room.label='Jardín';const id=room.id;
 e.editCourtyardAt({x:7,y:7},true);
 const neighbor=e.current().items.find(it=>it.type==='room');
 assert.ok(neighbor.connections.some(connection=>connection.doorId==='door'&&connection.toExterior));
 e.editCourtyardAt({x:7,y:7},false);
 const restored=e.current().items.find(it=>it.id===id);assert.equal(restored.label,'Jardín');assert.equal(restored.type,'room');
});
test('el motor real resta huecos a suelos y no permite caminar sobre un patio en pisos superiores',()=>{
 const engineContext={window:{}};
 for(let i=0;i<=12;i++)vm.runInNewContext(fs.readFileSync(__dirname+'/engine-'+String(i).padStart(2,'0')+'.js','utf8'),engineContext);
 const engine=Buffer.from(engineContext.window.__FOREST_EMBEDDED_ENGINE__,'base64').toString('utf8');
 const levels=vm.runInNewContext(cut('function addBuildingLevelsToEngine(doc){','// Restringe las fachadas de niveles vecinos')+'\naddBuildingLevelsToEngine',{});
 const patch=vm.runInNewContext(cut(' function addCourtyardsToEngine(doc){',' function addPreviewDiagnostics(doc){')+'\naddCourtyardsToEngine',{});
 const result=patch(levels(engine));
 const start=result.indexOf('function rectSubtract('),end=result.indexOf('// Cada escalera reserva',start);
 const walkStart=result.indexOf('function onStructuralSlab('),walkEnd=result.indexOf('// La superficie bajo',walkStart);
 const sky={type:'outside',courtyard:true,inheritedCourtyard:true,x:5,y:5,w:10,h:10};
 const env={DATA:{floors:[{items:[]},{items:[sky,{id:'room',type:'room',x:1,y:1,w:18,h:18}]}]},stairVoids:[[],[]],SLABS:[{enabled:false},{enabled:true,spans:[{x:1,y:1,w:18,h:18}]}],CELL:1,currentFloor:1,mainFloorIndex:0};
 vm.runInNewContext(result.slice(start,end)+result.slice(walkStart,walkEnd),env);
 assert.equal(at(env.surfaceRectsMinusVoids(1,1,1,18,18),7,7),false);
 assert.equal(at(env.surfaceRectsMinusVoids(0,1,1,18,18),7,7),true,'PB conserva el suelo del jardín');
 assert.equal(env.onStructuralSlab(7,7,1),false);assert.equal(env.onStructuralSlab(3,3,1),true);
 assert.ok(result.includes('||courtyardVoids[currentFloor]?.length)?'));
});
test('el patio puede desactivarse después de abrir sus paredes y reconectarlo con el exterior',()=>{
 const e=setup();e.editCourtyardAt({x:7,y:7},true);
 e.current().items=e.current().items.filter(it=>!['court0','outer0'].includes(it.id));
 e.rebuildFloorSpaces(0);e.editCourtyardAt({x:7,y:7},false);
 assert.equal(e.current().items.some(it=>it.courtyard),false);
});
