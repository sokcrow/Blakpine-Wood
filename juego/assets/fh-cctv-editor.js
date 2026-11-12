/* Blakpine-Wood — controles de CCTV dentro del inspector existente. */
(function(global){
 'use strict';
 const cctv=global.FHCCTV,T=global.FH_CCTV_TEXT;
 function field(fields,title,kind,value,change,options=[]){
  const label=document.createElement('label');
  label.textContent=title;
  const input=document.createElement(kind==='select'?'select':'input');
  if(kind!=='select'){input.type=kind;input.value=kind==='checkbox'?'':String(value??'');if(kind==='checkbox')input.checked=!!value;}
  if(kind==='number'){input.step='1';}
  if(kind==='select')for(const [v,name] of options){const option=document.createElement('option');option.value=v;option.textContent=name;input.append(option);}
  if(kind==='select')input.value=String(value);
  input.onchange=()=>change(kind==='checkbox'?input.checked:input.value);
  label.append(input);fields.append(label);return input;
 }
 function attachInspector(item,fields,options={}){
  if(!item||!fields||!cctv)return false;
  if(cctv.isCamera(item)){
   field(fields,T.mode,'select',cctv.modeFor(item),v=>options.setItemField?.(item.id,'cameraMode',v),
    [['fixed',T.fixed],['automatic',T.automatic],['manual',T.manual]]);
   if(cctv.modeFor(item)==='manual'){
    const angle=field(fields,T.angles,'number',item.cameraManualDeg??0,v=>{
     options.setItemField?.(item.id,'cameraManualDeg',Math.max(-45,Math.min(45,Number(v)||0)));
    });
    angle.min='-45';angle.max='45';
   }
   field(fields,T.cameraPower,'checkbox',item.cameraOnline!==false,v=>{
    options.setItemField?.(item.id,'cameraOnline',v);
   });
   field(fields,T.mount,'number',item.mountHeightFt??7,v=>{
    options.setItemField?.(item.id,'mountHeightFt',Math.max(.5,Math.min(40,Number(v)||7)));
   }).step='0.5';
   return true;
  }
  const items=options.project?.floors?.flatMap(f=>f.items||[])||[];
  const currentFloor=options.project?.floors?.find(f=>(f.items||[]).includes(item));
  const available=global.FHComputer?.isPc(item,currentFloor?.items||items,Number(options.project?.units?.feetPerCell)||5);
  if(!available)return false;
  const heading=document.createElement('div');heading.className='tip';heading.textContent=T.connected;
  heading.style.gridColumn='1/-1';fields.append(heading);
  const cameras=items.filter(cctv.isCamera);
  if(!cameras.length){const hint=document.createElement('div');hint.className='tip';hint.textContent=T.noDevices;fields.append(hint);return true;}
  const connected=new Set(item.pcConnections?.cameras||[]);
  for(const cam of cameras){
   const label=document.createElement('label');label.className='ck full';
   const toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=connected.has(cam.id);
   toggle.onchange=()=>{
    const next=new Set(item.pcConnections?.cameras||[]);
    if(toggle.checked)next.add(cam.id);else next.delete(cam.id);
    item.pcConnections={...(item.pcConnections||{}),cameras:[...next]};
    options.record?.();options.openInspector?.();
   };
   label.append(toggle,document.createTextNode((cam.label||cam.id)+' · '+cam.id));
   fields.append(label);
  }
  const info=document.createElement('div');info.className='tip';
  info.textContent=T.cameraNetworkHint;info.style.gridColumn='1/-1';fields.append(info);
  return true;
 }
 global.FHCCTVEditor=Object.freeze({attachInspector});
})(window);
