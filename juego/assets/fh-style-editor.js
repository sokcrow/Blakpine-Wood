/* Editor de acabados, propiedad y tapices. Todas las mutaciones pasan por record(). */
(function(root){
'use strict';
let env=null,actor='',clipboard=null,paperColor='#B6A9A0';
const P=()=>root.FHStyleProperty,T=()=>root.FH_STYLE_TEXT;
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const doc=()=>env.project(),floor=()=>env.current(),admin=()=>!actor;
const canRoom=room=>P().canPaintRoom(doc(),floor().id,room,actor,admin());
const canWall=(wall,side)=>P().canPaintWall(doc(),floor().id,wall,side,actor,admin());
const rooms=()=>floor().items.filter(i=>i.type==='room');
const byId=id=>floor().items.find(i=>i.id===id);
function report(error){env.toast(error?.message||String(error));}
function button(id,label,primary=false){return '<button type="button" id="'+id+'"'+(primary?' class="primary"':'')+'>'+h(label)+'</button>';}
function choices(options,selected){return options.map(([v,l])=>'<option value="'+h(v)+'"'+(v===selected?' selected':'')+'>'+h(l)+'</option>').join('');}
function findRoomBeside(wall,side){
 const q=P().sample(wall,side,.5,.12);
 return rooms().find(r=>P().roomContains(r,q))||null;
}
function styleValues(){
 return {preset:document.getElementById('fhStylePreset').value,
 color:document.getElementById('fhStyleColor').value,
 pattern:document.getElementById('fhStylePattern').value||null};
}
function styleDialog(kind,source,onSave,extra={}){
 const isFloor=kind==='floor',list=isFloor?T().floorPresets:T().wallPresets;
 const allowed=doc().patterns||[];
 const pattern='<option value="">Sin dibujo personalizado</option>'+allowed.map(p=>'<option value="'+h(p.id)+'">'+h(p.id)+'</option>').join('');
 const html='<h2>'+h(isFloor?T().paintFloor:T().paintWall)+'</h2><p>'+h(extra.description||'')+'</p>'+
 '<label>Material<select id="fhStylePreset">'+choices(list,source.preset)+'</select></label>'+
 '<label>Color<input id="fhStyleColor" type="color" value="'+h(source.color)+'"></label>'+
 '<label>Tapiz personalizado<select id="fhStylePattern">'+pattern+'</select></label>'+
 '<canvas id="fhStylePreview" width="192" height="96" style="width:100%;height:96px;image-rendering:pixelated;border:1px solid #6b768b"></canvas>'+
 '<div class="actions">'+button('fhStyleSave','Guardar acabado',true)+
 (extra.copy===false?'':button('fhStyleCopy',T().copy)+button('fhStylePaste',T().paste))+
 (extra.room?button('fhStyleRoom',isFloor?T().applyProperty:T().applyRoom):'')+
 button('fhStyleEditor',T().wallpaperEditor)+button('fhStyleBack','Cerrar')+'</div>';
 env.modal(html,()=>{
  const p=document.getElementById('fhStylePreset'),c=document.getElementById('fhStyleColor'),patternEl=document.getElementById('fhStylePattern');
  patternEl.value=source.pattern||'';
  const refresh=()=>{const s=styleValues();root.FHStyleRuntime?.preview(document.getElementById('fhStylePreview'),s,doc());};
  for(const input of [p,c,patternEl]){input.addEventListener('input',refresh);input.addEventListener('change',refresh);}
  refresh();
  document.getElementById('fhStyleSave').onclick=()=>{try{const s=styleValues();onSave(s);env.record();env.closeModal();env.toast('Acabado aplicado');}catch(err){report(err)}};
  const cp=document.getElementById('fhStyleCopy');
  if(cp)cp.onclick=()=>{clipboard=structuredStyle(styleValues());env.toast('Acabado copiado, selecciona otra pared o piso.')};
  const paste=document.getElementById('fhStylePaste');
  if(paste)paste.onclick=()=>{if(!clipboard)return env.toast('Todavía no hay un acabado copiado');p.value=clipboard.preset;c.value=clipboard.color;patternEl.value=clipboard.pattern||'';refresh();};
  const roomBtn=document.getElementById('fhStyleRoom');
  if(roomBtn)roomBtn.onclick=()=>{try{const s=styleValues();extra.room(s);env.record();env.closeModal();env.toast('Acabado aplicado a la habitación');}catch(err){report(err)}};
  document.getElementById('fhStyleEditor').onclick=()=>wallpaperEditor();
  document.getElementById('fhStyleBack').onclick=env.closeModal;
 });
}
function structuredStyle(s){return {preset:String(s.preset),color:String(s.color),pattern:s.pattern||null};}
function paintWall(wall,side){
 if(!wall?.a||!wall?.b||!['A','B'].includes(side))return;
 if(!canWall(wall,side))return env.toast(T().denied);
 const room=findRoomBeside(wall,side),initial=P().wallStyle(doc(),floor().id,wall,side);
 styleDialog('wall',initial,s=>P().paintWall(doc(),floor().id,byId(wall.id),side,s,actor,admin()),
 {description:(side==='A'?T().sideA:T().sideB)+' · '+h(room?.label||'fachada/exterior'),
 room:room?(s)=>P().paintRoomWalls(doc(),floor().id,room,s,actor,admin()):null});
}
function paintFloor(room){
 if(!room)return;
 if(!canRoom(room))return env.toast(T().denied);
 styleDialog('floor',P().floorStyle(room),s=>P().paintFloor(doc(),floor().id,byId(room.id),s,actor,admin()),
 {description:room.label||'Habitación',room:(s)=>{
   const p=P().propertyAt(doc(),floor().id,{x:room.x+room.w/2,y:room.y+room.h/2});
   const matches=p?rooms().filter(r=>P().roomInProperty(r,p)):[room];
   for(const r of matches)P().paintFloor(doc(),floor().id,r,s,actor,admin());
 }});
}
function propertyManager(){
 P().reconcileProperties(doc(),floor().id);
 const list=P().properties(doc(),floor().id),buildingList=P().buildings(doc(),floor().id);
 const cards=list.map((p,i)=>{
  const count=rooms().filter(r=>P().roomInProperty(r,p)).length;
  return '<section style="margin:9px 0;padding:10px;border:1px solid #a99753"><b>Propiedad '+(i+1)+'</b><small> · '+count+' habitaciones · '+h(p.id)+'</small>'+
  '<label>Jugador propietario<input data-fh-owner="'+h(p.id)+'" value="'+h(p.ownerId||'')+'" placeholder="ID de jugador"></label></section>';
 }).join('')||'<p>'+h(T().closed)+'</p>';
 const buildingCards=buildingList.map((b,i)=>'<section style="margin:9px 0;padding:10px;border:1px solid #c56b6b"><b>Edificio rojo '+(i+1)+'</b><small> · '+h(b.id)+'</small><label>Dueño del edificio<input data-fh-building="'+h(b.id)+'" value="'+h(doc().buildingOwners?.[b.id]||doc().buildingOwnerId||'')+'" placeholder="ID de dueño"></label></section>').join('');
 env.modal('<h2>'+h(T().propertyManager)+'</h2><p>Las paredes amarillas cerradas delimitan parcelas. Cada parcela incluye las habitaciones completas del interior. Las paredes rojas siguen definiendo edificios y losas.</p>'+
 '<label>'+h(T().buildingOwner)+'<input id="fhBuildingOwner" value="'+h(doc().buildingOwnerId||'')+'" placeholder="ID de dueño principal"></label>'+
 '<label>'+h(T().actor)+'<input id="fhActingPlayer" value="'+h(actor)+'" placeholder="Sin restricción"></label>'+buildingCards+cards+
 '<div class="actions">'+button('fhOwnerSave','Guardar dueños',true)+button('fhOwnerClose','Cerrar')+'</div>',()=>{
  document.getElementById('fhOwnerSave').onclick=()=>{
   doc().buildingOwnerId=document.getElementById('fhBuildingOwner').value.trim().slice(0,80);
   actor=document.getElementById('fhActingPlayer').value.trim().slice(0,80);
   doc().buildingOwners??={};for(const input of document.querySelectorAll('[data-fh-building]'))doc().buildingOwners[input.dataset.fhBuilding]=input.value.trim().slice(0,80);
   for(const input of document.querySelectorAll('[data-fh-owner]')){
    const p=doc().properties.find(q=>q.id===input.dataset.fhOwner);
    if(p)p.ownerId=input.value.trim().slice(0,80);
   }
   env.record();env.closeModal();env.toast('Propiedades y permisos actualizados');
  };
  document.getElementById('fhOwnerClose').onclick=env.closeModal;
 });
}
function wallpaperEditor(){
 const palette=['#14151B','#43434B','#6D7173','#B6A9A0','#E2D5B5','#FFFFFF','#7E3E45','#BC6861','#E5A36D','#E2CA70','#64855A','#90B4A1','#45677C','#82ABC0','#8A6A94','#C397B8'];
 const patternNames=(doc().patterns||[]).map(p=>p.id);
 env.modal('<h2>'+h(T().wallpaperEditor)+'</h2><p>Pinta un mosaico repetible. Los bordes opuestos se sincronizan al pintar. 16 colores como máximo. '+h(T().patternLimit)+'</p>'+
 '<label>Nombre/ID del tapiz<input id="fhPaperName" maxlength="48" placeholder="tapiz_sala"></label>'+
 '<label>Tamaño<select id="fhPaperSize"><option value="16">16 × 16</option><option value="32">32 × 32</option></select></label>'+
 '<label>Editar existente<select id="fhPaperExisting"><option value="">Nuevo tapiz</option>'+patternNames.map(n=>'<option value="'+h(n)+'">'+h(n)+'</option>').join('')+'</select></label>'+
 '<canvas id="fhPaperCanvas" width="16" height="16" style="width:min(70vw,290px);height:min(70vw,290px);display:block;margin:10px auto;image-rendering:pixelated;border:2px solid #b4a2ca;touch-action:none"></canvas>'+
 '<div id="fhPaperColors" style="display:grid;grid-template-columns:repeat(8,1fr);gap:4px"></div>'+
 '<div class="actions">'+button('fhPaperSave','Guardar PNG 16/32',true)+button('fhPaperErase','Limpiar')+button('fhPaperClose','Cerrar')+'</div>',()=>{
  const canvas=document.getElementById('fhPaperCanvas'),ctx=canvas.getContext('2d',{willReadFrequently:true}),colors=document.getElementById('fhPaperColors');
  ctx.imageSmoothingEnabled=false;
  let chosen=palette[3],drawing=false;
  colors.replaceChildren(...palette.map(color=>{const b=document.createElement('button');b.type='button';b.style.cssText='height:30px;min-width:0;padding:0;background:'+color+';border:2px solid '+(color===chosen?'#fff':'#333');b.title=color;
   b.onclick=()=>{chosen=color;for(const el of colors.children)el.style.borderColor=el===b?'#fff':'#333';};return b;}));
  const clear=()=>{ctx.fillStyle=palette[3];ctx.fillRect(0,0,canvas.width,canvas.height)};
  clear();
  const draw=e=>{const rect=canvas.getBoundingClientRect(),x=Math.min(canvas.width-1,Math.max(0,Math.floor((e.clientX-rect.left)/rect.width*canvas.width))),y=Math.min(canvas.height-1,Math.max(0,Math.floor((e.clientY-rect.top)/rect.height*canvas.height)));
    ctx.fillStyle=chosen;ctx.fillRect(x,y,1,1); // Las muestras del borde opuesto coinciden
    if(x===0||x===canvas.width-1)ctx.fillRect(canvas.width-1-x,y,1,1);
    if(y===0||y===canvas.height-1)ctx.fillRect(x,canvas.height-1-y,1,1);
    if((x===0||x===canvas.width-1)&&(y===0||y===canvas.height-1))ctx.fillRect(canvas.width-1-x,canvas.height-1-y,1,1);
  };
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();drawing=true;canvas.setPointerCapture(e.pointerId);draw(e);});
  canvas.addEventListener('pointermove',e=>{if(drawing){e.preventDefault();draw(e);}});
  canvas.addEventListener('pointerup',()=>drawing=false);canvas.addEventListener('pointercancel',()=>drawing=false);
  document.getElementById('fhPaperErase').onclick=clear;
  const resize=n=>{const prev=document.createElement('canvas');prev.width=canvas.width;prev.height=canvas.height;prev.getContext('2d').drawImage(canvas,0,0);canvas.width=canvas.height=n;ctx.imageSmoothingEnabled=false;ctx.drawImage(prev,0,0,n,n);};
  document.getElementById('fhPaperSize').onchange=e=>resize(Number(e.target.value));
  document.getElementById('fhPaperExisting').onchange=e=>{
   const found=doc().patterns.find(p=>p.id===e.target.value);if(!found)return;
   document.getElementById('fhPaperName').value=found.id;
   const n=found.width||16;document.getElementById('fhPaperSize').value=String(n);resize(n);
   const image=new Image();image.onload=()=>{ctx.clearRect(0,0,n,n);ctx.drawImage(image,0,0,n,n)};image.src=found.png;
  };
  document.getElementById('fhPaperSave').onclick=()=>{
   const id=document.getElementById('fhPaperName').value.trim();
   if(!/^[\w-]{1,48}$/.test(id))return env.toast('Usa un ID de 1–48 caracteres (letras, números, _ o -)');
   const a=doc().patterns||[],i=a.findIndex(p=>p.id===id);
   if(i===-1&&a.length>=P().MAX_PATTERNS)return env.toast(T().patternLimit);
   const png=canvas.toDataURL('image/png'),data={id,width:canvas.width,height:canvas.height,png};
   try{P().pngInfo(png);const updated=a.slice();if(i<0)updated.push(data);else updated[i]=data;P().validatePatterns(updated);doc().patterns=updated;env.record();env.closeModal();env.toast('Tapiz guardado en el JSON del proyecto');}catch(err){report(err)}
  };
  document.getElementById('fhPaperClose').onclick=env.closeModal;
 });
}
function attachInspector(item,fields){
 if(['door','peephole_door'].includes(item.type)){
  const property=root.FHPropertyZones?.doorAt(doc(),floor().id,item)||P().propertyAt(doc(),floor().id,{x:(item.a.x+item.b.x)/2,y:(item.a.y+item.b.y)/2});
  if(property){
   const holder=document.createElement('label');holder.style.gridColumn='1/-1';
   holder.textContent='Acceso de propiedad: '+(property.name||property.id);
   const select=document.createElement('select');
   for(const [value,label] of [['','Sin asignar'],['main','Puerta principal'],['rear','Puerta trasera'],['extra','Puerta adicional']]){
    const op=document.createElement('option');op.value=value;op.textContent=label;select.append(op);
   }
   select.value=['main','rear','extra'].includes(item.propertyDoorRole)?item.propertyDoorRole:'';
   select.onchange=()=>{
    if(!admin()&&!P().canEditItem(doc(),floor().id,item,actor,false)){env.toast(T().denied);return;}
    if(select.value==='main'){
     for(const other of floor().items.filter(it=>it.id!==item.id&&['door','peephole_door'].includes(it.type)&&it.propertyDoorRole==='main')){
      const p=root.FHPropertyZones?.doorAt(doc(),floor().id,other);
      if(p?.id===property.id)delete other.propertyDoorRole;
     }
    }
    if(select.value)item.propertyDoorRole=select.value;
    else delete item.propertyDoorRole;
    env.record();env.toast('Tipo de acceso de propiedad guardado.');
   };
   holder.append(select);fields.append(holder);
  }
 }
 if(['wall','red_wall','property_wall','half_wall'].includes(item.type)){
  const a=document.createElement('button');a.textContent='▨ Pintar cara A';a.onclick=()=>paintWall(item,'A');
  const b=document.createElement('button');b.textContent='▨ Pintar cara B';b.onclick=()=>paintWall(item,'B');
  fields.append(a,b);
 }
 if(['room','hall','outside','building','pavement','parking','grass','dirt','asphalt','alley','sidewalk','concrete','gravel','cobblestone','tile_floor','carpet','wood_floor'].includes(item.type)){
  const btn=document.createElement('button');btn.textContent='▨ Pintar piso';btn.style.gridColumn='1/-1';btn.onclick=()=>paintFloor(item);fields.append(btn);
 }
}
root.FHStyleEditor=Object.freeze({install(config){env=config},paintWall,paintFloor,propertyManager,wallpaperEditor,attachInspector,hasActor:()=>!!actor,canEditAt:p=>P().canEditAt(doc(),floor().id,p,actor,admin()),canEditItem:item=>P().canEditItem(doc(),floor().id,item,actor,admin())});
})(typeof globalThis!=='undefined'?globalThis:this);
