/* Pruebas de regresión: ningún efecto atmosférico aparece bajo techo. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Renderer=require('./fh-weather-renderer.js');

function mockThree(){
 class Vec{constructor(){this.x=0;this.y=0;this.z=0}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this}}
 class Geometry{constructor(){this.attributes={};this.range={start:0,count:0}}
  setAttribute(k,v){this.attributes[k]=v}
  setDrawRange(start,count){this.range={start,count}}
  dispose(){}}
 class BufferAttribute{constructor(array,itemSize){this.array=array;this.itemSize=itemSize}}
 class Material{constructor(values={}){Object.assign(this,values)}dispose(){}}
 class Object3D{constructor(){this.position=new Vec();this.rotation=new Vec();this.scale=new Vec();this.matrix={}}
  updateMatrix(){this.matrix={x:this.position.x,z:this.position.z}}}
 class Mesh extends Object3D{constructor(geometry,material){super();this.geometry=geometry;this.material=material;this.visible=true}
  }
 class Group extends Object3D{constructor(){super();this.children=[]}
  add(...children){this.children.push(...children)}}
 class InstancedMesh extends Mesh{constructor(geometry,material,count){super(geometry,material);this.count=count;this.instanceMatrix={}}
  setMatrixAt(i,matrix){this['matrix'+i]=matrix}}
 class Canvas{
  constructor(){this.width=0;this.height=0;this.image=null;this.ctx={
   createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),
   putImageData:(img)=>{this.image={width:img.width,height:img.height,data:img.data.slice()}},
   getImageData:(x,y,w,h)=>this.image||{width:w,height:h,data:new Uint8ClampedArray(w*h*4)}
  }}
  getContext(){return this.ctx}
 }
 const THREE={BufferGeometry:Geometry,BufferAttribute,LineBasicMaterial:Material,PointsMaterial:Material,
  MeshLambertMaterial:Material,PlaneGeometry:Geometry,LineSegments:Mesh,Points:Mesh,Group,
  Mesh,InstancedMesh,Object3D,FogExp2:class{constructor(c,d){this.color=c;this.density=d}},
  CanvasTexture:class{constructor(image){this.image=image}dispose(){}},NearestFilter:1,LinearFilter:2,
  DoubleSide:3};
 return {THREE,document:{createElement:()=>new Canvas()},scene:{
  fog:null,children:[],add(...objs){this.children.push(...objs)},
  remove(...objs){this.children=this.children.filter(c=>!objs.includes(c))}}};
}
function state(overrides={}){
 return {type:'tormenta',phase:'lluvia',intensity:1,fog:3,snow:.75,wetness:.7,...overrides};
}
test('cache de intemperie vuelve a consultar al cambiar de planta',()=>{
 let floor=0,checks=0;
 const c=Renderer.createOutsideCache((x,z)=>{checks++;return floor===0&&x>0&&z>0},()=>floor,1.524);
 assert.equal(c.outside(2,2),true);
 assert.equal(c.outside(2,2),true);
 assert.equal(checks,1);
 floor=1;
 assert.equal(c.outside(2,2),false);
 assert.equal(checks,2);
});
test('pasillo interior: ni lluvia, ni nieve, ni charcos, ni niebla',()=>{
 const {THREE,document,scene}=mockThree();
 const old=global.document;global.document=document;
 try{
  const r=Renderer.createRuntime({THREE,scene,columns:16,rows:20,cell:1.524,
   actor:()=>({x:10,z:10}),floorY:()=>0,floorIndex:()=>0,isOutside:()=>false});
  r.update(.016,state());
  const rain=scene.children.find(g=>g instanceof THREE.Group).children[0];
  const snow=scene.children.find(g=>g instanceof THREE.Group).children[1];
  const ground=scene.children.find(g=>g.geometry&&g.material?.map&&g instanceof THREE.Mesh);
  assert.equal(rain.visible,false);
  assert.equal(snow.visible,false);
  assert.equal(ground.visible,false);
  assert.equal(scene.fog,null);
  r.update(.016,state({phase:'nieve'}));
  assert.equal(snow.visible,false);
  r.dispose();
 }finally{global.document=old}
});
test('el exterior funciona; cambiar de planta vuelve a ocultarlo bajo techo',()=>{
 const {THREE,document,scene}=mockThree();
 const old=global.document;global.document=document;
 try{
  let floor=0;
  const r=Renderer.createRuntime({THREE,scene,columns:16,rows:20,cell:1.524,
   actor:()=>({x:10,z:10}),floorY:()=>floor*3,floorIndex:()=>floor,
   isOutside:()=>floor===0});
  const group=scene.children.find(g=>g instanceof THREE.Group);
  r.update(.016,state());
  assert.equal(group.children[0].visible,true);
  assert.notEqual(scene.fog,null);
  floor=1;
  r.update(.016,state());
  assert.equal(group.children[0].visible,false);
  assert.equal(scene.fog,null);
  r.dispose();
 }finally{global.document=old}
});
test('lluvia visible solo en posiciones exteriores, incluso desde una ventana',()=>{
 const {THREE,document,scene}=mockThree();
 const old=global.document;global.document=document;
 try{
  const r=Renderer.createRuntime({THREE,scene,columns:16,rows:20,cell:1.524,
   actor:()=>({x:8,z:10}),floorY:()=>0,floorIndex:()=>0,
   isOutside:(x,z)=>x>8});
  r.update(.016,state());
  const group=scene.children.find(g=>g instanceof THREE.Group);
  const rain=group.children[0];
  assert.equal(rain.visible,true);
  const count=rain.geometry.range.count;
  assert.ok(count>0&&count<360,'no se dibujan todas las gotas');
  const positions=rain.geometry.attributes.position.array;
  for(let i=0;i<count/2;i++)
   assert.ok(8+positions[i*6]>7.85,'cada gota está al lado exterior del límite');
  r.dispose();
 }finally{global.document=old}
});
