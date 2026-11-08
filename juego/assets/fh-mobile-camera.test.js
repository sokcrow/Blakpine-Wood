/* Regresión de distancia sin alterar el motor embebido.
 * Ejecutar: node --test juego/assets/fh-mobile-camera.test.js
 */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const camera=require('./fh-mobile-camera.js');
const html=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');

test('el acercamiento de gameplay conserva la escala visual original del personaje',()=>{
 // El motor embebido trae un aumento visual de 1.15 y no debe reducirse a 1.
 assert.match(html,/const heroScaleBefore='const HERO_H=1\.68,HERO_VISUAL_SCALE=1\.15,'/);
 assert.doesNotMatch(html,/\.replace\(heroScaleBefore,/);
 assert.doesNotMatch(html,/HERO_VISUAL_SCALE=1,/);
 // El 30% de zoom sigue aplicado a la distancia, no al tamaño del jugador.
 assert.match(html,/const fhCameraDistance=window\.FHMobileCamera\?\.distance\(lightDistance,/);
});

test('celular vertical y horizontal se acercan exactamente 30%',()=>{
 assert.equal(camera.PHONE_SCALE,.70);
 assert.ok(Math.abs(camera.distance(11.2,390,844,true)-7.84)<1e-10);
 assert.ok(Math.abs(camera.distance(6.6,844,390,true)-4.62)<1e-10);
 assert.ok(Math.abs(camera.distance(12.6,390,844,true)-8.82)<1e-10,
  'el bono de luz también forma parte de la distancia que se acerca');
});
test('PC, tablets y pantallas sin puntero táctil mantienen la misma cámara',()=>{
 for(const [width,height,coarse] of [[1920,1080,false],[700,400,false],[820,1180,true],
  [1180,820,true],[1024,768,true],[0,640,true],[390,0,true]]){
  assert.equal(camera.distance(11.2,width,height,coarse),11.2);
 }
 assert.ok(Math.abs(camera.distance(11.2,844,390,true)-7.84)<1e-10,
  'el giro horizontal de un teléfono conserva el zoom');
});
test('distancias de cámara no válidas no se alteran',()=>{
 assert.equal(camera.distance(0,390,844,true),0);
 assert.equal(camera.distance(-10,390,844,true),-10);
 assert.equal(camera.distance(Infinity,390,844,true),Infinity);
});
test('adaptador integra distancia de celular sin tocar FOV ni la cámara cenital',()=>{
 assert.match(html,/fh-mobile-camera\.js\?v=20261107-phone30/);
 assert.match(html,/const fhPhoneCameraPointer=window\.matchMedia\?\.\('\(pointer: coarse\)'\)/);
 assert.match(html,/FHMobileCamera\?\.distance\(lightDistance,innerWidth,innerHeight,!!fhPhoneCameraPointer\?\.matches\)/);
 assert.match(html,/FHMobileCamera\?\.distance\(camDistance,innerWidth,innerHeight,!!fhPhoneCameraPointer\?\.matches\)/);
 assert.match(html,/const p=window\.FHSleep\.cameraPose\(user\.x,user\.z,floorElev\[currentFloor\],playerPoseFacing\)/);
 assert.match(html,/const lightDistance=camDistance\+\(window\.FHLights\?\.cameraBonus/);
 assert.doesNotMatch(html,/cam\.fov\s*=/);
});
