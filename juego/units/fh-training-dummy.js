/* Blakpine Wood — unidad de entrenamiento independiente de los reglamentos. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHTrainingDummy=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TYPE='training_dummy', HP=1;
 const RULESETS=Object.freeze(['legacy','dnd','moon-system']);
 const validNumber=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
 function stats(rulesetId,custom={}){
  if(!RULESETS.includes(rulesetId))throw new RangeError('TRAINING_DUMMY_RULESET_INVALID');
  if(!custom||typeof custom!=='object'||Array.isArray(custom))throw new TypeError('TRAINING_DUMMY_STATS_INVALID');
  // Los demás atributos pertenecen al reglamento; estos tres valores nunca cambian.
  const value={...custom};
  if(rulesetId==='legacy'){
   value.PG=HP;value.PGMax=HP;value.MOV=0;
  }else{
   value.hp=HP;value.maxHp=HP;value.speed=0;
  }
  return Object.freeze(value);
 }
 function create({id,rulesetId='legacy',customStats={}}={}){
  if(typeof id!=='string'||!id.trim())throw new TypeError('TRAINING_DUMMY_ID_INVALID');
  return Object.freeze({
   id,type:TYPE,rulesetId,kind:'unit',targetable:true,immobile:true,
   indestructible:true,alive:true,hp:HP,maxHp:HP,movement:0,
   stats:stats(rulesetId,customStats),hitsReceived:0,lastIncomingDamage:0
  });
 }
 function receiveHit(unit,{hit=true,damage=0}={}){
  if(unit?.type!==TYPE||!RULESETS.includes(unit.rulesetId))throw new TypeError('TRAINING_DUMMY_TARGET_INVALID');
  if(typeof hit!=='boolean'||!validNumber(damage))throw new TypeError('TRAINING_DUMMY_DAMAGE_INVALID');
  const updated=Object.freeze({...unit,hp:HP,maxHp:HP,alive:true,
   hitsReceived:unit.hitsReceived+(hit?1:0),lastIncomingDamage:hit?damage:0});
  return Object.freeze({unit:updated,hit,incomingDamage:hit?damage:0,
   damageApplied:0,defeated:false,despawn:false,reward:false});
 }
 function createRuntime({project,THREE,stories,floorElev,cell,rulesetId='legacy'}={}){
  if(!Array.isArray(project?.floors)||!Array.isArray(stories)||!Array.isArray(floorElev)||
    !Number.isFinite(cell)||cell<=0||!THREE)throw new TypeError('TRAINING_DUMMY_WORLD_INVALID');
  const units=new Map(),visuals=new Map(),positions=new Map();
  // Marca geométrica provisional, NO sustituye el sprite original de Imgur.
  function makeMarker(){
   const group=new THREE.Group();
   const wood=new THREE.MeshLambertMaterial({color:0x806047});
   const edge=new THREE.MeshLambertMaterial({color:0x3d3431});
   const face=new THREE.MeshLambertMaterial({color:0xd2c0a0});
   const pole=new THREE.Mesh(new THREE.BoxGeometry(.14,1.45,.14),wood);
   pole.position.y=.73;group.add(pole);
   const board=new THREE.Mesh(new THREE.CylinderGeometry(.39,.39,.10,16),face);
   board.rotation.x=Math.PI/2;board.position.set(0,1.25,0);group.add(board);
   const ring=new THREE.Mesh(new THREE.TorusGeometry(.23,.035,8,20),edge);
   ring.position.set(0,1.25,.061);group.add(ring);
   const core=new THREE.Mesh(new THREE.SphereGeometry(.055,8,8),edge);
   core.position.set(0,1.25,.071);group.add(core);
   return group;
  }
  project.floors.forEach((floor,f)=>{
   (floor.items||[]).forEach(item=>{
    if(item.type!==TYPE)return;
    const id=String(item.id||'training_dummy:'+f+':'+item.x+':'+item.y);
    if(units.has(id))throw new Error('TRAINING_DUMMY_DUPLICATE_ID');
    if(!Number.isFinite(item.x)||!Number.isFinite(item.y))throw new TypeError('TRAINING_DUMMY_POSITION_INVALID');
    const unit=create({id,rulesetId});
    const model=makeMarker();
    // stories[f] ya incluye la elevación del piso; no duplicarla.
    model.position.set(item.x*cell,0,item.y*cell);
    stories[f].add(model);
    units.set(id,unit);visuals.set(id,model);
    positions.set(id,Object.freeze({floor:f,x:item.x*cell,z:item.y*cell}));
   });
  });
  return Object.freeze({
   get(id){return units.get(id)||null;},
   position(id){return positions.get(id)||null;},
   list(){return Array.from(units.values());},
   visual(id){return visuals.get(id)||null;},
   receiveHit(id,attack){
    const unit=units.get(id);
    if(!unit)throw new RangeError('TRAINING_DUMMY_NOT_FOUND');
    const result=receiveHit(unit,attack);
    units.set(id,result.unit);
    return result;
   }
  });
 }
 function patchEngineDoc(source){
  if(typeof source!=='string')throw new TypeError('TRAINING_DUMMY_ENGINE_INVALID');
  const anchor='DATA.floors.forEach((_,i)=>buildFloor(i));';
  if(source.split(anchor).length!==2)throw new Error('TRAINING_DUMMY_ENGINE_ANCHOR_MISSING');
  const install=`
const fhTrainingDummyRuleset=DATA.__multimodeSave?.rulesetId||DATA.__multimodeSave?.identity?.rulesetId||'legacy';
window.FHTrainingDummyRuntime=window.parent.FHTrainingDummy.createRuntime({
 project:DATA,THREE,stories,floorElev,cell:CELL,
 rulesetId:['legacy','dnd','moon-system'].includes(fhTrainingDummyRuleset)?fhTrainingDummyRuleset:'legacy'
});`;
  return source.replace(anchor,anchor+'\n'+install);
 }
 return Object.freeze({type:TYPE,id:'unit.training-dummy',maxHp:HP,minHp:HP,
  rulesets:RULESETS,originalImage:'https://imgur.com/I9q0e61',
  stats,create,receiveHit,createRuntime,patchEngineDoc});
});
