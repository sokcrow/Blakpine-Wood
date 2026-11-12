'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const gridApi=require('./fh-exterior-grid.js');
const visual=require('./fh-exterior-visuals.js');
class Vector3{
 constructor(x,y,z){this.x=x;this.y=y;this.z=z;}
 clone(){return new Vector3(this.x,this.y,this.z)}
 distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z)}
 lerp(v,t){this.x+=(v.x-this.x)*t;this.y+=(v.y-this.y)*t;this.z+=(v.z-this.z)*t;return this;}
}
class Mesh{
 constructor(geometry,material){this.geometry=geometry;this.material=material;this.userData={};}
}
const THREE={Vector3,CatmullRomCurve3:class{constructor(points){this.points=points}},
 TubeGeometry:class{dispose(){}},MeshStandardMaterial:class{dispose(){}},Mesh};
const street=[{id:'tx',modelId:'transformador_poste_simple',x:0,y:0},
 {id:'light',modelId:'poste_luz_con_brazo',x:5,y:0},
 {id:'home',type:'breaker_panel',x:7,y:0}];
test('las farolas y cables se sincronizan con los apagones, con limpieza segura',()=>{
 const state={flags:{power_global:true},services:{contracts:{electricity:'active'}}};
 const project={units:{feetPerCell:5},floors:[{id:'f0',elevationFt:0,items:street}]};
 const exteriorGrid=gridApi.createRuntime(project,state),lights=new Map();
 const added=[];global.FHExteriorGrid=gridApi;
 global.FHLights={setDynamicSource:(id,item)=>lights.set(id,item),removeDynamicSource:id=>lights.delete(id)};
 let masked=0;
 const result=visual.install({THREE,DATA:project,CELL:5*.3048,
  stories:[{add:it=>{it.parent={remove:()=>{}};added.push(it);}}],
  service:{exteriorGrid},applyFOW:()=>{masked++}});
 assert.ok(result);assert.equal(added.length,2);assert.equal(masked,2);
 assert.equal(lights.size,1);assert.ok(lights.has('fh_exterior_f0_light'));
 assert.equal(lights.get('fh_exterior_f0_light').floor,0);
 state.flags.power_global=false;result.update();assert.equal(lights.size,0);
 state.flags.power_global=true;result.update();assert.equal(lights.size,1);
 for(let i=0;i<1000;i++)result.update();
 result.dispose();assert.equal(lights.size,0);
 delete global.FHExteriorGrid;delete global.FHLights;
});


test('la bombilla del poste ilumina y se apaga con la red sin crear PointLights extra',()=>{
 const state={flags:{power_global:true},services:{contracts:{electricity:'active'}}};
 const project={units:{feetPerCell:5},floors:[{id:'f0',elevationFt:0,items:street}]};
 const grid=gridApi.createRuntime(project,state),sources=new Map(),added=[];
 const material=()=>({dispose(){}});
 const THREE_EXT={...THREE,SphereGeometry:class{dispose(){}},MeshBasicMaterial:class{constructor(spec){this.spec=spec;}dispose(){}},
  Mesh:class{constructor(g,m){this.geometry=g;this.material=m;this.userData={};this.position={set(x,y,z){this.x=x;this.y=y;this.z=z;}}}}};
 global.FHLights={setDynamicSource:(id,v)=>sources.set(id,v),removeDynamicSource:id=>sources.delete(id)};
 const result=visual.install({THREE:THREE_EXT,DATA:project,CELL:5*.3048,
  stories:[{add(mesh){mesh.parent={remove(){}};added.push(mesh);}}],service:{exteriorGrid:grid}});
 assert.ok(result);
 assert.equal(result.bulbs.size,1);
 const bulb=[...result.bulbs.values()][0];
 assert.equal(bulb.visible,true);
 assert.equal(sources.size,1);
 assert.ok(sources.values().next().value.brightRadius>0);
 state.flags.power_global=false;result.update();
 assert.equal(bulb.visible,false);
 assert.equal(sources.size,0);
 state.flags.power_global=true;result.update();
 assert.equal(bulb.visible,true);
 assert.equal(sources.size,1);
 result.dispose();
 assert.equal(sources.size,0);
 delete global.FHLights;
});
