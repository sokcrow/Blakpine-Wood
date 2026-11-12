const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const D=require('./fh-drainage.js');
const units={columns:120,rows:120,feetPerCell:5};
const map=(floors)=>({schema:'forest-horror-map-v1',units,floors:floors.map((items,i)=>({id:'f'+i,elevationFt:-i*12,items}))});
const section=(kind,x,y,id,rotation=0)=>D.makeSection(kind,{x:x+D.SIZES[kind]/2,y:y+D.SIZES[kind]/2},units,id,rotation);
test('medidas: 10×10 (3/4/3), 4×4 y 20×20 sin bloquear todo el pasillo',()=>{
 const a=section('straight',0,0,'a'),b=section('small',20,20,'b'),c=section('outfall',40,40,'c');
 assert.deepEqual([a.w,a.h,b.w,b.h,c.w,c.h],[10,10,4,4,20,20]);
 assert.deepEqual(D.rects(a),[{x:0,y:3,w:10,h:4}]);
 assert.deepEqual(D.rects(b),[{x:20,y:21.5,w:4,h:1}]);
 assert.equal(a.blocksMovement,false);
});
test('T y cruz giran sus salidas y la continuidad del agua',()=>{
 const a=section('tee',0,0,'t');
 assert.deepEqual(D.ports(a),['n','e','w']);
 a.rotation=90;
 assert.deepEqual(D.ports(a),['e','s','n']);
 assert.equal(D.rects(section('cross',10,0,'x')).length,2);
});
test('red conecta solo piezas que comparten borde y puerto en el mismo piso',()=>{
 const a=section('straight',0,0,'a'),b=section('straight',10,0,'b');
 const c=section('small',20,3,'c'),d=section('straight',30,0,'d');
 assert.equal(D.touches(a,b),true);
 assert.equal(D.touches(b,c),true);
 assert.equal(D.touches(c,d),false);
 const wrong=section('outfall',20,0,'wrong');
 wrong.y=4; // comparte borde con b, pero su canal está desalineado
 assert.equal(D.touches(b,wrong),false);
 const g=D.topology(map([[a,b,c], [d]]));
 assert.equal(g.links.get('f0:a').length,1);
 assert.equal(g.links.get('f0:c').length,1);
 assert.equal(g.links.get('f1:d').length,0);
});
test('corriente automática va al desagüe conectado y no atraviesa huecos',()=>{
 const a=section('straight',0,20,'a'),b=section('straight',10,20,'b');
 const sink=section('outfall',20,15,'sink'); // canales alineados entre pasillo 10×10 y cámara 20×20
 const p=map([[a,b,sink]]);
 assert.deepEqual(D.downstream(p,0,'a'),{floorIndex:0,itemId:'b'});
 b.drainage.flowTo='a';
 assert.deepEqual(D.downstream(p,0,'b'),{floorIndex:0,itemId:'a'});
 b.drainage.flowTo='fantasma';
 assert.equal(D.topology(p).warnings.some(w=>w.code==='flowToInvalid'),true);
 assert.deepEqual(D.downstream(p,0,'b'),{floorIndex:0,itemId:'sink'});
});
test('el remolino elige cualquier drenaje del mapa pero nunca otro tipo de lugar',()=>{
 const sink=section('outfall',0,0,'sink'),far=section('straight',100,100,'lejos');
 const p=map([[sink],[],[far,{id:'obj',type:'bed',x:99,y:99}]]);
 const exit=D.randomExit(p,0,'sink',()=>.9);
 assert.deepEqual(exit,{floorIndex:2,itemId:'lejos',x:101,y:101});
 assert.equal(D.randomExit(map([[sink]]),0,'sink'),null);
});
test('la lluvia inunda el 4×4, aumenta corriente y reduce MOV solo en lo inundado',()=>{
 const small=section('small',0,0,'s'),main=section('straight',10,0,'m');
 assert.deepEqual(D.weatherState(small,0),{flooded:false,waterWidth:1,currentFactor:1,walkingFactor:1});
 assert.deepEqual(D.weatherState(small,.58),{flooded:true,waterWidth:4,currentFactor:1.58,walkingFactor:.5});
 assert.equal(D.weatherState(main,1).walkingFactor,1);
 assert.equal(D.weatherState(main,1).currentFactor,2);
});
test('puentes colocables libres, girables y con límites verificables',()=>{
 const b=D.makeBridge({x:15,y:18},units,'bridge');
 assert.deepEqual([b.w,b.h],[2,6]);assert.equal(D.validate(b,units),true);
 const b2=D.makeBridge({x:15,y:18},units,'bridge2',true);
 assert.deepEqual([b2.w,b2.h],[6,2]);
 assert.throws(()=>D.makeSection('outfall',{x:2,y:2},units,'oops'),/no cabe/);
});
test('un drenaje puede estar en otro nivel: buscar el más cercano físicamente',()=>{
 const p=map([[{id:'out',type:'drain_outlet',x:33,y:30}], [section('straight',30,30,'a')], [section('straight',95,95,'b')]]);
 assert.deepEqual({floorIndex:D.nearest(p,0,{x:33,y:30}).floorIndex,itemId:D.nearest(p,0,{x:33,y:30}).itemId},{floorIndex:1,itemId:'a'});
});
test('validación opcional no cambia mapas v1 antiguos',()=>{
 const old=map([[{id:'legacy',type:'drain_main',x:1,y:2}]]);
 assert.equal(D.validateProject(old),true);
 assert.deepEqual(D.topology(old).nodes,[]);
});
test('editor y motor enlazados desde index.html y contrato v1',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 for(const marker of ['fh-drainage.js','fh-drainage-editor.js','FHDrainage?.draw2D','FHDrainage?.attachFloor','FHDrainage?.validateProject','FHDrainageEditor?.place'])assert.ok(html.includes(marker),marker);
});


test('seleccionar drenajes desde Agua: tramo y puente se detectan en su superficie',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 const layer=html.match(/function layerForItem\(it\)\{[^\n]+/);
 const hit=html.match(/function hitTest\(s\)\{[^\n]+/);
 assert.ok(layer&&hit,'El editor conserva los métodos de capa y selección');
 const section=D.makeSection('straight',{x:5,y:5},units,'segmento');
 const bridge=D.makeBridge({x:5,y:5},units,'puente');
 const items=[section,bridge];
 const context={
  window:{FHDrainage:D,FHRoads:null,FHExteriorGrid:null},
  LIGHTING_TYPES:new Set(['light_fixture']),
  SEGMENT_TYPES:new Set(['wall','door']),
  AREA_TYPES:new Set(['hall','concrete']),
  activeLayer:'furniture',activeCategory:'water',
  view:{scale:1},toWorld:p=>p,toGrid:p=>p,toPixel:p=>p,
  gridX:()=>1,gridY:()=>1,current:()=>({items})
 };
 vm.createContext(context);
 vm.runInContext(layer[0]+'\n'+hit[0],context);
 assert.equal(context.layerForItem(section),'furniture','El tramo pertenece a la capa de Agua');
 assert.equal(context.layerForItem(bridge),'furniture','El puente pertenece a la capa de Agua');
 assert.equal(context.layerForItem({type:'hall'}),'architecture','Los pasillos normales conservan su capa');
 assert.equal(context.layerForItem({type:'concrete'}),'architecture','Las áreas normales conservan su capa');
 assert.equal(context.layerForItem({type:'water_outlet'}),'furniture');
 assert.equal(context.hitTest({x:8,y:8})?.id,'segmento','Selecciona el tramo');
 assert.equal(context.hitTest({x:5,y:5})?.id,'puente','El puente superpuesto se puede seleccionar');
 context.activeLayer='architecture';
 assert.equal(context.hitTest({x:5,y:5}),null,'No roba selección desde Arquitectura');
 assert.ok(html.includes('!window.FHDrainage?.isSection(it)&&!window.FHDrainage?.isBridge(it)'), 'No se repintan como áreas genéricas');
});

test('premades nativos: todos los tamaños y puertos de 10×10 y 4×4',()=>{
 const profiles=[
  ['straight',10,2],['elbow',10,2],['tee',10,3],['cross',10,4],['dead_end',10,1],
  ['small',4,2],['small_elbow',4,2],['small_tee',4,3],
  ['small_cross',4,4],['small_dead_end',4,1],['outfall',20,4]
 ];
 for(let i=0;i<profiles.length;i++){
  const [kind,size,portCount]=profiles[i],item=section(kind,i*0,0,'test'+i);
  assert.deepEqual([item.w,item.h],[size,size],kind);
  assert.equal(D.ports(item).length,portCount,kind);
  assert.equal(D.nativeComponents(item).filter(c=>c.type==='wall').length,4-portCount,kind);
  assert.equal(D.nativeComponents(item).filter(c=>c.type==='opening').length,portCount,kind);
  assert.equal(D.nativeComponents(item).filter(c=>c.type==='room').length,1,kind);
  assert.equal(D.validate(item,units),true,kind);
  for(const r of D.rects(item)){
   assert.ok(r.x>=item.x&&r.y>=item.y&&r.x+r.w<=item.x+size&&r.y+r.h<=item.y+size,kind);
  }
 }
});
test('codos de 90 grados, T y cruces pequeños rotan canales sin inventar conexiones',()=>{
 for(const kind of ['elbow','small_elbow']){
  const elbow=section(kind,20,20,kind),before=D.ports(elbow);
  assert.deepEqual(before,['n','e']);
  elbow.rotation=90;
  assert.deepEqual(D.ports(elbow),['e','s']);
  assert.equal(D.rects(elbow).length,2);
 }
 for(const kind of ['dead_end','small_dead_end']){
  const end=section(kind,50,50,kind);
  assert.deepEqual(D.ports(end),['e']);
  assert.equal(D.nativeComponents(end).filter(c=>c.type==='wall').length,3);
  end.rotation=180;
  assert.deepEqual(D.ports(end),['w']);
 }
 const a=section('small_elbow',30,30,'a');
 const b=section('small',34,30,'b');
 assert.equal(D.touches(a,b),true);
 b.rotation=90;
 assert.equal(D.touches(a,b),false);
});
test('las habitaciones, aberturas y paredes pasan al motor nativo y no se guardan en el mapa',()=>{
 const a=section('straight',10,10,'pasillo'),b=section('small_dead_end',20,13,'fin');
 const project=map([[a,b,{id:'mueble',type:'chair',x:18,y:18}],[]]);
 const original=JSON.parse(JSON.stringify(project));
 const expanded=D.expandProject(JSON.parse(JSON.stringify(project)));
 assert.equal(expanded.floors[0].items.filter(it=>it.drainageGenerated).length,10);
 const generated=expanded.floors[0].items.filter(it=>it.drainageGenerated);
 assert.equal(generated.filter(it=>it.type==='room').length,2);
 assert.equal(generated.filter(it=>it.type==='wall').length,5);
 assert.equal(generated.filter(it=>it.type==='opening').length,3);
 for(const it of generated)assert.ok(it.drainageOwnerId,'Se conserva el identificador del premade');
 assert.equal(expanded.floors[1].items.length,0,'No se copian paredes a otros pisos');
 D.expandProject(expanded);
 assert.equal(expanded.floors[0].items.filter(it=>it.drainageGenerated).length,10,'Expansión idempotente');
 assert.equal(JSON.stringify(project),JSON.stringify(original),'El proyecto guardado no muta si se expande una copia');
 assert.equal(original.floors[0].items.filter(it=>it.drainageGenerated).length,0);
});
test('el motor 3D expande geometría antes de buildFloor y conserva los materiales de agua',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 const editor=fs.readFileSync(path.join(__dirname,'fh-drainage-editor.js'),'utf8');
 for(const tool of ['drain_elbow','drain_dead_end','drain_small_elbow','drain_small_tee','drain_small_cross','drain_small_dead_end']){
  assert.ok(html.includes("'"+tool+"'"),'Herramienta visible: '+tool);
  assert.ok(editor.includes(tool),'Herramienta implementada: '+tool);
 }
 assert.match(html,/window\.FHDrainage\?\.expandProject\(DATA\);\\nDATA\.floors\.forEach\(\(_,i\)=>buildFloor\(i\)\);/);
 const core=fs.readFileSync(path.join(__dirname,'fh-drainage.js'),'utf8');
 const geometry=core.slice(core.indexOf(' function attachFloor('),core.indexOf(' return Object.freeze(',core.indexOf(' function attachFloor(')));
 assert.doesNotMatch(geometry,/wallModel\(|const wall=new THREE\.MeshLambertMaterial/,'Los muros no se duplican como mallas propias');
 assert.match(core,/push\('opening',Math\.max\(last,lo\),hi,k\+\+\)/);
});

test('un 4×4 conectado a un 10×10 abre solo la puerta real y cierra los huecos laterales',()=>{
 const main=section('straight',0,0,'mayor'),small=section('small_tee',10,4,'menor');
 assert.equal(D.touches(main,small),true,'El ancho de canal secundario es una casilla');
 const parts=D.nativeComponents(main,[small]);
 const edge=parts.filter(p=>p.id.startsWith('fh_drain_mayor_e_'));
 assert.deepEqual(edge.filter(p=>p.type==='opening').map(p=>[p.a.y,p.b.y]),[[4,8]]);
 assert.deepEqual(edge.filter(p=>p.type==='wall').map(p=>[p.a.y,p.b.y]),[[0,4],[8,10]]);
 const expanded=D.expandProject(map([[main,small]]));
 const walls=expanded.floors[0].items.filter(p=>p.drainageOwnerId==='mayor'&&p.type==='wall');
 assert.equal(walls.length,4,'La unión menor no deja agujeros laterales transitables');
 assert.equal(D.topology(map([[main,small]])).warnings.some(x=>x.code==='isolated'),false);
});

test('cada variante secundaria usa el estado de lluvia del perfil de 4×4',()=>{
 for(const kind of ['small','small_elbow','small_tee','small_cross','small_dead_end']){
  const it=section(kind,0,0,kind);
  assert.equal(D.weatherState(it,0).waterWidth,1,kind);
  assert.equal(D.weatherState(it,.58).waterWidth,4,kind);
  assert.equal(D.weatherState(it,.58).walkingFactor,.5,kind);
 }
});

test('corriente real: caminar en agua principal, inundación secundaria y puentes seguros',()=>{
 const main=section('straight',0,0,'main'),small=section('small_tee',20,20,'small'),
  bridge=D.makeBridge({x:22,y:22},units,'bridge');
 const p=map([[main,small,bridge]]);
 assert.equal(D.waterAt(p,0,{x:5,y:1},1),null,'Las banquetas 10x10 no se inundan');
 assert.equal(D.walkFactor(p,0,{x:5,y:5},1),1,'El agua principal no penaliza MOV universal');
 assert.equal(D.waterAt(p,0,{x:21,y:21},0),null,'4x4 seco conserva una canaleta');
 assert.equal(D.walkFactor(p,0,{x:21,y:21},.58),.5,'Lluvia inunda 4x4');
 assert.equal(D.walkFactor(p,0,{x:22,y:22},.58),1,'Puente evita ralentización');
 assert.equal(D.currentAt(p,0,{x:22,y:22},.58),null,'No arrastra sobre puente');
 const dry=D.currentAt(p,0,{x:5,y:5},0),wet=D.currentAt(p,0,{x:5,y:5},1);
 assert.ok(dry?.speed>0&&wet.speed>dry.speed,'Corriente aumenta bajo lluvia');
});
test('simulación: la corriente delega movimiento al motor y el remolino respeta destino y cooldown',()=>{
 const source=section('outfall',0,0,'source'),remote=section('small',40,40,'remote');
 const p=map([[source,remote]]),pos={floorIndex:0,x:10,y:10},moves=[],transfers=[];
 const runtime=D.createRuntime({project:p,position:()=>pos,
  move:(x,y)=>moves.push([x,y]),teleport:exit=>{transfers.push(exit);pos.x=exit.x;pos.y=exit.y;return true;}});
 const result=runtime.update(.05,{phase:'lluvia',intensity:1});
 assert.equal(result?.type,'whirlpool','Remolino actúa durante gameplay');
 assert.deepEqual(transfers[0],{floorIndex:0,itemId:'remote',x:41,y:41});
 assert.equal(runtime.update(.05,{phase:'lluvia',intensity:.58})?.type,'current');
 assert.equal(transfers.length,1,'Enfriamiento evita teletransportes encadenados');
 assert.ok(moves.length>0&&moves[0].every(Number.isFinite),'El desplazamiento pasa por move() externo');
 const noExit=D.createRuntime({project:map([[source]]),position:()=>({floorIndex:0,x:10,y:10}),
  move:()=>{},teleport:()=>{throw Error('Sin salida no hay teletransporte');}});
 assert.doesNotThrow(()=>noExit.update(.05,{phase:'lluvia',intensity:.58}));
});
test('precipitación nevada no activa inundación; el bucle usa reloj y clima existentes',()=>{
 const section4=section('small_cross',0,0,'four'),p=map([[section4]]);
 const position=()=>({floorIndex:0,x:1,y:1}),moves=[];
 const rt=D.createRuntime({project:p,position,move:(x,y)=>moves.push([x,y])});
 assert.equal(rt.update(.05,{phase:'nieve',intensity:1}),null,'No hay corriente si la zona está seca');
 assert.equal(rt.update(.05,{phase:'lluvia',intensity:1})?.type,'current');
 assert.equal(moves.length,1,'La lluvia activa corriente en banqueta inundada');
});
test('renderizador Three: animación UV, reja y lámina inundada visibles solo bajo lluvia',()=>{
 const textureList=[],scene={children:[],add(obj){this.children.push(obj);}};
 const doc={createElement:()=>({width:0,height:0,getContext:()=>({fillStyle:'',fillRect(){}})})};
 class Texture{constructor(){this.offset={x:0,y:0};this.repeat={set(){}};textureList.push(this);}}
 class Material{constructor(opts){Object.assign(this,opts);}}
 class Mesh{constructor(geom,material){this.geometry=geom;this.material=material;this.position={set(){}};this.rotation={x:0,y:0,z:0};this.visible=true;}}
 class Geometry{}
 const THREE={CanvasTexture:Texture,MeshBasicMaterial:Material,MeshLambertMaterial:Material,
  Mesh,BoxGeometry:Geometry,RingGeometry:Geometry,CircleGeometry:Geometry,
  RepeatWrapping:1,NearestFilter:2};
 const sandbox={document:doc,module:{exports:{}},console};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'fh-drainage.js'),'utf8'),sandbox);
 const Core=sandbox.module.exports;
 const small=Core.makeSection('small',{x:22,y:22},units,'wet'),out=Core.makeSection('outfall',{x:60,y:60},units,'vortex');
 Core.attachFloor(THREE,map([[small,out]]),scene,0,1.524);
 const flood=scene.children.find(x=>x.visible===false&&x.material?.map);
 assert.ok(flood,'4x4 debe tener una capa completa de inundación');
 assert.ok(textureList.length>=2,'Los canales utilizan CanvasTexture dinámica');
 Core.updateVisuals(.05,1,0);
 assert.equal(flood.visible,true,'La lámina de lluvia aparece en el conducto');
 assert.ok(textureList.some(t=>t.offset.x!==0||t.offset.y!==0),'La textura se desplaza');
 Core.updateVisuals(.05,0,0);
 assert.equal(flood.visible,false,'Se retira la capa al terminar la precipitación');
});
test('integración motor: la corriente usa walk nativo y el cambio de piso conserva juego',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 for(const code of ['FHDrainage?.createRuntime','FHDrainage?.walkFactor','fhDrainageRuntime?.update','walk(dx*CELL,dy*CELL,true)',
   'changeFloor(exit.floorIndex)','makeSpawnSafe();','FH_DRAIN_TEXT?.vortexMove']){
  assert.ok(html.includes(code),'Falta adaptador de gameplay: '+code);
 }
 const core=fs.readFileSync(path.join(__dirname,'fh-drainage.js'),'utf8');
 assert.match(core,/function updateVisuals\(/);
 assert.match(core,/function whirlpoolAt\(/);
 assert.match(core,/function createRuntime\(/);
 assert.ok(!core.includes('function canWalk('),'No duplicar la física de paredes');
});
