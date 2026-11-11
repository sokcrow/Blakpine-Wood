/* Regresiones: horror sin cifras reveladas, un HUD flotante y cierre explícito. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const UI=require('./fh-mood-fear-ui.js');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
test('el miedo usa la capa de ZZZ sin enseñar pérdida ni porcentaje de PS',()=>{
 const oldText=globalThis.FH_MOOD_FEAR_TEXT,oldLive=globalThis.FHLiveText;
 const sent=[];
 try{
  globalThis.FH_MOOD_FEAR_TEXT={keys:{nervioso:'Nervioso'}};
  globalThis.FHLiveText={clearKind:()=>{},soundAt:spec=>{sent.push(spec);return true;}};
  assert.equal(UI.fearChange({key:'nervioso',damage:25,percent:30},{x:4,y:2,z:7,floor:1}),true);
  assert.equal(sent.length,1);
  assert.equal(sent[0].kind,'fear');
  assert.equal(sent[0].text,'Nervioso');
  assert.equal(sent[0].fearLevel,'nervioso');
  assert.equal(sent[0].floor,1);
  assert.equal(UI.fearChange({key:'nervioso',damage:0},null),false);
 }finally{
  if(oldText===undefined)delete globalThis.FH_MOOD_FEAR_TEXT;
  else globalThis.FH_MOOD_FEAR_TEXT=oldText;
  if(oldLive===undefined)delete globalThis.FHLiveText;
  else globalThis.FHLiveText=oldLive;
 }
});
test('tocar al personaje abre; tocarlo de nuevo o el suelo cierra',()=>{
 let click;
 const canvas={
  addEventListener:(kind,fn)=>{if(kind==='click')click=fn;},
  removeEventListener(){},
 };
 UI.select(null);
 UI.bind(canvas,()=>({id:'personaje-a',x:100,y:40,bodyX:100,bodyY:125}));
 const evt=(x,y)=>({button:0,clientX:x,clientY:y,preventDefault(){},stopImmediatePropagation(){}});
 click(evt(100,95));assert.equal(UI.selected(),'personaje-a');
 click(evt(100,95));assert.equal(UI.selected(),null);
 click(evt(100,95));assert.equal(UI.selected(),'personaje-a');
 click(evt(250,200));assert.equal(UI.selected(),null);
});
test('Escape también cierra, sin agregar botones innecesarios',()=>{
 const old=globalThis.addEventListener,handlers={};
 try{
  globalThis.addEventListener=(kind,fn)=>{handlers[kind]=fn};
  UI.bind({addEventListener(){},removeEventListener(){}},()=>null);
  UI.select('a');
  handlers.keydown({key:'Escape'});
  assert.equal(UI.selected(),null);
  const code=read('fh-mood-fear-ui.js');
  assert.doesNotMatch(code,/fh-character-close|closeButton/);
  assert.match(code,/root\.document\?\.addEventListener\?\.\('pointerdown'/);
 }finally{
  if(old===undefined)delete globalThis.addEventListener;
  else globalThis.addEventListener=old;
 }
});
test('el motor no carga el HUD duplicado; los recursos permanecen en el flotante',()=>{
 const html=read('../../index.html'),ui=read('fh-mood-fear-ui.js'),css=read('fh-mood-fear.css');
 assert.doesNotMatch(html,/FHStatusHUD\?\.update/);
 assert.doesNotMatch(html,/fh-status-hud\.js/);
 assert.doesNotMatch(html,/fh-status-hud\.css/);
 assert.match(ui,/fh-character-mood-icon/);
 assert.match(ui,/for\(const key of \['pg','sp','pe'\]\)/);
 assert.doesNotMatch(ui,/fh-character-count|PS ·|title\+loss/);
 assert.match(css,/\.fh-character-floating\{/);
 assert.match(css,/\.fh-character-floating\{[\s\S]*?clip-path:polygon\(/);
 assert.match(css,/\.fh-character-floating::before\{[\s\S]*?background:linear-gradient\([\s\S]*?clip-path:polygon\(/);
 assert.match(css,/background:linear-gradient\(135deg,#ffffff 0%,#e0e0e2 50%,#f8f8f9 100%\)/);
 assert.doesNotMatch(css,/#c43be0|#9a20b7|#6a128b/);
 assert.match(css,/border:0;outline:0;box-shadow:none;border-radius:0/);
 assert.doesNotMatch(css,/border:2px solid #814399/);
 assert.doesNotMatch(css,/#fhStatusHUD/);
});
test('ubicación se mantiene centrada, compacta y transitoria después de quitar el HUD lateral',()=>{
 const html=read('../../index.html');
 const locationCss=read('fh-location-hud.css');
 const locationJs=read('fh-location-hud.js');
 const restored=locationCss.slice(locationCss.lastIndexOf('/* Ubicación: anuncio compacto, centrado y transitorio.'));
 assert.ok(restored.includes('position:fixed;'),'No se mantiene en el viewport');
 assert.ok(restored.includes('left:50%;'),'Debe centrarse horizontalmente');
 assert.ok(restored.includes('transform:translateX(-50%);'),'El panel debe centrar su propio ancho');
 assert.ok(restored.includes('width:min(300px,calc(100vw - 24px));'),'El tamaño debe ser compacto');
 assert.ok(restored.includes('#hud.fh-location-hud.fh-location-hidden {'),'Falta selector de ocultación');
 assert.ok(restored.includes('opacity:0;')&&restored.includes('visibility:hidden;'),'Debe desaparecer sin bloquear clics');
 assert.ok(locationJs.includes('const DISPLAY_MS=2800;'),'Conservar duración de 2.8 segundos');
 assert.ok(html.lastIndexOf('mobileCameraScript+locationCss')>html.indexOf('const locationCss='),'CSS final debe ganar la cascada');
 assert.ok(!html.includes('fh-status-hud.css'),'No cargar HUD antiguo');
 assert.ok(locationCss.includes('#hud.fh-location-hud #fhFloorCode {display:none!important}'),'No debe mostrarse círculo PB');
 assert.ok(locationCss.includes('.fh-location-has-secondary #floorLabel'),'Separador entre distrito y habitación');
 assert.ok(locationCss.includes('border-bottom:1px solid rgba(245,241,236,.85);'),'Separador blanco');
 assert.ok(locationCss.includes('::after {display:none}'),'No dejar la antigua línea al pie');
 assert.ok(locationJs.includes("host.classList.toggle('fh-location-has-secondary',Boolean(value.secondary))"),'Línea solo con habitación');

});
test('HUD compacto sin etiquetas: nombre dentro de PG y PS/PE idénticas',()=>{
 const ui=read('fh-mood-fear-ui.js'),css=read('fh-mood-fear.css');
 assert.match(ui,/fh-character-line fh-character-line--/);
 assert.match(ui,/if\(key==='pg'\)track\.append\(name\)/);
 assert.doesNotMatch(ui,/fh-character-stat|track\.append\(label,name\)|stats\.append\(name\)/);
 assert.match(css,/width:min\(270px,calc\(100vw - 20px\)\)/);
 assert.match(css,/\.fh-character-track-pg\{height:20px\}/);
 assert.match(css,/\.fh-character-line--sp,\.fh-character-line--pe\{width:100%\}/);
 assert.match(css,/\.fh-character-data\{[\s\S]*?width:100%;min-width:0;display:grid;grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/\.fh-character-track-pg\{height:20px\}/);
 assert.match(css,/\.fh-character-track\{[\s\S]*?width:100%;height:8px/);
 assert.match(css,/\.fh-character-name\{[\s\S]*?position:absolute/);
 assert.doesNotMatch(css,/\.fh-character-stat/);
});
test('miedo usa letras de color con contorno negro sin recuadro',()=>{
 const css=read('fh-mood-fear.css');
 const start=css.indexOf('#fhSpatialLayer .fh-sound.fh-fear-comic{');
 const end=css.indexOf('#fhSpatialLayer .fh-fear-comic--relajado',start);
 assert.ok(start>=0&&end>start);
 const rule=css.slice(start,end);
 assert.match(rule,/color:var\(--fear\)/);
 assert.match(rule,/background:transparent;border:0;outline:0;box-shadow:none/);
 assert.match(rule,/-webkit-text-stroke:1\.4px #050505/);
 assert.doesNotMatch(rule,/background:var\(--fear\)|border:3px|padding:5px/);
});
test('seis estados de miedo con color, utilizando FHLiveText',()=>{
 const live=read('fh-live-text.js'),css=read('fh-mood-fear.css'),ui=read('fh-mood-fear-ui.js');
 assert.match(live,/fh-sound fh-fear-comic fh-fear-comic--/);
 assert.match(ui,/root\.FHLiveText\.soundAt\(/);
 for(const key of ['relajado','calmado','nervioso','atemorizado','sin_esperanza','abrumado'])
  assert.ok(css.includes('fh-fear-comic--'+key),'Falta '+key);
});
