/* Placa del personaje seleccionado: solo UI; valores y Mood vienen del motor. */
(function (root, factory) {
 'use strict';
 const api = factory(root);
 if (typeof module === 'object' && module.exports) module.exports = api;
 if (root) root.FHNameplateHUD = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
 'use strict';
 const NS = 'http://www.w3.org/2000/svg';
 const RESOURCE_KEYS = Object.freeze(['pg', 'sp', 'pe']);
 const MOOD_ICONS = Object.freeze({bueno:'☺', neutral:'●', malo:'☹'});
 const MOOD_TEXT_KEYS = Object.freeze({bueno:'good', neutral:'neutral', malo:'bad'});
 const LABELS = Object.freeze({pg:'Puntos de golpe', sp:'Puntos de sanidad', pe:'Puntos de energía'});
 const LAYOUTS = Object.freeze({
  pg:{topL:80,topR:88,bottomL:299,bottomR:251,track:'#44171d',fill:'#ff373a'},
  sp:{topL:313,topR:259,bottomL:395,bottomR:344,track:'#1a4044',fill:'#8de4e9'},
  pe:{topL:406,topR:353,bottomL:485,bottomR:429,track:'#443d1a',fill:'#f2d84b'}
 });
 const PALETTE = Object.freeze({damage:'#f4f8f5',heal:'#55e889'});
 let ui = null, activeId = null, frameId = null;
 const bars = {};
 const clamp = value => Math.max(0,Math.min(100,value));
 const ease = value => {const t = Math.max(0,Math.min(1,value));return 1-Math.pow(1-t,3);};
 const now = () => root.performance?.now?.() ?? Date.now();
 const reduced = () => root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

 function reading(resources, key) {
  if (!RESOURCE_KEYS.includes(key)) return null;
  const value = resources?.[key], max = resources?.[key + 'Max'];
  if (typeof value !== 'number' || !Number.isFinite(value) ||
      typeof max !== 'number' || !Number.isFinite(max) || max <= 0) return null;
  const current = Math.max(0, Math.min(value, max));
  return {current, maximum:max, percent:current / max * 100};
 }
 function moodIcon(mood) {
  return Object.hasOwn(MOOD_ICONS, mood) ? MOOD_ICONS[mood] : '◇';
 }
 function svgNode(doc, tag, attrs, text) {
  const el = doc.createElementNS(NS,tag);
  for (const [key,value] of Object.entries(attrs || {})) el.setAttribute(key,String(value));
  if (text !== undefined) el.textContent = text;
  return el;
 }
 function poly(doc,parent,attrs) {
  const shape=svgNode(doc,'polygon',attrs);parent.append(shape);return shape;
 }
 function makeBar(doc,svg,key) {
  const cfg=LAYOUTS[key],group=svgNode(doc,'g',{});
  const coords=`395,${cfg.topL} 1445,${cfg.topR} 1445,${cfg.bottomR} 395,${cfg.bottomL}`;
  poly(doc,group,{points:coords,fill:cfg.track});
  const fill=poly(doc,group,{'data-part':key+'-fill',class:key==='pg'?'fh-np-health-fill':'fh-np-meter-fill',fill:cfg.fill});
  const damage=poly(doc,group,{'data-part':key+'-damage',fill:PALETTE.damage});
  const heal=poly(doc,group,{'data-part':key+'-heal',fill:PALETTE.heal});
  svg.append(group);
  bars[key]={cfg,fill,damage,heal,display:0,target:0,animation:null,available:false};
 }
 function range(node,cfg,from,to) {
  if (to <= from + 0.0001) {node.setAttribute('points','');return;}
  const x = p => 395+10.5*p;
  const y = (left,right,p) => left+(right-left)*(p/100);
  node.setAttribute('points',[
   `${x(from)},${y(cfg.topL,cfg.topR,from)}`,
   `${x(to)},${y(cfg.topL,cfg.topR,to)}`,
   `${x(to)},${y(cfg.bottomL,cfg.bottomR,to)}`,
   `${x(from)},${y(cfg.bottomL,cfg.bottomR,from)}`
  ].join(' '));
 }
 function paint(bar,whiteFrom=0,whiteTo=0,greenFrom=0,greenTo=0) {
  range(bar.fill,bar.cfg,0,bar.display);
  range(bar.damage,bar.cfg,whiteFrom,whiteTo);
  range(bar.heal,bar.cfg,greenFrom,greenTo);
 }
 function advance(bar,time) {
  const a=bar.animation;if(!a)return false;
  const elapsed=Math.max(0,time-a.start);
  if(a.kind==='damage') {
   // La barra cae primero; el resto blanco alcanza el nuevo valor después.
   bar.display=a.target;
   const whiteEnd=a.from+(a.target-a.from)*ease((elapsed-220)/780);
   paint(bar,a.target,whiteEnd);
   if(elapsed>=1000)bar.animation=null;
  } else {
   // El verde adelanta la curación; después lo reemplaza el color del recurso.
   const greenEnd=a.from+(a.target-a.from)*ease(elapsed/300);
   bar.display=a.from+(a.target-a.from)*ease((elapsed-330)/480);
   paint(bar,0,0,bar.display,Math.max(bar.display,greenEnd));
   if(elapsed>=810)bar.animation=null;
  }
  if(!bar.animation){bar.display=a.target;paint(bar);}
  return Boolean(bar.animation);
 }
 function animate(time) {
  frameId=null;
  let running=false;
  for (const key of RESOURCE_KEYS) running=advance(bars[key],time)||running;
  if (running) frameId=root.requestAnimationFrame(animate);
 }
 function stopAnimations() {
  if (frameId!==null) root.cancelAnimationFrame?.(frameId);
  frameId=null;
  for (const key of RESOURCE_KEYS) if(bars[key]) bars[key].animation=null;
 }
 function setBar(key,info,instant) {
  const bar=bars[key];
  const target=info?clamp(info.percent):0;
  if(!info){bar.available=false;bar.target=0;bar.display=0;bar.animation=null;paint(bar);return;}
  if(!bar.available || instant || reduced() || typeof root.requestAnimationFrame!=='function') {
   bar.available=true;bar.target=target;bar.display=target;bar.animation=null;paint(bar);return;
  }
  if (Math.abs(bar.target-target)<0.0001) return;
  const t=now();
  if(bar.animation)advance(bar,t);
  const from=bar.display;
  bar.target=target;
  if(Math.abs(from-target)<0.0001){bar.animation=null;bar.display=target;paint(bar);return;}
  bar.animation={kind:target<from?'damage':'heal',from,target,start:t};
  advance(bar,t);
  if(frameId===null)frameId=root.requestAnimationFrame(animate);
 }
 function mount() {
  const doc=root.document;
  if (!doc?.body) return false;
  if (ui?.host?.isConnected) return true;
  doc.getElementById('fhNameplateHUD')?.remove();
  const host=doc.createElement('aside');
  host.id='fhNameplateHUD';host.className='fh-np';host.hidden=true;
  host.setAttribute('aria-label','Nombre, humor y recursos del personaje');
  const svg=svgNode(doc,'svg',{viewBox:'0 0 1536 565',preserveAspectRatio:'xMidYMid meet','aria-hidden':'true'});
  const defs=svgNode(doc,'defs',{});
  const clip=svgNode(doc,'clipPath',{id:'fh-np-panel-clip'});
  poly(doc,clip,{points:'395,80 1423,88 1457,427 395,498'});defs.append(clip);svg.append(defs);
  poly(doc,svg,{points:'0,27 1456,43 1501,461 0,548',fill:'#0f0f12'});
  poly(doc,svg,{points:'0,56 44,57 48,519 0,526',fill:'#181719'});
  const moodImage=svgNode(doc,'image',{x:93,y:139,width:258,height:258,preserveAspectRatio:'xMidYMid meet'});
  moodImage.setAttribute('style','image-rendering:pixelated');
  const moodMark=svgNode(doc,'text',{x:226,y:270,'text-anchor':'middle',fill:'#fff0a0','font-size':160},'◇');
  svg.append(moodImage,moodMark);
  poly(doc,svg,{points:'375,60 1438,67 1477,447 375,519',fill:'#0a0c0e',stroke:'#f5f6f4','stroke-width':14});
  poly(doc,svg,{points:'394,79 1423,87 1457,428 395,499',fill:'#122d34',stroke:'#c2c9c7','stroke-width':6});
  const panel=svgNode(doc,'g',{'clip-path':'url(#fh-np-panel-clip)'});
  for(const key of RESOURCE_KEYS)makeBar(doc,panel,key);
  for(const [x1,y1,x2,y2,color,width] of [
   [389,306,1450,253,'#0b1012',15],[389,314,1450,261,'#c4c9c6',4],
   [389,401,1452,348,'#0b1012',14],[389,408,1452,355,'#c4c9c6',3]
  ])panel.append(svgNode(doc,'line',{x1,y1,x2,y2,stroke:color,'stroke-width':width}));
  svg.append(panel);
  const name=svgNode(doc,'text',{x:914,y:225,'text-anchor':'middle',class:'fh-np-name',textLength:462,lengthAdjust:'spacingAndGlyphs'},'');
  svg.append(name);host.append(svg);doc.body.append(host);
  ui={host,name,moodImage,moodMark};activeId=null;frameId=null;
  return true;
 }
 function hide() {
  stopAnimations();
  activeId=null;
  if(ui?.host)ui.host.hidden=true;
  return false;
 }
 // Esta placa solo aparece cuando el jugador selecciona un personaje visible.
 function update(character = root.FHCharacterRuntime?.character ?? null, position = null) {
  if(!mount())return false;
  const pg=reading(character?.resources,'pg');
  if(!character || !pg || !position ||
      !Number.isFinite(position.x) || !Number.isFinite(position.y))return hide();
  const id=character.id==null?character:character.id;
  const changed=activeId!==id;
  if(changed)stopAnimations();
  activeId=id;
  const name=typeof character.name==='string'?character.name.trim().toUpperCase():'';
  if(ui.name.textContent!==name){
   ui.name.textContent=name;
   ui.name.setAttribute('textLength',String(Math.min(462,Math.max(100,name.length*77))));
  }
  const mood=character.mental?.mood;
  const art=root.FH_MOOD_FEAR_IMAGES?.[mood]||'';
  ui.moodImage.hidden=!art;ui.moodMark.hidden=Boolean(art);
  if(art && ui.moodImage.getAttribute('href')!==art)ui.moodImage.setAttribute('href',art);
  if(!art)ui.moodMark.textContent=moodIcon(mood);
  const translated=root.FH_MOOD_FEAR_TEXT?.[MOOD_TEXT_KEYS[mood]];
  const moodLabel=typeof translated==='string'?translated:(Object.hasOwn(MOOD_ICONS,mood)?mood:'sin datos');
  const info={pg,sp:reading(character.resources,'sp'),pe:reading(character.resources,'pe')};
  for(const key of RESOURCE_KEYS)setBar(key,info[key],changed);
  ui.host.setAttribute('aria-label',`Personaje ${name}. Humor: ${moodLabel}. `+
   RESOURCE_KEYS.map(key=>`${LABELS[key]}: ${info[key]?info[key].current+' de '+info[key].maximum:'sin datos'}`).join('. '));
  ui.host.hidden=false;
  const half=(ui.host.offsetWidth||336)/2;
  const vw=root.innerWidth||1280;
  const x=Math.max(half+8,Math.min(vw-half-8,position.x));
  const h=ui.host.offsetHeight||124;
  ui.host.style.left=x+'px';
  ui.host.style.top=Math.max(h+8,position.y-17)+'px';
  return true;
 }
 return Object.freeze({reading,moodIcon,mount,update,hide});
});
