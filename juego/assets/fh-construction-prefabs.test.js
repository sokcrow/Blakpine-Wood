'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Prefabs=require('./fh-construction-prefabs.js');
const Geometry=require('./fh-style-property.js');
const Rooms=require('./fh-construction-rooms.js');
const Zones=require('./fh-property-zones.js');
const Construction=require('./fh-construction.js');
const catalog=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../forest-horror/biblioteca/catalogo_muebles.json'),'utf8'));
function map(width=55,height=37){
 const floor={id:'f1',name:'PB',elevationFt:0,ceilingHeightFt:11.5,items:[]};
 return {schema:'forest-horror-map-v1',version:1,mainFloorId:'f1',
  units:{columns:120,rows:120,feetPerCell:5},floors:[floor],properties:[]};
}
function property(m,width=55,height=37,id='parcel1'){
 const p={id,source:'zone',floorId:'f1',claimable:false,ownerId:'',
  polygon:Zones.polygon({x:0,y:0,w:width,h:height})};
 m.properties.push(p);return p;
}
function make(preset,stories=1,width=55,height=37){
 const m=map(width,height),p=property(m,width,height);
 const result=Prefabs.place(m,p,preset,{catalog,stories});
 return {m,p,result};
}
const rotatedBox=it=>{
 const turn=(Number(it.rotation)||0)%180!==0,w=turn?it.h:it.w,h=turn?it.w:it.h;
 return {x:it.x-w/2,y:it.y-h/2,w,h};
};
const overlap=(a,b)=>a.x<b.x+b.w-.0001&&a.x+a.w>b.x+.0001&&a.y<b.y+b.h-.0001&&a.y+a.h>b.y+.0001;
for(const preset of ['ayuntamiento','casas','apartamentos','tienda']){
 test(preset+': arquitectura real editables y auditoría de servicios honesta',()=>{
  const {m,p,result}=make(preset);
  assert.equal(result.ok,true);
  assert.equal(m.schema,'forest-horror-map-v1');
  assert.equal(Geometry.buildings(m,'f1').length,1);
  assert.ok(m.floors[0].items.some(it=>it.type==='red_wall'));
  assert.ok(m.floors[0].items.some(it=>it.type==='wall'));
  assert.ok(m.floors[0].items.some(it=>it.type==='window'&&it.roofBoundary));
  assert.ok(m.floors[0].items.some(it=>it.type==='door'&&it.roofBoundary&&it.doorRole==='entrance'));
  assert.ok(m.floors[0].items.every(it=>it.constructionParcelId===p.id));
  assert.ok(!m.floors[0].items.some(it=>['water_main','drain_main','generator'].includes(it.type)));
  const audit=Rooms.inspectParcel(m,p,{geometry:Geometry});
  assert.equal(audit.status,'unverified');
  assert.ok(!audit.issues.some(issue=>['falta_habitacion','falta_mueble',
   'faltan_exhibidores','falta_registradora'].includes(issue.code)),JSON.stringify(audit.issues));
  assert.equal(p.generatedPrefab.itemIds.length,result.items);
  const before=JSON.stringify(m);
  assert.equal(Prefabs.place(m,p,preset,{catalog}).code,'generated');
  assert.equal(JSON.stringify(m),before);
 });
}
test('apartamentos: varias viviendas por planta, cada una con baño, recámara y cocina-sala',()=>{
 const {m,p,result}=make('apartamentos',2,35,26);
 assert.equal(result.ok,true);
 assert.ok(result.apartments>=8);
 assert.equal(p.generatedPrefab.apartments.length,result.apartments);
 assert.equal(m.floors.length,2);
 const seen=new Set();
 for(const unit of p.generatedPrefab.apartments){
  assert.ok(!seen.has(unit.id));seen.add(unit.id);
  const floor=m.floors.find(f=>f.id===unit.floorId);
  const bedrooms=floor.items.filter(it=>it.type==='room'&&it.apartmentId===unit.id);
  assert.equal(bedrooms.length,3);
  assert.deepEqual(bedrooms.map(r=>r.constructionRoom).sort(),['bano','cocina','dormitorio']);
  const entrance=floor.items.filter(d=>d.type==='door'&&d.doorRole==='entrance'&&d.apartmentId===unit.id);
  assert.equal(entrance.length,1);
  assert.equal(entrance[0].open,false);
  assert.equal(floor.items.filter(d=>d.type==='door'&&d.doorRole==='interior'&&d.apartmentId===unit.id).length,2);
  const bath=bedrooms.find(r=>r.constructionRoom==='bano');
  assert.ok(bath.w<=3&&bath.h<=3);
  assert.equal(bath.privateRoom,true);
  assert.equal(bath.requiresClosedDoor,true);
  const bedroom=bedrooms.find(r=>r.constructionRoom==='dormitorio');
  assert.equal(bedroom.privateRoom,true);
  assert.ok(bedroom.w>=4.5);
  const living=bedrooms.find(r=>r.constructionRoom==='cocina');
  assert.ok(living.kitchenLivingCombined);
  assert.ok(living.spans.length===2);
 }
 for(const f of m.floors){
  assert.equal(Geometry.buildings(m,f.id).length,1);
  assert.equal(f.items.filter(it=>it.type==='room'&&it.commonArea===true).length,1);
 }
 assert.ok(m.floors[0].items.some(it=>it.type==='stairs'&&it.targetFloorId===m.floors[1].id));
 assert.ok(!m.floors[1].items.some(it=>it.type==='door'&&it.roofBoundary));
});
test('paredes y mobiliario: GLB rotados pegados a una pared y con frente interior',()=>{
 const {m,result}=make('apartamentos',1,30,26);
 assert.equal(result.ok,true);
 const f=m.floors[0];
 for(const item of f.items.filter(it=>it.modelId)){
  const r=f.items.find(room=>room.type==='room'&&room.roomId===item.roomId);
  assert.ok(r,'Mueble sin habitación: '+item.id);
  const b=rotatedBox(item);
  const near=Math.min(b.x-r.x,r.x+r.w-b.x-b.w,b.y-r.y,r.y+r.h-b.y-b.h);
  assert.ok(near<=.15&&near>=-.001,'Mueble no anclado a pared: '+item.modelId+' '+near);
  const angle=item.rotation||0,d=Number(item.h)/2+.20;
  const dir=angle===0?[0,1]:angle===90?[-1,0]:angle===180?[0,-1]:[1,0];
  const x=item.x+dir[0]*d,y=item.y+dir[1]*d;
  assert.ok(x>=r.x-.01&&x<=r.x+r.w+.01&&y>=r.y-.01&&y<=r.y+r.h+.01,
   'Frente contra pared: '+item.modelId);
  const others=f.items.filter(x=>x!==item&&x.roomId===item.roomId&&x.modelId);
  assert.ok(!others.some(x=>overlap(b,rotatedBox(x))),'Colisión entre muebles: '+item.modelId);
 }
});
test('varios pisos de casa: escaleras enlazadas y recámaras superiores',()=>{
 const {m,result}=make('casas',2,24,21);
 assert.equal(result.ok,true);
 assert.equal(m.floors.length,2);
 assert.ok(m.floors[0].items.some(it=>it.type==='stairs'&&it.targetFloorId===m.floors[1].id));
 assert.ok(m.floors[1].items.some(it=>it.constructionRoom==='dormitorio'));
 assert.ok(!m.floors[1].items.some(it=>it.type==='door'&&it.roofBoundary));
});
test('dibujar preset crea parcela automáticamente y nombre consecutivo',()=>{
 const m=map(80,80);
 let r=Prefabs.placeArea(m,'f1',{x:1,y:1},{x:30,y:30},'apartamentos',
  {zones:Zones,catalog,stories:1,id:'zone1'});
 assert.equal(r.ok,true);assert.equal(r.property.name,'Apartamentos 1');
 assert.equal(m.properties.length,1);
 r=Prefabs.placeArea(m,'f1',{x:39,y:1},{x:70,y:30},'apartamentos',
  {zones:Zones,catalog,stories:1,id:'zone2'});
 assert.equal(r.ok,true);assert.equal(r.property.name,'Apartamentos 2');
 assert.equal(m.properties.length,2);
 assert.ok(r.property.generatedPrefab.apartments.length>=4);
});
test('no sobreponer edificios a calles ni sobrescribir propiedades existentes',()=>{
 const m=map(),p=property(m);
 m.floors[0].items.push({id:'road',type:'asphalt',x:5,y:7,w:30,h:10,
  road:{axis:'x',sidewalkFt:5}});
 const before=JSON.stringify(m),r=Prefabs.place(m,p,'apartamentos',{catalog});
 assert.equal(r.code,'occupied');
 assert.equal(JSON.stringify(m),before);
 const tried=Prefabs.placeArea(m,'f1',{x:0,y:0},{x:30,y:30},'casas',
  {catalog,zones:Zones,id:'z'});
 assert.equal(tried.ok,false);
 assert.equal(JSON.stringify(m),before);
});
test('rechazos no generan medias construcciones ni nuevos pisos',()=>{
 for(const config of [
  {preset:'casas',width:10,height:10,code:'small_parcel'},
  {preset:'apartamentos',width:23,height:24,code:'small_parcel'},
  {preset:'apartamentos',width:55,height:37,stories:4,code:'invalid_stories'}
 ]){
  const m=map(config.width,config.height),p=property(m,config.width,config.height),old=JSON.stringify(m);
  assert.equal(Prefabs.place(m,p,config.preset,{catalog,stories:config.stories||1}).code,config.code);
  assert.equal(JSON.stringify(m),old);
 }
 const m=map(),p=property(m),old=JSON.stringify(m);
 const broken={furniture:catalog.furniture.filter(it=>it.id!=='inodoro_clasico')};
 assert.equal(Prefabs.place(m,p,'apartamentos',{catalog:broken}).code,'missing_model');
 assert.equal(JSON.stringify(m),old);
});
test('duraciones dependientes de preset y pisos sin afectar obras anteriores',()=>{
 assert.ok(Construction.durationFor('apartamentos',2)>Construction.durationFor('apartamentos',1));
 assert.notEqual(Construction.durationFor('casas',1),Construction.durationFor('tienda',1));
 const m=map(),p=property(m);
 Construction.plan(p,'apartamentos',true,{stories:2});
 assert.ok(p.construction.durationMinutes>0);
 const state={},runtime=Construction.createRuntime(m,state);
 assert.equal(runtime.tick(100),false);
 assert.equal(runtime.tick(200),true);
 assert.ok(runtime.status(p.id).progress>0&&runtime.status(p.id).progress<100);
 const legacy={id:'legacy',construction:{version:1,preset:'tienda',simulated:true,progress:0}};
 const oldRuntime=Construction.createRuntime({properties:[legacy]}, {construction:{}});
 assert.equal(oldRuntime.tick(10),false);
 assert.equal(oldRuntime.tick(20),true);
 assert.equal(oldRuntime.status('legacy').progress,.4);
});
test('auditoría inspecciona CADA vivienda incluso en pisos superiores',()=>{
 const {m,p,result}=make('apartamentos',2,33,26);
 assert.equal(result.ok,true);
 const initial=Rooms.inspectParcel(m,p,{geometry:Geometry});
 assert.equal(initial.status,'unverified');
 assert.deepEqual(initial.issues,[]);
 const upper=p.generatedPrefab.apartments.find(unit=>unit.floorId===m.floors[1].id);
 assert.ok(upper);
 const floor=m.floors[1],bath=floor.items.find(it=>it.type==='room'&&it.apartmentId===upper.id&&it.constructionRoom==='bano');
 assert.ok(bath);
 const toilet=floor.items.find(it=>it.modelId==='inodoro_clasico'&&it.roomId===bath.roomId);
 assert.ok(toilet);
 floor.items=floor.items.filter(it=>it.id!==toilet.id);
 let audit=Rooms.inspectParcel(m,p,{geometry:Geometry});
 assert.equal(audit.status,'incomplete');
 assert.ok(audit.issues.some(it=>it.code==='falta_mueble'&&it.apartmentId===upper.id));
 floor.items.push(toilet);
 const door=floor.items.find(it=>it.type==='door'&&it.doorRole==='entrance'&&it.apartmentId===upper.id);
 assert.ok(door);
 floor.items=floor.items.filter(it=>it.id!==door.id);
 audit=Rooms.inspectParcel(m,p,{geometry:Geometry});
 assert.ok(audit.issues.some(it=>it.code==='sin_acceso_privado'&&it.apartmentId===upper.id));
 floor.items.push(door);
 bath.requiresClosedDoor=false;
 audit=Rooms.inspectParcel(m,p,{geometry:Geometry});
 assert.ok(audit.issues.some(it=>it.code==='sin_privacidad'&&it.apartmentId===upper.id));
});
test('niveles creados tienen metadatos compatibles con el editor',()=>{
 const {m,result}=make('apartamentos',3,32,28);
 assert.equal(result.ok,true);
 assert.equal(m.floors.length,3);
 for(const floor of m.floors.slice(1)){
  assert.ok(floor.reference&&typeof floor.reference.data==='string');
  assert.ok(Number.isFinite(floor.elevationFt));
 }
 for(let i=0;i<2;i++){
  const next=m.floors[i+1];
  assert.ok(m.floors[i].items.some(it=>it.type==='stairs'&&it.targetFloorId===next.id));
 }
});
test('cargar prefabs no modifica mapas antiguos ni crea propiedades espontáneas',()=>{
 const m=map(),before=JSON.stringify(m);
 assert.equal(Prefabs.outline({},m.units),null);
 assert.equal(JSON.stringify(m),before);
});