/* Iluminación medieval: estado de partida, sin electricidad ni rayos duplicados.
 * Colisiones, visibilidad y pool de PointLights siguen siendo del motor común.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHMedievalLighting=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const definitions=Object.freeze({
  torch_wall:Object.freeze({modelId:'antorcha_pared_medieval',label:'Antorcha de pared',fuelMinutes:60,fuelItem:'resina_antorcha',radiusFt:20,dimFt:20,mount:'wall',heightFt:6,widthFt:1.1,depthFt:1.0,mountHeightFt:4.5}),
  torch_hand:Object.freeze({modelId:'antorcha_mano_medieval',label:'Antorcha de mano',fuelMinutes:60,fuelItem:'resina_antorcha',radiusFt:20,dimFt:20,mount:'hand',heightFt:2.9,widthFt:.7,depthFt:.7}),
  candle:Object.freeze({modelId:'vela_medieval',label:'Vela',fuelMinutes:120,fuelItem:'cera_vela',radiusFt:5,dimFt:5,mount:'surface',heightFt:.95,widthFt:.55,depthFt:.55}),
  candelabrum:Object.freeze({modelId:'candelabro_medieval',label:'Candelabro',fuelMinutes:180,fuelItem:'cera_vela',radiusFt:10,dimFt:5,mount:'floor',heightFt:3.9,widthFt:2.2,depthFt:1.4}),
  oil_lantern:Object.freeze({modelId:'farol_aceite_medieval',label:'Farol de aceite',fuelMinutes:240,fuelItem:'aceite_lampara',radiusFt:15,dimFt:10,mount:'floor',heightFt:1.5,widthFt:1.2,depthFt:1.2}),
  brazier:Object.freeze({modelId:'brasero_medieval',label:'Brasero',fuelMinutes:180,fuelItem:'lena',radiusFt:20,dimFt:10,mount:'floor',heightFt:2.25,widthFt:2.5,depthFt:2.5,blocksMovement:true}),
  campfire:Object.freeze({modelId:'fogata_medieval',label:'Fogata',fuelMinutes:120,fuelItem:'lena',radiusFt:25,dimFt:15,mount:'floor',heightFt:.85,widthFt:4,depthFt:4,blocksMovement:true}),
  fireplace:Object.freeze({modelId:'chimenea_medieval',label:'Chimenea',fuelMinutes:240,fuelItem:'lena',radiusFt:20,dimFt:10,mount:'floor',heightFt:1.8,widthFt:4.2,depthFt:2.1,blocksMovement:true}),
  magic_crystal:Object.freeze({modelId:'cristal_magico_medieval',label:'Cristal mágico',fuelMinutes:null,fuelItem:null,radiusFt:30,dimFt:15,mount:'floor',heightFt:2.8,widthFt:2.1,depthFt:2.1})
 });
 const tools=Object.freeze({
  light_medieval_wall_torch:'torch_wall',light_medieval_hand_torch:'torch_hand',
  light_medieval_candle:'candle',light_medieval_candelabrum:'candelabrum',
  light_medieval_oil_lantern:'oil_lantern',light_medieval_brazier:'brazier',
  light_medieval_campfire:'campfire',light_medieval_fireplace:'fireplace',
  light_medieval_magic_crystal:'magic_crystal'
 });
 const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const isMedieval=kind=>typeof kind==='string'&&has(definitions,kind);
 const preset=kind=>isMedieval(kind)?definitions[kind]:null;
 const finite=(v,f)=>v!==null&&v!==''&&Number.isFinite(Number(v))?Number(v):f;
 function absoluteMinute(clock){
  const c=clock||{},year=Math.floor(finite(c.year,2016)),month=Math.floor(finite(c.month,1)),day=Math.floor(finite(c.day,1));
  return Math.floor(Date.UTC(year,month-1,day)/60000)+Math.floor(finite(c.minutes,0));
 }
 function createRuntime({floors,state,clock,player,lights,cell=1.524,ruleset}={}){
  if(!Array.isArray(floors)||!state||typeof state!=='object')throw TypeError('MEDIEVAL_LIGHTING_INPUT');
  state.medievalLighting ||= {};
  const store=state.medievalLighting,fixtures=new Map();
  const cellMeters=Math.max(.001,finite(cell,1.524));
  floors.forEach((floor,index)=>{for(const item of floor.items||[]){
   if(item?.type!=='light_fixture'||!isMedieval(item.lightKind)||typeof item.id!=='string'||!item.id)continue;
   if(fixtures.has(item.id))throw Error('MEDIEVAL_LIGHT_ID_DUPLICATE');
   fixtures.set(item.id,{item,floor:index});
   const spec=preset(item.lightKind),prev=store[item.id];
   if(!prev||typeof prev!=='object'){
    store[item.id]={on:item.lightOn!==false,remaining:spec.fuelMinutes===null?null:
     Math.min(spec.fuelMinutes,Math.max(0,finite(item.lightFuelMinutes,spec.fuelMinutes))),lastMinute:null,carried:false};
   }else{
    prev.on=prev.on!==false;prev.remaining=spec.fuelMinutes===null?null:
     Math.min(spec.fuelMinutes,Math.max(0,finite(prev.remaining,spec.fuelMinutes)));
    prev.lastMinute=Number.isFinite(prev.lastMinute)?prev.lastMinute:null;prev.carried=!!prev.carried;
    // Restaurar posición de la antorcha soltada desde el guardado de partida,
    // sin actualizar el JSON inmutable del creador.
    if(item.lightKind==='torch_hand'&&prev.position&&
       Number.isFinite(prev.position.x)&&Number.isFinite(prev.position.y)&&prev.position.floor===index){
      item.x=prev.position.x;item.y=prev.position.y;
    }
   }
   const slot=store[item.id];
   if(slot.remaining===0)slot.on=false;
   if(ruleset==='dnd'){
    if(['fireplace','campfire'].includes(item.lightKind)&&Number(item.workMinutes)>0&&slot.workLeft===undefined){
     slot.workLeft=Math.min(43200,Math.ceil(Number(item.workMinutes)));slot.on=false;
    }
    if(item.homeKeeper===true&&!Array.isArray(slot.homeInventory)){
     const stock=Math.min(100,Math.max(0,Math.floor(Number(item.homeFuel)||0)));
     slot.homeInventory=Array(stock).fill(spec.fuelItem);
     if(item.homeTinderbox===true)slot.homeInventory.push('yesquero');
    }
   }
  }});
  let heldId=null;
  for(const [id,{item}] of fixtures){if(item.lightKind!=='torch_hand')store[id].carried=false;
   if(store[id].carried){if(heldId)store[id].carried=false;else heldId=id;}}
  const now=()=>typeof clock==='function'?finite(clock(),0):absoluteMinute(state.clock);
  function lit(floor,item){const ref=fixtures.get(item?.id);
   if(!ref||ref.floor!==floor)return false;
   const slot=store[item.id];
   return !slot.workLeft&&!!slot.on&&(slot.remaining===null||slot.remaining>0);
  }
  function isCarried(id){return heldId===id&&store[id]?.carried===true;}
  function hasCarried(){return heldId!==null;}
  function itemFor(id){return fixtures.get(id)?.item||null;}
  function extinguish(id){const slot=store[id];if(!slot||!slot.on)return false;slot.on=false;return true;}
  function canIgnite(ref,actor){
   if(ruleset!=='dnd'||actor.inventory?.includes('yesquero'))return true;
   return [...fixtures.values()].some(source=>{
    if(source===ref||source.floor!==actor.floor||source.item.lightKind==='magic_crystal'||
       !lit(source.floor,source.item))return false;
    const p=isCarried(source.item.id)?player?.():{floor:source.floor,x:source.item.x*cellMeters,z:source.item.y*cellMeters};
    return p?.floor===actor.floor&&Math.hypot(p.x-actor.x,p.z-actor.z)<=cellMeters*1.5;
   });
  }
  function playerActor(){return {...player?.(),inventory:state.inventory};}
  function relight(id,actor=playerActor()){
   const ref=fixtures.get(id);if(!ref)return {ok:false,reason:'missing'};
   if(store[id].workLeft)return {ok:false,reason:'unfinished'};
   if(ruleset==='dnd'&&(!actor||actor.floor!==ref.floor||
      !(isCarried(id)&&actor.inventory===state.inventory)&&
      !(Math.hypot(actor.x-ref.item.x*cellMeters,actor.z-ref.item.y*cellMeters)<=cellMeters*1.5)))
    return {ok:false,reason:'outOfReach'};
   if(preset(ref.item.lightKind).fuelMinutes!==null&&!canIgnite(ref,actor))return {ok:false,reason:'noIgnition'};
   if(store[id].remaining===0)return refuel(id,actor);
   store[id].on=true;store[id].lastMinute=now();return {ok:true,action:'on'};
  }
  function refuel(id,actor=playerActor()){
   const ref=fixtures.get(id);if(!ref)return {ok:false,reason:'missing'};
   const spec=preset(ref.item.lightKind),slot=store[id];
   if(spec.fuelMinutes===null)return {ok:false,reason:'permanent'};
   if(slot.workLeft)return {ok:false,reason:'unfinished'};
   if(ruleset==='dnd'&&!near(actor,ref)&&!(isCarried(id)&&actor.inventory===state.inventory))return {ok:false,reason:'outOfReach'};
   if(ruleset==='dnd'&&!canIgnite(ref,actor))return {ok:false,reason:'noIgnition'};
   const at=actor.inventory?.indexOf(spec.fuelItem)??-1;
   if(at<0)return {ok:false,reason:'noFuelItem'};
   actor.inventory.splice(at,1);slot.remaining=spec.fuelMinutes;
   slot.on=true;slot.lastMinute=now();
   return {ok:true,action:'refueled',remaining:slot.remaining};
  }
  function near(p,ref){
   return p?.floor===ref.floor&&Math.hypot(p.x-ref.item.x*cellMeters,p.z-ref.item.y*cellMeters)<=cellMeters*1.5;
  }
  function work(ref,slot){
   if(!near(player?.(),ref))return {ok:false,reason:'outOfReach'};
   if(!slot.materialPaid){
    const material=ref.item.workMaterial||'lena',units=Math.min(100,Math.max(1,Math.ceil(Number(ref.item.workUnits)||1)));
    const inventory=state.inventory||[];
    if(inventory.filter(id=>id===material).length<units)return {ok:false,reason:'workMaterial',material,units};
    for(let i=0;i<units;i++)inventory.splice(inventory.indexOf(material),1);
    slot.materialPaid=true;
   }
   slot.working=!slot.working;slot.workAt=now()-(state.clock?.campaignNonWork||0);
   return {ok:true,action:slot.working?'working':'workPaused',remaining:slot.workLeft};
  }
  function interact(floor,item){
   const ref=fixtures.get(item?.id);if(!ref||ref.floor!==floor)return {ok:false,reason:'missing'};
   const slot=store[item.id],spec=preset(item.lightKind);
   if(slot.workLeft)return work(ref,slot);
   if(ruleset==='dnd'&&heldId&&heldId!==item.id&&!lit(fixtures.get(heldId).floor,fixtures.get(heldId).item)&&lit(floor,item)&&item.lightKind!=='magic_crystal'){
    return relight(heldId);
   }
   if(spec.mount==='hand'){
    if(isCarried(item.id)){return drop()?{ok:true,action:'dropped'}:{ok:false,reason:'wrongFloor'};}
    if(heldId)return {ok:false,reason:'handsFull'};
    if(ruleset!=='dnd'&&slot.remaining===0)return refuel(item.id);
    if(!slot.on){
     if(ruleset!=='dnd')slot.on=true;
     else if(slot.remaining>0&&canIgnite(ref,playerActor()))relight(item.id);
    }
    slot.carried=true;heldId=item.id;slot.lastMinute=now();
    return {ok:true,action:'carried'};
   }
   if(slot.on){slot.on=false;return {ok:true,action:'off'};}
   return relight(item.id);
  }
  function drop(){
   if(!heldId)return false;
   const p=player?.(),ref=fixtures.get(heldId);
   if(!p||p.floor!==ref.floor||!Number.isFinite(p.x)||!Number.isFinite(p.z))return false;
   // Cambia sólo la copia del mapa de la partida; el JSON del creador permanece intacto.
   ref.item.x=p.x/cellMeters;ref.item.y=p.z/cellMeters;
   store[heldId].position={floor:ref.floor,x:ref.item.x,y:ref.item.y};
   store[heldId].carried=false;heldId=null;
   lights?.removeDynamicSource?.('dnd:hand-torch');
   return true;
  }
  let lastNow=null;
  function tick(){
   const minute=now();
   if(lastNow!==null&&minute<lastNow)lastNow=minute;
   let changed=false;
   if(lastNow!==minute){
    for(const [id,{item}]of fixtures){
     const slot=store[id];
     if(slot.working){
      if(!near(player?.(),fixtures.get(id)))slot.working=false;
      else slot.workLeft=Math.max(0,slot.workLeft-Math.max(0,minute-(state.clock?.campaignNonWork||0)-slot.workAt));
      slot.workAt=minute-(state.clock?.campaignNonWork||0);if(slot.workLeft===0)slot.working=false;changed=true;
     }
     if(!slot.on||slot.remaining===null)continue;
     if(slot.lastMinute===null){slot.lastMinute=minute;continue;}
     const delta=Math.max(0,Math.min(1440,minute-slot.lastMinute));
     if(delta>0){slot.remaining=Math.max(0,slot.remaining-delta);slot.lastMinute=minute;changed=true;
      if(slot.remaining===0){slot.on=false;}}
    }
    for(const [id,ref] of fixtures){
     const slot=store[id],hour=((minute%1440)+1440)%1440/60;
     if(!slot.workLeft&&!slot.on&&slot.homeInventory&&(hour>=18||hour<6)){
      const result=relight(id,{floor:ref.floor,x:ref.item.x*cellMeters,z:ref.item.y*cellMeters,inventory:slot.homeInventory});
      if(result.ok)changed=true;
     }
    }
    lastNow=minute;
   }
   if(heldId&&lights?.setDynamicSource){
    const p=player?.(),ref=fixtures.get(heldId);
    if(p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Number.isInteger(p.floor)&&lit(ref.floor,ref.item)){
     const spec=preset(ref.item.lightKind);
     lights.setDynamicSource('dnd:hand-torch',{floor:p.floor,x:p.x,z:p.z,
       radius:spec.radiusFt*.3048,brightRadius:spec.radiusFt*.3048,
       dimRadius:(spec.radiusFt+spec.dimFt)*.3048,angleDeg:360});
    }else lights?.removeDynamicSource?.('dnd:hand-torch');
   }
   return changed;
  }
  function view(id){const slot=store[id];return slot?{...slot}:null;}
  return Object.freeze({lit,interact,relight,refuel,drop,hasCarried,isCarried,itemFor,tick,view,items:()=>fixtures.size});
 }
 return Object.freeze({definitions,tools,isMedieval,preset,absoluteMinute,createRuntime});
});
