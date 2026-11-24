/* Tiempo ficticio de D&D. Único calendario: GameState.clock; ningún timer del navegador. */
(function(root,factory){
 'use strict';
 const api=factory(typeof module==='object'&&module.exports?
  require('../../assets/fh-weather-core.js'):root.FHWeatherCore);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHDndClock=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(weather){
 'use strict';
 function create({gameState,readSpeed=()=>30,beforeAdvance=()=>{},changed=()=>{}}={}){
  if(!gameState||!weather?.advanceClock)throw Error('DND_CLOCK_INVALID');
  weather.advanceClock(gameState,0);
  // Migración aditiva: los guardados anteriores sólo tienen clock.
  const old=gameState.dndTime;
  const state=gameState.dndTime={version:1,mode:old?.mode==='rounds'?'rounds':'exploration',
   round:Number.isSafeInteger(old?.round)&&old.round>0?old.round:1};
  gameState.clock.minutesPerSecond=0;
  function advance(seconds,persist=true){
   if(!Number.isFinite(seconds)||seconds<=0||seconds>86400)return false;
   beforeAdvance();
   weather.advanceClock(gameState,seconds/60);
   changed(persist);return true;
  }
  function move(meters){
   const speed=readSpeed();
   if(state.mode==='rounds'||!Number.isFinite(meters)||meters<=0||
    !Number.isFinite(speed)||speed<=0)return false;
   return advance(meters/.3048*6/speed,false);
  }
  return Object.freeze({
   move,
   // Las acciones ya guardan a través de su escritor del motor.
   action:()=>state.mode==='exploration'&&advance(6,false),
   wait(minutes){return state.mode==='exploration'&&Number.isFinite(minutes)&&
    minutes>0&&minutes<=480&&advance(minutes*60);},
   endRound(){if(state.mode!=='rounds')return false;
    state.round++;return advance(6);},
   setMode(mode){if(!['exploration','rounds'].includes(mode)||mode===state.mode)return false;
    state.mode=mode;changed(true);return true;},
   view(){const clock=gameState.clock,seconds=Math.floor(clock.minutes*60+1e-6);
    return {mode:state.mode,round:state.round,year:clock.year,month:clock.month,day:clock.day,
     hour:Math.floor(seconds/3600),minute:Math.floor(seconds/60)%60,second:seconds%60};},
   minute:()=>weather.absoluteMinute(gameState.clock)
  });
 }
 function mount({clock,host,document:doc,text}={}){
  if(!clock||!host||!doc||!text)return null;
  const box=doc.createElement('section'),title=doc.createElement('h4'),
   status=doc.createElement('output'),help=doc.createElement('p'),
   info=doc.createElement('details'),summary=doc.createElement('summary'),
   modes=doc.createElement('div'),waits=doc.createElement('div');
  box.className='fh-dnd-clock';box.setAttribute('aria-label',text.title);
  title.textContent=text.title;help.textContent=text.help;
  summary.textContent=text.helpTitle;info.className='dnd-clock-help';info.append(summary,help);
  modes.className='dnd-clock-modes';waits.className='dnd-clock-waits';
  box.append(title,status,modes,waits,info);
  const buttons=[];
  const add=(label,action,kind)=>{const button=doc.createElement('button');button.type='button';
   button.textContent=label;button.style.minHeight='44px';button.addEventListener('click',()=>{action();update();});
   (kind==='wait'?waits:kind==='end'?box:modes).append(button);buttons.push({button,kind});};
  add(text.exploration,()=>clock.setMode('exploration'),'exploration');
  add(text.rounds,()=>clock.setMode('rounds'),'rounds');
  add(text.endRound,()=>clock.endRound(),'end');
  for(const minutes of [1,10,60,480])add(text.wait(minutes),()=>clock.wait(minutes),'wait');
  function update(){const value=clock.view();status.textContent=text.status(value);
   for(const {button,kind}of buttons)button.disabled=kind==='wait'?value.mode==='rounds':
    kind==='end'?value.mode!=='rounds':kind===value.mode;
  }
  host.append(box);update();return Object.freeze({update,close:()=>box.remove()});
 }
 return Object.freeze({create,mount});
});
