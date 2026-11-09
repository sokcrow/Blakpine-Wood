'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const electric=require('./fh-electric-visuals.js');
const internet=require('./fh-internet-visuals.js');

const walls=[{id:'new-wall',type:'wall',a:{x:0,y:0},b:{x:8,y:0}}];
const oldItem={id:'legacy',type:'power_outlet',wallId:'deleted-wall',x:4,y:0,rotation:0};
const newMount={wallId:'new-wall',point:{x:4,y:0},normal:{x:0,y:1},rotation:0};

for(const [name,visual] of [['Electricidad',electric],['Internet',internet]]){
 test(name+': recuperar montaje visual si wallId antiguo ya no existe',()=>{
  const it={...oldItem};
  const original=JSON.stringify(it);
  const calls=[];
  const shared={switchWallMount:(_items,_point,options)=>{
   calls.push(options);
   return options.wallId?null:newMount;
  }};
  const pose=visual.mountPose(it,{mount:'wall',mountHeightFt:4},walls,1,shared);
  assert.ok(pose);
  assert.equal(pose.wallId,'new-wall');
  assert.equal(calls.length,2);
  assert.equal(calls[0].wallId,'deleted-wall');
  assert.equal(calls[1].wallId,undefined);
  assert.equal(JSON.stringify(it),original,'no cambiar el mapa existente');
 });
 test(name+': no recuperar visual si tampoco existe pared cercana',()=>{
  const it={...oldItem};const calls=[];
  const pose=visual.mountPose(it,{mount:'wall',mountHeightFt:4},walls,1,{
   switchWallMount:(_i,_p,opt)=>{calls.push(opt);return null;}
  });
  assert.equal(pose,null);
  assert.equal(calls.length,2);
 });
 test(name+': conservar el wallId válido sin efectuar un segundo montaje',()=>{
  const it={...oldItem,wallId:'new-wall'};let calls=0;
  const pose=visual.mountPose(it,{mount:'wall',mountHeightFt:4},walls,1,{
   switchWallMount:()=>{calls++;return newMount;}
  });
  assert.ok(pose);
  assert.equal(calls,1);
 });
}
