/* Blakpine-Wood — definición de trabajos de REPARACIÓN.
 * Datos declarativos únicamente: sin tiradas, bonificaciones, inventario,
 * recuperación de PG, NPC ni interfaz.
 *
 * Contrato opcional del mapa v1:
 *   repairJobs: [{id,category:'reparacion',subcategory,requiredSkillId,
 *     compatibleKitId,difficulty,recoverablePG,target:{floorId,itemId,part?}}]
 * Electricidad queda sin habilidad asignada (null); no es ejecutable.
 */
(function(root){
 'use strict';
 const FHSkills=root.FHSkills||(
  typeof module==='object'&&module.exports&&typeof require==='function'
   ?require('./fh-skills.js'):null);
 if(!FHSkills||!Array.isArray(FHSkills.IDS)||!FHSkills.GROUPS)
  throw new Error('FHRepair requiere FHSkills.');

 const CATEGORY='reparacion';
 const SUBCATEGORIES=Object.freeze([
  'estructural','mecanica','informatica','electricidad','electronica'
 ]);
 const DEFAULT_SKILLS=Object.freeze({
  estructural:'manipulacionFina',
  mecanica:'mecanica',
  informatica:'informatica',
  electricidad:null,
  electronica:'electronica'
 });
 const TARGET_PARTS=Object.freeze(['structure','reader']);
 const MAX_ID_LENGTH=120;
 const MAX_JOBS=10000;

 function validId(value){
  return typeof value==='string'&&value.length>0&&value.length<=MAX_ID_LENGTH&&
   value.trim()===value&&!/[\u0000-\u001f\u007f]/.test(value)&&value.trim().length>0;
 }
 function skillGroup(skillId){
  if(skillId===null)return null;
  if(typeof skillId!=='string'||!FHSkills.IDS.includes(skillId))return null;
  for(const [group,ids] of Object.entries(FHSkills.GROUPS)){
   if(ids.includes(skillId))return group;
  }
  return null;
 }
 function defaultSkill(subcategory){
  return Object.hasOwn(DEFAULT_SKILLS,subcategory)?DEFAULT_SKILLS[subcategory]:undefined;
 }
 function resolveStatus(job){
  const errors=validateJob(job);
  if(errors.length)return 'invalid';
  return job.subcategory==='electricidad'?'pending-skill':'configured';
 }
 function validateJob(job,{project=null,path='repairJob'}={}){
  const errors=[];
  const fail=(key,message)=>errors.push({path:key?path+'.'+key:path,message});
  if(!job||typeof job!=='object'||Array.isArray(job)){
   fail('','Debe ser un trabajo de reparación.');
   return errors;
  }
  if(!validId(job.id))fail('id','ID obligatorio de hasta 120 caracteres.');
  if(job.category!==CATEGORY)fail('category','La categoría principal debe ser reparacion.');
  if(!SUBCATEGORIES.includes(job.subcategory))fail('subcategory','Subcategoría desconocida.');

  if(job.subcategory==='electricidad'){
   if(job.requiredSkillId!==null)
    fail('requiredSkillId','Electricidad está pendiente de asignación: requiredSkillId debe ser null.');
  }else if(!FHSkills.IDS.includes(job.requiredSkillId)){
   fail('requiredSkillId','Usa un ID existente en FHSkills.IDS.');
  }else if(job.subcategory==='estructural'&&skillGroup(job.requiredSkillId)!=='AGI'){
   fail('requiredSkillId','Reparación física exige una habilidad de AGI.');
  }else if(['mecanica','informatica','electronica'].includes(job.subcategory)&&
    job.requiredSkillId!==DEFAULT_SKILLS[job.subcategory]){
   fail('requiredSkillId','Esta subcategoría exige su habilidad específica de FHSkills (ING).');
  }

  if(!validId(job.compatibleKitId))
   fail('compatibleKitId','Referencia obligatoria a un kit compatible.');
  if(!Number.isSafeInteger(job.difficulty)||job.difficulty<0||job.difficulty>100)
   fail('difficulty','La dificultad debe ser un entero entre 0 y 100.');
  if(typeof job.recoverablePG!=='number'||!Number.isFinite(job.recoverablePG)||
     job.recoverablePG<=0)
   fail('recoverablePG','Los PG recuperables deben ser un número positivo y finito.');

  const target=job.target;
  if(!target||typeof target!=='object'||Array.isArray(target)){
   fail('target','Se requiere una referencia al objeto objetivo.');
  }else{
   if(!validId(target.floorId))fail('target.floorId','ID de piso obligatorio.');
   if(!validId(target.itemId))fail('target.itemId','ID de objeto obligatorio.');
   if(target.part!==undefined&&!TARGET_PARTS.includes(target.part))
    fail('target.part','Parte objetivo desconocida.');

   if(project&&Array.isArray(project.floors)&&validId(target.floorId)&&validId(target.itemId)){
    const floor=project.floors.find(f=>f?.id===target.floorId);
    if(!floor)fail('target.floorId','El piso no existe en este mapa.');
    else if(!Array.isArray(floor.items)||!floor.items.some(it=>it?.id===target.itemId))
     fail('target.itemId','El objeto objetivo no existe en ese piso.');
   }
  }
  return errors;
 }
 function validateJobs(jobs,{project=null,path='repairJobs'}={}){
  if(!Array.isArray(jobs))return [{path,message:'Debe ser una lista de trabajos.'}];
  if(jobs.length>MAX_JOBS)
   return [{path,message:'Demasiados trabajos configurados.'}];
  const errors=[],seen=new Set();
  jobs.forEach((job,index)=>{
   const itemPath=path+'['+index+']';
   errors.push(...validateJob(job,{project,path:itemPath}));
   if(validId(job?.id)){
    if(seen.has(job.id))errors.push({path:itemPath+'.id',message:'ID de trabajo duplicado.'});
    seen.add(job.id);
   }
  });
  return errors;
 }
 function validateProject(project){
  if(!project||typeof project!=='object'||Array.isArray(project))
   return [{path:'$',message:'El proyecto debe ser un objeto.'}];
  if(project.repairJobs===undefined)return [];
  if(project.schema!=='forest-horror-map-v1')
   return [{path:'schema',message:'Se requiere forest-horror-map-v1.'}];
  return validateJobs(project.repairJobs,{project,path:'repairJobs'});
 }
 function assertValid(errors){
  if(errors.length){
   const error=new Error('Configuración de reparación inválida: '+
    errors.map(e=>e.path+': '+e.message).join(' · '));
   error.name='RepairConfigError';error.errors=errors;throw error;
  }
 }
 function createJob(input){
  if(!input||typeof input!=='object'||Array.isArray(input))
   throw new TypeError('Se requiere configuración de reparación.');
  const subcategory=input.subcategory;
  const job={
   id:input.id,
   category:input.category??CATEGORY,
   subcategory,
   requiredSkillId:input.requiredSkillId===undefined?defaultSkill(subcategory):input.requiredSkillId,
   compatibleKitId:input.compatibleKitId,
   difficulty:input.difficulty,
   recoverablePG:input.recoverablePG,
   target:input.target&&typeof input.target==='object'&&!Array.isArray(input.target)
    ?{floorId:input.target.floorId,itemId:input.target.itemId,
      ...(input.target.part===undefined?{}:{part:input.target.part})}
    :input.target
  };
  assertValid(validateJob(job));
  return job;
 }
 function assertProject(project){
  assertValid(validateProject(project));
  return project;
 }

 const api=Object.freeze({CATEGORY,SUBCATEGORIES,DEFAULT_SKILLS,TARGET_PARTS,
  defaultSkill,skillGroup,resolveStatus,createJob,validateJob,validateJobs,
  validateProject,assertProject});
 root.FHRepair=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
