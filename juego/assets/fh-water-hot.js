/* Blakpine-Wood · Agua 04. Circuito independiente de agua caliente.
 * Las calderas necesitan agua FRÍA existente y alimentación eléctrica; no
 * crean suministro, no cambian la red de drenaje y no modifican al personaje.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHWaterHot=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const PRESETS=Object.freeze({
  calentador_domestico_vertical:{capacityLiters:80,fillLpm:12,heatCPerMinute:2,watts:1200},
  calentador_domestico_horizontal:{capacityLiters:110,fillLpm:15,heatCPerMinute:1.6,watts:1600},
  caldera_residencial_mediana:{capacityLiters:280,fillLpm:30,heatCPerMinute:1.4,watts:2000},
  caldera_industrial_grande:{capacityLiters:600,fillLpm:60,heatCPerMinute:1.2,watts:2400}
 });
 const NO_HOT=new Set(['inodoro_clasico','inodoro_antiguo','mingitorio_pared']);
 const HOUSING=new Set(['lavabo_pedestal','lavabo_gabinete','fregadero_mueble',
  'banera_clasica','banera_patas','plato_ducha','cabina_ducha','regadera_pared']);
 const num=(x,def=0)=>Number.isFinite(Number(x))?Number(x):def;
 const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
 const isBoiler=it=>!!PRESETS[it?.modelId]&&it?.service?.waterHeating===true;
 const wantsHot=it=>!!it&&it.hotWaterEnabled!==false&&it.service?.hotWaterEnabled!==false&&
  !NO_HOT.has(it.modelId)&&(
   it.type==='water_outlet'&&(it.hotWaterEnabled===true||it.utilitySkin==='toma_agua_doble')||
   HOUSING.has(it.modelId)||
   it.service?.hotWaterEnabled===true);
 const network=it=>String(it?.hotNetworkId||it?.networkId||'main');
 const building=it=>String(it?.buildingId||it?.propertyId||'');
 const related=(source,target)=>network(source)===network(target)&&
  (!building(source)||!building(target)||building(source)===building(target));
 const key=(floor,it)=>String(floor.id)+':'+String(it.id);
 function createRuntime(project,services,cold,powered=()=>false){
  const floors=Array.isArray(project?.floors)?project.floors:[];
  const boilers=floors.flatMap((floor,f)=>(floor.items||[])
   .filter(isBoiler).map(it=>({f,it,model:PRESETS[it.modelId],key:key(floor,it)})));
  const state=services.hotWater ||= {};
  if(!cold?.enabled||!boilers.length)return Object.freeze({
   enabled:false,isBoiler,wantsHot,status:()=>({connected:false,hotWater:false}),
   diagnostics:()=>({routes:[],hotFeet:0,boilers:[]}),tick:()=>{},draw:()=>0
  });
  const tempFor=it=>clamp(num(it.coldTemperatureC,15),0,50);
  const size=b=>Math.max(0,num(b.it.boilerCapacityLiters,b.model.capacityLiters));
  const target=b=>clamp(num(b.it.targetTemperatureC,55),30,90);
  const minHot=b=>clamp(num(b.it.minHotTemperatureC,40),25,target(b));
  const healthy=b=>b.it.enabled!==false&&services.enabled?.[b.it.id]!==false&&
   num(services.damage?.[b.it.id])<100;
  for(const b of boilers){
   const capacity=size(b);
   const saved=state[b.key];
   if(!saved||typeof saved!=='object'||Array.isArray(saved))
    state[b.key]={liters:clamp(num(b.it.initialHotLiters,0),0,capacity),
     temperatureC:clamp(num(b.it.initialTemperatureC,tempFor(b.it)),0,100)};
   else{
    saved.liters=clamp(num(saved.liters),0,capacity);
    saved.temperatureC=clamp(num(saved.temperatureC,tempFor(b.it)),0,100);
   }
  }
  function routesTo(f,it){
   if(!floors[f]||!wantsHot(it))return [];
   const ports=it.type==='water_outlet'?[{f,it}]:cold.portsFor?.(f,it,'hot')||[];
   const matches=[];
   for(const port of ports){
    if(!wantsHot(port.it))continue;
    for(const b of boilers){
     if(!related(b.it,port.it)||!related(b.it,it))continue;
     const route=cold.routeBetween?.(b.f,b.it,port.f,port.it,'hot');
     if(!route||route.feet>Math.max(0,num(b.it.hotRangeFt,240)))continue;
     matches.push({boiler:b,port,route});
    }
   }
   return matches.sort((a,b)=>a.route.feet-b.route.feet||
    a.boiler.key.localeCompare(b.boiler.key));
  }
  function info(b){
   const saved=state[b.key],coldStatus=cold.status(b.f,b.it);
   const active=healthy(b),hasPower=active&&powered(b.f,b.it)===true;
   const ready=active&&saved.liters>0&&saved.temperatureC>=minHot(b);
   return {floor:b.f,itemId:b.it.id,modelId:b.it.modelId,liters:saved.liters,
    capacityLiters:size(b),temperatureC:saved.temperatureC,
    targetTemperatureC:target(b),coldConnected:!!coldStatus.water,coldReason:coldStatus.reason||'',
    powered:hasPower,heating:hasPower&&!!coldStatus.water&&saved.liters>0&&
     saved.temperatureC<target(b)-.001,ready};
  }
  function status(f,it){
   if(isBoiler(it)){
    const b=boilers.find(x=>x.f===f&&x.it.id===it.id);
    if(!b)return {connected:false,hotWater:false};
    const i=info(b);
    return {...i,connected:i.coldConnected,hotWater:i.ready};
   }
   if(!wantsHot(it))return {connected:false,hotWater:false,reason:'coldOnly'};
   const matches=routesTo(f,it);
   const available=matches.find(x=>info(x.boiler).ready);
   const first=available||matches[0];
   if(!first)return {connected:false,hotWater:false,reason:
    (it.type==='water_outlet'||cold.portsFor?.(f,it,'hot')?.some(p=>wantsHot(p.it)))?'noRoute':'noHotOutlet'};
   const i=info(first.boiler);
   return {connected:true,hotWater:!!available,sourceId:first.boiler.it.id,
    sourceFloor:first.boiler.f,via:first.port.it.id,feet:first.route.feet,
    temperatureC:i.temperatureC,liters:i.liters,
    reason:available?'ready':'notHot'};
  }
  function tick(gameMinutes){
   const minutes=clamp(num(gameMinutes),0,60);
   if(!minutes)return;
   for(const b of boilers){
    const saved=state[b.key],capacity=size(b),ambient=tempFor(b.it);
    const coldStatus=cold.status(b.f,b.it),active=healthy(b);
    const electricity=active&&powered(b.f,b.it)===true;
    if(active&&coldStatus.water&&saved.liters<capacity){
     const request=Math.min(capacity-saved.liters,
      Math.max(0,num(b.it.fillLpm,b.model.fillLpm))*minutes);
     const filled=cold.consume(b.f,b.it,request);
     if(filled>0){
      saved.temperatureC=(saved.temperatureC*saved.liters+ambient*filled)/
       (saved.liters+filled);
      saved.liters+=filled;
     }
    }
    if(electricity&&saved.liters>0){
     saved.temperatureC=Math.min(target(b),
      saved.temperatureC+Math.max(0,num(b.it.heatCPerMinute,b.model.heatCPerMinute))*minutes);
    }else{
     saved.temperatureC=Math.max(ambient,saved.temperatureC-
      Math.max(0,num(b.it.coolCPerGameHour,2))*minutes/60);
    }
    // El onDemand existente mide el consumo eléctrico en el tick siguiente.
    services.usage[b.it.id]=electricity&&saved.liters>0&&
     saved.temperatureC<target(b)-.001;
   }
  }
  function draw(f,it,liters,strict=false){
   const requested=Math.max(0,num(liters));
   if(!requested)return 0;
   const matches=routesTo(f,it).filter(x=>info(x.boiler).ready);
   const selected=matches.find(x=>!strict||state[x.boiler.key].liters>=requested);
   if(!selected)return 0;
   const saved=state[selected.boiler.key],provided=Math.min(requested,saved.liters);
   saved.liters=Math.max(0,saved.liters-provided);
   services.meters.waterLiters+=provided;
   return provided;
  }
  function diagnostics(){
   const routes=[];
   for(let f=0;f<floors.length;f++)for(const it of floors[f].items||[]){
    if(it.type!=='water_outlet'||!wantsHot(it))continue;
    const matches=routesTo(f,it),ready=matches.find(x=>info(x.boiler).ready);
    const best=ready||matches[0];
    routes.push({floor:f,itemId:it.id,connected:!!best,heated:!!ready,
     sourceId:best?.boiler.it.id||'',feet:best?.route.feet??null,
     sections:best?.route.sections||[]});
   }
   return {routes,hotFeet:cold.measureInstalledFeet?.(routes)||0,boilers:boilers.map(info)};
  }
  return Object.freeze({enabled:true,isBoiler,wantsHot,status,tick,draw,diagnostics,state});
 }
 return Object.freeze({PRESETS,isBoiler,wantsHot,createRuntime});
});
