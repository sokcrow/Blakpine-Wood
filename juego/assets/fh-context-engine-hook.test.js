/* Regresión del radial y la integración del motor embebido.
 * Ejecutar: node --test juego/assets/fh-context-engine-hook.test.js
 */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const entry=read('index.html');
const hook=read('juego/assets/fh-context-engine-hook.js');
const engineFiles=Array.from({length:13},(_,i)=>'juego/assets/engine-'+String(i).padStart(2,'0')+'.js');

function generateEngine(){
 const parts=engineFiles.map(file=>{
  const match=read(file).match(/\|\|""\)\+"([^"]+)"\s*;/);
  assert.ok(match,'Falta un fragmento del motor: '+file);
  return match[1];
 });
 const original=Buffer.from(parts.join(''),'base64').toString('utf8');
 const document={baseURI:'https://example.test/Blakpine-Wood/'},window={document};
 new Function('window','URL',hook)(window,URL);
 const start=entry.indexOf('function addLiveTextToEngine(doc){');
 const end=entry.indexOf('let fhCharacterLaunchPending=false;',start);
 assert.ok(start>=0&&end>start);
 const factory=new Function('window','document','URL',
  entry.slice(start,end)+';return prepareGLBEngineDoc;');
 return factory(window,document,URL)(original);
}

test('el HTML generado integra radial y decoración sin afectar el editor 2D',()=>{
 const output=generateEngine();
 assert.match(output,/function fhContextRefresh\(\)/);
 assert.match(output,/FHSafeLock\?\.bind\(fhContextCanvas/);
 assert.match(output,/FHSafeLock\?\.bind\(\$\('use'\)/);
 assert.match(output,/fhUseButtonClick/);
 assert.match(output,/capture:true,suppressClick:true/);
 assert.match(output,/fh-interaction-radial\.js\?v=20261107-hold-gate/);
 assert.match(output,/fh-safe-lock\.js\?v=20261107-safe-lock-2/);
 assert.match(output,/fh-mobile-camera\.js\?v=20261108-landscape20/);
 assert.ok(output.includes("const fhPhoneCameraPointer=window.matchMedia?.('(pointer: coarse)');"));
 assert.ok(output.includes("const initialCameraDistance=window.FHMobileCamera?.distance(camDistance,innerWidth,innerHeight,!!fhPhoneCameraPointer?.matches)??camDistance;"));
 assert.ok(output.includes("const fhCameraDistance=window.FHMobileCamera?.distance(lightDistance,innerWidth,innerHeight,!!fhPhoneCameraPointer?.matches)??lightDistance;"));
 assert.match(output,/function updateCameraCutaway\(dt\)/);
 assert.match(output,/occlusionRay\.intersectObjects\(roots,true\)/);
 assert.ok(output.includes('const p=window.FHSleep.cameraPose(user.x,user.z,floorElev[currentFloor],playerPoseFacing);'));
 assert.match(output,/if\(gesture\.kind==='hold'\)\{radial\.open\(context,'hold'\);return;\}/);
 assert.match(output,/gesture\?\.source==='canvas'&&gesture\.kind==='hold'\)window\.FHLocationHUD\?\.peek\?\.\(\)/);
 assert.match(output,/gesture\?\.source==='canvas'&&gesture\.kind==='hold'&&!hit\)window\.FHLocationHUD\?\.peek\?\.\(\)/);

 assert.match(output,/primary\?\.run\(\)/);
 assert.match(output,/function fhContextOpenElevator\(shaft,fromLanding=false\)/);
 assert.match(output,/elevatorSystem\.doorControl\(shaft\.id,'open'\)/);
 assert.match(output,/ForestShared\.elevatorEntrancePoint\(target\.item,CELL\)/);
 assert.match(output,/ForestShared\.elevatorEntrancePoint\(landing\.item,CELL\)/);
 assert.match(output,/id:'elevator-open'/);
 assert.match(output,/window\.FHSleep\?\.needsComfort\(\)/);
 assert.match(output,/window\.FHSleep\.emitComfort\(fhSleepHead\)/);
 assert.doesNotMatch(output,/notice\(POSTURE_TEXT\.standing\)/);
 assert.doesNotMatch(output,/notice\(poseStep\.phase==='sitting'/);
 assert.match(output,/if\(playerPose\.occupied\)return toggleDoor\(\)/);
 assert.doesNotMatch(output,/fhContextTapStart/);
 assert.match(output,/radial\.syncContext\(context\)/);
 assert.match(output,/if\(!playerPose\.occupied&&courier&&/);
 assert.match(output,/front\?\.item/);
 assert.match(output,/radial\.syncContext\(null\)/);
 assert.match(output,/if\(radial\.visible&&radial\.target===key\)radial\.update\(context\)/);
 assert.doesNotMatch(output,/radial\.update\(actions\.length\?/);

 assert.match(output,/fhContextRefresh\(\)/);
 assert.match(output,/fh-interaction-radial\.js/);
 assert.match(output,/fh-safe-lock\.js/);
 assert.match(output,/\$\('use'\)\.addEventListener\('click',fhUseButtonClick\)/);
 assert.doesNotMatch(output,/\$\('use'\)\.addEventListener\('click',toggleDoor\)/);
 assert.match(output,/fh-interaction-strings\.js/);
 assert.match(output,/fh-interaction-radial\.css/);
 assert.match(output,/id:'knock',label:t\.knock\|\|'Llamar',disabled:true/);
 assert.match(output,/id:'examine',label:t\.examine\|\|'Examinar',disabled:!canExamine/);
 assert.match(output,/ForestHorrorStructureAPI\?\.inspect\(\{floorId:currentFloor,id:target\.id\}\)/);
 assert.match(output,/ForestHorrorStructureAPI\?\.inspectSelected\(currentFloor,target\.id\)/);
 assert.match(output,/ForestHorrorStructureAPI\?\.nearestWindow\?\.\(currentFloor,user\.x,user\.z,CELL\)/);
 assert.match(output,/windowNear&&windowNear\.dist\+\.15<selectedDistance/);
 assert.match(output,/key='window:'\+currentFloor\+':'\+it\.id/);
 assert.match(output,/ForestHorrorStructureAPI\?\.inspect\(\{floorId:currentFloor,id:it\.id\}\)/);
 assert.match(output,/ForestHorrorStructureAPI\?\.inspectSelected\(currentFloor,it\.id\)/);
 assert.match(output,/const canLook=target\.kind==='peephole_door'/);
 assert.match(output,/id='fhDecorModeBtn'/);
 assert.match(output,/if\(!fhDeliveryUiActive&&!window\.FHStorageRuntime\?\.isOpen\)moveUpdate\(dt\)/);
 assert.doesNotMatch(output,/if\(!fhDeliveryUiActive&&!fhDecorationActive\)moveUpdate\(dt\)/);
 assert.doesNotMatch(output,/pixelSize=pixelSize===2\?3/);
 assert.match(output,/fh-storage-runtime\.js\?v=20261108-hamazon-1/);
 assert.match(output,/fh-storage-strings\.js\?v=20261108-storage-1/);
 assert.match(output,/fh-storage\.css\?v=20261108-storage-1/);
 assert.match(output,/window\.FHStorageRuntime\?\.init\(/);
 assert.match(output,/window\.FHStorageRuntime\?\.supports\(it\)/);
 assert.match(output,/id:'storage_'\+it\.id,verb:'storage'/);
 assert.match(output,/window\.FHStorageRuntime\?\.open\(item,currentFloor\)/);
 assert.match(output,/window\.FHStorageRuntime\?\.isOpen\)return/);
 assert.match(output,/restored\?\.fhInventoryStorage/);
 assert.match(output,/item\.runtimeDeliveryFurniture&&item\.interact\?\.verb==='decorate'/);
 assert.match(output,/id:'storage',label:t\.openStorage/);
 assert.match(output,/let pixelSize=2/);
 assert.match(output,/intersectObjects\(a\.roots\.map\(entry=>entry\.root\),true\)/);
 const inline=[...output.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match=>match[1]).filter(Boolean);
 assert.ok(inline.length>0);
 for(const script of inline)assert.doesNotThrow(()=>new Function(script));
});

test('solo muebles decorables, no puertas ni estructura',()=>{
 const decoration=require('./fh-decoration.js');
 assert.equal(decoration.isMovable({id:'armario1',type:'wardrobe'}),true);
 assert.equal(decoration.isMovable({id:'sofa1',type:'sofa'}),true);
 assert.equal(decoration.isMovable({id:'modelo1',type:'misc',modelId:'mesa_pixel'}),true);
 assert.equal(decoration.isMovable({id:'puerta1',type:'door'}),false);
 assert.equal(decoration.isMovable({id:'lector1',type:'card_reader'}),false);
 assert.equal(decoration.isMovable({id:'puerta2',type:'misc',modelId:'puerta_electronica'}),false);
});
