'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Forest=require('./fh-forest.js');
function map(){return {schema:'forest-horror-map-v1',units:{columns:150,rows:130,metersPerCell:1},mainFloorId:'pb',floors:[{id:'pb',items:[]}],environment:{enabled:true,forest:{density:1,spacingM:4}}};}
test('Misma semilla, posiciones e IDs; la cámara no participa en la generación',()=>{
 const m=map(),before=JSON.stringify(m),a=Forest.createRuntime(m),b=Forest.createRuntime(m);
 assert.ok(a.trees.length>100);assert.deepEqual(a.trees,b.trees);assert.equal(JSON.stringify(m),before);
 const snapshot=a.trees;for(let x=0;x<150;x+=10)a.nearby(x,30,25);assert.deepEqual(a.trees,snapshot);
 assert.ok(a.trees.some(t=>t.x<30)&&a.trees.some(t=>t.x>120));
 m.environment.forest.seed='distinta';assert.notDeepEqual(Forest.createRuntime(m).trees,a.trees);
});
test('Reservas protegen incluso la copa; tronco conserva su propio radio',()=>{
 const m=map();m.properties=[{floorId:'pb',polygon:[{x:40,y:30},{x:90,y:30},{x:90,y:70},{x:40,y:70}]}];
 const f=Forest.createRuntime(m);for(const t of f.trees){assert.equal(f.reservedAt(t.x,t.z,t.canopyRadius+.35),false);assert.ok(t.radius<t.canopyRadius);}
 const tree=f.trees[0];assert.ok(f.collisionCandidates(0,tree.x,tree.z,.3).some(t=>t.id===tree.id));assert.deepEqual(f.collisionCandidates(1,tree.x,tree.z,10),[]);
});
test('Retirada persistente separada del diseño, inmediata y sin duplicados',()=>{
 const m=map(),state={},before=JSON.stringify(m);let saves=0,refresh=0,visual=0;
 const f=Forest.createRuntime(m,state,{save:()=>saves++,refresh:()=>refresh++});f.onRemove(()=>visual++);
 const t=f.trees[0];assert.ok(f.removeTree(t.id));assert.equal(f.removeTree(t.id),false);assert.equal(f.getTree(t.id),null);
 assert.equal(f.nearby(t.x,t.z,0).some(x=>x.id===t.id),false);assert.equal(saves,1);assert.equal(refresh,1);assert.equal(visual,1);
 assert.equal(JSON.stringify(m),before);assert.deepEqual(state.environment.removedTreeIds,[t.id]);
 assert.equal(Forest.createRuntime(m,JSON.parse(JSON.stringify(state))).getTree(t.id),null);
 assert.ok(Forest.createRuntime(m).getTree(t.id));
});
test('Exclusiones del editor no se convierten en tala de una partida',()=>{
 const m=map(),t=Forest.createRuntime(m).trees[0];m.environment.forest.exclusions=[t.id];const state={};
 assert.equal(Forest.createRuntime(m,state).getTree(t.id),null);assert.deepEqual(state,{});
});
test('Árboles no prohíben reservar una futura construcción: consulta requisitos físicos',()=>{
 const m=map(),f=Forest.createRuntime(m),t=f.trees[0],r={x:t.x-.5,z:t.z-.5,w:1,d:1};
 const before=f.evaluateConstruction(r,90);assert.equal(before.reserved,false);assert.ok(before.requiresClearing);assert.ok(before.treeIds.includes(t.id));assert.equal(before.available,false);
 for(const id of before.treeIds)f.removeTree(id);const after=f.evaluateConstruction(r,90);assert.equal(after.requiresClearing,false);assert.ok(after.available);
 assert.throws(()=>f.evaluateConstruction({x:0,z:0,w:0,d:1}));
});
test('Pinos predominan; nevados sólo con habilitación ambiental explícita',()=>{
 const m=map(),a=Forest.createRuntime(m);assert.ok(a.trees.filter(t=>t.modelId.includes('pino')).length/a.trees.length>.9);
 assert.equal(a.trees.some(t=>t.modelId==='06_pino_nevado'),false);m.environment.forest.snow=true;
 assert.ok(Forest.createRuntime(m).trees.some(t=>t.modelId==='06_pino_nevado'));
});
