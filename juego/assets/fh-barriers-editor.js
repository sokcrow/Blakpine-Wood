/* Barreras del creador: usa la geometría de segmentos existente, sin crear tipos JSON nuevos. */
(function(root){
 'use strict';
 const B=root.FHBarriers,T=root.FH_BARRIER_TEXT;
 if(!B||!T||typeof SEGMENT_TYPES==='undefined'||typeof TOOL_GROUPS==='undefined')return;
 const TOOLS=[
  ['barrier_railing',T.railing,'╥'],
  ['barrier_mesh',T.mesh,'▦']
 ];
 for(const [tool,label,symbol] of TOOLS){
  SEGMENT_TYPES.add(tool);
  COLORS[tool]=tool==='barrier_railing'?'#b7cdd4':'#93b6a0';
  SHORT[tool]=label;
  for(const category of ['structure','navigate']){
   const group=TOOL_GROUPS[category];
   if(group&&!group.some(([key])=>key===tool)){
    const after=group.findIndex(([key])=>key==='fence');
    group.splice(after<0?group.length:after+1,0,[tool,label,symbol]);
   }
  }
 }
 // Los dos botones construyen fence + barrierKind en el JSON v1.
 const originalCreate=root.createSegment;
 root.createSegment=function(type,a,b){
  const kind=type==='barrier_railing'?'railing':type==='barrier_mesh'?'mesh':null;
  if(!kind)return originalCreate(type,a,b);
  const it=originalCreate('fence',a,b);
  if(it){it.barrierKind=kind;it.heightFt=B.PROFILE[kind].heightFt;}
  return it;
 };
 const originalChooseTool=root.chooseTool;
 root.chooseTool=function(tool){
  const result=originalChooseTool(tool);
  if(tool==='barrier_railing')document.getElementById('stageHint').textContent=T.hintRailing;
  else if(tool==='barrier_mesh')document.getElementById('stageHint').textContent=T.hintMesh;
  return result;
 };
 const originalDrawSegment=root.drawSegment;
 root.drawSegment=function(ctx,it,zoom,selected){
  const kind=it.type==='barrier_railing'?'railing':
   it.type==='barrier_mesh'?'mesh':B.kind(it);
  if(!kind)return originalDrawSegment(ctx,it,zoom,selected);
  const proxy={...it,type:'fence'};
  originalDrawSegment(ctx,proxy,zoom,selected);
  const a=toPixel(it.a),b=toPixel(it.b);
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
  if(len<1)return;
  const nx=-dy/len,ny=dx/len;
  ctx.save();ctx.lineWidth=1.8/zoom;
  ctx.strokeStyle=kind==='railing'?'#dceaf0':'#c9dfb5';
  ctx.setLineDash(kind==='railing'?[]:[3/zoom,3/zoom]);
  for(const offset of [-4,4]){
   ctx.beginPath();ctx.moveTo(a.x+nx*offset/zoom,a.y+ny*offset/zoom);
   ctx.lineTo(b.x+nx*offset/zoom,b.y+ny*offset/zoom);ctx.stroke();
  }
  ctx.setLineDash([]);
  const posts=Math.max(1,Math.ceil(len/(gridX()*1.5)));
  for(let i=0;i<=posts;i++){
   const x=a.x+dx*i/posts,y=a.y+dy*i/posts;
   ctx.beginPath();ctx.moveTo(x-nx*7/zoom,y-ny*7/zoom);
   ctx.lineTo(x+nx*7/zoom,y+ny*7/zoom);ctx.stroke();
  }
  ctx.restore();
 };
 const originalOpenInspector=root.openInspector;
 root.openInspector=function(...args){
  const result=originalOpenInspector(...args);
  const it=current().items.find(item=>item.id===selection);
  if(it?.type!=='fence')return result;
  const fields=document.getElementById('fields');
  if(!fields)return result;
  const label=document.createElement('label');
  label.textContent=T.title;
  const select=document.createElement('select');
  const options=[['',T.legacy],['railing',T.railing],['mesh',T.mesh]];
  for(const [value,name] of options){
   const option=document.createElement('option');option.value=value;option.textContent=name;select.append(option);
  }
  select.value=B.kind(it)||'';
  select.onchange=()=>{
   if(root.FHStyleEditor?.canEditItem(it)===false){root.openInspector();return;}
   const selectedKind=select.value;
   if(selectedKind){it.barrierKind=selectedKind;it.heightFt=B.PROFILE[selectedKind].heightFt;}
   else{delete it.barrierKind;it.heightFt=4;}
   record();root.openInspector();
  };
  label.append(select);fields.append(label);
  if(B.isBarrier(it)){
   const hint=document.createElement('div');hint.className='tip';hint.style.gridColumn='1/-1';
   hint.textContent=T.help;fields.append(hint);
  }
  return result;
 };
 // La paleta inicial ya fue montada por init() antes de cargar este adaptador.
 if(activeCategory==='structure'||activeCategory==='navigate')setCategory(activeCategory);
 root.FHBarriersEditor=Object.freeze({tools:TOOLS.map(t=>t[0])});
})(window);
