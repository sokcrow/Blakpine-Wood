/* Construcción 04 — planos editables con habitaciones privadas y circulación común.
 * Toda geometría es nativa de forest-horror-map-v1; no genera mallas decorativas.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHConstructionPrefabs=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const EPS=1e-5,ROOM_MARGIN=.12,FRONT=.70;
 const MIN=Object.freeze({ayuntamiento:[12,11],casas:[13,12],apartamentos:[22,22],tienda:[13,11]});
 const TARGET=Object.freeze({ayuntamiento:[22,16],casas:[19,16],apartamentos:[64,28],tienda:[22,16]});
 const ROOM_FLOORS=Object.freeze({
  bano:{preset:'azulejo',color:'#90AEAF'},dormitorio:{preset:'madera',color:'#A0846E'},
  cocina:{preset:'baldosa',color:'#B8B0A5'},oficina:{preset:'baldosa',color:'#ADA9A1'},
  ventas:{preset:'baldosa',color:'#AAA8A0'},comun:{preset:'concreto',color:'#A1A4A0'}
 });
 const LABELS={ayuntamiento:'Ayuntamiento',casas:'Casa',apartamentos:'Apartamentos',tienda:'Tienda'};
 const NAMES={bano:'Baño',dormitorio:'Recámara',cocina:'Sala y cocina',oficina:'Oficina',
  ventas:'Área de ventas',comun:'Pasillo común'};
 const round=n=>Math.round(n*1000)/1000;
 const number=n=>typeof n==='number'&&Number.isFinite(n);
 const failure=(code,data={})=>({ok:false,code,...data});
 const box=(x,y,w,h)=>({x,y,w,h});
 const overlaps=(a,b)=>a.x<b.x+b.w-EPS&&a.x+a.w>b.x+EPS&&a.y<b.y+b.h-EPS&&a.y+a.h>b.y+EPS;
 const contains=(rect,p)=>p.x>=rect.x-EPS&&p.y>=rect.y-EPS&&p.x<=rect.x+rect.w+EPS&&p.y<=rect.y+rect.h+EPS;
 const inside=(p,poly)=>{
  if(!Array.isArray(poly)||poly.length<3)return false;
  let v=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
   const a=poly[i],b=poly[j],cross=(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
   if(Math.abs(cross)<EPS&&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS
    &&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS)return true;
   if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)v=!v;
  }
  return v;
 };
 function footprint(it,units){
  if(it?.a&&it?.b)return box(Math.min(it.a.x,it.b.x)-.10,Math.min(it.a.y,it.b.y)-.10,
   Math.abs(it.b.x-it.a.x)+.20,Math.abs(it.b.y-it.a.y)+.20);
  if(!number(it?.x)||!number(it?.y))return null;
  const w=Math.max(0,Number(it.w)||0),h=Math.max(0,Number(it.h)||0);
  const regionTypes=['room','hall','building','outside','grass','dirt','pavement','parking','concrete','asphalt','alley','sidewalk'];
  if(it.type==='asphalt'&&it.road){
   const gap=Math.max(0,Number(it.road.sidewalkFt)||0)/(Number(units?.feetPerCell)||5);
   return it.road.axis==='x'?box(it.x,it.y-gap,w,h+gap*2):box(it.x-gap,it.y,w+gap*2,h);
  }
  return regionTypes.includes(it.type)?box(it.x,it.y,w,h):box(it.x-w/2,it.y-h/2,w,h);
 }
 function outline(prop,units){
  const poly=prop?.polygon;
  if(prop?.source!=='zone'||!Array.isArray(poly)||poly.length!==4||poly.some(p=>!number(p.x)||!number(p.y)))return null;
  const xs=[...new Set(poly.map(p=>p.x))],ys=[...new Set(poly.map(p=>p.y))];
  if(xs.length!==2||ys.length!==2)return null;
  const x=Math.ceil(Math.min(...xs)+1-EPS),y=Math.ceil(Math.min(...ys)+1-EPS);
  const w=Math.floor(Math.max(...xs)-1+EPS)-x,h=Math.floor(Math.max(...ys)-1+EPS)-y;
  if(x<0||y<0||w<=0||h<=0||x+w>units?.columns||y+h>units?.rows)return null;
  return [{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}].every(p=>inside(p,poly))?box(x,y,w,h):null;
 }
 function footprintFor(prop,units,preset,turns=0){
  const available=outline(prop,units);
  if(!available)return null;
  const [mw,mh]=turns%2?[...TARGET[preset]].reverse():TARGET[preset];
  // El terreno puede contener patio; el edificio se adapta al área libre hasta su variante de planta.
  const w=Math.min(available.w,mw),h=Math.min(available.h,mh);
  return box(available.x+Math.floor((available.w-w)/2),available.y+Math.floor((available.h-h)/2),w,h);
 }
 // El rectángulo seleccionado representa el edificio, no una parcela recortada después.
 // Un tile equivale a la medida del proyecto; solo las paredes se ajustan a la rejilla.
 function measureFootprint(a,b,preset,units,turns=0){
  if(!MIN[preset])return failure('unknown_preset');
  if(!a||!b||![a.x,a.y,b.x,b.y].every(number))return failure('invalid_parcel');
  const cols=Number(units?.columns),rows=Number(units?.rows);
  if(!Number.isFinite(cols)||!Number.isFinite(rows)||cols<4||rows<4)return failure('invalid_parcel');
  const ax=Math.round(a.x),ay=Math.round(a.y),bx=Math.round(b.x),by=Math.round(b.y);
  const rect=box(Math.min(ax,bx),Math.min(ay,by),Math.abs(ax-bx),Math.abs(ay-by));
  if(rect.x<1||rect.y<1||rect.x+rect.w>cols-1||rect.y+rect.h>rows-1)
   return failure('invalid_parcel');
  const [mw,mh]=turns%2?[...TARGET[preset]].reverse():TARGET[preset];
  if(rect.w>mw||rect.h>mh)return failure('oversized',{maximum:[mw,mh]});
  const [minW,minH]=turns%2?[...MIN[preset]].reverse():MIN[preset];
  if(rect.w<minW||rect.h<minH)return failure('small_parcel',{minimum:[minW,minH]});
  return {ok:true,rect,maximum:[mw,mh]};
 }
 function limitFootprint(a,b,preset,units){
  if(!TARGET[preset]||!a||!b||![a.x,a.y,b.x,b.y].every(number))return null;
  const cols=Number(units?.columns),rows=Number(units?.rows);
  if(!Number.isFinite(cols)||!Number.isFinite(rows)||cols<4||rows<4)return null;
  const bound=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const start={x:bound(Math.round(a.x),1,cols-1),y:bound(Math.round(a.y),1,rows-1)};
  const [mw,mh]=TARGET[preset],ex=Math.round(b.x),ey=Math.round(b.y);
  const end={x:bound(ex,Math.max(1,start.x-mw),Math.min(cols-1,start.x+mw)),
   y:bound(ey,Math.max(1,start.y-mh),Math.min(rows-1,start.y+mh))};
  const rect=box(Math.min(start.x,end.x),Math.min(start.y,end.y),
   Math.abs(end.x-start.x),Math.abs(end.y-start.y));
  const [minW,minH]=MIN[preset];
  return {a:start,b:end,rect,maximum:[mw,mh],minimum:[minW,minH],
   limited:end.x!==ex||end.y!==ey,valid:rect.w>=minW&&rect.h>=minH};
 }
 function newName(project,preset){
  const base=LABELS[preset]||'Edificio',taken=new Set((project?.properties||[]).map(p=>p.name));
  let n=1;while(taken.has(base+' '+n))n++;
  return base+' '+n;
 }
 function areaProject(project,floorId,a,b,preset,zones,id,turns){
  const checked=measureFootprint(a,b,preset,project?.units,turns);
  if(!checked.ok)return checked;
  const r=checked.rect;
  // La propiedad se extiende una casilla alrededor, solo para preservar el
  // margen arquitectónico. El edificio usa exactamente el rectángulo elegido.
  const topLeft={x:r.x-1,y:r.y-1},bottomRight={x:r.x+r.w+1,y:r.y+r.h+1};
  const created=zones.create(project,floorId,topLeft,bottomRight,
   project.units.columns,project.units.rows,id);
  if(!created.ok)return failure('invalid_parcel',{detail:created.reason});
  created.zone.name=newName(project,preset);
  created.zone.claimable=false;
  return {ok:true,property:created.zone};
 }
 function plan(project,property,preset,options={}){
  if(!MIN[preset])return failure('unknown_preset');
  const base=(project?.floors||[]).find(f=>f.id===property?.floorId);
  if(!base||!Array.isArray(base.items))return failure('no_floor');
  if(property.generatedPrefab||project.floors.some(f=>(f.items||[]).some(it=>it.constructionParcelId===property.id)))
   return failure('generated');
  const turns=options.turns??0;
  if(!Number.isInteger(turns)||turns<0||turns>3)return failure('invalid_parcel');
  const world=footprintFor(property,project.units,preset,turns);
  if(!world)return failure('invalid_parcel');
  const rect=turns%2?box(world.x,world.y,world.h,world.w):world;
  const [minW,minH]=MIN[preset];
  if(rect.w<minW||rect.h<minH)return failure('small_parcel',{minimum:[minW+2,minH+2]});
  const catalog=options.catalog?.furniture||options.catalog;
  if(!Array.isArray(catalog))return failure('missing_catalog');
  const models=new Map(catalog.map(e=>[e.id,e]));
  const count=Number(options.stories??1);
  if(!Number.isInteger(count)||count<1||count>3)return failure('invalid_stories');
  const requestedFloors=[base],createdFloors=[],floorsSorted=[...project.floors].sort((a,b)=>a.elevationFt-b.elevationFt);
  if(!number(base.elevationFt))return failure('levels_conflict');
  if(count>1&&floorsSorted.some((floor,i)=>!number(floor.elevationFt)||
   (i>0&&floor.elevationFt-floorsSorted[i-1].elevationFt<EPS)))return failure('levels_conflict');
  const baseIndex=floorsSorted.indexOf(base);
  for(let level=1;level<count;level++){
   const upper=floorsSorted[baseIndex+level];
   if(upper){requestedFloors.push(upper);continue}
   const elev=requestedFloors[level-1].elevationFt+10;
   const id='floor_'+property.id+'_'+level;
   if(project.floors.some(f=>f.id===id)||createdFloors.some(f=>f.id===id))return failure('levels_conflict');
   const newFloor={id,name:'Piso '+(level+1)+' · '+(LABELS[preset]||'Edificio'),
    elevationFt:elev,ceilingHeightFt:10,lightingManual:true,
    reference:{name:'',data:'',width:1,height:1,opacity:.73},items:[]};
   requestedFloors.push(newFloor);createdFloors.push(newFloor);
  }
  const clearTypes=new Set(['outside','grass','dirt']);
  for(const floor of requestedFloors)for(const it of floor.items){
   if(clearTypes.has(it.type))continue;
   const b=footprint(it,project.units);
   if(b&&overlaps(b,world))return failure('occupied',{itemId:it.id,floorId:floor.id});
  }
  const prefix='fhpf_'+encodeURIComponent(property.id).replace(/%/g,'~');
  const usedIds=new Set(project.floors.flatMap(f=>f.items||[]).map(it=>it.id));
  if([...usedIds].some(id=>String(id).startsWith(prefix+'_')))return failure('generated');
  const all=[],levels=[],units=[];let serial=0;
  const usableFronts=new Map();
  const feet=Number(project.units?.feetPerCell)||5,modelRules=options.modelRules,shared=options.shared;
  const pt=(x,y)=>({x:round(x),y:round(y)});
  const reserve=(floor,kind,attributes,phase='estructura')=>{
   const id=prefix+'_'+String(++serial);if(usedIds.has(id))throw Error('id_collision');
   const it={id,type:kind,constructionParcelId:property.id,constructionPhase:phase,...attributes};
   floor.items.push(it);all.push(it);return it;
  };
  const stroke=(floor,type,x1,y1,x2,y2,attrs={})=>{
   const idx=requestedFloors.findIndex(f=>f.id===floor.id),upper=requestedFloors[idx+1];
   // Un muro termina en la losa inmediata, no 1 ft por debajo de ella.
   const height=upper?upper.elevationFt-floor.elevationFt:
    Number(floor.ceilingHeightFt)||10;
   return reserve(floor,type,
    {a:pt(x1,y1),b:pt(x2,y2),heightFt:['wall','red_wall'].includes(type)?round(height):7,
     widthFt:['door','window'].includes(type)?3:0,open:false,locked:false,peekSide:1,...attrs},
    type==='red_wall'?'estructura':'instalaciones');
  };
  const line=(f,axis,at,start,end,gaps=[],exterior=false)=>{
   const sorted=[...gaps].sort((a,b)=>a.at-b.at);let cursor=start;
   for(const gap of sorted){
    if(gap.at<cursor-EPS||gap.at+1>end+EPS)throw Error('invalid_gap');
    const draw=(a,b,type,extra)=>axis==='h'?stroke(f,type,a,at,b,at,extra):stroke(f,type,at,a,at,b,extra);
    if(gap.at>cursor+EPS)draw(cursor,gap.at,exterior?'red_wall':'wall',{});
    draw(gap.at,gap.at+1,gap.type||'door',gap.attrs||{});
    cursor=gap.at+1;
   }
   if(cursor<end-EPS)(axis==='h'?stroke(f,exterior?'red_wall':'wall',cursor,at,end,at):
    stroke(f,exterior?'red_wall':'wall',at,cursor,at,end));
  };
  const room=(f,name,r,aptId='',kind='',extras={})=>{
   const identifier=prefix+'_r'+(++serial);
   const attrs={x:round(r.x),y:round(r.y),w:round(r.w),h:round(r.h),
    label:name,roomId:identifier,apartmentId:aptId,manualApartmentId:aptId,
    blocksViewOutside:true,surfaceStyle:ROOM_FLOORS[kind]||ROOM_FLOORS.comun,...extras};
   if(['bano','cocina','dormitorio','oficina'].includes(kind))attrs.constructionRoom=kind;
   return reserve(f,'room',attrs,'cimientos');
  };
  const door=(at,role='interior',aptId='')=>({at,type:'door',
   attrs:{doorRole:role,apartmentId:aptId,architectureSkin:'puerta_madera'}});
  const window=(at)=>({at,type:'window',attrs:{roofBoundary:true,windowSkin:'clasica'}});
  function roomBox(it){return box(it.x,it.y,it.w,it.h);}
  function furniture(f,r,modelId,sides=['north','west','east','south'],excludeWindows=false){
   const entry=models.get(modelId);
   if(!entry||!number(entry.widthFt)||!number(entry.depthFt))throw Error('missing_model:'+modelId);
   const width=entry.widthFt/feet,depth=entry.depthFt/feet;
   const site=roomBox(r),obstacles=f.items.filter(it=>it.roomId===r.roomId&&(it.modelId||it.type==='stairs'));
   const doors=f.items.filter(it=>it.type==='door'&&it.a&&it.b);
   const windows=f.items.filter(it=>it.type==='window'&&it.a&&it.b);
   function clear(candidate,front){
    if(!contains(site,{x:candidate.x+.03,y:candidate.y+.03})||
     !contains(site,{x:candidate.x+candidate.w-.03,y:candidate.y+candidate.h-.03}))return false;
    if(!contains(site,{x:front.x+.03,y:front.y+.03})||
     !contains(site,{x:front.x+front.w-.03,y:front.y+front.h-.03}))return false;
    const occupied=obstacles.map(it=>{
     const rotated=(Number(it.rotation)||0)%180!==0,w=rotated?it.h:it.w,h=rotated?it.w:it.h;
     return box(it.x-w/2,it.y-h/2,w,h);
    });
    if(occupied.some(b=>overlaps(b,candidate)||overlaps(b,front)))return false;
    if((usableFronts.get(r.roomId)||[]).some(b=>overlaps(b,candidate)))return false;
    const doorGap=doors.map(it=>box(Math.min(it.a.x,it.b.x)-.8,Math.min(it.a.y,it.b.y)-.8,
     Math.abs(it.a.x-it.b.x)+1.6,Math.abs(it.a.y-it.b.y)+1.6));
    if(doorGap.some(b=>overlaps(b,candidate)||overlaps(b,front)))return false;
    if(excludeWindows&&windows.some(it=>overlaps(
     box(Math.min(it.a.x,it.b.x)-1,Math.min(it.a.y,it.b.y)-1,
      Math.abs(it.a.x-it.b.x)+2,Math.abs(it.a.y-it.b.y)+2),candidate)))return false;
    return true;
   }
   for(const side of sides)for(let shift=.65;shift<=Math.max(.65,(side==='north'||side==='south'?site.w:site.h)-.65);shift+=.35){
    const along=shift,depthY=side==='north'||side==='south',iw=depthY?width:depth,ih=depthY?depth:width;
    let cx,cy,rotation,front;
    if(side==='north'){cx=site.x+along;cy=site.y+ROOM_MARGIN+ih/2;rotation=0;
     front=box(cx-iw/2,cy+ih/2,iw,FRONT);}
    if(side==='south'){cx=site.x+along;cy=site.y+site.h-ROOM_MARGIN-ih/2;rotation=180;
     front=box(cx-iw/2,cy-ih/2-FRONT,iw,FRONT);}
    if(side==='west'){cx=site.x+ROOM_MARGIN+iw/2;cy=site.y+along;rotation=270;
     front=box(cx+iw/2,cy-ih/2,FRONT,ih);}
    if(side==='east'){cx=site.x+site.w-ROOM_MARGIN-iw/2;cy=site.y+along;rotation=90;
     front=box(cx-iw/2-FRONT,cy-ih/2,FRONT,ih);}
    const candidate=box(cx-iw/2,cy-ih/2,iw,ih);
    if(!clear(candidate,front))continue;
    const item=reserve(f,'misc',{x:round(cx),y:round(cy),w:round(width),h:round(depth),
     rotation,label:entry.name||modelId,modelId,heightFt:entry.heightFt,
     blocksMovement:entry.blocksMovement!==false,roomId:r.roomId,apartmentId:r.apartmentId,
     placement:'floor',...(entry.shopRole?{shopRole:entry.shopRole}:{})},'instalaciones');
    if(modelRules?.applyCatalogModel&&shared)modelRules.applyCatalogModel(item,entry,shared,feet);
    // Conserva dimensiones originales: el motor aplica la rotación a la huella GLB.
    if(!usableFronts.has(r.roomId))usableFronts.set(r.roomId,[]);
    usableFronts.get(r.roomId).push(front);
    return item;
   }
   throw Error('no_furniture_space:'+modelId+':'+r.roomId);
  }
  function fixture(f,r,it,type){
   const electric=type==='power_outlet';
   let mount=null;
   if(electric){
    // El GLB eléctrico exige wallId, giro y punto EXACTO en pared estructural.
    // Buscar el tramo real más cercano al mueble, nunca su centro como enchufe.
    const pieces=f.items.filter(o=>['wall','red_wall','property_wall'].includes(o.type)&&o.a&&o.b);
    let distance=Infinity;
    const spans=r.spans?.length?r.spans:[r];
    const touchesRoom=p=>spans.some(sp=>p.x>=sp.x-.02&&p.x<=sp.x+sp.w+.02
     &&p.y>=sp.y-.02&&p.y<=sp.y+sp.h+.02);
    for(const wall of pieces){
     const dx=wall.b.x-wall.a.x,dy=wall.b.y-wall.a.y,den=dx*dx+dy*dy;
     if(den<EPS)continue;
     const t=Math.max(0,Math.min(1,((it.x-wall.a.x)*dx+(it.y-wall.a.y)*dy)/den));
     const point={x:wall.a.x+t*dx,y:wall.a.y+t*dy};
     if(!touchesRoom(point))continue;
     const d=Math.hypot(point.x-it.x,point.y-it.y);
     if(d>=distance)continue;
     const length=Math.sqrt(den),normal={x:-dy/length,y:dx/length};
     if((it.x-point.x)*normal.x+(it.y-point.y)*normal.y<0){normal.x*=-1;normal.y*=-1;}
     const rotation=(-Math.atan2(normal.x,normal.y)*180/Math.PI+360)%360;
     mount={x:round(point.x),y:round(point.y),wallId:wall.id,rotation};
     distance=d;
    }
    if(!mount)throw Error('no_structural_outlet_wall:'+r.roomId);
   }
   reserve(f,type,{x:mount?.x??round(it.x),y:mount?.y??round(it.y),
    w:electric?.25:.3,h:electric?.25:.3,roomId:r.roomId,
    apartmentId:r.apartmentId,rotation:mount?.rotation??(it.rotation||0),
    ...(electric?{wallId:mount.wallId,utilitySkin:'enchufe_doble',
      utilityMountHeightFt:1.5,utilityWidthFt:.75,utilityHeightFt:.75,
      utilityDepthFt:.25,slots:2,capacityRayos:6}:{}),
    blocksMovement:false,networkId:'main',radiusFt:5,zoneId:'main'},'instalaciones');
  }
  function lamp(f,r){
   reserve(f,'light_fixture',{x:round(r.x+r.w/2),y:round(r.y+r.h/2),w:.4,h:.4,
    heightFt:8,lightKind:'bulb',roomId:r.roomId,apartmentId:r.apartmentId,
    requiresPower:true,blocksMovement:false,zoneId:'main'},'instalaciones');
  }
  function furnish(f,r,kind){
   const place=(id,sides,away)=>furniture(f,r,id,sides,away);
   if(kind==='bano'){
    for(const id of ['inodoro_clasico','lavabo_pedestal']){
     const it=place(id,id==='inodoro_clasico'?['west','north','east']:['east','south','north']);
     fixture(f,r,it,'water_outlet');fixture(f,r,it,'drain_outlet');
    }
   }else if(kind==='dormitorio'){
    place('cama_individual',['west','south','north','east'],true);
   }else if(kind==='cocina'){
    for(const id of ['fregadero_mueble','estufa_horno','refrigerador']){
     const it=place(id,['north','west','east','south']);
     if(id==='fregadero_mueble'){fixture(f,r,it,'water_outlet');fixture(f,r,it,'drain_outlet');}
     else fixture(f,r,it,'power_outlet');
    }
   }else if(kind==='oficina'){
    const it=place('escritorio_clasico',['west','north','east']);
    fixture(f,r,it,'power_outlet');
    place('silla_madera',['east','south','north']);
   }else if(kind==='ventas'){
    const it=place('caja_registradora_c02',['west','north','east']);
    fixture(f,r,it,'power_outlet');
    place('gondola_simple_c02',['north','south','west']);
    place('rack_snacks_c02',['south','north','east']);
   }
   lamp(f,r);
  }
  function exterior(f,rect,entrySide,at,windows=[]){
   const X=rect.x,Y=rect.y,R=X+rect.w,B=Y+rect.h;
   const top=windows.filter(w=>w.axis==='top').map(w=>window(w.at));
   const bottom=windows.filter(w=>w.axis==='bottom').map(w=>window(w.at));
   const left=entrySide==='left'?[{at,type:'door',attrs:{doorRole:'entrance',roofBoundary:true,architectureSkin:'puerta_madera'}}]:[];
   const down=entrySide==='bottom'?[{at,type:'door',attrs:{doorRole:'entrance',roofBoundary:true,architectureSkin:'puerta_madera'}}]:[];
   line(f,'h',Y,X,R,top,true);line(f,'h',B,X,R,[...bottom,...down],true);
   line(f,'v',X,Y,B,left,true);line(f,'v',R,Y,B,[],true);
  }
  const boxesByLevel=[];
  function apartments(f,level){
   const X=rect.x,Y=rect.y,R=X+rect.w,B=Y+rect.h,hall=4;
   const hallY=Y+Math.floor((rect.h-hall)/2);
   if(hallY-Y<9)return failure('small_parcel');
   const columns=Math.min(5,Math.floor(rect.w/8));
   if(columns<2)return failure('small_parcel');
   // Compartir los límites entre vecinos evita huecos al repartir casillas sobrantes.
   const edges=Array.from({length:columns+1},(_,c)=>X+Math.floor(c*rect.w/columns));
   const windows=[];
   for(let side=0;side<2;side++)for(let c=0;c<columns;c++){
    windows.push({axis:side===0?'top':'bottom',at:edges[c+1]-2});
   }
   exterior(f,rect,level===0?'left':null,hallY+1,windows);
   const waiting=[];
   const hallRoom=room(f,'Pasillo común · piso '+(level+1),
    box(X,hallY,rect.w,hall),'','comun',{commonArea:true,blocksViewOutside:false});
   // 1×2 tiles dentro del corredor: cada planta tiene llegada y, si procede, subida.
   // Alternar bandas transversales impide que dos tramos se solapen en pisos intermedios.
   const stairPoint={x:R-2,y:hallY+(level%2===0?1:3)};
   for(let side=0;side<2;side++){
    const top=side===0,unitY=top?Y:hallY+hall;
    const depth=top?hallY-Y:B-unitY;
    const outerY=top?Y:B,insideY=top?hallY:unitY;
    const corridorDoors=[];
    for(let c=0;c<columns;c++){
     const x=edges[c],w=edges[c+1]-x,unitNumber=level*columns*2+side*columns+c+1;
     const aptId=prefix+'_vivienda_'+(level+1)+'_'+(side*columns+c+1),name='Depto. '+unitNumber;
     const bathW=3,bathH=3,bedH=4;
     const bath=box(x,top?outerY:outerY-bathH,bathW,bathH);
     const bed=box(x+bathW,top?outerY:outerY-bedH,w-bathW,bedH);
     const livingY=top?outerY+bedH:unitY,livH=depth-bedH;
     if(livH<4.7||bed.w<4.5)return failure('small_parcel');
     const live=box(x,livingY,w,livH);
     const bathSpace=room(f,'Baño',bath,aptId,'bano',
      {privateRoom:true,requiresClosedDoor:true});
     const bedSpace=room(f,'Recámara',bed,aptId,'dormitorio',{privateRoom:true});
     const living=room(f,'Sala y cocina',live,aptId,'cocina',{
      spans:[box(x,top?outerY+bathH:outerY-bedH,bathW,bedH-bathH),live],
      kitchenLivingCombined:true});
     // Pared entre baño y recámara; ambas puertas abren al espacio de sala-cocina.
     line(f,'v',x+bathW,outerY-bedH*(top?0:1),outerY+bedH*(top?1:0),[],false);
     const bathCut=top?outerY+bathH:outerY-bathH;
     const bedroomCut=top?outerY+bedH:outerY-bedH;
     line(f,'h',bathCut,x,x+bathW,[door(x+Math.floor(bathW/2),'interior',aptId)],false);
     line(f,'h',bedroomCut,x+bathW,x+w,
      [door(Math.floor(x+bathW+(w-bathW)/2),'interior',aptId)],false);
     corridorDoors.push(door(Math.floor(x+w/2),'entrance',aptId));
     // Medianeras entre viviendas: sin puertas entre vecinos.
     if(c>0)line(f,'v',x,unitY,unitY+depth,[],false);
     waiting.push([bathSpace,'bano'],[bedSpace,'dormitorio'],[living,'cocina']);
     units.push({id:aptId,name:'Departamento '+unitNumber,floorId:f.id,
      polygon:[pt(x,unitY),pt(x+w,unitY),pt(x+w,unitY+depth),pt(x,unitY+depth)],
      roomIds:[bathSpace.roomId,bedSpace.roomId,living.roomId],
      doorIds:[],private:true});
    }
    line(f,'h',insideY,X,R,corridorDoors,false);
   }
   // Las puertas del corredor ya existen: el mobiliario respeta sus radios de acceso.
   for(const [livingRoom,kind] of waiting)furnish(f,livingRoom,kind);
   // El hueco de escalera pertenece a zona común y no atraviesa ningún departamento.
   if(level<count-1)reserve(f,'stairs',{x:stairPoint.x,y:stairPoint.y,w:1,h:2,
    rotation:90,heightFt:requestedFloors[level+1].elevationFt-f.elevationFt,
    blocksMovement:false,stairDirection:'up',
    targetFloorId:requestedFloors[level+1].id,roomId:hallRoom.roomId,
    label:'Escalera al piso '+(level+2)},'estructura');
   lamp(f,hallRoom);
   return {ok:true,apartments:columns*2};
  }
  function simple(f,level){
   const X=rect.x,Y=rect.y,R=X+rect.w,B=Y+rect.h;
   exterior(f,rect,level===0?'bottom':null,Math.floor(X+rect.w/2),
    [{axis:'top',at:Math.floor(X+rect.w*.55)}]);
   const bathW=3,bathH=3,bedW=Math.max(5,Math.min(7,Math.round(rect.w*.4))),bedH=5;
   const bathRect=box(X,Y,bathW,bathH);
   const sleepRect=box(R-bedW,Y,bedW,bedH);
   const centerY=Y+Math.max(bathH,bedH);
   const social=box(X,centerY,rect.w,B-centerY);
   if(social.h<4.5)return failure('small_parcel');
   const bath=room(f,'Baño',bathRect,'','bano',{privateRoom:true,requiresClosedDoor:true});
   line(f,'h',Y+bathH,X,X+bathW,[door(Math.floor(X+bathW/2))],false);
   line(f,'v',X+bathW,Y,Y+bathH,[],false);
   const secondKind=preset==='ayuntamiento'?'oficina':preset==='tienda'?'almacen':'dormitorio';
   const bedroom=room(f,secondKind==='oficina'?'Oficina':secondKind==='almacen'?'Almacén':'Recámara',sleepRect,'',
    secondKind,secondKind==='almacen'?{}:{privateRoom:true});
   line(f,'h',Y+bedH,R-bedW,R,[door(Math.floor(R-bedW+bedW/2))],false);
   line(f,'v',R-bedW,Y,Y+bedH,[],false);
   const upperHouse=preset==='casas'&&level>0;
   const mainKind=preset==='tienda'?'ventas':preset==='ayuntamiento'?'oficina':upperHouse?'dormitorio':'cocina';
   const main=room(f,preset==='tienda'?'Área de ventas':preset==='ayuntamiento'?'Vestíbulo y oficinas':upperHouse?'Recámara superior':'Sala y cocina',
    social,'',mainKind,upperHouse?{privateRoom:true}:{});
   if(level<count-1)reserve(f,'stairs',{x:R-(level%2===0?1.5:3.5),y:B-2,
    w:1,h:2,rotation:0,heightFt:requestedFloors[level+1].elevationFt-f.elevationFt,
    blocksMovement:false,
    stairDirection:'up',targetFloorId:requestedFloors[level+1].id,
    roomId:main.roomId,label:'Escalera al piso '+(level+2)},'estructura');
   furnish(f,bath,'bano');
   if(secondKind!=='almacen')furnish(f,bedroom,secondKind);
   furnish(f,main,mainKind);
   return {ok:true,apartments:0};
  }
  try{
   for(let level=0;level<count;level++){
    // Trabajar sobre una copia de cada piso para asegurar transacción total ante un fallo.
    const original=requestedFloors[level];
    const f={...original,items:turns?[]:[...original.items]};levels.push(f);
    const result=preset==='apartamentos'?apartments(f,level):simple(f,level);
    if(!result.ok)return result;
    if(turns)f.items=original.items.concat(f.items);
    boxesByLevel.push(result.apartments);
   }
  }catch(error){
   const code=String(error.message||'').startsWith('missing_model:')?'missing_model':
    String(error.message||'').startsWith('no_furniture_space:')?'furniture_no_space':
    String(error.message||'').startsWith('no_structural_outlet_wall:')?'outlet_no_wall':'invalid_catalog';
   return failure(code,{detail:String(error.message||error)});
  }
  if(turns){
   const rotate=p=>{
    const x=p.x-rect.x,y=p.y-rect.y;
    if(turns===1)return pt(rect.x+rect.h-y,rect.y+x);
    if(turns===2)return pt(rect.x+rect.w-x,rect.y+rect.h-y);
    return pt(rect.x+y,rect.y+rect.w-x);
   };
   const rotateBox=b=>{
    const a=rotate(b),end=rotate({x:b.x+b.w,y:b.y+b.h});
    return box(Math.min(a.x,end.x),Math.min(a.y,end.y),round(Math.abs(end.x-a.x)),round(Math.abs(end.y-a.y)));
   };
   for(const item of all){
    if(item.a&&item.b){item.a=rotate(item.a);item.b=rotate(item.b);}
    else if(item.type==='room'){
     Object.assign(item,rotateBox(item));
     if(item.spans)item.spans=item.spans.map(rotateBox);
    }else{
     Object.assign(item,rotate(item));
     item.rotation=((item.rotation||0)+turns*90)%360;
    }
   }
   for(const unit of units)unit.polygon=unit.polygon.map(rotate);
  }
  const parcels=units.map(u=>({id:u.id,name:u.name,floorId:u.floorId,
   source:'zone',propertyRole:'apartment',buildingParcelId:property.id,
   claimable:true,ownerId:'',polygon:u.polygon}));
  const existing=new Set((project.properties||[]).map(p=>p.id));
  if(parcels.some(p=>existing.has(p.id)))return failure('generated');
  return {ok:true,preset,parcelId:property.id,rect:world,levels,createdFloors,
   items:all,rooms:all.filter(it=>it.type==='room').length,
   apartments:boxesByLevel.reduce((a,b)=>a+b,0),stories:count,units,parcels};
 }
 function place(project,property,preset,options={}){
  const draft=plan(project,property,preset,options);
  if(!draft.ok)return draft;
  return apply(project,property,preset,draft);
 }
 function apply(project,property,preset,draft){
  for(const level of draft.levels){
   const existing=project.floors.find(f=>f.id===level.id);
   if(existing)existing.items=level.items;
   else project.floors.push(level);
  }
  project.floors.sort((a,b)=>a.elevationFt-b.elevationFt);
  if(draft.parcels.length){
   project.properties??=[];
   property.propertyRole='building';property.claimable=false;
   project.properties.push(...draft.parcels);
  }
  property.generatedPrefab={version:3,preset,itemIds:draft.items.map(it=>it.id),
   floorIds:draft.levels.map(f=>f.id),apartments:draft.units};
  return {ok:true,rooms:draft.rooms,items:draft.items.length,
   apartments:draft.apartments,stories:draft.stories,rect:draft.rect,
   floorIds:draft.levels.map(f=>f.id)};
 }
 function prepareArea(project,floorId,a,b,preset,options={}){
  const zones=options.zones;
  if(!zones?.create)return failure('no_zones');
  const id=options.id||'parcel_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
  const proposed=areaProject(project,floorId,a,b,preset,zones,id,options.turns);
  if(!proposed.ok)return proposed;
  const property=proposed.property;
  const draft=plan(project,property,preset,options);
  if(!draft.ok)return draft;
  return {ok:true,property,draft};
 }
 function placeArea(project,floorId,a,b,preset,options={}){
  const prepared=prepareArea(project,floorId,a,b,preset,options);
  if(!prepared.ok)return prepared;
  const {property,draft}=prepared;
  project.properties??=[];
  project.properties.push(property);
  return {...apply(project,property,preset,draft),property};
 }
 return Object.freeze({MIN,TARGET,outline,footprintFor,measureFootprint,limitFootprint,newName,plan,place,prepareArea,placeArea});
});
