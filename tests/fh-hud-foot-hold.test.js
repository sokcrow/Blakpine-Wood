'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const ui = require('../juego/assets/fh-mood-fear-ui.js');
require('../juego/assets/fh-safe-lock.js');
const lock = globalThis.FHSafeLock;

function fakeClock(){
 let time=0,next=0;
 const tasks=new Map();
 const clock={
  now:()=>time,
  setTimeout:(fn,ms)=>{const id=++next;tasks.set(id,{fn,when:time+ms});return id;},
  clearTimeout:(id)=>tasks.delete(id)
 };
 return {clock,advance(ms){
  const end=time+ms;
  while(true){
   const due=Array.from(tasks.entries()).filter(([,t])=>t.when<=end)
    .sort((a,b)=>a[1].when-b[1].when||a[0]-b[0])[0];
   if(!due)break;
   time=due[1].when;tasks.delete(due[0]);due[1].fn();
  }
  time=end;
 }};
}
function target(){
 const listeners=new Map();
 return {
  listeners,
  addEventListener(name,fn){
   if(!listeners.has(name))listeners.set(name,[]);
   listeners.get(name).push(fn);
  },
  fire(name,changes={}){
   const event={button:0,pointerId:1,clientX:100,clientY:200,detail:1,
    preventDefault(){},stopImmediatePropagation(){},...changes};
   for(const fn of listeners.get(name)||[])fn(event);
   return event;
  }
 };
}
function setup(){
 const canvas=target(),time=fakeClock(),counts={tap:0,hold:0};
 ui.select(null);
 ui.bind(canvas,()=>({id:'player',x:100,y:100,bodyX:100,bodyY:200}));
 // El adaptador del motor ofrece los toques al escenario y reserva hold en pies para HUD.
 lock.bind(canvas,{
  onTap(){counts.tap++;},
  onHold:event=>{if(!ui.tap(event))counts.hold++;}
 },{threshold:400,tolerance:12,clock:time.clock,suppressClick:true});
 return {canvas,time,counts};
}

test('el hitbox sólo existe alrededor de los pies, no cubre cabeza ni torso',()=>{
 const canvas=target();
 ui.bind(canvas,()=>({id:'player',x:100,y:100,bodyX:100,bodyY:200}));
 assert.equal(ui.targetAt({clientX:100,clientY:100}),null);
 assert.equal(ui.targetAt({clientX:100,clientY:150}),null);
 assert.equal(ui.targetAt({clientX:118,clientY:200})?.id,'player');
 assert.equal(ui.targetAt({clientX:119,clientY:200}),null);
 assert.equal(ui.targetAt({clientX:100,clientY:200,button:2}),null);
 ui.bind(canvas,()=>({id:'player',x:100,y:100}));
 assert.equal(ui.targetAt({clientX:100,clientY:200}),null,'sin pies proyectados no usar fallback al cuerpo');
});

test('un clic ordinario en los pies nunca cambia el HUD y llega al escenario',()=>{
 const {canvas,time,counts}=setup();
 canvas.fire('pointerdown');time.advance(399);canvas.fire('pointerup');
 assert.equal(ui.selected(),null);
 assert.equal(counts.tap,1);
 canvas.fire('click');
 assert.equal(ui.selected(),null);
});

test('400 ms sobre los pies abren la placa y otros 400 ms la cierran',()=>{
 const {canvas,time,counts}=setup();
 canvas.fire('pointerdown');time.advance(399);
 assert.equal(ui.selected(),null);
 time.advance(1);
 assert.equal(ui.selected(),'player');
 canvas.fire('pointerup');time.advance(1000);
 assert.equal(ui.selected(),'player');
 assert.equal(counts.tap,0);
 canvas.fire('pointerdown');time.advance(400);canvas.fire('pointerup');
 assert.equal(ui.selected(),null);
 assert.equal(counts.hold,0);
});

test('gestos sobre torso o escenario siguen su ruta contextual',()=>{
 const {canvas,time,counts}=setup();
 canvas.fire('pointerdown',{clientY:150});time.advance(100);canvas.fire('pointerup',{clientY:150});
 assert.equal(counts.tap,1);
 canvas.fire('pointerdown',{clientY:150});time.advance(400);canvas.fire('pointerup',{clientY:150});
 assert.equal(counts.hold,1);
 assert.equal(ui.selected(),null);
});

test('arrastre o cancelación antes de 400 ms no activa el HUD',()=>{
 const {canvas,time,counts}=setup();
 canvas.fire('pointerdown');time.advance(250);
 canvas.fire('pointermove',{clientX:125});time.advance(300);
 canvas.fire('pointerup',{clientX:125});
 assert.equal(ui.selected(),null);
 canvas.fire('pointerdown');time.advance(100);
 canvas.fire('pointercancel');time.advance(500);
 assert.equal(ui.selected(),null);
 assert.equal(counts.hold,0);
});

test('el módulo HUD ya no registra un click capturador independiente',()=>{
 const canvas=target();
 ui.bind(canvas,()=>({id:'player',x:100,y:100,bodyX:100,bodyY:200}));
 assert.equal(canvas.listeners.get('click'),undefined);
});

test('el adaptador enruta tap al contexto y hold al HUD; el motor pide 400 ms',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../juego/assets/fh-context-engine-hook.js'),'utf8');
 assert.match(source,/onTap:event=>fhRequestContext\('tap','canvas',event\)/);
 assert.match(source,/if\(fhPlayerHold\(event\)\)return/);
 assert.match(source,/\{threshold:400,suppressClick:true\}/);
 assert.doesNotMatch(source,/onTap:event=>\{\s*if\(window\.FHMoodFearUI\?\.tap/);
});
