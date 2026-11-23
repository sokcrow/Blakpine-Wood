import {P} from './play-strings.js';

export async function mountGameRoom({element,store,campaignId,isCurrent=()=>true}) {
  let alive=true,invalidated=false,stopWatch=()=>{},api=null;
  const status=document.createElement('p');status.setAttribute('role','status');status.textContent=P.loading;
  const heading=document.createElement('h1');heading.textContent=P.title;
  const details=document.createElement('p'),help=document.createElement('p');help.textContent=P.limitation;
  const enter=document.createElement('button');enter.textContent=P.enter;enter.disabled=true;
  const frame=document.createElement('iframe');frame.title=P.title;frame.hidden=true;
  frame.setAttribute('allow','fullscreen');frame.src='../index.html?editor=1&lumenCartridge=1&lumenPlayer=1';
  element.replaceChildren(heading,status,details,enter,help,frame);
  const current=()=>alive&&isCurrent()&&element.isConnected;
  function close(text){
    invalidated=true;
    stopWatch();stopWatch=()=>{};
    api?.stop();frame.hidden=true;element.classList.remove('lumen-playing');
    enter.disabled=true;status.textContent=text;
  }
  const offline=()=>close(P.closed);window.addEventListener('offline',offline);
  let timer,rejectLoad,downloadTimer,rejectDownload;
  async function load(){
    try{return await Promise.race([store.load(campaignId,p=>api.validate(p)),new Promise((_,reject)=>{
      rejectDownload=reject;downloadTimer=setTimeout(()=>reject(Error('PLAY_TIMEOUT')),45000);
    })]);}finally{clearTimeout(downloadTimer);rejectDownload=null;}
  }
  const dispose=()=>{
    if(!alive)return;alive=false;clearTimeout(timer);clearTimeout(downloadTimer);
    rejectLoad?.(Error('PLAY_CLOSED'));rejectDownload?.(Error('PLAY_CLOSED'));
    stopWatch();api?.stop();frame.remove();element.classList.remove('lumen-playing');window.removeEventListener('offline',offline);
  };
  // Return cleanup immediately so route/sign-in changes cancel even a slow frame load.
  void (async()=>{
    try{
      api=await new Promise((resolve,reject)=>{
        rejectLoad=reject;timer=setTimeout(()=>reject(Error('EDITOR_UNAVAILABLE')),45000);
        frame.onload=()=>{clearTimeout(timer);const bridge=frame.contentWindow?.LumenEditor;
          if(bridge?.play)resolve(bridge);else reject(Error('EDITOR_UNAVAILABLE'));};
        frame.onerror=()=>{clearTimeout(timer);reject(Error('EDITOR_UNAVAILABLE'));};
      });
      rejectLoad=null;if(!current()||invalidated)return;
      const loaded=await load();
      if(!current()||invalidated)return;
      details.textContent=loaded.payload.mapName+' · '+loaded.payload.revision;
      status.textContent=P.ready;enter.disabled=false;
      let elapsedMinutes=loaded.session.elapsedMinutes||0,workMinutes=loaded.session.workMinutes||0;
      stopWatch=store.watch(campaignId,loaded.context,loaded.session,()=>close(P.closed),(minutes,work)=>{elapsedMinutes=minutes;workMinutes=work;});
      let openClock=null;
      if(loaded.context.rulesetId==='dnd'&&loaded.context.uid===loaded.context.ownerUid){
        const form=document.createElement('form'),duration=document.createElement('input');
        const label=document.createElement('label'),advance=document.createElement('button');
        const activity=document.createElement('select'),pace=document.createElement('select');
        for(const [value,text] of Object.entries(P.activities))activity.add(new Option(text,value));
        for(const [value,text] of Object.entries(P.paces))pace.add(new Option(text,value));
        activity.setAttribute('aria-label',P.activity);pace.setAttribute('aria-label',P.pace);
        pace.value='3';activity.value='work';
        const unit=document.createElement('span');label.append(unit);
        function configure(){
          const travel=activity.value==='travel';pace.hidden=!travel;
          unit.textContent=travel?P.miles:P.elapsed;duration.step=travel?'0.1':'1';
          duration.min=travel?'0.1':'1';duration.max=travel?24*Number(pace.value):1440;
          duration.value=travel?'3':'60';
        }
        pace.onchange=()=>{duration.max=24*Number(pace.value);};
        activity.onchange=configure;duration.type='number';duration.min=1;duration.max=1440;duration.value=60;
        duration.required=true;label.append(duration);advance.textContent=P.advance;
        configure();form.append(activity,label,pace,advance);
        const dialog=document.createElement('dialog'),title=document.createElement('h2');
        const done=document.createElement('button'),feedback=document.createElement('p');
        title.textContent=P.clock;done.type='button';done.textContent=P.closeClock;
        done.onclick=()=>dialog.close();feedback.setAttribute('role','status');
        dialog.append(title,form,feedback,done);dialog.setAttribute('aria-label',P.clock);element.append(dialog);
        openClock=()=>{if(current()&&!invalidated&&!dialog.open)dialog.showModal();};
        const setup=document.createElement('button');setup.textContent=P.clock;setup.onclick=openClock;
        element.insertBefore(setup,enter);
        form.onsubmit=async event=>{
          event.preventDefault();if(!current()||invalidated||advance.disabled)return;
          advance.disabled=true;
          try{
            const amount=Number(duration.value);
            const minutes=activity.value==='travel'?Math.ceil(60*amount/Number(pace.value)):amount;
            await store.advanceTime(campaignId,loaded.session,minutes,activity.value);
            feedback.textContent=P.advanced;
          }
          catch{feedback.textContent=P.timeError;}finally{advance.disabled=false;}
        };
      }
      enter.onclick=async()=>{
        if(!current()||invalidated||enter.disabled)return;enter.disabled=true;status.textContent=P.loading;
        try{
          // Re-read from the server at the actual entry gesture; no cached authorization.
          const fresh=await load();
          if(!current()||invalidated)return;
          if(fresh.session.releaseId!==loaded.session.releaseId)throw Error('PLAY_CHANGED');
          frame.hidden=false;element.classList.add('lumen-playing');
          api.setRuleset(fresh.context.rulesetId);
          api.play(fresh.payload.project,()=>{
            if(!current()||invalidated)return;
            frame.hidden=true;element.classList.remove('lumen-playing');status.textContent=P.returned;enter.disabled=false;
          },()=>({campaignId,minutes:elapsedMinutes,workMinutes}),openClock);
        }catch{if(current())close(P.closed);}
      };
    }catch(error){if(current())close(error.message==='PLAY_CLOSED'?P.waiting:P.error);}
  })();
  return dispose;
}
