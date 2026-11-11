/* Reloj único del juego: adaptador entre postura, vigilia y GameState.clock.
   No crea un segundo reloj: FHWeatherCore sigue avanzando GameState.clock. */
(function(root){
 'use strict';
 const MIN_AWAKE=360, SLEEPY=720, FULL_REST=480;
 const state={awakeMinutes:0,sleepMinutes:0,restedMinutes:0,sleeping:false,asleepAllowed:false,blocked:false,lastMinute:null,lastDate:null};
 let lastStage='awake';
 const absolute=clock=>Date.UTC(clock.year,clock.month-1,clock.day)/60000+clock.minutes;
 function dateKey(clock){return [clock.year,clock.month,clock.day].join('-');}
 function initialize(gameState){
  const saved=gameState.sleepState;
  if(saved&&typeof saved==='object'){
   for(const key of ['awakeMinutes','sleepMinutes','restedMinutes']){
    if(Number.isFinite(saved[key])&&saved[key]>=0)state[key]=saved[key];
   }
  }
  gameState.sleepState=state;
 }
 function before(gameState){
  if(!gameState?.clock)return;
  if(gameState.sleepState!==state)initialize(gameState);
  const clock=gameState.clock;
  // El modo de prueba tiene exactamente un jugador local; para multiplayer
  // el host debe entregar el consenso real, nunca inferirlo de la postura local.
  const multiplayer=root.FHMultiplayerSleepConsensus;
  const allSleeping=typeof multiplayer?.allSleeping==='boolean'
   ? multiplayer.allSleeping
   : state.sleeping;
  clock.minutesPerSecond=allSleeping?4:1;
  state.asleepAllowed=state.awakeMinutes>=MIN_AWAKE;
  state.blocked=!state.asleepAllowed;
  state.sleepy=!state.sleeping&&state.awakeMinutes>=SLEEPY;
 }
 function after(gameState){
  if(!gameState?.clock)return;
  const clock=gameState.clock,now=absolute(clock);
  if(state.lastMinute===null){state.lastMinute=now;state.lastDate=dateKey(clock);return;}
  const delta=Math.max(0,Math.min(1440,now-state.lastMinute));
  state.lastMinute=now;
  if(state.sleeping){
   state.sleepMinutes+=delta;
   state.restedMinutes=Math.min(FULL_REST,state.restedMinutes+delta);
   if(state.sleepMinutes>=FULL_REST-1e-6){
    state.sleeping=false;state.sleepMinutes=0;state.awakeMinutes=0;lastStage='waking';
    state.restedMinutes=FULL_REST;
    root.FHSleep?.requestWake?.(()=>root.FHUnifiedSleepAutoWake?.());
   }
  }else{
   state.awakeMinutes+=delta;
  }
  state.sleepy=!state.sleeping&&state.awakeMinutes>=SLEEPY;
 }
 function pose(status){
  const stage=status?.stage||'awake';
  if(stage===lastStage && !(stage==='asleep'&&!state.sleeping&&state.awakeMinutes>=MIN_AWAKE))return;
  lastStage=stage;
  if(stage==='asleep'&&state.awakeMinutes>=MIN_AWAKE&&!state.sleeping){
   state.sleeping=true;state.sleepMinutes=0;state.restedMinutes=0;
  }else if(stage!=='asleep'&&stage!=='resting'&&stage!=='drowsy'&&state.sleeping){
   state.sleeping=false;
  }
 }
 root.FHUnifiedSleep=Object.freeze({state,before,after,pose,MIN_AWAKE,SLEEPY,FULL_REST});
})(window);
