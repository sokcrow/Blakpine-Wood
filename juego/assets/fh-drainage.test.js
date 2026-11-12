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
 const connected=section('small_dead_end',10,3,'dest',180);
 main.drainage.flowTo='dest';
 const p=map([[main,small,bridge,connected]]);
 assert.equal(D.waterAt(p,0,{x:5,y:1},1),null,'Las banquetas 10x10 no se inundan');
 assert.equal(D.walkFactor(p,0,{x:5,y:5},1),1,'El agua principal no penaliza MOV universal');
 assert.equal(D.waterAt(p,0,{x:21,y:21},0),null,'4x4 seco conserva una canaleta');
 assert.equal(D.walkFactor(p,0,{x:20.5,y:20.5},.58),.5,'Lluvia inunda 4x4');
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
 assert.equal(runtime.update(.05,{phase:'lluvia',intensity:.58}),null,
  'El tramo aislado no inventa una corriente después del remolino');
 assert.equal(transfers.length,1,'Enfriamiento evita teletransportes encadenados');
 assert.equal(moves.length,0,'El tramo aislado no ejerce empuje');
 const linked=section('straight',0,0,'linked'),sink=section('small_dead_end',10,3,'sink',180);
 linked.drainage.flowTo='sink';
 const linkedMoves=[];
 const linkedRuntime=D.createRuntime({project:map([[linked,sink]]),
  position:()=>({floorIndex:0,x:5,y:5}),
  move:(x,y)=>linkedMoves.push([x,y])});
 assert.equal(linkedRuntime.update(.05,{phase:'lluvia',intensity:.58})?.type,'current');
 assert.ok(linkedMoves.length>0&&linkedMoves[0].every(Number.isFinite),
  'Una conexión válida delega el arrastre al motor externo');
 const noExit=D.createRuntime({project:map([[source]]),position:()=>({floorIndex:0,x:10,y:10}),
  move:()=>{},teleport:()=>{throw Error('Sin salida no hay teletransporte');}});
 assert.doesNotThrow(()=>noExit.update(.05,{phase:'lluvia',intensity:.58}));
});
test('precipitación nevada no activa inundación; el bucle usa reloj y clima existentes',()=>{
 const section4=section('small_cross',0,0,'four'),dest=section('small_dead_end',4,0,'dest',180);
 section4.drainage.flowTo='dest';
 const p=map([[section4,dest]]);
 const position=()=>({floorIndex:0,x:1,y:1}),moves=[];
 const rt=D.createRuntime({project:p,position,move:(x,y)=>moves.push([x,y])});
 assert.equal(rt.update(.05,{phase:'nieve',intensity:1}),null,'No hay corriente si la zona está seca');
 assert.equal(rt.update(.05,{phase:'lluvia',intensity:1})?.type,'current');
 assert.equal(moves.length,1,'La lluvia activa corriente en banqueta inundada');
});
test('shader global: tres máscaras por GPU, desnivel en tiles y lluvia secundaria',()=>{
 const scene={children:[],add(obj){this.children.push(obj);}};
 class Material{constructor(opts){Object.assign(this,opts);}dispose(){}}
 class ShaderMaterial extends Material{}
 class Geometry{
  constructor(w=2,h=2){this.attributes={position:{count:4,getX:i=>i%2===0?-w/2:w/2,
   getY:i=>i<2?-h/2:h/2}};this.attrs={};}
  setAttribute(name,attribute){this.attrs[name]=attribute;}
 }
 class Attribute{constructor(values,components){this.values=values;this.components=components;}}
 class Mesh{
  constructor(geometry,material){this.geometry=geometry;this.material=material;
   this.position={set(x,y,z){this.x=x;this.y=y;this.z=z;}};
   this.rotation={x:0,y:0,z:0};this.visible=true;}
 }
 const THREE={ShaderMaterial,MeshBasicMaterial:Material,MeshLambertMaterial:Material,
  Mesh,BoxGeometry:Geometry,PlaneGeometry:Geometry,Float32BufferAttribute:Attribute,
  RingGeometry:Geometry,CircleGeometry:Geometry,DoubleSide:2};
 const Core=D;
 const small=section('small',20,20,'wet'),out=section('outfall',40,40,'vortex');
 const source=map([[small,out], [section('small',10,10,'other')]]);
 Core.attachFloor(THREE,source,scene,0,1.524);
 Core.attachFloor(THREE,source,scene,1,1.524);
 const waterMeshes=scene.children.filter(o=>o.material instanceof ShaderMaterial);
 assert.ok(waterMeshes.length>=3,'Agua presente en varias plantas');
 assert.equal(new Set(waterMeshes.map(o=>o.material)).size,1,'Un mismo shader, incluso entre plantas');
 const shader=waterMeshes[0].material;
 assert.match(shader.vertexShader,/heightMask=noise/,'Ruido principal regula elevación');
 assert.match(shader.fragmentShader,/maskA=noise/);
 assert.match(shader.fragmentShader,/maskB=noise/);
 assert.equal(shader.uniforms.uWave.value,.032*1.524);
 assert.ok(waterMeshes.some(m=>m.position.y===Core.WATER_LEVEL*1.524),'Agua a -0.2 tile');
 const flood=waterMeshes.find(m=>m.visible===false);
 assert.ok(flood,'La lámina de lluvia existe, sin crear otro shader');
 const clock=shader.uniforms.uTime.value;
 Core.updateVisuals(.05,1,0);
 assert.equal(flood.visible,true);
 assert.ok(shader.uniforms.uTime.value>clock,'Se actualiza un solo reloj');
 assert.equal(shader.uniforms.uRain.value,1);
 Core.updateVisuals(.05,0,1);
 assert.equal(flood.visible,false);
});
test('geometría: respeta muros y huecos reales sin duplicar colisiones',()=>{
 const main=section('straight',20,20,'sewer');
 const wall={id:'authored',type:'wall',a:{x:20,y:20},b:{x:20,y:30}};
 const door={id:'door',type:'door',a:{x:30,y:24},b:{x:30,y:26}};
 const parts=D.nativeComponents(main,[],[wall,door]);
 assert.equal(parts.filter(p=>p.type==='wall'&&p.a.x===20&&p.b.x===20).length,0,'Respeta muro existente');
 assert.equal(parts.filter(p=>p.type==='opening'&&p.a.x===30&&p.b.x===30).length,2,'No reconstruye el vano de la puerta');
 const p=map([[main,wall,door]]);
 const expanded=D.expandProject(p);
 assert.equal(expanded.floors[0].items.filter(x=>x.id==='authored').length,1);
 assert.equal(expanded.floors[0].items.filter(x=>x.id==='door').length,1);
 assert.equal(expanded.floors[0].items.filter(x=>x.drainageGenerated&&x.type==='wall'&&x.a.x===20&&x.b.x===20).length,0);
});
test('geometría: el fondo queda por debajo del agua y solo se recortan canales del piso actual',()=>{
 const a=section('straight',0,0,'canal'),b=section('straight',0,0,'canal_otra_planta');
 const p=map([[a],[b]]);
 const first=D.cutFloorRects(p,0,[{x:0,y:0,w:10,h:10}]);
 assert.equal(first.reduce((sum,r)=>sum+r.w*r.h,0),60,'Canal central de 4 tiles deja 6 de paso');
 assert.equal(D.cutFloorRects(p,0,[{x:30,y:30,w:5,h:5}]).length,1);
 assert.equal(D.cutFloorRects(p,1,[{x:30,y:30,w:5,h:5}]).length,1);
 assert.equal(D.WATER_LEVEL,-.2);
 assert.ok(D.CHANNEL_BOTTOM<D.WATER_LEVEL);
 assert.ok(D.depthAt(p,0,{x:5,y:5},0)<D.WATER_LEVEL,'Flotabilidad baja al personaje al canal');
 assert.equal(D.depthAt(p,0,{x:5,y:1},0),0,'Pasillo seco conserva altura');
});
test('corriente T: sigue primero la rama antes de girar; no empuja tramos aislados',()=>{
 const tee=section('tee',10,10,'tee'),east=section('small_dead_end',20,13,'east',180);
 tee.drainage.flowTo='east';
 const p=map([[tee,east]]);
 assert.equal(D.currentAt(p,0,{x:15,y:11},0)?.y,1,'La rama superior baja al centro');
 assert.equal(D.currentAt(p,0,{x:15,y:15},0)?.x,1,'En la unión gira hacia la derecha');
 const lonely=map([[section('straight',0,0,'alone')]]);
 assert.equal(D.currentAt(lonely,0,{x:5,y:5},0)?.speed,0,'No inventar salida al desagüe');
});
test('integración de desnivel: el motor empaquetado recibe el recorte y altura del jugador',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 for(const marker of ['function addDrainGeometryToEngine(','cutFloorRects(DATA,f,rects)',
   'fhDrainActorDrop','fhDrainDrop','return addDrainGeometryToEngine(doc);']){
  assert.ok(html.includes(marker),'Motor sin integración: '+marker);
 }
});
test('integración motor: la corriente usa walk nativo y el cambio de piso conserva juego',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 for(const code of ['FHDrainage?.createRuntime','FHDrainage?.walkFactor','window.FHDrainageRuntime?.update','walk(dx*CELL,dy*CELL,true)',
   'changeFloor(exit.floorIndex)','makeSpawnSafe();','FH_DRAIN_TEXT?.vortexMove']){
  assert.ok(html.includes(code),'Falta adaptador de gameplay: '+code);
 }
 const core=fs.readFileSync(path.join(__dirname,'fh-drainage.js'),'utf8');
 assert.match(core,/function updateVisuals\(/);
 assert.match(core,/function whirlpoolAt\(/);
 assert.match(core,/function createRuntime\(/);
 assert.ok(!core.includes('function canWalk('),'No duplicar la física de paredes');
});
