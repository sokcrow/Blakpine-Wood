/* Blakpine-Wood: infraestructura sin tarifas; compatible con forest-horror-map-v1.
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
 const INFRA=new Set(['power_outlet','power_strip','water_main','water_valve','water_outlet','drain_outlet','drain_main','router','ethernet_port','landline_phone','phone_charger']);
 const POWER_NEEDS=new Set(['router','phone_charger']);
 const WATER_NEEDS=new Set(['bath','toilet','kitchen']);
 const LIMITS={small:{rangeFt:30,capacityWatts:1200},medium:{rangeFt:60,capacityWatts:2400},large:{rangeFt:120,capacityWatts:4800}};
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const number=(n,fallback=0)=>Number.isFinite(Number(n))?Number(n):fallback;
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
 function wallGraph(items){
  const walls=(items||[]).filter(it=>WALL_PATHS.has(it.type)&&it.a&&it.b&&dist(it.a,it.b)>0.001);
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
  for(const prop of ['damage','enabled','wifiKeys','connections','meters','usage']){
   if(!s[prop]||typeof s[prop]!=='object'||Array.isArray(s[prop]))s[prop]={};
  }
  if(!Array.isArray(s.calls))s.calls=[];
  if(!s.contracts||typeof s.contracts!=='object')s.contracts={};
  for(const name of ['internet','landline','mobile','water','electricity'])
   if(!['active','suspended'].includes(s.contracts[name]))s.contracts[name]='active';
  for(const name of ['kwh','waterLiters','drainLiters'])s.meters[name]=Math.max(0,number(s.meters[name]));
  state.services=s;
  state.phone=state.phone&&typeof state.phone==='object'?state.phone:{};
  state.phone.battery=clamp(number(state.phone.battery,100),0,100);
  if(typeof state.phone.placedAt!=='string')state.phone.placedAt='';
  return s;
 }
 function createRuntime(project,state={},options={}){
  const s=ensureState(state),floors=Array.isArray(project?.floors)?project.floors:[];
  const feetPerCell=Math.max(.1,number(project?.units?.feetPerCell,5));
  const graphs=floors.map(f=>wallGraph(f.items||[]));
  const elements=floors.map(f=>f.items||[]);
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
  const powerScopes=floors.map((floor,f)=>{
   const circuits=[];
   for(const panel of values(f,'breaker_panel')){
    const list=Array.isArray(panel.circuits)&&panel.circuits.length?panel.circuits:[{zoneId:panel.zoneId||'main'}];
    for(const c of list)circuits.push({panel,powerFlag:String(c.powerFlag||panel.powerFlag||''),zoneId:String(c.zoneId||c.id||panel.zoneId||'main'),
     rangeFt:Math.max(0,number(c.rangeFt??panel.rangeFt,LIMITS[panel.breakerType||'medium']?.rangeFt||60)),
     capacityWatts:Math.max(0,number(c.capacityWatts??panel.capacityWatts,LIMITS[panel.breakerType||'medium']?.capacityWatts||2400))});
   }
   return circuits;
  });
  const flagOn=k=>s.enabled[k]!==false&&state.flags?.[k]!==false;
  function circuitOn(f,c){
   const panel=c.panel;
   if(panel.enabled===false||panel.on===false||number(s.damage[id(panel)])>=100||
     s.contracts.electricity!=='active'||!flagOn('power_global')||
     !flagOn('power_floor:'+String(floors[f]?.id||f))||
     !flagOn('power_zone:'+c.zoneId)||!flagOn(id(panel)))return false;
   return (!panel.powerFlag||flagOn(panel.powerFlag))&&(!c.powerFlag||flagOn(c.powerFlag));
  }
  function sourceFor(f,it,zone=''){
   if(it.type==='light_fixture'){
    zone=zone||it.zoneId||'';
    if(!zone){
     const room=(elements[f]||[]).find(r=>r.type==='room'&&(r.roomId||r.id)===it.roomId)||roomOn(f,it);
     zone=room?.zoneId||'';
    }
    if(!zone)return null;
   }
   const candidates=powerScopes[f]||[];
   let best=null,d=Infinity;
   for(const c of candidates){
    if(zone&&c.zoneId!==zone)continue;
    if(!circuitOn(f,c))continue;
    const gapFt=it.type==='light_fixture'&&!it.wallId?
     Math.max(0,number(it.service?.maxWallDistanceFt,30)):3.25;
    const feet=route(f,c.panel,it,gapFt);
    if(feet<=c.rangeFt&&feet<d){d=feet;best=c;}
   }
   return best;
  }
  function poweredOutlet(f,outlet){
   return !!outlet&&number(s.damage[id(outlet)])<100&&!!sourceFor(f,outlet,outlet.zoneId||'');
  }
  function active(it){return s.enabled[id(it)]!==false&&it.enabled!==false&&it.on!==false;}
  function rayos(it){return Math.max(0,number(it.rayos,it.service?.rayos??0));}
  function watts(it){return Math.max(0,number(it.watts,it.service?.watts??rayos(it)*200));}
  function drawingPower(it){
   if(!active(it))return false;
   if(it.type==='phone_charger'&&(state.phone.placedAt!==id(it)||state.phone.battery>=100))return false;
   return it.service?.onDemand!==true||s.usage[id(it)]===true;
  }
  function requiresPower(it){return POWER_NEEDS.has(it.type)||it.service?.requiresPower===true;}
  function requiresWater(it){return it.service?.requiresWater===true;}
  function candidates(f,it,types){
   return (elements[f]||[]).filter(x=>types.includes(x.type)&&x.id!==it.id&&
    (!((types.includes('water_outlet')?it.waterOutletId:types.includes('drain_outlet')?it.drainOutletId:it.outletId))||
     String(types.includes('water_outlet')?it.waterOutletId:types.includes('drain_outlet')?it.drainOutletId:it.outletId)===String(x.id))&&
    dist(point(it),point(x))*feetPerCell<=Math.max(0,number(x.radiusFt,5))&&
    barriers(f,it,x)===0)
    .sort((a,b)=>dist(point(a),point(it))-dist(point(b),point(it))||id(a).localeCompare(id(b)));
  }
  function electrical(){
   const bindings=new Map(),used=new Map(),loads=new Map();
   for(let f=0;f<floors.length;f++){
    const outlets=values(f,'power_outlet'),strips=values(f,'power_strip');
    const claim=(it,sources)=>{
     for(const source of candidates(f,it,sources)){
      const k=f+':'+id(source),count=used.get(k)||0;
      if(count>=Math.max(1,Math.floor(number(source.slots,2))))continue;
      if(source.type==='power_strip'&&!bindings.has(k))continue;
      if(source.type==='power_outlet'&&!poweredOutlet(f,source))continue;
      if(number(s.damage[id(source)])>=100)continue;
      bindings.set(f+':'+id(it),source);
      used.set(k,count+1);
      if(drawingPower(it))loads.set(k,(loads.get(k)||0)+rayos(it));
      return source;
     }
     return null;
    };
    for(const strip of strips.slice().sort((a,b)=>id(a).localeCompare(id(b))))claim(strip,['power_outlet']);
    for(const it of (elements[f]||[]).filter(x=>requiresPower(x)&&!['power_strip','light_fixture'].includes(x.type)).sort((a,b)=>id(a).localeCompare(id(b))))
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
   return {bindings,used,loads};
  }
  function electricalStatus(f,it,snapshot){
   const key=f+':'+id(it);
   if(it.type==='light_fixture'){
    const source=sourceFor(f,it);
    return {connected:!!source,powered:!!source,via:source?.panel.id||''};
   }
   if(it.type==='power_outlet')return {connected:poweredOutlet(f,it),powered:poweredOutlet(f,it)};
   const parent=snapshot.bindings.get(key);
   if(!requiresPower(it)&&it.type!=='power_strip')return {connected:true,powered:true,legacy:true};
   return {connected:!!parent,powered:!!parent,via:parent?.id||''};
  }
  function waterStatus(f,it){
   if(!requiresWater(it)&&it.type!=='water_outlet')return {connected:true,water:true,legacy:true};
   if(s.contracts.water!=='active')return {connected:false,water:false};
   const mains=values(f,'water_main').filter(x=>active(x));
   const valves=values(f,'water_valve');
   const valveOpen=(main,port)=>{
    const assigned=String(port.valveId||main.valveId||'');
    return valves.every(v=>{
     if(assigned&&id(v)!==assigned)return true;
     if(!assigned&&(!port.networkId||!v.networkId||v.networkId!==port.networkId))return true;
     return (s.enabled[id(v)]??v.opened)!==false;
    });
   };
   if(it.type==='water_outlet'){
    const linked=mains.some(main=>(!main.networkId||!it.networkId||main.networkId===it.networkId)&&
     valveOpen(main,it)&&route(f,main,it)<=Math.max(0,number(main.rangeFt,120)));
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
    const connected=values(f,'drain_main').some(main=>active(main)&&
     (!main.networkId||!it.networkId||main.networkId===it.networkId)&&
     route(f,it,main)<=Math.max(0,number(main.rangeFt,120)));
    return {connected,draining:connected};
   }
   for(const out of candidates(f,it,['drain_outlet']))
    if(drainStatus(f,out).draining)return {connected:true,draining:true,via:id(out)};
   return {connected:false,draining:false};
  }
  function wifiAt(f,x,y,passwordById=s.wifiKeys){
   if(!floors[f])return [];
   const nearby=[],snap=electrical(),pos={x:number(x),y:number(y)};
   for(let level=0;level<floors.length;level++)for(const r of values(level,'router')){
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
    const authenticated=!String(r.wifiPassword||'')||passwordById[id(r)]===r.wifiPassword;
    const speedFactor=bars===3?1:bars===2?.65:.25;
    nearby.push({routerId:id(r),floor:level,bars,dbm,
     signal:bars/3,speedFactor,latencyMultiplier:bars===3?1:bars===2?1.6:3.5,
     authenticated,online:authenticated&&s.contracts.internet==='active'});
   }
   return nearby.sort((a,b)=>b.dbm-a.dbm||a.routerId.localeCompare(b.routerId));
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
   if(it.service?.internetMode!=='ethernet'&&it.type!=='ethernet_port')
    return {online:false,reason:'noLink'};
   const routers=values(f,'router').filter(r=>!it.routerId||id(r)===String(it.routerId));
   for(const router of routers){
    if(!electricalStatus(f,router,electrical()).powered||!active(router))continue;
    const length=Math.max(0,number(it.cableLengthFt,number(router.ethernetLengthFt,60)));
    if(wiredRoute(f,router,it,length))return {online:true,method:'ethernet',routerId:id(router),speedFactor:1};
    if(it.type==='ethernet_port')continue;
    for(const port of values(f,'ethernet_port')){
     if(port.routerId&&String(port.routerId)!==id(router))continue;
     if(dist(point(port),point(it))*feetPerCell>length||barriers(f,it,port)>0)continue;
     if(wiredRoute(f,router,port,Math.max(0,number(router.ethernetLengthFt,60))))
      return {online:true,method:'ethernet',routerId:id(router),portId:id(port),speedFactor:1};
    }
   }
   return {online:false,reason:'noLink'};
  }
  function landlineFor(f,it){
   if(it.type!=='landline_phone'||s.contracts.landline!=='active')return false;
   const router=itemAt(f,it.routerId);
   return !!router&&router.type==='router'&&internetFor(f,router).online&&
    !!wiredRoute(f,router,it,Math.max(0,number(it.cableLengthFt,number(router.ethernetLengthFt,60))));
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
  function tick(realSeconds=0,minutesPerSecond=1){
   const seconds=clamp(number(realSeconds),0,60)*Math.max(0,number(minutesPerSecond,1))*60;
   if(!seconds)return;
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
     if(requiresPower(it)&&drawingPower(it)&&electricalStatus(f,it,snap).powered)usedWatts+=watts(it);
     if(requiresWater(it)&&active(it)&&s.usage[id(it)]===true&&waterStatus(f,it).water){
      const liters=Math.max(0,number(it.service?.flowLpm))*seconds/60;
      waterLiters+=liters;
      if(it.service?.drains!==false&&drainStatus(f,it).draining)drainLiters+=liters;
     }
    }
   }
   s.meters.kwh+=usedWatts*seconds/3600000;
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
  }
  function statusFor(f,it){
   const snap=electrical(),power=electricalStatus(f,it,snap),water=waterStatus(f,it);
   return {power,water,drain:drainStatus(f,it),internet:internetFor(f,it),broken:number(s.damage[id(it)])>=100,
    loadingRayos:snap.loads.get(f+':'+id(it))||0,usedSlots:snap.used.get(f+':'+id(it))||0};
  }
  function setService(name,active){if(!Object.prototype.hasOwnProperty.call(s.contracts,name))return false;s.contracts[name]=active?'active':'suspended';return true;}
  return Object.freeze({state:s,phone:state.phone,graphs,point,itemAt,defaultsFor,sourceFor,wiredRoute,scopeFor,
   statusFor,electrical,waterStatus,drainStatus,wifiAt,connectWifi,internetFor,landlineFor,mobileFor,
   chargePhone,takePhone,useWaterFixture,setUsage,dial,tick,setService,feetPerCell});
 }
 return Object.freeze({INFRA,defaultsFor,wallGraph,ensureState,createRuntime});
});
