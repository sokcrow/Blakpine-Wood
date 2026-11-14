/* node tests/forest-browser.cjs — Chromium y GLTFLoader r128 reales; sin servicios externos. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),prepare=require('./helpers/forest-engine.cjs');
const root=path.resolve(__dirname,'..'),prepared=prepare().html;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.png':'image/png','.json':'application/json','.glb':'model/gltf-binary'};
const server=http.createServer((req,res)=>{
 const base='http://127.0.0.1:'+server.address().port,url=new URL(req.url,base);
 if(url.pathname==='/__forest-engine'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(prepared.replaceAll('https://example.test/',base+'/'));return;}
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.stat(file,(error,stat)=>{if(error||!stat.isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);});
});
(async()=>{
 let browser;
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-sandbox','--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1000,height:750}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base+'/index.html',{waitUntil:'load',timeout:60000});
  await page.locator('#fhForestSettings').click();await page.locator('#fhForestEnabled').check();
  await page.locator('#fhForestPreview').click();assert.match(await page.locator('#fhForestSummary').innerText(),/árboles/);
  await page.locator('#fhForestSave').click();
  const map=await page.evaluate(()=>{
   const m=newProject();m.title='Prueba bosque 3D';m.createdAt='2026-11-14T00:00:00Z';m.floors=m.floors.slice(0,1);m.units.columns=80;m.units.rows=80;
   m.floors[0].items=[{id:'spawn',type:'spawn',x:5,y:5,rotation:0}];m.weather={enabled:false};m.environment=FHTerrain.config({enabled:true,forest:{density:1}});
   return m;
  });
  // Carga normal del motor, por su contrato de mensajes del editor.
  await page.goto(base+'/__forest-engine',{waitUntil:'load',timeout:60000});
  await page.evaluate(map=>window.postMessage({type:'FOREST_PREVIEW_MAP',project:map},'*'),map);
  await page.waitForFunction(()=>!!window.ForestHorrorGame,{timeout:30000});
  await page.evaluate(()=>window.FHForestVisualRuntime.ready);
  const result=await page.evaluate(async()=>{
   const f=FHForestRuntime,v=FHForestVisualRuntime,api=ForestHorrorEnvironmentAPI,g=ForestHorrorGame,tree=f.trees.find(t=>t.radius>.4);
   const blocked=!g.canWalk(tree.x,tree.z),slot=v.slots.get(tree.id)[0],matrix=new THREE.Matrix4();slot.mesh.getMatrixAt(slot.index,matrix);
   const oldCount=f.trees.length,removed=api.removeTree(tree.id),walkable=g.canWalk(tree.x,tree.z),saved=structuredClone(g.gameState),after=new THREE.Matrix4();slot.mesh.getMatrixAt(slot.index,after);
   const sourceMap=structuredClone(g.data),again=FHForest.createRuntime(sourceMap,saved),fresh=FHForest.createRuntime(sourceMap,{});
   const catalog=await (await fetch('/forest-horror/biblioteca/vegetacion/catalogo_vegetacion.json')).json(),loader=new THREE.GLTFLoader(),heights=[];
   for(const model of catalog.models){
    const glb=await new Promise((resolve,reject)=>loader.load('/forest-horror/biblioteca/vegetacion/'+model.archivo,resolve,undefined,reject));
    glb.scene.scale.setScalar(.3048);glb.scene.updateMatrixWorld(true);const size=new THREE.Box3().setFromObject(glb.scene).getSize(new THREE.Vector3());heights.push({id:model.id,actual:size.y,expected:model.heightM});
    glb.scene.traverse(n=>{n.geometry?.dispose();for(const m of Array.isArray(n.material)?n.material:[n.material])m?.dispose();});
   }
   // Forzar compilación de los materiales instanciados, además del render normal.
   const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,1,.1,200),parent=new THREE.Group();scene.add(parent);parent.add(v.group.clone());scene.add(new THREE.AmbientLight(0xffffff));
   camera.position.set(60,45,110);camera.lookAt(60,0,60);const renderer=new THREE.WebGLRenderer();renderer.setSize(256,256);renderer.compile(scene,camera);renderer.render(scene,camera);const drawCalls=renderer.info.render.calls;renderer.dispose();
   return {trees:oldCount,blocked,removed,walkable,remaining:f.trees.length,hidden:after.elements[0]===0&&after.elements[5]===0&&after.elements[10]===0,
    reloadAbsent:again.getTree(tree.id)===null,freshPresent:!!fresh.getTree(tree.id),mapUnchanged:!g.data.environment.forest.exclusions.includes(tree.id),
    sectors:f.sectors.size,batches:v.batches.size,drawCalls,heights,initialY:matrix.elements[13]};
  });
  assert.ok(result.trees>50);for(const key of ['blocked','removed','walkable','hidden','reloadAbsent','freshPresent','mapUnchanged'])assert.ok(result[key],key);
  assert.equal(result.remaining,result.trees-1);assert.ok(result.drawCalls>0);for(const h of result.heights)assert.ok(Math.abs(h.actual-h.expected)<.001,JSON.stringify(h));
  assert.deepEqual(errors,[],JSON.stringify(errors));
  console.log('PASS: editor, arranque del motor, 12 GLB en metros, instancias/FOW, colisión y retirada persistente');console.log(JSON.stringify(result));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
