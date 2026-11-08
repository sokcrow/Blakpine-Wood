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
 const INFRA=new Set(['power_outlet','power_strip','water_main','water_valve','water_outlet','drain_outlet','router','ethernet_port','landline_phone','phone_charger']);
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
  const walls=(items||[]).filter(it=>WALLS.has(it.type)&&it.a&&it.b&&dist(it.a,it.b)>0.001);
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
    const u=add(p),v=add(q),edge={a:p,b:q,u,v,len};
    edges.push(edge);adj.get(u).push({to:v,cost:len});adj.get(v).push({to:u,cost:len});
   }
  }
  const anchor=p=>{
   let best=null,d=Infinity;
   for(const edge of edges){
    const q=project(p,edge.a,edge.b),v=dist(p,q);
    if(v<d){d=v;best={edge,p:q,gap:v};}
   }
   return best;
  };
  const walk=(from,to)=>{
   if(from===to)return 0;
   const costs=new Map([[from,0]]),done=new Set(),queue=[[0,from]];
   while(queue.length){
    queue.sort((a,b)=>b[0]-a[0]);
    const [cost,k]=queue.pop();
    if(done.has(k))continue;
    if(k===to)return cost;
    done.add(k);
    for(const n of adj.get(k)||[]){
     const next=cost+n.cost;
     if(next<(costs.get(n.to)??Infinity)){costs.set(n.to,next);queue.push([next,n.to]);}
    }
   }
   return Infinity;
  };
  function route(a,b,maxGap=.65){
   const start=anchor(a),end=anchor(b);
   if(!start||!end||start.gap>maxGap||end.gap>maxGap)return Infinity;
   let best=start.edge===end.edge?dist(start.p,end.p):Infinity;
   for(const sa of ['u','v'])for(const eb of ['u','v']){
    const sk=start.edge[sa],ek=end.edge[eb];
    const v=dist(start.p,vertices.get(sk))+walk(sk,ek)+dist(end.p,vertices.get(ek));
    if(v<best)best=v;
   }
   return best;
  }
  function wallsBetween(a,b){
   let count=0;
   for(const w of walls){
    const hit=intersection(a,b,w.a,w.b);
    if(hit&&dist(hit,a)>.12&&dist(hit,b)>.12)count++;
   }
   return count;
  }
  return {route,wallsBetween,wallCount:walls.length};
 }
 function defaultsFor(type){
  switch(type){
   case 'power_outlet':return {slots:2,radiusFt:5,capacityRayos:6};
   case 'power_strip':return {slots:4,radiusFt:5,capacityRayos:6,rayos:0};
   case 'water_main':return {rangeFt:120,flowLpm:50};
   case 'water_valve':return {opened:true};
   case 'water_outlet':return {radiusFt:5,flowLpm:12};
   case 'drain_outlet':return {radiusFt:5};
   case 'router':return {wifiRadiusFt:60,ethernetLengthFt:30,wifiPassword:'',rayos:1,watts:18};
   case 'ethernet_port':return {cableLengthFt:30};
   case 'landline_phone':return {routerId:''};
   case 'phone_charger':return {chargePerHour:25,rayos:1,watts:12};
   default:return {};
  }
 }
 function ensureState(state){
  if(!state||typeof state!=='object')throw Error('El estado de partida es obligatorio');
  const s=state.services&&typeof state.services==='object'?state.services:{};
  for(const prop of ['damage','enabled','wifiKeys','connections','meters']){
   if(!s[prop]||typeof s[prop]!=='object'||Array.isArray(s[prop]))s[prop]={};
  }
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
  const powerScopes=floors.map((floor,f)=>{
   const circuits=[];
   for(const panel of values(f,'breaker_panel')){
    const list=Array.isArray(panel.circuits)&&panel.circuits.length?panel.circuits:[{zoneId:panel.zoneId||'main'}];
    for(const c of list)circuits.push({panel,zoneId:String(c.zoneId||c.id||panel.zoneId||'main'),
     rangeFt:Math.max(0,number(c.rangeFt??panel.rangeFt,LIMITS[panel.breakerType||'medium']?.rangeFt||60)),
     capacityWatts:Math.max(0,number(c.capacityWatts??panel.capacityWatts,LIMITS[panel.breakerType||'medium']?.capacityWatts||2400))});
   }
   return circuits;
  });
  const flagOn=k=>s.enabled[k]!==false&&state.flags?.[k]!==false;
  function circuitOn(f,c){
   const panel=c.panel;
   if(s.contracts.electricity!=='active'||!flagOn('power_global')||
     !flagOn('power_floor:'+String(floors[f]?.id||f))||
     !flagOn('power_zone:'+c.zoneId)||!flagOn(id(panel)))return false;
   return !panel.powerFlag||flagOn(panel.powerFlag);
  }
  function sourceFor(f,it,zone=''){
   const candidates=powerScopes[f]||[];
   let best=null,d=Infinity;
   for(const c of candidates){
    if(zone&&c.zoneId!==zone)continue;
    if(!circuitOn(f,c))continue;
    const gapFt=it.type==='light_fixture'&&it.service?.requiresPower===true?
     Math.max(0,number(it.service.maxWallDistanceFt,30)):3.25;
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
  function requiresPower(it){return POWER_NEEDS.has(it.type)||it.service?.requiresPower===true;}
  function requiresWater(it){return it.service?.requiresWater===true;}
  function candidates(f,it,types){
   return (elements[f]||[]).filter(x=>types.includes(x.type)&&x.id!==it.id&&
    (!it.outletId||String(it.outletId)===String(x.id))&&
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
      if(active(it))loads.set(k,(loads.get(k)||0)+rayos(it));
      return source;
     }
     return null;
    };
    for(const strip of strips.slice().sort((a,b)=>id(a).localeCompare(id(b))))claim(strip,['power_outlet']);
    for(const it of (elements[f]||[]).filter(x=>requiresPower(x)&&x.type!=='power_strip').sort((a,b)=>id(a).localeCompare(id(b))))
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
    const linked=mains.some(main=>valveOpen(main,it)&&route(f,main,it)<=Math.max(0,number(main.rangeFt,120)));
    return {connected:linked,water:linked};
   }
   const ports=candidates(f,it,['water_outlet']);
   for(const port of ports)if(waterStatus(f,port).water)return {connected:true,water:true,via:port.id};
   return {connected:false,water:false};
  }
  function wifiAt(f,x,y,passwordById=s.wifiKeys){
   const nearby=[];
   const snap=electrical();
   for(const r of values(f,'router')){
    if(!electricalStatus(f,r,snap).powered||!active(r))continue;
    const feet=Math.hypot(number(r.x)-x,number(r.y)-y)*feetPerCell+barriers(f,{x,y},r)*6;
    if(feet>Math.max(0,number(r.wifiRadiusFt,60)))continue;
    const unlocked=!String(r.wifiPassword||'')||passwordById[id(r)]===r.wifiPassword;
    nearby.push({routerId:id(r),signal:clamp(1-feet/Math.max(1,number(r.wifiRadiusFt,60)),0,1),
     authenticated:unlocked,online:unlocked&&s.contracts.internet==='active'});
   }
   return nearby.sort((a,b)=>b.signal-a.signal);
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
   if(it.type==='router'){
    return {online:electricalStatus(f,it,electrical()).powered&&active(it),method:'router'};
   }
   if(it.service?.internetMode==='wifi'){
    const wifi=wifiAt(f,number(it.x),number(it.y));
    return {online:wifi.some(w=>w.online),method:'wifi'};
   }
   if(it.service?.internetMode!=='ethernet'&&it.type!=='ethernet_port')return {online:false,reason:'noLink'};
   const routers=values(f,'router').filter(r=>!it.routerId||id(r)===String(it.routerId));
   for(const router of routers){
    if(!electricalStatus(f,router,electrical()).powered||!active(router))continue;
    const link=it.type==='ethernet_port'?route(f,router,it):dist(point(router),point(it))*feetPerCell;
    const limit=Math.max(0,number(it.cableLengthFt,number(router.ethernetLengthFt,30)));
    if(link<=limit&&(it.type==='ethernet_port'||barriers(f,it,router)===0))
     return {online:true,method:'ethernet',routerId:id(router)};
    if(it.type==='ethernet_port')continue;
    // Toma Ethernet en la pared: cable visible solo en datos, no en gameplay.
    for(const port of values(f,'ethernet_port')){
     if(port.routerId&&String(port.routerId)!==id(router))continue;
     if(dist(point(port),point(it))*feetPerCell>limit||barriers(f,it,port)>0)continue;
     if(route(f,router,port)<=Math.max(0,number(port.cableLengthFt,number(router.ethernetLengthFt,30))))
      return {online:true,method:'ethernet',routerId:id(router),portId:id(port)};
    }
   }
   return {online:false,reason:'noLink'};
  }
  function landlineFor(f,it){
   if(it.type!=='landline_phone'||s.contracts.landline!=='active')return false;
   const router=itemAt(f,it.routerId);
   return !!router&&router.type==='router'&&internetFor(f,router).online;
  }
  function mobileFor(){
   return s.contracts.mobile==='active'&&state.phone.battery>0&&s.mobileSignal!==false&&!state.phone.placedAt;
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
     if(requiresPower(it)&&active(it)&&electricalStatus(f,it,snap).powered)usedWatts+=watts(it);
     if(requiresWater(it)&&active(it)&&waterStatus(f,it).water){
      const liters=Math.max(0,number(it.service?.flowLpm))*seconds/60;
      waterLiters+=liters;
      if(it.service?.drains!==false&&candidates(f,it,['drain_outlet']).length)drainLiters+=liters;
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
   return {power,water,internet:internetFor(f,it),broken:number(s.damage[id(it)])>=100,
    loadingRayos:snap.loads.get(f+':'+id(it))||0,usedSlots:snap.used.get(f+':'+id(it))||0};
  }
  function setService(name,active){if(!Object.prototype.hasOwnProperty.call(s.contracts,name))return false;s.contracts[name]=active?'active':'suspended';return true;}
  return Object.freeze({state:s,phone:state.phone,graphs,point,itemAt,defaultsFor,sourceFor,
   statusFor,electrical,waterStatus,wifiAt,connectWifi,internetFor,landlineFor,mobileFor,
   chargePhone,takePhone,tick,setService,feetPerCell});
 }
 return Object.freeze({INFRA,defaultsFor,wallGraph,ensureState,createRuntime});
});