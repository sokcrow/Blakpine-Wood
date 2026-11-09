/* Control del estado crítico. Las tiradas se inician solo con acción del jugador. */
(function(root){
 'use strict';
 function mount(runtime,save){
  const doc=root.document,T=root.FH_SURVIVAL_TEXT;
  if(!doc?.body||!runtime||!T)return null;
  const screen=doc.createElement('div');
  screen.id='fh-survival-critical';
  screen.hidden=true;
  screen.style.cssText='position:fixed;inset:0;z-index:240;display:none;align-items:center;justify-content:center;background:#080b12c9;touch-action:none;padding:16px';
  const panel=doc.createElement('section');
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-modal','true');
  panel.style.cssText='max-width:380px;width:100%;padding:22px;background:#151e27;border:2px solid #a27576;color:#eee5df;box-shadow:5px 5px 0 #07080b;font-family:system-ui,sans-serif;text-align:center';
  const title=doc.createElement('h2'),status=doc.createElement('p'),result=doc.createElement('p'),button=doc.createElement('button');
  title.style.cssText='font-size:20px;margin:0 0 12px';
  status.style.cssText='margin:0 0 18px;font-size:14px';
  result.style.cssText='min-height:22px;font-size:13px';
  button.type='button';
  button.style.cssText='min-height:48px;padding:11px 16px;color:white;background:#603839;border:2px solid #e49b9b;font-weight:700;cursor:pointer';
  button.textContent=T.deathRoll;
  panel.append(title,status,result,button);screen.append(panel);doc.body.appendChild(screen);
  const stop=e=>{if(screen.hidden)return;e.preventDefault();e.stopImmediatePropagation();};
  doc.addEventListener('keydown',stop,true);
  doc.addEventListener('keyup',stop,true);
  screen.addEventListener('pointerdown',e=>{if(e.target!==button)e.stopPropagation()});
  let lastStatus='';
  function update(){
   const c=runtime.state.critical;
   const showing=!!c;
   screen.hidden=!showing;
   screen.style.display=showing?'flex':'none';
   if(!showing){lastStatus='';return}
   title.textContent=c.status==='critical'?T.critical:c.status==='stable'?T.stable:T.dead;
   status.textContent=T.saves(c.successes,c.failures);
   button.hidden=c.status!=='critical';
   if(lastStatus!==c.status&&c.status!=='critical')result.textContent='';
   lastStatus=c.status;
  }
  button.addEventListener('click',e=>{
   e.preventDefault();e.stopPropagation();
   const roll=runtime.deathSave(1);
   if(roll.ok)result.textContent=T.lastRoll(roll.success,roll.faces);
   update();
   save?.();
  });
  update();
  return Object.freeze({update,dispose(){doc.removeEventListener('keydown',stop,true);doc.removeEventListener('keyup',stop,true);screen.remove()}});
 }
 root.FHSurvivalUI=Object.freeze({mount});
})(typeof window!=='undefined'?window:globalThis);