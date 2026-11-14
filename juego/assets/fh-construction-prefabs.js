/* Construcción 04: generador nativo, sin sustituir editor, física ni catálogo. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHConstructionPrefabs=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const EPS=1e-5;
 const MIN=Object.freeze({ayuntamiento:[11,10],casas:[12,10],apartamentos:[24,10],tienda:[12,10]});
 const KINDS=Object.freeze({ayuntamiento:['oficina','bano'],casas:['cocina','dormitorio','bano'],
  apartamentos:['bano','dormitorio','cocina','bano','dormitorio','cocina'],tienda:['bano','ventas']});
 const MIN_ROOM=Object.freeze({oficina:5,bano:4,cocina:4,dormitorio:4,ventas:8,descanso:4});
 const floorSurface={preset:'concreto',color:'#989A96'};
 const floors={bano:{preset:'azulejo',color:'#8FADAC'},cocina:{preset:'baldosa',color:'#B7AEA0'},
  dormitorio:{preset:'madera',color:'#9C806A'},oficina:{preset:'baldosa',color:'#AAA8A0'},
  descanso:{preset:'madera',color:'#9C806A'},ventas:{preset:'baldosa',color:'#AAA8A0'}};
 const isNum=n=>typeof n==='number'&&Number.isFinite(n);
 const round=n=>Math.round(n*1000)/1000;
 const fail=(code,details={})=>({ok:false,code,...details});
 const inside=(p,poly)=>{
  if(!poly?.length)return false;
  let yes=false;
  for(let j=poly.length-1,i=0;i<poly.length;j=i++){
   const a=poly[i],b=poly[j];
   const cross=(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
   if(Math.abs(cross)<EPS&&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS
    &&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS)return true;
   if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;
  }
  return yes;
 };
 const overlap=(a,b)=>a.x<b.x+b.w-EPS&&a.x+a.w>b.x+EPS&&a.y<b.y+b.h-EPS&&a.y+a.h>b.y+EPS;
 function footprint(item,units){
  if(item?.a&&item?.b){
   const x=Math.min(item.a.x,item.b.x),y=Math.min(item.a.y,item.b.y);
   return {x:x-.05,y:y-.05,w:Math.abs(item.a.x-item.b.x)+.1,h:Math.abs(item.a.y-item.b.y)+.1};
  }
  if(!isNum(item?.x)||!isNum(item?.y))return null;
  const w=Math.max(0,Number(item.w)||0),h=Math.max(0,Number(item.h)||0);
  if(item.type==='asphalt'&&item.road){
   const side=Math.max(0,Number(item.road.sidewalkFt)||0)/(Number(units?.feetPerCell)||5);
   return item.road.axis==='x'?{x:item.x,y:item.y-side,w,h:h+side*2}:
    {x:item.x-side,y:item.y,w:w+side*2,h};
  }
  if(item.type==='room'||['hall','building','outside','grass','dirt','pavement','parking','concrete','asphalt','alley','sidewalk'].includes(item.type))
   return {x:item.x,y:item.y,w,h};
  return {x:item.x-w/2,y:item.y-h/2,w,h};
 }
 function outline(property,units){
  const poly=property?.polygon;
  if(property?.source!=='zone'||!Array.isArray(poly)||poly.length!==4||
   poly.some(p=>!isNum(p.x)||!isNum(p.y)))return null;
  const xs=[...new Set(poly.map(p=>p.x))],ys=[...new Set(poly.map(p=>p.y))];
  if(xs.length!==2||ys.length!==2)return null;
  const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
  const region={x:Math.ceil(left+1-EPS),y:Math.ceil(top+1-EPS),
   w:Math.floor(right-1+EPS)-Math.ceil(left+1-EPS),
   h:Math.floor(bottom-1+EPS)-Math.ceil(top+1-EPS)};
  if(region.x<0||region.y<0||region.w<=0||region.h<=0||
   region.x+region.w>units?.columns||region.y+region.h>units?.rows)return null;
  const corners=[{x:region.x,y:region.y},{x:region.x+region.w,y:region.y},
   {x:region.x+region.w,y:region.y+region.h},{x:region.x,y:region.y+region.h}];
  return corners.every(p=>inside(p,poly))?region:null;
 }
 function plan(project,property,preset,options={}){
  if(!MIN[preset])return fail('unknown_preset');
  const floor=(project?.floors||[]).find(f=>String(f.id)===String(property?.floorId));
  if(!floor||!Array.isArray(floor.items))return fail('no_floor');
  if(property?.generatedPrefab||floor.items.some(it=>it.constructionParcelId===property.id))return fail('generated');
  const rect=outline(property,project.units);
  if(!rect)return fail('invalid_parcel');
  const [needW,needH]=MIN[preset];
  if(rect.w<needW||rect.h<needH)return fail('small_parcel',{minimum:[needW+2,needH+2]});
  const clearTypes=new Set(['outside','grass','dirt']);
  for(const it of floor.items){
   const box=footprint(it,project.units);
   if(!box||!overlap(box,rect))continue;
   if(!clearTypes.has(it.type))return fail('occupied',{itemId:it.id});
  }
  const list=KINDS[preset];
  const base=list.map(k=>MIN_ROOM[k]),available=rect.w-base.reduce((a,b)=>a+b,0);
  if(available<0)return fail('small_parcel',{minimum:[needW+2,needH+2]});
  const widths=base.map((n,i)=>n+Math.floor(available/base.length)+(i<available%base.length?1:0));
  const prefix='fhpf_'+encodeURIComponent(property.id).replace(/%/g,'~');
  const existingIds=new Set((project.floors||[]).flatMap(f=>f.items||[]).map(it=>it.id));
  const items=[];let serial=0;
  const add=(kind,attrs,phase='estructura')=>{
   const id=prefix+'_'+String(++serial);
   if(existingIds.has(id))throw Error('prefab_id_conflict');
   const item={id,type:kind,constructionParcelId:property.id,constructionPhase:phase,...attrs};
   items.push(item);return item;
  };
  const pt=(x,y)=>({x:round(x),y:round(y)});
  const seg=(type,ax,ay,bx,by,extra={})=>add(type,
   {a:pt(ax,ay),b:pt(bx,by),heightFt:type==='red_wall'||type==='wall'?9:7,
    widthFt:['door','window'].includes(type)?3:0,
    open:false,locked:false,peekSide:1,doorRole:type==='door'?'interior':undefined,...extra},
   type==='red_wall'?'estructura':'instalaciones');
  const horizontal=(y,x1,x2,gaps,outer)=>{
   const sorted=[...gaps].sort((a,b)=>a.x-b.x);
   let cursor=x1;
   for(const g of sorted){
    if(g.x>cursor+EPS)seg(outer?'red_wall':'wall',cursor,y,g.x,y);
    seg(g.type,g.x,y,g.x+1,y,g.extra||{});
    cursor=g.x+1;
   }
   if(cursor<x2-EPS)seg(outer?'red_wall':'wall',cursor,y,x2,y);
  };
  const vertical=(x,y1,y2,gap,extra={})=>{
   if(!gap){seg('wall',x,y1,x,y2);return;}
   if(gap>y1+EPS)seg('wall',x,y1,x,gap);
   seg('door',x,gap,x,gap+1,extra);
   if(gap+1<y2-EPS)seg('wall',x,gap+1,x,y2);
  };
  const X=rect.x,Y=rect.y,R=X+rect.w,B=Y+rect.h,divideY=B-3,rooms=[];
  let cursor=X;
  for(let i=0;i<list.length;i++){
   const kind=list[i],w=widths[i],apt=preset==='apartamentos'?(i<3?1:2):0;
   const aptId=apt?prefix+'_vivienda_'+apt:'';
   const roomId=prefix+'_habitacion_'+(i+1);
   const room={x:cursor,y:Y,w,h:divideY-Y,kind,aptId,roomId,index:i};
   rooms.push(room);
   add('room',{x:cursor,y:Y,w,h:divideY-Y,label:
     (kind==='bano'?'Baño':kind==='cocina'?'Cocina':kind==='dormitorio'?'Dormitorio':
      kind==='oficina'?'Oficina':'Área de ventas')+(apt?' '+apt:''),
    roomId,apartmentId:aptId,manualApartmentId:aptId,blocksViewOutside:true,
    surfaceStyle:floors[kind],...(kind==='ventas'?{}:{constructionRoom:kind})},'cimientos');
   cursor+=w;
  }
  add('room',{x:X,y:divideY,w:rect.w,h:3,label:preset==='apartamentos'?'Pasillo común':'Vestíbulo',
   roomId:prefix+'_vestibulo',blocksViewOutside:false,surfaceStyle:floorSurface},'cimientos');
  const front=Math.floor(X+rect.w/2);
  horizontal(B,X,R,[{x:front,type:'door',extra:{doorRole:'entrance',roofBoundary:true,architectureSkin:'puerta_madera'}}],true);
  const windows=rooms.map(r=>({x:Math.floor(r.x+r.w/2),type:'window',extra:{roofBoundary:true,windowSkin:'clasica'}}));
  horizontal(Y,X,R,windows,true);
  seg('red_wall',X,Y,X,B);seg('red_wall',R,Y,R,B);
  for(let i=0;i<rooms.length-1;i++){
   const r=rooms[i],boundary=r.x+r.w;
   const aptPortal=preset==='apartamentos'&&i!==2;
   vertical(boundary,Y,divideY,aptPortal?Math.floor(Y+(divideY-Y)/2):null,
    {doorRole:'interior',apartmentId:r.aptId});
  }
  const hallDoors=[];
  for(const r of rooms){
   if(preset==='apartamentos'&&![2,5].includes(r.index))continue;
   hallDoors.push({x:Math.floor(r.x+r.w/2),type:'door',extra:{
    doorRole:preset==='apartamentos'?'entrance':'interior',apartmentId:r.aptId,
    architectureSkin:'puerta_madera'}});
  }
  horizontal(divideY,X,R,hallDoors,false);
  const modelRules=options.modelRules,shared=options.shared;
  const catalog=options.catalog?.furniture||options.catalog;
  if(!Array.isArray(catalog))return fail('missing_catalog');
  const modelIndex=new Map(catalog.map(m=>[m.id,m]));
  function model(room,id,dx,dy){
   const entry=modelIndex.get(id);
   if(!entry)throw Error('missing_model:'+id);
   const sizeFt=Number(project.units?.feetPerCell)||5;
   const item=add('misc',{x:round(room.x+dx),y:round(room.y+dy),
    w:round(entry.widthFt/sizeFt),h:round(entry.depthFt/sizeFt),heightFt:entry.heightFt,
    modelId:id,label:entry.name,blocksMovement:entry.blocksMovement!==false,rotation:0,
    roomId:room.roomId,apartmentId:room.aptId||'',placement:'floor',
    ...(entry.shopRole?{shopRole:entry.shopRole}:{})},'instalaciones');
   if(typeof modelRules?.applyCatalogModel==='function'&&shared){
    modelRules.applyCatalogModel(item,entry,shared,sizeFt);
   }else{
    item.type=({cama_individual:'bed',silla_madera:'chair',mesa_pequena:'table'}[id]||'misc');
   }
   return item;
  }
  function point(type,r,m,xOffset=0,yOffset=0){
   return add(type,{x:round(m.x+xOffset),y:round(m.y+yOffset),
    w:type==='power_outlet'?.25:.3,h:type==='power_outlet'?.25:.3,
    rotation:0,heightFt:type==='power_outlet'?2.5:1,
    roomId:r.roomId,apartmentId:r.aptId||'',blocksMovement:false,networkId:'main',
    radiusFt:5,zoneId:'main'},'instalaciones');
  }
  try{
   for(const room of rooms){
    const r=room;
    if(r.kind==='bano'){
     for(const m of [model(r,'inodoro_clasico',1.1,1.5),model(r,'lavabo_pedestal',r.w-1.2,2.65)]){
      point('water_outlet',r,m,.3,.25);point('drain_outlet',r,m,-.25,.3);
     }
    }else if(r.kind==='cocina'){
     const sink=model(r,'fregadero_mueble',1.1,1.4);
     point('water_outlet',r,sink,.3,.25);point('drain_outlet',r,sink,-.25,.25);
     for(const m of [model(r,'estufa_horno',r.w-1.2,2.8),model(r,'refrigerador',1.1,4.5)]){
      point('power_outlet',r,m,.35,-.35);
     }
    }else if(r.kind==='dormitorio'){model(r,'cama_individual',1.3,2.1);model(r,'mesa_pequena',r.w-1.1,1.4);
    }else if(r.kind==='oficina'){
     const desk=model(r,'escritorio_clasico',1.35,2.1);
     model(r,'silla_madera',r.w-1.1,3.4);point('power_outlet',r,desk,.35,-.45);
    }else if(r.kind==='ventas'){
     const cash=model(r,'caja_registradora_c02',1.2,1.5);
     model(r,'gondola_simple_c02',1.5,3.25);
     model(r,'rack_snacks_c02',r.w-1.5,4.6);
     point('power_outlet',r,cash,.35,-.35);
    }
    add('light_fixture',{x:round(r.x+r.w/2),y:round(r.y+1),w:.4,h:.4,rotation:0,
     heightFt:8,roomId:r.roomId,apartmentId:r.aptId||'',zoneId:'main',
     lightKind:'bulb',blocksMovement:false,requiresPower:true},'instalaciones');
   }
   add('light_fixture',{x:round(X+rect.w/2),y:round(divideY+1.5),w:.4,h:.4,rotation:0,
    heightFt:8,roomId:prefix+'_vestibulo',zoneId:'main',lightKind:'bulb',
    blocksMovement:false,requiresPower:true},'instalaciones');
  }catch(error){
   return fail(error.message.startsWith('missing_model:')?'missing_model':'invalid_catalog',{detail:error.message});
  }
  return {ok:true,preset,parcelId:property.id,items,rooms:rooms.length,apartments:preset==='apartamentos'?2:0,rect};
 }
 function place(project,property,preset,options={}){
  const draft=plan(project,property,preset,options);
  if(!draft.ok)return draft;
  const floor=project.floors.find(f=>String(f.id)===String(property.floorId));
  floor.items.push(...draft.items);
  property.generatedPrefab={version:1,preset,itemIds:draft.items.map(it=>it.id)};
  return {ok:true,rooms:draft.rooms,items:draft.items.length,apartments:draft.apartments,rect:draft.rect};
 }
 return Object.freeze({MIN,outline,plan,place});
});