const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const index=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const strings=fs.readFileSync(path.join(__dirname,'fh-delivery-strings.js'),'utf8');

// El HTML principal debe tener JavaScript analizable.
for(const found of index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
 if(found[1].trim())new vm.Script(found[1],{filename:'index-inline.js'});
}
// El código que se inyecta en el motor Base64 también tiene que ser JavaScript válido.
const start=index.indexOf('const runtimeBlock=`');
const end=index.indexOf('`;\n  const furnitureBefore=',start);
assert.ok(start!==-1&&end>start,'debe existir el módulo runtime de decoración');
const injected=index.slice(start+'const runtimeBlock=`'.length,end);
new vm.Script('function testInjected(){\n'+injected+'\n}',{filename:'decoracion-runtime.js'});

assert.match(index,/const fhSavedDecor=GameState\.decoration/);
assert.match(index,/GameState\.decoration\.poses\[f\+':'\+item\.id\]/);
assert.match(index,/window\.FHDecoration\?\.isMovable\(item\)/);
assert.match(index,/function fhDecorationPointer\(event\)/);
assert.match(index,/function fhDecorChooseNearby\(\)/);
assert.match(index,/function fhDecorationCandidates\(\)/);
assert.match(index,/view\.addEventListener\(name,fhDecorationPointer,true\)/);
assert.match(index,/new THREE\.MeshBasicMaterial\(\{color:0x6dcc92/);
assert.match(index,/function fhRefreshDecorationPreview\(x,y,rotation\)/);
assert.match(index,/function fhStoreDecoration\(\)/);
assert.match(index,/No permitir fijar un mueble sólido encima del avatar/);
assert.match(index,/function fhRetrieveStoredFurniture\(id\)/);
assert.match(index,/fhDecorationSave\(a\.item,a\.floor\)/);
assert.match(strings,/decorateStored:'MUEBLES GUARDADOS'/);
assert.match(strings,/decorateDragHelp:'Arrastra el mueble/);
// Comprobar el verdadero punto de integración del motor embebido, no solo patrones de texto.
const engineContext={window:{}};
for(let i=0;i<=12;i++){
 const file=path.join(__dirname,'engine-'+String(i).padStart(2,'0')+'.js');
 vm.runInNewContext(fs.readFileSync(file,'utf8'),engineContext,{filename:file,timeout:5000});
}
const engine=Buffer.from(engineContext.window.__FOREST_EMBEDDED_ENGINE__,'base64').toString('utf8');
const funcStart=index.indexOf(' function addDeliveryToEngine(doc){');
const funcEnd=index.indexOf(' const engineSuccessBefore=',funcStart);
assert.ok(funcStart>=0&&funcEnd>funcStart,'la integración delivery debe conservarse');
const patchDelivery=vm.runInNewContext(index.slice(funcStart,funcEnd)+'\naddDeliveryToEngine',{}, {timeout:5000});
const patchedEngine=patchDelivery(engine); // Lanzaría error si cambió un ancla del motor.
assert.match(patchedEngine,/function fhStartDecoration\(/);
assert.match(patchedEngine,/function fhDecorChooseNearby\(/);
assert.match(patchedEngine,/GameState\.decoration=fhSavedDecor/);

console.log('PASS — decoración: integración y sintaxis');
