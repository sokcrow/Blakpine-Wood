/* Editor de marcas de estacionamiento: entrada, configuración y demo verificable. */
(function(root){
 'use strict';
 let env=null;const conf={count:1,widthFt:9,lengthFt:18,gapFt:0,rotation:0,startNumber:1,prefix:'',
  accessibleIndices:[],color:'#F3EFDC'};
 const P=()=>root.FHParking,T=()=>root.FH_PARKING_TEXT;
 const html=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const el=id=>document.getElementById(id);
 const isTool=id=>!!P()?.TOOLS[id];
 const realFeet=()=>Number(env.project().units.feetPerCell)||5;
 function defaults(tool){
  const kind=P().TOOLS[tool]||'stall',sizes=P().DEFAULT_FT[kind];
  if(conf.activeKind!==kind){conf.activeKind=kind;conf.widthFt=sizes[0];conf.lengthFt=sizes[1];conf.color=(kind==='double_yellow'||kind==='dashed_yellow')?'#E6C34E':'#F3EFDC';}
 }
 function settings(tool){
  defaults(tool||'parking_stall');const kind=conf.activeKind,stalls=kind==='stall';
  const row=(label,id,value,type='number',extra='')=>'<label>'+html(label)+'<input type="'+type+'" id="'+id+'" value="'+html(value)+'" '+extra+'></label>';
  env.modal('<h2>'+html(T().settings)+'</h2><p>'+html(T().instructions)+'</p>'+
   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+
   row(T().width,'fhParkWidth',conf.widthFt,'number',stalls?'min="0.5" max="40" step="0.5"':'min="0.5" max="200" step="0.5"')+
   row(T().length,'fhParkLength',conf.lengthFt,'number',stalls?'min="1" max="50" step="0.5"':'min="0.5" max="200" step="0.5"')+
   row(T().rotation,'fhParkRotate',conf.rotation,'number','step="5"')+
   row(T().color,'fhParkColor',conf.color,'color')+
   (stalls?row(T().count,'fhParkCount',conf.count,'number','min="1" max="100" step="1"')+
    row(T().gap,'fhParkGap',conf.gapFt,'number','min="0" max="20" step="0.5"')+
    row(T().start,'fhParkStart',conf.startNumber,'number','min="0" max="9999" step="1"')+
    row(T().prefix,'fhParkPrefix',conf.prefix,'text','maxlength="16"'):'')+'</div>'+
   (stalls?row(T().accessible,'fhParkAccess',(conf.accessibleIndices||[]).join(','),'text','placeholder="1,3"'):'')+
   '<p><small>'+html(T().note)+'</small></p>'+
   '<div class="actions"><button id="fhParkAccept" class="primary">'+html(T().apply)+'</button><button id="fhParkCancel">'+html(T().close)+'</button></div>',()=>{
    el('fhParkCancel').onclick=env.closeModal;
    el('fhParkAccept').onclick=()=>{
     const field=(id,min,max)=>{const v=Number(el(id).value);return Number.isFinite(v)&&v>=min&&v<=max?v:null;};
     const w=field('fhParkWidth',.5,stalls?40:200),h=field('fhParkLength',stalls?1:.5,stalls?50:200),rotation=field('fhParkRotate',-3600,3600);
     const n=stalls?field('fhParkCount',1,100):1,gap=stalls?field('fhParkGap',0,20):0,start=stalls?field('fhParkStart',0,9999):1;
     if([w,h,rotation,n,gap,start].some(v=>v===null)){env.toast(T().invalidConfig);return;}
     Object.assign(conf,{widthFt:w,lengthFt:h,rotation,count:Math.trunc(n),gapFt:gap,startNumber:Math.trunc(start),
      color:el('fhParkColor').value});
     if(stalls){
      conf.prefix=el('fhParkPrefix').value.slice(0,16);
      const raw=el('fhParkAccess').value.trim();
      if(raw&&!/^\d+(?:\s*,\s*\d+)*$/.test(raw)){env.toast(T().invalidAccessible);return;}
      conf.accessibleIndices=raw?raw.split(',').map(Number).filter(n=>n>=1&&n<=conf.count):[];
     }
     env.closeModal();env.toast(T().ready);
    };
   });
 }
 function inGrid(item,units){
  const a=(Number(item.rotation)||0)*Math.PI/180;
  const halfW=(Math.abs(Math.cos(a))*item.w+Math.abs(Math.sin(a))*item.h)/2;
  const halfH=(Math.abs(Math.sin(a))*item.w+Math.abs(Math.cos(a))*item.h)/2;
  return item.x-halfW>=0&&item.y-halfH>=0&&item.x+halfW<=units.columns&&item.y+halfH<=units.rows;
 }
 function place(tool,p){
  if(!isTool(tool))return false;
  defaults(tool);const settings={...conf,feetPerCell:realFeet()};
  let items;
  try{
   if(conf.activeKind==='stall')items=P().createStalls(p,settings,env.newId);
   else items=[P().makeDecal(conf.activeKind,p.x,p.y,settings,env.newId())];
   if(items.some(it=>!inGrid(it,env.project().units))){env.toast(T().limited);return true;}
   if(items.some(it=>!env.canEditAt(it))){env.toast(T().deniedPaint);return true;}
   env.current().items.push(...items);env.record();
   env.toast(T().placed(items.length));
  }catch(error){env.toast(error.message);}
  return true;
 }
 function attachInspector(item,fields){
  if(item.type!=='parking_decal')return;
  const note=document.createElement('p');note.className='tip';note.style.gridColumn='1/-1';note.textContent=T().note;fields.append(note);
  const add=(title,value,type,onUpdate)=>{
   const row=document.createElement('label');row.textContent=title;
   const input=document.createElement('input');input.type=type;input.value=value;
   if(type==='number'){input.step='0.5';input.min='0.5';}
   input.onchange=()=>{
    if(!env.canEditItem(item)){env.toast(T().deniedEdit);return;}
    const n=type==='number'?Number(input.value):input.value;
    if(type==='number'&&(!Number.isFinite(n)||n<=0||n>200)){env.toast(T().invalidDimension);return;}
    onUpdate(n);env.record();
   };row.append(input);fields.append(row);
  };
  add(T().width,item.widthFt||P().toFeet(item.w,realFeet()),'number',n=>{item.widthFt=n;item.w=P().toCells(n,realFeet());});
  add(T().length,item.lengthFt||P().toFeet(item.h,realFeet()),'number',n=>{item.lengthFt=n;item.h=P().toCells(n,realFeet());});
  if(item.decalKind==='stall'){
   add(T().stallNumber,item.number||'','text',n=>item.number=String(n).slice(0,24));
   const label=document.createElement('label');label.className='ck';label.style.gridColumn='1/-1';
   const input=document.createElement('input');input.type='checkbox';input.checked=!!item.accessible;
   input.onchange=()=>{if(!env.canEditItem(item)){input.checked=!input.checked;return;}item.accessible=input.checked;env.record();};
   label.append(input,document.createTextNode(T().accessibleCheck));fields.append(label);
  }
  const color=document.createElement('label');color.textContent=T().markColor;
  const picker=document.createElement('input');picker.type='color';picker.value=item.color||'#F3EFDC';
  picker.onchange=()=>{if(!env.canEditItem(item))return;item.color=picker.value;env.record();};
  color.append(picker);fields.append(color);
 }
 function demo(){
  if(root.FHStyleEditor?.hasActor()){env.toast(T().demoCreator);return;}
  if(!confirm(T().replacement))return;
  const u=env.project().units,fpc=realFeet();
  if(u.columns<16||u.rows<12){env.toast(T().demoGrid);return;}
  const first={x:1.7,y:6.8},stalls=P().createStalls(first,{feetPerCell:fpc,count:8,widthFt:9,lengthFt:18,gapFt:0,startNumber:1},env.newId);
  const asphalt={id:env.newId(),type:'asphalt',x:.4,y:4.25,w:15.15,h:5.25,label:T().demoAsphalt,blocksMovement:false};
  const cars=stalls.slice(0,4).map((st,i)=>({
   id:env.newId(),type:'car',x:st.x,y:st.y,w:P().toCells(6,fpc),h:P().toCells(15,fpc),
   rotation:st.rotation,blocksMovement:true,label:T().carLabel+' '+(i+1),heightFt:5
  }));
  const spawn={id:env.newId(),type:'spawn',x:2,y:11,w:.4,h:.4,blocksMovement:false,label:T().spawnLabel};
  if(![...stalls,...cars].every(it=>inGrid(it,u))){env.toast(T().limited);return;}
  env.current().items=[asphalt,...stalls,...cars,spawn];
  env.record();env.toast(T().demoSuccess);
 }
 root.FHParkingEditor=Object.freeze({install(args){env=args},isTool,settings,place,attachInspector,demo,config:conf});
})(typeof globalThis!=='undefined'?globalThis:this);
