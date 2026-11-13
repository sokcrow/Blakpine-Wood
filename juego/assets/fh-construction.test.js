'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('./fh-construction.js');
function make(){
 return {schema:'forest-horror-map-v1',floors:[{id:'f1',items:[]}],
  properties:[{id:'parcel_1',floorId:'f1',polygon:[{x:1,y:1},{x:4,y:1},{x:4,y:4},{x:1,y:4}]}]};
}
test('los mapas antiguos no crean obras ni cambian el JSON',()=>{
 const map=make(),original=JSON.stringify(map),state={};
 const runtime=C.createRuntime(map,state);
 assert.deepEqual(runtime.list(),[]);
 assert.equal(JSON.stringify(map),original);
 assert.equal(state.construction,undefined);
});
test('un preset instantáneo queda terminado',()=>{
 const map=make();
 C.plan(map.properties[0],'ayuntamiento',false);
 const status=C.createRuntime(map,{}).status('parcel_1');
 assert.equal(status.progress,100);
 assert.equal(status.finished,true);
 assert.equal(map.properties[0].construction.simulated,false);
});
test('la obra simulada comienza en cero y conserva el mapa',()=>{
 const map=make();
 C.plan(map.properties[0],'casas',true);
 const state={};
 const runtime=C.createRuntime(map,state);
 assert.equal(runtime.status('parcel_1').phase,'planificada');
 assert.equal(state.construction.parcel_1.progress,0);
 assert.equal(map.properties[0].construction.progress,0);
});
test('el tiempo de juego avanza sin depender de segundos reales',()=>{
 const map=make();
 C.plan(map.properties[0],'tienda',true);
 const state={},runtime=C.createRuntime(map,state,{percentPerMinute:1});
 assert.equal(runtime.tick(1000),false);
 assert.equal(runtime.tick(1018),true);
 assert.equal(runtime.status('parcel_1').progress,18);
 assert.equal(C.createRuntime(map,state).status('parcel_1').progress,18);
 assert.equal(runtime.tick(1018),false);
 assert.equal(runtime.tick(1010),false);
});
test('la contribución del obrero no puede desbordar el 100%',()=>{
 const map=make();C.plan(map.properties[0],'apartamentos',true);
 let saves=0;
 const runtime=C.createRuntime(map,{}, {save:()=>saves++});
 assert.equal(runtime.advance('parcel_1',125).progress,100);
 assert.equal(runtime.status('parcel_1').phase,'terminada');
 assert.equal(runtime.advance('parcel_1',-1),null);
 assert.equal(saves,1);
});
test('normaliza valores corruptos y no modifica otros sistemas',()=>{
 assert.equal(C.normalize(null),null);
 assert.equal(C.normalize({preset:'inexistente',simulated:true,progress:999}).progress,100);
 assert.equal(C.normalize({preset:'inexistente',simulated:false,progress:0}).progress,100);
 assert.equal(C.normalize({simulated:true,progress:NaN}).progress,0);
 assert.throws(()=>C.plan({},'presets inventados'),/Preset/);
});
test('cambio de fechas convertido a minutos absolutos',()=>{
 assert.equal(C.absoluteMinute({year:2026,month:1,day:2,minutes:0})-
  C.absoluteMinute({year:2026,month:1,day:1,minutes:0}),1440);
 assert.equal(C.absoluteMinute({}),null);
});
