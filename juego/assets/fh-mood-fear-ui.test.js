/* Regresión: Mood integrado al HUD y miedo en la misma capa espacial que ZZZ. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const UI=require('./fh-mood-fear-ui.js');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');

test('avisos de miedo se envían a FHLiveText con posición y nivel; no a un popup fijo',()=>{
 const previousText=globalThis.FH_MOOD_FEAR_TEXT,previousLive=globalThis.FHLiveText;
 const received=[],removed=[];
 try{
  globalThis.FH_MOOD_FEAR_TEXT={keys:{nervioso:'Nervioso'}};
  globalThis.FHLiveText={
   clearKind:kind=>removed.push(kind),
   soundAt:spec=>{received.push(spec);return true;}
  };
  assert.equal(UI.fearChange({key:'nervioso',damage:3},{x:4,y:2,z:7,floor:1}),true);
  assert.deepEqual(removed,['fear']);
  assert.equal(received.length,1);
  assert.equal(received[0].kind,'fear');
  assert.equal(received[0].fearLevel,'nervioso');
  assert.equal(received[0].text,'Nervioso −3 PS');
  assert.equal(received[0].floor,1);
  assert.equal(received[0].x,4);
  assert.equal(received[0].self,true);
  assert.equal(UI.fearChange({key:'nervioso',damage:0},null),false);
 }finally{
  if(previousText===undefined)delete globalThis.FH_MOOD_FEAR_TEXT;
  else globalThis.FH_MOOD_FEAR_TEXT=previousText;
  if(previousLive===undefined)delete globalThis.FHLiveText;
  else globalThis.FHLiveText=previousLive;
 }
});

test('un clic sobre el cuerpo proyectado selecciona, no exige tocar la cabeza',()=>{
 let click;
 const canvas={addEventListener:(type,fn)=>{if(type==='click')click=fn;},removeEventListener(){}};
 UI.bind(canvas,()=>({id:'personaje-a',x:100,y:40,bodyX:100,bodyY:125}));
 let prevented=0,stopped=0;
 click({button:0,clientX:100,clientY:95,preventDefault(){prevented++},stopImmediatePropagation(){stopped++}});
 assert.equal(prevented,1);
 assert.equal(stopped,1);
 UI.select(null);
});

test('Mood se dibuja en HUD original y PG/PS/PE usan barras de ancho continuo',()=>{
 const status=read('fh-status-hud.js'),css=read('fh-mood-fear.css'),index=read('../../index.html');
 assert.match(status,/function update\(resources,mental\)/);
 assert.match(status,/fh-status-mood-icon/);
 assert.match(status,/const fill=node\(doc,'span','fh-status-fill fh-status-fill--'\+key\)/);
 assert.match(index,/FHStatusHUD\?\.update\(window\.FHCharacterRuntime\?\.character\?\.resources,window\.FHCharacterRuntime\?\.character\?\.mental\)/);
 assert.match(css,/#fhStatusHUD \.fh-status-mood/);
 assert.match(css,/#fhStatusHUD \.fh-status-fill--pe/);
});

test('el color del miedo lo define una clase del texto espacial, nunca fh-fear-pop',()=>{
 const live=read('fh-live-text.js'),css=read('fh-mood-fear.css'),ui=read('fh-mood-fear-ui.js');
 assert.match(live,/fh-sound fh-fear-comic fh-fear-comic--/);
 assert.match(css,/#fhSpatialLayer \.fh-sound\.fh-fear-comic/);
 for(const key of ['relajado','calmado','nervioso','atemorizado','sin_esperanza','abrumado'])
  assert.ok(css.includes('fh-fear-comic--'+key),'Falta color '+key);
 assert.doesNotMatch(ui,/fh-fear-pop/);
});
