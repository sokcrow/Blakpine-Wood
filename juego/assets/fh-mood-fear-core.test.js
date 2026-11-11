/* node --test juego/assets/fh-mood-fear-core.test.js */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('./fh-mood-fear-core.js');
const character=(vol=3)=>({id:'a',scores:{VOL:vol},resources:{pg:30,pgMax:30,sp:100,spMax:100,pe:8,peMax:8}});
test('Niveles y costes',()=>{
 assert.deepEqual(M.LEVELS,['relajado','calmado','nervioso','atemorizado','sin_esperanza','abrumado']);
 assert.deepEqual(M.PERCENT,[0,0,10,30,60,100]);
 assert.deepEqual([0,12,25,45,70,95].map(x=>M.rank(x)),[0,1,2,3,4,5]);
});
test('Mood no descuenta PS',()=>{
 const c=character(),f=M.createRuntime(c);assert.equal(f.setMood('malo'),true);
 assert.equal(f.read().mood,'malo');assert.equal(c.resources.sp,100);
 assert.equal(f.setMood('inventado'),false);
});
test('El evento Paranormal causa exactamente 30% al subir a Atemorizado',()=>{
 const c=character(),f=M.createRuntime(c),p=f.stimulus('paranormal',{minute:1,intensity:40});
 assert.equal(p.key,'atemorizado');assert.equal(p.damage,30);assert.equal(c.resources.sp,70);
 f.tick(1,{});f.tick(2,{});assert.equal(c.resources.sp,70);
});
test('Los escalones de PS son diferenciales',()=>{
 const c=character(),f=M.createRuntime(c);
 assert.equal(f.stimulus('creature',{intensity:18,minute:1}).damage,10);
 assert.equal(f.stimulus('creature',{intensity:20,minute:2}).damage,20);
 assert.equal(c.resources.sp,70);
});
test('Eldritch puede sobrepasar la Voluntad',()=>{
 const c=character(6),events=[],f=M.createRuntime(c,{onOverwhelmed:x=>events.push(x)});
 const p=f.stimulus('eldritch',{minute:1,ignoreVoluntad:true});
 assert.equal(p.key,'abrumado');assert.equal(c.resources.sp,0);assert.equal(events.length,1);
});
test('VOL alta reduce la reacción',()=>{
 const a=M.createRuntime(character(1)),b=M.createRuntime(character(6));
 a.stimulus('corpse',{minute:1});b.stimulus('corpse',{minute:1});
 assert.ok(a.state.stress>b.state.stress);
});
test('Evita repetir el mismo estímulo durante cooldown',()=>{
 const c=character(),f=M.createRuntime(c);
 f.stimulus('creature',{minute:10,sourceId:'enemy-1'});
 const prev=f.state.stress;
 assert.equal(f.stimulus('creature',{minute:11,sourceId:'enemy-1'}),null);
 assert.equal(f.state.stress,prev);
});
test('Oscuridad acumula y seguridad recupera con temporizador',()=>{
 const f=M.createRuntime(character(),{}, {holdMinutes:2,recoveryPerMinute:6,darknessPerMinute:8});
 f.tick(1,{darkness:true});f.tick(3,{darkness:true});const before=f.state.stress;
 f.tick(6,{darkness:false});assert.ok(f.state.stress<before);
});
test('Estado mental se conserva en el personaje',()=>{
 const c=character();let f=M.createRuntime(c);f.setMood('bueno');f.stimulus('creature',{minute:1});
 const before=f.state.stress;f=M.createRuntime(c);
 assert.equal(f.read().mood,'bueno');assert.equal(f.read().stress,before);
});
