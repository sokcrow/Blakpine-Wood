'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const R=require('../juego/assets/fh-roof.js'),THREE=require('../juego/assets/vendor/three.min.js');
const rect=(x,y,w,h)=>({x,y,w,h}),slab=spans=>({enabled:true,spans}),area=spans=>spans.reduce((n,r)=>n+r.w*r.h,0);
const dnd={rulesetId:'dnd'};
const identity={identity:{rulesetId:'dnd'}};
test('defaults por reglamento: sólo D&D nuevo usa automático; configuraciones explícitas se conservan',()=>{
 assert.equal(R.settings().shape,'flat');assert.equal(R.settings(undefined,'dnd').shape,'auto');
 for(const shape of ['flat','gable','auto'])assert.equal(R.settings({shape},'dnd').shape,shape);
 assert.equal(R.settings(undefined,'legacy').shape,'flat');
 assert.equal(R.settings(undefined,'moon-system').shape,'flat');
 assert.equal(R.plan(slab([rect(0,0,6,4)]),null,{shape:'auto'}).shape,'flat');
});
test('casa rectangular sin piso superior tiene un solo tejado, aunque la losa tenga varias piezas',()=>{
 const source=slab([rect(0,0,6,2),rect(0,2,3,2),rect(3,2,3,2)]),before=JSON.stringify(source);
 const plan=R.plan(source,null,undefined,dnd);
 assert.equal(plan.sections.length,1);assert.equal(plan.sections[0].shape,'gable');
 assert.deepEqual(plan.sections[0].spans,[rect(0,0,6,4)]);
 assert.equal(JSON.stringify(source),before,'sin modificar losas');
 const geometry=R.gableGeometry(THREE,plan.sections[0].spans[0],plan.sections[0],1.524,.021);
 geometry.computeBoundingBox();assert.ok(geometry.boundingBox.max.y>1);
 assert.equal(geometry.groups.filter(g=>g.materialIndex===1).length,2,'frontones triangulares');
});
test('retranqueo con planta superior produce balcón plano y tapa superior a dos aguas',()=>{
 const lower=slab([rect(0,0,10,8)]),upper=slab([rect(0,0,6,8)]);
 const map={mainFloorId:'pb',__multimodeSave:identity,floors:[
  {id:'pb',elevationFt:0,ceilingHeightFt:10,roof:{shape:'auto'}},
  {id:'up',elevationFt:10,ceilingHeightFt:10,roof:{shape:'auto'}}],roofSlabsByFloor:[lower,upper]};
 const before=JSON.stringify(map),runtime=structuredClone(map);R.prepareRuntime(runtime,'Cubierta');
 assert.equal(JSON.stringify(map),before);assert.equal(runtime.floors.length,3);
 const plans=R.plans(runtime,[{},lower,upper]);
 assert.equal(plans[1].sections[0].shape,'flat');assert.equal(area(plans[1].spans),32);
 assert.equal(area(plans[1].interiorSpans),48);
 assert.equal(plans[2].sections[0].shape,'gable');assert.equal(area(plans[2].spans),48);
 assert.ok(!plans[1].sections[0].edges.some(e=>e.a.x===6&&e.b.x===6),'sin pretil contra la casa');
});
test('casas separadas resuelven su cubierta de forma independiente y no se unen por una esquina',()=>{
 const source=slab([rect(0,0,8,8),rect(12,0,4,4),rect(16,4,3,3)]),upper=slab([rect(0,0,4,8)]);
 const plan=R.plan(source,upper,{shape:'auto'},dnd);
 assert.deepEqual(plan.sections.map(s=>s.shape),['flat','gable','gable']);
 assert.equal(area(plan.sections.flatMap(s=>s.spans)),32+16+9);
});
test('patios y plantas en L conservan exactamente los huecos de las losas',()=>{
 const courtyard=R.difference([rect(0,0,10,10)],[rect(3,3,4,4)]);
 for(const spans of [courtyard,[rect(0,0,6,2),rect(0,2,2,4)]]){
  const plan=R.plan(slab(spans),null,{shape:'auto'},dnd);
  const covered=plan.sections.flatMap(s=>s.spans);
  assert.equal(area(covered),area(spans));assert.deepEqual(R.difference(covered,spans),[]);
  assert.deepEqual(R.difference(spans,covered),[]);
 }
});
test('mapas v1 planos, cubiertas desactivadas y lectura Legacy conservan su comportamiento',()=>{
 for(const value of [{shape:'flat'}, {shape:'gable'}, {enabled:false}]){
  const map={schema:'forest-horror-map-v1',__multimodeSave:identity,floors:[{id:'pb',roof:value},{id:'top'}]};
  const before=JSON.stringify(map),plans=R.plans(map,[{},slab([rect(0,0,4,4)])]);
  if(value.enabled===false)assert.equal(plans[1],null);else{
   assert.equal(plans[1].shape,value.shape);assert.equal(plans[1].sections,undefined);
  }
  assert.equal(JSON.stringify(map),before);
 }
 const old={schema:'forest-horror-map-v1',floors:[{id:'pb'},{id:'top'}]};
 const planes=R.plans(old,[{},slab([rect(0,0,4,4)])]);
 assert.equal(planes[1].shape,'flat');assert.equal(planes[1].sections,undefined);
});
test('floorDefault y create de Lumen conservan la selección D&D incluso sin catálogo opcional',()=>{
 const html=fs.readFileSync('index.html','utf8'),source=html.match(/const floorDefault=([^\n]+);\n/)[1];
 for(const lumenCartridgeMode of [false,true])for(const rulesetId of ['legacy','dnd']){
  const env={window:{FHRoof:R,FH_MAP_GRID_TEXT:{noReference:''},
   FHEditorCatalog:lumenCartridgeMode?undefined:{ruleset:()=>rulesetId}},
   lumenCartridgeMode,lumenEditorRuleset:rulesetId};
  const floor=vm.runInNewContext('('+source+')',env)('pb','PB',0,0);
  assert.equal(floor.roof.shape,rulesetId==='dnd'?'auto':'flat');
  assert.equal(floor.items.length,0);assert.equal(floor.elevationFt,0);
 }
});
test('panel ofrece automático y conserva shape al guardar con permisos y undo del editor',()=>{
 const fields=new Map(),floor={name:'PB'},env={window:{FHRoof:R,FHEditorCatalog:{ruleset:()=> 'dnd'},
  FH_ROOF_TEXT:{},FH_STYLE_TEXT:{floorPresets:[],wallPresets:[]},FHStyleRuntime:{preview(){}}},
  current:()=>floor,escapeAttr:s=>String(s??''),project:{},document:{getElementById:id=>fields.get(id)},
  record:()=>{env.records++;},records:0,closeModal(){},toast(){},modal(html,setup){
   assert.match(html,/value="auto" selected/);
   for(const [,id] of html.matchAll(/id="([^"]+)"/g))fields.set(id,{value:'',checked:false});
   for(const [id,value] of Object.entries({'roof-shape':'auto','roof-height':'.25','roof-rise':'4','roof-ridge':'auto','roof-coverColor':'#A45B46','roof-floor-preset':'madera','roof-floor-color':'#886644','roof-wall-preset':'ladrillo','roof-wall-color':'#A34D43'}))fields.get(id).value=value;
   fields.get('roof-enabled').checked=true;setup();
  }};
 vm.runInNewContext(fs.readFileSync('juego/assets/fh-roof-editor.js','utf8'),env);
 env.window.FHRoofEditor.open();assert.equal(fields.get('roof-height').disabled,false);assert.equal(fields.get('roof-rise').disabled,false);
 fields.get('roof-save').onclick();assert.equal(env.records,1);assert.equal(floor.roof.shape,'auto');
 fields.get('roof-rise').value='';fields.get('roof-save').onclick();assert.equal(env.records,1);
});
test('render real mezcla balcón plano y tejado, comparte materiales y conserva el corte exterior',()=>{
 const sandbox={window:{document:{baseURI:'https://example.test/'}},URL};vm.createContext(sandbox);
 for(let i=0;i<13;i++)vm.runInContext(fs.readFileSync('juego/assets/engine-'+String(i).padStart(2,'0')+'.js','utf8'),sandbox);
 vm.runInContext(fs.readFileSync('juego/assets/fh-roof-engine-hook.js','utf8'),sandbox);
 const original=Buffer.from(sandbox.window.__FOREST_EMBEDDED_ENGINE__,'base64').toString('utf8');
 const patched=sandbox.window.FHRoofEngine.patch(original);
 const from=patched.indexOf(' const roof=FH_ROOF_PLANS[f];',patched.indexOf('function buildFloor(f)')),
  until=patched.indexOf(' const areaMaterials=',from);
 const source=slab([rect(0,0,8,8),rect(12,0,4,4)]),upper=slab([rect(0,0,4,8)]);
 const runtime={THREE,CELL:1.524,HEIGHT:2.74,WALL_THICK:.13,DATA:{floors:[{id:'roof'}]},
  stories:[new THREE.Group()],walls:[[]],blockers:[[]],sightWalls:[[]],occlusionRoots:[[]],
  pixelBoxGeometry:(w,h,d)=>new THREE.BoxGeometry(w,h,d),trackSegmentSight:(f,mesh)=>mesh,
  MAT:{wall:new THREE.MeshLambertMaterial(),wood:new THREE.MeshLambertMaterial(),edge:new THREE.MeshLambertMaterial()},
  document:{createElement:()=>({getContext:()=>({fillRect(){}})})},
  surfaceRectsMinusVoids:(f,x,y,w,h)=>[{x,y,w,h}],
  FH_ROOF_PLANS:[R.plan(source,upper,{shape:'auto'},dnd)],fhRoofObjects:[[]],SLABS:[source],f:0,FHRoof:R};
 runtime.window=runtime;const context=vm.createContext(runtime);
 for(const file of ['fh-style-property.js','fh-style-renderer.js'])vm.runInContext(fs.readFileSync('juego/assets/'+file,'utf8'),context);
 vm.runInContext(original.split('\n').find(line=>line.startsWith('function registerCutaway(')),context);
 vm.runInContext(original.slice(original.indexOf('function world(p){'),original.indexOf('function tileTexture(){')),context);
 vm.runInContext(patched.slice(from,until),context);
 const meshes=runtime.stories[0].children;
 assert.equal(meshes.filter(m=>m.userData.fhRoofGable).length,1);
 assert.equal(meshes.filter(m=>m.userData.fhStructuralSlab).length,1);
 assert.equal(meshes.filter(m=>m.userData.fhRoofParapet).length,3,'sólo balcón y sin borde contra la planta superior');
 assert.equal(runtime.blockers[0].length,3);assert.equal(runtime.sightWalls[0].length,0);
 assert.ok(runtime.fhRoofObjects[0].every(({source})=>runtime.occlusionRoots[0].includes(source)));
 const start=patched.indexOf('for(let f=0;f<fhRoofObjects.length;f++)'),end=patched.indexOf('// Perfil del borde de la losa:',start);
 Object.assign(runtime,{exteriorLayers:[new THREE.Group()],floorElev:[3.048],exteriorProxies:[],exteriorCutawayRoots:[]});
 vm.runInContext(patched.slice(start,end),context);
 assert.equal(runtime.exteriorProxies.length,5);
 assert.ok(runtime.exteriorProxies.every(({source,clone})=>source.material===clone.material));
 assert.equal(runtime.exteriorProxies.filter(({clone})=>clone.userData.fhRoofGable).length,1);
});
test('motor completo conserva sintaxis con cubiertas, flamas, guardado D&D y adaptadores de arquitectura',()=>{
 const html=require('./helpers/forest-engine.cjs')().html,
  medieval=require('../juego/assets/fh-medieval-light-engine.js'),save=require('../juego/core/fh-multimode-save-hook.js');
 const result=save.patch(medieval.patchEngineDoc(html,'https://example.test/'),'https://example.test/');
 for(const match of result.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))
  if(!/src=|application\/json/.test(match[1]))new vm.Script(match[2]);
 assert.ok(result.includes('const roof=part;'));
 assert.ok(result.includes('const SAVE_KEY=fhMultimode?fhMultimode.key:fhRoofSaveKey;'));
});
test('el validador y cargador v1 reales conservan automático y acabados sin migrar la arquitectura',()=>{
 const html=fs.readFileSync('index.html','utf8'),from=html.indexOf('const ForestShared=(()=>{'),to=html.indexOf("\n'use strict';",from);
 const shared=vm.runInNewContext(html.slice(from,to)+';ForestShared');
 const map=JSON.parse(fs.readFileSync('forest-horror/maps/DEMO_DnD_Iluminacion.json','utf8'));
 map.floors[0].roof=R.settings({shape:'auto',riseFt:7,coverColor:'#884422'});
 const before=JSON.stringify(map),loaded=shared.loadProject(map);
 assert.equal(shared.validate(loaded).ok,true);
 assert.equal(loaded.schema,'forest-horror-map-v1');assert.equal(loaded.floors[0].roof.shape,'auto');
 assert.equal(loaded.floors[0].roof.riseFt,7);assert.equal(loaded.floors[0].roof.coverColor,'#884422');
 assert.equal(JSON.stringify(map),before);assert.equal(JSON.stringify(loaded.floors[0].items),JSON.stringify(map.floors[0].items));
});
