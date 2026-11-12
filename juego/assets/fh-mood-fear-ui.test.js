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
test('solo tocar al personaje alterna el HUD; el suelo no lo cierra',()=>{
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
 click(evt(250,200));assert.equal(UI.selected(),'personaje-a');
 UI.select(null);
});
test('Escape y un puntero fuera del personaje no descartan la selección',()=>{
 const old=globalThis.addEventListener,handlers={};
 try{
  globalThis.addEventListener=(kind,fn)=>{handlers[kind]=fn};
  UI.bind({addEventListener(){},removeEventListener(){}},()=>null);
  UI.select('a');
  handlers.keydown?.({key:'Escape'});
  assert.equal(UI.selected(),'a');
  const code=read('fh-mood-fear-ui.js');
  assert.doesNotMatch(code,/fh-character-close|closeButton/);
  assert.doesNotMatch(code,/root\.document\?\.addEventListener\?\.\('pointerdown'/);
 }finally{
  UI.select(null);
  if(old===undefined)delete globalThis.addEventListener;
  else globalThis.addEventListener=old;
 }
});
test('un solo Nameplate al seleccionar: el UI viejo no dibuja panel',()=>{
 const html=read('../../index.html'),ui=read('fh-mood-fear-ui.js'),css=read('fh-mood-fear.css');
 assert.doesNotMatch(html,/FHStatusHUD\?\.update|fh-status-hud\.js|fh-status-hud\.css/);
 assert.match(html,/\['script','fh-nameplate-hud\.js'\]/);
 assert.match(ui,/root\.FHNameplateHUD\?\.update\?\.\(character,position,before\)/);
 assert.match(ui,/root\.FHNameplateHUD\?\.hide\?\.\(\)/);
 assert.doesNotMatch(ui,/fh-character-floating|body\.append\(panel\)/);
 assert.doesNotMatch(css,/\.fh-character-floating/);
 assert.match(css,/#fhSpatialLayer \.fh-sound\.fh-fear-comic/);
});
test('la selección dirige solo al Nameplate y permite cerrarlo',()=>{
 const old=globalThis.FHNameplateHUD;
 let calls=0,closed=0;
 try{
  globalThis.FHNameplateHUD={
   update:(character,position)=>{calls++;return Boolean(character?.id&&position);},
   hide:()=>{closed++;},
   mount:()=>true
  };
  UI.select('personaje-a');
  assert.equal(UI.render({id:'personaje-a',name:'X'}, {x:100,y:150}),true);
  assert.equal(calls,1);
  UI.select(null);
  assert.equal(UI.render({id:'personaje-a'},{x:100,y:150}),false);
  assert.equal(calls,1);
  assert.ok(closed>=1);
 }finally{
  if(old===undefined)delete globalThis.FHNameplateHUD;
  else globalThis.FHNameplateHUD=old;
 }
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
test('el HUD integrado conserva nombre y recursos sin etiquetas',()=>{
 const ui=read('fh-mood-fear-ui.js'),np=read('fh-nameplate-hud.js');
 assert.match(ui,/root\.FHNameplateHUD\?\.update/);
 assert.match(np,/const RESOURCE_KEYS = Object\.freeze\(\['pg', 'sp', 'pe'\]\)/);
 assert.match(np,/const name\s*=\s*typeof character\.name/);
 assert.match(np,/fh-np-health-fill/);
 assert.doesNotMatch(np,/fh-character-stat|fh-status-count/);
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

test('PG, PS y PE activan placa temporal prioritaria y siguen la cabeza proyectada',()=>{
 const old=globalThis.FHNameplateHUD,oldNow=Date.now;
 let current=1000,hidden=0;
 const renders=[];
 try{
  Date.now=()=>current;
  globalThis.FHNameplateHUD={
   update:(character,position,before)=>{
    renders.push({id:character.id,x:position.x,y:position.y,before});
    return true;
   },
   hide:()=>{hidden++;},
   mount:()=>true
  };
  UI.select(null);UI.render(null,null);
  const character={id:'actor-hud',resources:{pg:100,pgMax:100,sp:20,spMax:20,pe:8,peMax:10}};
  assert.equal(UI.render(character,{x:100,y:200}),false,'la lectura inicial no activa HUD');
  character.resources.pg=70;
  assert.equal(UI.render(character,{x:102,y:199}),true,'PG perdido');
  assert.equal(renders.at(-1).before.pg,100,'la primera alerta anima desde PG anterior');
  current=1300;
  assert.equal(UI.render(character,{x:135,y:180}),true,'la placa sigue la cabeza en movimiento');
  assert.equal(renders.at(-1).x,135);
  assert.equal(renders.at(-1).y,180);
  character.resources.pg=80;
  assert.equal(UI.render(character,{x:136,y:180}),true,'Heal de PG');
  current=1500;character.resources.sp=15;
  assert.equal(UI.render(character,{x:140,y:170}),true,'PS perdido');
  current=1600;character.resources.pe=9;
  assert.equal(UI.render(character,{x:143,y:165}),true,'PE recuperada');
  current=4399;
  assert.equal(UI.render(character,{x:150,y:150}),true,'permanece visible antes de 2.8 s');
  current=4400;
  assert.equal(UI.render(character,{x:155,y:145}),false,'expira después del último cambio');
  character.id='otro-actor';character.resources.pg=1;
  assert.equal(UI.render(character,{x:155,y:145}),false,'cambiar personaje no crea daño ficticio');
  UI.select('otro-actor');
  assert.equal(UI.render(character,{x:190,y:130}),true,'la selección manual permanece activa');
  current=8000;
  assert.equal(UI.render(character,{x:195,y:128}),true,'la selección no caduca');
  assert.equal(renders.at(-1).x,195);
  assert.ok(hidden>0);
 }finally{
  Date.now=oldNow;UI.select(null);UI.render(null,null);
  if(old===undefined)delete globalThis.FHNameplateHUD;
  else globalThis.FHNameplateHUD=old;
 }
});

test('tap proyectado solo consume la unidad y respeta la selección al tocar fuera',()=>{
 const canvas={addEventListener(){},removeEventListener(){}};
 UI.select(null);
 UI.bind(canvas,()=>({id:'actor',x:100,y:40,bodyX:100,bodyY:125}));
 assert.equal(UI.tap({button:0,clientX:250,clientY:230}),false);
 assert.equal(UI.selected(),null);
 assert.equal(UI.targetAt({button:0,clientX:100,clientY:90}).id,'actor');
 assert.equal(UI.tap({button:0,clientX:100,clientY:90}),true);
 assert.equal(UI.selected(),'actor');
 assert.equal(UI.tap({button:0,clientX:250,clientY:230}),false);
 assert.equal(UI.selected(),'actor');
 assert.equal(UI.tap({button:0,clientX:100,clientY:90}),true);
 assert.equal(UI.selected(),null);
 assert.equal(UI.targetAt({button:2,clientX:100,clientY:90}),null);
});
test('cerrar manualmente una alerta no la reabre hasta otro cambio real',()=>{
 const old=globalThis.FHNameplateHUD,originalNow=Date.now,canvas={addEventListener(){},removeEventListener(){}};
 try{
  let time=1000;
  Date.now=()=>time;
  globalThis.FHNameplateHUD={update:()=>true,hide:()=>{},mount:()=>true};
  UI.select(null);UI.render(null,null);
  const character={id:'actor-alert',resources:{pg:20,pgMax:30,sp:10,spMax:10,pe:4,peMax:4}};
  UI.bind(canvas,()=>({id:character.id,x:100,y:40,bodyX:100,bodyY:125}));
  assert.equal(UI.render(character,{x:100,y:40}),false);
  character.resources.pg=18;
  assert.equal(UI.render(character,{x:100,y:40}),true);
  assert.equal(UI.tap({button:0,clientX:100,clientY:90}),true);
  assert.equal(UI.render(character,{x:100,y:40}),false);
  time+=50;character.resources.pg=19;
  assert.equal(UI.render(character,{x:100,y:40}),true);
 }finally{
  Date.now=originalNow;UI.select(null);UI.render(null,null);
  if(old===undefined)delete globalThis.FHNameplateHUD;
  else globalThis.FHNameplateHUD=old;
 }
});
