/* Blakpine Wood — supervivencia; todo el tiempo se expresa en minutos de juego. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHSurvival=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const HOUR=60,DAY=1440,MIN_SLEEP=360;
 const bound=(n,max)=>Math.min(Math.max(0,n),Math.max(0,max));
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const whole=n=>Math.floor(Math.max(0,n));
 function penaltySP(resources){
  const r=resources||{},maximum=r.spMax;
  if(!finite(maximum)||maximum<=0||!finite(r.sp))return 0;
  const missing=bound(maximum-r.sp,maximum);
  return 5*Math.floor((missing/maximum*100+1e-9)/20);
 }
 function recoveryPG(resources){
  return finite(resources?.pgMax)?whole(resources.pgMax*.10):0;
 }
 function createRuntime(gameState,callbacks={}){
  if(!gameState||!gameState.character?.resources)throw Error('Faltan recursos del personaje.');
  const resources=gameState.character.resources;
  const saved=gameState.survival&&typeof gameState.survival==='object'?gameState.survival:{};
  const state=Object.assign({
   version:1,lastMinute:finite(gameState.clock?.minutes)?gameState.clock.minutes:0,
   mode:'awake',sleepMinutes:0,sitCarry:0,sleepPECarry:0,
   sleepSPCarry:0,stressCarry:0,relaxCarry:0,
   pgRecoveredDay:-1,fatigue:{active:false,initialApplied:false,minutes:0},
   critical:null
  },saved);
  if(!state.fatigue||typeof state.fatigue!=='object')state.fatigue={active:false,initialApplied:false,minutes:0};
  state.fatigue=Object.assign({active:false,initialApplied:false,minutes:0},state.fatigue);
  if(!['awake','sitting','sleeping','unconscious'].includes(state.mode))state.mode='awake';
  if(!finite(state.lastMinute))state.lastMinute=finite(gameState.clock?.minutes)?gameState.clock.minutes:0;
  for(const key of ['sleepMinutes','sitCarry','sleepPECarry','sleepSPCarry','stressCarry','relaxCarry']){
   if(!finite(state[key])||state[key]<0)state[key]=0;
  }
  gameState.survival=state;
  function setResource(key,value){
   const max=resources[key+'Max'];
   if(!finite(max)||max<0)return false;
   const next=bound(value,max);
   if(resources[key]===next)return false;
   resources[key]=next;
   callbacks.onChange?.(key,next);
   return true;
  }
  function change(key,delta){
   if(!finite(delta))return false;
   return setResource(key,(finite(resources[key])?resources[key]:0)+delta);
  }
  function clampResources(){
   for(const key of ['pg','sp','pe'])if(finite(resources[key+'Max'])&&finite(resources[key]))
    setResource(key,resources[key]);
  }
  function checkCritical(){
   if(gameState.character.life==='dead')return state.critical;
   if(resources.pg<=0&&!state.critical){
    state.critical={status:'critical',successes:0,failures:0};
    callbacks.onCritical?.(state.critical);
   }
   return state.critical;
  }
  function damagePG(amount){
   if(!finite(amount)||amount<=0)return false;
   const did=change('pg',-amount);
   checkCritical();
   return did;
  }
  function setPGMax(max){
   if(!finite(max)||max<0)return false;
   resources.pgMax=max;
   setResource('pg',resources.pg);
   checkCritical();
   return true;
  }
  function deathSave(coins=1,rng=Math.random){
   checkCritical();
   if(state.critical?.status!=='critical'||!Number.isSafeInteger(coins)||coins<1||coins>21||typeof rng!=='function')
    return {ok:false,reason:'unavailable'};
   const faces=[];
   for(let i=0;i<coins;i++){
    const n=rng();
    if(!finite(n)||n<0||n>=1)throw Error('Valor de moneda inválido.');
    faces.push(n<.5?'heads':'tails');
   }
   const success=faces.includes('heads');
   if(success)state.critical.successes++;
   else state.critical.failures++;
   if(state.critical.successes>=3)state.critical.status='stable';
   else if(state.critical.failures>=3){
    state.critical.status='dead';
    gameState.character.life='dead';
    callbacks.onDeath?.();
   }
   callbacks.onCritical?.(state.critical);
   return {ok:true,faces,success,...state.critical};
  }
  function awakeFromStable(){
   if(state.critical?.status!=='stable'||resources.pg<=0)return false;
   state.critical=null;
   callbacks.onCritical?.(null);
   return true;
  }
  function read(){
   return {resources:{...resources},survival:JSON.parse(JSON.stringify(state)),spPenalty:penaltySP(resources)};
  }
  function addWhole(key,delta,interval,resource,amount){
   const total=state[key]+delta,steps=Math.floor((total+1e-8)/interval);
   state[key]=total-steps*interval;
   if(steps>0)change(resource,steps*amount);
  }
  function completeSleep(now){
   if(state.sleepMinutes<MIN_SLEEP)return;
   state.fatigue={active:false,initialApplied:false,minutes:0};
   const day=Math.floor(now/DAY);
   if(state.pgRecoveredDay!==day){
    change('pg',recoveryPG(resources));
    state.pgRecoveredDay=day;
   }
  }
  function wake(now){
   if(state.sleepMinutes>=MIN_SLEEP)completeSleep(now);
   else {
    if(!state.fatigue.initialApplied){
     change('sp',-whole(resources.spMax*.30));
     state.fatigue.initialApplied=true;
    }
    state.fatigue.active=true;
    state.fatigue.minutes=0;
   }
   state.sleepMinutes=0;
   state.sleepPECarry=0;
   state.sleepSPCarry=0;
  }
  function update(now,context={}){
   if(!finite(now))return read();
   clampResources();
   checkCritical();
   let mode=['awake','sitting','sleeping','unconscious'].includes(context.mode)?context.mode:'awake';
   if(state.critical&&(state.critical.status==='critical'||state.critical.status==='stable'||state.critical.status==='dead'))mode='unconscious';
   const elapsed=Math.max(0,now-state.lastMinute);
   // El tiempo de partida nunca retrocede por una carga o una corrección del reloj.
   if(now<state.lastMinute){state.lastMinute=now;return read()}
   const was=state.mode;
   if(was==='sleeping'&&mode!=='sleeping')wake(now);
   if(mode==='sleeping'&&was!=='sleeping'){
    state.sleepMinutes=0;state.sleepPECarry=0;state.sleepSPCarry=0;
   }
   if(mode!=='sitting'&&was==='sitting')state.sitCarry=0;
   if(mode==='sleeping'||mode==='unconscious'){state.stressCarry=0;state.relaxCarry=0;}
   else if(mode==='sitting')state.stressCarry=0;
   if(elapsed>0){
    if(mode==='sleeping'){
     state.sleepMinutes+=elapsed;
     addWhole('sleepPECarry',elapsed,30,'pe',1);
     addWhole('sleepSPCarry',elapsed,HOUR,'sp',3);
     completeSleep(now);
    }else if(mode==='sitting'){
     addWhole('sitCarry',elapsed,HOUR,'pe',1);
     if(context.stressed){addWhole('stressCarry',elapsed,HOUR,'sp',-2);state.relaxCarry=0;}
     else if(context.relaxing)addWhole('relaxCarry',elapsed,HOUR,'sp',1);
     else state.relaxCarry=0;
    }else if(mode==='awake'){
     if(context.stressed){addWhole('stressCarry',elapsed,HOUR,'sp',-2);state.relaxCarry=0}
     else {
      state.stressCarry=0;
      if(context.relaxing)addWhole('relaxCarry',elapsed,HOUR,'sp',1);
      else state.relaxCarry=0;
     }
    }
    if(mode!=='sleeping'&&mode!=='unconscious'&&state.fatigue.active){
     const before=Math.min(3,Math.floor((state.fatigue.minutes+1e-8)/HOUR));
     state.fatigue.minutes=Math.min(180,state.fatigue.minutes+elapsed);
     const after=Math.min(3,Math.floor((state.fatigue.minutes+1e-8)/HOUR));
     if(after>before)change('sp',-3*(after-before));
    }
   }
   state.mode=mode;
   state.lastMinute=now;
   return state;
  }
  clampResources();checkCritical();
  return Object.freeze({state,resources,update,read,change,damagePG,setPGMax,deathSave,awakeFromStable,checkCritical});
 }
 return Object.freeze({penaltySP,recoveryPG,createRuntime});
});