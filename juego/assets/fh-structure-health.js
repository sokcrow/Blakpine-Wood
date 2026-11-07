/* Blakpine-Wood — PG de puertas, ventanas y lectores.
 * Contrato: mapa forest-horror-map-v1 sólo define valores iniciales.
 * El daño y los objetos destruidos se guardan en GameState.structures.
 * Ningún método de esta API repara ni aumenta PG.
 */
(function(global){
'use strict';
const MATERIAL=Object.freeze({wood:1,metal:2,glass:.5,grille:1.5,reinforced:3});
const DAMAGE_KINDS=Object.freeze(['physical','magical']);
const ELECTRONIC_SKINS=new Set(['puerta_electronica_opaca','puerta_electronica_reja']);
const DOORS=new Set(['door','peephole_door']);
const clamp=(n,low,high)=>Math.max(low,Math.min(high,n));
const isFiniteNumber=v=>typeof v==='number'&&Number.isFinite(v);
const isElectronic=it=>DOORS.has(it?.type)&&
 (it.accessDoorType==='electronic'||ELECTRONIC_SKINS.has(it.architectureSkin));
function material(it){
 if(it?.type==='window')return it.windowMaterial||'glass';
 if(!DOORS.has(it?.type))return null;
 if(it.doorMaterial&&it.doorMaterial!=='inherit')return it.doorMaterial;
 if(it.architectureSkin==='puerta_electronica_reja')return 'grille';
 if(it.architectureSkin==='puerta_electronica_opaca')return 'metal';
 const v=it.variant;
 return v==='metal'||v==='garage'?'metal':v==='glass'||v==='storefront'?'glass':'wood';
}
function supports(it,part='structure'){
 if(part==='reader')return DOORS.has(it?.type)&&['pin','card'].includes(it.accessDevice);
 return DOORS.has(it?.type)||it?.type==='window';
}
function maxPG(it,part='structure'){
 if(!supports(it,part))return 0;
 if(part==='reader')return 10; // PIN y tarjetas son independientes de la puerta.
 if(isElectronic(it))return 500;
 const mul=MATERIAL[material(it)]??1;
 return (it.type==='window'?5:10)*mul;
}
function initialPG(it,part='structure'){
 const max=maxPG(it,part);
 const value=part==='reader'?it.readerInitialPG:it.initialPG;
 return clamp(isFiniteNumber(value)?value:max,0,max);
}
function validateItem(it,path='item'){
 const errors=[];
 if(!supports(it))return errors;
 const bad=(name,msg)=>errors.push({path:path+'.'+name,message:msg});
 if(it.windowMaterial!==undefined&&it.type==='window'&&!Object.hasOwn(MATERIAL,it.windowMaterial))
  bad('windowMaterial','material desconocido');
 if(it.initialPG!==undefined&&(!isFiniteNumber(it.initialPG)||it.initialPG<0||it.initialPG>maxPG(it)))
  bad('initialPG','PG iniciales fuera del máximo');
 if(it.readerInitialPG!==undefined&&(!isFiniteNumber(it.readerInitialPG)||it.readerInitialPG<0||it.readerInitialPG>10))
  bad('readerInitialPG','el lector admite de 0 a 10 PG');
 if(it.damageVulnerabilities!==undefined&&
  (!Array.isArray(it.damageVulnerabilities)||it.damageVulnerabilities.length>2||
   new Set(it.damageVulnerabilities).size!==it.damageVulnerabilities.length||
   it.damageVulnerabilities.some(k=>!DAMAGE_KINDS.includes(k))))
  bad('damageVulnerabilities','tipos permitidos: physical, magical (sin duplicados)');
 return errors;
}
function validateMap(map){
 const errors=[];
 for(const [fi,floor] of (map?.floors||[]).entries())
  for(const [ii,it] of (floor.items||[]).entries())
   errors.push(...validateItem(it,'floors['+fi+'].items['+ii+']'));
 if(errors.length){
  const e=new Error('Configuración de PG inválida: '+errors.map(x=>x.path+': '+x.message).join(' · '));
  e.name='StructureHealthValidationError';e.errors=errors;throw e;
 }
 return map;
}
function stateFor(registry,floorId,it,part='structure'){
 if(!supports(it,part))return null;
 const max=maxPG(it,part),record=registry?.[floorId]?.[it.id]?.[part];
 const amount=isFiniteNumber(record?.pg)?record.pg:initialPG(it,part);
 const pg=clamp(amount,0,max);
 return {pg,maxPG:max,destroyed:pg===0,part,floorId,id:it.id,
  type:part==='reader'?(it.accessDevice==='pin'?'pin':'card'):it.type};
}
function damage(registry,floorId,it,amount,kind='physical',part='structure'){
 if(!registry||typeof registry!=='object'||Array.isArray(registry))throw new TypeError('Registro de daño inválido');
 if(typeof floorId!=='string'||!floorId||!it?.id||!supports(it,part))
  return {ok:false,reason:'missing'};
 if(!isFiniteNumber(amount)||amount<0)throw new RangeError('El daño debe ser finito y no negativo');
 if(!DAMAGE_KINDS.includes(kind))throw new TypeError('Tipo de daño no admitido');
 const before=stateFor(registry,floorId,it,part);
 const vulnerable=(it.damageVulnerabilities||[]).includes(kind);
 const applied=amount*(vulnerable?2:1);
 const pg=clamp(before.pg-applied,0,before.maxPG);
 if(pg===before.pg)return {ok:true,changed:false,damage:0,wasDestroyed:before.destroyed,...before};
 if(!Object.hasOwn(registry,floorId))registry[floorId]={};
 if(!Object.hasOwn(registry[floorId],it.id))registry[floorId][it.id]={};
 registry[floorId][it.id][part]={pg,destroyed:pg===0};
 return {ok:true,changed:true,damage:before.pg-pg,rawDamage:amount,
  vulnerabilityApplied:vulnerable,wasDestroyed:before.destroyed,
  pg,maxPG:before.maxPG,destroyed:pg===0,part,floorId,id:it.id,type:before.type};
}
function createRuntime({data,state,doorList,blockers,save,refresh,events}){
 const registry=state.structures&&typeof state.structures==='object'&&!Array.isArray(state.structures)
  ?state.structures:(state.structures={});
 const doors=new Map(),windows=new Map();
 const floorKey=(f,id)=>String(f)+'\u0000'+String(id);
 const floorIndex=reference=>typeof reference==='number'&&Number.isInteger(reference)?
   reference:data.floors.findIndex(x=>x.id===reference);
 const get=(ref,id)=>{const f=floorIndex(ref);return {f,floor:data.floors[f],it:data.floors[f]?.items?.find(x=>x.id===id)};};
 function removeRoot(node){
  if(node?.parent?.remove)node.parent.remove(node);
 }
 function destroyDoor(d){
  if(!d||d.destroyed)return;
  d.destroyed=true;d.passable=true;
  removeRoot(d.hinge);removeRoot(d.frame);
 }
 function destroyWindow(entry){
  if(!entry||entry.destroyed)return;
  entry.destroyed=true;
  const list=blockers[entry.f];
  for(const ref of entry.colliders){
   const idx=list.indexOf(ref);
   if(idx!==-1)list.splice(idx,1);
  }
  for(const root of entry.roots)removeRoot(root);
 }
 function destroyReader(d){
  if(!d||d.readerDestroyed)return;
  d.readerDestroyed=true;
  for(const node of d.accessVisuals||[])removeRoot(node);
 }
 function registerDoor(d,it){
  if(!d||!it?.id)return;
  doors.set(floorKey(d.f,it.id),d);
  const key=data.floors[d.f]?.id;
  if(key&&stateFor(registry,key,it)?.destroyed)destroyDoor(d);
  if(key&&stateFor(registry,key,it,'reader')?.destroyed)destroyReader(d);
 }
 function registerWindow(f,it,colliders,roots){
  if(!it?.id)return;
  const entry={f,it,colliders:colliders.slice(),roots:roots.slice(),destroyed:false};
  windows.set(floorKey(f,it.id),entry);
  const key=data.floors[f]?.id;
  if(key&&stateFor(registry,key,it)?.destroyed)destroyWindow(entry);
 }
 function getState(ref,id,part='structure'){
  const {floor,it}=get(ref,id);
  return floor&&it?stateFor(registry,floor.id,it,part):null;
 }
 function isDestroyed(ref,id,part='structure'){return getState(ref,id,part)?.destroyed===true;}
 function takeDamage({floorId,id,amount,kind='physical',part='structure'}={}){
  const {f,floor,it}=get(floorId,id);
  if(!floor||!it)return {ok:false,reason:'missing'};
  const result=damage(registry,floor.id,it,amount,kind,part);
  if(result.changed){
   const key=floorKey(f,id);
   if(result.destroyed&&part==='structure'){
    if(DOORS.has(it.type))destroyDoor(doors.get(key));
    else destroyWindow(windows.get(key));
   }else if(result.destroyed&&part==='reader')destroyReader(doors.get(key));
   if(typeof refresh==='function')refresh();
   if(events?.emit)events.emit('structure:damage',{...result,kind});
   if(typeof save==='function')save();
  }
  return result;
 }
 function nearest(f,x,z,cell=1.524,maxDist=2.4){
  if(!data.floors[f])return null;
  let best=null;
  for(const it of data.floors[f].items||[]){
   if(!supports(it)||!it.id||!it.a||!it.b)continue;
   const mx=(it.a.x+it.b.x)*cell/2,mz=(it.a.y+it.b.y)*cell/2;
   const dist=Math.hypot(x-mx,z-mz);
   if(dist<=maxDist&&(!best||dist<best.dist))best={item:it,dist,f};
  }
  return best;
 }
 return Object.freeze({getState,isDestroyed,takeDamage,registerDoor,registerWindow,nearest});
}
global.FHStructureHealth=Object.freeze({MATERIAL,DAMAGE_KINDS,isElectronic,material,
 supports,maxPG,initialPG,validateItem,validateMap,stateFor,damage,createRuntime});
})(window);
