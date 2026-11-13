'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Services=require('./fh-services-core.js');
const THREE=require('./vendor/three.min.js');
const Boilers=require('./fh-boilers-catalog.js');
const Storage=require('./fh-water-storage-catalog.js');
const visualsText=fs.readFileSync(path.join(__dirname,'fh-water-visuals.js'),'utf8');
const index=fs.readFileSync(path.resolve(__dirname,'../../index.html'),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function visualsLoader(){
 const requests=[],pending=[];
 const rendererThree={...THREE};
 rendererThree.GLTFLoader=class {
  load(url,done){requests.push(url);pending.push(()=>done({scene:new THREE.Group()}));}
 };
 const window={FHWaterCatalog:{models:[]},FHWaterStorageCatalog:Storage,
  FHBoilersCatalog:Boilers,
  document:{currentScript:{src:'https://example.test/juego/assets/fh-water-visuals.js'}}};
 vm.runInNewContext(visualsText,{window,URL,console});
 return {api:window.FHWaterVisuals,THREE:rendererThree,requests,pending};
}
function oldMesh(story,itemId,registered=true){
 const old=new THREE.Group();old.name='Mueble libre';
 if(registered)old.userData.fhItemId=itemId;
 story.add(old);return old;
}
test('un GLB hidráulico sustituye placeholders registrados, huérfanos y tardíos',async()=>{
 const {api,THREE:renderThree,requests,pending}=visualsLoader();
 const boiler={id:'boiler',type:'water_boiler',modelId:'calentador_domestico_vertical',
  x:4,y:.2,rotation:0,w:.4,h:1,blocksMovement:true};
 const DATA={floors:[{items:[boiler]}]},story=new THREE.Group();
 const registered=oldMesh(story,boiler.id,false),orphan=oldMesh(story,boiler.id);
 const other=oldMesh(story,'other');const rendered=new Map([[boiler.id,[{root:registered}]]]);
 const results=api.install({THREE:renderThree,DATA,CELL:1.524,stories:[story],
  renderedByItem:[rendered],ForestShared:{}});
 assert.equal(registered.parent,null);
 assert.equal(orphan.parent,null);
 assert.equal(other.parent,story,'no retirar muebles ajenos');
 const late=oldMesh(story,boiler.id);
 await tick();assert.equal(requests.length,1);
 assert.match(requests[0],/calderas\/modelos_glb\/calentador_domestico_vertical\.glb$/);
 pending[0]();await tick();
 const root=results[0].root;
 assert.equal(late.parent,null,'no reintroducir el mueble genérico al resolver el GLB');
 assert.equal(root.userData.fhModelState,'ready');
 assert.equal(root.children.length,1);
 assert.equal(root.position.x,boiler.x*1.524);
 assert.equal(root.position.z,boiler.y*1.524);
 assert.equal(rendered.get(boiler.id)[0].root,root);
 assert.equal(other.parent,story);
});
test('GLB de piso respeta exactamente el centro físico del JSON',()=>{
 const {api}=visualsLoader();
 const items=[{id:'w',type:'wall',a:{x:0,y:0},b:{x:12,y:0}}];
 const meta=Storage.byType('water_cistern'),it={id:'cis',type:'water_cistern',
  modelId:meta.id,x:3,y:.01,w:1.6,h:1,blocksMovement:true};
 const pose=api.mountPose(it,meta,items,1.524,{});
 assert.equal(pose.x,3*1.524);
 assert.equal(pose.z,.01*1.524,
  'el render 3D no desplaza solo el modelo y deja atrás la hitbox');
 assert.ok(api.floorPlacement(it,meta,items,1.524).y>.01,
  'el editor puede corregir la posición ANTES de guardar el objeto');
});
test('motor evita Mueble libre antes de construir proxies de pisos adyacentes',()=>{
 const {api}=visualsLoader();
 const furniture='function furniture(f,a){';
 const fake='<html><head></head><body>'+furniture+
  '\nfunction fhServicesSyncVisuals(){}\nhandle:(it,f)=>{\n  const service=window.FHServicesRuntime,T=window.FH_SERVICES_TEXT||{};'+
  '</body></html>';
 const output=api.patchEngineDoc(fake);
 assert.ok(output.includes(furniture+'\n if(window.FHWaterVisuals?.choose(a))return;'));
 assert.match(index,/PLAY_SOLID_OBJECTS=new Set\(\[[^\n]*'water_cistern','water_tinaco'/,
  'las reservas deben tener hitbox en la simulación 2D');
});
function electrics({outlet=true,direct=false,consumers=1}={}){
 const items=[
  {id:'wall',type:'wall',a:{x:0,y:0},b:{x:20,y:0}},
  {id:'breaker',type:'breaker_panel',x:0,y:0,circuits:[{zoneId:'a',rangeFt:160}]}
 ];
 if(outlet)items.push({id:'socket',type:'power_outlet',x:4,y:0,zoneId:'a',radiusFt:5});
 for(let i=0;i<consumers;i++)items.push({id:'heater'+i,type:i%2?'water_boiler_aux':'water_boiler',
  modelId:i%2?'bomba_recirculacion':'calentador_domestico_vertical',
  x:4,y:.2,zoneId:'a',blocksMovement:true,
  service:{requiresPower:true,powerConnection:'direct',maxWallDistanceFt:direct?10:0.1,
   watts:1200,powerCableFt:5,onDemand:false}});
 const game={services:{contracts:{electricity:'active',water:'active'}}};
 const runtime=Services.createRuntime({units:{feetPerCell:5},
  floors:[{id:'p0',items}]},game);
 return {items,game,runtime};
}
test('caldera y bomba usan enchufe válido si no alcanzan el breaker directamente',()=>{
 const {items,game,runtime}=electrics({consumers:2});
 for(const it of items.filter(x=>x.type==='water_boiler'||x.type==='water_boiler_aux')){
  const power=runtime.statusFor(0,it).power;
  assert.equal(power.powered,true);
  assert.equal(power.socket,true);
  assert.equal(power.via,'socket');
  assert.equal(power.breakerId,'breaker');
 }
 assert.equal(runtime.electrical().used.get('0:socket'),2);
 runtime.tick(1,1);
 assert.ok(game.services.meters.kwh>0);
 runtime.setService('electricity',false);
 assert.equal(runtime.statusFor(0,items.find(x=>x.id==='heater0')).power.powered,false);
});
test('la toma tiene límite de dos conexiones y no regala electricidad',()=>{
 const {items,runtime}=electrics({consumers:3});
 assert.equal(runtime.electrical().used.get('0:socket'),2);
 assert.equal(runtime.statusFor(0,items.find(x=>x.id==='heater2')).power.powered,false);
 const without=electrics({outlet:false});
 assert.equal(without.runtime.statusFor(0,without.items.find(x=>x.id==='heater0')).power.powered,false);
});
test('alimentación directa del breaker conserva su prioridad sin ocupar enchufes',()=>{
 const {items,runtime}=electrics({direct:true});
 const st=runtime.statusFor(0,items.find(x=>x.id==='heater0')).power;
 assert.equal(st.powered,true);
 assert.equal(st.direct,true);
 assert.equal(st.socket,false);
 assert.equal(runtime.electrical().used.get('0:socket')||0,0);
});
