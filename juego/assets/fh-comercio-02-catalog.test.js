const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const catalog=require('../../forest-horror/biblioteca/catalogo_muebles.json');
const positions=require('./fh-surface-placement.js');
const data=catalog.furniture.filter(item=>item.pack==='comercio_02');
const byId=id=>data.find(item=>item.id===id);
const win={};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'fh-furniture-rules.js'),'utf8'),{window:win});
const rules=win.FHFurnitureRules;
const shared={
 defaultPropAnchors:()=>[],
 PROP_ACTIONS:{},
 interactionPreset:()=>({}),
};
test('Comercio 02: ocho recursos únicos, rutas legibles por selector y roles de receta',()=>{
 assert.equal(data.length,8);
 assert.ok(data.every(item=>item.forSale===false),'Los muebles de Comercio 02 no se venden en Hamazon');
 assert.equal(new Set(catalog.furniture.map(x=>x.id)).size,catalog.furniture.length);
 for(const item of data){
  assert.match(item.thumbnail,new RegExp('^miniaturas/'+item.id+'\\.png$'));
  assert.equal(item.glb,'modelos_glb/'+item.id+'.glb');
  assert.ok(item.widthFt>0&&item.depthFt>0&&item.heightFt>0);
 }
 assert.deepEqual(data.filter(x=>x.shopRole==='register').map(x=>x.id),['caja_registradora_c02']);
 assert.deepEqual(data.filter(x=>x.shopRole==='display').map(x=>x.id).sort(),
  ['exhibidor_frutas_c02','gondola_simple_c02','rack_snacks_c02']);
});
test('registradora admite mostrador y mantiene fallback en el suelo',()=>{
 const cell=5, register={id:'reg',type:'misc',x:0,y:0,rotation:0};
 const counter={id:'counter',type:'misc',x:0,y:0,rotation:0};
 rules.applyCatalogModel(register,byId('caja_registradora_c02'),shared,cell);
 rules.applyCatalogModel(counter,byId('mostrador_caja_c02'),shared,cell);
 assert.equal(register.placement,'floor_or_surface');
 assert.equal(register.shopRole,'register');
 assert.ok(rules.supportSurfacesFor(counter,cell).some(x=>x.id==='top'));
 const placed=positions.place(register,[counter,register],cell,(item,feet)=>rules.supportSurfacesFor(item,feet));
 assert.equal(placed.supported,true);
 assert.equal(positions.worldPose([counter,register],register,cell,(item,feet)=>rules.supportSurfacesFor(item,feet)).heightFt,3.25);
 positions.detach(register);register.x=10;register.y=10;
 assert.equal(positions.place(register,[counter,register],cell,(item,feet)=>rules.supportSurfacesFor(item,feet)).reason,'floor-fallback');
});
test('roles de la tienda viajan al JSON de mapa; muebles anteriores conservan comportamiento',()=>{
 const item={id:'a',type:'misc',x:1,y:1};
 rules.applyCatalogModel(item,byId('rack_snacks_c02'),shared,5);
 assert.equal(JSON.parse(JSON.stringify(item)).shopRole,'display');
 rules.applyCatalogModel(item,{id:'silla_madera',name:'Silla',widthFt:2,depthFt:2,heightFt:3},shared,5);
 assert.equal(item.shopRole,undefined);
});
