'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const prepare=require('../../tests/helpers/forest-engine.cjs'),Forest=require('./fh-forest.js');
let composed;
function engine(){return composed??=(prepare());}
function fn(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
function runtime(){return Forest.createRuntime({units:{columns:100,rows:100,metersPerCell:1},mainFloorId:'pb',floors:[{id:'pb',items:[]}],environment:{enabled:true,forest:{density:1}}});}
test('Compone todos los adaptadores reales y el documento mantiene sintaxis válida',()=>{
 const {html}=engine();let count=0;
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim()){new vm.Script(m[1]);count++;}
 assert.ok(count>0);assert.match(html,/fhForestSight\(sightFloor,sightWalls\[sightFloor\]/);
 for(const name of ['FHServicesRuntime','FHStructureHealthRuntime','FHConstructionRuntime','FHCCTV.createRuntime','FHForestRuntime'])assert.ok(html.includes(name),name);
 assert.match(html,/surfaceRects:surfaceRectsMinusVoids/);
 assert.match(html,/fhDrainActorDrop\+fhGroundRise/);
 assert.match(html,/1\.05\+fhGroundRise\(point.floor/);
});
test('La colisión compartida usa tronco circular, retirada inmediata y planta explícita de NPC',()=>{
 const f=runtime(),tree=f.trees[0],source=fn(engine().html,'function solidAt(x,y,ctx){','\n// shared/stairs.js');
 const solid=vm.runInNewContext(source+';solidAt',{window:{FHForestRuntime:f}});
 const ctx={radius:.25,width:100,height:100,walls:[],doors:[],objects:[],forestFloor:0};
 assert.equal(solid(tree.x,tree.z,ctx),true);
 assert.equal(solid(tree.x+tree.radius+.3,tree.z,ctx),false);
 assert.equal(solid(tree.x,tree.z,{...ctx,forestFloor:1}),false);
 f.removeTree(tree.id);assert.equal(solid(tree.x,tree.z,ctx),false);
});
test('Visión compartida intersecta el tronco real; copa, CCTV y retirada no producen falsos bloqueos',()=>{
 const f=runtime(),tree=f.trees.find(t=>t.radius>.5),source=fn(engine().html,'function sightRayDistance(x,z,dir,segments,maxRange){','\n/** La misma tolerancia');
 const ray=vm.runInNewContext(source+';sightRayDistance',{window:{FHForestRuntime:f}}),segments=[];segments.forestFloor=0;
 const range=2,from=tree.x-2,hit=ray(from,tree.z,{x:1,z:0},segments,range);
 assert.ok(Math.abs(hit-(2-tree.radius))<1e-8);
 assert.equal(ray(from,tree.z+tree.radius+.01,{x:1,z:0},segments,range),range);
 assert.equal(ray(tree.x,tree.z,{x:1,z:0},segments,range),0);
 segments.forestFloor=1;assert.equal(ray(from,tree.z,{x:1,z:0},segments,range),range);
 segments.forestFloor=0;f.removeTree(tree.id);assert.equal(ray(from,tree.z,{x:1,z:0},segments,range),range);
});
test('Shader FOW aplica matriz de instancia y conserva la máscara de oscuridad',()=>{
 const {html}=engine(),source=fn(html,'function installVisibility(root=scene){','\nconst heroMaterial=');
 const THREE=require('./vendor/three.min.js'),material=new THREE.MeshBasicMaterial(),scene=new THREE.Group(),mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(),material,2);scene.add(mesh);
 const install=vm.runInNewContext(source+';installVisibility',{scene,MAX_X:100,MAX_Z:100,sightUniform:{value:null}});install(scene);install(scene);
 const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <dithering_fragment>'};material.onBeforeCompile(shader);
 assert.match(shader.vertexShader,/#ifdef USE_INSTANCING\nfhWorld=instanceMatrix\*fhWorld;/);
 assert.match(shader.fragmentShader,/texture2D\(uSight/);assert.match(shader.fragmentShader,/discard/);
 assert.equal((shader.vertexShader.match(/varying vec3 fhPos/g)||[]).length,1);
});
test('Configuración viaja al motor, JSON e historial; carga de controles precede init',()=>{
 const editor=fs.readFileSync(require('node:path').join(__dirname,'../../index.html'),'utf8');
 assert.ok(editor.indexOf('src="./juego/assets/fh-forest-editor.js')<editor.indexOf('function init()'));
 assert.match(editor,/environment:clone\(project.environment\)/);assert.match(editor,/project.environment=clone\(saved.environment\)/);
 assert.match(editor,/FHForestEditor\?\.install/);
});
