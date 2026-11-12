/* Blakpine-Wood · Electricidad 03. Red exterior opcional para mapas v1.
 * Sin THREE, DOM ni dependencias: misma consulta para editor y motor.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHExteriorGrid=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const CONFIG=Object.freeze({
  poste_luz_madera:{role:'pole',heightFt:20},
  poste_luz_concreto:{role:'pole',heightFt:22},
  poste_luz_con_brazo:{role:'lamp',heightFt:23},
  poste_luz_doble_brazo:{role:'lamp',heightFt:24.5},
  transformador_poste_simple:{role:'transformer',heightFt:19.5,capacityWatts:12000},
  transformador_poste_doble:{role:'transformer',heightFt:21,capacityWatts:30000},
  transformador_caja_superficie:{role:'transformer',heightFt:4.25,capacityWatts:60000},
  caja_distribucion_exterior:{role:'junction',heightFt:4.75}
 });
 const numeric=(x,f=0)=>Number.isFinite(Number(x))?Number(x):f;
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 // La reserva eléctrica es un recurso diferente de los litros de combustible.
 // Las horas representan tiempo de suministro, no energía que pueda llenar un tanque.
 const electricCapacity=it=>clamp(numeric(it?.electricCapacityHours,it?.autonomyHours??24),0,100000);
 const initialElectricCharge=(it,saved={},hasFuelTank=false)=>{
  const cap=electricCapacity(it);
  const initial=numeric(it?.initialElectricChargeHours,cap);
  const previous=saved?.electricChargeHours??(!hasFuelTank?saved?.remainingHours:undefined);
  return clamp(numeric(previous,initial),0,cap);
 };
 const changeElectricCharge=(saved,it,gameHours,mode)=>{
  const cap=electricCapacity(it),current=clamp(numeric(saved?.electricChargeHours),0,cap);
  const hours=Math.max(0,numeric(gameHours));
  const delta=mode==='charge'?hours*Math.max(0,numeric(it?.rechargeHoursPerHour,4)):
   mode==='discharge'?-hours:0;
  if(saved&&typeof saved==='object')saved.electricChargeHours=clamp(current+delta,0,cap);
  return saved?.electricChargeHours??current;
 };
 const roleFor=item=>CONFIG[item?.modelId]?.role||null;
 const isExternal=item=>!!roleFor(item);
 const xy=it=>({x:numeric(it?.x),y:numeric(it?.y)});
 const poweredByCompany=(services,state)=>services.contracts?.electricity!=='suspended'&&state.flags?.power_global!==false&&services.enabled?.power_global!==false;

 function createRuntime(project,state={}){
  const floors=Array.isArray(project?.floors)?project.floors:[];
  const cellFt=Math.max(.1,numeric(project?.units?.feetPerCell,5));
  const services=state.services&&typeof state.services==='object'?state.services:{};
  const nodes=floors.flatMap((floor,f)=>(floor.items||[]).filter(isExternal).map(it=>({
   id:String(it.id||''),it,f,floorId:String(floor.id||f),role:roleFor(it),
   elevationFt:numeric(floor.elevationFt,f*12),cableFt:clamp(numeric(it.exteriorCableFt,90),0,1000),
   supplyFt:clamp(numeric(it.exteriorFeedFt,90),0,1000),parent:null
  }))).filter(n=>n.id);
  const transformers=nodes.filter(n=>n.role==='transformer'),hasTransformers=transformers.length>0;
  const metric=(a,b)=>Math.hypot((numeric(a.it.x)-numeric(b.it.x))*cellFt,
   (numeric(a.it.y)-numeric(b.it.y))*cellFt,a.elevationFt-b.elevationFt);
  const blocked=(a,b)=>Array.isArray(a.it.exteriorBlockedIds)&&a.it.exteriorBlockedIds.includes(b.id)||
   Array.isArray(b.it.exteriorBlockedIds)&&b.it.exteriorBlockedIds.includes(a.id);
  const canWire=(a,b)=>{
   if(!a||!b||a===b||a.f!==b.f||b.role==='transformer'||blocked(a,b))return false;
   return metric(a,b)<=Math.min(a.cableFt,b.cableFt)+1e-7;
  };
  const selectedParent=n=>nodes.find(p=>p.f===n.f&&p.id===String(n.it.exteriorParentId||''))||null;
  const wired=new Set(transformers),edges=[];
  // Enlaces manuales tienen prioridad. Los automáticos rellenan lo demás;
  // "off" y los enlaces manuales inválidos NO se reconectan a escondidas.
  while(wired.size<nodes.length){
   let best=null;
   for(const b of nodes){
    if(wired.has(b))continue;
    const mode=b.it.exteriorLinkMode||'auto';
    if(mode==='off')continue;
    const candidates=mode==='manual'?[selectedParent(b)]:[...wired];
    for(const a of candidates){
     if(!wired.has(a)||!canWire(a,b))continue;
     const feet=metric(a,b),priority=mode==='manual'?0:1;
     if(!best||priority<best.priority||priority===best.priority&&
       (feet<best.feet||feet===best.feet&&a.id+':'+b.id<best.a.id+':'+best.b.id))
      best={a,b,feet,priority};
    }
   }
   if(!best)break;
   best.b.parent=best.a;wired.add(best.b);edges.push(best);
  }
  const healthy=n=>n.it.exteriorGridEnabled!==false&&n.it.enabled!==false&&
   numeric(services.damage?.[n.id])<100&&state.flags?.[n.id]!==false&&
   services.enabled?.[n.id]!==false&&state.flags?.['power_floor:'+n.floorId]!==false;
  function rootFor(node){
   const seen=new Set();let n=node;
   while(n&&!seen.has(n)){seen.add(n);if(n.role==='transformer')return n;n=n.parent;}
   return null;
  }
  function energized(n){
   if(!n||!poweredByCompany(services,state))return false;
   const seen=new Set();let target=n;
   while(target){
    if(seen.has(target)||!healthy(target))return false;
    seen.add(target);
    if(target.role==='transformer')return true;
    target=target.parent;
   }
   return false;
  }
  const capacityWatts=tx=>tx?Math.max(0,numeric(tx.it.exteriorCapacityWatts,CONFIG[tx.it.modelId]?.capacityWatts||12000)):0;
  const demandWatts=panel=>Math.max(0,numeric(panel.exteriorDemandWatts,panel.capacityWatts??2400));
  function nearPoint(f,it,field='supplyFt'){
   if(!hasTransformers||!floors[f]||!it||it.exteriorConnectionMode==='off')return null;
   const point={it,elevationFt:numeric(floors[f].elevationFt,f*12)};
   const requested=it.exteriorConnectionMode==='manual'||!!it.exteriorNodeId;
   const candidates=requested?nodes.filter(n=>n.f===f&&n.id===String(it.exteriorNodeId||'')):nodes;
   let best=null;
   for(const node of candidates){
    if(node.role!=='transformer'&&!node.parent)continue;
    const feet=metric(node,point),limit=clamp(numeric(it.exteriorFeedFt,node[field]),0,1000);
    if(feet>Math.min(limit,node[field])+1e-7)continue;
    const live=energized(node),rank=live?0:1;
    if(!best||rank<best.rank||rank===best.rank&&feet<best.feet)
     best={node,feet,rank};
   }
   if(!best)return null;
   const tx=rootFor(best.node);
   return {connected:true,powered:best.rank===0,nodeId:best.node.id,
    floorId:best.node.floorId,feet:best.feet,node:best.node,
    transformerId:tx?.id||'',capacityWatts:capacityWatts(tx)};
  }
  const panelEligible=it=>it.powerSource===undefined||
   it.powerSource?.kind==='utility'||it.exteriorAutoConnect===true;
  const panelEntries=floors.flatMap((floor,f)=>(floor.items||[]).filter(it=>it.type==='breaker_panel')
   .map(it=>({it,f,key:String(floor.id||f)+':'+String(it.id||'')})));
  let allocationSignature='',allocation=new Map();
  function panelAllocation(){
   const signature=JSON.stringify([state.flags,services.damage,services.enabled,services.contracts?.electricity,
    panelEntries.map(p=>[p.it.id,p.it.exteriorConnectionMode,p.it.exteriorNodeId,p.it.exteriorDemandWatts,
     p.it.exteriorAutoConnect,p.it.powerSource,p.it.exteriorFeedFt])]);
   if(signature===allocationSignature)return allocation;
   allocationSignature=signature;allocation=new Map();
   const spent=new Map();
   for(const {it,f,key} of panelEntries.slice().sort((a,b)=>a.key.localeCompare(b.key))){
    const connection=nearPoint(f,it);
    if(!connection){allocation.set(it,null);continue;}
    if(!panelEligible(it)){allocation.set(it,{...connection,powered:false,reason:'unconfigured'});continue;}
    const tx=nodes.find(n=>n.id===connection.transformerId&&n.f===connection.node.f);
    const demand=demandWatts(it),used=spent.get(tx)||0,capacity=capacityWatts(tx);
    if(connection.powered&&used+demand>capacity+1e-7){
     allocation.set(it,{...connection,powered:false,reason:'capacity',demandWatts:demand,availableWatts:Math.max(0,capacity-used)});
    }else{
     if(connection.powered)spent.set(tx,used+demand);
     allocation.set(it,{...connection,demandWatts:demand,availableWatts:Math.max(0,capacity-used-demand)});
    }
   }
   return allocation;
  }
  function panelConnection(f,panel){
   if(!floors[f]||!panel)return null;
   if(panelAllocation().has(panel))return panelAllocation().get(panel);
   return nearPoint(f,panel);
  }
  function generatorConnection(f,gen){return nearPoint(f,gen);}
  const links=()=>edges.map(edge=>({from:edge.a,to:edge.b,feet:edge.feet,
   manual:edge.b.it.exteriorLinkMode==='manual',powered:energized(edge.a)&&energized(edge.b)}));
  function panelLinks(){
   return panelEntries.flatMap(({it,f})=>{
    const connection=panelConnection(f,it);
    return connection&&panelEligible(it)?[{panel:it,f,...connection}]:[];
   });
  }
  function consumers(node){
   const source=node?.role==='transformer'?node:rootFor(node);
   const downstream=n=>{let p=n;while(p){if(p===node)return true;p=p.parent;}return false;};
   return {posts:nodes.filter(n=>n!==node&&downstream(n)).length,
    lamps:nodes.filter(n=>n.role==='lamp'&&downstream(n)).length,
    breakers:panelLinks().filter(l=>l.powered&&downstream(l.node)).map(l=>l.panel.id),
    transformerId:source?.id||'',capacityWatts:capacityWatts(source)};
  }
  return Object.freeze({nodes,links,panelLinks,hasTransformers,cellFt,energized,
   panelConnection,generatorConnection,rootFor,capacityWatts,consumers,
   electricCapacity,initialElectricCharge,changeElectricCharge});
 }
 return Object.freeze({CONFIG,roleFor,isExternal,createRuntime,electricCapacity,initialElectricCharge,changeElectricCharge});
});
