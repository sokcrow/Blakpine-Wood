'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {allows,tools}=require('../juego/assets/fh-catalog-compatibility.js');
const furnitureCatalog=require('../forest-horror/biblioteca/catalogo_muebles.json');
const architectureCatalog=require('../forest-horror/biblioteca/arquitectura/catalogo_arquitectura.json');

test('las excepciones tecnológicas de D&D son optativas y respetan la ambientación',()=>{
 const modern={technology:'electronics'};
 assert.equal(allows(modern,{mode:'dnd'}),false);
 assert.equal(allows(modern,{mode:'dnd',technologyExceptions:['electrical']}),false);
 assert.equal(allows(modern,{mode:'dnd',technologyExceptions:['electronics']}),true);
 assert.equal(allows({...modern,settings:['modern']},{mode:'dnd',technologyExceptions:['electronics']}),false);
 assert.equal(allows({settings:['modern','medieval-fantasy']},{mode:'dnd'}),true);
 assert.equal(allows(undefined,{mode:'dnd'}),true);
 assert.equal(allows(tools.power_outlet),true);
 assert.equal(allows(tools.power_outlet,{mode:'dnd'}),false);
 assert.equal(allows(tools.power_outlet,{mode:'moon-system'}),true);
});

test('los catálogos originales conservan los IDs y admiten los muebles compartidos',()=>{
 const available=new Set();
 for(const [items,compatibility] of [
  [furnitureCatalog.furniture,furnitureCatalog.compatibility],
  [architectureCatalog.architecture,architectureCatalog.compatibility]
 ]){
  const ids=new Set(items.map(item=>item.id));
  for(const id of Object.keys(compatibility))assert.ok(ids.has(id),id);
  for(const id of ids){
   assert.equal(allows(compatibility[id],{mode:'legacy'}),true,id);
   assert.equal(allows(compatibility[id],{mode:'moon-system'}),true,id);
   if(allows(compatibility[id],{mode:'dnd'}))available.add(id);
  }
 }
 for(const id of ['mesa_pequena','silla_madera','cama_individual','estante_bajo','puerta_madera'])
  assert.ok(available.has(id),id);
 for(const id of ['gabinete_pc','microondas','cabina_ducha','puerta_electronica_opaca','teclado_pin'])
  assert.ok(!available.has(id),id);
});

test('las siete categorías medievales definen fuentes sin GLB con campos del motor común',()=>{
 const context=vm.createContext({});
 context.window=context;
 for(const file of ['fh-light-strings.js','fh-medieval-light-catalog.js','fh-lights.js']){
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../juego/assets',file),'utf8'),context);
 }
 const {categories,sources}=context.FHMedievalLightCatalog;
 assert.equal(Object.keys(categories).length,7);
 assert.equal(new Set(sources.map(source=>source.id)).size,8);
 assert.equal(new Set(sources.map(source=>source.category)).size,7);
 for(const source of sources){
  assert.equal(allows(source.compatibility,{mode:'dnd'}),true);
  for(const mode of ['legacy','moon-system'])assert.equal(allows(source.compatibility,{mode}),false);
  assert.ok(categories[source.category]&&source.label,source.id);
  assert.equal(source.glb,null);
  assert.equal(source.defaults.lightOn,false);
  assert.equal(source.defaults.durationSeconds,null);
  assert.ok(source.defaults.fuel===null||source.defaults.fuel.kind);
  assert.ok(source.defaults.lightRadiusFt>=5);
  assert.equal(context.FHLights.dimFalloffFt(source.defaults),source.defaults.lightDimFalloffFt);
 }
});
