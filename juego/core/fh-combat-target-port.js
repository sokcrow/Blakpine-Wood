/* Puerto neutral de objetivos de combate: solo consulta capacidades del mundo. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHCombatTargetPort=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const point=p=>p&&Number.isInteger(p.floor)&&p.floor>=0&&finite(p.x)&&finite(p.z);
 function create({readRuntime,canContact,canSee,maxDistanceMeters}={}){
  if(typeof readRuntime!=='function'||typeof canContact!=='function'||
   typeof canSee!=='function'||!finite(maxDistanceMeters)||maxDistanceMeters<=0)
   throw Error('COMBAT_TARGET_PORT_INVALID');
  function runtime(){
   const instance=readRuntime();
   return instance&&typeof instance.get==='function'&&typeof instance.list==='function'&&
    typeof instance.position==='function'&&typeof instance.receiveHit==='function'?instance:null;
  }
  function read(id){
   if(typeof id!=='string'||!id.trim())return null;
   const source=runtime(),unit=source?.get(id),position=source?.position(id);
   if(!unit||unit.id!==id||unit.type!=='training_dummy'||unit.rulesetId!=='dnd'||
    unit.targetable!==true||unit.alive!==true||unit.indestructible!==true||!point(position))
    return null;
   return Object.freeze({id,type:'training_dummy',floor:position.floor,x:position.x,z:position.z});
  }
  function canAttack(id,player){
   const target=read(id);
   if(!target||!point(player)||target.floor!==player.floor||
    player.inactive===true||player.sleeping===true||player.inElevator===true)return false;
   const distance=Math.hypot(player.x-target.x,player.z-target.z);
   if(distance>maxDistanceMeters)return false;
   return canContact(player,target)===true&&canSee(player,target)===true;
  }
  function list(player){
   const source=runtime();
   if(!source)return [];
   const available=source.list().map(unit=>read(unit.id)).filter(Boolean);
   if(!player)return available;
   return available.filter(unit=>canAttack(unit.id,player))
    .sort((a,b)=>Math.hypot(player.x-a.x,player.z-a.z)-Math.hypot(player.x-b.x,player.z-b.z));
  }
  function receiveHit(id,result){
   if(!read(id)||!result||result.rulesetId!=='dnd'||result.targetId!==id||
    typeof result.hit!=='boolean'||!Number.isSafeInteger(result.damage)||result.damage<0)
    throw Error('COMBAT_TARGET_RESULT_INVALID');
   return runtime().receiveHit(id,{hit:result.hit,damage:result.damage});
  }
  return Object.freeze({read,list,canAttack,receiveHit});
 }
 return Object.freeze({create});
});
