'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Skills=require('./fh-skills.js');
const Repair=require('./fh-repair.js');
const Runtime=require('./fh-repair-runtime.js');
const Hsrc=fs.readFileSync(path.join(__dirname,'fh-structure-health.js'),'utf8');
function healthApi(services={}){
 const w={...services};vm.runInNewContext(Hsrc,{window:w,structuredClone,console});
 return w.FHStructureHealth;
}
function setup({initialPG=0,material='wood',kitLevel=1,subcategory='estructural',skillId='manipulacionFina',
  config={failureRecoveryPct:20},part='structure',reader=false}={}){
 const Health=healthApi();
 const it={id:'puerta',type:'door',variant:material,initialPG,
  ...(reader?{accessDevice:'pin',readerInitialPG:initialPG}:{})};
 const map={schema:'forest-horror-map-v1',floors:[{id:'piso',items:[it]}]};
 const state={structures:{},repairReceipts:[]},saves=[];
 const root=id=>{
  const parent={children:[],add(node){this.children.push(node);node.parent=this;},
   remove(node){this.children=this.children.filter(x=>x!==node);node.parent=null;}};
  const item={id,parent:null};parent.add(item);return {node:item,parent};
 };
 const leaf=root('leaf'),frame=root('frame'),pad=root('pad');
 const door={f:0,id:it.id,hinge:leaf.node,frame:frame.node,accessVisuals:[pad.node],family:'single',
  angle:0,open:false,passable:false};
 const health=Health.createRuntime({data:map,state,doorList:[[door]],blockers:[[]],
  save:()=>saves.push(JSON.stringify(state))});
 health.registerDoor(door,it);
 const job=Repair.createJob({id:'reparar_puerta',category:'reparacion',subcategory,
  requiredSkillId:subcategory==='electricidad'?null:skillId,
  compatibleKitId:'kit_mecanica',difficulty:6,recoverablePG:kitLevel*5,
  target:{floorId:'piso',itemId:'puerta',part}});
 const kit={id:'kit_mecanica',level:kitLevel};
 const character={skills:{[skillId]:0},scores:{AGI:1,ING:6}};
 const inventory={uses:3,receipts:0};
 const consumeKitUse=({kitId,quantity})=>{
  if(kitId!==kit.id||quantity!==1||inventory.uses<1)return {ok:false,reason:'missing'};
  inventory.uses--;
  return {ok:true,consumedUses:1,receiptId:'rec_'+(++inventory.receipts)};
 };
 const args={job,kit,character,health,state,config,consumeKitUse,saveState:()=>saves.push(JSON.stringify(state))};
 return {Health,it,map,state,health,door,leaf,frame,pad,job,kit,character,config,inventory,saves,args};
}
const attempt=(fixture,rng)=>Runtime.perform({...fixture.args,rng});

test('kits convencionales: 5 PG por nivel sin inventar fórmula de dificultad',()=>{
 for(let level=1;level<8;level++)assert.equal(Runtime.kitPG(level),level*5);
 for(const bad of [0,-1,1.5,NaN,Infinity,'2'])assert.throws(()=>Runtime.kitPG(bad));
});
test('éxito usa FHSkills.roll y recupera PG del kit',()=>{
 const t=setup({initialPG:2,material:'metal',kitLevel:2});
 const pre=Runtime.odds({job:t.job,character:t.character});
 assert.equal(pre.ok,true);
 assert.equal(pre.skill,'manipulacionFina');
 assert.equal(pre.difficulty,6);
 const result=attempt(t,()=>.01);
 assert.equal(result.ok,true);
 assert.equal(result.success,true);
 assert.equal(result.kitPG,10);
 assert.equal(result.recoveredPG,10);
 assert.equal(result.pg,12);
 assert.equal(t.health.getState('piso','puerta').pg,12);
 assert.equal(t.inventory.uses,2);
 assert.equal(t.state.repairReceipts.length,1);
});
test('fallo recupera un porcentaje explícito menor que el éxito y registra el consumo',()=>{
 const t=setup({initialPG:2,material:'metal',config:{failureRecoveryPct:20}});
 const result=attempt(t,()=>.99);
 assert.equal(result.ok,true);
 assert.equal(result.success,false);
 assert.equal(result.recoveredPG,1);
 assert.equal(result.pg,3);
 assert.equal(t.inventory.uses,2);
 assert.equal(result.rebuilt,false);
});
test('sin porcentaje aprobado no se consume kit ni se lanzan monedas',()=>{
 const t=setup({initialPG:3,material:'metal',config:{}});
 let rolls=0;t.args.rng=()=>{rolls++;return .01};
 const result=Runtime.perform(t.args);
 assert.equal(result.ok,false);
 assert.equal(result.reason,'failure-recovery-unconfigured');
 assert.equal(rolls,0);assert.equal(t.inventory.uses,3);
});
test('porcentaje configurado en el propio trabajo se usa sin valor global',()=>{
 const t=setup({initialPG:3,material:'metal',config:{}});
 t.job=Repair.createJob({...t.job,failureRecoveryPct:40});
 t.args.job=t.job;
 const result=attempt(t,()=>.99);
 assert.equal(result.recoveredPG,2);
 assert.equal(result.success,false);
});
test('0 PG: fallo nunca reconstruye aunque haya recuperación parcial',()=>{
 const t=setup({initialPG:0,material:'wood',config:{failureRecoveryPct:99}});
 assert.equal(t.door.destroyed,true);
 assert.equal(t.leaf.node.parent,null);
 const result=attempt(t,()=>.99);
 assert.equal(result.success,false);
 assert.equal(result.recoveredPG,0);
 assert.equal(t.health.getState('piso','puerta').pg,0);
 assert.equal(t.door.destroyed,true);
 assert.equal(t.inventory.uses,2,'el fallo sí consume el uso verificado');
});
test('0 PG: éxito reconstruye puerta y restablece su colisión y representación',()=>{
 const t=setup({initialPG:0});
 const result=attempt(t,()=>.01);
 assert.equal(result.ok,true);assert.equal(result.success,true);
 assert.equal(result.rebuilt,true);
 assert.equal(result.pg,5);
 assert.equal(t.door.destroyed,false);
 assert.equal(t.door.passable,false,'cerrada vuelve a bloquear');
 assert.equal(t.leaf.node.parent,t.leaf.parent);
 assert.equal(t.frame.node.parent,t.frame.parent);
});
test('lector reconstruido sólo tras éxito; la puerta permanece independiente',()=>{
 const t=setup({initialPG:0,material:'metal',part:'reader',reader:true});
 assert.equal(t.door.readerDestroyed,true);
 const r=attempt(t,()=>.01);
 assert.equal(r.rebuilt,true);
 assert.equal(t.door.readerDestroyed,false);
 assert.equal(t.pad.node.parent,t.pad.parent);
 assert.equal(t.health.getState('piso','puerta','reader').pg,5);
 assert.equal(t.health.getState('piso','puerta').pg,0,
  'el PG estructural inicial fue 0 y no se recupera al reparar el lector');
});
test('límites: no se pueden superar PG máximos ni gastar kit estando completo',()=>{
 const t=setup({initialPG:19,material:'metal',kitLevel:1});
 assert.equal(attempt(t,()=>.01).recoveredPG,1);
 assert.equal(t.health.getState('piso','puerta').pg,20);
 const before=t.inventory.uses;
 const again=attempt(t,()=>.01);
 assert.equal(again.reason,'already-full');
 assert.equal(t.inventory.uses,before);
});
test('sin kit compatible, sin inventario o sin confirmación de consumo no hay tirada',()=>{
 const t=setup({initialPG:4,material:'metal'});
 let rolls=0;const rng=()=>{rolls++;return .01};
 assert.equal(Runtime.perform({...t.args,kit:{id:'otro',level:1},rng}).reason,'incompatible-kit');
 assert.equal(Runtime.perform({...t.args,consumeKitUse:undefined,rng}).reason,'inventory-consumption-pending');
 assert.equal(Runtime.perform({...t.args,consumeKitUse:()=>({ok:true}),rng}).reason,'consumption-not-confirmed');
 assert.equal(t.inventory.uses,3);assert.equal(rolls,0);
});
test('capacidad declarada menor al kit bloquea antes de gastar',()=>{
 const t=setup({initialPG:2,material:'metal',kitLevel:2});
 t.args.job=Repair.createJob({...t.job,recoverablePG:5});
 const r=attempt(t,()=>.01);
 assert.equal(r.reason,'insufficient-job-capacity');
 assert.equal(t.inventory.uses,3);
});
test('electrónica utiliza electronica/ING; estructura sólo AGI; electricidad bloqueada',()=>{
 const electronic=setup({initialPG:2,material:'metal',subcategory:'electronica',skillId:'electronica'});
 assert.equal(Runtime.odds({job:electronic.job,character:electronic.character}).skill,'electronica');
 assert.equal(Repair.skillGroup(electronic.job.requiredSkillId),'ING');
 assert.equal(attempt(electronic,()=>.01).ok,true);
 assert.ok(Repair.validateJob({...electronic.job,requiredSkillId:'mecanica'}).length>0);
 const physical=setup({initialPG:1,subcategory:'estructural',skillId:'cerrajeria'});
 assert.equal(Repair.skillGroup(physical.job.requiredSkillId),'AGI');
 assert.equal(Runtime.odds({job:physical.job,character:physical.character}).skill,'cerrajeria');
 assert.ok(Repair.validateJob({...physical.job,requiredSkillId:'mecanica'}).length>0);
 const pending=setup({initialPG:1,subcategory:'electricidad'});
 assert.equal(attempt(pending,()=>.01).reason,'skill-pending');
 assert.equal(pending.inventory.uses,3);
});
test('críticos no añaden ni restan PG ni tienen efectos secundarios',()=>{
 const regular=setup({initialPG:2,material:'metal'});
 const critical=setup({initialPG:2,material:'metal'});
 assert.equal(attempt(regular,()=>.01).recoveredPG,5);
 const result=Runtime.perform({...critical.args,skillOptions:{advantage:1},rng:()=>.01});
 assert.equal(result.outcome,'critical-success');
 assert.equal(result.recoveredPG,5);
 const miss=setup({initialPG:2,material:'metal'});
 const bad=Runtime.perform({...miss.args,skillOptions:{advantage:1},rng:()=>.99});
 assert.equal(bad.outcome,'critical-failure');
 assert.equal(bad.recoveredPG,1);
});
test('Scores del personaje no alteran FHSkills.odds ni los PG recuperados',()=>{
 const t=setup({initialPG:2,material:'metal'});
 const a=Runtime.odds({job:t.job,character:{skills:{manipulacionFina:1},scores:{AGI:1}}});
 const b=Runtime.odds({job:t.job,character:{skills:{manipulacionFina:1},scores:{AGI:6}}});
 assert.equal(a.successPercent,b.successPercent);
 assert.equal(a.headsPercent,b.headsPercent);
});
test('la dificultad del trabajo no se puede reemplazar mediante skillOptions',()=>{
 const t=setup({initialPG:2,material:'metal'});
 const result=Runtime.perform({...t.args,skillOptions:{difficulty:0},rng:()=>.99});
 assert.equal(result.ok,true);
 assert.equal(result.roll.difficulty,6);
});
test('guardado: consumo y reparación sobreviven serialización y carga',()=>{
 const t=setup({initialPG:0});
 const r=attempt(t,()=>.01);
 assert.equal(r.pg,5);
 assert.ok(t.saves.length>=2);
 const snapshot=JSON.parse(JSON.stringify({version:1,state:t.state}));
 assert.equal(snapshot.state.structures.piso.puerta.structure.pg,5);
 assert.equal(snapshot.state.repairReceipts.length,1);
 const Health=healthApi(),copy=Health.createRuntime({data:t.map,state:snapshot.state,doorList:[[]],blockers:[[]]});
 assert.equal(copy.getState('piso','puerta').pg,5);
 const dup=Runtime.perform({...t.args,consumeKitUse:()=>({ok:true,consumedUses:1,receiptId:r.consumed.receiptId})});
 assert.equal(dup.reason,'receipt-reused');
});
test('modelo map-v1 y ruta de ejecución no añaden UI, inventario ni una fórmula de DC',()=>{
 const map={schema:'forest-horror-map-v1',floors:[{id:'piso',items:[{id:'puerta',type:'door'}]}]};
 const j=Repair.createJob({id:'x',subcategory:'estructural',compatibleKitId:'kit',difficulty:4,
  recoverablePG:5,target:{floorId:'piso',itemId:'puerta'}});
 map.repairJobs=[j];
 assert.deepEqual(Repair.validateProject(map),[]);
 assert.equal(JSON.parse(JSON.stringify(map)).repairJobs[0].id,'x');
 const index=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 assert.match(index,/repairJobs:clone\(project\.repairJobs\)/);
 assert.match(index,/FHRepair\?\.assertProject\(obj\)/);
 const source=fs.readFileSync(path.join(__dirname,'fh-repair-runtime.js'),'utf8');
 assert.match(source,/Skills\.roll\(/);assert.match(source,/Skills\.odds\(/);
 assert.doesNotMatch(source,/\bd20\b|Math\.random\s*\(/);
});

test('lector destruido antes de cargar su GLB vuelve a montarse tras reconstrucción',()=>{
 let remounts=0;
 const H=healthApi({FHArchitectureSkins:{restoreAccessDevice:d=>{
  remounts++;d.accessVisuals.push({id:'lector-reconstruido'});return true;
 }}});
 const it={id:'reader',type:'door',variant:'metal',accessDevice:'pin',readerInitialPG:0};
 const map={floors:[{id:'p1',items:[it]}]},state={},d={f:0,accessVisuals:[]};
 const rt=H.createRuntime({data:map,state,doorList:[[d]],blockers:[[]]});
 rt.registerDoor(d,it);
 assert.equal(d.readerDestroyed,true);
 assert.equal(rt.getState('p1','reader','reader').pg,0);
 assert.equal(rt.restorePG({floorId:'p1',id:'reader',part:'reader',amount:5}).reason,'requires-success');
 assert.equal(remounts,0);
 const repaired=rt.restorePG({floorId:'p1',id:'reader',part:'reader',amount:5,allowRebuild:true});
 assert.equal(repaired.ok,true);
 assert.equal(repaired.rebuilt,true);
 assert.equal(remounts,1);
 assert.equal(d.readerDestroyed,false);
});
test('ventana reconstruida reintegra sus colliders originales',()=>{
 const H=healthApi();
 const it={id:'ventana',type:'window',windowMaterial:'glass',initialPG:0};
 const walls=[{id:'otro'},{id:'antepecho'}],root={
  parent:null
 };
 let added=0;
 const parent={add(node){node.parent=this;added++},remove(node){node.parent=null;}};
 root.parent=parent;
 const rt=H.createRuntime({data:{floors:[{id:'p1',items:[it]}]},state:{},
  doorList:[[]],blockers:[walls]});
 rt.registerWindow(0,it,[walls[1]],[root]);
 assert.equal(walls.length,1);
 assert.equal(root.parent,null);
 const rejected=rt.restorePG({floorId:'p1',id:'ventana',amount:1});
 assert.equal(rejected.reason,'requires-success');
 assert.equal(walls.length,1);
 const okay=rt.restorePG({floorId:'p1',id:'ventana',amount:1,allowRebuild:true});
 assert.equal(okay.rebuilt,true);
 assert.equal(walls.length,2);
 assert.equal(walls.some(o=>o.id==='antepecho'),true);
 assert.equal(root.parent,parent);
 assert.equal(added,1);
});
