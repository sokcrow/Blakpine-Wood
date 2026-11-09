/* HUD del medidor: sólo consulta FHServices; no calcula facturas ni tarifas. */
(function(root){
 'use strict';
 let overlay=null,restoreFocus=null,fields=null,lastSignature='';
 const T=()=>root.FH_ELECTRIC_TEXT||{};
 function node(tag,cls,text){
  const el=root.document.createElement(tag);
  if(cls)el.className=cls;
  if(text!==undefined)el.textContent=text;
  return el;
 }
 function build(){
  if(overlay)return;
  const css=node('style');css.textContent=`
   #fhPowerMeter[hidden]{display:none!important}
   #fhPowerMeter{position:fixed;inset:0;z-index:230;background:#05080acd;display:grid;place-items:center;padding:16px}
   #fhPowerMeter .frame{position:relative;width:min(480px,100%);padding:20px 22px;background:#11171be8;color:#e9e6dc;
     clip-path:polygon(15px 0,calc(100% - 15px) 0,100% 15px,100% calc(100% - 15px),calc(100% - 15px) 100%,15px 100%,0 calc(100% - 15px),0 15px)}
   #fhPowerMeter svg.border{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
   #fhPowerMeter .heading{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #76827c6b;padding-bottom:12px}
   #fhPowerMeter h2{margin:0;font:700 18px Georgia,serif;letter-spacing:.08em;text-transform:uppercase}
   #fhPowerMeter button{background:#1f3036;color:#eee9df;border:1px solid #a7b7b0;min-width:40px;min-height:40px;cursor:pointer}
   #fhPowerMeter button:focus-visible{outline:2px solid #efcb85;outline-offset:3px}
   #fhPowerMeter dl{display:grid;grid-template-columns:1fr auto;gap:10px;margin:14px 0 2px;align-items:baseline}
   #fhPowerMeter dt{font:13px/1.4 system-ui;color:#c2cec8}#fhPowerMeter dd{margin:0;font:600 16px/1.4 system-ui;font-variant-numeric:tabular-nums}
   #fhPowerMeter .foot{font:12px/1.5 system-ui;color:#aab8b0;margin:12px 0 0}`;
  root.document.head.append(css);
  overlay=node('div');overlay.id='fhPowerMeter';overlay.hidden=true;
  overlay.setAttribute('role','presentation');
  const panel=node('section','frame');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
  panel.setAttribute('aria-label',T().meterTitle||'Medidor eléctrico');
  const head=node('div','heading'),title=node('h2','',T().meterTitle||'Medidor eléctrico'),close=node('button','',T().close||'Cerrar');
  close.type='button';close.setAttribute('aria-label',T().close||'Cerrar');close.onclick=hide;
  head.append(title,close);
  const dl=node('dl');fields={};
  for(const [key,label] of [['watts','meterWatts'],['hour','meterHour'],['total','meterTotal'],['cost','meterCost']]){
   const dt=node('dt','',T()[label]||label),dd=node('dd','', '—');fields[key]=dd;dl.append(dt,dd);
  }
  const note=node('p','foot',T().meterNotice||'El costo aparecerá cuando se habiliten las tarifas.');
  // Marco SVG con dos contornos completos y esquinas chaflanadas.
  const svg=root.document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','border');
  svg.setAttribute('viewBox','0 0 480 260');svg.setAttribute('preserveAspectRatio','none');
  for(const [a,color,opacity] of [[1,'#d4d8ce','.85'],[5,'#a4b7ad','.35']]){
   const polygon=root.document.createElementNS('http://www.w3.org/2000/svg','polygon');
   polygon.setAttribute('points',`${15+a},${a} ${465-a},${a} ${480-a},${15+a} ${480-a},${245-a} ${465-a},${260-a} ${15+a},${260-a} ${a},${245-a} ${a},${15+a}`);
   polygon.setAttribute('fill','none');polygon.setAttribute('stroke',color);polygon.setAttribute('stroke-opacity',opacity);polygon.setAttribute('stroke-width','1');svg.append(polygon);
  }
  panel.append(svg,head,dl,note);overlay.append(panel);root.document.body.append(overlay);
  overlay.addEventListener('click',event=>{if(event.target===overlay)hide();});
  overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();hide();}
   if(event.key==='Tab'){event.preventDefault();close.focus();}});
  overlay.closeButton=close;
 }
 function hide(){if(!overlay)return;overlay.hidden=true;restoreFocus?.focus?.();restoreFocus=null;}
 function refresh(service){
  if(!overlay||overlay.hidden||!service)return;
  const p=service.state?.powerHistory||{},kwh=Math.max(0,Number(service.state?.meters?.kwh)||0);
  const watts=Math.max(0,Number(p.currentWatts)||0),current=Math.max(0,Number(p.currentKwh)||0);
  const key=[watts.toFixed(1),current.toFixed(4),kwh.toFixed(4)].join('|');
  if(key===lastSignature)return;
  lastSignature=key;
  fields.watts.textContent=(watts/1000).toFixed(3)+' kW';
  fields.hour.textContent=current.toFixed(3)+' kWh';
  fields.total.textContent=kwh.toFixed(3)+' kWh';
  fields.cost.textContent=T().meterPending||'Tarifas pendientes';
 }
 function open(service){
  if(!root.document||!service)return false;
  build();restoreFocus=root.document.activeElement;overlay.hidden=false;lastSignature='';
  refresh(service);overlay.closeButton.focus();return true;
 }
 const api=Object.freeze({open,refresh,hide});
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)root.FHElectricMeterHUD=api;
})(typeof window!=='undefined'?window:globalThis);
