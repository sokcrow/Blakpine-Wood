'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const grid=require('./fh-exterior-grid.js');
const base=path.join(__dirname,'../../forest-horror/biblioteca');
const catalog=JSON.parse(fs.readFileSync(path.join(base,'catalogo_muebles.json'),'utf8')).furniture;
const epsilon=1e-7;

test('seis postes: hitbox del tubo de aproximadamente un pie, sin incluir brazos ni transformadores altos',()=>{
 const expected={
  poste_luz_madera:[1.1,1.0],poste_luz_concreto:[1.3,1.3],
  poste_luz_con_brazo:[1.15,1.15],poste_luz_doble_brazo:[1.15,1.15],
  transformador_poste_simple:[1.1,1.0],transformador_poste_doble:[1.3,1.3]
 };
 assert.equal(Object.keys(grid.POLE_COLLISION).length,6);
 for(const [id,[w,d]] of Object.entries(expected)){
  const entry=catalog.find(x=>x.id===id),spec=grid.POLE_COLLISION[id];
  assert.ok(entry&&spec,id);
  assert.equal(spec.widthFt,w);assert.equal(spec.depthFt,d);
  assert.ok(spec.widthFt<entry.widthFt&&spec.depthFt<entry.depthFt,id);
  const item={id,modelId:id,w:entry.widthFt/5,h:entry.depthFt/5};
  assert.equal(grid.compactFootprint(item,5),true,id);
  assert.ok(Math.abs(item.w-w/5)<epsilon&&Math.abs(item.h-d/5)<epsilon,id);
  assert.equal(grid.compactFootprint(item,5),false,'no se repite la conversión');
 }
 assert.equal(grid.POLE_COLLISION.poste_luz_con_brazo.baseOffsetXFt,-2.28);
 assert.equal(grid.POLE_COLLISION.transformador_poste_simple.baseOffsetXFt,-1.56);
});

test('mapas antiguos se compactan una sola vez, pero muebles y medidas personalizadas se conservan',()=>{
 const old=catalog.find(x=>x.id==='poste_luz_doble_brazo');
 const item={id:'viejo',type:'misc',modelId:old.id,x:5,y:5,w:old.widthFt/5,h:old.depthFt/5};
 const custom={id:'custom',type:'misc',modelId:old.id,x:6,y:6,w:.51,h:.39};
 const sofa={id:'sofa',type:'sofa',modelId:'sofa',x:2,y:2,w:2,h:1};
 const project={schema:'forest-horror-map-v1',units:{feetPerCell:5},floors:[{id:'pb',items:[item,custom,sofa]}]};
 const beforeCustom=JSON.stringify(custom),beforeSofa=JSON.stringify(sofa);
 assert.equal(grid.compactMapFootprints(project),1);
 assert.equal(item.w,1.15/5);assert.equal(item.h,1.15/5);
 assert.equal(grid.compactMapFootprints(project),0);
 assert.equal(JSON.stringify(custom),beforeCustom);
 assert.equal(JSON.stringify(sofa),beforeSofa);
 assert.equal(project.schema,'forest-horror-map-v1');
});

test('el selector genérico de muebles también crea el poste con su hitbox estrecha',()=>{
 const source=fs.readFileSync(path.join(__dirname,'fh-furniture-rules.js'),'utf8');
 const win={FHExteriorGrid:grid};
 vm.runInNewContext(source,{window:win});
 const entry=catalog.find(x=>x.id==='poste_luz_con_brazo'),item={id:'nuevo',type:'misc'};
 win.FHFurnitureRules.applyCatalogModel(item,entry,{PROP_ACTIONS:{}},5);
 assert.equal(item.modelId,entry.id);assert.equal(item.type,'misc');
 assert.equal(item.w,1.15/5);assert.equal(item.h,1.15/5);
 assert.equal(item.blocksMovement,true);
});

test('la colisión compartida deja pasar junto al brazo y bloquea el tubo',()=>{
 const index=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 const geometry=index.slice(index.indexOf('function rectangleLocal('),index.indexOf('\n// shared/doors.js'));
 const start=index.indexOf('function solidAt(');
 const collision=index.slice(start,index.indexOf('\n// Geometría del ascensor',start));
 assert.ok(geometry.startsWith('function rectangleLocal('));assert.ok(collision.startsWith('function solidAt('));
 const sandbox={};vm.runInNewContext(geometry+'\n'+collision+'\nthis.solidAt=solidAt;',sandbox);
 const item={id:'p',type:'misc',modelId:'poste_luz_con_brazo',x:5,y:5,w:7.25/5,h:2.25/5,blocksMovement:true};
 grid.compactFootprint(item,5);
 const ctx={width:20,height:20,radius:.19,objects:[item],objectMode:'circle'};
 assert.equal(sandbox.solidAt(5,5,ctx),true,'el tubo es sólido');
 assert.equal(sandbox.solidAt(5.6,5,ctx),false,'el espacio bajo el brazo queda transitable');
 assert.equal(sandbox.solidAt(5,5.6,ctx),false,'puede caminar detrás del tubo');
});
