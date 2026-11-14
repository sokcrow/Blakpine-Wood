'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const G=require('./fh-style-property.js');
const R=require('./fh-construction-rooms.js');
const N=require('./fh-npc-facilities.js');
const Goap=require('./fh-npc-goap.js');
function map(){
 return {schema:'forest-horror-map-v1',units:{feetPerCell:5},properties:[
   {id:'shop',floorId:'f1',construction:{simulated:false,preset:'tienda'},polygon:[{x:0,y:0},{x:8,y:0},{x:8,y:8},{x:0,y:8}]},
   {id:'neighbor',floorId:'f1',polygon:[{x:8,y:0},{x:16,y:0},{x:16,y:8},{x:8,y:8}]}
  ],floors:[{id:'f1',items:[
   {id:'bath',roomId:'bath',type:'room',constructionRoom:'bano',x:3,y:3,w:3,h:3},
   {id:'wc',type:'toilet',modelId:'inodoro_clasico',x:4,y:4},
   {id:'sink',type:'misc',modelId:'lavabo_pedestal',x:5,y:4}
  ]}]};
}
const working=()=>({statusFor:()=>({water:{water:true},drain:{draining:true},power:{powered:true}})});
const origin={floor:0,x:1,z:1};
function setup(project=map(),options={}){
 return N.createRuntime(project,{geometry:G,roomAudit:R,goap:Goap,services:working(),cell:1,step:.5,
  canWalk:(_f,x,z)=>x>=0&&z>=0&&x<=16&&z<=8,
  ...options});
}
test('baño funcional con ruta real devuelve objetivo y recorrido GOAP',()=>{
 const a=setup().findBathroom({parcelId:'shop',from:origin});
 assert.equal(a.ok,true);
 assert.equal(a.roomId,'bath');
 assert.equal(a.fixtureId,'wc');
 assert.ok(a.path.length>1);
 assert.ok(setup().verifyArrival(a,a.target));
});
test('no se autoriza usar baño sin llegar físicamente',()=>{
 const runtime=setup(),a=runtime.findBathroom({parcelId:'shop',from:origin});
 assert.equal(runtime.verifyArrival(a,origin),false);
 assert.equal(runtime.verifyArrival(a,{...a.target,x:a.target.x+4}),false);
});
test('los baños sin agua o drenaje nunca son seleccionados',()=>{
 for(const bad of [{water:false,draining:true},{water:true,draining:false}]){
  const service={statusFor:()=>({water:{water:bad.water},drain:{draining:bad.draining}})};
  assert.equal(setup(map(),{services:service}).findBathroom({parcelId:'shop',from:origin}).reason,'sin_bano_funcional');
 }
});
test('una obra incompleta bloquea el acceso',()=>{
 const project=map();project.properties[0].construction.simulated=true;
 assert.equal(setup(project).findBathroom({parcelId:'shop',from:origin}).reason,'obra_pendiente');
 const runtime=setup(project,{construction:{status:()=>({finished:true})}});
 assert.equal(runtime.findBathroom({parcelId:'shop',from:origin}).ok,true);
});
test('no busca baños en otras parcelas',()=>{
 assert.equal(setup().findBathroom({parcelId:'neighbor',from:origin}).reason,'sin_bano_funcional');
 assert.equal(setup().findBathroom({from:origin}).reason,'sin_parcela');
});
test('sin ruta debido a paredes no informa éxito',()=>{
 const walk=(_f,x,z)=>x>=0&&z>=0&&x<=16&&z<=8&&x<2;
 assert.equal(setup(map(),{canWalk:walk}).findBathroom({parcelId:'shop',from:origin}).reason,'sin_ruta');
});
test('servicios y obstáculos se vuelven a consultar al confirmar llegada',()=>{
 let healthy=true;let closed=false;
 const runtime=setup(map(),{getServices:()=>({statusFor:()=>({water:{water:healthy},drain:{draining:healthy}})}),
  canWalk:(_f,x,z)=>!closed&&x>=0&&z>=0&&x<=16&&z<=8});
 const plan=runtime.findBathroom({parcelId:'shop',from:origin});
 assert.equal(plan.ok,true);
 healthy=false;assert.equal(runtime.verifyArrival(plan,plan.target),false);
 healthy=true;closed=true;assert.equal(runtime.verifyArrival(plan,plan.target),false);
});
test('sin motor de colisiones no se da acceso gratuito',()=>{
 assert.throws(()=>N.createRuntime(map(),{geometry:G,roomAudit:R,goap:Goap}),/colisión/);
});
