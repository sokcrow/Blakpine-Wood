const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('./fh-drainage.js');
const Services=require('./fh-services-core.js');
const units={columns:120,rows:120,feetPerCell:5};
const section=(id,x,y)=>D.makeSection('straight',{x:x+5,y:y+5},units,id);
const create=(withSewer=true)=>{
 const outlet={id:'outlet',type:'drain_outlet',x:32,y:32,radiusFt:5,networkId:'main'};
 const waste={id:'wc',type:'toilet',x:32,y:32,service:{drains:true}};
 const floors=[{id:'ground',elevationFt:0,items:[outlet,waste]},
 {id:'basement',elevationFt:-12,items:withSewer?[section('sewer-near',30,30),section('sewer-far',100,100)]:[]}];
 const project={schema:'forest-horror-map-v1',units,floors};
 return {project,outlet,waste};
};
test('toma residual conecta al drenaje más cercano, aunque esté en un sótano',()=>{
 const {project,outlet,waste}=create(),sys=Services.createRuntime(project,{}, {drainageCore:D});
 const drain=sys.drainStatus(0,outlet);
 assert.equal(drain.draining,true);
 assert.equal(drain.via,'sewer-near');
 assert.equal(drain.floorIndex,1);
 assert.equal(sys.drainStatus(0,waste).draining,true);
});
test('toma de drenaje dañada no descarga aunque exista premade',()=>{
 const {project,outlet}=create(),state={services:{damage:{outlet:100}}};
 const sys=Services.createRuntime(project,state,{drainageCore:D});
 assert.equal(sys.drainStatus(0,outlet).draining,false);
});
test('sin piezas nuevas, FHServices mantiene la lógica heredada',()=>{
 const {project,outlet}=create(false),legacy=Services.createRuntime(project,{}, {drainageCore:D});
 const direct=legacy.drainStatus(0,outlet);
 assert.equal(direct.draining,false);
 project.floors[0].items.push({id:'main',type:'drain_main',x:32,y:32,rangeFt:120});
 const original=Services.createRuntime(project,{}, {drainageCore:D});
 assert.equal(original.drainStatus(0,outlet).draining,true);
});
