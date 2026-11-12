/* Editor de premades de drenaje: datos v1 y herramientas sin alterar otras áreas. */
(function(root){
 'use strict';
 let env;
 const R=()=>root.FHDrainage,T=()=>root.FH_DRAIN_TEXT;
 const KINDS={drain_straight:'straight',drain_tee:'tee',drain_cross:'cross',drain_small:'small',drain_outfall:'outfall'};
 const tools=[...Object.keys(KINDS),'drain_bridge'];
 const createEl=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
 function editAllowed(item){
  const style=root.FHStyleEditor;
  if(!style?.hasActor())return true;
  const at=[{x:item.x+.01,y:item.y+.01},{x:item.x+item.w-.01,y:item.y+.01},
   {x:item.x+.01,y:item.y+item.h-.01},{x:item.x+item.w-.01,y:item.y+item.h-.01}];
  return at.every(p=>style.canEditAt(p));
 }
 function place(tool,at,drag=false){
  if(!tools.includes(tool))return false;
  if(drag){env.toast(T().drag);return true;}
  try{
   const section=KINDS[tool],item=section?R().makeSection(section,at,env.project().units,env.newId()):
    R().makeBridge(at,env.project().units,env.newId());
   if(!editAllowed(item)){env.toast(T().blocked);return true;}
   if(section&&env.current().items.some(x=>R().isSection(x)&&
    x.x<item.x+item.w&&x.x+x.w>item.x&&x.y<item.y+item.h&&x.y+x.h>item.y)){
    env.toast(T().overlap);return true;
   }
   env.current().items.push(item);
   env.record();env.render();env.toast(T().place);
  }catch(error){env.toast(error.message);}
  return true;
 }
 function rotate(item){
  if(!R().isSection(item)&&!R().isBridge(item))return false;
  if(!editAllowed(item)){env.toast(T().blocked);return true;}
  if(R().isSection(item))item.rotation=(item.rotation+90)%360;
  else {
   const cx=item.x+item.w/2,cy=item.y+item.h/2;
   [item.w,item.h]=[item.h,item.w];item.x=cx-item.w/2;item.y=cy-item.h/2;
   if(!editAllowed(item)){[item.w,item.h]=[item.h,item.w];item.x=cx-item.w/2;item.y=cy-item.h/2;env.toast(T().blocked);return true;}
  }
  try{R().validate(item,env.project().units);}catch(error){env.toast(error.message);return true;}
  env.record();env.render();env.inspect();return true;
 }
 function report(){
  const graph=R().topology(env.project()),here=graph.nodes.filter(n=>n.floorIndex===env.floorIndex());
  const issues=graph.warnings.filter(x=>x.floorIndex===env.floorIndex());
  const header=createEl('h2',T().report),summary=createEl('p',here.length+' piezas en este piso · '+issues.length+' advertencias');
  const panel=createEl('div');panel.append(header,summary);
  if(!here.length)panel.append(createEl('p',T().none));
  else if(!issues.length)panel.append(createEl('p',T().clean));
  else {
   const list=createEl('ul');
   for(const issue of issues){
    const node=here.find(n=>String(n.item.id)===String(issue.itemId));
    const li=createEl('li',(node?.item.label||issue.itemId)+' · '+(issue.code==='isolated'?T().disconnected:T().invalid));
    list.append(li);
   }
   panel.append(list);
  }
  const nearest=createEl('p');
  const outlets=(env.current().items||[]).filter(it=>it.type==='drain_outlet');
  nearest.textContent=outlets.length?outlets.map(it=>{
   const result=R().nearest(env.project(),env.floorIndex(),it);
   return it.id+': '+(result?result.itemId+' (piso '+(result.floorIndex+1)+')':T().noNear);
  }).join(' · '):T().near+': '+T().noNear;
  panel.append(nearest);
  const button=createEl('button',T().closed);button.id='fhDrainClose';panel.append(button);
  env.modal(panel.innerHTML,()=>document.getElementById('fhDrainClose')?.addEventListener('click',env.closeModal));
 }
 function inspector(item,fields){
  if(!R().isSection(item)&&!R().isBridge(item))return false;
  const p=createEl('p',item.label+' · '+item.w+'×'+item.h+' tiles');
  p.className='tip';p.style.gridColumn='1/-1';fields.append(p);
  const rotateButton=createEl('button',T().rotate);rotateButton.type='button';
  rotateButton.onclick=()=>rotate(item);fields.append(rotateButton);
  if(R().isSection(item)){
   const graph=R().topology(env.project()),node=graph.nodes.find(n=>n.item===item);
   const neighbors=(graph.links.get(node?.id)||[]).map(id=>graph.nodes.find(n=>n.id===id)).filter(Boolean);
   const field=createEl('label',T().flow);
   const select=createEl('select');
   for(const neighbor of [{item:{id:'',label:T().auto}},...neighbors]){
    const option=createEl('option',neighbor.item.label+' · '+neighbor.item.id);
    option.value=String(neighbor.item.id);select.append(option);
   }
   select.value=String(item.drainage.flowTo||'');
   select.onchange=()=>{
    if(!editAllowed(item)){select.value=String(item.drainage.flowTo||'');env.toast(T().blocked);return;}
    item.drainage.flowTo=select.value||null;env.record();env.render();
   };
   field.append(select);fields.append(field);
   const downstream=R().downstream(env.project(),env.floorIndex(),item.id);
   fields.append(createEl('p',downstream?'Dirección siguiente: '+downstream.itemId:T().disconnected));
  }
  const audit=createEl('button',T().audit);audit.type='button';audit.onclick=report;fields.append(audit);
  return true;
 }
 root.FHDrainageEditor=Object.freeze({
  install(args){env=args;},
  isTool:t=>tools.includes(t),place,
  choose(t){if(t!=='drain_audit')return false;report();return true;},
  inspector,rotate,report
 });
})(typeof globalThis!=='undefined'?globalThis:this);
