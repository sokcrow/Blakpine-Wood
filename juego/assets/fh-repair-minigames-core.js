/* Blakpine-Wood — cinco minijuegos de reparación, sin habilidades ni tiradas. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHRepairMiniCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TYPES=Object.freeze({
  breaker_panel:'breaker',generator:'generator',generator_ats:'ats',
  power_outlet:'wires',power_strip:'wires',light_switch:'wires',
  router:'electronics',ethernet_port:'electronics',landline_phone:'electronics',
  phone_charger:'electronics'
 });
 const ORDERS=Object.freeze({breaker:[2,0,3,1],ats:[1,3,0,2]});
 const TARGETS=Object.freeze({generator:[2,4,1],electronics:[1,3,2,1]});
 const WIRE_ENDS=Object.freeze([2,0,3,1]);
 const kindFor=item=>item&&Object.hasOwn(TYPES,item.type)?TYPES[item.type]:null;
 const damageFor=(service,item)=>{
  if(!item||!service?.state?.damage)return 0;
  const value=Number(service.state.damage[item.id]);
  return Number.isFinite(value)&&value>0?Math.min(value,100):0;
 };
 function createSession(kind){
  if(!['breaker','generator','ats','electronics','wires'].includes(kind))
   throw new RangeError('Minijuego desconocido.');
  let progress=0,completed=false,selected=null;
  const values=Array(TARGETS[kind]?.length||0).fill(0),paired=[];
  function view(){
   return {kind,completed,progress,
    target:(ORDERS[kind]||TARGETS[kind]||[]).slice(),
    values:values.slice(),selected,paired:paired.slice(),wireEnds:WIRE_ENDS.slice()};
  }
  function act(action){
   if(completed||!action||typeof action!=='object')
    return {changed:false,correct:false,...view()};
   let changed=false,correct=false;
   if(kind==='breaker'||kind==='ats'){
    if(action.type==='press'&&Number.isInteger(action.index)&&action.index>=0&&action.index<4){
     correct=action.index===ORDERS[kind][progress];
     progress=correct?progress+1:0;changed=true;
     completed=progress===ORDERS[kind].length;
    }
   }else if(kind==='generator'){
    if(action.type==='dial'&&Number.isInteger(action.index)&&action.index>=0&&action.index<values.length&&[1,-1].includes(action.delta)){
     values[action.index]=(values[action.index]+action.delta+6)%6;
     changed=true;correct=values[action.index]===TARGETS[kind][action.index];
     completed=values.every((value,i)=>value===TARGETS[kind][i]);
    }
   }else if(kind==='electronics'){
    if(action.type==='rotate'&&Number.isInteger(action.index)&&action.index>=0&&action.index<values.length){
     values[action.index]=(values[action.index]+1)%4;
     changed=true;correct=values[action.index]===TARGETS[kind][action.index];
     completed=values.every((value,i)=>value===TARGETS[kind][i]);
    }
   }else if(kind==='wires'){
    if(action.type==='left'&&Number.isInteger(action.index)&&action.index>=0&&action.index<4&&!paired.includes(action.index)){
     selected=action.index;changed=true;correct=true;
    }else if(action.type==='right'&&Number.isInteger(action.index)&&action.index>=0&&action.index<4&&selected!==null){
     correct=WIRE_ENDS[action.index]===selected&&!paired.includes(selected);
     if(correct)paired.push(selected);
     selected=null;changed=true;progress=paired.length;completed=progress===4;
    }
   }
   return {changed,correct,...view()};
  }
  return Object.freeze({kind,view,act});
 }
 return Object.freeze({TYPES,kindFor,damageFor,createSession});
});
