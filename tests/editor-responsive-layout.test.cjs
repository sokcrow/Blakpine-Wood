'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {visibleCount}=require('../juego/assets/fh-editor-layout.js');

test('el último botón sólo permanece fuera del menú si cabe completo',()=>{
 assert.equal(visibleCount([73,73,73],231,70,6),3);
 assert.equal(visibleCount([73,73,73],230,70,6),2);
 assert.equal(visibleCount([73,73,73],148,70,6),0);
 assert.equal(visibleCount([73,73,73],149,70,6),1);
});
test('se reserva espacio real para Más y sus separaciones',()=>{
 for(const available of [320,390,667,844,1024,1366,1440,1920]){
  const widths=[95,110,73,90,120,74,83,92,73,130,111,100,85,115,90,78,91,118,101,109];
  const count=visibleCount(widths,available,118,6);
  const used=widths.slice(0,count).reduce((a,b)=>a+b,0)+Math.max(0,count-1)*6+(count<widths.length?118+(count?6:0):0);
  assert.ok(used<=available,`${available}: ${used}`);
  if(count<widths.length)assert.ok(used+widths[count]+6>available);
 }
});
test('una barra compacta conserva todas las herramientas dentro del desplegable',()=>{
 assert.equal(visibleCount([80,80],1000,90,6,true),0);
 assert.equal(visibleCount([220],100,80),0);
 assert.equal(visibleCount([],100,80),0);
});
test('el cálculo admite tamaños fraccionarios sin recortar el siguiente botón',()=>{
 assert.equal(visibleCount([73.25,73.25,73.25],231.74,70.5,6),2);
 assert.equal(visibleCount([73.25,73.25,73.25],231.75,70.5,6),3);
});
