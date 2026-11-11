/* Blakpine Wood — Mood y miedo individual. Tiempo expresado en minutos de juego. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHMoodFear=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const MOODS=Object.freeze(['bueno','neutral','malo']);
 const LEVELS=Object.freeze(['relajado','calmado','nervioso','atemorizado','sin_esperanza','abrumado']);
 const PERCENT=Object.freeze([0,0,10,30,60,100]);
 const DEFAULTS=Object.freeze({
  thresholds:[0,10,25,45,70,95],initialStress:12,holdMinutes:15,
  recoveryPerMinute:1.25,darknessPerMinute:1.1,cooldownMinutes:3,
  eventStress:{room:0,corpse:34,paranormal:43,creature:52,eldritch:100}
 });
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const bounded=(x,min,max)=>Math.min(max,Math.max(min,x));
 const clone=x=>JSON.parse(JSON.stringify(x));
 function rank(stress,thresholds=DEFAULTS.thresholds){
  if(!finite(stress))return 0;
  let level=0;
  for(let i=1;i<LEVELS.length;i++)if(stress>=thresholds[i])level=i;
  return level;
 }
 function willFactor(vol){
  // Scores VOL en escala de 1 a 6. Peso provisional y configurable.
  return bounded(1.3-0.1*(finite(vol)?vol:3),0.7,1.2);
 }
 function createRuntime(character,callbacks={},options={}){
  if(!character||typeof character!=='object'||!character.resources)
   throw Error('Se requiere un personaje con recursos.');
  const cfg={...DEFAULTS,...options,eventStress:{...DEFAULTS.eventStress,...options.eventStress}};
  if(!Array.isArray(cfg.thresholds)||cfg.thresholds.length!==6||
     cfg.thresholds.some(x=>!finite(x))||cfg.thresholds.some((x,i)=>i&&x<=cfg.thresholds[i-1]))
   throw Error('Umbrales de miedo inválidos.');
  const state=character.mental&&typeof character.mental==='object'&&!Array.isArray(character.mental)?character.mental:{};
  state.version=1;
  if(!MOODS.includes(state.mood))state.mood='neutral';
  if(!finite(state.stress))state.stress=cfg.initialStress;
  state.stress=bounded(state.stress,0,100);
  if(!finite(state.lastMinute))state.lastMinute=null;
  if(!finite(state.holdUntil))state.holdUntil=0;
  if(!state.exposures||typeof state.exposures!=='object'||Array.isArray(state.exposures))state.exposures={};
  state.level=rank(state.stress,cfg.thresholds);
  character.mental=state;
  const notify=(kind,payload)=>{callbacks.onChange?.(state,kind,payload);return payload;};
  function setMood(mood){
   if(!MOODS.includes(mood))return false;
   if(mood===state.mood)return true;
   state.mood=mood;notify('mood',{mood});return true;
  }
  function promote(newStress,reason){
   const before=state.level;
   state.stress=bounded(newStress,0,100);
   state.level=rank(state.stress,cfg.thresholds);
   if(state.level===before)return null;
   // Escalones acumulativos: de 10% a 30% añade 20% de PS máximos.
   const from=PERCENT[before],to=PERCENT[state.level],r=character.resources;
   const max=finite(r.spMax)&&r.spMax>0?r.spMax:0;
   const damage=to>from?Math.min(Math.max(0,finite(r.sp)?r.sp:0),Math.round(max*(to-from)/100)):0;
   if(damage>0){
    r.sp=bounded((finite(r.sp)?r.sp:0)-damage,0,max);
    callbacks.onSanityLoss?.(damage,state.level,reason);
   }
   const payload={level:state.level,key:LEVELS[state.level],percent:to,fromPercent:from,damage,reason};
   notify('fear',payload);
   if(state.level===5&&before!==5)callbacks.onOverwhelmed?.(payload);
   return payload;
  }
  function stimulus(type,params={}){
   const minute=finite(params.minute)?params.minute:state.lastMinute??0;
   const id=typeof params.sourceId==='string'?params.sourceId.slice(0,100):'ambiente';
   const key=String(type||'paranormal')+'|'+id;
   if(finite(state.exposures[key])&&minute-state.exposures[key]>=0&&minute-state.exposures[key]<cfg.cooldownMinutes)return null;
   const base=finite(params.intensity)?Math.max(0,params.intensity):Math.max(0,cfg.eventStress[type]||0);
   if(!base)return null;
   const effective=base*(params.ignoreVoluntad?1:willFactor(character.scores?.VOL));
   state.exposures[key]=minute;
   if(Object.keys(state.exposures).length>256){
    const old=Object.entries(state.exposures).sort((a,b)=>a[1]-b[1]);
    for(const [k]of old.slice(0,128))delete state.exposures[k];
   }
   state.holdUntil=Math.max(state.holdUntil,minute+cfg.holdMinutes);
   return promote(state.stress+effective,type);
  }
  function tick(minute,context={}){
   if(!finite(minute))return null;
   if(!finite(state.lastMinute)){state.lastMinute=minute;return null;}
   if(minute<state.lastMinute){state.lastMinute=minute;return null;}
   const elapsed=bounded(minute-state.lastMinute,0,1440);
   state.lastMinute=minute;
   if(!elapsed)return null;
   if(context.sleeping){
    state.holdUntil=minute;
    return promote(state.stress-cfg.recoveryPerMinute*elapsed*2,'reposo');
   }
   if(context.darkness){
    state.holdUntil=Math.max(state.holdUntil,minute+cfg.holdMinutes);
    return promote(state.stress+cfg.darknessPerMinute*elapsed*willFactor(character.scores?.VOL),'oscuridad');
   }
   if(minute>=state.holdUntil)return promote(state.stress-cfg.recoveryPerMinute*elapsed,'recuperacion');
   return null;
  }
  function read(){return clone({mood:state.mood,stress:state.stress,level:state.level,key:LEVELS[state.level],holdUntil:state.holdUntil});}
  return Object.freeze({state,read,setMood,stimulus,tick});
 }
 return Object.freeze({MOODS,LEVELS,PERCENT,DEFAULTS,rank,willFactor,createRuntime});
});
