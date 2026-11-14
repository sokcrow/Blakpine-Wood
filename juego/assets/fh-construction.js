/* Blakpine-Wood · Obras por parcela: datos opcionales del mapa v1.
 * El proyecto del editor es declarativo; el progreso de la partida vive en GameState.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHConstruction=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const PRESETS=Object.freeze(['ayuntamiento','apartamentos','casas','tienda','personalizado']);
 const PHASES=Object.freeze(['planificada','cimientos','estructura','instalaciones','inspeccion','terminada']);
 const clamp=(n)=>Math.max(0,Math.min(100,n));
 const validPercent=n=>typeof n==='number'&&Number.isFinite(n);
 function normalize(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
  const simulated=raw.simulated===true;
  const preset=PRESETS.includes(raw.preset)?raw.preset:'personalizado';
  const progress=simulated&&validPercent(raw.progress)?clamp(raw.progress):(simulated?0:100);
  return {version:1,preset,simulated,progress:simulated?progress:100};
 }
 function plan(property,preset,simulated=false){
  if(!property||typeof property!=='object')throw Error('Parcela no válida');
  if(!PRESETS.includes(preset))throw Error('Preset de construcción desconocido');
  property.construction={version:1,preset,simulated:simulated===true,progress:simulated?0:100};
  return property.construction;
 }
 function phase(progress){
  if(progress>=100)return 'terminada';
  if(progress>=90)return 'inspeccion';
  if(progress>=70)return 'instalaciones';
  if(progress>=35)return 'estructura';
  if(progress>=15)return 'cimientos';
  return 'planificada';
 }
 function absoluteMinute(clock){
  if(!clock||!Number.isInteger(clock.year)||!Number.isInteger(clock.month)||!Number.isInteger(clock.day)
   ||!Number.isFinite(Number(clock.minutes)))return null;
  const origin=Date.UTC(clock.year,clock.month-1,clock.day);
  return Number.isFinite(origin)?Math.floor(origin/60000+Number(clock.minutes)):null;
 }
 function createRuntime(project,state={},options={}){
  if(!state||typeof state!=='object')throw Error('Estado de partida no válido');
  const percentPerMinute=Number.isFinite(options.percentPerMinute)&&options.percentPerMinute>=0
   ?options.percentPerMinute:0.04;
  const parcelMap=new Map((Array.isArray(project?.properties)?project.properties:[])
   .filter(p=>p&&typeof p.id==='string'&&p.id&&normalize(p.construction)?.simulated)
   .map(p=>[p.id,p]));
  if(parcelMap.size&&!state.construction)state.construction={};
  if(parcelMap.size&&(!state.construction||typeof state.construction!=='object'||Array.isArray(state.construction)))
   state.construction={};
  const save=typeof options.save==='function'?options.save:()=>{};
  const entries=new Map();
  let lastTickMinute=null;
  for(const [id,parcel] of parcelMap){
   const spec=normalize(parcel.construction);
   const stored=state.construction[id];
   const record=stored&&typeof stored==='object'?stored:{};
   const progress=validPercent(record.progress)?clamp(record.progress):spec.progress;
   const lastMinute=Number.isFinite(record.lastMinute)?record.lastMinute:null;
   entries.set(id,{progress,lastMinute});
   state.construction[id]={progress,lastMinute};
  }
  const report=(id)=>{
   const parcel=parcelMap.get(id);
   if(!parcel)return null;
   const entry=entries.get(id),spec=normalize(parcel.construction);
   return {parcelId:id,preset:spec.preset,simulated:true,progress:entry.progress,
    phase:phase(entry.progress),finished:entry.progress>=100};
  };
  function persist(id,beforeProgress,force=false){
   const entry=entries.get(id);
   state.construction[id]={progress:entry.progress,lastMinute:entry.lastMinute};
   if(force||Math.floor(entry.progress)!==Math.floor(beforeProgress)||phase(entry.progress)!==phase(beforeProgress))
    save();
  }
  function advance(id,amount){
   const entry=entries.get(id);
   if(!entry||!Number.isFinite(amount)||amount<=0)return null;
   const before=entry.progress;
   entry.progress=clamp(entry.progress+amount);
   persist(id,before,true);
   return report(id);
  }
  function tick(minute){
   if(!Number.isFinite(minute))return false;
   const rounded=Math.floor(minute);
   if(lastTickMinute===rounded)return false;
   lastTickMinute=rounded;
   let changed=false;
   for(const [id,entry] of entries){
    const previousMinute=entry.lastMinute;
    entry.lastMinute=Math.floor(minute);
    if(previousMinute===null||entry.progress>=100){
     state.construction[id]={progress:entry.progress,lastMinute:entry.lastMinute};
     continue;
    }
    const elapsed=Math.min(1440,Math.max(0,entry.lastMinute-previousMinute));
    if(!elapsed||!percentPerMinute){
     state.construction[id]={progress:entry.progress,lastMinute:entry.lastMinute};
     continue;
    }
    const before=entry.progress;
    entry.progress=clamp(entry.progress+elapsed*percentPerMinute);
    persist(id,before);
    changed ||= entry.progress!==before;
   }
   return changed;
  }
  function status(id){
   const live=report(id);
   if(live)return live;
   const parcel=(project?.properties||[]).find(p=>p?.id===id);
   const spec=normalize(parcel?.construction);
   return spec?{parcelId:id,preset:spec.preset,simulated:spec.simulated,
    progress:spec.progress,phase:phase(spec.progress),finished:spec.progress>=100}:null;
  }
  return Object.freeze({tick,advance,status,list:()=>[...entries.keys()].map(report)});
 }
 return Object.freeze({PRESETS,PHASES,normalize,plan,phase,absoluteMinute,createRuntime});
});
