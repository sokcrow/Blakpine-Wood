/* Ejecutar: node juego/assets/fh-glb-bridge.test.js */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const library=path.resolve(__dirname,'../../forest-horror/biblioteca');
const main=JSON.parse(fs.readFileSync(path.join(library,'catalogo_muebles.json'),'utf8'));
const delivery=JSON.parse(fs.readFileSync(path.join(library,'catalogo_delivery.json'),'utf8'));
const source=fs.readFileSync(path.join(__dirname,'fh-glb-bridge.js'),'utf8');

function setup(deliveryDoc=delivery){
 let glbLoads=0,maskCalls=0;
 const errors=[];
 const scene={traverse(){},clone(){return {isGLB:true,traverse(){},position:{x:0,y:0,z:0}}}};
 const window={
  THREE:{NearestFilter:1,NearestMipmapNearestFilter:2,
   GLTFLoader:class{load(url,done){glbLoads++;done({scene})}}},
  FHFurnitureRules:{defaultFor:type=>type==='chair'?'silla_comedor':null},
  FHExteriorGrid:require('./fh-exterior-grid.js')
 };
 const document={currentScript:{src:'https://example.org/juego/assets/fh-glb-bridge.js'},baseURI:'https://example.org/index.html'};
 const fetch=async url=>({ok:true,json:async()=>url.includes('catalogo_delivery')?deliveryDoc:main});
 vm.runInNewContext(source,{window,document,fetch,URL,console:{warn(){},error(...args){errors.push(args)}}},
  {filename:'fh-glb-bridge.js'});
 return {assets:window.FHAssets,errors,mask:()=>maskCalls++,get glbLoads(){return glbLoads},get maskCalls(){return maskCalls}};
}
function group(){return {
 children:[{procedural:true}],userData:{},
 remove(object){this.children.splice(this.children.indexOf(object),1)},
 add(object){this.children.push(object)}
};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
let checks=0;
async function test(name,fn){await fn();checks++;console.log('OK',name)}
(async()=>{
 await test('Los tres modelos de delivery duplicados no invalidan los 86 GLB',async()=>{
  const {assets}=setup();
  const models=await assets.catalog();
  assert.equal(models.size,86);
  for(const entry of main.furniture)assert.ok(fs.existsSync(path.join(library,entry.glb)),entry.id);
 });
 await test('Una definición contradictoria sí se rechaza',async()=>{
  const bad=JSON.parse(JSON.stringify(delivery));
  bad.furniture[0].widthFt+=1;
  await assert.rejects(setup(bad).assets.catalog(),/Definiciones GLB contradictorias/);
 });
 await test('No queda placeholder mientras se carga el GLB y espera FOW',async()=>{
  const t=setup(),root=group();
  t.assets.attach(root,{type:'misc',modelId:'monitor_crt'});
  assert.equal(root.children.length,0);
  assert.equal(root.userData.fhModelState,'loading');
  await tick();
  assert.equal(root.children.length,0);
  t.assets.setSightMaskInstaller(t.mask);
  await tick();
  assert.equal(root.children.length,1);
  assert.equal(root.children[0].isGLB,true);
  assert.equal(root.userData.fhModelState,'ready');
  assert.equal(t.maskCalls,1);
  assert.equal(t.errors.length,0);
 });
 await test('Dos instancias comparten descarga y usan su propio visual GLB',async()=>{
  const t=setup();t.assets.setSightMaskInstaller(t.mask);
  const a=group(),b=group();
  t.assets.attach(a,{modelId:'teclado_pc'});
  t.assets.attach(b,{modelId:'teclado_pc'});
  await tick();
  assert.equal(t.glbLoads,1);
  assert.equal(a.children[0].isGLB,true);
  assert.equal(b.children[0].isGLB,true);
  assert.notEqual(a.children[0],b.children[0]);
 });
 await test('Los brazos se dibujan completos pero la base del poste queda centrada en su hitbox',async()=>{
  const t=setup();t.assets.setSightMaskInstaller(t.mask);
  const arm=group(),transformer=group(),other=group();
  t.assets.attach(arm,{type:'misc',modelId:'poste_luz_con_brazo'});
  t.assets.attach(transformer,{type:'misc',modelId:'transformador_poste_simple'});
  t.assets.attach(other,{type:'misc',modelId:'caja_distribucion_exterior'});
  await tick();
  assert.ok(Math.abs(arm.children[0].position.x-.695)<.002,'el tubo de la farola se centra');
  assert.ok(Math.abs(transformer.children[0].position.x-.475)<.002,'el tubo del transformador se centra');
  assert.equal(other.children[0].position.x,0,'las cajas no se desplazan');
  assert.equal(arm.children[0].isGLB,true,'sin deformar geometría');
 });
 await test('Los objetos sin modelo asignado no se inventan como GLB',async()=>{
  const t=setup(),root=group();t.assets.attach(root,{type:'plant'});
  assert.equal(root.children[0].procedural,true);
 });
 console.log(checks+' pruebas correctas');
})().catch(error=>{console.error(error);process.exitCode=1});
