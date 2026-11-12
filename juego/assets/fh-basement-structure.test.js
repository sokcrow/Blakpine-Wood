const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const B=require('./fh-basement-structure.js');
const wall=(id,a,b)=>({id,type:'red_wall',a,b,heightFt:9});
const sourceWalls=[
 wall('north',{x:4,y:4},{x:20,y:4}),
 wall('east',{x:20,y:4},{x:20,y:20}),
 wall('south',{x:20,y:20},{x:4,y:20}),
 wall('west',{x:4,y:20},{x:4,y:4})
];
function project(){
 return {schema:'forest-horror-map-v1',mainFloorId:'main',buildingSlabs:{enabled:true,spans:[{x:4,y:4,w:16,h:16}]},
 floors:[
  {id:'basement-2',elevationFt:-24,ceilingHeightFt:10,items:[]},
  {id:'basement-1',elevationFt:-12,ceilingHeightFt:11,items:[{id:'drain',type:'hall',x:5,y:5,w:10,h:10,drainage:{version:1,kind:'straight'}}]},
  {id:'main',elevationFt:0,items:[...sourceWalls,{id:'desk',type:'table',x:7,y:7}]},
  {id:'upper',elevationFt:12,items:[]}
 ]};
}
test('sótanos heredan la huella de la planta principal si no tienen contorno propio',()=>{
 const p=project(),ground={enabled:true,spans:[{x:4,y:4,w:16,h:16}]},empty={enabled:false,spans:[]};
 const slabs=B.resolveSlabs(p,i=>i===2?ground:empty);
 assert.deepEqual(slabs[0].spans,ground.spans);
 assert.deepEqual(slabs[1].spans,ground.spans);
 assert.equal(slabs[2],null);
 assert.equal(slabs[3],null);
 assert.notEqual(slabs[0].spans,ground.spans,'No muta el contorno de planta baja');
});
test('contorno de sótano propio prevalece frente al de planta baja',()=>{
 const p=project(),own={enabled:true,spans:[{x:2,y:2,w:8,h:8}]},
  main={enabled:true,spans:[{x:4,y:4,w:16,h:16}]},empty={enabled:false,spans:[]};
 const slabs=B.resolveSlabs(p,i=>i===0?own:i===2?main:empty);
 assert.deepEqual(slabs[0].spans,own.spans);
 assert.deepEqual(slabs[1].spans,main.spans);
});
test('motor reutiliza muros nativos de la planta principal sin copiar mobiliario',()=>{
 const data=project(),stored=JSON.stringify(data);
 B.expandProject(data);
 for(const i of [0,1]){
  const walls=data.floors[i].items.filter(it=>it.basementInherited===true);
  assert.equal(walls.length,4);
  assert.ok(walls.every(it=>it.type==='wall'&&it.blocksMovement===true&&it.sourceFloorId==='main'));
  assert.ok(walls.every(it=>it.heightFt===data.floors[i].ceilingHeightFt));
  assert.ok(!data.floors[i].items.some(it=>it.id==='desk'),'Sin mobiliario copiado');
 }
 B.expandProject(data);
 assert.equal(data.floors[0].items.filter(it=>it.basementInherited).length,4,'idempotente');
 assert.equal(data.floors[1].items.find(it=>it.id==='drain').type,'hall','Drenajes intactos');
 assert.equal(JSON.stringify(project()),stored,'Datos de origen intactos');
});
test('sótano con perímetro rojo propio no recibe paredes duplicadas',()=>{
 const data=project();
 data.floors[0].items.push(wall('own',{x:1,y:1},{x:8,y:1}));
 B.expandProject(data);
 assert.equal(data.floors[0].items.some(it=>it.basementInherited),false);
 assert.equal(data.floors[1].items.filter(it=>it.basementInherited).length,4);
});
test('mapas sin sótanos o sin perímetro estructural siguen igual',()=>{
 const map={floors:[{id:'main',elevationFt:0,items:[]}]};
 assert.equal(B.groundIndex(map),0);
 assert.deepEqual(B.resolveSlabs(map,()=>({enabled:true,spans:[{x:0,y:0,w:5,h:5}]})),[null]);
 assert.deepEqual(B.expandProject(map),map);
 const old=project();old.buildingSlabs.enabled=false;
 B.expandProject(old);assert.ok(!old.floors[0].items.some(it=>it.basementInherited));
 const incomplete=project();incomplete.floors[2].items=[sourceWalls[0]];incomplete.buildingSlabs={enabled:true,spans:[]};
 B.expandProject(incomplete);assert.equal(incomplete.floors[0].items.filter(it=>it.basementInherited).length,0,'Muro rojo suelto no se hereda sin huella cerrada');
});
test('editor y motor utilizan la misma huella subterránea y paredes nativas',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 assert.match(html,/fh-basement-structure\.js\?v=20261112-basement-native-1/);
 assert.match(html,/FHBasement\?\.resolveSlabs\(project,i=>buildingSlabs\(i\)\)/);
 assert.match(html,/FHBasement\?\.expandProject\(DATA\);\\nwindow\.FHDrainage\?\.expandProject\(DATA\)/);
 assert.ok(html.includes('DATA.basementSlabs?.[f]?.enabled'),'Losas de sótano generan suelo real');
 assert.ok(html.includes('floor<mainFloorIndex&&DATA.basementSlabs?.[floor]?.enabled'),'Colisiones usan la huella del sótano');
});

test('sótanos vacíos con huella válida cuentan como piso jugable y reciben posición segura',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 assert.match(html,/const isBuilt=DATA\.floors\.map\(\(f,i\)=>\(i<mainFloorIndex&&DATA\.basementSlabs\?\.\[i\]\?\.enabled&&DATA\.basementSlabs\[i\]\.spans\?\.length>0\)/);
 assert.match(html,/const slab=f<mainFloorIndex\?DATA\.basementSlabs\?\.\[f\]:SLABS\[f\]/);
 assert.match(html,/const sp=\(slab\?\.spans\|\|\[\]\)\.reduce\(/);
 const data=project();data.floors[0].items=[];
 const slabs=B.resolveSlabs(data,i=>i===2?{enabled:true,spans:[{x:4,y:4,w:16,h:16}]}:{enabled:false,spans:[]});
 assert.equal(slabs[0].enabled,true);
 assert.ok(slabs[0].spans.length>0);
 assert.equal((data.floors[0].items||[]).length,0,'No requiere muebles ni un spawn artificial');
 const largest=slabs[0].spans.reduce((best,part)=>!best||part.w*part.h>best.w*best.h?part:best,null);
 assert.deepEqual({x:largest.x+largest.w/2,y:largest.y+largest.h/2},{x:12,y:12});
});
