const assert=require('node:assert/strict');
const D=require('./fh-decoration.js');
const surface=require('./fh-surface-placement.js');

const floor={id:'chair',x:2,y:3,w:1,h:.5,rotation:0,placement:'floor'};
const snap=D.snapshot(floor);assert.deepEqual(snap,{x:2,y:3,rotation:0,support:undefined,wallId:''});
const pts=D.footprintPoints(floor,1);assert.ok(pts.length>=6);
let c=D.candidate(floor,[],{x:4,y:5,rotation:90,floorFits:()=>true});
assert.equal(c.ok,true);assert.equal(c.item.x,4);assert.equal(c.item.y,5);assert.equal(c.item.rotation,90);

c=D.candidate(floor,[],{x:4,y:5,floorFits:()=>false});
assert.equal(c.ok,false);assert.equal(c.reason,'blocked');

const table={id:'table',x:4,y:4,w:2,h:2,rotation:0,heightFt:2.5,supportSurfaces:[{id:'top',xFt:0,zFt:0,widthFt:6,depthFt:6,heightFt:2.5}]};
const lamp={id:'lamp',x:4,y:4,w:.2,h:.2,rotation:0,placement:'surface'};
c=D.candidate(lamp,[table],{x:4,y:4,feetPerCell:5,surfaceApi:surface,surfaceProvider:(item)=>item.supportSurfaces});
assert.equal(c.ok,true);assert.equal(c.supported,true);assert.equal(c.item.support.parentItemId,'table');

c=D.candidate(lamp,[],{x:4,y:4,feetPerCell:5,surfaceApi:surface,surfaceProvider:(item)=>item.supportSurfaces});
assert.equal(c.ok,false);assert.equal(c.reason,'surface-required');

const wall={id:'mirror',x:1,y:1,rotation:0,placement:'wall'};
c=D.candidate(wall,[],{x:2,y:2,rotation:0,wallMount:()=>({wallId:'w1',point:{x:2.1,y:2.2},rotation:180})});
assert.equal(c.ok,true);assert.equal(c.item.wallId,'w1');assert.equal(c.item.rotation,180);
c=D.candidate(wall,[],{x:2,y:2,wallMount:()=>null});assert.equal(c.reason,'wall-required');

const target={...floor,support:{parentItemId:'x'}};D.applyPose(target,{x:8,y:9,rotation:270,support:undefined,wallId:''});
assert.equal(target.x,8);assert.equal(target.y,9);assert.equal(target.rotation,270);assert.equal('support' in target,false);
assert.equal(D.isMovable({...floor,type:'chair'}),true);
assert.equal(D.isMovable({id:'sofa-map',type:'sofa',x:0,y:0}),true);
assert.equal(D.isMovable({id:'mesa-map',type:'misc',modelId:'mesa_pequena'}),true);
assert.equal(D.isMovable({id:'wall-map',type:'wall',runtimeDecoratable:true}),false);
assert.equal(D.isMovable({id:'reader',type:'misc',modelId:'lector_tarjetas'}),false);
assert.equal(D.isMovable({id:'fixture',type:'light_switch'}),false);
assert.equal(D.isMovable({id:'fixed',type:'chair',decoratable:false}),false);
const blockedPreview=D.preview(floor,[],{x:7,y:8,rotation:45,floorFits:()=>false});
assert.equal(blockedPreview.ok,false);
assert.equal(blockedPreview.reason,'blocked');
assert.deepEqual([blockedPreview.pose.x,blockedPreview.pose.y,blockedPreview.pose.rotation],[7,8,45]);
assert.deepEqual([floor.x,floor.y,floor.rotation],[2,3,0]); // No muta el mueble real.
const allowedPreview=D.preview(floor,[],{x:1,y:1,rotation:90,floorFits:()=>true});
assert.equal(allowedPreview.ok,true);
assert.deepEqual([allowedPreview.pose.x,allowedPreview.pose.y,allowedPreview.pose.rotation],[1,1,90]);
console.log('PASS fh-decoration');
