'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const FHSkills=require('./fh-skills.js');
const Repair=require('./fh-repair.js');

const sample=(overrides={})=>({
 id:'trabajo_puerta_01',
 subcategory:'estructural',
 compatibleKitId:'kit_reparacion_general',
 difficulty:4,
 recoverablePG:5,
 target:{floorId:'floor1',itemId:'obj_puerta_1',part:'structure'},
 ...overrides
});
const demo=()=>JSON.parse(fs.readFileSync(
 path.join(__dirname,'../../forest-horror/maps/DEMO_Interacciones.json'),'utf8'));
const existingTarget=map=>{
 const fi=map.floors.findIndex(f=>f.items.some(it=>it.type==='door'));
 const item=map.floors[fi].items.find(it=>it.type==='door');
 return {floorId:map.floors[fi].id,itemId:item.id,part:'structure'};
};

test('categoría principal REPARACIÓN y cinco subcategorías declarativas',()=>{
 assert.equal(Repair.CATEGORY,'reparacion');
 assert.deepEqual(Repair.SUBCATEGORIES,[
  'estructural','mecanica','informatica','electricidad','electronica']);
 assert.equal(new Set(Repair.SUBCATEGORIES).size,5);
});
test('habilidades predeterminadas usan exclusivamente FHSkills.IDS',()=>{
 const expected={
  estructural:['manipulacionFina','AGI'],
  mecanica:['mecanica','ING'],
  informatica:['informatica','ING'],
  electronica:['electronica','ING']
 };
 for(const [subcategory,[id,score]] of Object.entries(expected)){
  assert.equal(Repair.defaultSkill(subcategory),id);
  assert.ok(FHSkills.IDS.includes(id));
  assert.equal(Repair.skillGroup(id),score);
  const job=Repair.createJob(sample({subcategory}));
  assert.equal(job.requiredSkillId,id);
  assert.equal(Repair.resolveStatus(job),'configured');
 }
 assert.equal(Repair.skillGroup('electricidad'),null);
 assert.equal(Repair.defaultSkill('desconocida'),undefined);
});
test('Electricidad queda pendiente: habilidad null, no se inventa Score ni habilidad',()=>{
 const originalIds=[...FHSkills.IDS],originalGroups=Object.keys(FHSkills.GROUPS);
 const job=Repair.createJob(sample({subcategory:'electricidad'}));
 assert.equal(job.requiredSkillId,null);
 assert.equal(Repair.resolveStatus(job),'pending-skill');
 assert.deepEqual(Repair.validateJob(job),[]);
 assert.ok(!FHSkills.IDS.includes('electricidad'));
 assert.deepEqual(FHSkills.IDS,originalIds);
 assert.deepEqual(Object.keys(FHSkills.GROUPS),originalGroups);
 const invalid=Repair.createJob.bind(null,sample({
  subcategory:'electricidad',requiredSkillId:'electronica'
 }));
 assert.throws(invalid,/pending|pendiente|asignación/i);
 assert.ok(Repair.validateJob({...job,requiredSkillId:'electricidad'})
  .some(e=>e.path.endsWith('.requiredSkillId')));
});
test('cada trabajo declara categoría, habilidad, kit, dificultad, PG y objetivo',()=>{
 const job=Repair.createJob(sample({subcategory:'mecanica',difficulty:8,recoverablePG:1.5}));
 assert.deepEqual(job,{
  id:'trabajo_puerta_01',category:'reparacion',
  subcategory:'mecanica',requiredSkillId:'mecanica',
  compatibleKitId:'kit_reparacion_general',difficulty:8,
  recoverablePG:1.5,
  target:{floorId:'floor1',itemId:'obj_puerta_1',part:'structure'}
 });
 assert.deepEqual(Repair.validateJob(job),[]);
 assert.equal(Repair.resolveStatus(job),'configured');
 const other=Repair.createJob(sample({subcategory:'estructural',requiredSkillId:'cerrajeria'}));
 assert.equal(other.requiredSkillId,'cerrajeria');
 assert.equal(Repair.skillGroup(other.requiredSkillId),'AGI');
});
test('no se aceptan habilidades inexistentes, tipos inválidos o categorías inventadas',()=>{
 for(const input of [
  sample({requiredSkillId:'electricidad'}),
  sample({requiredSkillId:'reparacion'}),
  sample({requiredSkillId:'ING'}),
  sample({subcategory:'magia'}),
  sample({category:'otra'}),
  sample({requiredSkillId:9})
 ])assert.ok(Repair.validateJob({...input,category:input.category??'reparacion'}).length>0);
 assert.throws(()=>Repair.createJob(sample({requiredSkillId:'electricidad'})),/Habilidad|FHSkills|reparación/i);
});
test('dificultad compatible con FHSkills: entero de 0 a 100',()=>{
 for(const n of [0,1,4,50,100])assert.equal(
  Repair.createJob(sample({difficulty:n})).difficulty,n);
 for(const n of [-1,101,3.5,'4',NaN,Infinity,null])assert.ok(
  Repair.validateJob({...Repair.createJob(sample()),difficulty:n})
   .some(e=>e.path.endsWith('.difficulty')),String(n));
});
test('PG recuperables: positivos y finitos, sin recuperación real del estado',()=>{
 for(const pg of [0.5,1,12,500,10000]){
  const job=Repair.createJob(sample({recoverablePG:pg}));
  assert.equal(job.recoverablePG,pg);
 }
 for(const pg of [0,-2,Infinity,NaN,'5',null]){
  const errors=Repair.validateJob({...Repair.createJob(sample()),recoverablePG:pg});
  assert.ok(errors.some(e=>e.path.endsWith('.recoverablePG')),String(pg));
 }
 const state={structures:{floor1:{obj_puerta_1:{structure:{pg:0,destroyed:true}}}}};
 const serialized=JSON.stringify(state);
 Repair.createJob(sample({recoverablePG:999}));
 assert.equal(JSON.stringify(state),serialized,'crear un trabajo no repara ni altera la partida');
});
test('kits declarados mediante identificadores, sin ejecutar comprobaciones de inventario',()=>{
 for(const kit of ['', ' ', 42,null,'id'.repeat(80),' kit_de_prueba']){
  const j={...Repair.createJob(sample()),compatibleKitId:kit};
  assert.ok(Repair.validateJob(j).some(e=>e.path.endsWith('compatibleKitId')));
 }
 assert.equal(Repair.createJob(sample({compatibleKitId:'kit_multiusos'})).compatibleKitId,'kit_multiusos');
});
test('objetivos declarados por piso + ID de item y parte opcional',()=>{
 const job=Repair.createJob(sample({target:{floorId:'floor2',itemId:'obj_pc'}}));
 assert.deepEqual(job.target,{floorId:'floor2',itemId:'obj_pc'});
 for(const target of [null,'obj',{}, {floorId:'floor1'},{itemId:'x'},
  {floorId:'floor1',itemId:'x',part:'cable'}]){
  const invalid={...Repair.createJob(sample()),target};
  assert.ok(Repair.validateJob(invalid).some(e=>e.path.includes('.target')));
 }
 assert.equal(Repair.createJob(sample({target:{floorId:'f1',itemId:'reader1',part:'reader'}}))
  .target.part,'reader');
});
test('opcionalmente verifica que piso y objetivo existan en un mapa real',()=>{
 const map=demo(),target=existingTarget(map);
 const job=Repair.createJob(sample({target}));
 assert.deepEqual(Repair.validateJob(job,{project:map}),[]);
 assert.ok(Repair.validateJob({...job,target:{...target,floorId:'no-existe'}},{project:map})
  .some(e=>e.path.endsWith('target.floorId')));
 assert.ok(Repair.validateJob({...job,target:{...target,itemId:'no-existe'}},{project:map})
  .some(e=>e.path.endsWith('target.itemId')));
});
test('lista rechaza IDs duplicados y configuración que no es un array',()=>{
 const a=Repair.createJob(sample()),b=Repair.createJob(sample({subcategory:'mecanica'}));
 assert.ok(Repair.validateJobs([a,b]).some(e=>e.message.includes('duplicado')));
 assert.ok(Repair.validateJobs(null).some(e=>e.path==='repairJobs'));
 assert.deepEqual(Repair.validateJobs([a]),[]);
 assert.throws(()=>Repair.assertProject({schema:'forest-horror-map-v1',repairJobs:[a,b]}),
  /duplicado/);
});
test('mapas antiguos siguen válidos y se dejan byte por byte inalterados',()=>{
 const map=demo(),before=JSON.stringify(map);
 assert.equal(map.schema,'forest-horror-map-v1');
 assert.deepEqual(Repair.validateProject(map),[]);
 assert.equal(Repair.assertProject(map),map);
 assert.equal(JSON.stringify(map),before);
});
test('JSON opcional repairJobs se conserva en ida y vuelta sin migración v2',()=>{
 const map=demo(),target=existingTarget(map);
 const job=Repair.createJob(sample({target,subcategory:'informatica',recoverablePG:2}));
 const elect=Repair.createJob(sample({id:'trabajo_pendiente_1',target,subcategory:'electricidad'}));
 map.repairJobs=[job,elect];
 assert.deepEqual(Repair.validateProject(map),[]);
 const raw=JSON.stringify(map),restored=JSON.parse(raw);
 assert.deepEqual(Repair.validateProject(restored),[]);
 assert.equal(JSON.stringify(restored),raw);
 assert.equal(restored.schema,'forest-horror-map-v1');
 assert.equal(restored.repairJobs[1].requiredSkillId,null);
 assert.equal(Repair.resolveStatus(restored.repairJobs[1]),'pending-skill');
});
test('sin campo repairJobs no se fuerza validación ni migración del mapa',()=>{
 assert.deepEqual(Repair.validateProject({schema:'forest-horror-map-v1',floors:[]}),[]);
 assert.deepEqual(Repair.validateProject({schema:'forest-horror-map-v2',floors:[]}),[]);
 assert.ok(Repair.validateProject({schema:'forest-horror-map-v2',repairJobs:[]})
  .some(e=>e.path==='schema'));
});
test('crear reparaciones no afecta odds, tiradas ni Scores del personaje',()=>{
 const job=Repair.createJob(sample({subcategory:'mecanica'}));
 const low={skills:{mecanica:3},scores:{ING:1}};
 const high={skills:{mecanica:3},scores:{ING:6}};
 const a=FHSkills.odds(low,job.requiredSkillId,{difficulty:job.difficulty});
 const b=FHSkills.odds(high,job.requiredSkillId,{difficulty:job.difficulty});
 assert.equal(a.successPercent,b.successPercent);
 assert.equal(a.headsPercent,b.headsPercent);
 const source=fs.readFileSync(path.join(__dirname,'fh-repair.js'),'utf8');
 assert.doesNotMatch(source,/\bFHSkills\.(?:roll|odds)\s*\(/);
 assert.doesNotMatch(source,/Math\.random\s*\(/);
 assert.doesNotMatch(source,/\.structures\s*=|\.inventory\s*=/);
});
