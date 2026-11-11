'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const HUD=require('./fh-nameplate-hud.js');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');

test('PG PS PE se calculan usando recursos reales y máximos',()=>{
 assert.deepEqual(HUD.reading({pg:15,pgMax:30},'pg'),{current:15,maximum:30,percent:50});
 assert.deepEqual(HUD.reading({sp:25,spMax:20},'sp'),{current:20,maximum:20,percent:100});
 assert.deepEqual(HUD.reading({pe:-2,peMax:12},'pe'),{current:0,maximum:12,percent:0});
 assert.equal(HUD.reading({pg:1},'pg'),null);
 assert.equal(HUD.reading({pg:NaN,pgMax:1},'pg'),null);
 assert.equal(HUD.reading({pg:2,pgMax:0},'pg'),null);
});
test('La placa aprobada conserva colores, bordes y animaciones independientes',()=>{
 const js=read('fh-nameplate-hud.js'),css=read('fh-nameplate-hud.css');
 assert.match(js,/#ff373a/,'PG rojo');
 assert.match(js,/#8de4e9/,'PS cyan pastel');
 assert.match(js,/#f2d84b/,'PE amarillo');
 assert.match(js,/damage:'#f4f8f5',heal:'#55e889'/,'daño blanco y Heal verde');
 assert.match(js,/stroke:'#f5f6f4'/,'contorno interior blanco');
 assert.match(js,/fill:'#0f0f12'/,'marco exterior negro');
 assert.match(js,/function advance\(bar,time\)/);
 assert.match(js,/a\.kind==='damage'/);
 assert.match(js,/function setBar\(key,info,instant\)/);
 assert.match(css,/width:min\(336px,calc\(100vw - 16px\)\)/);
 assert.match(css,/body\.fh-sleeping #fhNameplateHUD/);
 assert.doesNotMatch(js,/localStorage|GameState\s*=/);
});
test('No monta automáticamente ni muestra una placa sin personaje seleccionado',()=>{
 const js=read('fh-nameplate-hud.js');
 assert.match(js,/function update\(character = root\.FHCharacterRuntime\?\.character \?\? null, position = null\)/);
 assert.match(js,/if\(!character \|\| !pg \|\| !position/);
 assert.doesNotMatch(js,/if\s*\(root\.document\)\s*start\(/);
 assert.match(js,/function hide\(\)/);
 assert.match(js,/root\.FH_MOOD_FEAR_IMAGES\?\.\[mood\]/);
});

test('PNG de Mood, valores, daño blanco, Heal verde y cambio de personaje',()=>{
 const saved={document:globalThis.document,innerWidth:globalThis.innerWidth,
  FH_MOOD_FEAR_IMAGES:globalThis.FH_MOOD_FEAR_IMAGES,
  FH_MOOD_FEAR_TEXT:globalThis.FH_MOOD_FEAR_TEXT,
  requestAnimationFrame:globalThis.requestAnimationFrame,
  cancelAnimationFrame:globalThis.cancelAnimationFrame,performance:globalThis.performance};
 let tick=0,nextFrame=1;
 const pending=new Map();
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.style={};this.hidden=false;this.isConnected=true;this.offsetWidth=336;this.offsetHeight=124;this.textContent='';}
  append(...nodes){this.children.push(...nodes);}
  setAttribute(k,v){this.attributes[k]=String(v);}
  getAttribute(k){return this.attributes[k]??null;}
  remove(){this.isConnected=false;}
 }
 const body=new Element('body');
 const find=(root,key,value)=>{
  if(root.attributes?.[key]===value)return root;
  for(const child of root.children){const found=find(child,key,value);if(found)return found;}
  return null;
 };
 const frame=(time)=>{
  tick=time;
  const batch=[...pending.values()];pending.clear();
  for(const callback of batch)callback(time);
 };
 try{
  globalThis.document={body,createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),getElementById:()=>null};
  globalThis.innerWidth=844;
  globalThis.FH_MOOD_FEAR_IMAGES={bueno:'data:bueno',neutral:'data:neutral',malo:'data:malo'};
  globalThis.FH_MOOD_FEAR_TEXT={good:'Bueno',neutral:'Neutral',bad:'Malo'};
  globalThis.performance={now:()=>tick};
  globalThis.requestAnimationFrame=(fn)=>{const id=nextFrame++;pending.set(id,fn);return id;};
  globalThis.cancelAnimationFrame=id=>pending.delete(id);
  assert.equal(HUD.mount(),true);
  const host=body.children[0];
  assert.equal(host.id,'fhNameplateHUD');
  assert.equal(host.hidden,true);
  const char={id:'jugador',name:'Dexter',mental:{mood:'neutral'},resources:{pg:100,pgMax:100,sp:60,spMax:80,pe:25,peMax:100}};
  assert.equal(HUD.update(char),false,'sin posición se oculta');
  assert.equal(HUD.update(char,{x:420,y:250}),true);
  assert.equal(host.hidden,false);
  assert.equal(host.style.left,'420px');
  assert.equal(host.style.top,'233px');
  const svg=host.children[0];
  const face=find(svg,'x','93');
  assert.equal(face.tagName,'image');
  assert.equal(face.getAttribute('href'),'data:neutral');
  const hp=find(svg,'data-part','pg-fill'),ps=find(svg,'data-part','sp-fill'),pe=find(svg,'data-part','pe-fill');
  assert.ok(hp.getAttribute('points').includes('1445,88'));
  assert.ok(ps.getAttribute('points').includes('1182.5'));
  assert.ok(pe.getAttribute('points').includes('657.5'));
  char.resources.pg=25;
  HUD.update(char,{x:430,y:260});
  assert.ok(hp.getAttribute('points').includes('657.5'));
  const white=find(svg,'data-part','pg-damage');
  assert.ok(white.getAttribute('points').includes('1445'),'rastro blanco aparece de 25 a 100');
  frame(500);
  assert.notEqual(white.getAttribute('points'),'','el rastro de daño sigue su animación');
  frame(1001);
  assert.equal(white.getAttribute('points'),'','rastro blanco desaparece al llegar a la barra');
  char.resources.pe=95;
  HUD.update(char,{x:440,y:270});
  const heal=find(svg,'data-part','pe-heal');
  frame(1150);
  assert.notEqual(heal.getAttribute('points'),'','rastro Heal verde aparece por delante de la barra amarilla');
  assert.ok(pe.getAttribute('points').includes('657.5'),'la barra amarilla todavía está en 25 al adelantarse el Heal');
  frame(1900);
  assert.equal(heal.getAttribute('points'),'','Heal termina y la barra amarilla lo alcanza');
  char.mental.mood='malo';
  HUD.update(char,{x:450,y:280});
  assert.equal(face.getAttribute('href'),'data:malo');
  assert.match(host.getAttribute('aria-label'),/Humor: Malo/);
  char.id='otro';char.resources.pg=5;
  HUD.update(char,{x:450,y:280});
  assert.equal(find(svg,'data-part','pg-damage').getAttribute('points'),'','no se anima un cambio de personaje como daño');
  assert.equal(HUD.hide(),false);
  assert.equal(host.hidden,true);
  assert.equal(pending.size,0);
 }finally{
  HUD.hide();body.children.forEach(el=>el.isConnected=false);
  for(const [key,value] of Object.entries(saved)){
   if(value===undefined)delete globalThis[key];else globalThis[key]=value;
  }
 }
});
