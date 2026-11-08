/* Blakpine Wood — clima determinista sobre GameState.clock. Sin DOM ni Three.js. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(root)root.FHWeatherCore=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const TYPES=Object.freeze(['soleado','parcial_nublado','nublado','llovizna','lluvia','tormenta']);
 const WEIGHTS=Object.freeze({
  primavera:[3,4,3,4,3,1],verano:[5,4,2,2,3,3],
  otono:[2,3,5,4,4,1],invierno:[2,3,5,3,4,2]
 });
 const MINUTES_DAY=1440;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const finite=(v,def)=>Number.isFinite(Number(v))?Number(v):def;
 const monthDays=(m,y)=>new Date(Date.UTC(y,m,0)).getUTCDate();
 function seasonFor(clock,config={}){
  if(WEIGHTS[config.season])return config.season;
  const m=clamp(Math.floor(finite(clock?.month,6)),1,12);
  return m===12||m<=2?'invierno':m<=5?'primavera':m<=8?'verano':'otono';
 }
 function nextRandom(data){
  let s=(Number(data.seed)>>>0)||0x9e3779b9;
  s^=s<<13;s^=s>>>17;s^=s<<5;
  data.seed=s>>>0;
  return (data.seed>>>0)/4294967296;
 }
 function chooseType(season,previous,rng){
  const weights=WEIGHTS[season]||WEIGHTS.verano;
  const previousIndex=TYPES.indexOf(previous);
  const allowed=TYPES.map((type,i)=>({type,i,w:weights[i]}))
    .filter(v=>previousIndex<0||Math.abs(v.i-previousIndex)<=1);
  let t=rng()*allowed.reduce((s,v)=>s+v.w,0);
  for(const v of allowed){t-=v.w;if(t<0)return v.type;}
  return allowed[allowed.length-1].type;
 }
 function ensureClock(gameState){
  const source=gameState.clock&&typeof gameState.clock==='object'?gameState.clock:{};
  const clock=gameState.clock=source;
  clock.year=clamp(Math.floor(finite(clock.year,2016)),1,9999);
  clock.month=clamp(Math.floor(finite(clock.month,6)),1,12);
  clock.day=clamp(Math.floor(finite(clock.day,1)),1,monthDays(clock.month,clock.year));
  clock.minutes=finite(clock.minutes,480);
  if(clock.minutes<0)clock.minutes=480;
  return clock;
 }
 function advanceDate(clock,days){
  let count=clamp(Math.floor(days),0,100000);
  while(count>0){
   const available=monthDays(clock.month,clock.year)-clock.day;
   if(count<=available){clock.day+=count;break;}
   count-=available+1;clock.day=1;
   if(clock.month===12){clock.month=1;clock.year=Math.min(9999,clock.year+1)}
   else clock.month++;
  }
 }
 function absoluteMinute(clock){
  return Date.UTC(clock.year,clock.month-1,clock.day)/60000+clock.minutes;
 }
 function temperature(clock,season){
  const base={primavera:12,verano:23,otono:10,invierno:-2}[season];
  const hour=clock.minutes/60;
  const cycle=6*Math.cos((hour-15)*Math.PI/12);
  const drift=(((clock.year*13+clock.month*31+clock.day*17)%17)-8)*.34;
  return Math.round((base+cycle+drift)*10)/10;
 }
 function precipitation(type,temp,season){
  if(TYPES.indexOf(type)<3)return 'ninguna';
  if(season==='verano')return 'lluvia';
  if(temp<0)return 'nieve';
  if(temp<=3)return 'aguanieve';
  return 'lluvia';
 }
 function intensity(type){return type==='llovizna'?.23:type==='lluvia'?.58:type==='tormenta'?1:0}
 function createRuntime({gameState,config={}}={}){
  if(!gameState||typeof gameState!=='object')return null;
  const clock=ensureClock(gameState);
  let data=gameState.weather&&typeof gameState.weather==='object'?gameState.weather:{};
  gameState.weather=data;
  data.seed=(Number(data.seed)>>>0)||0x6a09e667;
  data.snow=clamp(finite(data.snow,0),0,1);
  data.wetness=clamp(finite(data.wetness,0),0,1);
  data.fog=clamp(Math.floor(finite(data.fog,0)),0,3);
  let seconds=0,lightningAt=7,flashEnd=0,lastKind='',lastFog=-1;
  const minHours=clamp(finite(config.minHours,3),1,24);
  const maxHours=clamp(finite(config.maxHours,8),minHours,36);
  let view=null;
  const pickDuration=()=>Math.round((minHours+(maxHours-minHours)*nextRandom(data))*60);
  function update(dt=0){
   const elapsed=clamp(finite(dt,0),0,.25);
   seconds+=elapsed;
   // El reloj visible del juego es la única fuente temporal; se conserva en GameState.
   if(config.advanceClock!==false&&clock.paused!==true){
    const speed=clamp(finite(clock.minutesPerSecond,finite(config.clockSpeed,1)),0,120);
    clock.minutes+=elapsed*speed;
    if(clock.minutes>=MINUTES_DAY){
     const days=Math.floor(clock.minutes/MINUTES_DAY);
     clock.minutes-=days*MINUTES_DAY;advanceDate(clock,days);
    }
   }
   const minute=absoluteMinute(clock),season=seasonFor(clock,config);
   if(!Number.isFinite(data.nextAt)||!TYPES.includes(data.type)){
    data.type=chooseType(season,null,()=>nextRandom(data));
    data.nextAt=minute+pickDuration();
    data.lastAt=minute;
    data.fog=0;
   }
   let steps=0;
   while(minute>=data.nextAt&&steps++<1000){
    data.type=chooseType(season,data.type,()=>nextRandom(data));
    data.nextAt+=pickDuration();
    const chance=season==='otono'?.44:season==='primavera'?.28:.17;
    data.fog=nextRandom(data)<chance?1+Math.floor(nextRandom(data)*3):0;
   }
   if(minute>=data.nextAt)data.nextAt=minute+pickDuration();
   const temp=temperature(clock,season),phase=precipitation(data.type,temp,season);
   const rain=intensity(data.type);
   const sunlight=Math.max(0,Math.sin(Math.PI*clamp((clock.minutes/60-6)/12,0,1)));
   const delta=clamp(minute-finite(data.lastAt,minute),0,43200);
   data.lastAt=minute;
   if(phase==='nieve'){
    data.snow=clamp(data.snow+delta*.0018*rain,0,1);
   }else{
    const melt=temp>0?Math.min(data.snow,delta*(.00023+Math.min(temp,25)*.00007)*(sunlight>.3?1.4:0.65)):0;
    data.snow=clamp(data.snow-melt,0,1);
    data.wetness=clamp(data.wetness+melt*.75,0,1);
    if(rain>0)data.wetness=clamp(data.wetness+delta*.0025*rain,0,1);
   }
   if(rain===0&&data.snow<.95){
    data.wetness=clamp(data.wetness-delta*(.00018+sunlight*.0006+Math.max(0,temp)*.000012),0,1);
   }
   const lightning=data.type==='tormenta'&&phase==='lluvia';
   let flash=false;
   if(lightning){
    if(seconds>=lightningAt){
     flashEnd=seconds+.17;
     lightningAt=seconds+5+nextRandom(data)*5;
    }
    flash=seconds<flashEnd;
   }else{lightningAt=seconds+5+nextRandom(data)*5;flashEnd=0;}
   const light=data.type==='soleado'?1:data.type==='parcial_nublado'?1:data.type==='tormenta'?.5:.6;
   const mode=data.type;
   view={
    type:mode,season,temp,phase,intensity:rain,fog:data.fog,snow:data.snow,
    wetness:data.wetness,light:flash?1:light,
    cloudPhase:seconds*.16,clock,
    lightning:flash
   };
   const changed=lastKind!==mode+'|'+phase+'|'+flash||lastFog!==data.fog;
   lastKind=mode+'|'+phase+'|'+flash;lastFog=data.fog;
   return changed;
  }
  update(0);
  return {update,view:()=>view,save:()=>data,clock:()=>clock};
 }
 return Object.freeze({TYPES,WEIGHTS,seasonFor,chooseType,precipitation,temperature,createRuntime,absoluteMinute});
});