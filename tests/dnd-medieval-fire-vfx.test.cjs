'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fire=require('../juego/assets/fh-medieval-fire-vfx.js');
const slab=(x=0,w=8)=>({enabled:true,spans:[{x,y:0,w,h:8}]});
test('conducto exterior llega a altura de cubierta inclinada + 10 ft',()=>{
 const floors=[{elevationFt:0,ceilingHeightFt:11,roof:{shape:'gable',riseFt:4}},
  {elevationFt:11,ceilingHeightFt:10}];
 assert.equal(fire.chimneyTopFt(floors,[slab(),slab(0,4)],0,7,2),25);
 assert.equal(fire.chimneyTopFt(floors,[slab(),slab(0,4)],0,2,2),31);
});
test('la cubierta plana no suma pendiente y los valores inválidos se acotan',()=>{
 assert.equal(fire.chimneyTopFt([{elevationFt:0,ceilingHeightFt:10,roof:{shape:'flat',riseFt:9}}],[slab()],0,3,3),20);
 assert.equal(fire.chimneyTopFt([{elevationFt:0,ceilingHeightFt:10,roof:{shape:'gable',riseFt:90}}],[slab()],0,3,3),50);
});
test('llama tiene volumen 3D, respeta apagado y no crea PointLights',()=>{
 class Group{constructor(){this.children=[];}add(x){this.children.push(x);}}
 class Mesh{constructor(geometry,material){this.geometry=geometry;this.material=material;
  this.position={set(x,y,z){this.x=x;this.y=y;this.z=z;}};
  this.scale={set(){},setScalar(){}};this.rotation={z:0};this.visible=true;}}
 const T={Group,Mesh,
  MeshBasicMaterial:class{constructor(options){this.options=options;}},
  ConeGeometry:class{constructor(radius,height,sides){this.radius=radius;this.height=height;this.sides=sides;}},
  IcosahedronGeometry:class{constructor(){}}};
 const parent=new Group(),lamp={id:'torch',lightKind:'torch_hand'};
 fire.reset();const visual=fire.attach(T,parent,lamp,1);
 assert.ok(visual);assert.equal(parent.children.length,1);
 assert.equal(visual.tongues.length,2);
 assert.ok(visual.tongues.every(x=>x.mesh.geometry.sides===5));
 const calls=[];
 fire.tick(.016,{lit:(floor,item)=>{calls.push([floor,item.id]);return false;}});
 assert.equal(visual.group.visible,false);
 fire.tick(.016,{lit:()=>true});assert.equal(visual.group.visible,true);
 assert.deepEqual(calls,[[1,'torch']]);fire.reset();
});

test('fuego y suministros usan geometrías Three reales; la llama de pared sigue su altura',()=>{
 const THREE=require('../juego/assets/vendor/three.min.js'),root=new THREE.Group();fire.reset();
 const visual=fire.attach(THREE,root,{id:'wall',lightKind:'torch_wall',mountHeightFt:5},0);
 assert.equal(visual.group.position.y,5*.3048);
 for(const part of visual.tongues){part.mesh.geometry.computeBoundingBox();
  const box=part.mesh.geometry.boundingBox;assert.ok(box.max.x>box.min.x&&box.max.y>box.min.y&&box.max.z>box.min.z);
 }
 for(const medievalFuel of ['resina_antorcha','cera_vela','aceite_lampara','lena']){
  const group=fire.attachFuel(THREE,new THREE.Group(),{medievalFuel});
  assert.ok(group.children.length);assert.ok(group.children.every(m=>m.geometry.attributes.position.count>0));
 }
 fire.reset();
});
