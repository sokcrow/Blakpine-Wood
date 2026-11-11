'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
require('./fh-roads-strings.js');
const R=require('./fh-roads.js');
const units={columns:120,rows:120,feetPerCell:5};
const road=(id,a={x:5,y:30},b={x:90,y:30},config={})=>R.makeRoad(a,b,config,units,id);
const crossing=()=>[road('h'),road('v',{x:40,y:5},{x:40,y:90})];
const editor=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
function shared(){const start=editor.indexOf('const ForestShared=(()=>{'),end=editor.indexOf("\n'use strict';",start),c=vm.createContext({window:{},console});vm.runInContext(editor.slice(start,end),c);return vm.runInContext('ForestShared',c);}
function project(items){return {schema:'forest-horror-map-v1',version:2,title:'Prueba vial',units,floors:[{id:'ground',name:'PB',elevationFt:0,ceilingHeightFt:10,items}]};}
test('calle de 2 carriles: 20 pies de calzada y banquetas de 5 pies',()=>{
 const r=road('r');assert.equal(r.h,4);assert.deepEqual(R.footprint(r,units),{x:5,y:27,w:85,h:6});assert.equal(R.lanes(r,units).length,2);
});
test('presets de 4 y 6 carriles, calle de un sentido y reparto asimétrico',()=>{
 for(const n of [2,3]){const r=road('r',undefined,undefined,{forwardLanes:n,reverseLanes:n});assert.equal(R.lanes(r,units).length,n*2);assert.equal(r.h,n*4);}
 const r=road('r',undefined,undefined,{forwardLanes:3,reverseLanes:0});assert.ok(R.lanes(r,units).every(l=>l.direction==='forward'));
 assert.equal(R.lanes(road('a',undefined,undefined,{forwardLanes:3,reverseLanes:1}),units).filter(l=>l.direction==='reverse').length,1);
});
test('circulación por la derecha en las cuatro orientaciones del eje',()=>{
 for(const [a,b] of [[{x:10,y:30},{x:90,y:30}],[{x:90,y:30},{x:10,y:30}],[{x:30,y:10},{x:30,y:90}],[{x:30,y:90},{x:30,y:10}]]){
  const r=road('r',a,b),forward=R.lanes(r,units).find(l=>l.direction==='forward'),dx=b.x-a.x,dy=b.y-a.y;
  assert.ok(dx*(forward.from.y-a.y)-dy*(forward.from.x-a.x)>0,'El carril de ida está a la derecha del eje');
  assert.deepEqual(R.endpoints(r),{a,b});
 }
});
test('escala física configurable y validación estricta de dimensiones',()=>{
 assert.equal(R.makeRoad({x:5,y:30},{x:30,y:30},{}, {...units,feetPerCell:10},'r').h,2);
 for(const c of [{forwardLanes:1.5},{forwardLanes:0,reverseLanes:0},{laneWidthFt:NaN},{speedKmh:Infinity},{sidewalkFt:-1},{forwardLanes:12,reverseLanes:1}])assert.throws(()=>road('r',undefined,undefined,c));
 assert.throws(()=>road('r',{x:4,y:4},{x:5,y:4}),e=>e.code==='short');
});
test('la banqueta también debe caber y nuevas calles respetan máximo de 120',()=>{
 assert.throws(()=>road('r',{x:0,y:1},{x:120,y:1}),e=>e.code==='bounds');
 assert.throws(()=>R.makeRoad({x:5,y:30},{x:125,y:30},{},{...units,columns:500},'r'),e=>e.code==='bounds');
 assert.ok(road('r',{x:0,y:3},{x:120,y:3}));
});
test('intersecciones X y T se detectan; no se conectan pisos ni calles paralelas por proximidad',()=>{
 const list=crossing();assert.equal(R.junctions(list).length,1);assert.equal(R.junctions(list)[0].x,40);
 const t=road('t',{x:40,y:30},{x:40,y:90});assert.equal(R.junctions([list[0],t]).length,1);
 assert.equal(R.junctions([list[0],road('near',{x:5,y:35},{x:90,y:35})]).length,0);
});
test('red detecta cruces sin control, solapes paralelos y tramos aislados',()=>{
 assert.equal(R.audit(crossing(),units).issues[0].code,'uncontrolled');
 const h=road('h'),parallel=road('p',{x:10,y:31},{x:80,y:31}),island=road('i',{x:5,y:100},{x:90,y:100});
 const codes=R.audit([h,parallel,island],units).issues.map(x=>x.code);assert.ok(codes.includes('parallel'));assert.ok(codes.includes('disconnected'));
});
test('continuación por extremos compartidos y referencias de carriles estables',()=>{
 const a=road('a',{x:5,y:30},{x:40,y:30}),b=road('b',{x:40,y:30},{x:90,y:30});
 const graph=R.audit([a,b],units);assert.deepEqual(graph.connections,[['a','b']]);assert.equal(graph.issues.length,0);assert.equal(graph.lanes[0].id,'a:lane:0');
});
test('alto: primero en llegar, luego horario y cruce libre; no se coloca fuera del cruce',()=>{
 const list=crossing(),stop=R.makeControl('stop',{x:40,y:30},{stopSeconds:1.5},list,'stop');
 assert.equal(stop.roadControl.priority,'first-arrival-then-clockwise');assert.equal(stop.roadControl.skipEmpty,true);assert.equal(stop.roadControl.requireClearExit,true);
 assert.equal(R.audit([...list,stop],units).issues.length,0);
 assert.throws(()=>R.makeControl('stop',{x:10,y:30},{},list,'s'),e=>e.code==='missingJunction');
});
test('semáforo conserva fases, tiempos y desfase de coordinación; duplicados se diagnostican',()=>{
 const list=crossing(),s=R.makeControl('signal',{x:40,y:30},{greenSeconds:30,offsetSeconds:12},list,'s');
 assert.equal(s.roadControl.phases.length,6);assert.equal(s.roadControl.allRedSeconds,1);assert.equal(s.roadControl.offsetSeconds,12);
 assert.ok(R.audit([...list,s,{...s,id:'s2'}],units).issues.some(x=>x.code==='duplicate'));
 for(const c of [{greenSeconds:0},{allRedSeconds:0},{offsetSeconds:NaN}])assert.throws(()=>R.makeControl('signal',{x:40,y:30},c,list,'bad'));
});
test('límites por sentido, pasos y portales quedan vinculados al tramo correcto',()=>{
 const r=road('r'),speed=R.makeControl('speed',{x:25,y:29},{speedKmh:25,direction:'reverse'},[r],'speed');
 assert.equal(speed.roadControl.roadId,'r');assert.equal(speed.roadControl.direction,'reverse');assert.equal(speed.roadControl.speedKmh,25);
 const portal=R.makeControl('portal',{x:89,y:30},{},[r],'portal');assert.deepEqual({x:portal.x,y:portal.y},R.endpoints(r).b);
 assert.equal(R.makeControl('crosswalk',{x:25,y:30},{},[r],'walk').blocksMovement,false);
 assert.throws(()=>R.makeControl('speed',{x:25,y:60},{},[r],'s'),e=>e.code==='missingRoad');
});
test('señal huérfana y cruce desplazado aparecen en revisión',()=>{
 const list=crossing(),s=R.makeControl('stop',{x:40,y:30},{},list,'s');
 assert.ok(R.audit([list[0],s],units).issues.some(x=>x.code==='orphan'));
 assert.ok(R.audit([{...list[0],y:50},list[1],s],units).issues.some(x=>x.code==='orphan'));
});
test('contrato real del editor acepta y conserva calles, controles y mapas anteriores',()=>{
 const S=shared(),list=crossing(),s=R.makeControl('signal',{x:40,y:30},{},list,'s');
 const p=project([...list,s]);assert.equal(R.validateProject(p),true);assert.equal(S.validate(p).ok,true);
 const restored=S.loadProject(JSON.parse(JSON.stringify(p)));assert.equal(JSON.stringify(restored),JSON.stringify(p));
 const legacy=project([{id:'legacy',type:'asphalt',x:0,y:0,w:10,h:10}]);assert.equal(R.validateProject(legacy),true);assert.equal(S.validate(legacy).ok,true);
});
test('topología se deriva sin mutar items ni añadir campos a mapas anteriores',()=>{
 const p=project(crossing()),before=JSON.stringify(p);R.audit(p.floors[0].items,units);assert.equal(JSON.stringify(p),before);
 assert.throws(()=>R.validateProject(project([{...road('r'),h:9}])));
});
// DOM mínimo para ejercitar los manejadores reales sin navegador ni librerías nuevas.
function setupEditor(){
 const nodes=new Map(),floor={items:[]},project={units,floors:[floor]},messages=[];let anchor=null,records=0,next=0,modalHtml='';
 function node(){let value='';return {get value(){return value;},set value(v){value=String(v);},style:{},append(){},textContent:''};}
 const document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:()=>node()};
 const root={FHRoads:R,FH_ROAD_TEXT:globalThis.FH_ROAD_TEXT,FHStyleEditor:{hasActor:()=>false}};
 const context=vm.createContext({globalThis:root,document,console});vm.runInContext(fs.readFileSync(path.join(__dirname,'fh-roads-editor.js'),'utf8'),context);
 const api=root.FHRoadEditor;api.install({project:()=>project,current:()=>floor,newId:()=>`r${++next}`,record:()=>records++,render(){},inspect(){},closeModal(){},toast:m=>messages.push(m),
  anchor:function(v){if(arguments.length)anchor=v;return anchor;},modal(html,callback){modalHtml=html;nodes.clear();for(const match of html.matchAll(/<input[^>]*id="([^"]+)"[^>]*value="([^"]*)"/g))document.getElementById(match[1]).value=match[2];for(const match of html.matchAll(/<select id="([^"]+)"/g))document.getElementById(match[1]);callback();}});
 return {api,root,floor,nodes,messages,records:()=>records,html:()=>modalHtml};
}
test('herramienta real: dos toques, error sin mutación, undo registra una operación por calle',()=>{
 const e=setupEditor();e.api.place('road_draw',{x:5,y:30});assert.equal(e.floor.items.length,0);
 e.api.place('road_draw',{x:90,y:30});assert.equal(e.floor.items.length,1);assert.equal(e.records(),1);
 e.api.place('road_draw',{x:5,y:1});e.api.place('road_draw',{x:90,y:1});assert.equal(e.floor.items.length,1);assert.equal(e.records(),1);
 e.root.FHStyleEditor.hasActor=()=>true;e.api.place('road_draw',{x:20,y:60},{x:5,y:60},true);assert.equal(e.floor.items.length,1);
});
test('formularios: preset 6, edición de extremos y actualización de señal de tramo',()=>{
 const e=setupEditor();e.api.settings();e.nodes.get('roadPreset').value='6';e.nodes.get('roadPreset').onchange();e.nodes.get('roadSave').onclick();
 e.api.place('road_draw',{x:5,y:30});e.api.place('road_draw',{x:90,y:30});let r=e.floor.items[0];assert.equal(r.road.forwardLanes,3);
 e.floor.items.push(R.makeControl('speed',{x:25,y:30},{speedKmh:25},[r],'s'));
 e.api.settings(r);e.nodes.get('roadAy').value='40';e.nodes.get('roadBy').value='40';e.nodes.get('roadSave').onclick();
 assert.equal(e.floor.items[1].y,40);assert.equal(e.floor.items[1].roadControl.speedKmh,25);assert.equal(e.records(),2);
});
test('formularios: alto y semáforo se guardan y no se duplican en un cruce',()=>{
 const e=setupEditor();e.floor.items=crossing();e.api.place('road_stop',{x:40,y:30},null,false);e.nodes.get('roadSave').onclick();assert.equal(e.floor.items.length,3);
 e.api.place('road_signal',{x:40,y:30},null,false);e.nodes.get('roadSave').onclick();assert.equal(e.floor.items.length,3);assert.equal(e.records(),1);
 e.api.beforeRemove(e.floor.items[0]);assert.equal(e.floor.items.filter(R.isControl).length,0);
});
test('formulario rechaza vacíos y valores inválidos sin cambiar configuración ni mapa',()=>{
 const e=setupEditor();e.api.settings();e.nodes.get('roadWidth').value='';e.nodes.get('roadSave').onclick();assert.equal(e.api.config.laneWidthFt,10);assert.equal(e.records(),0);
 e.floor.items=crossing();e.api.place('road_signal',{x:40,y:30},null,false);e.nodes.get('roadGreen').value='-1';e.nodes.get('roadSave').onclick();assert.equal(e.floor.items.length,2);
});
test('adaptador carga el módulo vial e impide representar señales como muebles',()=>{
 assert.match(editor,/styleCore\+styleRender\+parkingScript\+roadsScript/);assert.match(editor,/window.FHRoads\?\.attachFloor\(THREE,DATA,stories\[f\],f,CELL\)/);
 assert.ok(editor.includes("'wood_floor','parking_decal','opening','spawn'].includes(it.type)&&!it.roadControl"));
 assert.match(editor,/FHRoadEditor\?\.inspector\(it,fields\)/);assert.match(editor,/FHRoads\?\.validateProject\(obj\)/);
});
test('deshacer y rehacer conservan configuración vial con el historial real del editor',()=>{
 const start=editor.indexOf('function record(){'),end=editor.indexOf('\nfunction ',start+10);
 const code=editor.slice(start,end),p=project(crossing());
 const context=vm.createContext({project:p,history:[],historyIndex:-1,floorIndex:0,activeLayer:'architecture',
  rememberFloorRefs(){},syncStairLinks(){},normalizeArchitecture(){},rebuildFloorSpaces(){return [];},syncPropertyDoorRoles(){},saveSoon(){},render(){},refreshCircuits(){}});
 vm.runInContext(code,context);context.record();const first=context.history[0];
 p.floors[0].items.push(R.makeControl('stop',{x:40,y:30},{},p.floors[0].items,'s'));context.record();
 const second=context.history[1];assert.equal(JSON.parse(first).floors[0].items.length,2);assert.equal(JSON.parse(second).floors[0].items.length,3);
 assert.deepEqual(JSON.parse(second).floors[0].items[2].roadControl,p.floors[0].items[2].roadControl);
 // Historia usa la misma serialización de pisos que restauran undo/redo.
 assert.match(editor,/function undo\(/);assert.match(editor,/function redo\(/);
});
test('vista 3D añade superficie vial sin muebles falsos ni luces dinámicas',()=>{
 const oldDocument=globalThis.document;
 const ctx={scale(){},fillRect(){},strokeRect(){},beginPath(){},rect(){},clip(){},save(){},restore(){},translate(){},rotate(){},setLineDash(){},moveTo(){},lineTo(){},stroke(){},fill(){},fillText(){},closePath(){}};
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
 class Mesh{constructor(geometry,material){this.geometry=geometry;this.material=material;this.rotation={};this.position={set:(...p)=>this.at=p};}}
 const THREE={CanvasTexture:class{constructor(image){this.image=image;}},Mesh,PlaneGeometry:class{constructor(w,h){this.width=w;this.height=h;}},MeshBasicMaterial:class{constructor(c){Object.assign(this,c);}},NearestFilter:1,sRGBEncoding:2,DoubleSide:3};
 try{
  const p=project(crossing()),children=[],mesh=R.attachFloor(THREE,p,{add:item=>children.push(item)},0,1.524);
  assert.equal(children.length,1);assert.equal(mesh.geometry.width,120*1.524);assert.equal(mesh.material.depthWrite,false);
  assert.ok(mesh.at[1]>.039&&mesh.at[1]<.064);assert.ok(mesh.renderOrder<8,'El asfalto se dibuja antes de las marcas existentes de estacionamiento');assert.ok(mesh.material.map.image.width<=2048);assert.equal(mesh.material.map.minFilter,THREE.NearestFilter);
  assert.equal(R.attachFloor(THREE,project([]),{add(){}},0,1.524),null);
 }finally{globalThis.document=oldDocument;}
});
