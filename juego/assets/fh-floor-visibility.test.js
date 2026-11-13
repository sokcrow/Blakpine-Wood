'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {facadeCandidate,undergroundMask}=require('./fh-floor-visibility.js');

test('desde F1 interior no se renderiza F2 sin ventana exterior aunque entre en cámara',()=>{
 assert.equal(facadeCandidate(0,1,true,true),false);
 assert.equal(facadeCandidate(0,2,true,true),false);
});

test('una ventana exterior puede habilitar fachada superior, pero no salta cámara ni FOW',()=>{
 assert.equal(facadeCandidate(0,1,true,true,true),true);
 assert.equal(facadeCandidate(0,1,true,false,true),false);
 assert.equal(facadeCandidate(0,1,true,true,false),false);
 assert.equal(facadeCandidate(0,1,true,true,1),false);
});

test('una escalera o hueco interior sin ventana exterior no revela el piso superior',()=>{
 assert.equal(facadeCandidate(0,1,true,true,false),false);
 assert.equal(facadeCandidate(1,2,true,true,false),false);
});

test('desde el exterior se permiten otros pisos únicamente dentro del campo de cámara',()=>{
 assert.equal(facadeCandidate(0,1,false,true),true);
 assert.equal(facadeCandidate(0,1,false,false),false);
 assert.equal(facadeCandidate(2,0,false,true),true);
 assert.equal(facadeCandidate(2,0,false,false),false);
});

test('desde F2 no se ve F1 interior sin abertura real',()=>{
 assert.equal(facadeCandidate(1,0,true,true),false);
 assert.equal(facadeCandidate(1,0,true,true,true),true);
 assert.equal(facadeCandidate(1,0,true,false),false);
 assert.equal(facadeCandidate(1,2,true,true),false);
});

test('una mirilla interior no habilita fachadas superiores',()=>{
 assert.equal(facadeCandidate(0,1,true,true),false);
});

test('los valores no válidos nunca activan fachadas',()=>{
 assert.equal(facadeCandidate(-1,0,true,true),false);
 assert.equal(facadeCandidate(NaN,1,false,true),false);
 assert.equal(facadeCandidate(0,Infinity,false,true),false);
 assert.equal(facadeCandidate(0,1,false,undefined),false);
});

test('el editor integra la regla en las fachadas y conserva el FOW original',()=>{
 const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
 assert.match(html,/function addFloorVisibilityToEngine\(doc\)/);
 assert.match(html,/FHFloorVisibility\.facadeCandidate\(currentFloor,f,inside,inCameraVolume\(bounds\),upperWindows\.length>0,mainFloorIndex\)/);
 assert.match(html,/const upperWindows=inside&&f===currentFloor\+1\?openings\.filter\(it=>it\.type==='window'\):openings;/);
 assert.match(html,/sampleAllowed=p=>floorSightThroughOpening\(f,at,\{x:p.x,z:p.z,y:targetY\},upperWindows\)/);
 // Conserva fachadas, luz natural y el adaptador Mood/Miedo vigente.
 assert.match(html,/addFloorVisibilityToEngine\(addNaturalLightToEngine\(addShadowEncountersToEngine\(assembled\)\)\)/);
 assert.match(html,/addPreviewDiagnostics\(addCourtyardsToEngine\(addMoodFearToEngine\(/);
 assert.match(html,/\.\/juego\/assets\/fh-floor-visibility\.js/);
 assert.match(html,/const inside=outside!==true\|\|underRoof;/);
 assert.match(html,/const roofSpans=SLABS\[currentFloor\+1\]\?\.spans\|\|\[\];/);
 assert.match(html,/const underRoof=roofSpans\.some\(/);
});

test('los dos hooks siguen presentes una sola vez en el motor embebido',()=>{
 const parts=Array.from({length:13},(_,i)=>{
  const name='engine-'+String(i).padStart(2,'0')+'.js';
  const file=fs.readFileSync(path.join(__dirname,name),'utf8');
  const start=file.indexOf('+"')+2,end=file.lastIndexOf('";');
  assert.ok(start>1&&end>start,name+' debe contener su bloque Base64');
  return file.slice(start,end);
 });
 const original=Buffer.from(parts.join(''),'base64').toString('utf8');
 assert.equal(original.split(' if(!inCameraVolume(bounds))return false;').length-1,1);
 assert.equal(original.split('const inside=!peeking&&outside!==true;').length-1,1);
});

test('desde B1 nunca se renderiza PB ni pisos superiores, incluso con cámara y ventanas',()=>{
 assert.equal(undergroundMask(0,1),true);
 assert.equal(undergroundMask(1,1),false);
 assert.equal(facadeCandidate(0,1,false,true,true,1),false,'Exterior B1 no revela PB');
 assert.equal(facadeCandidate(0,1,true,true,true,1),false,'Una ventana B1 no revela PB');
 assert.equal(facadeCandidate(0,2,false,true,true,1),false,'B1 no revela P1');
 assert.equal(facadeCandidate(1,2,false,true,true,1),true,'PB conserva sus fachadas superiores');
 const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
 assert.match(html,/undergroundMask\(currentFloor,mainFloorIndex\)/);
 assert.match(html,/for\(const g of exteriorLayers\)g.visible=false;/);
 assert.match(html,/for\(const g of lowerGroundLayers\)g.visible=false;/);
});

test('motor ensamblado: B1 apaga fachadas y terreno antes de evaluar visibilidad',()=>{
 const vm=require('node:vm');
 const editor=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
 const start=editor.indexOf('function addFloorVisibilityToEngine(doc){');
 const end=editor.indexOf('// Recursos y estados de personaje:',start);
 const patch=new Function('document','URL','addBuildingLevelsToEngine','addSurvivalToEngine',
  editor.slice(start,end)+';return addFloorVisibilityToEngine;')(
   {baseURI:'https://example.test/'},URL,doc=>doc,doc=>doc);
 const chunks=Array.from({length:13},(_,i)=>{
  const file=fs.readFileSync(path.join(__dirname,'engine-'+String(i).padStart(2,'0')+'.js'),'utf8');
  return file.match(/\+"([A-Za-z0-9+/=]+)";/)[1];
 });
 const prepared=patch(Buffer.from(chunks.join(''),'base64').toString('utf8'));
 const from=prepared.indexOf('function updateAdjacentVisibility(');
 const source=prepared.slice(from,prepared.indexOf('function displayFloorLayers()',from));
 const exteriorLayers=[{visible:true},{visible:true}],lowerGroundLayers=[{visible:true},{visible:true}];
 let checks=0;
 const env={window:{FHFloorVisibility:{undergroundMask}},currentFloor:0,mainFloorIndex:1,
  exteriorLayers,lowerGroundLayers,performance:{now:()=>0},occupiedShaft:()=>{checks++;return true;}};
 vm.runInNewContext(source+';updateAdjacentVisibility(0,true);',env);
 assert.ok([...exteriorLayers,...lowerGroundLayers].every(g=>g.visible===false));
 assert.equal(checks,0,'B1 no recorre proxies, rayos ni frustum');
 env.currentFloor=1;
 vm.runInNewContext('updateAdjacentVisibility(0,true);',env);
 assert.equal(checks,1,'Al volver a PB se retoma el camino nativo de visibilidad');
});

test('los sótanos no se habilitan como fachadas exteriores desde PB ni desde pisos altos',()=>{
 assert.equal(facadeCandidate(1,0,false,true,true,1),false);
 assert.equal(facadeCandidate(2,1,true,true,true,2),false);
 assert.equal(facadeCandidate(2,1,false,true,true,2),false);
 assert.equal(facadeCandidate(2,1,false,true,true,0),true,'la fachada de un piso sobre PB sigue visible desde fuera');
 assert.equal(facadeCandidate(2,1,false,true,true,NaN),false);
});

test('un rayo hacia abajo no atraviesa una losa aunque exista una ventana',()=>{
 const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
 const from=html.indexOf('function rayThroughExteriorOpening(');
 // La función compartida no depende de estado del renderer.
 const body=html.slice(from,html.indexOf('\n}\n',from)+2);
 const ray=new Function('return ('+body+')')();
 const eye={x:0,y:1.55,z:0},target={x:4,y:-3,z:0};
 const window={type:'window',a:{x:.5,y:-1},b:{x:.5,y:1}};
 const slab=[{x:0,y:-1,w:4,h:2}];
 assert.equal(ray(eye,target,[window],1,0,0,slab),false);
 assert.equal(ray(eye,target,[],1,0,0,[]),false,'sin abertura tampoco hay permiso de visión');
 assert.equal(ray(eye,target,[window],1,0,0,[]),true,'una abertura física con rayo libre permite ver fuera');
 const hole=[{x:0,y:-1,w:1,h:2},{x:2,y:-1,w:2,h:2}];
 assert.equal(ray(eye,target,[window],1,0,0,hole),true,'la losa recortada respeta el hueco real');
 const door={...window,type:'door',open:false};
 assert.equal(ray(eye,target,[door],1,0,0,[]),false);
 assert.equal(ray(eye,target,[{...door,open:true}],1,0,0,[]),true);
 assert.equal(ray(eye,{x:4,y:5,z:0},[window],1,0,3,slab),false,'la protección hacia arriba se conserva');
});
