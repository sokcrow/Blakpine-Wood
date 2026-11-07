/* Indicadores de exploración: solo presentación; los recursos pertenecen a GameState. */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHStatusHUD=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
 'use strict';
 const KEYS=Object.freeze(['pg','sp','pe']);
 const FALLBACK=Object.freeze({
  title:'Estado del personaje',
  pg:'PG',pgFull:'Puntos de golpe',
  sp:'SP',spFull:'Puntos de sanidad',
  pe:'PE',peFull:'Puntos de energía',poison:'Veneno'
 });
 let host=null,panel=null,rows=null,peCells=[],previous={},pendingChanges={};

 function reading(resources,key){
  if(!resources||!KEYS.includes(key))return null;
  const current=resources[key],maximum=resources[key+'Max'];
  if(typeof current!=='number'||typeof maximum!=='number'||
     !Number.isFinite(current)||!Number.isFinite(maximum)||maximum<=0)return null;
  const max=key==='pe'?Math.floor(maximum):maximum;
  if(max<=0)return null;
  const value=key==='pe'?Math.floor(current):current;
  const bounded=Math.min(max,Math.max(0,value));
  return {current:bounded,maximum:max,percent:100*bounded/max};
 }
 function segmentStates(resources){
  const data=reading(resources,'pe');
  if(!data)return [];
  return Array.from({length:data.maximum},(_,index)=>index<data.current);
 }
 function node(doc,tag,className,textContent){
  const element=doc.createElement(tag);
  if(className)element.className=className;
  if(textContent!==undefined)element.textContent=textContent;
  return element;
 }
 function labels(){
  return root.FH_STATUS_TEXT||FALLBACK;
 }
 function buildRow(doc,key){
  const strings=labels();
  const row=node(doc,'div','fh-status-row fh-status-row--'+key);
  const heading=node(doc,'div','fh-status-heading');
  const caption=node(doc,'span','fh-status-label',strings[key]);
  const value=node(doc,'span','fh-status-count');
  heading.append(caption,value);
  const track=node(doc,'div','fh-status-track fh-status-track--'+key);
  track.setAttribute('role','progressbar');
  track.setAttribute('aria-label',strings[key+'Full']);
  track.setAttribute('aria-valuemin','0');
  const fill=key==='pe'?null:node(doc,'span','fh-status-fill fh-status-fill--'+key);
  if(fill)track.append(fill);
  row.append(heading,track);
  return {row,track,fill,value};
 }
 function ensure(){
  const doc=root.document,hud=doc?.getElementById('hud');
  if(!hud||!hud.classList?.contains('fh-location-hud'))return false;
  if(hud===host&&panel?.isConnected)return true;
  if(panel)panel.remove();
  host=hud;peCells=[];previous={};pendingChanges={};
  const strings=labels();
  panel=node(doc,'section','fh-status-hud');
  panel.id='fhStatusHUD';
  panel.setAttribute('aria-label',strings.title);
  panel.hidden=true;
  rows={};
  for(const key of KEYS){
   rows[key]=buildRow(doc,key);
   panel.append(rows[key].row);
  }
  hud.insertAdjacentElement('afterend',panel);
  return true;
 }
 function syncPE(amount){
  const {track}=rows.pe;
  if(peCells.length!==amount){
   peCells=[];
   const fragment=root.document.createDocumentFragment();
   for(let i=0;i<amount;i++){
    const cell=node(root.document,'span','fh-status-pe-cell');
    cell.setAttribute('aria-hidden','true');
    peCells.push(cell);
    fragment.append(cell);
   }
   track.replaceChildren(fragment);
  }
 }
 function changeTone(key,delta,kind){
  if(!KEYS.includes(key)||typeof delta!=='number'||!Number.isFinite(delta)||delta===0)return null;
  if(kind==='poison'&&key==='pg'&&delta<0)return 'poison';
  if(delta>0)return key==='pe'?'pe-recover':key+'-heal';
  return key==='pe'?'pe-use':key+'-damage';
 }
 function changeLabel(key,delta,kind){
  if(!changeTone(key,delta,kind))return '';
  const amount=key==='pe'?Math.trunc(Math.abs(delta)):Math.round(Math.abs(delta)*10)/10;
  if(!amount)return '';
  const poison=kind==='poison'&&key==='pg'&&delta<0?(labels().poison||'Veneno')+' ':'';
  return poison+(delta>0?'+':'−')+amount+' '+key.toUpperCase();
 }
 function showChange(key,delta,kind){
  const tone=changeTone(key,delta,kind),label=changeLabel(key,delta,kind);
  if(!tone||!label||!ensure())return false;
  const row=rows[key].row;
  row.querySelector('.fh-status-change')?.remove();
  const notice=node(root.document,'span','fh-status-change fh-status-change--'+tone,label);
  notice.setAttribute('aria-hidden','true');
  row.append(notice);
  root.setTimeout?.(()=>notice.remove(),950);
  return true;
 }
 // El gameplay puede especificar "poison" antes de cambiar PG;
 // el siguiente update no repetirá el mismo número.
 function notify(key,delta,kind){
  if(!showChange(key,delta,kind))return false;
  pendingChanges[key]={delta,until:Date.now()+2000};
  return true;
 }
 function update(resources){
  if(!ensure())return false;
  let visible=false;
  for(const key of KEYS){
   const data=reading(resources,key),refs=rows[key];
   refs.row.hidden=!data;
   if(!data){previous[key]=null;delete pendingChanges[key];continue;}
   const prior=previous[key];
   if(prior!==undefined&&prior!==null&&data.current!==prior){
    const delta=data.current-prior,pending=pendingChanges[key];
    delete pendingChanges[key];
    if(!pending||pending.delta!==delta||Date.now()>pending.until)showChange(key,delta);
   }
   previous[key]=data.current;
   visible=true;
   refs.value.textContent=data.current+' / '+data.maximum;
   refs.track.setAttribute('aria-valuenow',String(data.current));
   refs.track.setAttribute('aria-valuemax',String(data.maximum));
   if(key==='pe'){
    syncPE(data.maximum);
    for(let i=0;i<peCells.length;i++)peCells[i].classList.toggle('is-filled',i<data.current);
   }else{
    const percent=data.percent+'%';
    if(refs.fill.style.width!==percent)refs.fill.style.width=percent;
   }
  }
  panel.hidden=!visible;
  return visible;
 }
 return Object.freeze({reading,segmentStates,changeTone,changeLabel,notify,update});
});
