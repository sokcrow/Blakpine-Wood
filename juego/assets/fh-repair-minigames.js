/* Blakpine-Wood — ventana interactiva de mantenimiento en pixel art. */
(function(root){
 'use strict';
 const Core=root.FHRepairMiniCore;
 const T=root.FH_REPAIR_MINI_TEXT;
 let overlay=null,frame=null,returnFocus=null,active=null;
 const node=(tag,cls='',value)=>{
  const el=root.document.createElement(tag);
  if(cls)el.className=cls;
  if(value!==undefined)el.textContent=value;
  return el;
 };
 function button(parent,label,key,handler,cls='',disabled=false){
  const b=node('button',cls,label);
  b.type='button';b.dataset.repairKey=key;b.disabled=!!disabled;
  b.addEventListener('click',handler);
  parent.append(b);return b;
 }
 function stopGameKeys(event){
  if(!active)return;
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();return;}
  if(event.key==='Tab'){
   const controls=[...frame.querySelectorAll('button:not(:disabled)')];
   if(!controls.length)return;
   const first=controls[0],last=controls[controls.length-1];
   if(event.shiftKey&&root.document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&root.document.activeElement===last){event.preventDefault();first.focus();}
   return;
  }
  // Las teclas de movimiento no deben alcanzar al motor mientras se trabaja.
  if(!['Enter',' ','Spacebar'].includes(event.key)){
   event.preventDefault();event.stopImmediatePropagation();
  }
 }
 function ensure(){
  if(overlay||!root.document?.body)return !!overlay;
  overlay=node('div');overlay.id='fhRepairMini';overlay.hidden=true;
  frame=node('section','fh-rm-frame');frame.setAttribute('role','dialog');
  frame.setAttribute('aria-modal','true');frame.setAttribute('aria-label',T.title);
  overlay.append(frame);root.document.body.append(overlay);
  overlay.addEventListener('pointerdown',e=>e.stopPropagation());
  overlay.addEventListener('click',e=>e.stopPropagation());
  return true;
 }
 function close(){
  if(!active)return false;
  active=null;overlay.hidden=true;frame.replaceChildren();
  root.removeEventListener('keydown',stopGameKeys,true);
  returnFocus?.focus?.();returnFocus=null;
  return true;
 }
 function progressOf(v){
  if(v.kind==='generator'||v.kind==='electronics')
   return v.values.filter((x,i)=>x===v.target[i]).length;
  if(v.kind==='wires')return v.paired.length;
  return v.progress;
 }
 function action(input,key){
  if(!active||active.finished)return;
  const result=active.session.act(input);
  if(!result.changed)return;
  if(result.completed){
   const response=active.service?.repairDamage?.(active.floor,active.item.id);
   if(response?.ok===true){
    active.finished=true;active.feedback=T.ready;
    active.onRepaired?.(active.item,active.floor,response);
   }else{
    active.finished=true;active.feedback=T.repairFailed;
   }
  }else if(!result.correct)active.feedback=T.wrong;
  else active.feedback=result.kind==='wires'&&result.selected!==null?T.wirePending:
    result.kind==='generator'||result.kind==='electronics'?T.aligned:T.correct;
  render(key);
 }
 function drawSequence(stage,v,words){
  const data=words.kinds[v.kind],order=data.names;
  stage.append(node('div','fh-rm-section-label',data.order));
  stage.append(node('div','fh-rm-order',v.target.map(i=>order[i]).join('  ▸  ')));
  const switches=node('div','fh-rm-grid fh-rm-switches');
  for(let i=0;i<4;i++){
   const done=v.target.slice(0,v.progress).includes(i);
   button(switches,order[i],'sequence-'+i,()=>action({type:'press',index:i},'sequence-'+i),done?'is-done':'');
  }
  stage.append(switches);
 }
 function drawGenerator(stage,v,words){
  const data=words.kinds.generator,grid=node('div','fh-rm-controls');
  for(let i=0;i<v.values.length;i++){
   const done=v.values[i]===v.target[i],cell=node('div','fh-rm-cell'+(done?' is-done':''));
   cell.append(node('div','fh-rm-label',data.names[i]));
   cell.append(node('div','fh-rm-value',String(v.values[i])));
   cell.append(node('div','fh-rm-target',data.target+': '+v.target[i]));
   const controls=node('div','fh-rm-button-row');
   button(controls,'−','dial-less-'+i,()=>action({type:'dial',index:i,delta:-1},'dial-less-'+i),'',false)
    .setAttribute('aria-label',data.less+' '+data.names[i]);
   button(controls,'+','dial-more-'+i,()=>action({type:'dial',index:i,delta:1},'dial-more-'+i),'',false)
    .setAttribute('aria-label',data.more+' '+data.names[i]);
   cell.append(controls);grid.append(cell);
  }
  stage.append(grid);
 }
 function drawElectronics(stage,v,words){
  const data=words.kinds.electronics,grid=node('div','fh-rm-grid');
  const signs=['└','┌','┐','┘'];
  for(let i=0;i<4;i++){
   const done=v.values[i]===v.target[i],cell=node('div','fh-rm-cell'+(done?' is-done':''));
   cell.append(node('div','fh-rm-label',data.names[i]));
   cell.append(node('div','fh-rm-track',signs[v.values[i]]));
   cell.append(node('div','fh-rm-track-reference',data.target+': '+signs[v.target[i]]));
   button(cell,data.turn,'rotate-'+i,()=>action({type:'rotate',index:i},'rotate-'+i));
   grid.append(cell);
  }
  stage.append(grid);
 }
 function drawWires(stage,v,words){
  const data=words.kinds.wires,cols=node('div','fh-rm-wirecols');
  for(const side of ['left','right']){
   const col=node('div');
   col.append(node('div','fh-rm-section-label',data[side]));
   for(let i=0;i<4;i++){
    const real=side==='right'?v.wireEnds[i]:i;
    const done=v.paired.includes(real);
    const selected=side==='left'&&v.selected===real;
    const label=data.symbols[real]+' '+data.names[real];
    const id=side+'-'+i;
    button(col,label,id,()=>action({type:side,index:i},id),
     'fh-rm-wire'+(selected?' is-selected':'')+(done?' is-done':''),done);
   }
   cols.append(col);
  }
  stage.append(cols);
 }
 function render(focusKey=''){
  if(!active)return;
  const {session,damage,finished,feedback}=active;
  const v=session.view(),data=T.kinds[v.kind];
  frame.replaceChildren();
  frame.append(node('div','fh-rm-eyebrow',T.eyebrow));
  frame.append(node('h2','',data.title));
  frame.append(node('p','fh-rm-damage',T.damage(damage)));
  frame.append(node('p','fh-rm-hint',data.hint));
  const stage=node('div','fh-rm-stage');
  if(finished){
   stage.append(node('div','fh-rm-complete',feedback===T.ready?T.repaired:T.repairFailed));
  }else if(v.kind==='breaker'||v.kind==='ats')drawSequence(stage,v,T);
  else if(v.kind==='generator')drawGenerator(stage,v,T);
  else if(v.kind==='electronics')drawElectronics(stage,v,T);
  else drawWires(stage,v,T);
  frame.append(stage);
  const line=node('p','fh-rm-message',finished?feedback:feedback||'');
  line.setAttribute('role','status');line.setAttribute('aria-live','polite');frame.append(line);
  const footer=node('footer','fh-rm-foot');
  footer.append(node('span','fh-rm-progress',T.progress(progressOf(v),data.progressTotal)));
  button(footer,finished?T.finish:T.cancel,'close',close,finished?'fh-rm-finish':'fh-rm-cancel');
  frame.append(footer);
  if(focusKey){
   const next=[...frame.querySelectorAll('[data-repair-key]')].find(b=>b.dataset.repairKey===focusKey&&!b.disabled);
   (next||frame.querySelector('button:not(:disabled)'))?.focus();
  }
 }
 function open({item,floor,service,onRepaired}={}){
  const kind=Core?.kindFor(item),damage=Core?.damageFor(service,item)||0;
  if(!kind||!(damage>0)||!Number.isInteger(floor)||!service?.itemAt||service.itemAt(floor,item.id)!==item
   ||typeof service.repairDamage!=='function')return false;
  if(!ensure())return false;
  if(active)close();
  returnFocus=root.document.activeElement;
  active={item,floor,service,damage,session:Core.createSession(kind),onRepaired,finished:false,feedback:''};
  overlay.hidden=false;
  root.addEventListener('keydown',stopGameKeys,true);
  render();
  frame.querySelector('button:not(:disabled)')?.focus();
  return true;
 }
 root.FHRepairMiniGames=Object.freeze({open,close,isOpen:()=>!!active,
  supports:item=>!!Core?.kindFor(item)});
})(typeof window!=='undefined'?window:globalThis);
