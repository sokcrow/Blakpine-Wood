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

const {mutationsAffectLayout,handoffToDialog}=require('../juego/assets/fh-editor-layout.js');
const text=value=>({nodeType:3,textContent:value});
const replaceText=(before,after)=>({type:'childList',removedNodes:[text(before)],addedNodes:[text(after)]});
test('renderizar reiteradamente la misma elevación no vuelve a programar la distribución',()=>{
 let scheduled=0;
 const observe=records=>{if(mutationsAffectLayout(records))scheduled++;};
 // Cambio real de nivel: una medición. Redibujos siguientes: ninguna más.
 observe([replaceText('','Altura: 10 pies')]);
 for(let i=0;i<60;i++)observe([replaceText('Altura: 10 pies','Altura: 10 pies')]);
 assert.equal(scheduled,1);
 // También deben ignorarse las sustituciones de texto vacío de la planta baja.
 observe([{type:'childList',removedNodes:[],addedNodes:[]}]);
 assert.equal(scheduled,1);
});
test('los cambios efectivos de texto y los nuevos controles siguen requiriendo medición',()=>{
 assert.equal(mutationsAffectLayout([replaceText('Piso 1','Sótano 2')]),true);
 assert.equal(mutationsAffectLayout([{type:'childList',removedNodes:[],addedNodes:[{nodeType:1,textContent:'Nueva herramienta'}]}]),true);
 assert.equal(mutationsAffectLayout([{type:'childList',removedNodes:[{nodeType:1,textContent:'Más'}],addedNodes:[text('Más')]}]),true);
 assert.equal(mutationsAffectLayout([replaceText('igual','igual'),replaceText('antes','después')]),true);
});
test('el texto modificado directamente se compara con el valor anterior observado',()=>{
 assert.equal(mutationsAffectLayout([{type:'characterData',oldValue:'10',target:{data:'10'}}]),false);
 assert.equal(mutationsAffectLayout([{type:'characterData',oldValue:'10',target:{data:'20'}}]),true);
});
function dialogFixture(open=true,alreadyFocused=false){
 const calls=[];
 const control={focus(){calls.push('focus');doc.activeElement=control;}};
 const overlay={
  classList:{contains:name=>name==='show'&&open},
  contains:el=>el===control,
  querySelector(selector){assert.ok(selector.includes(':not(:disabled)'));return control;}
 };
 const doc={activeElement:alreadyFocused?control:{},getElementById:id=>id==='overlay'?overlay:null};
 return {calls,doc,control,closePanels:()=>calls.push('close')};
}
test('abrir Conexiones cierra el popover antes de enfocar el diálogo',()=>{
 const f=dialogFixture();
 assert.equal(handoffToDialog(f.doc,f.closePanels),true);
 assert.deepEqual(f.calls,['close','focus']);
 assert.equal(f.doc.activeElement,f.control);
});
test('Opciones permanece abierto al ajustar controles que no abren diálogos',()=>{
 const f=dialogFixture(false);
 assert.equal(handoffToDialog(f.doc,f.closePanels),false);
 assert.deepEqual(f.calls,[]);
});
test('cerrar popovers conserva el foco cuando ya está dentro del diálogo',()=>{
 const f=dialogFixture(true,true);
 assert.equal(handoffToDialog(f.doc,f.closePanels),true);
 assert.deepEqual(f.calls,['close']);
 assert.equal(f.doc.activeElement,f.control);
});
