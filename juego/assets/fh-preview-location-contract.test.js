/* Regresión del contrato editor -> motor 3D. Ejecutar con Node.js. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const H=require('./fh-location-hud.js');
const P=require('./fh-style-property.js');
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const begin=html.indexOf('function makeCurrent3DProject(){');
const end=html.indexOf('\nfunction show3DStatus(',begin);
assert(begin>=0&&end>begin,'No se encuentra makeCurrent3DProject en el editor');
const makePreview=new Function('project','clone','ForestShared','readStorage','buildingSlabs','SCHEMA','window',
 html.slice(begin,end)+'\nreturn makeCurrent3DProject();');
const clone=v=>JSON.parse(JSON.stringify(v));
const polygon=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const walls=polygon(0,0,5,5).map((a,i,points)=>({
 id:'wall'+i,type:'red_wall',a,b:points[(i+1)%points.length]
}));
const project={
 schema:'forest-horror-map-v1',version:2,title:'Blakpine Wood',
 units:{feetPerCell:5,columns:20,rows:20},
 floors:[{id:'floor1',name:'Piso 1',elevationFt:0,ceilingHeightFt:11.5,
  items:walls,apartments:[]}],
 properties:[],
 locationZones:[{id:'zone_parking',floorId:'floor1',kind:'exterior',name:'Estacionamiento',
  polygon:polygon(7,7,5,5)}],
 buildingNames:{floor1_building_1:'Apartamentos'}
};
const preview=makePreview(project,clone,{gameSaveKey:()=> 'test'},()=>null,()=>({enabled:false,spans:[]}),
 project.schema,{FHAreaMerge:null});
assert.deepEqual(preview.locationZones,project.locationZones,'Debe transferir zonas con nombres y polígonos');
assert.deepEqual(preview.buildingNames,project.buildingNames,'Debe transferir nombres de edificios');
assert.notStrictEqual(preview.locationZones,project.locationZones,'No reutilizar arreglos editables del proyecto');
const outside=H.resolve(preview,0,{x:8,y:8},P);
assert.deepEqual([outside.kind,outside.floorCode,outside.primary,outside.secondary],
 ['exterior','','EXTERIOR','Estacionamiento']);
const inside=H.resolve(preview,0,{x:2,y:2},P);
assert.deepEqual([inside.kind,inside.floorCode,inside.primary],
 ['building','F1','Apartamentos']);
const old={...project,locationZones:undefined,buildingNames:undefined};
const legacy=makePreview(old,clone,{gameSaveKey:()=> 'test'},()=>null,()=>({enabled:false,spans:[]}),
 project.schema,{FHAreaMerge:null});
assert.deepEqual(legacy.locationZones,[]);
assert.deepEqual(legacy.buildingNames,{});
console.log('PASS contrato editor → 3D: zona exterior, nombre de edificio y mapa antiguo');
