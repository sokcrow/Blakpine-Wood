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
