'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Fog=require('./fh-ground-fog.js');

function mock(){
 class Vec2{constructor(){this.x=0;this.y=0}set(x,y){this.x=x;this.y=y;return this}}
 class Vec3{constructor(){this.x=0;this.y=0;this.z=0}set(x,y,z){this.x=x;this.y=y;this.z=z;return this}}
 class Obj{constructor(){this.position=new Vec3();this.rotation=new Vec3();this.visible=true}}
 class Geometry{dispose(){}}
 class Material{constructor(v){Object.assign(this,v)}dispose(){}}
 class Mesh extends Obj{constructor(geo,mat){super();this.geometry=geo;this.material=mat}}
 class Canvas{
  constructor(){this.width=0;this.height=0;this.last=null}
  getContext(){return {createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),
   putImageData:(image)=>{this.last=image.data.slice()}}}
 }
 class Texture{constructor(canvas){this.image=canvas;this.needsUpdate=false}dispose(){}}
 class ThreeFog{constructor(color,near,far){this.color=color;this.near=near;this.far=far}}
 const scene={fog:null,children:[],add(item){this.children.push(item)},
  remove(item){this.children=this.children.filter(x=>x!==item)}};
 return {THREE:{CanvasTexture:Texture,LinearFilter:1,Vector2:Vec2,PlaneGeometry:Geometry,
  ShaderMaterial:Material,Mesh,Fog:ThreeFog,DoubleSide:2},
  document:{createElement:()=>new Canvas()},scene};
}
function setup(options={}){
 const env=mock(),previous=global.document;
 global.document=env.document;
 const vars={x:8,z:8,floor:0};
 const runtime=Fog.createRuntime({THREE:env.THREE,scene:env.scene,camera:{far:50},
  columns:12,rows:12,cell:1,actor:()=>({x:vars.x,z:vars.z}),
  floorIndex:()=>vars.floor,floorY:()=>vars.floor*3,
  isOutside:(x,z)=>vars.floor===0&&x>5,...options});
 return {runtime,vars,scene:env.scene,restore(){runtime.dispose();global.document=previous}};
}
function maximumTrail(runtime){
 const image=runtime.mesh.material.uniforms.uTrail.value.image.last;
 let max=0;
 for(let i=0;i<image.length;i+=4)max=Math.max(max,image[i]);
 return max;
}
test('parámetros aprobados: 3 pies, 4 segundos, 65 %',()=>{
 const c=Fog.settings();
 assert.equal(c.radius,.9144000000000001);
 assert.equal(c.recovery,4);
 assert.equal(c.density,.65);
 assert.equal(c.maskSize,128);
});
test('niebla distante tapa el límite y no invade el interior',()=>{
 const s=setup();
 try{
  s.runtime.update(.12);
  assert.ok(s.scene.fog);
  assert.equal(s.scene.fog.far,44);
  assert.equal(s.scene.fog.near,30);
  assert.equal(s.runtime.mesh.visible,true);
  assert.equal(s.runtime.hazeLayers.length,3,'tres velos exteriores sin sprites');
  assert.ok(s.runtime.hazeLayers.every(layer=>layer.visible));
  assert.ok(s.runtime.mesh.material.fragmentShader.includes('uOutside'));
  assert.ok(s.runtime.mesh.material.vertexShader.includes('p.z+=.19*heightNoise'));
  s.vars.x=2;s.runtime.update(.12);
  assert.equal(s.scene.fog,null,'interior sin niebla global');
  assert.ok(s.runtime.hazeLayers.every(layer=>layer.visible),'se ve la niebla exterior desde el interior');
  s.vars.floor=1;s.runtime.update(.12);
  assert.equal(s.runtime.mesh.visible,false,'planta interior no muestra niebla de suelo');
  assert.ok(s.runtime.hazeLayers.every(layer=>!layer.visible),'sin celdas exteriores no hay velos');
  assert.equal(s.runtime.mesh.position.y,3.07);
 }finally{s.restore()}
});
test('la ventana deja ver niebla situada fuera, sin cubrir la habitación',()=>{
 const s=setup();
 try{
  s.vars.x=2;s.runtime.update(.12);
  assert.equal(s.scene.fog,null);
  const layer=s.runtime.hazeLayers[0],material=layer.material;
  assert.ok(layer.visible);
  assert.equal(material.depthTest,true,'paredes y techo pueden ocluir la neblina');
  assert.equal(material.depthWrite,false);
  assert.match(material.fragmentShader,/texture2D\(uOutside,vUv\)\.r<\.5\)discard/);
  assert.match(material.fragmentShader,/uHasSight/);
  const image=material.uniforms.uOutside.value.image.last,size=s.runtime.settings.maskSize;
  const pixel=(x,z)=>image[4*(Math.floor(z/12*size)*size+Math.floor(x/12*size))];
  assert.equal(pixel(2,6),0,'habitación sin velo');
  assert.equal(pixel(8,6),255,'zona exterior sí tiene velo');
  assert.deepEqual(s.runtime.hazeLayers.map(l=>l.position.y),[.55,1.35,2.25]);
  s.runtime.update(.12,{fog:3});
  assert.ok(material.uniforms.uStrength.value>.15,'clima más denso');
 }finally{s.restore()}
});
test('la niebla distante termina antes del límite de visión del jugador',()=>{
 const s=setup({visionDistance:()=>20});
 try{
  s.runtime.update(.12);
  assert.equal(s.scene.fog.near,12);
  assert.equal(s.scene.fog.far,17.6);
  assert.ok(s.runtime.mesh.material.fragmentShader.includes('uClearRadius'),'radio exacto de 3 pies en GPU');
 }finally{s.restore()}
});
test('la dispersión del jugador persiste y se recupera en cuatro segundos',()=>{
 const s=setup();
 try{
  s.runtime.update(.12);
  assert.ok(maximumTrail(s.runtime)>0,'el jugador despeja alrededor de sus pies');
  s.vars.x=2;
  for(let i=0;i<41;i++)s.runtime.update(.1);
  assert.equal(maximumTrail(s.runtime),0,'la estela debe cerrarse');
 }finally{s.restore()}
});
test('la máscara exterior y la estela se reinician entre plantas',()=>{
 const s=setup();
 try{
  s.runtime.update(.12);
  assert.ok(maximumTrail(s.runtime)>0);
  s.vars.floor=1;s.runtime.update(.12);
  assert.equal(maximumTrail(s.runtime),0);
  const mask=s.runtime.mesh.material.uniforms.uOutside.value.image.last;
  assert.ok(mask.every((value,i)=>i%4===3?value===255:value===0));
 }finally{s.restore()}
});
test('el shader lee máscara de visibilidad cuando está disponible',()=>{
 let current=null;
 const s=setup({sightTexture:()=>current});
 try{
  s.runtime.update(.12);
  assert.equal(s.runtime.mesh.material.uniforms.uHasSight.value,0);
  current={id:'fow'};s.runtime.update(.12);
  assert.equal(s.runtime.mesh.material.uniforms.uHasSight.value,1);
  assert.equal(s.runtime.mesh.material.uniforms.uSight.value,current);
  assert.equal(s.runtime.hazeLayers[0].material.uniforms.uSight.value,current);
 }finally{s.restore()}
});
test('arranque del motor carga niebla sin requerir clima habilitado',()=>{
 const index=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
 assert.match(index,/fh-ground-fog\.js\?v=/);
 assert.match(index,/const fhGroundFog=window\.FHGroundFog\?\.createRuntime/);
 assert.match(index,/const fhGroundExposure=fhWeatherExposure\|\|window\.FHWeatherRenderer\?\.createExteriorExposure/);
 assert.match(index,/fhGroundFog\?\.update\(dt,fhWeatherEnabled\?fhWeather\?\.view\(\):null\)/);
 assert.match(index,/fhGroundFog\?\.dispose\(\)/);
});
