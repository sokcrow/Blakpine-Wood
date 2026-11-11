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
test('Escape y X son formas de cerrar, con control accesible',()=>{
 const old=globalThis.addEventListener,handlers={};
 try{
  globalThis.addEventListener=(kind,fn)=>{handlers[kind]=fn};
  UI.bind({addEventListener(){},removeEventListener(){}},()=>null);
  UI.select('a');
  handlers.keydown({key:'Escape'});
  assert.equal(UI.selected(),null);
  const code=read('fh-mood-fear-ui.js');
  assert.match(code,/fh-character-close/);
  assert.match(code,/closeButton\.addEventListener\('click'/);
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
 assert.match(css,/border:2px solid #814399/);
 assert.doesNotMatch(css,/#fhStatusHUD/);
});
test('seis estados de miedo con color, utilizando FHLiveText',()=>{
 const live=read('fh-live-text.js'),css=read('fh-mood-fear.css'),ui=read('fh-mood-fear-ui.js');
 assert.match(live,/fh-sound fh-fear-comic fh-fear-comic--/);
 assert.match(ui,/root\.FHLiveText\.soundAt\(/);
 for(const key of ['relajado','calmado','nervioso','atemorizado','sin_esperanza','abrumado'])
  assert.ok(css.includes('fh-fear-comic--'+key),'Falta '+key);
});
