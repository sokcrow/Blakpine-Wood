'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Terrain=require('./fh-terrain.js');
const map=(environment={enabled:true})=>({units:{columns:80,rows:80,metersPerCell:1},mainFloorId:'pb',floors:[{id:'basement',items:[]},{id:'pb',elevationFt:10,items:[]}],environment});
test('Mapas sin configuración mantienen altura plana y no se mutan',()=>{
 const m=map();delete m.environment;const original=JSON.stringify(m),t=Terrain.create(m);
 assert.equal(t.config.enabled,false);assert.equal(t.heightAt(20,30),0);assert.equal(JSON.stringify(m),original);
});
test('Ruido determinista con elevaciones positivas y depresiones; semillas independientes',()=>{
 const a=Terrain.create(map()),b=Terrain.create(map());let min=Infinity,max=-Infinity;
 for(let z=0;z<=80;z+=3)for(let x=0;x<=80;x+=3){const h=a.heightAt(x,z);assert.equal(h,b.heightAt(x,z));min=Math.min(min,h);max=Math.max(max,h);assert.ok(a.slopeAt(x,z)<20);}
 assert.ok(min<0&&max>0);const m=map();m.environment.forest={seed:'otra'};assert.equal(Terrain.create(m).heightAt(40,40),a.heightAt(40,40));
 m.environment.terrain={seed:'otro'};assert.notEqual(Terrain.create(m).heightAt(40,40),a.heightAt(40,40));
});
test('Protege polígonos, zonas múltiples, calles con banqueta y objetos rotados',()=>{
 const m=map();m.properties=[{floorId:'pb',polygon:[{x:5,y:5},{x:15,y:5},{x:15,y:15},{x:5,y:15}]}];
 m.locationZones=[{floorId:'pb',polygons:[[{x:20,y:5},{x:30,y:5},{x:25,y:15}]]}];
 m.floors[1].items=[{type:'asphalt',x:5,y:25,w:40,h:4,road:{axis:'x',sidewalkFt:5}},{type:'misc',x:50,y:50,w:12,h:2,rotation:45}];
 const t=Terrain.create(m);
 for(const [x,z] of [[10,10],[25,8],[15,24],[53,53]]){assert.ok(t.reservedAt(x,z));assert.equal(t.heightAt(x,z),0);}
 assert.equal(t.reservedAt(70,70),false);
 assert.ok(t.reservedRect({x:8,z:2,w:2,d:20}));assert.ok(t.reservedRect({x:2,z:7,w:18,d:2}));
 assert.equal(t.reservedRect({x:65,z:65,w:2,d:2}),false);
});
test('Altura coincide con los planos triangulares renderizados',()=>{
 const t=Terrain.create(map());
 for(const [u,v] of [[.2,.3],[.8,.6]]){
  const ix=20,iz=25,a=t.vertex(ix,iz),b=t.vertex(ix+1,iz),c=t.vertex(ix,iz+1),d=t.vertex(ix+1,iz+1);
  const h=u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
  assert.ok(Math.abs(t.heightAt((ix+u)*t.sx,(iz+v)*t.sz)-h)<1e-10);
 }
});
test('Configuración limita parámetros y rechaza algoritmos futuros',()=>{
 assert.throws(()=>Terrain.config({version:2}));assert.equal(Terrain.config({terrain:{amplitudeM:999},forest:{spacingM:-5}}).terrain.amplitudeM,6);
 assert.equal(Terrain.config({forest:{spacingM:-5}}).forest.spacingM,2.5);
});

test('Reserva el borde de una obra que intersecta el margen de un objeto puntual',()=>{
 const m=map();m.floors[1].items=[{type:'spawn',x:40,y:20}];const t=Terrain.create(m);
 assert.ok(t.reservedRect({x:35,z:21,w:10,d:3}));
});

test('Mantiene 15 ft planos desde los lados y esquinas de una construcción, entre vértices',()=>{
 assert.equal(Terrain.RELIEF_CLEARANCE_FT,15);
 const clearance=15*.3048;
 for(const meshStepM of [.5,1.5,3]){
  const m=map({enabled:true,terrain:{meshStepM}}),r={type:'building',x:30.31,y:30.47,w:10.24,h:8.51};m.floors[1].items=[r];const t=Terrain.create(m);
  const check=(x,z)=>{assert.equal(t.heightAt(x,z),0,JSON.stringify({meshStepM,x,z}));assert.equal(t.slopeAt(x,z),0);};
  for(let i=0;i<=12;i++){
   const d=clearance*i/12;
   check(r.x-d,r.y+r.h*.37);check(r.x+r.w+d,r.y+r.h*.63);
   check(r.x+r.w*.37,r.y-d);check(r.x+r.w*.63,r.y+r.h+d);
  }
  for(const [cx,cz,sx,sz] of [[r.x,r.y,-1,-1],[r.x+r.w,r.y,1,-1],[r.x,r.y+r.h,-1,1],[r.x+r.w,r.y+r.h,1,1]]){
   for(let a=0;a<=Math.PI/2;a+=Math.PI/24)check(cx+sx*Math.cos(a)*clearance,cz+sz*Math.sin(a)*clearance);
  }
  assert.equal(t.reservedAt(r.x-3,r.y+3),false,'La franja de relieve no amplía la reserva para árboles/obras');
 }
});

test('Protege 15 ft después de la banqueta de una calle y después de asfalto sin metadatos road',()=>{
 const clearance=15*.3048;
 for(const withRoad of [true,false]){
  const m=map(),road={type:'asphalt',x:10.33,y:32.17,w:55.1,h:4.2};
  if(withRoad)road.road={axis:'x',sidewalkFt:5};m.floors[1].items=[road];const t=Terrain.create(m),sidewalk=withRoad?5*.3048:0;
  for(const x of [15.31,35.17,60.29])for(const d of [0,2,clearance]){
   assert.equal(t.heightAt(x,road.y-sidewalk-d),0);assert.equal(t.heightAt(x,road.y+road.h+sidewalk+d),0);
  }
 }
});

test('El relieve reaparece fuera de la franja y su transición; mantiene la escala física del mapa',()=>{
 const m=map(),r={type:'building',x:10,y:10,w:10,h:10};m.floors[1].items=[r];
 const t=Terrain.create(m),original=Terrain.create(map());
 assert.equal(t.heightAt(65,65),original.heightAt(65,65));assert.notEqual(t.heightAt(65,65),0);
 const ft=map();ft.units.metersPerCell=.3048;ft.floors[1].items=[{type:'building',x:30,y:30,w:10,h:10}];
 const feetTerrain=Terrain.create(ft);assert.equal(feetTerrain.heightAt((30-15)*.3048,35*.3048),0);
});

test('Aplica la franja a edificios rotados, habitaciones por spans y construcciones por parcela',()=>{
 const clearance=15*.3048;
 const a=map();a.floors[1].items=[{type:'building',x:30,y:30,w:10,h:6,rotation:45}];const t=Terrain.create(a),angle=Math.PI/4;
 const point={x:35+Math.cos(angle)*(5+clearance),z:33+Math.sin(angle)*(5+clearance)};
 assert.equal(t.heightAt(point.x,point.z),0);
 const b=map();b.floors[1].items=[{type:'room',spans:[{x:20,y:20,w:10,h:10}]}];assert.equal(Terrain.create(b).heightAt(30+clearance,25),0);
 const c=map();c.properties=[{floorId:'pb',construction:{simulated:true},polygon:[{x:20,y:20},{x:30,y:20},{x:30,y:30},{x:20,y:30}]}];assert.equal(Terrain.create(c).heightAt(30+clearance,25),0);
});
