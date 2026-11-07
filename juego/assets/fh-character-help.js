/* Blakpine Wood — un controlador de tooltips para creador y hoja de personaje. */
(function(global){
 'use strict';
 const T=global.FH_CHARACTER_HELP_TEXT,doc=global.document;
 if(!T||!doc)return;
 const catalogs=Object.freeze({score:T.scores,skill:T.skills,resource:T.resources});
 let active=null,tooltip=null,mode=null;
 const lookup=(type,id)=>{
  if(!Object.hasOwn(catalogs,type)||!Object.hasOwn(catalogs[type],id))return null;
  return Object.freeze({type,id,...catalogs[type][id]});
 };
 const make=(tag,klass,value)=>{
  const el=doc.createElement(tag);if(klass)el.className=klass;
  if(value!==undefined)el.textContent=value;
  return el;
 };
 const unbind=()=>{
  if(active){
   active.setAttribute('aria-expanded','false');
   active.removeAttribute?.('aria-describedby');
  }
  tooltip?.remove?.();
  active=null;tooltip=null;mode=null;
 };
 function position(){
  if(!active||!tooltip)return;
  const r=active.getBoundingClientRect?.();
  if(!r)return;
  const width=global.innerWidth||doc.documentElement?.clientWidth||390;
  const height=global.innerHeight||doc.documentElement?.clientHeight||800;
  const tipRect=tooltip.getBoundingClientRect?.();
  const tw=tipRect?.width||320,th=tipRect?.height||160;
  tooltip.style.left=Math.round(Math.max(10,Math.min(r.left,width-tw-10)))+'px';
  const under=r.bottom+9,above=r.top-th-9;
  tooltip.style.top=Math.round(Math.max(10,Math.min(height-th-10,under+th>height-10?above:under)))+'px';
 }
 function show(button,modeName){
  const type=button.getAttribute('data-fh-help-type');
  const id=button.getAttribute('data-fh-help-id');
  const data=lookup(type,id);
  if(!data)return;
  unbind();
  active=button;mode=modeName;
  const pop=make('section','fh-help-tooltip');
  pop.id='fh-help-tooltip';pop.setAttribute('role','tooltip');
  const title=make('strong','fh-help-title',data.name);
  pop.append(title);
  const rows=[
   [T.what,data.description],
   [T.where,data.uses],
   [T.impact,type==='skill'?T.skillRule+' '+data.systems:type==='score'?T.scoreRule+' '+data.systems:data.systems]
  ];
  for(const [heading,detail] of rows){
   const block=make('div','fh-help-line');
   block.append(make('span','fh-help-kicker',heading),make('p','fh-help-description',detail));
   pop.append(block);
  }
  doc.body.append(pop);
  tooltip=pop;
  button.setAttribute('aria-expanded','true');
  button.setAttribute('aria-describedby',pop.id);
  position();
 }
 function button(type,id){
  const data=lookup(type,id);
  if(!data)return null;
  const trigger=make('button','fh-help-trigger','?');
  trigger.type='button';
  trigger.setAttribute('aria-label',T.open+' '+data.name);
  trigger.setAttribute('aria-expanded','false');
  trigger.setAttribute('data-fh-help-type',type);
  trigger.setAttribute('data-fh-help-id',id);
  trigger.addEventListener('click',event=>{
   event.stopPropagation?.();
   if(active===trigger){
    if(mode==='hover'||mode==='focus')mode='pinned';
    else unbind();
   }else show(trigger,'pinned');
  });
  trigger.addEventListener('mouseenter',()=>{if(mode!=='pinned')show(trigger,'hover')});
  trigger.addEventListener('mouseleave',()=>{if(active===trigger&&mode==='hover')unbind()});
  trigger.addEventListener('focus',()=>{if(!active)show(trigger,'focus')});
  trigger.addEventListener('blur',()=>{if(active===trigger&&mode==='focus')unbind()});
  return trigger;
 }
 doc.addEventListener?.('pointerdown',event=>{
  if(active&&event.target!==active&&!active.contains?.(event.target)&&
    event.target!==tooltip&&!tooltip?.contains?.(event.target))unbind();
 },true);
 doc.addEventListener?.('focusin',event=>{
  if(active&&mode==='pinned'&&event.target!==active&&!active.contains?.(event.target))unbind();
 },true);
 global.addEventListener?.('keydown',event=>{
  if(active&&event.key==='Escape'){
   event.preventDefault?.();event.stopImmediatePropagation?.();
   const trigger=active;unbind();trigger.focus?.();
  }
 },true);
 global.addEventListener?.('resize',unbind,{passive:true});
 global.addEventListener?.('scroll',unbind,{capture:true,passive:true});
 global.FHCharacterHelp=Object.freeze({lookup,button,close:unbind,isOpen:()=>Boolean(active)});
 if(typeof module==='object'&&module.exports)module.exports=global.FHCharacterHelp;
})(typeof window!=='undefined'?window:globalThis);
