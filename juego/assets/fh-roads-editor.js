/* Herramientas del editor; las reglas de tráfico quedan como datos del mapa. */
(function(root){
 'use strict';
 let env=null;
 const defaults={forwardLanes:1,reverseLanes:1,laneWidthFt:10,sidewalkFt:5,speedKmh:40};
 const R=()=>root.FHRoads,T=()=>root.FH_ROAD_TEXT,$=id=>document.getElementById(id);
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const tools=['road_draw',...['stop','signal','speed','crosswalk','portal'].map(k=>'road_'+k)];
 const allowed=()=>{if(root.FHStyleEditor?.hasActor()){env.toast(T().denied);return false;}return true;};
 const input=(id,label,value,min,max,step=1)=>`<label>${escape(label)}<input id="${id}" type="number" min="${min}" max="${max}" step="${step}" value="${escape(value)}"></label>`;
 const pair=(prefix,label,p)=>`<fieldset><legend>${escape(label)}</legend>${input(prefix+'x',T().x,p.x,0,120,.25)}${input(prefix+'y',T().y,p.y,0,120,.25)}</fieldset>`;
 const number=id=>$(id).value.trim()===''?NaN:Number($(id).value);
 const buttons=()=>`<div class="actions"><button id="roadSave" class="primary">${T().apply}</button><button id="roadCancel">${T().close}</button></div>`;
 const status=()=>`<p class="tip">${T().scope}</p>`;
 function showError(error){env.toast(T()[error.code]||error.message);}
 function roadDialog(item){
  if(!allowed())return;
  const c=item?R().config(item.road):{...defaults},ends=item?R().endpoints(item):null;
  env.modal(`<h2>${T().settings}</h2><p>${T().help}</p><p>${T().legend}</p>
   <label>${T().name}<input id="roadName" type="text" maxlength="80" value="${escape(item?.label||T().road)}"></label>
   <label>${T().preset}<select id="roadPreset"><option value="2">2 (1 + 1)</option><option value="4">4 (2 + 2)</option><option value="6">6 (3 + 3)</option><option value="custom">${T().custom}</option></select></label>
   <div class="fh-road-grid">${input('roadForward',T().forward,c.forwardLanes,0,12)}${input('roadReverse',T().reverse,c.reverseLanes,0,12)}
   ${input('roadWidth',T().laneWidth,c.laneWidthFt,6,20,.5)}${input('roadSidewalk',T().sidewalk,c.sidewalkFt,0,20,.5)}${input('roadLimit',T().limit,c.speedKmh,5,130)}
   ${ends?pair('roadA',T().from,ends.a)+pair('roadB',T().to,ends.b):''}</div>${status()}${buttons()}`,()=>{
    const total=c.forwardLanes+c.reverseLanes;
    $('roadPreset').value=c.forwardLanes===c.reverseLanes&&[2,4,6].includes(total)?String(total):'custom';
    $('roadPreset').onchange=()=>{const n=Number($('roadPreset').value);if(n){$('roadForward').value=n/2;$('roadReverse').value=n/2;}};
    for(const id of ['roadForward','roadReverse'])$(id).oninput=()=>$('roadPreset').value='custom';
    $('roadCancel').onclick=env.closeModal;
    $('roadSave').onclick=()=>{
     if(!allowed())return;
     try{
      const raw={forwardLanes:number('roadForward'),reverseLanes:number('roadReverse'),laneWidthFt:number('roadWidth'),sidewalkFt:number('roadSidewalk'),speedKmh:number('roadLimit'),label:$('roadName').value};
      R().config(raw);
      if(item){
       const a={x:number('roadAx'),y:number('roadAy')},b={x:number('roadBx'),y:number('roadBy')};
       const next=R().makeRoad(a,b,raw,env.project().units,item.id);
       const items=env.current().items.map(it=>it.id===item.id?next:it);
       // Señales de tramo siguen su posición proporcional; controles de cruces se revisan en el diagnóstico.
       for(let i=0;i<items.length;i++)if(items[i].roadControl?.roadId===item.id){
        const old=items[i],ends=R().endpoints(next),t=old.roadControl.position;
        const p={x:ends.a.x+(ends.b.x-ends.a.x)*t,y:ends.a.y+(ends.b.y-ends.a.y)*t};
        items[i]=R().makeControl(old.roadControl.kind,p,old.roadControl,[next],old.id);
       }
       env.current().items=items;env.record();env.inspect();
      }else Object.assign(defaults,raw);
      env.closeModal();env.toast(item?T().moveHint:T().ready);
     }catch(error){showError(error);}
    };
   });
 }
 function controlDialog(kind,p,item){
  if(!allowed())return;
  const c=R().controlConfig(kind,item?.roadControl),point=item?{x:item.x,y:item.y}:p;
  env.modal(`<h2>${T().controlTitle} · ${T()[kind]}</h2>
   ${kind==='stop'?`<p>${T().stopRule}</p>${input('roadStop',T().stopSeconds,c.stopSeconds,.5,10,.5)}`:''}
   ${kind==='signal'?`<p>${T().signalRule}</p><div class="fh-road-grid">${input('roadGreen',T().green,c.greenSeconds,5,180)}${input('roadYellow',T().yellow,c.yellowSeconds,1,10)}${input('roadRed',T().allRed,c.allRedSeconds,1,10)}${input('roadOffset',T().offset,c.offsetSeconds,0,600)}</div>`:''}
   ${kind==='speed'?`${input('roadSpeed',T().limit,c.speedKmh,5,130)}<label>${T().direction}<select id="roadDirection">${['both','forward','reverse'].map((v,i)=>`<option value="${v}"${c.direction===v?' selected':''}>${[T().both,T().outward,T().inward][i]}</option>`).join('')}</select></label>`:''}
   ${pair('roadPoint',T().from,point)}${status()}${buttons()}`,()=>{
    $('roadCancel').onclick=env.closeModal;
    $('roadSave').onclick=()=>{
     if(!allowed())return;
     try{
      const raw={...c};
      if(kind==='stop')raw.stopSeconds=number('roadStop');
      if(kind==='signal')Object.assign(raw,{greenSeconds:number('roadGreen'),yellowSeconds:number('roadYellow'),allRedSeconds:number('roadRed'),offsetSeconds:number('roadOffset')});
      if(kind==='speed')Object.assign(raw,{speedKmh:number('roadSpeed'),direction:$('roadDirection').value});
      const at={x:number('roadPointx'),y:number('roadPointy')};
      const next=R().makeControl(kind,at,raw,env.current().items,item?.id||env.newId());
      R().validateProject({units:env.project().units,floors:[{items:[next]}]});
      if(['stop','signal'].includes(kind)&&env.current().items.some(it=>it.id!==item?.id&&it.roadControl?.junctionId===next.roadControl.junctionId)){
       const error=new Error(T().duplicate);error.code='duplicate';throw error;
      }
      if(item)env.current().items=env.current().items.map(it=>it.id===item.id?next:it);else env.current().items.push(next);
      env.record();env.closeModal();env.toast(T().controlPlaced);if(item)env.inspect();
     }catch(error){showError(error);}
    };
   });
 }
 function place(tool,p,start,drag){
  if(!tools.includes(tool))return false;
  if(!allowed())return true;
  if(tool==='road_draw'){
   if(!drag&&!env.anchor()){
    env.anchor(p);env.render();env.toast(T().first);return true;
   }
   const from=env.anchor()||start;
   try{const item=R().makeRoad(from,p,defaults,env.project().units,env.newId());env.current().items.push(item);env.anchor(null);env.record();env.toast(T().placed);}catch(error){showError(error);}return true;
  }
  if(!drag){
   const kind=tool.slice(5);
   try{R().makeControl(kind,p,{},env.current().items,'check');controlDialog(kind,p);}catch(error){showError(error);}
  }return true;
 }
 function report(){
  const result=R().audit(env.current().items,env.project().units);
  env.modal(`<h2>${T().report}</h2><p>${T().summary(result.roads,result.lanes.length,result.junctions.length)}</p>${status()}
   ${!result.roads?`<p>${T().noRoads}</p>`:!result.issues.length?`<p>${T().clean}</p>`:`<ul>${result.issues.map(issue=>`<li>${escape(T()[issue.code]||T().badRoad)} <small>${escape(issue.itemId)}</small></li>`).join('')}</ul>`}
   <div class="actions"><button id="roadCancel">${T().close}</button></div>`,()=>$('roadCancel').onclick=env.closeModal);
 }
 function inspector(item,fields){
  if(!R().isRoad(item)&&!R().isControl(item))return false;
  const road=R().isRoad(item),note=document.createElement('p');note.className='tip';note.style.gridColumn='1/-1';note.textContent=road?T().moveHint:T().scope;fields.append(note);
  const button=document.createElement('button');button.textContent=T().edit;button.onclick=()=>road?roadDialog(item):controlDialog(item.roadControl.kind,item,item);fields.append(button);
  const audit=document.createElement('button');audit.textContent=T().audit;audit.onclick=report;fields.append(audit);
  $('inspTitle').textContent=item.label||T().road;
  $('rotateBtn').style.display='none';$('duplicateBtn').style.display='none';$('deleteBtn').style.display='';return true;
 }
 function beforeRemove(item){
  if(!R().isRoad(item))return;
  env.current().items=env.current().items.filter(it=>it.roadControl?.roadId!==item.id&&!it.roadControl?.roadIds?.includes(item.id));
 }
 root.FHRoadEditor=Object.freeze({install(args){env=args;},isTool:tool=>tools.includes(tool),
  choose(tool){if(tool==='road_settings'){roadDialog();return true;}if(tool==='road_audit'){report();return true;}return false;},
  settings:roadDialog,place,report,inspector,beforeRemove,config:defaults});
})(typeof globalThis!=='undefined'?globalThis:this);
