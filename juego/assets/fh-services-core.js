/* FH_SERVICES_24_20261109 | Blakpine-Wood: infraestructura sin tarifas; compatible con forest-horror-map-v1.
 * Editor y motor comparten reglas. El estado persistente vive en GameState.services.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHServices=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const WALLS=new Set(['wall','red_wall','property_wall']);
 // La ventana conserva la instalación; puertas y aberturas cortan ese tramo.
 const WALL_PATHS=new Set([...WALLS,'window']);
 const INFRA=new Set(['generator','generator_ats','generator_tank','power_outlet','power_strip','water_main','water_valve','water_outlet','drain_outlet','drain_main','router','ethernet_port','landline_phone','phone_charger']);
 const POWER_NEEDS=new Set(['router','phone_charger','light_fixture','tv','landline_phone','elevator']);
 const ELECTRIC_MODELS=new Set(['refrigerador','estufa_horno','microondas','campana_extractora','cafetera','tostadora',
  'lampara_escritorio','monitor_crt','gabinete_pc','teclado_pc','mouse_pc','impresora_matricial','telefono_fijo',
  'telefono_pared','contestadora','fax','televisor_crt','videocasetera_vhs','radio_portatil','grabadora_boombox',
  'reloj_digital','camara_seguridad','escritorio_pc']);
 const needsElectricity=it=>!!it&&(POWER_NEEDS.has(it.type)||ELECTRIC_MODELS.has(it.modelId)||it.pcTerminal===true||it.requiresPower===true||it.service?.requiresPower===true);
 const WATER_NEEDS=new Set(['bath','toilet','kitchen']);
 const LIMITS={small:{rangeFt:90,capacityWatts:1200},medium:{rangeFt:180,capacityWatts:2400},large:{rangeFt:360,capacityWatts:4800}};
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const number=(n,fallback=0)=>Number.isFinite(Number(n))?Number(n):fallback;
 function rangeFor(panel,circuit={}){
  const max=LIMITS[panel.breakerType||'medium']?.rangeFt||180;
  return Math.min(max,Math.max(0,number(circuit.rangeFt??panel.rangeFt,max)));
 }
 const point=it=>({x:number(it?.x),y:number(it?.y)});
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const id=it=>String(it?.id||'');
 const line=(p,q)=>({a:p,b:q});
 const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y});
 const cross=(a,b)=>a.x*b.y-a.y*b.x;
 const onSegment=(p,a,b,eps=0.002)=>{
  const d=sub(b,a),v=sub(p,a);
  return Math.abs(cross(d,v))<=eps*Math.max(1,dist(a,b))&&
   (p.x-a.x)*(p.x-b.x)+(p.y-a.y)*(p.y-b.y)<=eps;
 };
 function intersection(a,b,c,d){
  const r=sub(b,a),s=sub(d,c),det=cross(r,s);
  if(Math.abs(det)<1e-9)return null;
  const t=cross(sub(c,a),s)/det,u=cross(sub(c,a),r)/det;
  if(t<0||t>1||u<0||u>1)return null;
  return {x:a.x+r.x*t,y:a.y+r.y*t};
 }
 function project(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;
  const t=d2?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/d2,0,1):0;
  return {x:a.x+dx*t,y:a.y+dy*t,t};
 }
 function wallGraph(items,options={}){
  const paths=options.doorways?new Set([...WALL_PATHS,'door','peephole_door','opening']):WALL_PATHS;
  const walls=(items||[]).filter(it=>paths.has(it.type)&&it.a&&it.b&&dist(it.a,it.b)>0.001);
  const cuts=walls.map(w=>[w.a,w.b]);
  for(let i=0;i<walls.length;i++)for(let j=i+1;j<walls.length;j++){
   const a=walls[i],b=walls[j],hit=intersection(a.a,a.b,b.a,b.b);
   if(hit){cuts[i].push(hit);cuts[j].push(hit);}
   for(const p of [a.a,a.b])if(onSegment(p,b.a,b.b))cuts[j].push(p);
   for(const p of [b.a,b.b])if(onSegment(p,a.a,a.b))cuts[i].push(p);
  }
  const vertices=new Map(),edges=[],adj=new Map();
  const key=p=>Math.round(p.x*10000)+','+Math.round(p.y*10000);
  const add=p=>{const k=key(p);if(!vertices.has(k))vertices.set(k,{x:p.x,y:p.y});if(!adj.has(k))adj.set(k,[]);return k};
  for(let i=0;i<walls.length;i++){
   const w=walls[i],a=w.a,b=w.b;
   const sorted=[...new Map(cuts[i].map(p=>[key(p),p])).values()]
    .sort((p,q)=>project(p,a,b).t-project(q,a,b).t);
   for(let k=1;k<sorted.length;k++){
    const p=sorted[k-1],q=sorted[k],len=dist(p,q);
    if(len<1e-5)continue;
    const u=add(p),v=add(q),edge={a:p,b:q,u,v,len,wallId:id(w),wallType:w.type};
    edges.push(edge);adj.get(u).push({to:v,cost:len,edge});adj.get(v).push({to:u,cost:len,edge});
   }
  }
  const anchor=(p,allowed=()=>true)=>{
   let best=null,d=Infinity;
   for(const edge of edges){
    if(!allowed(edge))continue;
    const q=project(p,edge.a,edge.b),v=dist(p,q);
    if(v<d){d=v;best={edge,p:q,gap:v};}
   }
   return best;
  };
  // Ruta compartida entre simulación y overlay, continua sólo por ventanas.
  function routeDetailed(a,b,maxGap=.65,allowed=()=>true){
   const start=anchor(a,allowed),end=anchor(b,allowed);
   if(!start||!end||start.gap>maxGap||end.gap>maxGap)return null;
   let best=null;
   const select=(length,points)=>{
    if(!Number.isFinite(length)||best&&length>=best.length-1e-7)return;
    const compact=points.filter((p,i)=>i===0||dist(p,points[i-1])>1e-6);
    best={length,points:compact,from:start.p,to:end.p,fromGap:start.gap,toGap:end.gap};
   };
   if(start.edge===end.edge)select(dist(start.p,end.p),[start.p,end.p]);
   for(const sa of ['u','v']){
    const from=start.edge[sa],initial=dist(start.p,vertices.get(from));
    const costs=new Map([[from,0]]),prev=new Map(),done=new Set(),queue=[[0,from]];
    while(queue.length){
     queue.sort((a,b)=>b[0]-a[0]);
     const [cost,key]=queue.pop();
     if(done.has(key))continue;
     done.add(key);
     for(const entry of adj.get(key)||[]){
      if(!allowed(entry.edge))continue;
      const next=cost+entry.cost;
      if(next<(costs.get(entry.to)??Infinity)){
       costs.set(entry.to,next);prev.set(entry.to,key);queue.push([next,entry.to]);
      }
     }
    }
    for(const eb of ['u','v']){
     const to=end.edge[eb],length=initial+(costs.get(to)??Infinity)+dist(end.p,vertices.get(to));
     if(!Number.isFinite(length))continue;
     const keys=[to];let node=to;
     while(node!==from){node=prev.get(node);if(!node)break;keys.push(node)}
     if(node!==from)continue;
     keys.reverse();
     select(length,[start.p,...keys.map(k=>vertices.get(k)),end.p]);
    }
   }
   return best;
  }
  function route(a,b,maxGap=.65,allowed){
   return routeDetailed(a,b,maxGap,allowed)?.length??Infinity;
  }
  function wallsBetween(a,b){
   let count=0;
   for(const w of walls){
    if(!WALLS.has(w.type))continue;
    const hit=intersection(a,b,w.a,w.b);
    if(hit&&dist(hit,a)>.12&&dist(hit,b)>.12)count++;
   }
   return count;
  }
  return {route,routeDetailed,wallsBetween,wallCount:walls.filter(w=>WALLS.has(w.type)).length};
 }
 function defaultsFor(type){
  switch(type){
   case 'generator_ats':return {};
   case 'generator_tank':return {capacityLiters:0};
   case 'generator':return {fuelLitersPerHour:1,generatorKind:'normal',enabled:false,autonomyHours:24,capacityWatts:2400,targets:[]};
   case 'power_outlet':return {slots:2,radiusFt:5,capacityRayos:6};
   case 'power_strip':return {slots:4,radiusFt:5,capacityRayos:6,rayos:0};
   case 'water_main':return {rangeFt:120,flowLpm:50,networkId:'main'};
   case 'water_valve':return {opened:true};
   case 'water_outlet':return {radiusFt:5,flowLpm:12,networkId:'main'};
   case 'drain_outlet':return {radiusFt:5,networkId:'main'};
   case 'drain_main':return {rangeFt:120,networkId:'main'};
   case 'router':return {wifiRadiusFt:120,ethernetLengthFt:60,wifiPassword:'',rayos:1,watts:18,assignedRoomIds:[],propertyId:''};
   case 'ethernet_port':return {cableLengthFt:30};
   case 'landline_phone':return {routerId:''};
   case 'phone_charger':return {chargePerHour:25,rayos:1,watts:12};
   default:return {};
  }
 }
 function ensureState(state){
  if(!state||typeof state!=='object')throw Error('El estado de partida es obligatorio');
  const s=state.services&&typeof state.services==='object'?state.services:{};
  for(const prop of ['damage','enabled','wifiKeys','connections','meters','usage','generators','ats','fuelTanks']){
   if(!s[prop]||typeof s[prop]!=='object'||Array.isArray(s[prop]))s[prop]={};
  }
  if(!Array.isArray(s.calls))s.calls=[];
  if(!s.contracts||typeof s.contracts!=='object')s.contracts={};
  for(const name of ['internet','landline','mobile','water','electricity'])
   if(!['active','suspended'].includes(s.contracts[name]))s.contracts[name]='active';
  for(const name of ['kwh','waterLiters','drainLiters'])s.meters[name]=Math.max(0,number(s.meters[name]));
  if(!s.powerHistory||typeof s.powerHistory!=='object'||Array.isArray(s.powerHistory))s.powerHistory={};
  const h=s.powerHistory;
  h.currentHour=h.currentHour==null?null:Number.isFinite(Number(h.currentHour))?Number(h.currentHour):null;
  h.currentKwh=Math.max(0,number(h.currentKwh));
  h.currentWatts=Math.max(0,number(h.currentWatts));
  h.elapsedMinutes=Math.max(0,number(h.elapsedMinutes));
  if(!Array.isArray(h.history))h.history=[];
  if(h.history.length>48)h.history=h.history.slice(-48);
  state.services=s;
  state.phone=state.phone&&typeof state.phone==='object'?state.phone:{};
  state.phone.battery=clamp(number(state.phone.battery,100),0,100);
  if(typeof state.phone.placedAt!=='string')state.phone.placedAt='';
  return s;
 }
 function createRuntime(project,state={},options={}){
  const s=ensureState(state),floors=Array.isArray(project?.floors)?project.floors:[];
   const exteriorGrid=(typeof globalThis!=='undefined'?globalThis.FHExteriorGrid:null)?.createRuntime(project,state)||null;
  const feetPerCell=Math.max(.1,number(project?.units?.feetPerCell,5));
  const graphs=floors.map(f=>wallGraph(f.items||[]));
  const powerGraphs=floors.map(f=>wallGraph(f.items||[],{doorways:true}));
  const elements=floors.map(f=>f.items||[]);
  const pcStations=new Set(elements.flatMap((items,f)=>options.isPc?items.filter(it=>options.isPc(it,f)).map(id):[]));
  const powerRouteCache=floors.map(()=>new Map());
  const cableDistance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
  const zoneFor=(f,it)=>{
   const room=(elements[f]||[]).find(r=>r.type==='room'&&(r.roomId||r.id)===it.roomId)||roomOn(f,it);
   const zone=String(it.zoneId||'');
   // Older elevator inspectors used "main" as a placeholder, not a real assignment.
   // A declared main circuit is still respected; otherwise inherit the room's circuit.
   if(it.type==='elevator'&&(!zone||zone==='main'&&!(powerScopes[f]||[]).some(c=>c.zoneId==='main')))return String(room?.zoneId||'');
   return String(zone||room?.zoneId||'');
  };
  function powerRoute(f,panel,target){
   if(!powerGraphs[f])return null;
   const panelLeadFt=LIMITS[panel.breakerType||'medium']?.rangeFt||180;
   const leadFt=(target.type==='light_fixture'&&!target.wallId)||target.type==='elevator'?Math.max(0,number(target.service?.maxWallDistanceFt,panelLeadFt)):3.25;
   const key=[number(panel.x),number(panel.y),number(target.x),number(target.y),leadFt,panelLeadFt].join(':');
   const cache=powerRouteCache[f];
   if(cache.has(key))return cache.get(key);
   const path=powerGraphs[f].routeDetailed(point(panel),point(target),Math.max(leadFt,panelLeadFt)/feetPerCell);
   let result=null;
   if(path&&path.fromGap*feetPerCell<=panelLeadFt+1e-7&&path.toGap*feetPerCell<=leadFt+1e-7){
    const lead=(a,b)=>[{x:a.x,y:a.y},{x:b.x,y:a.y},{x:b.x,y:b.y}];
    const points=[...lead(point(panel),path.from),...path.points,...lead(path.to,point(target))]
     .filter((p,i,all)=>i===0||dist(p,all[i-1])>1e-7);
    const feet=(path.length+cableDistance(point(panel),path.from)+cableDistance(path.to,point(target)))*feetPerCell;
    result={...path,points,feet};
   }
   if(cache.size>4000)cache.clear();cache.set(key,result);return result;
  }
  const routeCache=floors.map(()=>new Map());
  const route=(f,a,b,maxGapFt=3.25)=>{
   if(!graphs[f])return Infinity;
   const p=point(a),q=point(b),key=[p.x,p.y,q.x,q.y,maxGapFt].join(':');
   const cache=routeCache[f];
   if(cache.has(key))return cache.get(key);
   const result=graphs[f].route(p,q,maxGapFt/feetPerCell)*feetPerCell;
   if(cache.size>4000)cache.clear();
   cache.set(key,result);
   return result;
  };
  const barriers=(f,a,b)=>graphs[f]?.wallsBetween(point(a),point(b))||0;
  const values=(f,type)=>elements[f]?.filter(it=>it.type===type)||[];
  const itemAt=(f,itemId)=>(elements[f]||[]).find(it=>id(it)===String(itemId))||null;
  const polygonHas=(poly,p)=>{
   if(!Array.isArray(poly)||poly.length<3)return false;
   let inside=false;
   for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if(onSegment(p,a,b,.035))return true;
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
   }
   return inside;
  };
  function areaHas(area,p){
   if(Array.isArray(area.spans)&&area.spans.length)
    return area.spans.some(sp=>p.x>=sp.x-.035&&p.x<=sp.x+sp.w+.035&&p.y>=sp.y-.035&&p.y<=sp.y+sp.h+.035);
   if(Array.isArray(area.cells)&&area.cells.length)
    return area.cells.some(cell=>p.x>=cell.x-.035&&p.x<=cell.x+1.035&&p.y>=cell.y-.035&&p.y<=cell.y+1.035);
   return p.x>=area.x-.035&&p.x<=area.x+number(area.w)+.035&&
    p.y>=area.y-.035&&p.y<=area.y+number(area.h)+.035;
  }
  const roomOn=(f,p)=>(elements[f]||[]).find(it=>it.type==='room'&&areaHas(it,point(p)))||null;
  const scopeFor=(f,router)=>{
   const floorId=floors[f]?.id;
   const properties=(project.properties||[]).filter(p=>p.floorId===floorId&&Array.isArray(p.polygon));
   const insideProperties=properties.filter(p=>polygonHas(p.polygon,point(router)));
   if(insideProperties.length>1)return {allow:()=>false,kind:'ambiguousProperty'};
   const parcel=router.propertyId?properties.find(p=>p.id===router.propertyId):insideProperties[0];
   if(router.propertyId&&!parcel)return {allow:()=>false,kind:'invalidProperty'};
   if(parcel){
    if(!polygonHas(parcel.polygon,point(router)))return {allow:()=>false,kind:'outsideProperty'};
    return {kind:'property',id:parcel.id,contains:p=>polygonHas(parcel.polygon,p),allow:edge=>{
     const a=edge.a,b=edge.b,p={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
     const dx=b.x-a.x,dy=b.y-a.y,len=Math.max(1e-7,Math.hypot(dx,dy));
     return [p,{x:p.x-dy/len*.06,y:p.y+dx/len*.06},
      {x:p.x+dy/len*.06,y:p.y-dx/len*.06}].some(q=>polygonHas(parcel.polygon,q));
    }};
   }
   const rooms=(elements[f]||[]).filter(it=>it.type==='room');
   if(!rooms.length)return {kind:'legacy',allow:()=>true};
   const origin=router.roomId||roomOn(f,router)?.roomId||roomOn(f,router)?.id;
   const assigned=Array.isArray(router.assignedRoomIds)?router.assignedRoomIds:
    String(router.assignedRoomIds||'').split(',').map(v=>v.trim()).filter(Boolean);
   const ids=new Set([origin,...assigned].filter(Boolean));
   const permitted=rooms.filter(room=>ids.has(room.roomId||room.id)||ids.has(room.id));
   if(!permitted.length)return {kind:'noRoom',allow:()=>false};
   return {kind:'rooms',ids,allow:edge=>{
    const a=edge.a,b=edge.b,p={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.max(1e-7,Math.hypot(dx,dy));
    return [p,{x:p.x-dy/len*.08,y:p.y+dx/len*.08},
     {x:p.x+dy/len*.08,y:p.y-dx/len*.08}].some(q=>permitted.some(room=>areaHas(room,q)));
   }};
  };
  // Los cables de datos y las instalaciones físicas comparten los mismos tramos.
  function wiredRoute(f,router,target,maxFt=60){
   if(!router||!target||f<0||!graphs[f])return null;
   const scope=scopeFor(f,router);
   if(['invalidProperty','outsideProperty','ambiguousProperty','noRoom'].includes(scope.kind))return null;
   if(scope.kind==='property'&&!scope.contains(point(target)))return null;
   if(scope.kind==='rooms'&&target.roomId&&!scope.ids.has(target.roomId))return null;
   if(scope.kind==='property'&&target.propertyId&&scope.id!==target.propertyId)return null;
   const gapFt=Math.max(0,number(router.ethernetLeadFt,10));
   const path=graphs[f].routeDetailed(point(router),point(target),gapFt/feetPerCell,scope.allow);
   if(!path)return null;
   const feet=(path.length+path.fromGap+path.toGap)*feetPerCell;
   return feet<=maxFt?{...path,feet,scope:scope.kind}:null;
  }
  const wifiMaterials=floors.map(f=>(f.items||[]).filter(it=>
   ['wall','red_wall','half_wall','door','peephole_door','window'].includes(it.type)&&it.a&&it.b));
  const wirelessLoss=(f,a,b)=>{
   const impacts=[];
   for(const wall of wifiMaterials[f]||[]){
    const hit=intersection(a,b,wall.a,wall.b);
    if(!hit||dist(hit,a)<.1||dist(hit,b)<.1)continue;
    const loss=wall.type==='red_wall'?11:wall.type==='wall'?3:
     wall.type==='half_wall'?1.5:wall.type==='window'?3:
     wall.open===true?0:wall.type==='peephole_door'?7:4;
    const priority=['door','peephole_door','window'].includes(wall.type)?3:1;
    const same=impacts.find(v=>dist(v.point,hit)<.07);
    if(same){if(priority>=same.priority){same.loss=loss;same.priority=priority;}}
    else impacts.push({point:hit,loss,priority});
   }
   return impacts.reduce((sum,v)=>sum+v.loss,0);
  };
  const powerScopes=floors.map(()=>[]);
  floors.forEach((floor,ownerFloor)=>{
   for(const panel of values(ownerFloor,'breaker_panel')){
    const list=Array.isArray(panel.circuits)&&panel.circuits.length?panel.circuits:[{zoneId:panel.zoneId||'main'}];
    for(const spec of list){
     const f=spec.floorId?floors.findIndex(floor=>floor.id===spec.floorId):Number.isInteger(spec.floorIndex)?spec.floorIndex:ownerFloor;
     if(!powerScopes[f]||f!==ownerFloor&&panel.powerSource===undefined)continue;
     powerScopes[f].push({panel,ownerFloor,f,spec,circuitId:String(spec.id||spec.zoneId||panel.zoneId||'main'),
      powerFlag:String(spec.powerFlag||panel.powerFlag||''),zoneId:String(spec.zoneId||spec.id||panel.zoneId||'main'),
      breakerFlag:'power_breaker:'+id(panel)+':'+String(spec.id||spec.zoneId||panel.zoneId||'main'),
      verticalFt:f===ownerFloor?0:Math.abs(number(floors[f].elevationFt)-number(floor.elevationFt)),
      rangeFt:rangeFor(panel,spec),capacityWatts:Math.max(0,number(spec.capacityWatts??panel.capacityWatts,LIMITS[panel.breakerType||'medium']?.capacityWatts||2400))});
    }
   }
  });
  const flagOn=k=>s.enabled[k]!==false&&state.flags?.[k]!==false;
  // Logical generator feeds terminate at a real panel/circuit on the destination floor.
  // Physical routing from that panel to equipment remains the existing powerRoute.
  const generators=elements.flatMap((items,f)=>items.filter(it=>it.type==='generator').map(it=>({it,f,key:floors[f].id+':'+id(it)})));
  for(const g of generators){
   const old=s.generators[g.key];
   s.generators[g.key]={enabled:old?.enabled===undefined?g.it.enabled===true:old.enabled===true,
    remainingHours:Math.max(0,number(old?.remainingHours,Math.max(0,number(g.it.autonomyHours,24)))),running:false,
    ...(g.it.generatorKind==='emergency'&&exteriorGrid?.hasTransformers?{
     electricChargeHours:exteriorGrid.initialElectricCharge(g.it,old,!!g.it.tankId)}:{})};
  }
  const accessories=elements.flatMap((items,f)=>items.filter(it=>['generator_ats','generator_tank'].includes(it.type))
   .map(it=>({it,f,key:floors[f].id+':'+id(it)})));
  function linked(g,kind){
   const prefix=kind==='generator_ats'?'ats':'tank',itemId=String(g.it[prefix+'Id']||'');
   if(!itemId)return null;
   const floorId=g.it[prefix+'FloorId']||floors[g.f].id;
   const matches=accessories.filter(a=>a.it.type===kind&&id(a.it)===itemId&&floors[a.f].id===floorId);
   const owners=generators.filter(other=>String(other.it[prefix+'Id']||'')===itemId&&
    (other.it[prefix+'FloorId']||floors[other.f].id)===floorId);
   return matches.length===1&&owners.length===1?matches[0]:false;
  }
  for(const a of accessories){
   if(a.it.type==='generator_tank'){
    const capacity=Math.max(0,number(a.it.capacityLiters));
    const initial=clamp(number(a.it.initialFuelLiters,capacity),0,capacity);
    s.fuelTanks[a.key]={liters:clamp(number(s.fuelTanks[a.key]?.liters,initial),0,capacity)};
   }else{
    const old=s.ats[a.key];
    s.ats[a.key]={outage:old?.outage===true,mode:['automatic','failed','manual'].includes(old?.mode)?old.mode:'idle',
     episode:Math.max(0,Math.floor(number(old?.episode)))};
   }
  }
  const electricBackup=g=>g.it.generatorKind==='emergency'&&exteriorGrid?.hasTransformers===true;
  function fuelReserveHours(g,tank){
   if(!tank||tank===false)return 0;
   const rate=Math.max(0,number(g.it.fuelLitersPerHour,1));
   return rate>0&&number(s.damage[id(tank.it)])<100?s.fuelTanks[tank.key].liters/rate:0;
  }
  function reserveHours(g){
   const tank=linked(g,'generator_tank');
   if(tank===false)return 0;
   const electric=electricBackup(g)?Math.max(0,number(s.generators[g.key].electricChargeHours)):0;
   return tank?fuelReserveHours(g,tank)+electric:electricBackup(g)?electric:s.generators[g.key].remainingHours;
  }
  function activeReserveHours(g){
   const tank=linked(g,'generator_tank');
   const fuel=fuelReserveHours(g,tank);
   return fuel>0?fuel:reserveHours(g);
  }
  const baseReady=g=>s.generators[g.key].enabled&&reserveHours(g)>0&&
   Math.max(0,number(g.it.capacityWatts,2400))>0&&number(s.damage[id(g.it)])<100;
  function primaryAvailable(feed){
   if(feed.circuit.panel.powerSource!==undefined){
    const main=explicitFeed(feed.circuit,false);
    return main===null?utilityAvailable(feed.f,feed.circuit):main===false?exteriorAutoAvailable(feed.f,feed.circuit):!!main&&baseReady(main.g);
   }
   const sample={roomId:feed.target.roomId||'',x:feed.circuit.panel.x,y:feed.circuit.panel.y};
   const normal=feeds.find(other=>other.g.it.generatorKind!=='emergency'&&feedMatches(other,feed.f,feed.circuit,sample));
   return normal?baseReady(normal.g):mainAvailable(feed.f);
  }
  function syncATS(){
   for(const a of accessories.filter(a=>a.it.type==='generator_ats')){
    const owner=generators.find(g=>g.it.generatorKind==='emergency'&&linked(g,'generator_ats')===a);
    const outage=!!owner&&feeds.some(feed=>feed.g===owner&&!primaryAvailable(feed));
    const saved=s.ats[a.key];
    if(outage&&!saved.outage){
     saved.outage=true;saved.episode++;saved.mode=(options.random||Math.random)()<.1?'failed':'automatic';
     s.atsRevision=Math.max(0,number(s.atsRevision))+1;
    }else if(!outage&&saved.outage){
     saved.outage=false;saved.mode='idle';s.atsRevision=Math.max(0,number(s.atsRevision))+1;
    }
   }
  }
  function atsStatus(f,it){
   syncATS();const a=accessories.find(a=>a.f===f&&id(a.it)===id(it)&&a.it.type==='generator_ats');
   if(!a)return null;
   const owner=generators.find(g=>linked(g,'generator_ats')===a&&g.it.generatorKind==='emergency');
   return {...s.ats[a.key],connected:!!owner,damaged:number(s.damage[id(it)])>=100};
  }
  function activateATSManual(f,itemId){
   const it=itemAt(f,itemId),status=it&&atsStatus(f,it);
   if(!status?.connected||!status.outage||status.damaged)return false;
   const a=accessories.find(a=>a.f===f&&id(a.it)===String(itemId));
   s.ats[a.key].mode='manual';s.atsRevision=Math.max(0,number(s.atsRevision))+1;allocationCache=null;return true;
  }
  function tankStatus(f,it){
   const a=accessories.find(a=>a.f===f&&id(a.it)===id(it)&&a.it.type==='generator_tank');if(!a)return null;
   const owner=generators.find(g=>linked(g,'generator_tank')===a);
   return {liters:s.fuelTanks[a.key].liters,capacityLiters:Math.max(0,number(it.capacityLiters)),
    connected:!!owner,remainingHours:owner?reserveHours(owner):0};
  }
  const feeds=generators.flatMap(g=>(Array.isArray(g.it.targets)?g.it.targets:[]).flatMap((target,i)=>{
   if(!target||typeof target!=='object')return [];
   const f=floors.findIndex(floor=>floor.id===target.floorId);
   const circuit=(powerScopes[f]||[]).find(c=>id(c.panel)===String(target.panelId)&&c.circuitId===String(target.circuitId));
   const room=target.roomId&&(elements[f]||[]).find(r=>r.type==='room'&&String(r.roomId||r.id)===String(target.roomId));
   if(!circuit||circuit.panel.powerSource!==undefined||target.roomId&&!room)return [];
   return [{g,target,f,circuit,key:g.key+':'+i,priority:number(target.priority)}];
  }));
  // Explicit panel references survive deletion of a generator; they never fall back to the utility.
  const explicitFeeds=[];
  for(const scopes of powerScopes)for(const c of scopes){
   if(c.panel.powerSource===undefined)continue;
   for(const backup of [false,true]){
    const ref=backup?c.panel.backupSource:c.panel.powerSource;
    if(ref?.kind!=='generator')continue;
    const g=generators.find(g=>floors[g.f].id===ref.floorId&&id(g.it)===String(ref.itemId));
    if(!g||((g.it.generatorKind==='emergency')!==backup))continue;
    const horizontal=(Math.abs(number(g.it.x)-number(c.panel.x))+Math.abs(number(g.it.y)-number(c.panel.y)))*feetPerCell;
    const cableFeet=horizontal+Math.abs(number(floors[g.f].elevationFt)-number(floors[c.ownerFloor].elevationFt));
    if(cableFeet>Math.max(0,number(c.panel.sourceCableFt,90))+1e-7)continue;
    explicitFeeds.push({g,f:c.f,circuit:c,key:g.key+':panel:'+floors[c.ownerFloor].id+':'+id(c.panel)+':'+c.circuitId,
     target:{floorId:floors[c.f].id,panelId:id(c.panel),circuitId:c.circuitId},priority:number(c.spec.priority),backup,cableFeet});
   }
  }
  feeds.push(...explicitFeeds);
  function explicitFeed(c,backup=false){
   const ref=backup?c.panel.backupSource:c.panel.powerSource;
   if(!backup&&ref?.kind==='utility')return null;
   if(ref?.kind!=='generator')return false;
   return explicitFeeds.find(feed=>feed.circuit===c&&feed.backup===backup)||false;
  }
  let allocationCache=null;
  const roomIdFor=(f,it)=>String(it.roomId||roomOn(f,it)?.roomId||roomOn(f,it)?.id||'');
  const feedMatches=(feed,f,c,it)=>feed.f===f&&feed.circuit===c&&
   (!feed.target.roomId||roomIdFor(f,it)===String(feed.target.roomId));
  const generatorReady=g=>{
   if(!baseReady(g))return false;
   if(g.it.generatorKind!=='emergency')return true;
   const ats=linked(g,'generator_ats');
   return ats!==false&&(!ats||number(s.damage[id(ats.it)])<100&&['automatic','manual'].includes(s.ats[ats.key].mode));
  };
  function mainAvailable(f){
   return s.contracts.electricity==='active'&&flagOn('power_global')&&flagOn('power_floor:'+String(floors[f]?.id||f));
  }
  function utilityAvailable(f,c){
   if(!mainAvailable(f)||!mainAvailable(c.ownerFloor))return false;
   // Un mapa que no usa Electricidad 03 conserva el suministro previo.
   if(!exteriorGrid?.hasTransformers)return true;
   return exteriorGrid.panelConnection(c.ownerFloor,c.panel)?.powered===true;
  }
  function exteriorAutoAvailable(f,c){
   // No anula las fuentes explícitas del panel salvo permiso del creador.
   return c.panel.exteriorAutoConnect===true&&exteriorGrid?.hasTransformers===true&&utilityAvailable(f,c);
  }
  function exteriorChargeAvailable(g){
   if(!exteriorGrid?.hasTransformers||!mainAvailable(g.f))return false;
   if(exteriorGrid.generatorConnection(g.f,g.it)?.powered)return true;
   // Un respaldo alejado del poste se recarga a través del breaker del edificio.
   return powerScopes.some(scopes=>scopes.some(c=>{
    if(c.panel.powerSource!==undefined&&c.panel.powerSource?.kind!=='utility'&&c.panel.exteriorAutoConnect!==true)return false;
    if(!utilityAvailable(c.f,c))return false;
    const a=point(g.it),b=point(c.panel),horizontal=dist(a,b)*feetPerCell;
    const vertical=Math.abs(number(floors[g.f].elevationFt)-number(floors[c.ownerFloor].elevationFt));
    return Math.hypot(horizontal,vertical)<=Math.max(0,number(c.panel.sourceCableFt,90));
   }));
  }
  function circuitOn(f,c){
   const panel=c.panel;
   if(panel.enabled===false||panel.on===false||number(s.damage[id(panel)])>=100||
     !flagOn('power_zone:'+c.zoneId)||!flagOn(id(panel))||!flagOn(c.breakerFlag))return false;
   return (!panel.powerFlag||flagOn(panel.powerFlag))&&(!c.powerFlag||flagOn(c.powerFlag));
  }
  function feedFor(f,c,it){
   syncATS();
   if(c.panel.powerSource!==undefined){
    const primary=explicitFeed(c);
    if(primary&&generatorReady(primary.g))return primary;
    if(primary===null&&utilityAvailable(f,c))return null;
    if(primary===false&&exteriorAutoAvailable(f,c))return null;
    const backup=explicitFeed(c,true);return backup&&generatorReady(backup.g)?backup:false;
   }
   const matching=feeds.filter(feed=>feedMatches(feed,f,c,it));
   const normal=matching.find(feed=>feed.g.it.generatorKind!=='emergency');
   if(normal&&generatorReady(normal.g))return normal;
   // An explicit normal generator replaces the utility feed for its destinations.
   const primary=normal?false:utilityAvailable(f,c);
   if(primary)return null;
   return matching.find(feed=>feed.g.it.generatorKind==='emergency'&&generatorReady(feed.g))||false;
  }
  function sourcesFor(f,it,zone='',uncapped=false){
   zone=zone||zoneFor(f,it);
   if(!zone)return [];
   const sources=[];
   for(const c of powerScopes[f]||[]){
    if(c.zoneId!==zone||!circuitOn(f,c))continue;
    const feed=feedFor(f,c,it);
    if(feed===false)continue;
    const path=powerRoute(f,c.panel,it),verticalFt=c.verticalFt||0,sourceFeet=feed?.cableFeet||0;
    if(path&&path.feet+verticalFt<=c.rangeFt+1e-7)sources.push({...c,
     route:{...path,verticalFt,feet:path.feet+verticalFt,sourceFloorId:floors[c.ownerFloor].id,targetFloorId:floors[f].id},
     distributionRangeFt:c.rangeFt,rangeFt:c.rangeFt+sourceFeet,feet:path.feet+verticalFt+sourceFeet,feed:feed||null});
   }
   sources.sort((a,b)=>Number(!!a.feed)-Number(!!b.feed)||a.feet-b.feet);
   // Keep assignment stable when shedding a destination; do not silently move
   // its load onto a second generator whose capacity was reserved elsewhere.
   if(!uncapped&&sources[0]?.feed&&!generatorAllocation().accepted.has(sources[0].feed.key))return [];
   return sources;
  }
  function sourceFor(f,it,zone=''){return sourcesFor(f,it,zone)[0]||null}
  function generatorAllocation(){
   syncATS();
   if(!generators.length)return {accepted:new Set(),running:new Set(),loads:new Map()};
   // Cache only across unchanged simulation state; remaining hours do not affect
   // allocation until empty, so a running generator does not rebuild per lamp/frame.
   const signature=JSON.stringify([s.atsRevision,state.flags,s.enabled,s.contracts.electricity,s.damage,s.usage,state.phone.placedAt,state.phone.battery>=100,
    generators.map(g=>[s.generators[g.key].enabled,reserveHours(g)>0,g.it.capacityWatts,g.it.fuelLitersPerHour])]);
   if(allocationCache?.signature===signature)return allocationCache;
   const snapshot=electrical(true),loads=new Map();
   for(let f=0;f<floors.length;f++)for(const it of elements[f]){
    if(!requiresPower(it)||!drawingPower(it)||number(s.damage[id(it)])>=100)continue;
    const source=['light_fixture','elevator'].includes(it.type)?sourcesFor(f,it,'',true)[0]:snapshot.supplies.get(f+':'+id(it));
    if(source?.feed)loads.set(source.feed.key,(loads.get(source.feed.key)||0)+watts(it,true));
   }
   const accepted=new Set(),running=new Set();
   for(const g of generators){
    let capacity=Math.max(0,number(g.it.capacityWatts,2400));
    const candidates=feeds.filter(feed=>feed.g===g&&circuitOn(feed.f,feed.circuit)&&generatorReady(g)&&
     feedFor(feed.f,feed.circuit,{roomId:feed.target.roomId||'',x:feed.circuit.panel.x,y:feed.circuit.panel.y})===feed)
     .sort((a,b)=>b.priority-a.priority||a.key.localeCompare(b.key));
    for(const feed of candidates){
     const demand=loads.get(feed.key)||0;
     if(demand>capacity+1e-7)continue;
     accepted.add(feed.key);capacity-=demand;running.add(g.key);
    }
   }
   allocationCache={signature,accepted,running,loads};return allocationCache;
  }
  function panelStatus(ownerFloor,panel){
   syncATS();const circuits=powerScopes.flat().filter(c=>c.ownerFloor===ownerFloor&&c.panel===panel).map(c=>{
    const feed=feedFor(c.f,c,{x:panel.x,y:panel.y}),on=circuitOn(c.f,c);
    const powered=on&&c.verticalFt<=c.rangeFt+1e-7&&feed!==false&&(!feed||generatorAllocation().accepted.has(feed.key));
    return {circuitId:c.circuitId,zoneId:c.zoneId,floorId:floors[c.f].id,powered,verticalFt:c.verticalFt,rangeFt:c.rangeFt,
     source:feed?{kind:'generator',itemId:id(feed.g.it),floorId:floors[feed.g.f].id,label:feed.g.it.label||id(feed.g.it),backup:!!feed.backup}:feed===null?{kind:'utility'}:{kind:'none'},
     sourceFeet:feed?.cableFeet||0};
   });
   return {legacy:panel.powerSource===undefined,circuits,powered:circuits.some(c=>c.powered)};
  }
  function generatorCircuitPowered(f,zone=''){
   return feeds.some(feed=>feed.f===f&&(!zone||feed.circuit.zoneId===zone)&&generatorAllocation().accepted.has(feed.key));
  }
  function generatorStatus(f,it){
   const g=generators.find(g=>g.f===f&&id(g.it)===id(it));if(!g)return null;
   const saved=s.generators[g.key],allocation=generatorAllocation();
   saved.remainingHours=reserveHours(g);saved.running=allocation.running.has(g.key);
   const tank=linked(g,'generator_tank');
   return {...saved,electricChargeHours:electricBackup(g)?saved.electricChargeHours:null,electricCapacityHours:electricBackup(g)?exteriorGrid.electricCapacity(g.it):null,fuelRemainingHours:tank?fuelReserveHours(g,tank):null,fuelLiters:tank?s.fuelTanks[tank.key].liters:null,fuelLinked:!!g.it.tankId,kind:g.it.generatorKind==='emergency'?'emergency':'normal',
    suppliedTargets:feeds.filter(feed=>feed.g===g&&allocation.accepted.has(feed.key)).length,
    watts:feeds.filter(feed=>feed.g===g&&allocation.accepted.has(feed.key)).reduce((n,feed)=>n+(allocation.loads.get(feed.key)||0),0)};
  }
  function setGeneratorEnabled(f,itemId,enabled){
   const g=generators.find(g=>g.f===f&&id(g.it)===String(itemId));if(!g)return false;
   s.generators[g.key].enabled=!!enabled;allocationCache=null;generatorStatus(f,g.it);return true;
  }
  // El minijuego sólo autoriza esta mutación tras resolverse por completo.
  function repairDamage(f,itemId){
   const it=itemAt(f,itemId),allowed=new Set([
    'breaker_panel','generator','generator_ats','power_outlet','power_strip',
    'light_switch','router','ethernet_port','landline_phone','phone_charger'
   ]);
   if(!it||!allowed.has(it.type))return {ok:false,reason:'unsupported'};
   const before=Number(s.damage[id(it)]);
   if(!Number.isFinite(before)||before<=0)return {ok:false,reason:'notDamaged'};
   s.damage[id(it)]=0;
   allocationCache=null;
   return {ok:true,itemId:id(it),before,after:0};
  }
  function active(it){return s.enabled[id(it)]!==false&&it.enabled!==false&&it.on!==false;}
  function rayos(it){return Math.max(0,number(it.rayos,it.service?.rayos??0));}
  function watts(it,generated=false){
   const configured=it.watts!==undefined||it.service?.watts!=null||it.rayos!==undefined||it.service?.rayos!==undefined;
   // Keep the legacy calculation (including null handling) on utility power.
   // Generators use the inspector's 200 W default only for missing load data.
   return generated&&!configured?200:Math.max(0,number(it.watts,it.service?.watts??rayos(it)*200));
  }
  function drawingPower(it){
   if(!active(it))return false;
   if(generators.length&&it.type==='light_fixture'){
    const f=elements.findIndex(items=>items.includes(it)),room=roomIdFor(f,it);
    if(room&&state.flags?.['light_room:'+floors[f]?.id+':'+room]===false)return false;
   }
   if(it.type==='phone_charger'&&(state.phone.placedAt!==id(it)||state.phone.battery>=100))return false;
   return it.service?.onDemand!==true||s.usage[id(it)]===true;
  }
  function requiresPower(it){return needsElectricity(it)||pcStations.has(id(it));}
  function requiresWater(it){return it.service?.requiresWater===true;}
  function candidates(f,it,types){
   const electrical=types.includes('power_outlet')||types.includes('power_strip');
   // El alcance eléctrico lo determina el cable del aparato; agua y drenaje
   // conservan el alcance de sus tomas para no alterar sus redes.
   const reachFt=electrical?Math.max(0,number(it.service?.powerCableFt??it.powerCableFt??it.radiusFt,5)):null;
   return (elements[f]||[]).filter(x=>types.includes(x.type)&&x.id!==it.id&&
    (!((types.includes('water_outlet')?it.waterOutletId:types.includes('drain_outlet')?it.drainOutletId:it.outletId))||
     String(types.includes('water_outlet')?it.waterOutletId:types.includes('drain_outlet')?it.drainOutletId:it.outletId)===String(x.id))&&
    dist(point(it),point(x))*feetPerCell<=(electrical?reachFt:Math.max(0,number(x.radiusFt,5)))&&
    barriers(f,it,x)===0)
    .sort((a,b)=>dist(point(a),point(it))-dist(point(b),point(it))||id(a).localeCompare(id(b)));
  }
  function electrical(uncapped=false){
   const bindings=new Map(),used=new Map(),loads=new Map(),supplies=new Map(),supplyOptions=new Map();
   for(let f=0;f<floors.length;f++){
    const outlets=values(f,'power_outlet'),strips=values(f,'power_strip');
    const claim=(it,sources)=>{
     for(const source of candidates(f,it,sources)){
      const k=f+':'+id(source),count=used.get(k)||0;
      // Dos conexiones por enchufe; una regleta enchufada ocupa una de ellas.
      const limit=source.type==='power_outlet'?2:Math.max(1,Math.floor(number(source.slots,4)));
      if(count>=limit)continue;
      if(source.type==='power_strip'&&(!bindings.has(k)||!active(source)))continue;
      if(source.type==='power_outlet'&&!active(source))continue;
      const choices=source.type==='power_outlet'?sourcesFor(f,source,zoneFor(f,source),true):supplyOptions.get(k)||[];
      const zone=zoneFor(f,it),cableFeet=cableDistance(point(source),point(it))*feetPerCell;
      const eligible=choices.map(supply=>({...supply,feet:supply.feet+cableFeet}))
       .filter(supply=>(!zone||zone===supply.zoneId)&&supply.feet<=supply.rangeFt+1e-7&&
        (!supply.feed?.target.roomId||roomIdFor(f,it)===String(supply.feed.target.roomId)))
       .sort((a,b)=>a.feet-b.feet);
      const supply=eligible[0];if(!supply)continue;
      if(number(s.damage[id(source)])>=100)continue;
      bindings.set(f+':'+id(it),source);
      supplies.set(f+':'+id(it),supply);supplyOptions.set(f+':'+id(it),eligible);
      used.set(k,count+1);
      if(drawingPower(it))loads.set(k,(loads.get(k)||0)+rayos(it));
      return source;
     }
     return null;
    };
    for(const strip of strips.slice().sort((a,b)=>id(a).localeCompare(id(b))))claim(strip,['power_outlet']);
    for(const it of (elements[f]||[]).filter(x=>requiresPower(x)&&!['power_strip','light_fixture','elevator'].includes(x.type)).sort((a,b)=>id(a).localeCompare(id(b))))
     claim(it,['power_strip','power_outlet']);
    // La regleta no crea potencia: propagar la suma de sus aparatos al enchufe.
    for(const strip of strips){
     const parent=bindings.get(f+':'+id(strip));
     if(parent&&active(strip)){
      const childLoad=loads.get(f+':'+id(strip))||0;
      const k=f+':'+id(parent);loads.set(k,(loads.get(k)||0)+childLoad);
     }
    }
   }
   if(!uncapped&&generators.length){
    const accepted=generatorAllocation().accepted;
    for(const [key,supply] of supplies)if(supply.feed&&!accepted.has(supply.feed.key)){bindings.delete(key);supplies.delete(key);}
    // If a strip lost its feed, every downstream connection loses it too.
    for(const [key,parent] of bindings){
     const f=Number(key.slice(0,key.indexOf(':')));
     if(parent.type==='power_strip'&&!bindings.has(f+':'+id(parent))){bindings.delete(key);supplies.delete(key);}
    }
    used.clear();loads.clear();
    for(const [key,parent] of bindings){
     const f=Number(key.slice(0,key.indexOf(':'))),it=itemAt(f,key.slice(key.indexOf(':')+1)),parentKey=f+':'+id(parent);
     used.set(parentKey,(used.get(parentKey)||0)+1);
     if(drawingPower(it))loads.set(parentKey,(loads.get(parentKey)||0)+rayos(it));
    }
    for(let f=0;f<floors.length;f++)for(const strip of values(f,'power_strip')){
     const parent=bindings.get(f+':'+id(strip));
     if(parent&&active(strip)){const key=f+':'+id(parent);loads.set(key,(loads.get(key)||0)+(loads.get(f+':'+id(strip))||0));}
    }
   }
   return {bindings,used,loads,supplies};
  }
  function electricalStatus(f,it,snapshot){
   const key=f+':'+id(it);
   if(['light_fixture','elevator'].includes(it.type)){
    const source=it.type==='elevator'&&(!active(it)||number(s.damage[id(it)])>=100)?null:sourceFor(f,it);
    return {connected:!!source,powered:!!source,via:source?.panel.id||'',generated:!!source?.feed,feet:source?.feet??null};
   }
   if(it.type==='power_outlet'){
    const source=active(it)&&number(s.damage[id(it)])<100?sourceFor(f,it):null;
    return {connected:!!source,powered:!!source,breakerId:source?.panel.id||'',generated:!!source?.feed,feet:source?.feet??null};
   }
   const parent=snapshot.bindings.get(key);
   if(!requiresPower(it)&&it.type!=='power_strip')return {connected:false,powered:false,required:false};
   const supply=snapshot.supplies.get(key),powered=!!parent&&number(s.damage[id(it)])<100;
   return {connected:!!parent,powered,via:parent?.id||'',breakerId:supply?.panel.id||'',generated:!!supply?.feed,feet:supply?.feet??null};
  }
  function waterStatus(f,it){
   if(!requiresWater(it)&&it.type!=='water_outlet')return {connected:true,water:true,legacy:true};
   if(s.contracts.water!=='active')return {connected:false,water:false};
   const mains=values(f,'water_main').filter(x=>active(x));
   const valves=values(f,'water_valve');
   const valveOpen=(main,port)=>{
    const assigned=String(port.valveId||main.valveId||'');
    return valves.every(v=>{
     if(assigned&&id(v)!==assigned&&(!main.networkId||v.networkId!==main.networkId))return true;
     if(!assigned&&(!v.networkId||v.networkId!==port.networkId&&v.networkId!==main.networkId))return true;
     return (s.enabled[id(v)]??v.opened)!==false;
    });
   };
   if(it.type==='water_outlet'){
    const linked=mains.some(main=>{
     const direct=!main.networkId||!it.networkId||main.networkId===it.networkId;
     const branch=valves.some(v=>v.networkId===it.networkId&&
      String(v.parentNetworkId||it.parentNetworkId||'')===String(main.networkId||''));
     return (direct||branch)&&valveOpen(main,it)&&
      route(f,main,it)<=Math.max(0,number(main.rangeFt,120));
    });
    return {connected:linked,water:linked};
   }
   const ports=candidates(f,it,['water_outlet']);
   for(const port of ports)if(waterStatus(f,port).water)return {connected:true,water:true,via:port.id};
   return {connected:false,water:false};
  }
  // 2.4 GHz: modelo jugable dBm, sin prometer medidas físicas exactas.
  // La parcela restringe los CABLES, jamás amplifica la cobertura de radio.
  // El drenaje necesita una salida principal unida físicamente a las tomas.
  function drainStatus(f,it){
   if(!it||it.service?.drains===false)return {connected:false,draining:false};
   if(it.type==='drain_outlet'){
    if(it.drainMode==='automatic'&&active(it)&&number(s.damage[id(it)])<100)
     return {connected:true,draining:true,mode:'exterior'};
    const connected=values(f,'drain_main').some(main=>active(main)&&
     (!main.networkId||!it.networkId||main.networkId===it.networkId)&&
     route(f,it,main)<=Math.max(0,number(main.rangeFt,120)));
    return {connected,draining:connected};
   }
   for(const out of candidates(f,it,['drain_outlet']))
    if(drainStatus(f,out).draining)return {connected:true,draining:true,via:id(out)};
   return {connected:false,draining:false};
  }
  function wifiAt(f,x,y,passwordById=s.wifiKeys,sharedElectrical=null,onlyRouterId=""){
   if(!floors[f])return [];
   const nearby=[],snap=sharedElectrical||electrical(),pos={x:number(x),y:number(y)};
   for(let level=0;level<floors.length;level++)for(const r of values(level,'router')){
    if(onlyRouterId&&id(r)!==onlyRouterId)continue;
    if(!electricalStatus(level,r,snap).powered||!active(r))continue;
    const ft=feetPerCell*dist(pos,point(r));
    const floorFeet=Math.abs(number(floors[level]?.elevationFt,level*12)-
     number(floors[f]?.elevationFt,f*12));
    const distanceFt=Math.hypot(ft,floorFeet);
    if(distanceFt>Math.max(1,number(r.wifiRadiusFt,120)))continue;
    const meters=Math.max(1,distanceFt*.3048);
    const materialLoss=level===f?wirelessLoss(f,pos,point(r)):
     .5*(wirelessLoss(f,pos,point(r))+wirelessLoss(level,pos,point(r)));
    const floorsLost=Math.abs(f-level)*14;
    const dbm=Math.round((-40-22*Math.log10(meters)-materialLoss-floorsLost)*10)/10;
    const bars=dbm>=-67?3:dbm>=-75?2:dbm>=-82?1:0;
    if(!bars)continue;
    const requiresPassword=!!String(r.wifiPassword||'');
    const authenticated=!requiresPassword||passwordById[id(r)]===r.wifiPassword;
    const speedFactor=bars===3?1:bars===2?.65:.25;
    nearby.push({routerId:id(r),floor:level,bars,dbm,
     signal:bars/3,speedFactor,latencyMultiplier:bars===3?1:bars===2?1.6:3.5,
     requiresPassword,authenticated,online:authenticated&&s.contracts.internet==='active'});
   }
   return nearby.sort((a,b)=>b.dbm-a.dbm||a.routerId.localeCompare(b.routerId));
  }
  // Vista del editor: un único cálculo eléctrico para todas las muestras del mapa.
  function wifiSampler(routerId){
   const selectedId=String(routerId||""),sharedElectrical=electrical();
   return (f,x,y)=>wifiAt(f,x,y,s.wifiKeys,sharedElectrical,selectedId)
    .find(network=>network.routerId===selectedId)||null;
  }
  function connectWifi(routerId,password){
   for(let f=0;f<floors.length;f++){
    const router=itemAt(f,routerId);
    if(router?.type!=='router')continue;
    if(String(password||'')!==String(router.wifiPassword||''))return false;
    s.wifiKeys[String(routerId)]=String(password||'');return true;
   }
   return false;
  }
   function ethernetAssignments(f){
    const snap=electrical(),routers=values(f,'router').filter(r=>active(r)&&
     electricalStatus(f,r,snap).powered).sort((a,b)=>id(a).localeCompare(id(b)));
    const ports=values(f,'ethernet_port');
    const hasNewPorts=ports.some(p=>['toma_rj45','toma_rj45_doble'].includes(p.utilitySkin));
    const clients=(elements[f]||[]).filter(it=>it.type==='landline_phone'||it.service?.internetMode==='ethernet')
     .sort((a,b)=>id(a).localeCompare(id(b)));
    const bindings=new Map(),portUsed=new Map(),routerUsed=new Map();
    for(const client of clients){
     if(!active(client)||number(s.damage[id(client)])>=100)continue;
     if(client.type==='landline_phone'&&(s.contracts.landline!=='active'||!client.routerId))continue;
     for(const router of routers){
      if(client.routerId&&String(client.routerId)!==id(router))continue;
      const routerLimit=Math.max(0,number(router.ethernetPorts,router.utilitySkin==='gateway_red'?5:Infinity));
      if((routerUsed.get(id(router))||0)>=routerLimit)continue;
      const candidates=ports.filter(p=>active(p)&&number(s.damage[id(p)])<100&&
       (!client.ethernetPortId||String(client.ethernetPortId)===id(p))&&
       (!p.routerId||String(p.routerId)===id(router)));
      let assigned=false;
      for(const port of candidates){
       const slots=Math.max(1,Math.floor(number(port.portSlots,
        port.utilitySkin==='toma_rj45_doble'?2:port.utilitySkin==='toma_rj45'?1:Infinity)));
       if((portUsed.get(id(port))||0)>=slots)continue;
       if(!wiredRoute(f,router,port,Math.max(0,number(router.ethernetLengthFt,60))))continue;
       const lead=Math.max(0,number(client.cableLengthFt,number(port.cableLengthFt,30)));
       if(dist(point(port),point(client))*feetPerCell>lead||barriers(f,client,port)>0)continue;
       bindings.set(id(client),{routerId:id(router),portId:id(port),method:'ethernet'});
       portUsed.set(id(port),(portUsed.get(id(port))||0)+1);
       routerUsed.set(id(router),(routerUsed.get(id(router))||0)+1);
       assigned=true;break;
      }
      const routerHasNewPorts=ports.some(p=>['toma_rj45','toma_rj45_doble'].includes(p.utilitySkin)&&
       (!p.routerId||String(p.routerId)===id(router))&&
       wiredRoute(f,router,p,Math.max(0,number(router.ethernetLengthFt,60))));
      if(!assigned&&!routerHasNewPorts&&!client.ethernetPortId&&
       wiredRoute(f,router,client,Math.max(0,number(client.cableLengthFt,number(router.ethernetLengthFt,60))))){
       bindings.set(id(client),{routerId:id(router),method:'ethernet'});
       routerUsed.set(id(router),(routerUsed.get(id(router))||0)+1);
       assigned=true;
      }
      if(assigned)break;
     }
    }
    return {bindings,portUsed,routerUsed,hasNewPorts};
   }
   function internetFor(f,it){
    if(s.contracts.internet!=='active')return {online:false,reason:'service'};
    if(it.type==='router')
     return {online:electricalStatus(f,it,electrical()).powered&&active(it),method:'router'};
    if(it.service?.internetMode==='wifi'){
     const networks=wifiAt(f,number(it.x),number(it.y));
     const best=networks.find(net=>net.online);
     return best?{online:true,method:'wifi',routerId:best.routerId,
      bars:best.bars,dbm:best.dbm,speedFactor:best.speedFactor,latencyMultiplier:best.latencyMultiplier}:
      {online:false,reason:'noSignal'};
    }
    if(it.type==='ethernet_port'){
     if(!active(it)||number(s.damage[id(it)])>=100)return {online:false,reason:'broken'};
     for(const router of values(f,'router')){
      if(it.routerId&&String(it.routerId)!==id(router))continue;
      if(!active(router)||!electricalStatus(f,router,electrical()).powered)continue;
      if(wiredRoute(f,router,it,Math.max(0,number(router.ethernetLengthFt,60))))
       return {online:true,method:'ethernet',routerId:id(router),speedFactor:1};
     }
     return {online:false,reason:'noLink'};
    }
    if(it.service?.internetMode!=='ethernet')return {online:false,reason:'noLink'};
    const link=ethernetAssignments(f).bindings.get(id(it));
    return link?{online:true,...link,speedFactor:1}:{online:false,reason:'noLink'};
   }
   function landlineFor(f,it){
    if(it.type!=='landline_phone'||s.contracts.landline!=='active')return false;
    const router=itemAt(f,it.routerId);
    if(!router||router.type!=='router'||!electricalStatus(f,it,electrical()).powered||
       !internetFor(f,router).online)return false;
    const cable=ethernetAssignments(f);
    return cable.bindings.get(id(it))?.routerId===id(router);
   }
  function mobileFor(){
   return s.contracts.mobile==='active'&&state.phone.battery>0&&s.mobileSignal!==false&&!state.phone.placedAt;
  }
  function dial(kind,f,source,to){
   const target=String(to||'').trim().slice(0,80);
   if(!target)return {ok:false,reason:'number'};
   if(kind==='mobile'&&!mobileFor())return {ok:false,reason:'mobileUnavailable'};
   if(kind==='fixed'&&!landlineFor(f,source))return {ok:false,reason:'landlineUnavailable'};
   let found=null;
   for(let level=0;level<floors.length&&!found;level++){
    for(const phone of values(level,'landline_phone')){
     if(String(phone.phoneNumber||'')!==target||!landlineFor(level,phone))continue;
     found={kind:'fixed',floor:level,phoneId:id(phone),routerId:String(phone.routerId)};
     break;
    }
   }
   if(!found&&target===String(state.phone.phoneNumber||state.phone.accountId||'')&&mobileFor())
    found={kind:'mobile'};
   if(!found)return {ok:false,reason:'noAnswer'};
   const now=number(state.clock?.minutes);
   const from=kind==='fixed'?String(source.phoneNumber||source.id):String(state.phone.phoneNumber||state.phone.accountId||'jugador');
   const event={from,to:target,at:now,target:found.kind,phoneId:found.phoneId||'',routerId:found.routerId||''};
   s.calls.push({...event,direction:'outgoing',status:'ringing'});
   s.calls.push({...event,direction:'incoming',status:'ringing'});
   if(s.calls.length>200)s.calls.splice(0,s.calls.length-200);
   return {ok:true,event,target:found};
  }
  function chargePhone(f,chargerId){
   const it=itemAt(f,chargerId);
   if(it?.type!=='phone_charger'||state.phone.placedAt||!electricalStatus(f,it,electrical()).powered)return false;
   state.phone.placedAt=chargerId;state.phone.placedFloor=f;return true;
  }
  function takePhone(){
   if(!state.phone.placedAt)return false;
   state.phone.placedAt='';delete state.phone.placedFloor;return true;
  }
  function useWaterFixture(f,it){
   if(!it||!requiresWater(it)||!waterStatus(f,it).water)return {ok:false,reason:'noWater'};
   const mode=String(it.service?.waterMode|| (it.type==='toilet'?'pulse':'continuous'));
   if(mode==='pulse'){
    const liters=Math.max(0,number(it.service?.litersPerUse,6));
    s.meters.waterLiters+=liters;
    if(it.service?.drains!==false&&drainStatus(f,it).draining)s.meters.drainLiters+=liters;
    return {ok:true,mode,liters};
   }
   s.usage[id(it)]=!s.usage[id(it)];
   return {ok:true,mode,opened:!!s.usage[id(it)]};
  }
  function setUsage(itemId,using){
   if(!itemId)return false;s.usage[String(itemId)]=!!using;return true;
  }
  function tickStep(realSeconds=0,minutesPerSecond=1){
   const seconds=clamp(number(realSeconds),0,60)*Math.max(0,number(minutesPerSecond,1))*60;
   if(!seconds)return;
   const allocation=generatorAllocation();
   const snap=electrical();
   let usedWatts=0,waterLiters=0,drainLiters=0;
   for(let f=0;f<floors.length;f++){
    for(const it of elements[f]||[]){
     const key=f+':'+id(it);
     if(['power_outlet','power_strip'].includes(it.type)){
      const loading=snap.loads.get(key)||0,capacity=Math.max(0,number(it.capacityRayos,6));
      if(loading>capacity){
       const damage=Math.max(0,number(s.damage[id(it)]));
       s.damage[id(it)]=clamp(damage+seconds/60*(loading-capacity)/Math.max(1,capacity),0,100);
      }
      continue;
     }
     if(requiresPower(it)&&drawingPower(it)){
      const power=electricalStatus(f,it,snap);
      if(power.powered)usedWatts+=watts(it,power.generated);
     }
     if(requiresWater(it)&&active(it)&&s.usage[id(it)]===true&&waterStatus(f,it).water){
      const liters=Math.max(0,number(it.service?.flowLpm))*seconds/60;
      waterLiters+=liters;
      if(it.service?.drains!==false&&drainStatus(f,it).draining)drainLiters+=liters;
     }
    }
   }
   const deltaKwh=usedWatts*seconds/3600000;
   s.meters.kwh+=deltaKwh;
   const power=s.powerHistory;
   const minutes=Number(state.clock?.minutes);
   if(!Number.isFinite(minutes))power.elapsedMinutes+=seconds/60;
   const hour=Math.floor(Math.max(0,Number.isFinite(minutes)?minutes:power.elapsedMinutes)/60)%24;
   if(power.currentHour!==hour){
    if(power.currentHour!==null){
     power.history.push({hour:power.currentHour,kwh:power.currentKwh});
     if(power.history.length>48)power.history.splice(0,power.history.length-48);
    }
    power.currentHour=hour;power.currentKwh=0;
   }
   power.currentWatts=usedWatts;power.currentKwh+=deltaKwh;
   s.meters.waterLiters+=waterLiters;
   s.meters.drainLiters+=drainLiters;
   if(state.phone.placedAt){
    const f=Math.floor(number(state.phone.placedFloor,-1));
    const charger=itemAt(f,state.phone.placedAt);
    if(!charger){takePhone();}
    else if(charger.type==='phone_charger'&&electricalStatus(f,charger,snap).powered)
     state.phone.battery=clamp(state.phone.battery+Math.max(0,number(charger.chargePerHour,25))*seconds/3600,0,100);
   }else{
    state.phone.battery=clamp(state.phone.battery-Math.max(0,number(options.phoneDrainPerHour,0.5))*seconds/3600,0,100);
   }
   // Consume game hours only while supplying selected destinations.
   for(const g of generators){
    const saved=s.generators[g.key];saved.running=allocation.running.has(g.key);
    if(saved.running){
     const tank=linked(g,'generator_tank');
     if(tank&&fuelReserveHours(g,tank)>0){
      s.fuelTanks[tank.key].liters=Math.max(0,s.fuelTanks[tank.key].liters-seconds/3600*Math.max(0,number(g.it.fuelLitersPerHour,1)));
     }else if(electricBackup(g))exteriorGrid.changeElectricCharge(saved,g.it,seconds/3600,'discharge');
     else if(!tank)saved.remainingHours=Math.max(0,saved.remainingHours-seconds/3600);
    }else if(electricBackup(g)&&exteriorChargeAvailable(g)&&number(s.damage[id(g.it)])<100){
     // El transformador sólo recarga energía eléctrica, incluso con tanque conectado.
     exteriorGrid.changeElectricCharge(saved,g.it,seconds/3600,'charge');
    }
    saved.remainingHours=reserveHours(g);
   }
  }
  function tick(realSeconds=0,minutesPerSecond=1){
   const rate=Math.max(0,number(minutesPerSecond,1));
   let remaining=clamp(number(realSeconds),0,60);
   if(!rate||!remaining)return;
   // Split exactly at exhaustion: no frame receives energy after the reserve is empty.
   while(remaining>1e-9){
    const allocation=generatorAllocation();
    const limits=generators.filter(g=>allocation.running.has(g.key)).map(g=>activeReserveHours(g)*60/rate);
    const step=Math.min(remaining,...limits);
    if(step<=1e-9){for(const g of generators)if(allocation.running.has(g.key)&&activeReserveHours(g)*60/rate<=1e-9){const tank=linked(g,'generator_tank');if(tank&&fuelReserveHours(g,tank)>0)s.fuelTanks[tank.key].liters=0;else if(electricBackup(g))s.generators[g.key].electricChargeHours=0;else {if(tank)s.fuelTanks[tank.key].liters=0;s.generators[g.key].remainingHours=0;}}allocationCache=null;continue;}
    tickStep(step,rate);remaining-=step;
   }
   for(const g of generators)generatorStatus(g.f,g.it);
  }
  function statusFor(f,it){
   const snap=electrical(),power=electricalStatus(f,it,snap),water=waterStatus(f,it);
   const network=it.type==='ethernet_port'?ethernetAssignments(f):null;
   return {power,water,drain:drainStatus(f,it),internet:internetFor(f,it),broken:number(s.damage[id(it)])>=100,
    loadingRayos:snap.loads.get(f+':'+id(it))||0,
    usedSlots:it.type==='ethernet_port'?network.portUsed.get(id(it))||0:snap.used.get(f+':'+id(it))||0,
    portSlots:it.type==='ethernet_port'?Math.max(1,number(it.portSlots,it.utilitySkin==='toma_rj45_doble'?2:1)):undefined,
    slotCapacity:it.type==='power_outlet'?2:it.type==='power_strip'?Math.max(1,Math.floor(number(it.slots,4))):undefined};
  }
  function setService(name,active){if(!Object.prototype.hasOwnProperty.call(s.contracts,name))return false;s.contracts[name]=active?'active':'suspended';return true;}
  syncATS();
  return Object.freeze({state:s,exteriorGrid,phone:state.phone,graphs,powerGraphs,powerRoute,zoneFor,requiresPower,point,itemAt,defaultsFor,sourceFor,wiredRoute,scopeFor,
   panelStatus,atsStatus,activateATSManual,tankStatus,generatorStatus,setGeneratorEnabled,repairDamage,generatorCircuitPowered,statusFor,electrical,waterStatus,drainStatus,wifiAt,wifiSampler,connectWifi,internetFor,landlineFor,mobileFor,
   chargePhone,takePhone,useWaterFixture,setUsage,dial,tick,setService,feetPerCell});
 }
 return Object.freeze({INFRA,defaultsFor,wallGraph,ensureState,createRuntime,requiresPower:needsElectricity,LIMITS,rangeFor});
});
