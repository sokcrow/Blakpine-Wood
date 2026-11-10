'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const doc=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const start=doc.indexOf('const ForestShared=(()=>{');
const end=doc.indexOf("\n'use strict';",start);
assert.ok(start>=0&&end>start,'se encuentra la validación compartida usada por el motor');
const shared=new Function(doc.slice(start,end)+';return ForestShared;')();
function sample(){
 return {schema:'forest-horror-map-v1',version:2,title:'Escalera al sótano',
  units:{columns:40,rows:40},mainFloorId:'pb',floors:[
   {id:'b1',name:'Sótano',elevationFt:-10,ceilingHeightFt:9,items:[]},
   {id:'pb',name:'Planta baja',elevationFt:0,ceilingHeightFt:9,items:[
    {id:'down_pb',type:'stairs',x:8,y:10,w:.5,h:3.5,rotation:90,targetFloorId:'b1',stairDirection:'down',heightFt:10}
   ]}
  ]};
}
function sync(project){
 const a=doc.indexOf('function syncStairLinks(){');
 const b=doc.indexOf('function syncPropertyDoorRoles(){',a);
 assert.ok(a>=0&&b>a);
 let id=0;
 new Function('project','ForestShared','numId',doc.slice(a,b)+';syncStairLinks();')(
  project,shared,()=>('generated_'+(++id)));
}
test('bajada sin bloqueo: sincronizar, serializar y cargar no rechaza el tramo automático',()=>{
 const project=sample();sync(project);
 assert.equal(project.floors[0].items[0].stairBlockFlag,'');
 const serialized=JSON.stringify(project);
 const restored=shared.loadProject(JSON.parse(serialized));
 assert.equal(JSON.stringify(project),serialized,'la carga no modifica el mapa original');
 assert.equal(restored.floors[0].items[0].targetFloorId,'pb');
 assert.equal(shared.stairAccessBlocked({item:restored.floors[0].items[0]},[],{}),false);
});
test('bandera opcional vacía o ausente se acepta en escaleras y ambos tipos de puerta',()=>{
 for(const type of ['stairs','door','peephole_door'])for(const value of [undefined,'']){
  const project=sample(),item=project.floors[1].items[0];
  Object.assign(item,{type,a:{x:1,y:1},b:{x:2,y:1}});
  if(value!==undefined)item.stairBlockFlag=value;
  assert.doesNotThrow(()=>shared.loadProject(project),type);
 }
});
test('quitar una bandera propaga el cambio y el mapa vuelve a cargar sin bloqueo',()=>{
 const project=sample(),entry=project.floors[1].items[0];
 entry.stairBlockFlag='porton_cerrado';sync(project);
 assert.equal(project.floors[0].items[0].stairBlockFlag,'porton_cerrado');
 entry.stairBlockFlag='';sync(project);
 const restored=shared.loadProject(JSON.parse(JSON.stringify(project)));
 for(const floor of restored.floors)for(const item of floor.items)
  assert.equal(shared.stairAccessBlocked({item},[],{porton_cerrado:true}),false);
});
test('una bandera configurada conserva el bloqueo en ambos sentidos',()=>{
 const project=sample();project.floors[1].items[0].stairBlockFlag='porton_cerrado';sync(project);
 const restored=shared.loadProject(project);
 for(const floor of restored.floors)for(const item of floor.items){
  assert.equal(item.stairBlockFlag,'porton_cerrado');
  assert.equal(shared.stairAccessBlocked({item},[],{porton_cerrado:true}),true);
  assert.equal(shared.stairAccessBlocked({item},[],{porton_cerrado:false}),false);
 }
});
test('se siguen rechazando tipos incorrectos y un identificador formado solo por espacios',()=>{
 for(const type of ['stairs','door','peephole_door'])for(const value of [null,false,0,{},[],'   ']){
  const project=sample(),item=project.floors[1].items[0];
  Object.assign(item,{type,a:{x:1,y:1},b:{x:2,y:1},stairBlockFlag:value});
  assert.throws(()=>shared.loadProject(project),error=>
   error.name==='MapValidationError'&&error.errors.some(e=>e.path==='floors[1].items[0].stairBlockFlag'));
 }
});

test('motor 3D recibe el validador corregido antes de validar el mapa',()=>{
 const a=doc.indexOf('function syncEngineMapValidation(source){');
 const b=doc.indexOf('function prepareGLBEngineDoc(source){',a);
 assert.ok(a>=0&&b>a);
 assert.ok(doc.includes('source=syncEngineMapValidation(source);'));
 const patch=new Function('ForestShared',doc.slice(a,b)+';return syncEngineMapValidation;')(shared);
 const raw=fs.readFileSync(path.join(__dirname,'engine-00.js'),'utf8');
 const holder={};new Function('window',raw)(holder);
 const engine=Buffer.from(holder.__FOREST_EMBEDDED_ENGINE__,'base64').toString('utf8');
 const updated=patch(engine);
 const start=updated.indexOf('const ForestShared=(()=>{');
 const end=updated.indexOf('})();',updated.indexOf('// shared/migrate.js',start))+5;
 assert.ok(start>=0&&end>start);
 const runtime=new Function(updated.slice(start,end)+';return ForestShared;')();
 const project=sample();sync(project);
 assert.doesNotThrow(()=>runtime.loadProject(project));
 assert.equal(patch(updated),updated,'el parche es idempotente');
 assert.throws(()=>patch('motor incompatible'),/validación compartida/);
});
