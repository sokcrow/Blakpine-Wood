'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const GOAP=require('./fh-npc-goap.js');
const index=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const open='const npcAddon=String.raw'+String.fromCharCode(96);
const start=index.indexOf(open);
const end=index.indexOf(String.fromCharCode(96)+';\n  let runtimeWithNpc',start);
assert.ok(start>0&&end>start,'Debe existir el adaptador GOAP al motor');
const injected=index.slice(start+open.length,end);

function scene(){
 const metadata=(id,x,type='door')=>({id,type,a:{x,y:0},b:{x,y:2},doorRole:'auto'});
 const ordinary={id:'hall',kind:'door',f:0,family:'single',role:'auto',open:false,locked:false,passable:false,block:{x1:2,z1:0,x2:2,z2:2}};
 const property={id:'home',kind:'door',f:0,family:'single',role:'auto',open:false,locked:false,passable:false,block:{x1:4,z1:0,x2:4,z2:2}};
 const DATA={floors:[{id:'floor1',items:[metadata('hall',2),metadata('home',4)]}],properties:[{floorId:'floor1'}]};
 const state={doors:{},flags:{}};
 const shared={
  distanceToSegment:(x,z,seg)=>Math.abs(x-seg.x1),
  solidAt:(x,z,ctx)=>ctx.doors.some(d=>Math.abs(x-d.block.x1)<.32&&(!d.open||d.passable===false))
 };
 const context={
  DATA,GameState:state,doorList:[[ordinary,property]],
  currentFloor:0,CELL:1,PLAYER_RADIUS:.22,MAX_X:7,MAX_Z:4,WALL_THICK:.1,
  blockers:[[]],furnitureColliders:[[]],elevatorPortals:[[]],SLABS:[{enabled:false}],
  ForestShared:shared,window:{FHNPCGOAP:GOAP,FHStyleProperty:{
   propertyAt:(_map,_id,p)=>p.x>3.4?{id:'privado'}:null,
   entrancePropertyAt:()=>null
  }},
  WeakMap,Math,
  doorTarget:d=>d.open?1.2:0,
  applyDoorPose:d=>{d.passable=!!d.open},
  rememberDoor:d=>{state.doors[d.id]={open:d.open,locked:d.locked}},
  visibilityDirty:false,roomLightsDirty:false
 };
 vm.runInNewContext(injected+'\nvar API={canWalk:fhNpcCanWalk,openDoor:fhNpcOpenDoor,rights:fhNpcDoorRights};',context);
 return {context,ordinary,property,state,api:context.API};
}
test('La ruta prevé abrir una puerta pública, pero mantiene colisión hasta abrirla',()=>{
 const s=scene();
 assert.equal(s.api.canWalk(0,2,1),false);
 assert.equal(s.api.canWalk(0,2,1,true),true);
 assert.equal(s.api.canWalk(0,4,1,true),false,'la puerta de parcela no se proyecta abierta');
 assert.equal(s.api.openDoor({floor:0,x:2,z:1,from:{floor:0,x:1.5,z:1}}),true);
 assert.equal(s.ordinary.open,true);
 assert.equal(s.ordinary.passable,true);
 assert.equal(s.state.doors.hall.open,true,'la puerta se guarda como para el jugador');
 assert.equal(s.api.canWalk(0,2,1),true);
 assert.equal(s.api.openDoor({floor:0,x:4,z:1,from:{floor:0,x:3.5,z:1}}),false);
 assert.equal(s.property.open,false);
});
test('El GOAP de motor respeta cerradura, mirilla y distancia real del NPC',()=>{
 const s=scene(),action={floor:0,x:2,z:1,from:{floor:0,x:1.5,z:1}};
 s.ordinary.locked=true;
 assert.equal(s.api.canWalk(0,2,1,true),false);
 assert.equal(s.api.openDoor(action),false);
 s.ordinary.locked=false;s.ordinary.kind='peephole_door';
 assert.equal(s.api.openDoor(action),false);
 s.ordinary.kind='door';
 assert.equal(s.api.openDoor({...action,from:{floor:0,x:0,z:1}}),false,'nunca abre desde lejos');
 s.ordinary.stairBlockFlag='denied';s.state.flags.denied=true;
 assert.equal(s.api.openDoor(action),false);
});
test('Una puerta abierta en otro piso actualiza la colisión aunque no se anime allí',()=>{
 const s=scene();s.context.currentFloor=1;
 assert.equal(s.api.openDoor({floor:0,x:2,z:1,from:{floor:0,x:1.5,z:1}}),true);
 assert.equal(s.ordinary.angle,1.2);
 assert.equal(s.ordinary.passable,true);
});
