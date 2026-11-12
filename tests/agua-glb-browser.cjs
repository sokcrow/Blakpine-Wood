'use strict';
/* Prueba REAL de carga WebGL en Chromium (GitHub Actions), sin muebles simulados. */
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.glb':'model/gltf-binary','.png':'image/png','.json':'application/json'};
const server=http.createServer((req,res)=>{
 let file;
 try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}
 catch{res.writeHead(400).end();return;}
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.stat(file,(err,stat)=>{
  if(err||!stat.isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
 });
});
async function main(){
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port,base='http://127.0.0.1:'+port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:[
   '--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
   '--disable-gpu-sandbox','--no-sandbox']});
  const page=await browser.newPage({viewport:{width:800,height:700}});
  const errors=[],files=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',msg=>{if(msg.type()==='error')errors.push('console: '+msg.text());});
  page.on('response',response=>{
   if(response.url().endsWith('.glb'))
    files.push({url:response.url(),status:response.status()});
  });
  await page.goto(base+'/tests/agua-glb-browser.html',{waitUntil:'load',timeout:30000});
  const result=await page.evaluate(async()=>await window.__aguaSmoke);
  assert.equal(result.models,11,'10 GLB originales y una caldera legada');
  assert.equal(result.meshCount,11);
  assert.equal(result.textures,11);
  assert.equal(result.fow,11);
  assert.ok(result.coloredPixels>500,'WebGL renderizó la malla de caldera');
  assert.equal(files.length,10,'cargador cachea el GLB compartido con el objeto legado');
  assert.ok(files.every(x=>x.status===200),JSON.stringify(files));
  assert.deepEqual(errors,[],JSON.stringify(errors));
  await page.screenshot({path:path.join(root,'agua-glb-browser.png')});
  console.log('PASS: GLTFLoader r128 y WebGL cargan/renderizan los 10 GLB auténticos');
  console.log(JSON.stringify({models:result.models,meshes:result.meshCount,
   textures:result.textures,fow:result.fow,coloredPixels:result.coloredPixels,
   downloadedGLBs:files.length,renderer:result.renderer},null,2));
 }finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
 }
}
main().catch(e=>{console.error('FAIL: carga real de GLB en Chromium',e);process.exitCode=1;});
