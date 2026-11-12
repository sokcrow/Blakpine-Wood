/* Blakpine-Wood · Agua potable 01.
 * Topología hidráulica opcional para mapas v1: sin Three.js ni DOM.
 * FHServices sigue siendo la fuente de verdad para contratos, medidores y consumo.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHWaterPotable=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const FIXTURES=new Set([
  'inodoro_clasico','inodoro_antiguo','lavabo_pedestal','lavabo_gabinete',
  'fregadero_mueble','mingitorio_pared','banera_clasica','banera_patas',
  'plato_ducha','cabina_ducha','regadera_pared'
 ]);
 const SOURCE_TYPES=new Set(['water_main','water_cistern','water_tinaco']);
 const WALLS=new Set(['wall','red_wall','property_wall','window']);
 const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
 const num=(n,f=0)=>Number.isFinite(Number(n))?Number(n):f;
 const pos=x=>({x:num(x?.x),y:num(x?.y)});
 const distance=(a,b)=>Math.hypot(num(a.x)-num(b.x),num(a.y)-num(b.y));
 const name=it=>String(it?.networkId||'principal');
 const owner=it=>String(it?.buildingId||it?.propertyId||'');
 const compatible=(a,b)=>(name(a)===name(b)||name(a)==='*'||name(b)==='*')&&
  (!owner(a)||!owner(b)||owner(a)===owner(b));
 const isFixture=it=>!!it&&it.service?.requiresWater!==false&&
  (FIXTURES.has(it.modelId)||it.service?.requiresWater===true);
 const isTank=it=>it?.type==='water_cistern'||it?.type==='water_tinaco';
 const tankKey=(floor,it)=>String(floor.id)+':'+String(it.id);
 const leadFt=it=>isTank(it)?Math.max(0,num(it.pipeLeadFt,10)):
  it?.type==='water_main'?Math.max(0,num(it.pipeLeadFt,3.25)):Math.max(0,num(it?.pipeLeadFt,3.25));
 function collinear(a,b,c,d){
  const vx=b.x-a.x,vy=b.y-a.y,wx=d.x-c.x,wy=d.y-c.y;
  const len=Math.hypot(vx,vy),len2=Math.hypot(wx,wy);
  if(len<.01||len2<.01||Math.abs(vx*wy-vy*wx)>len*len2*.015)return null;
  const nx=-vy/len,ny=vx/len;
  if(Math.abs((c.x-a.x)*nx+(c.y-a.y)*ny)>.035||Math.abs((d.x-a.x)*nx+(d.y-a.y)*ny)>.035)return null;
  const t=p=>((p.x-a.x)*vx+(p.y-a.y)*vy)/len;
  const start=Math.max(0,Math.min(t(c),t(d))),end=Math.min(len,Math.max(t(c),t(d)));
  if(end-start<.1)return null;
  return {x:a.x+(vx/len)*(start+end)/2,y:a.y+(vy/len)*(start+end)/2};
 }
 function createRuntime(project,services,wallGraph){
  const floors=Array.isArray(project?.floors)?project.floors:[];
  const ft=Math.max(.1,num(project?.units?.feetPerCell,5));
  const enabled=project?.plumbing?.enabled===true||
   floors.some(f=>(f.items||[]).some(isTank));
  if(!enabled)return Object.freeze({enabled:false,isFixture,diagnostics:()=>({routes:[],coldFeet:0})});
  if(typeof wallGraph!=='function')throw Error('Agua potable: falta wallGraph');
  const graphs=floors.map(f=>wallGraph(f.items||[]));
  const nodes=[],links=[],itemNodes=new Map(),sources=[],ports=[],tanks=[];
  const add=(f,it,kind,p=pos(it))=>{
   const node={f,it,kind,p,index:nodes.length};
   nodes.push(node);links.push([]);
   if(it?.id)itemNodes.set(f+':'+String(it.id),node);
   return node;
  };
  for(let f=0;f<floors.length;f++)for(const it of floors[f].items||[]){
   if(SOURCE_TYPES.has(it.type)){
    const node=add(f,it,'source');sources.push(node);
    if(isTank(it))tanks.push(node);
   }else if(it.type==='water_outlet')ports.push(add(f,it,'port'));
  }
  const joins=[];
  const order=floors.map((floor,f)=>({f,z:num(floor.elevationFt,f*12)})).sort((a,b)=>a.z-b.z||a.f-b.f);
  for(let n=1;n<order.length;n++){
   const a=order[n-1],b=order[n];
   const wallsA=(floors[a.f].items||[]).filter(x=>WALLS.has(x.type)&&x.a&&x.b);
   const wallsB=(floors[b.f].items||[]).filter(x=>WALLS.has(x.type)&&x.a&&x.b);
   const seen=new Set();
   for(const wa of wallsA)for(const wb of wallsB){
    if(owner(wa)&&owner(wb)&&owner(wa)!==owner(wb))continue;
    const p=collinear(wa.a,wa.b,wb.a,wb.b);
    if(!p)continue;
    const key=Math.round(p.x*100)+':'+Math.round(p.y*100);
    if(seen.has(key)||seen.size>=64)continue;
    seen.add(key);
    const ia=add(a.f,{networkId:'*',buildingId:owner(wa)},'riser',p);
    const ib=add(b.f,{networkId:'*',buildingId:owner(wb)},'riser',p);
    joins.push([ia,ib,Math.abs(b.z-a.z)]);
   }
  }
  function edge(a,b,feet,sections){
   links[a.index].push({to:b.index,feet,sections});
   links[b.index].push({to:a.index,feet,sections:sections.map(x=>({
    ...x,points:x.points?.slice().reverse()
   })).reverse()});
  }
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
   const a=nodes[i],b=nodes[j];
   if(a.f!==b.f||!compatible(a.it,b.it))continue;
   const path=graphs[a.f].routeDetailed(a.p,b.p,Math.max(leadFt(a.it),leadFt(b.it))/ft);
   if(!path||path.fromGap*ft>leadFt(a.it)+.001||path.toGap*ft>leadFt(b.it)+.001)continue;
   const feet=(path.length+path.fromGap+path.toGap)*ft;
   edge(a,b,feet,[{floor:a.f,points:[a.p,...path.points,b.p]}]);
  }
  for(const [a,b,feet] of joins)edge(a,b,feet,[{vertical:true,floor:a.f,toFloor:b.f,point:a.p,feet}]);
  const paths=new Map();
  function shortest(from,to){
   if(!from||!to)return null;
   const key=from.index+':'+to.index;
   if(paths.has(key))return paths.get(key);
   const cost=nodes.map(()=>Infinity),prev=new Array(nodes.length),used=new Set();
   cost[from.index]=0;
   while(used.size<nodes.length){
    let u=-1,best=Infinity;
    for(let i=0;i<nodes.length;i++)if(!used.has(i)&&cost[i]<best){best=cost[i];u=i;}
    if(u<0||u===to.index)break;
    used.add(u);
    for(const e of links[u])if(best+e.feet<cost[e.to]-1e-8){
     cost[e.to]=best+e.feet;prev[e.to]={u,edge:e};
    }
   }
   if(!Number.isFinite(cost[to.index])){paths.set(key,null);return null;}
   const sections=[];let at=to.index;
   while(at!==from.index){
    const p=prev[at];if(!p){paths.set(key,null);return null;}
    sections.unshift(...p.edge.sections);at=p.u;
   }
   const result={feet:cost[to.index],sections};
   paths.set(key,result);return result;
  }
  const tankState=services.waterTanks ||= {};
  for(const node of tanks){
   const key=tankKey(floors[node.f],node.it);
   const cap=Math.max(0,num(node.it.capacityLiters,node.it.type==='water_cistern'?2500:1100));
   if(!tankState[key]||typeof tankState[key]!=='object')tankState[key]={liters:Math.max(0,num(node.it.initialLiters,0))};
   tankState[key].liters=clamp(num(tankState[key].liters),0,cap);
  }
  function available(node){
   const it=node.it;
   if(it.enabled===false||services.enabled?.[it.id]===false||num(services.damage?.[it.id])>=100)return false;
   if(it.type==='water_main')return services.contracts?.water==='active';
   return isTank(it)&&num(tankState[tankKey(floors[node.f],it)]?.liters)>0;
  }
  function openValves(it){
   return floors.every(f=>(f.items||[]).filter(x=>x.type==='water_valve'&&compatible(x,it))
    .every(v=>(services.enabled?.[v.id]??v.opened)!==false));
  }
  function choices(node,onlyMains=false){
   if(!node||!openValves(node.it))return [];
   return sources.filter(s=>compatible(s.it,node.it)&&(!onlyMains||s.it.type==='water_main'))
    .map(s=>({node:s,route:shortest(s,node)}))
    .filter(x=>x.route&&x.route.feet<=Math.max(0,num(x.node.it.rangeFt,isTank(x.node.it)?240:120))+.001)
    .sort((a,b)=>Number(isTank(a.node.it))-Number(isTank(b.node.it))||a.route.feet-b.route.feet);
  }
  function portsFor(f,it){
   if(it.type==='water_outlet')return [itemNodes.get(f+':'+String(it.id))].filter(Boolean);
   const p=pos(it);
   return ports.filter(port=>port.f===f&&compatible(port.it,it)&&
    distance(port.p,p)*ft<=Math.max(0,num(port.it.radiusFt,5))&&
    graphs[f].wallsBetween(p,port.p)===0)
    .sort((a,b)=>distance(a.p,p)-distance(b.p,p));
  }
  function status(f,it){
   if(!it||!floors[f])return {connected:false,water:false,reason:'invalid'};
   if(isTank(it)){
    const tank=tankState[tankKey(floors[f],it)];
    return {connected:true,water:num(tank?.liters)>0,liters:num(tank?.liters)};
   }
   for(const port of portsFor(f,it)){
    const paths=choices(port),ready=paths.find(x=>available(x.node));
    if(ready)return {connected:true,water:true,via:port.it.id,sourceId:ready.node.it.id,
     sourceType:ready.node.it.type,feet:ready.route.feet};
    if(paths.length)return {connected:true,water:false,via:port.it.id,reason:'sourceUnavailable'};
   }
   return {connected:false,water:false,reason:'unconnected'};
  }
  function consume(f,it,liters,strict=false){
   const amount=Math.max(0,num(liters));
   const port=portsFor(f,it).find(p=>choices(p).some(x=>available(x.node)));
   if(!port)return 0;
   const selected=choices(port).find(x=>available(x.node));
   if(!selected)return 0;
   if(!isTank(selected.node.it))return amount;
   const key=tankKey(floors[selected.node.f],selected.node.it);
   if(strict&&num(tankState[key]?.liters)<amount)return 0;
   const taken=Math.min(amount,num(tankState[key]?.liters));
   tankState[key].liters=Math.max(0,tankState[key].liters-taken);
   return taken;
  }
  function tick(gameMinutes){
   if(!(gameMinutes>0)||services.contracts?.water!=='active')return;
   for(const tank of tanks){
    if(tank.it.enabled===false)continue;
    const feed=choices(tank,true).find(x=>available(x.node));
    if(!feed)continue;
    const key=tankKey(floors[tank.f],tank.it);
    const capacity=Math.max(0,num(tank.it.capacityLiters,tank.it.type==='water_cistern'?2500:1100));
    const flow=Math.max(0,num(tank.it.fillLpm,30));
    tankState[key].liters=clamp(num(tankState[key].liters)+flow*gameMinutes,0,capacity);
   }
  }
  function diagnostics(){
   const routes=[];
   for(const port of ports){
    const options=choices(port),best=options[0];
    routes.push({floor:port.f,itemId:port.it.id,connected:!!best,
     supplied:!!options.find(x=>available(x.node)),sourceId:best?.node.it.id||'',
     feet:best?.route.feet??null,sections:best?.route.sections||[]});
   }
   // Unión de intervalos colineales; varias tomas no duplican el mismo tramo.
   const spans=new Map(),vertical=new Set();
   for(const r of routes)for(const section of r.sections){
    if(section.vertical){const p=section.point;
     vertical.add([Math.min(section.floor,section.toFloor),Math.max(section.floor,section.toFloor),
      Math.round(p.x*100),Math.round(p.y*100),section.feet].join(':'));continue;}
    const pts=section.points||[];
    for(let i=1;i<pts.length;i++){
     const a=pts[i-1],b=pts[i],len=distance(a,b);if(len<1e-6)continue;
     let dx=(b.x-a.x)/len,dy=(b.y-a.y)/len;
     if(dx<-.00001||Math.abs(dx)<.00001&&dy<0){dx=-dx;dy=-dy;}
     const normal=-dy*a.x+dx*a.y;
     const key=[section.floor,Math.round(dx*10000),Math.round(dy*10000),Math.round(normal*10000)].join(':');
     const t=p=>p.x*dx+p.y*dy;
     if(!spans.has(key))spans.set(key,[]);
     spans.get(key).push([Math.min(t(a),t(b)),Math.max(t(a),t(b))]);
    }
   }
   let coldFeet=0;
   for(const values of spans.values()){
    values.sort((a,b)=>a[0]-b[0]);let start=null,end=null;
    for(const [a,b] of values){if(start===null){start=a;end=b;}else if(a<=end+.00001)end=Math.max(end,b);else{coldFeet+=(end-start)*ft;start=a;end=b;}}
    if(start!==null)coldFeet+=(end-start)*ft;
   }
   for(const key of vertical){const parts=key.split(':');coldFeet+=num(parts[4]);}
   return {routes,coldFeet:Math.round(coldFeet*100)/100,tanks:tanks.map(n=>{
    const entry=tankState[tankKey(floors[n.f],n.it)];
    return {floor:n.f,itemId:n.it.id,liters:entry.liters,capacityLiters:num(n.it.capacityLiters,n.it.type==='water_cistern'?2500:1100)};
   })};
  }
  return Object.freeze({enabled:true,isFixture,status,consume,tick,diagnostics,tankState});
 }
 return Object.freeze({FIXTURES,isFixture,isTank,createRuntime});
});
