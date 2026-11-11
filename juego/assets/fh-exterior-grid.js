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
  transformador_poste_simple:{role:'transformer',heightFt:19.5},
  transformador_poste_doble:{role:'transformer',heightFt:21},
  transformador_caja_superficie:{role:'transformer',heightFt:4.25},
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
  const hasTransformers=nodes.some(n=>n.role==='transformer');
  const metric=(a,b)=>Math.hypot((numeric(a.it.x)-numeric(b.it.x))*cellFt,
   (numeric(a.it.y)-numeric(b.it.y))*cellFt, a.elevationFt-b.elevationFt);
  const transformers=nodes.filter(n=>n.role==='transformer');
  const visited=new Set(transformers);const edges=[];
  // Árbol de cableado determinista: varias fuentes, sin enlaces infinitos o ciclos.
  while(visited.size<nodes.length){
   let best=null;
   for(const a of visited)for(const b of nodes){
    if(visited.has(b))continue;
    const feet=metric(a,b);
    if(feet>Math.min(a.cableFt,b.cableFt)+1e-7)continue;
    if(!best||feet<best.feet||feet===best.feet&&(a.id+':'+b.id)<(best.a.id+':'+best.b.id))best={a,b,feet};
   }
   if(!best)break;
   best.b.parent=best.a;visited.add(best.b);edges.push(best);
  }
  function healthy(n){return n.it.exteriorGridEnabled!==false&&n.it.enabled!==false&&
    numeric(services.damage?.[n.id])<100&&state.flags?.[n.id]!==false&&services.enabled?.[n.id]!==false;}
  function energized(n){
   if(!poweredByCompany(services,state))return false;
   const seen=new Set();let target=n;
   while(target){
    if(seen.has(target)||!healthy(target))return false;
    seen.add(target);
    if(target.role==='transformer')return true;
    target=target.parent;
   }
   return false;
  }
  function nearPoint(f,it,field='supplyFt'){
   if(!hasTransformers||!floors[f]||!it)return null;
   const p={it,elevationFt:numeric(floors[f].elevationFt,f*12)};
   let best=null;
   for(const node of nodes){
    if(!node.parent&&node.role!=='transformer')continue;
    const feet=metric(node,p);
    const limit=clamp(numeric(it.exteriorFeedFt,node[field]),0,1000);
    if(feet>Math.min(limit,node[field])+1e-7)continue;
    // Preferir una ruta energizada; solo desempatar por longitud.
    const live=energized(node),rank=live?0:1;
    if(!best||rank<best.rank||rank===best.rank&&feet<best.feet)best={node,feet,rank};
   }
   return best?{connected:true,powered:best.rank===0,nodeId:best.node.id,
    floorId:best.node.floorId,feet:best.feet,node:best.node}:null;
  }
  function panelConnection(f,panel){return nearPoint(f,panel);}
  function generatorConnection(f,gen){return nearPoint(f,gen);}
  const links=()=>edges.map(edge=>({from:edge.a,to:edge.b,feet:edge.feet,powered:energized(edge.a)&&energized(edge.b)}));
  function panelLinks(){return floors.flatMap((floor,f)=>(floor.items||[])
    .filter(it=>it.type==='breaker_panel'&&
      (it.powerSource===undefined||it.powerSource?.kind==='utility'||it.exteriorAutoConnect===true)).flatMap(it=>{
     const connection=panelConnection(f,it);
     return connection?[{panel:it,f,...connection}]:[];
    }));}
  return Object.freeze({nodes,links,panelLinks,hasTransformers,cellFt,energized,
   panelConnection,generatorConnection,electricCapacity,initialElectricCharge,changeElectricCharge});
 }
 return Object.freeze({CONFIG,roleFor,isExternal,createRuntime,electricCapacity,initialElectricCharge,changeElectricCharge});
});
