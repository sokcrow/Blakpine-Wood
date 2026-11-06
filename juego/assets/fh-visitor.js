/* Forest Horror — evento de visitante en puertas.
 * El controlador no crea NPC ni altera colisiones, luz o visibilidad.
 * visitorEvent es opcional en cada puerta de forest-horror-map-v1.
 */
(function(global){
'use strict';
const TEXT=global.FH_VISITOR_TEXT||{};
const phrase=(value,fallback)=>typeof value==='string'&&value.trim()?value.trim():fallback;
function normalizeEvent(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const description=phrase(raw.description,'');
 const line=phrase(raw.line,'');
 const choices=Array.isArray(raw.choices)?raw.choices.filter(c=>c&&typeof c==='object'&&phrase(c.label,'')&&c.id!=='open').map(c=>({
  id:phrase(c.id,c.label),label:c.label.trim(),reply:phrase(c.reply,''),close:c.close===true,
  choices:Array.isArray(c.choices)?c.choices:null
 })):[];
 if(!description&&!line&&!choices.length)return null;
 return {id:phrase(raw.id,'visitor'),description:description||TEXT.unknownNoise||'Escuchas algo al otro lado de la puerta.',
  line,choices};
}
function createRuntime(options={}){
 let active=null,root=null,body=null,buttons=null;
 function ensureDialog(){
  if(root)return root;
  const style=document.createElement('style');
  style.textContent=
   '#fhVisitorDialog{position:fixed;inset:0;z-index:72;display:none;align-items:flex-end;justify-content:center;padding:12px;background:#0008;pointer-events:auto}'+
   '#fhVisitorDialog.open{display:flex}#fhVisitorDialog.peephole{background:transparent;pointer-events:none;justify-content:flex-end}'+
   '#fhVisitorCard{max-height:min(56dvh,360px);overflow:auto;pointer-events:auto;width:min(520px,calc(100vw - 24px));padding:14px;background:#11171bf5;border:1px solid #a68b68;color:#f1e5d0;box-shadow:0 9px 28px #000a;font:14px/1.5 Georgia,serif}'+
   '#fhVisitorDialog.peephole #fhVisitorCard{width:min(410px,calc(100vw - 24px));max-height:min(46dvh,280px)}'+
   '#fhVisitorText{white-space:pre-line;min-height:34px}#fhVisitorActions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}'+
   '#fhVisitorActions button{min-height:44px;border:1px solid #857156;background:#272d30;color:#f3e9d7;padding:9px 12px;font:600 13px system-ui;cursor:pointer;touch-action:manipulation}'+
   '#fhVisitorActions button:focus-visible{outline:2px solid #f4cc85;outline-offset:2px}'+
   '@media (orientation:landscape) and (max-height:480px){#fhVisitorDialog #fhVisitorCard{max-height:70dvh}}';
  document.head.append(style);
  root=document.createElement('div');root.id='fhVisitorDialog';root.setAttribute('role','dialog');
  root.setAttribute('aria-label',TEXT.dialogTitle||'Visitante en la puerta');
  const card=document.createElement('div');card.id='fhVisitorCard';
  body=document.createElement('div');body.id='fhVisitorText';body.setAttribute('aria-live','polite');
  buttons=document.createElement('div');buttons.id='fhVisitorActions';
  card.append(body,buttons);root.append(card);document.body.append(root);
  return root;
 }
 function close(){
  if(!active)return;
  active=null;
  if(root)root.classList.remove('open','peephole');
  options.freeze?.(false);
 }
 function show(message,choices){
  ensureDialog();
  body.textContent=message;
  buttons.replaceChildren();
  for(const choice of choices){
   if(!choice||!phrase(choice.label,''))continue;
   const b=document.createElement('button');b.type='button';b.textContent=choice.label;
   b.onclick=choice.run;buttons.append(b);
  }
  root.classList.toggle('peephole',!!active?.peephole);
  root.classList.add('open');
  options.freeze?.(true);
 }
 function basicChoices(){
  if(!active)return [];
  const door=active.door;
  return [
   {label:TEXT.open||'Abrir la puerta',run:()=>{close();options.openDoor?.(door)}},
   {label:TEXT.leave||'No abrir',run:close}
  ];
 }
 function showReply(choice){
  if(!active)return;
  options.onChoice?.(active.event,choice,active.door);
  if(choice.close){close();return;}
  const choices=(choice.choices||active.event.choices).filter(c=>c&&phrase(c.label,'')).map(c=>({
   label:c.label,run:()=>showReply(c)
  }));
  show(choice.reply||active.event.line||active.event.description,[...choices,...basicChoices()]);
 }
 function talk(){
  if(!active)return false;
  const ev=active.event;
  show(ev.line||ev.description,[
   ...ev.choices.map(c=>({label:c.label,run:()=>showReply(c)})),
   ...basicChoices()
  ]);
  return true;
 }
 function describe(){
  if(!active)return;
  show(active.event.description,[
   ...(active.event.line?[{label:TEXT.listen||'Escuchar',run:talk}]:active.event.choices.map(c=>({label:c.label,run:()=>showReply(c)}))),
   ...basicChoices()
  ]);
 }
 function start(door,peephole){
  const event=normalizeEvent(options.resolveEvent?.(door));
  if(!door?.id||!event)return false;
  if(active&&active.door.id===door.id&&!!active.peephole===!!peephole)return true;
  if(active)close();
  active={door,event,peephole:!!peephole};
  describe();return true;
 }
 function onDoorAttempt(door){return start(door,false);}
 function onPeephole(door){return start(door,true);}
 function onPeepholeExit(){if(active?.peephole)close();}
 function onDoorOpened(door){
  if(!active||active.door.id!==door?.id)return false;
  const event=active.event;close();options.onOpened?.(event,door);return true;
 }
 return {onDoorAttempt,onPeephole,onPeepholeExit,onDoorOpened,close,talk,
  get active(){return !!active},get currentEvent(){return active?.event||null}};
}
global.FHVisitor=Object.freeze({normalizeEvent,createRuntime});
})(window);
