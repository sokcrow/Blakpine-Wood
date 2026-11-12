'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const services=require('./fh-services-core.js');
const ROOT=path.resolve(__dirname,'../..');
const editor=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const source=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
function catalog(){const window={};vm.runInNewContext(source('fh-electric-catalog.js'),{window});return window.FHElectricCatalog;}
function shared(){
 const context=vm.createContext({window:{},console});
 const start=editor.indexOf('const ForestShared=(()=>{'),end=editor.indexOf("\n'use strict';",start);
 vm.runInContext(editor.slice(start,end)+'\nthis.shared=ForestShared;',context);
 return context.shared;
}
function fixture({old=false,zoneId='',roomZone=''}={}){
 const wall={id:'wall',type:'wall',a:{x:0,y:0},b:{x:10,y:0}};
 const panel={id:'panel',type:'breaker_panel',x:0,y:0,circuits:[{id:'c',zoneId:'office',name:'Oficina',rangeFt:90}]};
 const room={id:'room',type:'room',roomId:'office-room',x:0,y:0,w:10,h:10,zoneId:roomZone};
 const outlet={id:'outlet',type:old?'misc':'power_outlet',x:2,y:0,zoneId,
  ...(old?{modelId:'enchufe_doble'}:{})};
 const pc={id:'pc',type:'table',pcTerminal:true,x:2,y:.3,roomId:room.roomId};
 const project={schema:'forest-horror-map-v1',units:{feetPerCell:5},floors:[{id:'f',items:[wall,panel,room,outlet,pc]}]};
 const state={flags:{}};
 return {project,state,wall,panel,room,outlet,pc,create:()=>services.createRuntime(project,state,{electricCatalog:catalog()})};
}
test('recupera enchufe guardado como mueble libre sin inferirlo por su nombre',()=>{
 for(const key of ['utilitySkin','modelId']){
  const cat=catalog(),item={id:'old',type:'misc',x:2,y:0,[key]:'enchufe_doble'};
  assert.equal(cat.normalizeItem(item),true);
  assert.equal(item.type,'power_outlet');assert.equal(item.utilitySkin,'enchufe_doble');
  assert.equal(item.modelId,undefined);assert.equal(item.slots,2);assert.equal(item.interact.verb,'use');
  assert.equal(cat.normalizeItem(item),false,'migración idempotente');
 }
 const item={type:'misc',label:'Enchufe doble inventado'};
 assert.equal(catalog().normalizeItem(item),false);assert.equal(item.type,'misc');
});
test('no cambia circuitos ni capacidades de breakers antiguos y respeta su tipo real',()=>{
 const cat=catalog(),panel={id:'panel',type:'breaker_panel',breakerType:'large',utilitySkin:'breaker_pequeno',rangeFt:77,circuits:[{zoneId:'a'}]};
 cat.normalizeItem(panel);assert.equal(panel.utilitySkin,'breaker_grande');assert.equal(panel.rangeFt,77);
 const legacy={id:'legacy',type:'breaker_panel'};cat.normalizeItem(legacy);
 assert.equal(legacy.rangeFt,undefined);assert.equal(legacy.breakerType,undefined);
});
test('enchufe nativo y legado reciben corriente sin escribir ID de enchufe ni circuito',()=>{
 for(const old of [false,true])for(const zoneId of ['', 'main'])for(const roomZone of ['', 'main','office']){
  const fx=fixture({old,zoneId,roomZone}),sys=fx.create();
  assert.equal(fx.outlet.type,'power_outlet');
  assert.equal(sys.statusFor(0,fx.outlet).power.powered,true);
  assert.equal(sys.statusFor(0,fx.pc).power.powered,true);
  assert.equal(sys.statusFor(0,fx.outlet).usedSlots,1);
  fx.state.flags.power_global=false;assert.equal(sys.statusFor(0,fx.pc).power.powered,false);
 }
});
test('la selección explícita no salta a otro circuito; no crea energía sin tablero',()=>{
 const fx=fixture({zoneId:'another-circuit'});let sys=fx.create();
 assert.equal(sys.statusFor(0,fx.outlet).power.powered,false);
 fx.outlet.zoneId='';fx.project.floors[0].items=fx.project.floors[0].items.filter(it=>it!==fx.panel);
 sys=fx.create();assert.equal(sys.statusFor(0,fx.outlet).power.powered,false);
});
test('retira multiconectores antiguos y recupera la conexión directa del aparato',()=>{
 for(const explicitParent of [false,true]){
  const fx=fixture(),strip={id:'strip',type:'power_strip',x:2,y:.2,...(explicitParent?{outletId:fx.outlet.id}:{})};
  fx.pc.outletId=strip.id;fx.project.floors[0].items.push(strip);
  const sys=fx.create();
  assert.ok(!fx.project.floors[0].items.some(item=>item.type==='power_strip'));
  assert.equal(fx.pc.outletId,explicitParent?fx.outlet.id:undefined);
  assert.equal(sys.statusFor(0,fx.pc).power.via,fx.outlet.id);
  assert.equal(sys.statusFor(0,fx.outlet).usedSlots,1);
  assert.equal(catalog().upgradeMap(fx.project),0,'migración idempotente');
 }
});
test('el multiconector ya no se ofrece en las herramientas ni en el selector de enchufes',()=>{
 const tools=editor.match(/^\s*lighting:\[.*$/m)?.[0];assert.ok(tools);
 assert.doesNotMatch(tools,/power_strip|Multiconector/);
 assert.match(editor,/source\.id!==it\.id&&source\.type==='power_outlet'/);
});
test('seleccionar el enchufe en el editor coloca un power_outlet con metadata GLB',()=>{
 const cat=catalog(),fx=fixture(),nodes=[];
 const node=tag=>{const n={tag,style:{},children:[],dataset:{},append(...v){this.children.push(...v);},appendChild(v){this.children.push(v);},setAttribute(){},addEventListener(){},replaceChildren(...v){this.children=v;},querySelector(){return null;},focus(){}};nodes.push(n);return n;};
 const window={FHElectricCatalog:cat,FH_ELECTRIC_TEXT:{}};
 const document={baseURI:'https://example.test/',head:node('head'),body:node('body'),createElement:node,querySelector(){return null;},getElementById(){return null;}};
 const ctx={window,document,URL,project:fx.project,ForestShared:shared(),current:()=>fx.project.floors[0],
  activeCategory:'lighting',setCategory(cat){ctx.activeCategory=cat;},chooseTool(type){ctx.activeTool=type;},
  createObject(type,p){return {id:'created',type,...p,rotation:0};},openInspector(){},toast(){},record(){},render(){}};
 vm.runInNewContext(source('fh-electric-editor.js'),ctx);
 window.FHElectricEditor.open();
 const choice=nodes.find(n=>n.tag==='button'&&n.children.some(child=>child.textContent==='Tomacorriente doble · 120 V'));
 assert.equal(new URL(choice.children.find(child=>child.tag==='img').src).searchParams.get('v'),'20261112-duplex-uv-1','renueva también la miniatura corregida');
 assert.ok(choice);choice.onclick();assert.equal(ctx.activeTool,'power_outlet');
 const item=ctx.createObject(ctx.activeTool,{x:2,y:.1});
 assert.equal(item.type,'power_outlet');assert.equal(item.utilitySkin,'enchufe_doble');assert.equal(item.wallId,'wall');
 assert.equal(item.slots,2);assert.equal(item.modelId,undefined);assert.equal(item.blocksMovement,false);
 assert.equal(window.FHElectricCatalog.modelFor(item).glb,'modelos_glb/enchufe_doble.glb');
});
test('el inspector ofrece conexión automática y opciones con nombres, sin campos de ID',()=>{
 const from=editor.indexOf('function attachServiceInspector('),to=editor.indexOf('\nfunction openInspector()',from);
 const fields=[],strings={};vm.runInNewContext(source('fh-services-strings.js'),{globalThis:strings});
 const context={window:{...strings,FHServices:services},current:()=>({items:[{id:'plug-id',type:'power_outlet',label:'Toma de oficina',x:2,y:3}]}),
  availableCircuits:()=>[],document:{createElement:()=>({style:{},append(){},querySelector(){return {}}})},
  makeField:(...args)=>{fields.push(args);return {querySelector(){return {}}};}};
 vm.runInNewContext(editor.slice(from,to),context);
 context.attachServiceInspector({id:'tv',type:'tv'}, {append(){}});
 const connection=fields.find(f=>f[1]==='outletId');assert.ok(connection);
 assert.equal(connection[3],'select');assert.equal(connection[4][0][0],'');
 assert.match(connection[4][0][1],/Automática/);assert.equal(connection[4][1][0],'plug-id');
 assert.equal(connection[4][1][1],'Toma de oficina · X 2 / Y 3');
 fields.length=0;
 context.attachServiceInspector({id:'outlet',type:'power_outlet',zoneId:'main'}, {append(){}});
 const circuit=fields.find(f=>f[1]==='zoneId');assert.equal(circuit[3],'select');
 assert.equal(circuit[2],'');assert.match(circuit[4][0][1],/Automático/);
});

function visualEnvironment({fail=false}={}){
 const THREE={...require('./vendor/three.min.js')},requests=[],warnings=[];
 // Node no decodifica imágenes. Se analiza el GLB real y sus materiales;
 // sólo la decodificación de la imagen incrustada se sustituye por una textura.
 THREE.TextureLoader=class extends THREE.Loader{
  load(url,done){const texture=new THREE.Texture();queueMicrotask(()=>done(texture));return texture;}
 };
 const document={baseURI:'https://example.test/',currentScript:{src:'https://example.test/juego/assets/fh-glb-bridge.js'}};
 const window={document,THREE,FHElectricCatalog:catalog()};
 const env={window,document,THREE,URL,Blob,TextDecoder,self:{URL},console:{warn(...args){warnings.push(args);},error(){}}};
 vm.runInNewContext(source('vendor/GLTFLoader.js'),env);
 const GLTFLoader=THREE.GLTFLoader;
 THREE.GLTFLoader=class extends GLTFLoader{
  load(url,done,progress,onError){
   requests.push(url);if(fail)return onError(Error('GLB no disponible'));
   const filepath=path.join(ROOT,new URL(url).pathname);
   const bytes=fs.readFileSync(filepath);
   this.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'',done,onError);
  }
 };
 vm.runInNewContext(source('fh-glb-bridge.js'),env);
 document.currentScript.src='https://example.test/juego/assets/fh-electric-visuals.js';
 vm.runInNewContext(source('fh-electric-visuals.js'),env);
 return {THREE,window,api:window.FHElectricVisuals,requests,warnings};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('el enchufe doble dibuja una toma en cada receptáculo y no repite contactos en la placa',()=>{
 const bytes=fs.readFileSync(path.join(ROOT,'forest-horror/biblioteca/electricidad/modelos_glb/enchufe_doble.glb'));
 const jsonLength=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
 const bin=bytes.subarray(20+jsonLength+8),primitive=doc.meshes[0].primitives[0];
 const positions=doc.accessors[primitive.attributes.POSITION],uv=doc.accessors[primitive.attributes.TEXCOORD_0];
 const posStart=doc.bufferViews[positions.bufferView].byteOffset+(positions.byteOffset||0);
 const uvStart=doc.bufferViews[uv.bufferView].byteOffset+(uv.byteOffset||0);
 const frontZ=positions.max[2],faces=[];
 for(let start=0;start<positions.count;start+=4){
  if(!Array.from({length:4},(_,i)=>bin.readFloatLE(posStart+(start+i)*12+8)).every(z=>Math.abs(z-frontZ)<1e-6))continue;
  faces.push(Array.from({length:4},(_,i)=>({u:bin.readFloatLE(uvStart+(start+i)*8),v:bin.readFloatLE(uvStart+(start+i)*8+4)})));
 }
 assert.equal(faces.length,2,'dos receptáculos geométricos');
 for(const face of faces){
  const minV=Math.min(...face.map(p=>p.v)),maxV=Math.max(...face.map(p=>p.v));
  assert.ok(minV<40/512&&maxV>50/512,'incluye la toma superior del atlas');
  assert.ok(maxV<68/512,'excluye la segunda toma del atlas');
 }
 const plateUV=Array.from({length:4},(_,i)=>[bin.readFloatLE(uvStart+(24+i)*8),bin.readFloatLE(uvStart+(24+i)*8+4)]);
 assert.ok(plateUV.every(uv=>uv[0]===plateUV[0][0]&&uv[1]===plateUV[0][1]),'la placa de fondo usa un texel liso, sin más contactos');
});
test('los ocho GLB eléctricos reales se analizan y sustituyen el provisional sobre la pared',async()=>{
 const {THREE,window,api,requests,warnings}=visualEnvironment();
 const wall={id:'wall',type:'wall',a:{x:0,y:0},b:{x:30,y:0}};
 const items=[wall,...window.FHElectricCatalog.models.map((m,i)=>({id:m.id,type:m.type,utilitySkin:m.id,
  x:2+i,y:0,rotation:0,...(m.id==='breaker_grande'?{breakerType:'large'}:{})}))];
 const story=new THREE.Group(),rendered=new Map(),old=new Map();
 for(const it of items.slice(1)){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2),new THREE.MeshStandardMaterial());
  story.add(mesh);old.set(it.id,mesh);rendered.set(it.id,[{root:mesh}]);
 }
 let masks=0;
 const entries=api.install({THREE,DATA:{floors:[{items,ceilingHeightFt:11.5}]},CELL:1.524,
  stories:[story],renderedByItem:[rendered],ForestShared:shared(),applyFOW:()=>masks++});
 for(let i=0;i<20&&entries.some(e=>e.root.userData.fhModelState!=='ready');i++)await settle();
 assert.equal(entries.length,8);assert.equal(requests.length,8);assert.equal(warnings.length,0);
 for(const entry of entries){
  assert.equal(entry.root.userData.fhModelState,'ready',entry.it.id);
  let meshes=0;entry.root.traverse(node=>{if(node.isMesh)meshes++;});assert.ok(meshes>0,entry.it.id);
  assert.equal(old.get(entry.it.id).parent,null,entry.it.id);
  assert.equal(rendered.get(entry.it.id)[0].root,entry.root);
 }
 const outlet=entries.find(e=>e.it.type==='power_outlet');
 assert.ok(Math.abs(outlet.root.position.y-.4572)<1e-6);
 assert.ok(outlet.root.position.z>0);assert.ok(masks>=8);
 assert.ok(requests.every(url=>url.startsWith('https://example.test/forest-horror/biblioteca/electricidad/modelos_glb/')));
 const outletURL=new URL(requests.find(url=>url.includes('enchufe_doble.glb')));
 assert.equal(outletURL.searchParams.get('v'),'20261112-duplex-uv-1','renueva el GLB anterior en caché');
});
test('el GLB del enchufe elimina el mueble libre superpuesto aunque el registro solo conserve el provisional',async()=>{
 const {THREE,api}=visualEnvironment(),fx=fixture(),sys=fx.create();
 const story=new THREE.Group(),rendered=new Map();
 const free=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());
 free.userData.fhItemId=fx.outlet.id;
 const service=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2),new THREE.MeshStandardMaterial());
 service.userData.fhServiceItem=fx.outlet.id;
 const neighbor=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());
 neighbor.userData.fhItemId='vecino';
 story.add(free,service,neighbor);
 // La infraestructura registraba sólo su último placeholder: el mueble quedó sin registrar.
 rendered.set(fx.outlet.id,[{root:service}]);
 const [entry]=api.install({THREE,DATA:{floors:[{items:[fx.wall,fx.outlet]}]},CELL:1.524,stories:[story],renderedByItem:[rendered],
  ForestShared:shared(),applyFOW(){}});
 for(let i=0;i<20&&entry.root.userData.fhModelState!=='ready';i++)await settle();
 assert.equal(entry.meta.id,'enchufe_doble');
 assert.equal(entry.root.userData.fhModelState,'ready');
 assert.equal(free.parent,null,'retira la representación anterior de mueble libre');
 assert.equal(service.parent,null,'retira el provisional de servicios');
 assert.equal(neighbor.parent,story,'no elimina otros muebles');
 assert.equal(story.children.length,2,'solo GLB y mueble vecino');
 assert.equal(rendered.get(fx.outlet.id)[0].root,entry.root);
 assert.equal(sys.statusFor(0,fx.outlet).slotCapacity,2);
 assert.equal(sys.statusFor(0,fx.pc).power.powered,true);
});
test('el adaptador de servicios reutiliza la malla existente del enchufe en vez de colocar otra encima',()=>{
 const code=source('fh-services-engine-hook.js');
 const section=code.slice(code.indexOf("'const fhServicesVisuals=[];'"),code.indexOf("'function fhServicesSyncVisuals(){'"));
 assert.ok(section.includes('if(it.type==="power_outlet")'));
 assert.ok(section.indexOf('const existing=renderedByItem[f]?.get?.(it.id)')>=0);
 assert.ok(section.indexOf('const existing=renderedByItem[f]?.get?.(it.id)')<section.indexOf('const mat=new THREE.MeshStandardMaterial'));
});
test('si falla el GLB del enchufe conserva el provisional morado y su identificación eléctrica',async()=>{
 const {THREE,api}=visualEnvironment({fail:true}),fx=fixture(),sys=fx.create();
 const story=new THREE.Group(),old=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({map:new THREE.Texture()}));
 const free=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());
 free.userData.fhItemId=fx.outlet.id;
 story.add(free,old);const rendered=new Map([[fx.outlet.id,[{root:old}]]]);
 const entries=api.install({THREE,DATA:{floors:[{items:[fx.wall,fx.outlet]}]},CELL:1.524,stories:[story],renderedByItem:[rendered],ForestShared:shared(),applyFOW(){}});
 await settle();
 assert.equal(entries[0].root.userData.fhModelState,'error');assert.equal(old.parent,story);
 assert.equal(free.parent,story,'si el GLB falla, no retirar el mueble previo');
 assert.equal(old.material.color.getHex(),0xb000ff);assert.equal(old.material.map,null);
 assert.equal(fx.outlet.type,'power_outlet');assert.equal(sys.statusFor(0,fx.pc).power.powered,true);
});
