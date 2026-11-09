/* node --test juego/assets/fh-survival-core.test.js */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const S=require('./fh-survival-core.js');
function make(pg=20,sp=20,pe=10){
 const game={character:{life:'alive',resources:{pg,pgMax:20,sp,spMax:20,pe,peMax:18}},clock:{minutes:0}};
 return {game,life:S.createRuntime(game)};
}
test('recuperación nocturna: 10% floor, solo tras 6 horas y una vez por día',()=>{
 const {game,life}=make(10);
 game.character.resources.pgMax=28;
 assert.equal(S.recoveryPG(game.character.resources),2);
 life.update(0,{mode:'sleeping'});
 life.update(359,{mode:'sleeping'});
 assert.equal(game.character.resources.pg,10);
 life.update(360,{mode:'sleeping'});
 assert.equal(game.character.resources.pg,12);
 life.update(370,{mode:'awake'});
 life.update(380,{mode:'sleeping'});
 life.update(740,{mode:'sleeping'});
 assert.equal(game.character.resources.pg,12,'una sola cura por día');
 life.update(750,{mode:'awake'});
 life.update(1500,{mode:'sleeping'});
 life.update(1860,{mode:'sleeping'});
 assert.equal(game.character.resources.pg,14);
});
test('enfermedad: el máximo baja los PG actuales; restaurarlo no sana',()=>{
 const {game,life}=make(20);
 life.setPGMax(15);
 assert.equal(game.character.resources.pg,15);
 life.setPGMax(20);
 assert.equal(game.character.resources.pg,15);
});
test('dormir +3 SP/h +1 PE/30m y despertar sin 6h aplica 30% del máximo',()=>{
 const {game,life}=make(20,4,0);
 life.update(0,{mode:'sleeping'});
 life.update(120,{mode:'sleeping'});
 assert.equal(game.character.resources.sp,10);
 assert.equal(game.character.resources.pe,4);
 life.update(120,{mode:'awake'});
 assert.equal(game.character.resources.sp,4,'30% de 20 son 6');
 assert.equal(life.state.fatigue.initialApplied,true);
 life.update(180,{mode:'awake'});
 assert.equal(game.character.resources.sp,1);
 life.update(240,{mode:'awake'});
 assert.equal(game.character.resources.sp,0);
});
test('sentado +1 PE/h y relajación +1 SP/h; oscuridad −2 SP/h',()=>{
 const {game,life}=make(20,10,4);
 life.update(0,{mode:'sitting'});
 life.update(60,{mode:'sitting',relaxing:true});
 assert.equal(game.character.resources.pe,5);
 assert.equal(game.character.resources.sp,11);
 life.update(60,{mode:'awake'});
 life.update(120,{mode:'awake',stressed:true});
 assert.equal(game.character.resources.sp,9);
 life.update(180,{mode:'awake',stressed:false,relaxing:true});
 assert.equal(game.character.resources.sp,10);
});
test('falta de sueño se pausa; al despertar reinicia tres horas sin repetir 30%',()=>{
 const {game,life}=make(20,20,0);
 life.update(0,{mode:'sleeping'});
 life.update(60,{mode:'sleeping'});
 life.update(60,{mode:'awake'});
 assert.equal(game.character.resources.sp,14);
 life.update(120,{mode:'awake'});
 assert.equal(game.character.resources.sp,11);
 life.update(121,{mode:'sleeping'});
 life.update(151,{mode:'sleeping'});
 life.update(151,{mode:'awake'});
 assert.equal(game.character.resources.sp,11,'sin repetir 30%');
 life.update(211,{mode:'awake'});
 assert.equal(game.character.resources.sp,8,'contador reiniciado');
 life.update(211,{mode:'sleeping'});
 life.update(571,{mode:'sleeping'});
 assert.equal(life.state.fatigue.active,false,'6h continuas curan el estado');
 life.update(571,{mode:'awake'});
 life.update(751,{mode:'awake'});
 assert.equal(game.character.resources.sp,20,'sin drenaje tras curarse');
});
test('penalización SP por tramos completos y puntos porcentuales',()=>{
 const r={spMax:20,sp:20};
 for(const [sp,penalty] of [[20,0],[16,5],[12,10],[8,15],[4,20],[0,25]]) {
  r.sp=sp;assert.equal(S.penaltySP(r),penalty);
 }
});
test('salvación de muerte: cualquier cara suma un único éxito, tres éxitos Stable',()=>{
 const {game,life}=make(1);
 life.damagePG(1);
 assert.equal(life.state.critical.status,'critical');
 let roll=life.deathSave(3,(()=>{const a=[.9,.1,.9];let i=0;return ()=>a[i++];})());
 assert.equal(roll.success,true);
 assert.equal(roll.successes,1);
 roll=life.deathSave(1,()=>.1);
 roll=life.deathSave(1,()=>.1);
 assert.equal(roll.status,'stable');
 assert.equal(game.character.life,'alive');
 assert.equal(life.awakeFromStable(),false,'sin PG no despierta');
});
test('tres fallos muerte permanente y no se siguen tirando monedas',()=>{
 const {game,life}=make(1);
 let deaths=0;
 const g={character:game.character,clock:game.clock};
 const a=S.createRuntime(g,{onDeath:()=>deaths++});
 a.damagePG(1);
 for(let i=0;i<3;i++)a.deathSave(2,()=>.9);
 assert.equal(g.character.life,'dead');
 assert.equal(a.state.critical.status,'dead');
 assert.equal(deaths,1);
 assert.equal(a.deathSave(2).ok,false);
});
test('persistencia de faltas de sueño al recuperar la partida',()=>{
 const {game,life}=make(20,20,5);
 life.update(0,{mode:'sleeping'});
 life.update(60,{mode:'sleeping'});
 life.update(60,{mode:'awake'});
 life.update(90,{mode:'awake'});
 const loaded=JSON.parse(JSON.stringify(game));
 const resumed=S.createRuntime(loaded);
 resumed.update(120,{mode:'awake'});
 assert.equal(loaded.character.resources.sp,11,'no duplica la pérdida inicial');
 assert.equal(loaded.survival.fatigue.initialApplied,true);
});

test('acumulación por minutos del mundo: estrés sentado y relajación en ticks breves',()=>{
 const {game,life}=make(20,15,0);
 for(let minute=0;minute<=60;minute++)life.update(minute,{mode:'sitting',stressed:true});
 assert.equal(game.character.resources.sp,13);
 assert.equal(game.character.resources.pe,1);
 for(let minute=61;minute<=120;minute++)life.update(minute,{mode:'sitting',relaxing:true});
 assert.equal(game.character.resources.sp,14);
 assert.equal(game.character.resources.pe,2);
});

test('gasto de PE: sin energía rechaza la tarea y nunca queda negativo',()=>{
 const {game,life}=make(20,20,2);
 assert.equal(life.spendPE(1),true);
 assert.equal(life.spendPE(2),false);
 assert.equal(game.character.resources.pe,1);
 assert.equal(life.spendPE(1),true);
 assert.equal(game.character.resources.pe,0);
 assert.equal(life.canSpendPE(1),false);
 assert.equal(life.spendPE(1),false);
 assert.equal(game.character.resources.pe,0);
});
