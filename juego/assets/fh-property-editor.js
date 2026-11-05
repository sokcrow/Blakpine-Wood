/* Capa de parcelas editable: solo metadatos; ninguna pared, malla ni colisión. */
(function(root){
 'use strict';
 const P=()=>root.FHStyleProperty,Z=()=>root.FHPropertyZones;
 const escape=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
 const types=new Set(['property_zone','property_select','property_erase']);
 let start=null,gesture=null,live=null;
 const local=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}};
 const point=e=>getPoint(local(e));
 const layer=()=>activeLayer==='property';
 const props=()=>P().properties(project,current().id);
 const sourceAt=p=>{const hits=props().filter(prop=>Z().inside(p,prop.polygon));return hits.length===1?hits[0]:null};
 const midpoint=poly=>({x:poly.reduce((s,p)=>s+p.x,0)/poly.length,y:poly.reduce((s,p)=>s+p.y,0)/poly.length});
 function drawOutline(c,poly,selected=false,shade=true){
  if(!poly?.length)return;
  c.save();c.beginPath();const first=toPixel(poly[0]);c.moveTo(first.x,first.y);
  for(const q of poly.slice(1)){const p=toPixel(q);c.lineTo(p.x,p.y)}
  c.closePath();if(shade){c.fillStyle='rgba(230,189,67,.13)';c.fill()}
  c.lineWidth=(selected?3.1:2.3)/view.scale;c.strokeStyle=selected?'#fff4c5':'#e6bd43';c.setLineDash([8/view.scale,4/view.scale]);c.stroke();c.restore();
 }
 const baseRender=renderOn;
 renderOn=function(c,w,h,cam,opts={}){
  baseRender(c,w,h,cam,opts);
  if(!layer()||opts.clean)return;
  const d=opts.dpr||1;
  c.save();c.setTransform(d,0,0,d,0,0);c.translate(cam.tx,cam.ty);c.scale(cam.scale,cam.scale);
  for(const prop of props()){
   drawOutline(c,prop.polygon,false,true);
   const center=toPixel(midpoint(prop.polygon));
   const name=prop.name||'Propiedad',owner=prop.ownerId?'Dueño: '+prop.ownerId:(prop.claimable===false?'Reservada':'Disponible');
   c.save();c.textAlign='center';c.textBaseline='middle';c.lineWidth=3/cam.scale;c.strokeStyle='#151d27';c.fillStyle='#fff2bf';
   c.font='700 '+12/cam.scale+'px system-ui';c.strokeText(name,center.x,center.y-8/cam.scale);c.fillText(name,center.x,center.y-8/cam.scale);
   c.font=10/cam.scale+'px system-ui';c.strokeText(owner,center.x,center.y+8/cam.scale);c.fillText(owner,center.x,center.y+8/cam.scale);c.restore();
  }
  if(start&&live){const rect=Z().rectangle(start,live,project.units.columns,project.units.rows);if(rect)drawOutline(c,Z().polygon(rect),true,true)}
  c.restore();
 };
 TOOL_GROUPS.property=[['property_zone','Delimitar propiedad','▱'],['property_select','Editar parcela','☞'],['property_erase','Eliminar parcela','⌫'],['pan','Mover mapa','✋']];
 const oldLayerForCategory=layerForCategory;
 layerForCategory=function(cat){return cat==='property'?'property':oldLayerForCategory(cat)};
 const tab=document.createElement('button');tab.type='button';tab.dataset.layer='property';tab.textContent='▱ Propiedad';tab.onclick=()=>setCategory('property');document.getElementById('layerSwitch').append(tab);
 const cat=document.createElement('button');cat.type='button';cat.dataset.cat='property';cat.textContent='▱ Propiedades';cat.onclick=()=>setCategory('property');document.getElementById('categories').append(cat);
 const priorCategory=setCategory;
 setCategory=function(category){if(category!=='property'){start=null;live=null;}priorCategory(category);if(category==='property'){
  const panel=document.getElementById('tools');
  const manage=document.createElement('button');manage.type='button';manage.className='accent';manage.textContent='▱ Administrar';manage.onclick=openManager;panel.prepend(manage);
  document.getElementById('stageHint').textContent='Crea una parcela arrastrando o tocando dos esquinas. No agrega paredes ni colisiones. El DM asigna dueño en Administrar.';
 }};
 const oldChooseTool=chooseTool;
 chooseTool=function(tool){if(types.has(tool)){start=null;live=null;}oldChooseTool(tool);
  if(tool==='property_zone')document.getElementById('stageHint').textContent='Dibuja el límite de propiedad: arrastra o toca dos esquinas. No coloca muros.';
  if(tool==='property_select')document.getElementById('stageHint').textContent='Toca una parcela para cambiar nombre, disponibilidad o propietario.';
  if(tool==='property_erase')document.getElementById('stageHint').textContent='Toca una parcela creada con esta capa para quitarla (se pedirá confirmar).';
 };
 function add(a,b){
  const id='parcel_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
  const result=Z().create(project,current().id,a,b,project.units.columns,project.units.rows,id);
  start=null;live=null;
  if(!result.ok){toast(result.reason);render();return}
  project.properties??=[];project.properties.push(result.zone);record();render();toast('Parcela creada: disponible para asignar.');openProperty(result.zone.id);
 }
 function openProperty(id){
  const prop=project.properties?.find(p=>p.id===id&&p.floorId===current().id);
  if(!prop)return;
  const c=Z().counts(current(),prop),editable=prop.source==='zone';
  const heading=escape(prop.name||'Propiedad'),owner=escape(prop.ownerId||'');
  modal('<h2>Propiedad · '+heading+'</h2><p>Zona de administración del DM. No crea paredes ni obstáculos.</p>'+
   '<p><small>ID: '+escape(prop.id)+' · '+c.walls+' muros · '+c.areas+' áreas · '+c.doors+' puertas · '+c.objects+' objetos contenidos</small></p>'+
   (editable?'<label>Nombre de parcela<input id="fhParcelName" maxlength="80" value="'+heading+'"></label>':'')+
   '<label>ID del jugador propietario<input id="fhParcelOwner" maxlength="80" placeholder="Vacío = sin reclamar" value="'+owner+'"></label>'+
   (editable?'<label>Disponibilidad<select id="fhParcelClaim"><option value="yes"'+(prop.claimable!==false?' selected':'')+'>Disponible para reclamar (futuro)</option><option value="no"'+(prop.claimable===false?' selected':'')+'>Reservada por el DM</option></select></label>':'')+
   '<div class="actions"><button class="primary" id="fhParcelSave">Guardar</button>'+
   (editable?'<button class="danger" id="fhParcelDelete">Eliminar parcela</button>':'')+
   '<button id="fhParcelClose">Cerrar</button></div>',()=>{
    document.getElementById('fhParcelSave').onclick=()=>{
     if(editable){prop.name=(document.getElementById('fhParcelName').value.trim()||'Parcela').slice(0,80);
      prop.claimable=document.getElementById('fhParcelClaim').value==='yes';}
     prop.ownerId=document.getElementById('fhParcelOwner').value.trim().slice(0,80);
     record();closeModal();toast('Datos de propiedad guardados');render();
    };
    document.getElementById('fhParcelClose').onclick=closeModal;
    if(editable)document.getElementById('fhParcelDelete').onclick=()=>{
     modal('<h2>Eliminar delimitación</h2><p>Se borrará solo la parcela, no los muros, muebles, pisos ni puertas.</p><div class="actions"><button id="fhParcelDeleteConfirm" class="danger">Eliminar definitivamente</button><button id="fhParcelDeleteCancel">Cancelar</button></div>',()=>{
      document.getElementById('fhParcelDeleteConfirm').onclick=()=>{
       project.properties=project.properties.filter(p=>p.id!==id);record();closeModal();toast('Delimitación eliminada');render();
      };
      document.getElementById('fhParcelDeleteCancel').onclick=()=>openProperty(id);
     });
    };
   });
 }
 function openManager(){
  const list=props();
  const cards=list.map(p=>{const c=Z().counts(current(),p),name=escape(p.name||'Propiedad'),owner=escape(p.ownerId||'Sin reclamar');
    return '<section style="padding:9px 4px;border-top:1px solid #4d617a"><b>'+name+'</b> · <small>'+owner+'</small><p><small>'+c.walls+' muros · '+c.areas+' áreas · '+c.doors+' puertas</small></p><button type="button" data-fh-parcel="'+escape(p.id)+'">Editar / asignar</button></section>';
  }).join('')||'<p>No hay parcelas en este piso. Usa Delimitar propiedad para crear una.</p>';
  modal('<h2>Administrar propiedades · '+escape(current().name)+'</h2><p>El DM asigna propietario manualmente. Las parcelas sin dueño no están reclamadas.</p>'+cards+
   '<div class="actions"><button id="fhParcelManageClose">Cerrar</button></div>',()=>{
    document.querySelectorAll('[data-fh-parcel]').forEach(b=>b.onclick=()=>openProperty(b.dataset.fhParcel));
    document.getElementById('fhParcelManageClose').onclick=closeModal;
   });
 }
 root.FHPropertyEditor=Object.freeze({openManager,openProperty});
 function isPropertyTool(){return layer()&&types.has(activeTool)}
 const target=document.getElementById('map');
 target.addEventListener('pointerdown',e=>{
  if(!isPropertyTool()||e.button!==0)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(gesture){gesture=null;start=null;live=null;return}
  const p=point(e);gesture={id:e.pointerId,a:p,screen:local(e),tool:activeTool};
  target.setPointerCapture?.(e.pointerId);
 },true);
 target.addEventListener('pointermove',e=>{
  if(!isPropertyTool())return;
  e.preventDefault();e.stopImmediatePropagation();
  const p=point(e);
  document.getElementById('coords').textContent='Casilla '+p.x.toFixed(2)+', '+p.y.toFixed(2);
  if(gesture?.id===e.pointerId&&gesture.tool==='property_zone'){const distance=Math.hypot(local(e).x-gesture.screen.x,local(e).y-gesture.screen.y);if(start||distance>7){live=p;if(!start)start=gesture.a;render();}}
 },true);
 target.addEventListener('pointerup',e=>{
  if(!isPropertyTool())return;
  e.preventDefault();e.stopImmediatePropagation();
  if(!gesture||gesture.id!==e.pointerId)return;
  const g=gesture;gesture=null;const p=point(e);
  const drag=Math.hypot(e.clientX-g.screen.x-target.getBoundingClientRect().left,e.clientY-g.screen.y-target.getBoundingClientRect().top)>7;
  if(g.tool==='property_zone'){
   if(drag){add(start||g.a,p);return}
   if(!start){start=g.a;live=null;toast('Primera esquina marcada. Toca la esquina opuesta.');render();return}
   add(start,p);return;
  }
  const selected=sourceAt(p);
  if(!selected){toast('No hay ninguna propiedad aquí.');return}
  if(g.tool==='property_select'){openProperty(selected.id);return}
  if(selected.source==='zone'){openProperty(selected.id);toast('Usa Eliminar parcela para confirmar.');}
  else toast('Las propiedades antiguas dependen de paredes amarillas; no se borran desde esta capa.');
 },true);
 target.addEventListener('pointercancel',e=>{if(!isPropertyTool())return;e.stopImmediatePropagation();gesture=null;live=null;start=null;render();},true);
 root.addEventListener('keydown',e=>{if(e.key==='Escape'&&layer()){start=null;live=null;gesture=null;render();}});
})(window);
