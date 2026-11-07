/* Blakpine Wood — cuestionario narrativo previo al motor 3D. */
(function (global) {
 'use strict';
 const C=global.FHCharacterCore,T=global.FH_CHARACTER_TEXT;
 const H=global.FHCharacterHelp;
 if(!C||!T)throw Error('Faltan los datos del creador de personajes.');
 const doc=global.document;
 let pending=null;
 const el=(tag,cls,content)=>{
  const node=doc.createElement(tag);
  if(cls)node.className=cls;
  if(content!==undefined)node.textContent=content;
  return node;
 };
 function ensureCharacter() {
  const existing=C.current();
  if(existing)return Promise.resolve(existing);
  if(pending)return pending;
  if(!doc||!doc.body)return Promise.reject(Error(T.missingEngine));
  pending=new Promise(resolve=>openWizard(resolve,C.load()?.life==='dead'));
  return pending.finally(()=>{pending=null});
 }
 function openWizard(resolve,previousDead) {
  const state={step:0,origin:null,name:'',missingName:'',relationship:null,
   strengths:[],weaknesses:[],bonus:{}};
  const shell=el('div');shell.id='fhcc-root';
  const panel=el('section','fhcc-card');panel.setAttribute('role','dialog');
  panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','fhcc-title');
  panel.tabIndex=-1;
  const overline=el('p','fhcc-overline',T.chapter);
  const title=el('h1','fhcc-title fhcc-title-main',T.title);title.id='fhcc-title';
  const progress=el('div','fhcc-progress');progress.setAttribute('aria-hidden','true');
  const stepName=el('p','fhcc-step'),content=el('div'),error=el('p','fhcc-error');
  error.setAttribute('role','alert');error.hidden=true;
  const nav=el('div','fhcc-nav');
  const cancel=el('button','',T.cancel),back=el('button','',T.back),next=el('button','fhcc-primary',T.next);
  cancel.type=back.type=next.type='button';
  nav.append(cancel,back,next);
  panel.append(overline,title,progress,stepName,content,error,nav);shell.append(panel);doc.body.append(shell);
  const close=result=>{H?.close?.();shell.remove();global.removeEventListener('keydown',onKeys,true);resolve(result)};
  cancel.onclick=()=>close(null);
  back.onclick=()=>{if(state.step>0){state.step--;render();panel.scrollTop=0}};
  next.onclick=()=>{
   if(!ready())return;
   if(state.step<5){state.step++;render();panel.scrollTop=0;return}
   try{
    const profile=C.createProfile(state);
    close(C.store(profile));
   }catch(err){error.textContent=err.message||T.storageError;error.hidden=false}
  };
  const onKeys=e=>{
   if(!shell.isConnected)return;
   if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close(null);return}
   if(e.key!=='Tab')return;
   const usable=Array.from(panel.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled])'));
   if(!usable.length)return;
   const first=usable[0],last=usable[usable.length-1];
   if(e.shiftKey&&doc.activeElement===first){e.preventDefault();last.focus()}
   if(!e.shiftKey&&doc.activeElement===last){e.preventDefault();first.focus()}
  };
  global.addEventListener('keydown',onKeys,true);
  function ready() {
   if(state.step===0)return state.origin!==null;
   if(state.step===1)return state.name.trim().length>=2&&state.name.trim().length<=60&&
    state.missingName.trim().length<=60&&Boolean(state.relationship);
   if(state.step===2)return state.strengths.length===2;
   if(state.step===3)return state.weaknesses.length===2;
   if(state.step===4){try{C.calculate(state.strengths,state.weaknesses,state.bonus);return true}catch{return false}}
   return true;
  }
  const question=(heading,help)=>{
   content.append(el('h2','fhcc-question',heading),el('p','fhcc-help',help));
  };
  const selectOne=(label,key,value,detail)=>{
   const b=el('button','fhcc-choice');b.type='button';
   b.setAttribute('aria-pressed',String(state[key]===value));
   b.append(el('strong','',label));
   if(detail)b.append(el('span','',detail));
   b.onclick=()=>{state[key]=value;render()};
   return b;
  };
  const field=(label,key,placeholder,max=60)=>{
   const host=el('label','fhcc-field'),caption=el('span','',label),input=el('input');
   input.type='text';input.maxLength=max;input.value=state[key];input.placeholder=placeholder;
   input.addEventListener('input',()=>{state[key]=input.value;next.disabled=!ready()});
   host.append(caption,input);return host;
  };
  function choiceScore(k,list) {
   const selected=state[list].includes(k);
   const disabled=!selected&&state[list].length>=2;
   const b=el('button','fhcc-choice');b.type='button';
   b.setAttribute('aria-pressed',String(selected));b.disabled=disabled;
   b.append(el('strong','',T.scoreNames[k]),el('span','',T.scoreDescriptions[k]));
   b.onclick=()=>{
    const current=state[list];
    state[list]=selected?current.filter(x=>x!==k):[...current,k];
    state.bonus={};render();
   };
   const wrapper=el('div','fhcc-score-choice');
   wrapper.append(b);
   const info=H?.button?.('score',k);if(info)wrapper.append(info);
   return wrapper;
  }
  function value(k){return (state.strengths.includes(k)?5:state.weaknesses.includes(k)?1:3)+(state.bonus[k]||0)}
  function canRaise(k) {
   if(state.weaknesses.includes(k))return false;
   if(Object.values(state.bonus).reduce((a,b)=>a+b,0)>=4||value(k)>=6)return false;
   return value(k)!==5||C.SCORES.filter(id=>value(id)===6).length<2;
  }
  function change(k,direction) {
   const current=state.bonus[k]||0;
   if(direction>0&&!canRaise(k))return;
   if(direction<0&&current<=0)return;
   state.bonus[k]=current+direction;render();
   const moved=content.querySelector('[data-score="'+k+'"][data-direction="'+direction+'"]');
   moved?.focus();
  }
  function summaryCard(label,valueNode) {
   const card=el('section');card.append(el('h3','',label));
   if(typeof valueNode==='string')card.append(el('p','',valueNode));else card.append(valueNode);
   return card;
  }
  function render() {
   H?.close?.();
   content.replaceChildren();error.hidden=true;progress.replaceChildren();
   for(let i=0;i<6;i++){const seg=el('span','fhcc-segment'+(i<=state.step?' active':''));progress.append(seg)}
   stepName.textContent=T.progress(state.step+1,6)+' · '+T.steps[state.step];
   if(state.step===0){
    question(T.originTitle,T.originHelp);
    const choices=el('div','fhcc-choices');
    choices.append(selectOne(T.resident,'origin','resident',T.residentDetail),
     selectOne(T.visitor,'origin','newcomer',T.visitorDetail));
    content.append(choices);
    if(previousDead)content.append(el('p','fhcc-note',T.dead));
   }else if(state.step===1){
    question(T.identityTitle,T.identityHelp);
    content.append(field(T.name,'name',T.namePlaceholder));
    const sub=el('p','fhcc-question',T.missingTitle);content.append(sub);
    content.append(field(T.missingName,'missingName',T.missingPlaceholder));
    const relation=el('label','fhcc-field');relation.append(el('span','',T.relationship));
    const select=el('select'),option=el('option','',T.relationship);option.value='';
    option.disabled=true;option.selected=!state.relationship;select.append(option);
    for(const key of C.RELATIONS){const item=el('option','',T.relations[key]);item.value=key;select.append(item)}
    select.value=state.relationship||'';select.onchange=()=>{state.relationship=select.value;next.disabled=!ready()};
    relation.append(select);content.append(relation);
   }else if(state.step===2||state.step===3){
    const strength=state.step===2,list=strength?'strengths':'weaknesses';
    question(strength?T.strengthsTitle:T.weaknessTitle,strength?T.strengthsHelp:T.weaknessHelp);
    const choices=el('div','fhcc-choices');
    for(const key of C.SCORES){if((strength?state.weaknesses:state.strengths).includes(key))continue;
     choices.append(choiceScore(key,list))}
    content.append(choices);
   }else if(state.step===4){
    question(T.bonusTitle,T.bonusHelp);
    const spent=Object.values(state.bonus).reduce((a,b)=>a+b,0);
    content.append(el('p','fhcc-points',T.remaining+': '+(4-spent)+' / 4'));
    for(const key of C.SCORES){
     const row=el('div','fhcc-score-row'),name=el('span','fhcc-score-name');
     name.append(el('span','',T.scoreNames[key]),el('small','',T.scoreDescriptions[key]));
     const minus=el('button','fhcc-adjust','−'),plus=el('button','fhcc-adjust','+');
     minus.type=plus.type='button';minus.disabled=!(state.bonus[key]>0);
     plus.disabled=!canRaise(key);minus.setAttribute('aria-label','Reducir '+T.scoreNames[key]);
     plus.setAttribute('aria-label','Aumentar '+T.scoreNames[key]);
     minus.setAttribute('data-score',key);plus.setAttribute('data-score',key);
     minus.setAttribute('data-direction','-1');plus.setAttribute('data-direction','1');
     minus.onclick=()=>change(key,-1);plus.onclick=()=>change(key,1);
     const output=el('output','',String(value(key)));
     const info=H?.button?.('score',key);if(info)name.append(info);
     row.append(name,minus,output,plus);content.append(row);
    }
   }else{
    question(T.summaryTitle,T.summaryHelp);
    const summary=el('div','fhcc-summary');
    summary.append(summaryCard(T.name,state.name.trim()),
     summaryCard(T.summaryOrigin,state.origin==='resident'?T.resident:T.visitor),
     summaryCard(T.summaryMissing,T.relations[state.relationship]+(state.missingName.trim()?' · '+state.missingName.trim():'')));
    const scores=el('div','fhcc-summary-grid');
    for(const key of C.SCORES){
     const item=el('span','fhcc-summary-stat',key+' '+value(key));
     const info=H?.button?.('score',key);if(info)item.append(info);
     scores.append(item);
    }
    summary.append(summaryCard(T.summaryStats,scores));
    const r=C.resources(Object.fromEntries(C.SCORES.map(k=>[k,value(k)])));
    const resources=el('div','fhcc-summary-resources');
    for(const [key,text] of [['pg','PG '+r.pgMax],['sp','SP '+r.spMax],['pe','PE '+r.peMax]]){
     const item=el('span','fhcc-summary-stat',text);
     const info=H?.button?.('resource',key);if(info)item.append(info);
     resources.append(item);
    }
    summary.append(summaryCard(T.summaryResources,resources));
    content.append(summary,el('p','fhcc-note',T.summaryPending),el('p','fhcc-help',T.days));
   }
   back.disabled=state.step===0;
   next.disabled=!ready();next.textContent=state.step===5?T.finish:T.next;
   panel.focus();
  }
  render();
 }
 global.FHCharacterCreation=Object.freeze({
  ensureCharacter,current:()=>C.current(),markDead:id=>C.markDead(id),
  selectMapSave:(raw,id)=>C.selectMapSave(raw,id),syncResourcesFromSave:(raw,id)=>C.syncResourcesFromSave(raw,id)
 });
})(typeof window!=='undefined'?window:globalThis);
