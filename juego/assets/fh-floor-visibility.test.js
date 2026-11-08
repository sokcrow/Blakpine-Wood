'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {facadeCandidate}=require('./fh-floor-visibility.js');

test('desde F1 interior no se renderiza F2 aunque entre en el campo de cámara',()=>{
 assert.equal(facadeCandidate(0,1,true,true),false);
 assert.equal(facadeCandidate(0,2,true,true),false);
});

test('desde el exterior se permiten otros pisos únicamente dentro del campo de cámara',()=>{
 assert.equal(facadeCandidate(0,1,false,true),true);
 assert.equal(facadeCandidate(0,1,false,false),false);
 assert.equal(facadeCandidate(2,0,false,true),true);
 assert.equal(facadeCandidate(2,0,false,false),false);
});

test('desde F2 se permite ver F1 dentro del ángulo, sujeto al FOW existente',()=>{
 assert.equal(facadeCandidate(1,0,true,true),true);
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
 assert.match(html,/FHFloorVisibility\.facadeCandidate\(currentFloor,f,inside,inCameraVolume\(bounds\)\)/);
 assert.match(html,/return addFloorVisibilityToEngine\(addNaturalLightToEngine\(assembled\)\)/);
 assert.match(html,/\.\/juego\/assets\/fh-floor-visibility\.js/);
 assert.match(html,/const inside=outside!==true;/);
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
