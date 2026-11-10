'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const R=require('./fh-roof.js');
const slab=spans=>({enabled:true,spans});
const box=(x,y,w,h)=>({x,y,w,h});
const area=spans=>spans.reduce((n,r)=>n+r.w*r.h,0);
const length=edges=>edges.reduce((n,e)=>n+Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y),0);
test('concreto, pretil rojo de .25 tile y normalización segura',()=>{
 const d=R.settings();assert.equal(d.floor.preset,'concreto');assert.equal(d.wall.color,'#A34D43');assert.equal(d.parapetHeightTiles,.25);
 assert.equal(R.settings({parapetHeightTiles:0}).parapetHeightTiles,0);
 assert.equal(R.settings({parapetHeightTiles:NaN}).parapetHeightTiles,.25);
 assert.equal(R.settings({parapetHeightTiles:Infinity}).parapetHeightTiles,.25);
 assert.equal(R.settings({parapetHeightTiles:4}).parapetHeightTiles,2);
 assert.equal(R.settings({floor:{preset:'x',color:'red'}}).floor.preset,'concreto');
});
test('unión de spans: sólo perímetro, nunca paredes en costuras',()=>{
 const spans=[box(0,0,8,2),box(0,2,3,4),box(3,2,5,4)];
 const p=R.plan(slab(spans),null,R.settings());
 assert.equal(area(p.spans),48);assert.equal(length(p.edges),28);
 assert.ok(!p.edges.some(e=>e.a.x===3&&e.b.x===3));
});
test('patio abierto y edificio en L conservan sus huecos',()=>{
 const spans=R.difference([box(0,0,10,10)],[box(3,3,4,4)]);
 const p=R.plan(slab(spans),null,R.settings());
 assert.equal(area(p.spans),84);assert.equal(length(p.edges),56);
 assert.equal(length(R.boundary([box(0,0,6,2),box(0,2,2,4)])),24);
});
test('retranqueo: concreto sólo en terraza, sin pretil contra el muro superior',()=>{
 const p=R.plan(slab([box(0,0,10,10)]),slab([box(0,0,6,10)]),R.settings());
 assert.equal(area(p.spans),40);assert.equal(length(p.edges),18);
 assert.ok(!p.edges.some(e=>e.a.x===6&&e.b.x===6));
 const full=R.plan(slab([box(0,0,10,10)]),slab([box(0,0,10,10)]),R.settings());
 assert.equal(full.spans.length,0);assert.equal(full.edges.length,0);
});
test('sólo la desactivación explícita conserva el acabado anterior sin pretil',()=>{
 assert.equal(R.plan(slab([box(0,0,3,3)]),null,{enabled:false}),null);
 const old={floors:[{id:'pb',items:[],roof:{enabled:false}}],roofSlabsByFloor:[slab([box(0,0,3,3)])]};
 const original=JSON.stringify(old);R.prepareRuntime(old,'Azotea');assert.equal(JSON.stringify(old),original);
});
test('tapa final sólo en runtime, es idempotente y respeta altura y sótano',()=>{
 const data={mainFloorId:'pb',floors:[{id:'basement',elevationFt:-10,ceilingHeightFt:10},
  {id:'pb',elevationFt:0,ceilingHeightFt:11.5,roof:R.settings()}],
  roofSlabsByFloor:[null,slab([box(1,1,6,6)])]};
 const source=JSON.stringify(data),runtime=JSON.parse(source);
 R.prepareRuntime(runtime,'Azotea');assert.equal(runtime.floors.length,3);
 assert.equal(runtime.floors[2].elevationFt,11.5);assert.equal(JSON.stringify(data),source);
 R.prepareRuntime(runtime,'Azotea');assert.equal(runtime.floors.length,3);
 const plans=R.plans(runtime,[{enabled:false},{enabled:false},runtime.slabsByLevel[1]]);
 assert.equal(plans[0],null);assert.equal(plans[1],null);assert.equal(area(plans[2].spans),36);
});
test('colores y altura sobreviven a JSON; configuración independiente por planta',()=>{
 const config=R.settings({parapetHeightTiles:.5,floor:{preset:'baldosa',color:'#121212'},wall:{preset:'concreto',color:'#eeeeee'}});
 const data=JSON.parse(JSON.stringify({floors:[{id:'pb',roof:config},{id:'up',roof:R.settings()},{id:'top'}]}));
 const p=R.plans(data,[{},slab([box(0,0,2,2)]),slab([box(3,3,2,2)])]);
 assert.equal(p[1].floor.color,'#121212');assert.equal(p[1].wall.color,'#EEEEEE');
 assert.equal(p[1].parapetHeightTiles,.5);assert.equal(p[2].parapetHeightTiles,.25);
});
test('hook real del motor genera JS válido y reutiliza colisión y corte',()=>{
 const env={window:{document:{baseURI:'https://example.test/'}} ,URL};vm.createContext(env);
 for(let i=0;i<13;i++)vm.runInContext(fs.readFileSync(__dirname+'/engine-'+String(i).padStart(2,'0')+'.js','utf8'),env);
 vm.runInContext(fs.readFileSync(__dirname+'/fh-roof-engine-hook.js','utf8'),env);
 const original=Buffer.from(env.window.__FOREST_EMBEDDED_ENGINE__,'base64').toString('utf8');
 const out=env.window.FHRoofEngine.patch(original);
 assert.match(out,/wallModel\(f,edge.a,edge.b,\{height,y:.021,mat,it:item,opaque:height>=1.75\}\)/);
 assert.match(out,/roof.parapetHeightTiles\*CELL/);assert.match(out,/registerCutaway\(f,mesh\)/);
 assert.match(out,/const SAVE_KEY=fhRoofSaveKey;/);
 const data={floors:[{id:'pb',name:'PB',elevationFt:0,ceilingHeightFt:10,roof:R.settings()}],roofSlabsByFloor:[slab([box(0,0,2,2)])]};
 env.window.parent=env.window;env.window.ForestHorrorLoadedMap=data;env.window.FHRoof=R;env.window.FH_ROOF_TEXT={cap:'Azotea'};
 env.ForestShared={gameSaveKey:map=>map.floors.map(f=>f.id).join('|')};
 const begin=out.indexOf('const DATA=window.ForestHorrorLoadedMap;'),end=out.indexOf('ForestShared.loadProject(DATA);',begin);
 vm.runInContext(out.slice(begin,end),env);
 assert.equal(data.floors.length,2);assert.equal(vm.runInContext('fhRoofSaveKey',env),'pb');
 assert.doesNotThrow(()=>new vm.Script(out.slice(out.lastIndexOf('<script>')+8,out.lastIndexOf('</script>'))));
 assert.throws(()=>env.window.FHRoofEngine.patch('bad'),/incompatible/);
});
test('un piso superior con techo desactivado conserva su interior, sin pretil inferior superpuesto',()=>{
 const same=slab([box(0,0,5,5)]);
 const data={floors:[{id:'pb',roof:R.settings()},{id:'up',roof:{enabled:false}}],roofSlabsByFloor:[same,same]};
 assert.equal(R.plans(data,[{},same])[1].spans.length,0);
});
test('el panel guarda la altura y acabados, valida entradas y respeta permisos',()=>{
 const fields=new Map(),floor={name:'PB',roof:R.settings()},messages=[];
 let saved=0,closed=0;
 const env={window:{FHRoof:R,FH_ROOF_TEXT:{},FH_STYLE_TEXT:{floorPresets:[['concreto','Concreto']],wallPresets:[['ladrillo','Ladrillo']]},
  FHStyleRuntime:{preview(){}},FHStyleEditor:{hasActor:()=>false}},project:{},current:()=>floor,
  escapeAttr:s=>String(s??''),record:()=>saved++,closeModal:()=>closed++,toast:s=>messages.push(s),
  document:{getElementById:id=>fields.get(id)},modal:(html,setup)=>{
   for(const [,id] of html.matchAll(/id="([^"]+)"/g))fields.set(id,{value:'',checked:false});
   fields.get('roof-height').value='.5';fields.get('roof-enabled').checked=true;
   fields.get('roof-floor-preset').value='concreto';fields.get('roof-floor-color').value='#666666';
   fields.get('roof-wall-preset').value='ladrillo';fields.get('roof-wall-color').value='#cc3333';setup();
  }};
 vm.runInNewContext(fs.readFileSync(__dirname+'/fh-roof-editor.js','utf8'),env);
 env.window.FHRoofEditor.open();fields.get('roof-save').onclick();
 assert.equal(saved,1);assert.equal(closed,1);assert.equal(floor.roof.parapetHeightTiles,.5);
 assert.equal(floor.roof.floor.color,'#666666');assert.equal(floor.roof.wall.color,'#CC3333');
 fields.get('roof-height').value='';fields.get('roof-save').onclick();assert.equal(saved,1);
 fields.get('roof-height').value='-1';fields.get('roof-save').onclick();assert.equal(saved,1);
 fields.get('roof-height').value='0';fields.get('roof-save').onclick();assert.equal(floor.roof.parapetHeightTiles,0);
 env.window.FHStyleEditor.hasActor=()=>true;fields.get('roof-save').onclick();assert.equal(saved,2);
});
test('record, undo y exportación real conservan la configuración sin inventar pisos de editor',()=>{
 const html=fs.readFileSync(__dirname+'/../../index.html','utf8');
 const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
 const floor={id:'pb',name:'PB',items:[],roof:R.settings(),elevationFt:0,ceilingHeightFt:10,reference:{}};
 const env={project:{schema:'forest-horror-map-v1',units:{},floors:[floor]},window:{},floorIndex:0,
  rememberFloorRefs(){},syncStairLinks(){},normalizeArchitecture(){},rebuildFloorSpaces(){},syncPropertyDoorRoles(){},
  saveSoon(){},render(){},activeLayer:'architecture',refreshFloorTabs(){},recalcAllSpaces(){},closeInspector(){},closeModal(){},setupImage(){},
  loadedImgs:[null],floorRefArchive:new Map(),current:()=>env.project.floors[0],floorDefault:()=>({}),
  clone:x=>JSON.parse(JSON.stringify(x)),slabsForLevels:()=>[],basementSlabs:()=>[],buildingSlabs:()=>slab([box(0,0,5,5)]),
  courtyardFloorItems:x=>x,buildArchitectureGraph:()=>({}),STRUCTURAL_TYPES:new Set(),ForestShared:{},
  Date,JSON,Map,selection:null};
 env.window.FHFloorLevels={mainIndex:()=>0};env.window.FHMapGrid={cellSize:()=>70};
 const c=vm.createContext(env);
 vm.runInContext('let history=[],historyIndex=-1;'+cut('function record(){','function numId(){'),c);
 c.record();floor.roof={...R.settings(),parapetHeightTiles:.75};c.record();
 // Restaurar el estado previo mediante la función real usada por los botones.
 const restoreName=cut('function record(){','function numId(){').match(/function (\w+)\([^)]*\)\{\n const saved=JSON.parse\(history\[historyIndex\]\)/)?.[1];
 assert.ok(restoreName);
 vm.runInContext('historyIndex=0;'+restoreName+'();',c);
 assert.equal(env.project.floors[0].roof.parapetHeightTiles,.25);
 vm.runInContext('historyIndex=1;'+restoreName+'();',c);
 assert.equal(env.project.floors[0].roof.parapetHeightTiles,.75);
 vm.runInContext(cut('function exportProject(includeImages){','function exportJSON('),c);
 const out=c.exportProject(false);
 assert.equal(out.floors[0].roof.parapetHeightTiles,.75);assert.equal(out.floors.length,1);
 assert.equal(out.roofSlabsByFloor[0].spans.length,1);
});
test('mapa sin roof: concreto, pretil de .381 m, colisión y copias para vistas desde otra planta',()=>{
 const THREE=require('./vendor/three.min.js');
 const sandbox={window:{document:{baseURI:'https://example.test/'}} ,URL};
 vm.createContext(sandbox);
 for(let i=0;i<13;i++)vm.runInContext(fs.readFileSync(__dirname+'/engine-'+String(i).padStart(2,'0')+'.js','utf8'),sandbox);
 vm.runInContext(fs.readFileSync(__dirname+'/fh-roof-engine-hook.js','utf8'),sandbox);
 const original=Buffer.from(sandbox.window.__FOREST_EMBEDDED_ENGINE__,'base64').toString('utf8'),patched=sandbox.window.FHRoofEngine.patch(original);
 const from=patched.indexOf(' const roof=FH_ROOF_PLANS[f];',patched.indexOf('function buildFloor(f)')),until=patched.indexOf(' const areaMaterials=',from);
 assert.ok(from>0&&until>from);
 const cut=(a,b)=>original.slice(original.indexOf(a),original.indexOf(b,original.indexOf(a)));
 const runtime={THREE,CELL:1.524,HEIGHT:2.74,WALL_THICK:.13,DATA:{floors:[{id:'roof'}]},
  stories:[new THREE.Group()],walls:[[]],blockers:[[]],sightWalls:[[]],occlusionRoots:[[]],
  pixelBoxGeometry:(w,h,d)=>new THREE.BoxGeometry(w,h,d),trackSegmentSight:(f,mesh)=>mesh,
  MAT:{wall:new THREE.MeshLambertMaterial(),wood:new THREE.MeshLambertMaterial(),edge:new THREE.MeshLambertMaterial()},
  document:{createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){}})})},
  surfaceRectsMinusVoids:(f,x,y,w,h)=>[{x,y,w,h}],
  FH_ROOF_PLANS:[R.plan(slab([box(0,0,6,4)]),null,undefined)],fhRoofObjects:[[]],SLABS:[slab([box(0,0,6,4)])],f:0,FHRoof:R};
 runtime.window=runtime;
 const c=vm.createContext(runtime);
 vm.runInContext(fs.readFileSync(__dirname+'/fh-style-property.js','utf8'),c);
 vm.runInContext(fs.readFileSync(__dirname+'/fh-style-renderer.js','utf8'),c);
 vm.runInContext(original.split('\n').find(line=>line.startsWith('function registerCutaway(')),c);
 // Helper functions and wallModel are the shipped engine implementations.
 vm.runInContext(cut('function world(p){','function tileTexture(){'),c);
 vm.runInContext(patched.slice(from,until),c);
 assert.equal(runtime.blockers[0].length,4);assert.equal(runtime.sightWalls[0].length,0);
 const pretil=runtime.stories[0].children.filter(m=>m.userData.fhRoofParapet);
 assert.equal(pretil.length,4);
 for(const mesh of pretil){
  assert.ok(Math.abs(mesh.geometry.parameters.height-.381)<1e-8);
  assert.equal(mesh.material.color.getHexString(),'a34d43');
 }
 const surface=runtime.stories[0].children.find(m=>m.userData.fhRoofSurface);
 assert.ok(surface.material.map);assert.equal(surface.material.userData.fhTileSize,32);
 assert.ok(surface.userData.fhStructuralSlab);assert.equal(runtime.occlusionRoots[0].length,5);
 const proxyStart=patched.indexOf('for(let f=0;f<fhRoofObjects.length;f++)'),proxyEnd=patched.indexOf('// Perfil del borde de la losa:',proxyStart);
 runtime.exteriorLayers=[new THREE.Group()];runtime.floorElev=[3.048];runtime.exteriorProxies=[];runtime.exteriorCutawayRoots=[];
 vm.runInContext(patched.slice(proxyStart,proxyEnd),c);
 assert.equal(runtime.exteriorProxies.length,5,'superficie y cuatro pretiles disponibles para la vista entre plantas');
 const roofCopy=runtime.exteriorProxies.find(p=>p.clone.userData.fhRoofSurface);
 assert.equal(roofCopy.clone.material,surface.material,'la copia exterior conserva el concreto, sin sustituirlo por madera');
 assert.ok(Math.abs(roofCopy.clone.position.y-3.069)<1e-8);
 const wallsCopied=runtime.exteriorProxies.filter(p=>p.clone.userData.fhRoofParapet);
 assert.equal(wallsCopied.length,4);assert.ok(wallsCopied.every(p=>p.clone.material.color.getHexString()==='a34d43'));
});
test('los contornos rojos reales, sin habitaciones, separan interior y azotea',()=>{
 const html=fs.readFileSync(__dirname+'/../../index.html','utf8');
 const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
 const walls=(x,y,w,h)=>[[x,y,x+w,y],[x+w,y,x+w,y+h],[x+w,y+h,x,y+h],[x,y+h,x,y]].map(([x,y,u,v],i)=>({id:'red'+i,type:'red_wall',a:{x,y},b:{x:u,y:v}}));
 const data={units:{columns:12,rows:12},mainFloorId:'pb',floors:[
  {id:'pb',roof:R.settings(),items:walls(1,1,8,8)},
  {id:'up',roof:R.settings(),items:[]}
 ]};
 const env=vm.createContext({project:data});
 vm.runInContext(cut('function rasterBoundary(','function detectFloorRegions(')+
  cut('function rasterAreaMask(','function courtyardFloorItems(')+
  cut('const roofCache=','// Copia el perímetro rojo'),env);
 const classify=()=>{
  data.roofSlabsByFloor=data.floors.map((_,i)=>env.buildingSlabs(i));
  return R.plans(data,[{enabled:false},data.roofSlabsByFloor[0]])[1];
 };
 let result=classify();assert.equal(area(result.spans),64);assert.equal(area(result.interiorSpans),0);
 data.floors[1].items=walls(1,1,4,8);
 result=classify();assert.equal(area(result.spans),32);assert.equal(area(result.interiorSpans),32);
 const before=JSON.stringify(result);
 data.floors[1].items.push({type:'room',id:'stray-room',x:1,y:1,w:8,h:8,surfaceStyle:{preset:'madera',color:'#654321'}});
 assert.equal(JSON.stringify(classify()),before,'una habitación que invade azotea no cambia los perímetros');
 data.floors[1].items=walls(1,1,8,8);
 result=classify();assert.equal(area(result.spans),0);assert.equal(area(result.interiorSpans),64);
 data.floors[1].items.pop();
 result=classify();assert.equal(area(result.spans),64,'paredes rojas sin cerrar no definen interior');
});
test('los suelos de habitaciones y áreas no pueden cubrir la azotea calculada',()=>{
 const env={window:{document:{baseURI:'https://example.test/'}},URL};vm.createContext(env);
 for(let i=0;i<13;i++)vm.runInContext(fs.readFileSync(__dirname+'/engine-'+String(i).padStart(2,'0')+'.js','utf8'),env);
 vm.runInContext(fs.readFileSync(__dirname+'/fh-roof-engine-hook.js','utf8'),env);
 const original=Buffer.from(env.window.__FOREST_EMBEDDED_ENGINE__,'base64').toString('utf8');
 const patched=env.window.FHRoofEngine.patch(original);
 const start=patched.indexOf('function areaSurfaceGrid('),end=patched.indexOf('function interactionAnchor(',start);
 assert.ok(start>0&&end>start);
 const calls=[],roof=R.plan(slab([box(1,1,8,8)]),slab([box(1,1,4,8)]),R.settings());
 const ctx=vm.createContext({window:{FHRoof:R},FH_ROOF_PLANS:[null,roof],
  surfaceRectsMinusVoids:(f,x,y,w,h)=>[{x,y,w,h}],surfaceGrid:(f,x,y,w,h,material,ypos)=>calls.push({f,x,y,w,h,material,ypos})});
 vm.runInContext(patched.slice(start,end),ctx);
 const wood={preset:'madera'};
 ctx.areaSurfaceGrid(1,1,1,8,8,wood,.039);
 assert.equal(area(calls),32);assert.ok(calls.every(r=>r.x+r.w<=5&&r.material===wood&&r.ypos===.039));
 calls.length=0;
 ctx.areaSurfaceGrid(1,5,1,4,8,wood,.039);assert.equal(calls.length,0,'ningún acabado tapa el concreto de la azotea');
 ctx.areaSurfaceGrid(0,1,1,8,8,wood,.039);assert.equal(area(calls),64,'PB y mapas sin azotea mantienen sus suelos');
 calls.length=0;
 roof.spans=[box(1,1,8,8)];ctx.areaSurfaceGrid(1,1,1,8,8,wood,.039);
 assert.equal(calls.length,0,'sin contorno rojo arriba, toda la losa conserva el acabado de azotea');
});
test('mapa existente sin campo roof usa defaults al calcular la azotea de Piso 2',()=>{
 const data={schema:'forest-horror-map-v1',mainFloorId:'pb',styleSystem:0,
  floors:[{id:'pb',name:'PB',elevationFt:0,ceilingHeightFt:10,items:[]},
   {id:'p2',name:'Piso 2',elevationFt:10,ceilingHeightFt:10,items:[]}],
  roofSlabsByFloor:[slab([box(1,1,8,8)]),{enabled:false,spans:[]}]};
 const saved=JSON.stringify(data);
 const roof=R.plans(data,[{enabled:false},data.roofSlabsByFloor[0]])[1];
 assert.ok(roof,'no cancela la azotea por faltar el campo nuevo');
 assert.equal(area(roof.spans),64);assert.equal(roof.floor.preset,'concreto');
 assert.equal(roof.wall.color,'#A34D43');assert.equal(roof.parapetHeightTiles,.25);assert.equal(length(roof.edges),32);
 assert.equal(JSON.stringify(data),saved,'consultar defaults no modifica el mapa guardado');
 data.floors[0].roof={enabled:false};assert.equal(R.plans(data,[{},data.roofSlabsByFloor[0]])[1],null);
});
test('la última planta de un mapa existente también recibe tapa sin configuración nueva',()=>{
 const data={mainFloorId:'pb',floors:[{id:'pb',name:'PB',elevationFt:0,ceilingHeightFt:10,items:[]}],
  roofSlabsByFloor:[slab([box(0,0,6,4)])]};
 R.prepareRuntime(data,'Azotea');assert.equal(data.floors.length,2);
 const roof=R.plans(data,[{},data.slabsByLevel[0]])[1];
 assert.equal(roof.floor.preset,'concreto');assert.equal(roof.edges.length,4);
 R.prepareRuntime(data,'Azotea');assert.equal(data.floors.length,2);
});
test('el panel muestra la azotea activa por defecto para un mapa existente',()=>{
 const env={window:{FHRoof:R,FH_ROOF_TEXT:{},FH_STYLE_TEXT:{floorPresets:[],wallPresets:[]}},
  current:()=>({name:'PB'}),escapeAttr:s=>String(s??''),modal:html=>{env.html=html}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/fh-roof-editor.js','utf8'),env);
 env.window.FHRoofEditor.open();assert.match(env.html,/id="roof-enabled" checked/);
});
