/* Capa de parcelas editable: solo metadatos; ninguna pared, malla ni colisión. */
(function(root){
 'use strict';
 const P=()=>root.FHStyleProperty,Z=()=>root.FHPropertyZones;
 const escape=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[ch]));
 const types=new Set(['property_zone','location_exterior','location_common','property_select','property_erase']);
 let start=null,gesture=null,live=null;
 const local=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}};
 const point=e=>getPoint(local(e));
 const layer=()=>activeLayer==='property';
 const props=()=>P().properties(project,current().id);
 const locations=()=>Z().locations(project,current().id);
 const sourceAt=p=>{
  const properties=props().filter(prop=>Z().inside(p,prop.polygon));
  if(properties.length===1)return {kind:'property',zone:properties[0]};
  const zones=locations().filter(zone=>Z().inside(p,zone.polygon));
  return zones.length===1?{kind:'location',zone:zones[0]}:null;
 };
 const midpoint=poly=>({x:poly.reduce((s,p)=>s+p.x,0)/poly.length,y:poly.reduce((s,p)=>s+p.y,0)/poly.length});
 function drawOutline(c,poly,selected=false,shade=true,tint='#e6bd43'){
  if(!poly?.length)return;
  c.save();c.beginPath();const first=toPixel(poly[0]);c.moveTo(first.x,first.y);
  for(const q of poly.slice(1)){const p=toPixel(q);c.lineTo(p.x,p.y)}
  c.closePath();if(shade){c.fillStyle=tint==='#e6bd43'?'rgba(230,189,67,.13)':'rgba(99,164,208,.14)';c.fill()}
  c.lineWidth=(selected?3.1:2.3)/view.scale;c.strokeStyle=selected?'#fff4c5':tint;c.setLineDash([8/view.scale,4/view.scale]);c.stroke();c.restore();
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
  for(const zone of locations()){
   drawOutline(c,zone.polygon,false,true,zone.kind==='exterior'?'#82c9ae':'#8bbcf0');
   const center=toPixel(midpoint(zone.polygon));
   c.save();c.textAlign='center';c.textBaseline='middle';c.lineWidth=3/cam.scale;c.strokeStyle='#111722';c.fillStyle='#e0f4ff';
   c.font='700 '+12/cam.scale+'px system-ui';
   c.strokeText(zone.name||'Zona',center.x,center.y);c.fillText(zone.name||'Zona',center.x,center.y);c.restore();
  }
  if(start&&live){const rect=Z().rectangle(start,live,project.units.columns,project.units.rows);
   if(rect)drawOutline(c,Z().polygon(rect),true,true,activeTool==='property_zone'?'#e6bd43':'#8bbcf0');}
  c.restore();
 };
 TOOL_GROUPS.property=[['property_zone','Delimitar propiedad','▱'],['location_exterior','Zona exterior','♧'],['location_common','Zona común','▥'],['property_select','Editar zona','☞'],['property_erase','Eliminar zona','⌫'],['pan','Mover mapa','✋']];
 const oldLayerForCategory=layerForCategory;
 layerForCategory=function(cat){return cat==='property'?'property':oldLayerForCategory(cat)};
 const tab=document.createElement('button');tab.type='button';tab.dataset.layer='property';tab.textContent='▱ Zonas';tab.onclick=()=>setCategory('property');document.getElementById('layerSwitch').append(tab);
 const cat=document.createElement('button');cat.type='button';cat.dataset.cat='property';cat.textContent='▱ Zonas';cat.onclick=()=>setCategory('property');document.getElementById('categories').append(cat);
 const priorCategory=setCategory;
 setCategory=function(category){if(category!=='property'){start=null;live=null;}priorCategory(category);if(category==='property'){
  const panel=document.getElementById('tools');
  const manage=document.createElement('button');manage.type='button';manage.className='accent';manage.textContent='▱ Administrar zonas';manage.onclick=openManager;panel.prepend(manage);
  document.getElementById('stageHint').textContent='Delimita propiedades, jardines y zonas comunes. No se crean paredes ni colisiones.';
 }};
 const priorFloorChange=changeFloor;
 changeFloor=function(i){start=null;live=null;gesture=null;return priorFloorChange(i)};
 const oldChooseTool=chooseTool;
 chooseTool=function(tool){if(types.has(tool)){start=null;live=null;}oldChooseTool(tool);
  if(tool==='property_zone')document.getElementById('stageHint').textContent='Dibuja una propiedad reclamable; conserva sus permisos existentes.';
  if(tool==='location_exterior')document.getElementById('stageHint').textContent='Delimita un jardín, patio o zona exterior; no altera permisos.';
  if(tool==='location_common')document.getElementById('stageHint').textContent='Delimita un pasillo, vestíbulo o zona común de edificio.';
  if(tool==='property_select')document.getElementById('stageHint').textContent='Toca una zona para editar su nombre o, en propiedades, su propietario.';
  if(tool==='property_erase')document.getElementById('stageHint').textContent='Toca la zona que quieras eliminar; se pedirá confirmación.';
 };
 function add(a,b,tool){
  if(root.FHStyleEditor?.hasActor()){start=null;live=null;toast('Solo el DM puede crear zonas.');render();return}
  const isLocation=tool==='location_exterior'||tool==='location_common';
  const id=(isLocation?'location_':'parcel_')+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
  const result=isLocation
   ?Z().createLocation(project,current().id,a,b,project.units.columns,project.units.rows,id,tool==='location_exterior'?'exterior':'common')
   :Z().create(project,current().id,a,b,project.units.columns,project.units.rows,id);
  start=null;live=null;
  if(!result.ok){toast(result.reason);render();return}
  if(isLocation){
   project.locationZones??=[];project.locationZones.push(result.zone);
   record();render();openLocation(id);
  }else{
   project.properties??=[];project.properties.push(result.zone);
   record();render();toast('Propiedad creada: disponible para asignar.');openProperty(id);
  }
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
     if(root.FHStyleEditor?.hasActor()){toast('Solo el DM puede asignar propiedades.');return}
     if(editable){prop.name=(document.getElementById('fhParcelName').value.trim()||'Parcela').slice(0,80);
      prop.claimable=document.getElementById('fhParcelClaim').value==='yes';}
     prop.ownerId=document.getElementById('fhParcelOwner').value.trim().slice(0,80);
     record();closeModal();toast('Datos de propiedad guardados');render();
    };
    document.getElementById('fhParcelClose').onclick=closeModal;
    if(editable)document.getElementById('fhParcelDelete').onclick=()=>{
     if(root.FHStyleEditor?.hasActor()){toast('Solo el DM puede eliminar parcelas.');return}
     modal('<h2>Eliminar delimitación</h2><p>Se borrará solo la parcela, no los muros, muebles, pisos ni puertas.</p><div class="actions"><button id="fhParcelDeleteConfirm" class="danger">Eliminar definitivamente</button><button id="fhParcelDeleteCancel">Cancelar</button></div>',()=>{
      document.getElementById('fhParcelDeleteConfirm').onclick=()=>{
       if(root.FHStyleEditor?.hasActor()){toast('Solo el DM puede eliminar parcelas.');return}
       project.properties=project.properties.filter(p=>p.id!==id);record();closeModal();toast('Delimitación eliminada');render();
      };
      document.getElementById('fhParcelDeleteCancel').onclick=()=>openProperty(id);
     });
    };
   });
 }
 function openLocation(id){
  const zone=(project.locationZones||[]).find(z=>z.id===id&&z.floorId===current().id);
  if(!zone)return;
  const name=escape(zone.name||''),kind=zone.kind==='exterior'?'exterior':'common';
  modal('<h2>Zona · '+name+'</h2><p>Este nombre aparece en la segunda línea del HUD. No otorga propiedad ni crea colisiones.</p>'+
   '<label>Nombre de la zona<input id="fhLocationName" maxlength="80" value="'+name+'"></label>'+
   '<label>Tipo<select id="fhLocationKind"><option value="exterior"'+(kind==='exterior'?' selected':'')+'>Exterior</option>'+
   '<option value="common"'+(kind==='common'?' selected':'')+'>Común de edificio</option></select></label>'+
   '<div class="actions"><button id="fhLocationSave" class="primary">Guardar</button>'+
   '<button id="fhLocationDelete" class="danger">Eliminar zona</button><button id="fhLocationClose">Cerrar</button></div>',()=>{
    document.getElementById('fhLocationClose').onclick=closeModal;
    document.getElementById('fhLocationSave').onclick=()=>{
     if(root.FHStyleEditor?.hasActor()){toast('Solo el DM puede editar zonas.');return}
     zone.name=document.getElementById('fhLocationName').value.trim().slice(0,80);
     zone.kind=document.getElementById('fhLocationKind').value==='exterior'?'exterior':'common';
     record();closeModal();render();toast('Zona guardada');
    };
    document.getElementById('fhLocationDelete').onclick=()=>{
     if(root.FHStyleEditor?.hasActor()){toast('Solo el DM puede eliminar zonas.');return}
     modal('<h2>Eliminar zona</h2><p>Se borrará solo la etiqueta y delimitación, sin tocar muros ni objetos.</p><div class="actions">'+
      '<button id="fhLocationDeleteConfirm" class="danger">Eliminar definitivamente</button><button id="fhLocationDeleteCancel">Cancelar</button></div>',()=>{
       document.getElementById('fhLocationDeleteConfirm').onclick=()=>{
        project.locationZones=project.locationZones.filter(z=>z.id!==id);
        record();closeModal();render();toast('Zona eliminada');
       };
       document.getElementById('fhLocationDeleteCancel').onclick=()=>openLocation(id);
      });
    };
   });
 }
 function openManager(){
  const propertyCards=props().map(p=>{
   const c=Z().counts(current(),p),name=escape(p.name||'Propiedad'),owner=escape(p.ownerId||'Sin reclamar');
   return '<section style="padding:9px 4px;border-top:1px solid #4d617a"><b>'+name+'</b> · <small>'+owner+'</small>'+
    '<p><small>'+c.walls+' muros · '+c.areas+' áreas · '+c.doors+' puertas</small></p>'+
    '<button type="button" data-fh-parcel="'+escape(p.id)+'">Editar / asignar</button></section>';
  }).join('')||'<p>No hay propiedades delimitadas en este piso.</p>';
  const locationCards=locations().map(z=>
   '<section style="padding:9px 4px;border-top:1px solid #4d617a"><b>'+escape(z.name||'Zona')+'</b> · '+
   '<small>'+(z.kind==='exterior'?'Exterior':'Zona común')+'</small>'+
   '<p><button type="button" data-fh-location="'+escape(z.id)+'">Editar zona</button></p></section>'
  ).join('')||'<p>No hay zonas exteriores o comunes delimitadas.</p>';
  const buildings=P().buildings(project,current().id);
  const buildingFields=buildings.map(b=>
   '<label>'+escape(b.id)+'<input data-fh-building="'+escape(b.id)+'" maxlength="80" value="'+
   escape(project.buildingNames?.[b.id]||'')+'" placeholder="'+escape(project.title||'EDIFICIO')+'"></label>'
  ).join('')||'<p>El nombre de cada edificio se habilita al cerrar un contorno de paredes rojas.</p>';
  modal('<h2>Administrar zonas · '+escape(current().name)+'</h2>'+
   '<h3>Edificios</h3><p>Nombre mostrado sobre pasillos y áreas comunes.</p>'+buildingFields+
   (buildings.length?'<button id="fhBuildingNamesSave" class="accent">Guardar nombres de edificios</button>':'')+
   '<h3>Propiedades</h3>'+propertyCards+
   '<h3>Exteriores y zonas comunes</h3>'+locationCards+
   '<div class="actions"><button id="fhParcelManageClose">Cerrar</button></div>',()=>{
    document.querySelectorAll('[data-fh-parcel]').forEach(b=>b.onclick=()=>openProperty(b.dataset.fhParcel));
    document.querySelectorAll('[data-fh-location]').forEach(b=>b.onclick=()=>openLocation(b.dataset.fhLocation));
    const save=document.getElementById('fhBuildingNamesSave');
    if(save)save.onclick=()=>{
     if(root.FHStyleEditor?.hasActor()){toast('Solo el DM puede editar edificios.');return}
     project.buildingNames??={};
     document.querySelectorAll('[data-fh-building]').forEach(input=>{
      const name=input.value.trim().slice(0,80),id=input.dataset.fhBuilding;
      if(name)project.buildingNames[id]=name;else delete project.buildingNames[id];
     });
     record();closeModal();toast('Nombres de edificios guardados');render();
    };
    document.getElementById('fhParcelManageClose').onclick=closeModal;
   });
 }
 root.FHPropertyEditor=Object.freeze({openManager,openProperty,openLocation});
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
  if(gesture?.id===e.pointerId&&['property_zone','location_exterior','location_common'].includes(gesture.tool)){const distance=Math.hypot(local(e).x-gesture.screen.x,local(e).y-gesture.screen.y);if(start||distance>7){live=p;if(!start)start=gesture.a;render();}}
 },true);
 target.addEventListener('pointerup',e=>{
  if(!isPropertyTool())return;
  e.preventDefault();e.stopImmediatePropagation();
  if(!gesture||gesture.id!==e.pointerId)return;
  const g=gesture;gesture=null;const p=point(e);
  const drag=Math.hypot(e.clientX-g.screen.x-target.getBoundingClientRect().left,e.clientY-g.screen.y-target.getBoundingClientRect().top)>7;
  if(['property_zone','location_exterior','location_common'].includes(g.tool)){
   if(drag){add(start||g.a,p,g.tool);return}
   if(!start){start=g.a;live=null;toast('Primera esquina marcada. Toca la esquina opuesta.');render();return}
   add(start,p,g.tool);return;
  }
  const selected=sourceAt(p);
  if(!selected){toast('No hay ninguna zona aquí.');return}
  if(selected.kind==='location'){openLocation(selected.zone.id);return}
  if(g.tool==='property_select'){openProperty(selected.zone.id);return}
  if(selected.zone.source==='zone'){openProperty(selected.zone.id);toast('Usa Eliminar parcela para confirmar.');}
  else toast('Las propiedades heredadas dependen de paredes amarillas y no se borran desde esta capa.');
 },true);
 target.addEventListener('pointercancel',e=>{if(!isPropertyTool())return;e.stopImmediatePropagation();gesture=null;live=null;start=null;render();},true);
 root.addEventListener('keydown',e=>{if(e.key==='Escape'&&layer()){start=null;live=null;gesture=null;render();}});
})(window);
