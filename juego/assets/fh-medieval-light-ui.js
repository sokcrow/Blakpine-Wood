/* Acciones explícitas sobre el inventario y el estado común de iluminación. */
(function(root){
 'use strict';
 function create({runtime,state,canUse,changed,document:doc=root.document,text:provided}={}){
  const T=provided||root.FH_MEDIEVAL_LIGHT_TEXT;
  let target=null,previousFocus=null;
  const overlay=doc.createElement('section');overlay.id='fhMedievalLightPanel';overlay.hidden=true;
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','fhMedievalLightTitle');
  overlay.style.cssText='position:fixed;inset:0;z-index:85;background:#090704de;display:grid;place-items:center;padding:16px;';
  const panel=doc.createElement('div');panel.style.cssText='width:min(420px,100%);max-height:90dvh;overflow:auto;background:#211c16;color:#fff0d2;border:1px solid #bb9866;padding:20px;';
  overlay.append(panel);doc.body.append(overlay);
  const style=doc.createElement('style');style.textContent='#fhMedievalLightPanel[hidden]{display:none!important}#fhMedievalLightPanel button{min-height:44px;margin:5px;padding:9px 14px;background:#3d3022;color:#fff0d2;border:1px solid #bb9866}#fhMedievalLightPanel button:focus-visible{outline:3px solid #ffe4a9}';doc.head.append(style);
  function close(){target=null;overlay.hidden=true;previousFocus?.focus?.();}
  function add(tag,value){const el=doc.createElement(tag);el.textContent=value;panel.append(el);return el;}
  function button(label,run,disabled=false){const el=add('button',label);el.type='button';el.disabled=disabled;el.onclick=run;return el;}
  function render(message=''){
   if(!target)return;
   const {floor,item}=target,slot=runtime.view(item.id),spec=root.FHMedievalLighting.preset(item.lightKind);
   if(!slot){close();return;}
   panel.replaceChildren();add('h2',item.label||T.title).id='fhMedievalLightTitle';
   add('p',runtime.lit(floor,item)?T.burning:T.unlit);
   if(spec.fuelItem){
    add('p',T.fuel+': '+T.fuels[spec.fuelItem]);
    add('p',T.remaining+': '+Math.ceil(slot.remaining));
    const count=(state.inventory||[]).filter(id=>id===spec.fuelItem).length;
    add('p',T.available+': '+count);
    button(T.refill,()=>perform('refuel'),count===0||slot.remaining>=spec.fuelMinutes);
   }else add('p',T.unlimited);
   button(slot.on?T.extinguish:T.ignite,()=>perform(slot.on?'off':'on'),!slot.on&&slot.remaining===0);
   if(item.lightKind==='torch_hand')button(runtime.isCarried(item.id)?T.drop:T.carry,
    ()=>perform(runtime.isCarried(item.id)?'drop':'carry'));
   const status=add('p',message);status.setAttribute('role','status');status.setAttribute('aria-live','polite');
   button(T.close,close);
  }
  function perform(action){
   if(!target)return;
   const {floor,item}=target;
   if(!canUse(floor,item)){close();changed({ok:false,reason:'outOfReach'});return;}
   const result=runtime.act(floor,item,action);changed(result);
   render(T[result.action||result.reason]||T.missing);
  }
  overlay.addEventListener('click',event=>{if(event.target===overlay)close();event.stopPropagation();});
  overlay.addEventListener('keydown',event=>{
   event.stopPropagation();
   if(event.key==='Escape'){event.preventDefault();close();return;}
   if(event.key==='Tab'){
    const buttons=Array.from(panel.querySelectorAll('button')).filter(b=>!b.disabled),first=buttons[0],last=buttons.at(-1);
    if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first?.focus();}
   }
  });
  function refresh(){if(target){const active=doc.activeElement?.textContent;render();Array.from(panel.querySelectorAll('button')).find(b=>b.textContent===active&&!b.disabled)?.focus();}}
  function open(floor,item){runtime.tick();previousFocus=doc.activeElement;target={floor,item};overlay.hidden=false;render();panel.querySelector('button:not(:disabled)')?.focus();return true;}
  return Object.freeze({open,close,refresh,isOpen:()=>target!==null});
 }
 root.FHMedievalLightUI=Object.freeze({create});
})(typeof globalThis!=='undefined'?globalThis:this);
