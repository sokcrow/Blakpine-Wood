'use strict';
// Ejecutar: node tests/cctv-browser.cjs (Playwright sólo para desarrollo/CI).
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css','.glb':'model/gltf-binary','.png':'image/png','.json':'application/json'};
const server=http.createServer((req,res)=>{
 let file;
 try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}
 catch{res.writeHead(400).end();return;}
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.stat(file,(error,stat)=>{
  if(error||!stat.isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
 });
});
async function main(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl',
   '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:960,height:640}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',msg=>{if(msg.type()==='error'||msg.text().startsWith('[CCTV]'))errors.push(msg.text());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html',{waitUntil:'load'});
  await page.waitForFunction(()=>typeof prepareGLBEngineDoc==='function'&&!!window.FHCCTVEngine);
  await page.evaluate(()=>{
   project=newProject();project.title='Prueba CCTV';project.weather.enabled=false;
   project.units.columns=12;project.units.rows=12;
   project.floors[0].items=[
    {id:'building',type:'building',x:1,y:1,w:10,h:10},
    {id:'room',type:'room',x:1,y:1,w:10,h:10,label:'Sala de prueba'},
    {id:'spawn',type:'spawn',x:7,y:3,w:.4,h:.4},
    {id:'cam0',type:'misc',modelId:'camara_seguridad',cameraMode:'fixed',x:4,y:3,w:.3,h:.3,rotation:0},
    {id:'wall',type:'wall',a:{x:1,y:4.2},b:{x:11,y:4.2}}
   ];
   project.floors[1].items=[
    {id:'building1',type:'building',x:1,y:1,w:10,h:10},
    {id:'room1',type:'room',x:1,y:1,w:10,h:10},
    {id:'cam1',type:'misc',modelId:'camara_seguridad',cameraMode:'fixed',x:4,y:3,w:.3,h:.3,rotation:0}
   ];
   let doc=prepareGLBEngineDoc(decodeEmbedded3DEngine(PREVIEW_ENGINE_DOC_B64));
   doc=window.FHServicesEngine.patch(doc);
   doc=window.FHArchitectureSkins.patchEngineDoc(doc);
   doc=window.FHStructureHealthEngine.patch(doc);
   doc=window.FHBarriersEngine.patch(doc);
   doc=window.FHCCTVEngine.patch(doc);
   // Instrumentación sólo de prueba: observar el renderer real sin API de debug en producción.
   const anchor='function fhCCTVFrame(now){';
   if(doc.split(anchor).length!==2)throw Error('No se encontró captura CCTV');
   doc=doc.replace(anchor,`window.__cctv={capture:fhCCTVFrame,renderer,scene,get hero(){return hero},get shadow(){return shadow},
    mask:()=>sightUniform.value,natural:()=>fhCCTVNatural,
    cache:()=>JSON.stringify({visibilityDirty,visibilityLast,lastSightTime}),
    release:fhCCTVRelease,target:()=>fhCCTVTarget};\n`+anchor);
   window.__cctvMessages=[];
   const iframe=document.createElement('iframe');iframe.id='cctv-test';iframe.name='cctv-engine';
   iframe.style='position:fixed;inset:0;width:960px;height:640px;z-index:999999;background:black';
   const map=makeCurrent3DProject();
   window.addEventListener('message',event=>{
    if(event.source!==iframe.contentWindow)return;
    window.__cctvMessages.push(event.data);
    if(event.data?.type==='FOREST_PREVIEW_READY')iframe.contentWindow.postMessage({type:'FOREST_PREVIEW_MAP',project:map},'*');
   });
   document.body.append(iframe);iframe.srcdoc=doc;
  });
  try{
   await page.waitForFunction(()=>window.__cctvMessages.some(m=>m.type==='FOREST_PREVIEW_RUNNING'),{},{timeout:60000});
  }catch(error){
   console.error('Diagnóstico de arranque:',JSON.stringify({errors,messages:await page.evaluate(()=>window.__cctvMessages)}));
   throw error;
  }
  const frame=page.frame('cctv-engine');
  assert.ok(frame,'Iframe del motor real');
  const result=await frame.evaluate(async()=>{
   const t=window.__cctv,r=t.renderer;
   const state={power:true,mode:'on',front:'cams',camera:0,cameraQuality:'hd'};
   const frames=[],times=[];
   const pc={isOpen:true,session:{cameras:[{id:'cam0',online:true},{id:'cam1',online:true}]},
    terminalApi:()=>({getState:()=>state,receiveCameraPixels(f){
     let nonBlack=0;for(let i=0;i<f.pixels.length;i+=4)if(f.pixels[i]+f.pixels[i+1]+f.pixels[i+2]>0)nonBlack++;
     frames.push({id:f.id,width:f.width,height:f.height,nonBlack});
    }})};
   window.FHComputerRuntime=pc;
   const vector=()=>new THREE.Vector4();
   r.setViewport(3,4,800,500);r.setScissor(5,6,700,400);r.setScissorTest(true);
   const before={mask:t.mask(),cache:t.cache(),hero:t.hero.visible,shadow:t.shadow.visible,
    target:r.getRenderTarget(),viewport:r.getViewport(vector()).toArray(),scissor:r.getScissor(vector()).toArray(),
    stories:t.scene.children.map(o=>o.visible)};
   const capture=now=>{const start=performance.now();t.capture(now);times.push(performance.now()-start);};
   capture(1000000);
   const first=t.target();
   capture(1000016);
   if(frames.length!==1)throw Error('La captura ignora el límite de frecuencia');
   state.camera=1;capture(1000017);
   state.cameraQuality='normal';capture(1000018);
   const restored=t.mask()===before.mask&&t.cache()===before.cache&&t.hero.visible===before.hero&&
    t.shadow.visible===before.shadow&&r.getRenderTarget()===before.target&&r.getScissorTest()&&
    JSON.stringify(r.getViewport(vector()).toArray())===JSON.stringify(before.viewport)&&
    JSON.stringify(r.getScissor(vector()).toArray())===JSON.stringify(before.scissor)&&
    JSON.stringify(t.scene.children.map(o=>o.visible))===JSON.stringify(before.stories);
   pc.isOpen=false;capture(1000019);
   const released=t.target()===null;
   state.camera=0;state.cameraQuality='hd';pc.isOpen=true;capture(1000020);
   const recreated=t.target()!==null&&t.target()!==first;
   pc.isOpen=false;t.release();
   return {frames,restored,released,recreated,times,renderer:r.getContext().getParameter(r.getContext().RENDERER)};
  });
  assert.deepEqual(result.frames.map(f=>[f.id,f.width,f.height]),[
   ['cam0',960,552],['cam1',960,552],['cam1',640,368],['cam0',960,552]]);
  assert.ok(result.frames[0].nonBlack>0,'CCTV renderiza geometría real');
  assert.ok(result.restored,'Máscara, caché, actores, escena, viewport y scissor restaurados');
  assert.ok(result.released&&result.recreated,'Liberar y reconstruir recursos al cerrar/abrir');
  assert.deepEqual(errors,[]);
  console.log('PASS: arranque compuesto y captura CCTV con Three r128/WebGL reales');
  console.log(JSON.stringify(result,null,2));
  console.log('Los tiempos de SwiftShader no certifican 60 FPS en móvil.');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
