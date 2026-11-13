/* node --test juego/assets/fh-mood-fear-core.test.js */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
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
 assert.equal(f.stimulus('creature',{intensity:18,minute:1,sourceId:'criatura-a'}).damage,10);
 assert.equal(f.stimulus('creature',{intensity:20,minute:2,sourceId:'criatura-b'}).damage,20);
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

test('La oscuridad suma como máximo 15 puntos, incluso durante horas',()=>{
 const c=character(3),f=M.createRuntime(c);
 f.tick(0,{darkness:true});
 f.tick(240,{darkness:true});
 assert.equal(f.state.darknessStress,15);
 assert.equal(f.state.stress,27);
 assert.equal(f.read().key,'nervioso');
 f.tick(600,{darkness:true});
 assert.equal(f.state.stress,27);
 assert.equal(c.resources.sp,90,'la oscuridad sola no debe vaciar PS');
});
test('El aporte de oscuridad no se reinicia al alternar luces y se libera al recuperar',()=>{
 const c=character(3),f=M.createRuntime(c);
 f.tick(0,{darkness:true});
 f.tick(100,{darkness:true});
 const before=f.state.stress;
 f.tick(101,{darkness:false});
 f.tick(102,{darkness:true});
 assert.equal(f.state.stress,before,'encender y apagar no vuelve a sumar oscuridad');
 f.tick(130,{darkness:false});
 assert.equal(f.state.darknessStress,0);
 f.tick(131,{darkness:true});
 assert.ok(f.state.darknessStress>0,'la exposición vuelve a contar tras recuperarse');
});
test('Las amenazas siguen sumando sin quedar limitadas por el tope de oscuridad',()=>{
 const f=M.createRuntime(character(3));
 f.tick(0,{darkness:true});
 f.tick(120,{darkness:true});
 const before=f.state.stress;
 f.stimulus('creature',{minute:121,intensity:52,sourceId:'sombra-1'});
 assert.equal(f.state.stress,before+52);
 assert.equal(f.read().key,'sin_esperanza');
 f.tick(200,{darkness:true});
 assert.equal(f.state.darknessStress,15);
 assert.equal(f.state.stress,before+52);
});
test('El presupuesto de oscuridad persiste al reconstruir el runtime',()=>{
 const c=character(3);
 let f=M.createRuntime(c);
 f.tick(0,{darkness:true});
 f.tick(120,{darkness:true});
 const before=f.state.stress;
 f=M.createRuntime(c);
 f.tick(180,{darkness:true});
 assert.equal(f.state.stress,before);
 assert.equal(f.state.darknessStress,15);
});
test('El motor no drena PS de supervivencia indefinidamente solo por oscuridad',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 assert.doesNotMatch(html,/stressed:fhDark/);
 assert.match(html,/tick\(fhNow,\{darkness:fhDark,sleeping:fhSleeping\}\)/);
});
test('Cada estado de Fear aplica su color, incluyendo los rojos de peligro',()=>{
 const css=fs.readFileSync(path.join(__dirname,'fh-mood-fear.css'),'utf8');
 const base=css.slice(css.indexOf('#fhSpatialLayer .fh-sound.fh-fear-comic{'),
  css.indexOf('#fhSpatialLayer .fh-fear-comic--relajado'));
 assert.doesNotMatch(base,/--fear\s*:/);
 assert.match(base,/color:var\(--fear,#25d53a\)/);
 assert.match(css,/#fhSpatialLayer \.fh-fear-comic--sin_esperanza\{--fear:#f24238\}/);
 assert.match(css,/#fhSpatialLayer \.fh-fear-comic--abrumado\{--fear:#a50c26\}/);
});
