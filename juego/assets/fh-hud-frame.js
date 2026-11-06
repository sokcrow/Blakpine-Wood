/* Blakpine Wood · marco SVG compartido, solo decoración del HUD 3D.
   Los listeners y el comportamiento del juego permanecen en el motor existente. */
(function(root,factory){
  'use strict';
  const api=factory(root);
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.FHHUDFrame=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';
  const NS='http://www.w3.org/2000/svg';
  const cache=new WeakMap();
  const round=n=>Math.round(n*4)/4;

  function outlinePath(width,height,inset=0){
    const w=Number(width),h=Number(height),i=Number(inset);
    if(!Number.isFinite(w)||!Number.isFinite(h)||!Number.isFinite(i)||w<40||h<38||i<0) return '';
    const l=round(i+.75),r=round(w-i-.75),t=round(i+.75),b=round(h-i-.75);
    if(r-l<35||b-t<32) return '';
    const cut=round(Math.max(7,Math.min(16,(b-t)*.245,(r-l)*.08)));
    const notch=round(Math.max(3,Math.min(6,cut*.4)));
    const n0=round(t+cut+3),n1=round(n0+notch),n2=round(n1+notch);
    const canNotch=n2+4<b-cut;
    let d='M '+round(l+cut)+' '+t+' L '+round(r-cut)+' '+t+' L '+r+' '+round(t+cut);
    if(canNotch)d+=' L '+r+' '+n0+' L '+round(r-notch)+' '+n1+' L '+r+' '+n2;
    d+=' L '+r+' '+round(b-cut)+' L '+round(r-cut)+' '+b+' L '+round(l+cut)+' '+b+' L '+l+' '+round(b-cut);
    if(canNotch)d+=' L '+l+' '+n2+' L '+round(l+notch)+' '+n1+' L '+l+' '+n0;
    return d+' L '+l+' '+round(t+cut)+' Z';
  }

  function createSVG(doc,name){
    const svg=doc.createElementNS(NS,'svg');
    svg.setAttribute('aria-hidden','true');
    svg.setAttribute('focusable','false');
    svg.setAttribute('preserveAspectRatio','none');
    svg.setAttribute('data-fh-hud-frame',name);
    svg.classList.add('fh-hud-frame-svg');
    const defs=doc.createElementNS(NS,'defs');
    const grad=doc.createElementNS(NS,'linearGradient');
    const id='fh-hud-frame-fill-'+name;
    grad.setAttribute('id',id);
    grad.setAttribute('x1','0%');grad.setAttribute('y1','15%');
    grad.setAttribute('x2','100%');grad.setAttribute('y2','90%');
    for(const [offset,color,opacity] of [
      ['0%','#242424','0.97'],
      ['54%','#080808','0.97'],
      ['100%','#151515','0.96']
    ]){
      const stop=doc.createElementNS(NS,'stop');
      stop.setAttribute('offset',offset);
      stop.setAttribute('stop-color',color);
      stop.setAttribute('stop-opacity',opacity);
      grad.append(stop);
    }
    defs.append(grad);svg.append(defs);
    const outer=doc.createElementNS(NS,'path');
    outer.setAttribute('fill','url(#'+id+')');
    outer.setAttribute('stroke','#e7e3da');
    outer.setAttribute('stroke-opacity','.88');
    outer.setAttribute('stroke-width','1');
    outer.setAttribute('stroke-linejoin','miter');
    outer.setAttribute('vector-effect','non-scaling-stroke');
    const inner=doc.createElementNS(NS,'path');
    inner.setAttribute('fill','none');
    inner.setAttribute('stroke','#ddd9d0');
    inner.setAttribute('stroke-opacity','.35');
    inner.setAttribute('stroke-width','.8');
    inner.setAttribute('stroke-linejoin','miter');
    inner.setAttribute('vector-effect','non-scaling-stroke');
    svg.append(outer,inner);
    return {svg,outer,inner};
  }

  function mount(node,name='location'){
    if(!node||typeof node.getBoundingClientRect!=='function'||!root.document) return false;
    let entry=cache.get(node);
    if(!entry){
      entry=createSVG(root.document,name);
      entry.render=()=>{
        const bounds=node.getBoundingClientRect();
        const w=round(bounds.width),h=round(bounds.height);
        if(w<40||h<38) return;
        entry.svg.setAttribute('viewBox','0 0 '+w+' '+h);
        entry.outer.setAttribute('d',outlinePath(w,h,.5));
        entry.inner.setAttribute('d',outlinePath(w,h,4.5));
      };
      cache.set(node,entry);
      if(typeof root.ResizeObserver==='function'){
        entry.resizer=new root.ResizeObserver(entry.render);
        entry.resizer.observe(node);
      } else if(typeof root.addEventListener==='function') {
        root.addEventListener('resize',entry.render,{passive:true});
      }
    }
    if(entry.svg.parentNode!==node)node.insertBefore(entry.svg,node.firstChild);
    if(node.classList?.add)node.classList.add('fh-hud-framed');
    entry.render();
    return true;
  }

  function init(){
    const doc=root.document;
    if(!doc)return false;
    const hud=doc.getElementById('hud');
    const menu=doc.getElementById('fhPlayerMenu');
    if(menu)mount(menu,'menu');
    if(hud){
      const refresh=()=>{if(hud.classList.contains('fh-location-hud'))mount(hud,'location');};
      refresh();
      // El módulo contextual puede llamar replaceChildren() al instalarse.
      // Reponer el marco sin tocar sus etiquetas, valores ni eventos.
      if(typeof root.MutationObserver==='function'){
        const observer=new root.MutationObserver(refresh);
        observer.observe(hud,{childList:true,attributes:true,attributeFilter:['class']});
      }
    }
    return Boolean(hud||menu);
  }

  if(root.document){
    if(root.document.readyState==='loading'){
      root.document.addEventListener('DOMContentLoaded',init,{once:true});
    } else init();
  }
  return Object.freeze({outlinePath,mount,init});
});
