'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),THREE=require('./vendor/three.min.js'),Forest=require('./fh-forest.js'),Visuals=require('./fh-forest-visuals.js'),fs=require('node:fs'),path=require('node:path');
function setup(loader){
 const map={units:{columns:60,rows:60,metersPerCell:1},floors:[{id:'pb',items:[]}],mainFloorId:'pb',environment:{enabled:true,forest:{density:1}}};
 const runtime=Forest.createRuntime(map,{}),parent=new THREE.Group();let masks=0;
 loader??={load(url,done){const model=[...runtime.catalog.values()].find(m=>url.endsWith(m.archivo)),root=new THREE.Group(),geometry=new THREE.BoxGeometry(2,model.alto_ft,2);geometry.translate(0,model.alto_ft/2,0);root.add(new THREE.Mesh(geometry,new THREE.MeshLambertMaterial()));done({scene:root});}};
 const visual=Visuals.install({THREE,runtime,parent,baseURL:'https://test/vegetacion/',loader,applySightMask(){masks++;}});
 return {runtime,visual,parent,get masks(){return masks;}};
}
test('Instancias sectorizadas conservan altura física y retirada sólo cambia su slot',async()=>{
 const s=setup();await s.visual.ready;const tree=s.runtime.trees[0],slot=s.visual.slots.get(tree.id)[0],matrix=new THREE.Matrix4();slot.mesh.getMatrixAt(slot.index,matrix);
 assert.ok(Math.abs(matrix.elements[13]-tree.y)<1e-6);assert.ok(slot.mesh.isInstancedMesh);assert.ok(slot.mesh.frustumCulled);assert.ok(slot.mesh.geometry.boundingSphere.radius>tree.height);
 assert.ok(Math.abs(slot.mesh.geometry.boundingBox.max.y-tree.height)<.00001);assert.ok(s.masks>1);
 s.runtime.removeTree(tree.id);slot.mesh.getMatrixAt(slot.index,matrix);assert.equal(matrix.elements[0],0);assert.equal(matrix.elements[5],0);assert.equal(matrix.elements[10],0);
 s.visual.dispose();assert.equal(s.parent.children.length,0);s.visual.dispose();
});
test('Retirada durante una carga GLB pendiente no reaparece al completar',async()=>{
 const pending=[],s=setup({load(url,done){pending.push(done);}}),tree=s.runtime.trees[0];s.runtime.removeTree(tree.id);
 for(const done of pending){const scene=new THREE.Group();scene.add(new THREE.Mesh(new THREE.BoxGeometry(1,10,1),new THREE.MeshBasicMaterial()));done({scene});}
 await s.visual.ready;assert.equal(s.visual.slots.has(tree.id),false);s.visual.dispose();
});
test('La malla respeta los huecos del motor; no tapa la escalera ni el drenaje',async()=>{
 const runtime=Forest.createRuntime({units:{columns:10,rows:10,metersPerCell:1},floors:[{id:'pb',items:[]}],environment:{enabled:true,forest:{density:0}}});
 const visual=Visuals.install({THREE,runtime,parent:new THREE.Group(),baseURL:'https://test/',applySightMask(){},loader:{},surfaceRects:[{x:0,z:0,w:4,d:10},{x:6,z:0,w:4,d:10},{x:4,z:0,w:2,d:4},{x:4,z:6,w:2,d:4}]});await visual.ready;
 visual.group.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(5,20,5),new THREE.Vector3(0,-1,0));assert.equal(ray.intersectObject(visual.group,true).length,0);
 ray.set(new THREE.Vector3(2,20,2),new THREE.Vector3(0,-1,0));assert.ok(ray.intersectObject(visual.group,true).length>0);visual.dispose();
});
test('12 GLB auténticos declaran altura en pies; catálogo JS coincide con JSON',()=>{
 const folder=path.resolve(__dirname,'../../forest-horror/biblioteca/vegetacion'),catalog=JSON.parse(fs.readFileSync(path.join(folder,'catalogo_vegetacion.json'),'utf8'));
 assert.deepEqual(require('./fh-forest-catalog.js'),catalog);assert.equal(catalog.models.length,12);assert.equal(catalog.metersPerGlbUnit,.3048);
 for(const model of catalog.models){const bytes=fs.readFileSync(path.join(folder,model.archivo));assert.equal(bytes.toString('ascii',0,4),'glTF');const doc=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12))),primitive=doc.meshes[0].primitives[0],bounds=doc.accessors[primitive.attributes.POSITION];
  assert.equal(bounds.min[1],0);assert.equal(bounds.max[1],model.alto_ft);assert.ok(Math.abs(model.heightM-bounds.max[1]*.3048)<1e-9);assert.ok(fs.existsSync(path.join(folder,model.miniatura)));assert.ok(model.trunkRadiusM<model.ancho_ft*.3048/2);
 }
});

function readSlot(slot){const matrix=new THREE.Matrix4();slot.mesh.getMatrixAt(slot.index,matrix);return matrix;}
function cameraRay(tree,{height=1,fromX=-1,far=2}={}){return new THREE.Raycaster(new THREE.Vector3(tree.x+fromX,tree.y+height,tree.z),new THREE.Vector3(1,0,0),.04,far);}
test('Rayos reales detectan el árbol por instancia, incluido mientras está oculto',async()=>{
 const s=setup();await s.visual.ready;const tree=s.runtime.trees[0],slot=s.visual.slots.get(tree.id)[0],before=readSlot(slot),ray=cameraRay(tree);
 const neighbor=[...s.visual.slots.values()].flat().find(other=>other.mesh===slot.mesh&&other.index!==slot.index);assert.ok(neighbor);const neighborBefore=readSlot(neighbor);
 const hits=ray.intersectObject(s.visual.cutawayRoot,true);assert.ok(hits.some(hit=>hit.fhForestTreeId===tree.id&&hit.instanceId===slot.index));
 s.visual.setCameraHidden(new Set([tree.id]));assert.equal(readSlot(slot).elements[0],0);
 assert.ok(ray.intersectObject(s.visual.cutawayRoot,true).some(hit=>hit.fhForestTreeId===tree.id),'La selección no depende de la matriz visual colapsada');
 assert.deepEqual(readSlot(neighbor),neighborBefore,'Otro árbol del mismo batch permanece visible');assert.ok(slot.mesh.visible);assert.ok(slot.mesh.parent.visible);
 s.visual.setCameraHidden([]);assert.deepEqual(readSlot(slot),before);s.visual.dispose();
});
test('No corta árboles detrás de la cámara ni más allá del personaje',async()=>{
 const s=setup();await s.visual.ready;const tree=s.runtime.trees[0];
 for(const ray of [cameraRay(tree,{fromX:1}),cameraRay(tree,{far:.2})])assert.equal(ray.intersectObject(s.visual.cutawayRoot,true).some(hit=>hit.fhForestTreeId===tree.id),false);
 s.visual.dispose();
});
test('La intersección usa triángulos reales, no sólo la caja ni el radio de la copa',async()=>{
 const s=setup({load(url,done){const scene=new THREE.Group(),geometry=new THREE.SphereGeometry(1,12,8);geometry.translate(0,4,0);scene.add(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial()));done({scene});}});await s.visual.ready;
 const tree=s.runtime.trees[0],ray=new THREE.Raycaster(new THREE.Vector3(tree.x+.29,tree.y+4*.3048+.29,tree.z-1),new THREE.Vector3(0,0,1),.04,2);
 assert.equal(ray.intersectObject(s.visual.cutawayRoot,true).some(hit=>hit.fhForestTreeId===tree.id),false);
 ray.set(new THREE.Vector3(tree.x,tree.y+4*.3048,tree.z-1),new THREE.Vector3(0,0,1));assert.ok(ray.intersectObject(s.visual.cutawayRoot,true).some(hit=>hit.fhForestTreeId===tree.id));s.visual.dispose();
});
test('El hide no cambia colisiones, IDs, terreno ni estado de tala; un árbol talado nunca se restaura',async()=>{
 const s=setup();await s.visual.ready;const tree=s.runtime.trees[0],slot=s.visual.slots.get(tree.id)[0],ids=s.runtime.trees.map(t=>t.id),height=s.runtime.heightAt(tree.x,tree.z);
 s.visual.setCameraHidden([tree.id]);assert.ok(s.runtime.getTree(tree.id));assert.ok(s.runtime.collisionCandidates(0,tree.x,tree.z).some(t=>t.id===tree.id));
 assert.deepEqual(s.runtime.trees.map(t=>t.id),ids);assert.equal(s.runtime.heightAt(tree.x,tree.z),height);
 s.runtime.removeTree(tree.id);s.visual.setCameraHidden([]);assert.equal(readSlot(slot).elements[0],0);assert.equal(s.runtime.getTree(tree.id),null);
 assert.equal(cameraRay(tree).intersectObject(s.visual.cutawayRoot,true).some(hit=>hit.fhForestTreeId===tree.id),false);s.visual.dispose();
});
test('CCTV restaura temporalmente las instancias y recupera el hide aunque falle el render',async()=>{
 const s=setup();await s.visual.ready;const tree=s.runtime.trees[0],slot=s.visual.slots.get(tree.id)[0],before=readSlot(slot);s.visual.setCameraHidden([tree.id]);
 assert.throws(()=>s.visual.withoutCameraCutaway(()=>{assert.deepEqual(readSlot(slot),before);throw Error('render-failure');}),/render-failure/);
 assert.equal(readSlot(slot).elements[0],0);assert.ok(s.visual.cameraHiddenIds.has(tree.id));
 s.visual.withoutCameraCutaway(()=>{s.runtime.removeTree(tree.id);});assert.equal(readSlot(slot).elements[0],0);assert.equal(s.visual.cameraHiddenIds.has(tree.id),false);s.visual.dispose();
});
test('Rayos de cámara respetan la transformación de la planta',async()=>{
 const s=setup();await s.visual.ready;const tree=s.runtime.trees[0];s.parent.position.set(50,7,-30);s.parent.rotation.y=.6;s.parent.scale.setScalar(1.2);s.parent.updateMatrixWorld(true);
 const from=new THREE.Vector3(tree.x-1,tree.y+1,tree.z).applyMatrix4(s.parent.matrixWorld),to=new THREE.Vector3(tree.x+1,tree.y+1,tree.z).applyMatrix4(s.parent.matrixWorld);
 const ray=new THREE.Raycaster(from,to.clone().sub(from).normalize(),.04,from.distanceTo(to));assert.ok(ray.intersectObject(s.visual.cutawayRoot,true).some(hit=>hit.fhForestTreeId===tree.id));s.visual.dispose();
});
