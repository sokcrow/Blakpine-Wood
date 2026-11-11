'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Core=require('./fh-repair-minigames-core.js');
const Services=require('./fh-services-core.js');

test('cinco tipos de mini juego y ningún diálogo para objetos intactos',()=>{
 const types={breaker_panel:'breaker',generator:'generator',generator_ats:'ats',
  power_outlet:'wires',light_switch:'wires',router:'electronics'};
 for(const [type,expected] of Object.entries(types))
  assert.equal(Core.kindFor({type}),expected);
 assert.equal(Core.kindFor({type:'door'}),null);
 assert.equal(Core.damageFor({state:{damage:{p:35}}},{id:'p'}),35);
 assert.equal(Core.damageFor({state:{damage:{p:0}}},{id:'p'}),0);
 assert.equal(Core.damageFor({state:{damage:{p:NaN}}},{id:'p'}),0);
});
test('breaker: un error reinicia secuencia; completarla no muta la partida',()=>{
 const service={state:{damage:{panel:100}}},original=JSON.stringify(service);
 const session=Core.createSession('breaker');
 assert.equal(session.act({type:'press',index:0}).progress,0);
 for(const index of [2,0,3,1])session.act({type:'press',index});
 assert.equal(session.view().completed,true);
 assert.equal(session.act({type:'press',index:0}).changed,false);
 assert.equal(JSON.stringify(service),original);
});
test('ATS: secuencia de transferencia independiente de la reparación',()=>{
 const session=Core.createSession('ats');
 for(const index of [1,3,0,2])session.act({type:'press',index});
 assert.equal(session.view().completed,true);
});
test('generador: tres reguladores calibrados sin tiradas de habilidad',()=>{
 const session=Core.createSession('generator');
 for(const [index,ticks] of [[0,2],[1,4],[2,1]])
  for(let j=0;j<ticks;j++)session.act({type:'dial',index,delta:1});
 assert.deepEqual(session.view().values,[2,4,1]);
 assert.equal(session.view().completed,true);
 assert.equal(session.act({type:'dial',index:1,delta:1}).changed,false);
});
test('electrónica: cuatro orientaciones deben coincidir',()=>{
 const session=Core.createSession('electronics');
 for(const [index,ticks] of [[0,1],[1,3],[2,2],[3,1]])
  for(let j=0;j<ticks;j++)session.act({type:'rotate',index});
 assert.equal(session.view().completed,true);
});
test('cables: emparejamientos incorrectos no avanzan',()=>{
 const session=Core.createSession('wires');
 session.act({type:'left',index:0});
 let result=session.act({type:'right',index:0});
 assert.equal(result.correct,false);
 assert.equal(result.paired.length,0);
 for(const [left,right] of [[0,1],[1,3],[2,0],[3,2]]){
  session.act({type:'left',index:left});
  result=session.act({type:'right',index:right});
  assert.equal(result.correct,true);
 }
 assert.equal(session.view().completed,true);
 assert.equal(session.view().paired.length,4);
});
test('servicios: reparar daño registrado reactiva equipo, no electricidad externa',()=>{
 const panel={id:'panel',type:'breaker_panel',zoneId:'a',x:0,y:0,circuits:[{id:'a',zoneId:'a'}]};
 const gen={id:'gen',type:'generator',enabled:true,autonomyHours:4,targets:[]};
 const other={id:'puerta',type:'door'};
 const project={floors:[{id:'f0',items:[panel,gen,other]}],units:{feetPerCell:5}};
 const state={flags:{power_global:false},services:{damage:{panel:100,gen:100,puerta:100}}};
 const runtime=Services.createRuntime(project,state);
 assert.equal(runtime.panelStatus(0,panel).powered,false);
 assert.equal(runtime.repairDamage(0,'panel').ok,true);
 assert.equal(runtime.repairDamage(0,'gen').ok,true);
 assert.equal(state.services.damage.panel,0);
 assert.equal(state.services.damage.gen,0);
 assert.equal(runtime.panelStatus(0,panel).powered,false,'red exterior interrumpida');
 assert.equal(runtime.repairDamage(0,'panel').ok,false,'no reparar dos veces');
 assert.equal(runtime.repairDamage(0,'puerta').ok,false,'no tocar PG de puertas');
 assert.equal(state.services.damage.puerta,100);
 assert.equal(runtime.repairDamage(3,'gen').ok,false);
});
class FakeNode{
 constructor(tag,document){this.tag=tag;this.doc=document;this.children=[];this.dataset={};
  this.style={};this.listeners={};this.disabled=false;this.hidden=false;this.className='';this.textContent='';}
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=items;}
 addEventListener(name,fn){this.listeners[name]=fn;}
 setAttribute(name,value){this[name]=value;}
 focus(){this.doc.activeElement=this;}
 querySelectorAll(selector){
  const all=this.children.flatMap(x=>[x,...x.querySelectorAll('*')]);
  if(selector==='*')return all;
  if(selector==='button:not(:disabled)')return all.filter(x=>x.tag==='button'&&!x.disabled);
  if(selector==='[data-repair-key]')return all.filter(x=>x.dataset.repairKey);
  return [];
 }
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 click(){this.listeners.click?.({stopPropagation(){}});}
}
function ui(){
 const doc={activeElement:null,createElement(tag){return new FakeNode(tag,doc)}};
 doc.body=new FakeNode('body',doc);
 const win={document:doc,listeners:{},addEventListener(name,fn){this.listeners[name]=fn},
  removeEventListener(name){delete this.listeners[name]},FHRepairMiniCore:Core};
 const strings=fs.readFileSync(path.join(__dirname,'fh-repair-minigames-strings.js'),'utf8');
 const hud=fs.readFileSync(path.join(__dirname,'fh-repair-minigames.js'),'utf8');
 vm.runInNewContext(strings+'\n'+hud,{window:win,globalThis:win,console});
 return {win,doc};
}
test('HUD: cancelar no guarda ni restaura daño; completar sí y sólo una vez',()=>{
 const {win,doc}=ui(),item={id:'panel',type:'breaker_panel',zoneId:'a',x:0,y:0};
 const state={services:{damage:{panel:100}}};
 const service=Services.createRuntime({floors:[{id:'f',items:[item]}]},state);
 let saves=0;
 const opts={item,floor:0,service,onRepaired:()=>{saves++;}};
 assert.equal(win.FHRepairMiniGames.open(opts),true);
 assert.equal(win.FHRepairMiniGames.isOpen(),true);
 assert.equal(win.FHRepairMiniGames.close(),true);
 assert.equal(state.services.damage.panel,100);
 assert.equal(saves,0);
 assert.equal(win.FHRepairMiniGames.open(opts),true);
 const click=key=>{
  const overlay=doc.body.children.find(x=>x.id==='fhRepairMini');
  const btn=overlay.querySelectorAll('[data-repair-key]').find(x=>x.dataset.repairKey===key);
  assert.ok(btn,'Botón '+key+' existe');btn.click();
 };
 for(const index of [2,0,3,1])click('sequence-'+index);
 assert.equal(state.services.damage.panel,0);
 assert.equal(saves,1);
 click('close');
 assert.equal(win.FHRepairMiniGames.isOpen(),false);
 assert.equal(win.FHRepairMiniGames.open(opts),false,'no abrir reparación sin daños');
});
test('el puente incorpora los archivos del HUD y muestra Reparar cuando hay daños',()=>{
 const source=fs.readFileSync(path.join(__dirname,'fh-services-engine-hook.js'),'utf8');
 for(const file of ['fh-repair-minigames-core.js','fh-repair-minigames-strings.js',
  'fh-repair-minigames.css','fh-repair-minigames.js'])assert.ok(source.includes(file));
 assert.match(source,/window\.FHRepairMiniGames\.open/);
 assert.match(source,/id:"repair"/);
 assert.doesNotMatch(source,/FHSkills\.(?:roll|odds)/);
});
