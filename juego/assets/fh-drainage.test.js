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
  setIndex(indices){this.indices=indices;}
 }
 class Attribute{constructor(values,components){this.values=values;this.components=components;}}
 class Mesh{
  constructor(geometry,material){this.geometry=geometry;this.material=material;
   this.position={set(x,y,z){this.x=x;this.y=y;this.z=z;}};
   this.rotation={x:0,y:0,z:0};this.visible=true;}
 }
 const THREE={ShaderMaterial,MeshBasicMaterial:Material,MeshLambertMaterial:Material,
  Mesh,BoxGeometry:Geometry,PlaneGeometry:Geometry,BufferGeometry:Geometry,Float32BufferAttribute:Attribute,
  RingGeometry:Geometry,CircleGeometry:Geometry,DoubleSide:2,FrontSide:0};
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
 assert.match(shader.vertexShader,/vMaskA=noise/);
 assert.match(shader.vertexShader,/vMaskB=noise/);
 assert.doesNotMatch(shader.fragmentShader,/noise\(|hash\(|sin\(/,
  'Ninguna máscara debe consumir ruido procedural por píxel');
 assert.equal(shader.transparent,false,'Agua opaca evita sobrepintado transparente');
 assert.equal(shader.depthWrite,true,'El agua reutiliza el buffer de profundidad');
 const vortexWater=waterMeshes.filter(m=>m.position.x===(out.x+out.w/2)*1.524&&m.position.z===(out.y+out.h/2)*1.524);
 assert.equal(vortexWater.length,1,'El desagüe 20x20 ocupa un solo draw call de agua');
 assert.ok(vortexWater[0].geometry.indices.length>6,'Las piezas forman una malla unificada');
 assert.equal(shader.uniforms.uWave.value,.032*1.524);
 assert.ok(waterMeshes.some(m=>m.position.y===Core.WATER_LEVEL*1.524),'Agua a -0.2 tile');
 const flood=waterMeshes.find(m=>m.visible===false);
 assert.ok(flood,'La lámina de lluvia existe, sin crear otro shader');
 const clock=shader.uniforms.uTime.value;
 const secondFloorFlood=waterMeshes.filter(m=>m.visible===false).find(m=>m!==flood);
 assert.ok(secondFloorFlood,'El otro piso tiene inundación independiente');
 Core.updateVisuals(.05,1,0);
 assert.equal(flood.visible,true);
 assert.equal(secondFloorFlood.visible,false,'No se actualizan mallas ocultas de otra planta');
 assert.ok(shader.uniforms.uTime.value>clock,'Se actualiza un solo reloj');
 assert.equal(shader.uniforms.uRain.value,1);
 Core.updateVisuals(.05,0,0);
 assert.equal(flood.visible,false);
 Core.updateVisuals(.05,1,1);
 assert.equal(secondFloorFlood.visible,true,'La inundación se activa al visitar ese piso');
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

test('render 3D real: fondo sólido del canal y reja abierta con altura de apoyo',()=>{
 const sectionMain=section('straight',0,0,'canal_solid');
 const bridge=D.makeBridge({x:5,y:5},units,'puente_reja');
 const project=map([[sectionMain,bridge]]);
 assert.equal(D.supportAt(project,0,{x:5,y:5}),D.BRIDGE_TOP,
  'Los pies reposan sobre las barras, no atraviesan el puente');
 assert.equal(D.depthAt(project,0,{x:5,y:5}),D.BRIDGE_TOP,
  'El adaptador de cámara también recibe altura de reja');
 assert.equal(D.waterAt(project,0,{x:5,y:5}),null,'La corriente no arrastra al cruzar la reja');
 assert.equal(D.supportAt(project,0,{x:5,y:4}),D.BRIDGE_TOP);
 assert.equal(D.supportAt(project,0,{x:8,y:5}),D.CHANNEL_BOTTOM,
  'Los pies descansan sobre el fondo sólido, no sobre el shader de agua');
 assert.equal(D.supportAt(project,0,{x:8,y:1}),0,'La banqueta es el nivel 0');
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 assert.ok(html.includes('!window.FHDrainage?.isBridge(it)'),
  'El motor no puede pintar una losa opaca debajo de una reja real');
 const scene={children:[],add(mesh){this.children.push(mesh);}};
 class Material{constructor(opts){Object.assign(this,opts);}}
 class Geometry{
  constructor(){this.attributes={};}
  setAttribute(name,attribute){this.attributes[name]=attribute;}
  setIndex(indices){this.indices=indices;}
 }
 class Attribute{constructor(values,size){this.values=values;this.itemSize=size;}}
 class Mesh{
  constructor(geometry,material){this.geometry=geometry;this.material=material;
   this.position={set(x,y,z){this.x=x;this.y=y;this.z=z;}};
   this.rotation={x:0,y:0,z:0};this.visible=true;}
 }
 const THREE={Mesh,BufferGeometry:Geometry,BoxGeometry:Geometry,RingGeometry:Geometry,
  CircleGeometry:Geometry,ShaderMaterial:Material,MeshLambertMaterial:Material,
  MeshBasicMaterial:Material,Float32BufferAttribute:Attribute,DoubleSide:2,FrontSide:0};
 D.attachFloor(THREE,project,scene,0,1);
 const floor=scene.children.find(m=>m.name==='fh_drain_solid_canal_solid');
 const grate=scene.children.find(m=>m.name==='fh_drain_grate_puente_reja');
 assert.ok(floor&&grate,'El piso y el puente deben existir como mallas 3D con volumen');
 assert.ok(floor.geometry.attributes.normal,'Paredes y suelo tienen normales y reciben luz');
 assert.ok(grate.geometry.attributes.normal,'La reja tiene barras de volumen');
 const coords=floor.geometry.attributes.position.values;
 const heightValues=Array.from({length:coords.length/3},(_,i)=>coords[i*3+1]);
 assert.ok(heightValues.some(y=>Math.abs(y-D.CHANNEL_BOTTOM)<1e-5),
  'La cara superior del fondo coincide con la altura que pisa el jugador');
 assert.ok(heightValues.some(y=>Math.abs(y)<1e-5),'Hay paredes laterales hasta la banqueta');
 const grateCoords=grate.geometry.attributes.position.values;
 const grateY=Array.from({length:grateCoords.length/3},(_,i)=>grateCoords[i*3+1]);
 assert.ok(grateY.some(y=>Math.abs(y-D.BRIDGE_TOP)<1e-5),
  'La reja visible y el soporte del jugador están a la misma altura');
 let totalTopArea=0;
 for(let i=0;i<grateCoords.length;i+=24*3){
  const xs=[],zs=[];
  for(let k=0;k<4;k++){xs.push(grateCoords[i+k*3]);zs.push(grateCoords[i+k*3+2]);}
  totalTopArea+=(Math.max(...xs)-Math.min(...xs))*(Math.max(...zs)-Math.min(...zs));
 }
 assert.ok(totalTopArea<bridge.w*bridge.h*.7,
  'Más del 30% del puente es hueco: no es una placa con franjas pintadas');
});
test('corte de suelos: caché del motor sin impedir cambios del editor',()=>{
 const a=section('straight',0,0,'a'),p=map([[a]]);
 const r=[{x:0,y:0,w:10,h:10}];
 const cached=D.cutFloorRects(p,0,r,true);
 assert.equal(cached.reduce((n,rect)=>n+rect.w*rect.h,0),60);
 assert.equal(D.cutFloorRects(p,0,r,true).reduce((n,rect)=>n+rect.w*rect.h,0),60);
 a.y=50; // El editor necesita ver inmediatamente el cambio, sin caché.
 assert.deepEqual(D.cutFloorRects(p,0,r),r);
 const noDrain=map([[{id:'solo',type:'chair',x:0,y:0}]]);
 assert.deepEqual(D.cutFloorRects(noDrain,0,r,true),r);
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
 for(const marker of ['function addDrainGeometryToEngine(','cutFloorRects(DATA,f,rects,true)',
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

test('THREE real: la cresta de inundación no cubre las barras del puente',()=>{
 const THREE=require('./vendor/three.min.js'),scene=new THREE.Group();
 const small=section('small',20,20,'rain'),bridge=D.makeBridge({x:22,y:22},units,'grate');
 const p=map([[small,bridge]]),CELL=1.524;
 D.attachFloor(THREE,p,scene,0,CELL);D.updateVisuals(.05,1,0);
 const flood=scene.children.find(m=>m.material.isShaderMaterial&&m.position.y>0);
 assert.ok(flood?.visible,'La lluvia sigue inundando la banqueta');
 const scales=flood.geometry.getAttribute('aWaveScale')?.array||[1];
 const crest=flood.position.y+flood.material.uniforms.uWave.value*Math.max(...scales);
 assert.ok(crest<D.BRIDGE_TOP*CELL,'La cresta máxima debe quedar debajo de los pies y la reja');
 assert.match(flood.material.vertexShader,/uWave\*aWaveScale\*heightMask/);
 scene.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(22*CELL,2*CELL,22*CELL),new THREE.Vector3(0,-1,0));
 const grate=scene.children.find(m=>m.name==='fh_drain_grate_grate');
 assert.ok(Math.abs(ray.intersectObject(grate)[0].point.y-D.supportAt(p,0,{x:22,y:22})*CELL)<1e-6);
});

test('desagüe: contacto, apoyo, recorte y superficie comparten el mismo contorno',()=>{
 const out=section('outfall',0,0,'edge'),p=map([[out]]);
 const channels=D.channelRects(out);
 let wet=0,dry=0;
 for(let yi=0;yi<80;yi++)for(let xi=0;xi<80;xi++){
  const point={x:(xi+.37)/4,y:(yi+.61)/4};
  const inChannel=channels.some(r=>point.x>=r.x&&point.x<r.x+r.w&&point.y>=r.y&&point.y<r.y+r.h);
  assert.equal(!!D.waterAt(p,0,point),inChannel,JSON.stringify(point));
  assert.equal(D.supportAt(p,0,point),inChannel?D.CHANNEL_BOTTOM:0);
  if(inChannel)wet++;else dry++;
 }
 assert.ok(wet>0&&dry>0);
});

test('THREE real: bordes continuos compactos y conexiones parciales sin tabiques',()=>{
 const THREE=require('./vendor/three.min.js');
 const main=section('straight',0,0,'main'),small=section('small',10,3.75,'partial');
 const single=new THREE.Group();D.attachFloor(THREE,map([[main]]),single,0,1);
 const solid=single.children.find(m=>m.name==='fh_drain_solid_main');
 assert.ok(solid.geometry.getAttribute('position').count<=120,
  'El tramo recto usa un fondo y cuatro bordes, sin cajas cada medio tile');
 const connected=new THREE.Group();D.attachFloor(THREE,map([[main,small]]),connected,0,1);
 connected.updateMatrixWorld(true);
 const left=connected.children.find(m=>m.name==='fh_drain_solid_main');
 const cast=y=>new THREE.Raycaster(new THREE.Vector3(9.8,-.2,y),new THREE.Vector3(1,0,0),0,.4).intersectObject(left);
 assert.equal(cast(5.3).length,0,'La parte abierta no se cierra aunque su borde no coincida con medio tile');
 assert.ok(cast(5.6).length>0,'La pared se conserva justo fuera de la conexión');
 const bottomRay=new THREE.Raycaster(new THREE.Vector3(8,1,5),new THREE.Vector3(0,-1,0));
 assert.ok(Math.abs(bottomRay.intersectObject(left)[0].point.y-D.CHANNEL_BOTTOM)<1e-6,
  'El fondo físico coincide con el apoyo usado por el actor');
});
