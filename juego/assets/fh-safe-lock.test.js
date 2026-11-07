/* Regresiones del Safe Lock: puntero, Hold y supresión del doble disparo. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function mount(){
 let t=0,next=0;
 const jobs=new Map(),events={},windowEvents={};
 const clock={now:()=>t,setTimeout:(f,d)=>{const id=++next;jobs.set(id,{f,at:t+d});return id;},clearTimeout:id=>jobs.delete(id)};
 const element={events,addEventListener:(type,fn)=>{(events[type]||=[]).push(fn);},setPointerCapture:()=>{}};
 const win={addEventListener:(type,fn)=>{(windowEvents[type]||=[]).push(fn);},performance:{now:()=>t},setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'fh-safe-lock.js'),'utf8'),{window:win});
 const fire=(type,opts={})=>{const e={pointerId:1,button:0,clientX:20,clientY:30,...opts};for(const fn of events[type]||[])fn(e);};
 const tick=d=>{t+=d;const due=[...jobs].filter(([,v])=>v.at<=t);for(const [id,j] of due){jobs.delete(id);j.f();}};
 return {win,element,fire,tick,clock,blur:()=>windowEvents.blur?.forEach(fn=>fn())};
}
test('toque corto: una sola acción, sin abrir el radial',()=>{
 const {win,element,fire,tick}=mount();const calls=[];
 win.FHSafeLock.bind(element,{onTap:()=>calls.push('tap'),onHold:()=>calls.push('hold')});
 fire('pointerdown');tick(90);fire('pointerup');tick(500);
 assert.deepEqual(calls,['tap']);
});
test('Hold 350 ms: abre una vez y la liberación no ejecuta toque',()=>{
 const {win,element,fire,tick}=mount();const calls=[];
 win.FHSafeLock.bind(element,{onTap:()=>calls.push('tap'),onHold:()=>calls.push('hold')});
 fire('pointerdown');tick(349);assert.deepEqual(calls,[]);tick(1);
 assert.deepEqual(calls,['hold']);fire('pointerup');assert.deepEqual(calls,['hold']);
});
test('si el temporizador se retrasa, el Hold se determina por duración real',()=>{
 const {win,element,fire,clock}=mount();const calls=[];
 win.FHSafeLock.bind(element,{onTap:()=>calls.push('tap'),onHold:()=>calls.push('hold')},{clock});
 fire('pointerdown');const rawNow=clock.now;clock.now=()=>rawNow()+360;fire('pointerup');
 assert.deepEqual(calls,['hold']);
});
test('arrastre y cancelación no activan gestos; el siguiente toque sigue funcionando',()=>{
 const {win,element,fire,tick}=mount();const calls=[];
 win.FHSafeLock.bind(element,{onTap:()=>calls.push('tap'),onHold:()=>calls.push('hold')});
 fire('pointerdown');fire('pointermove',{clientX:45});tick(500);fire('pointerup',{clientX:45});
 fire('pointerdown');fire('pointercancel');tick(500);
 fire('pointerdown');tick(10);fire('pointerup');
 assert.deepEqual(calls,['tap']);
});
test('un segundo dedo cancela el gesto; ni el pinch ni la liberación actúan',()=>{
 const {win,element,fire,tick}=mount();const calls=[];
 win.FHSafeLock.bind(element,{onTap:()=>calls.push('tap'),onHold:()=>calls.push('hold')});
 fire('pointerdown');fire('pointerdown',{pointerId:2});tick(400);
 fire('pointerup',{pointerId:1});fire('pointerup',{pointerId:2});
 assert.deepEqual(calls,[]);
 fire('pointerdown');fire('pointerup');assert.deepEqual(calls,['tap']);
});
test('segundo botón de ratón y pérdida de foco no hacen acciones',()=>{
 const {win,element,fire,blur,tick}=mount();const calls=[];
 win.FHSafeLock.bind(element,{onTap:()=>calls.push('tap'),onHold:()=>calls.push('hold')});
 fire('pointerdown',{button:2});fire('pointerup',{button:2});
 fire('pointerdown');blur();tick(500);fire('pointerup');
 assert.deepEqual(calls,[]);
});
test('el comportamiento es igual al conectar el control Usar o el canvas',()=>{
 for(const name of ['use','canvas']){
  const {win,element,fire,tick}=mount();const calls=[];
  win.FHSafeLock.bind(element,{onTap:()=>calls.push(name+':primary'),onHold:()=>calls.push(name+':radial')});
  fire('pointerdown');tick(5);fire('pointerup');
  fire('pointerdown');tick(350);fire('pointerup');
  assert.deepEqual(calls,[name+':primary',name+':radial']);
 }
});

test('click sintético tras toque o Hold no ejecuta también el listener legacy',()=>{
 const {win,element,fire,tick}=mount();const calls=[];
 win.FHSafeLock.bind(element,{onTap:()=>calls.push('primary'),onHold:()=>calls.push('radial')},{suppressClick:true});
 element.addEventListener('click',()=>calls.push('legacy'));
 const click=(detail,pointerType)=>{const event={
  detail,pointerType,stopped:false,preventDefault(){this.defaultPrevented=true;},
  stopImmediatePropagation(){this.stopped=true;}
 };
 for(const handler of element.events.click||[]){if(event.stopped)break;handler(event)}
 return event;
 };
 fire('pointerdown');tick(20);fire('pointerup');
 assert.equal(click(1,'mouse').defaultPrevented,true);
 assert.deepEqual(calls,['primary']);
 fire('pointerdown');tick(350);fire('pointerup');
 assert.equal(click(1,'touch').stopped,true);
 assert.deepEqual(calls,['primary','radial']);
 // Clic genuino de teclado y fallback de navegador legacy.
 assert.equal(click(0,'').stopped,false);
 tick(800);
 assert.equal(click(1,'mouse').stopped,false);
 assert.deepEqual(calls,['primary','radial','legacy','legacy']);
});
