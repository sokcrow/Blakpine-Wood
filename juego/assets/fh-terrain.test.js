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
