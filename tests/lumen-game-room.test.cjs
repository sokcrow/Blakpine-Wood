const {test}=require('node:test'),assert=require('node:assert/strict');
class Element{
 children=[];isConnected=true;hidden=false;disabled=false;events={};classes=new Set();
 classList={add:n=>this.classes.add(n),remove:n=>this.classes.delete(n)};
 setAttribute(){}replaceChildren(...nodes){this.children=nodes;}remove(){this.isConnected=false;}
}
const tick=()=>new Promise(r=>setImmediate(r));
async function mount({deferEntry=false}={}){
 const nodes=[],events={};let plays=0,stops=0,loads=0,invalid,finish,resolveEntry;
 const project={schema:'forest-horror-map-v1',floors:[{future:'complete'}]};
 const bridge={validate(){},play(p,done){assert.deepEqual(p,project);plays++;finish=done;},stop(){stops++;finish?.();}};
 global.window={addEventListener:(t,f)=>events[t]=f,removeEventListener:t=>delete events[t]};
 global.document={createElement:tag=>{const n=new Element();n.tag=tag;nodes.push(n);
  if(tag==='iframe'){n.contentWindow={LumenEditor:bridge};Object.defineProperty(n,'src',{set(){queueMicrotask(()=>n.onload?.());}});}
  return n;}};
 const loaded={payload:{project,mapName:'Mundo',revision:3},context:{uid:'guest'},session:{releaseId:'one'}};
 const store={load:async()=>{loads++;if(deferEntry&&loads===2)return new Promise(r=>resolveEntry=()=>r(loaded));return loaded;},
  watch:(_cid,_context,_session,fn)=>{invalid=fn;return ()=>stops++;}};
 const {mountGameRoom}=await import('../portal/game-room.js'),element=new Element();let current=true;
 const dispose=await mountGameRoom({element,store,campaignId:'a'.repeat(20),isCurrent:()=>current});
 await tick();await tick();
 return {element,dispose,enter:nodes.find(n=>n.tag==='button'),frame:nodes.find(n=>n.tag==='iframe'),events,
  plays:()=>plays,loads:()=>loads,close:()=>finish(),invalidate:()=>invalid(),resolve:()=>resolveEntry(),changeAccount:()=>current=false};
}
test('Entrada de sala carga mapa antes del motor y permite salir sin mostrar el editor',async()=>{
 const m=await mount();assert.equal(m.enter.disabled,false);assert.equal(m.frame.hidden,true);assert.equal(m.plays(),0);
 await m.enter.onclick();assert.equal(m.loads(),2);assert.equal(m.plays(),1);
 assert.equal(m.frame.hidden,false);assert.ok(m.element.classes.has('lumen-playing'));
 m.close();assert.equal(m.frame.hidden,true);assert.equal(m.enter.disabled,false);
 m.dispose();assert.equal(m.frame.isConnected,false);assert.equal(Object.keys(m.events).length,0);
});
test('Expulsión durante una entrada lenta cierra y evita arrancar al terminar la descarga',async()=>{
 const m=await mount({deferEntry:true}),entry=m.enter.onclick();await tick();
 m.invalidate();m.resolve();await entry;
 assert.equal(m.plays(),0);assert.equal(m.enter.disabled,true);assert.equal(m.frame.hidden,true);
 m.dispose();
});
test('Cambiar de cuenta o navegar durante la descarga nunca abre el motor',async()=>{
 for(const dispose of [false,true]){
  const m=await mount({deferEntry:true}),entry=m.enter.onclick();await tick();
  if(dispose)m.dispose();else m.changeAccount();m.resolve();await entry;
  assert.equal(m.plays(),0);m.dispose();
 }
});
test('Pérdida de red cierra el iframe y bloquea reentrada hasta volver a la sala',async()=>{
 const m=await mount();await m.enter.onclick();m.events.offline();
 assert.equal(m.frame.hidden,true);assert.equal(m.enter.disabled,true);assert.ok(!m.element.classes.has('lumen-playing'));
 m.dispose();
});
