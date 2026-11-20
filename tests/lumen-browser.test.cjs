// Optional integration suite: requires Playwright + Chromium, no Firebase credentials.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
test('Navegador: editor real, descarga portable, IndexedDB nativo y reapertura del perfil',{
 skip:process.env.LUMEN_BROWSER_TEST!=='1',timeout:120000
},async()=>{
 const {chromium}=require('playwright');
 const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'lumen-browser-'));
 const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/__lumen_test__'){res.setHeader('Content-Type','text/html');res.end('<meta charset="utf-8"><p id="cartridge-warning" hidden></p><main id="test-root"></main>');return;}
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}
   res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(data);});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const launch=()=>chromium.launchPersistentContext(profile,{headless:true,acceptDownloads:true,...(process.env.LUMEN_CHROMIUM_PATH?{executablePath:process.env.LUMEN_CHROMIUM_PATH}:{})});
 let browser;
 async function mount(page){
  await page.goto(origin+'/__lumen_test__');
  await page.evaluate(async()=>{
   const {mountMapLibrary}=await import('/portal/map-library.js');
   window.testContext={uid:'test-dm',ownerUid:'test-dm',campaignId:'a'.repeat(20),rulesetId:'legacy',status:'active'};
   window.cleanup=await mountMapLibrary({element:document.querySelector('#test-root'),context:window.testContext,campaignName:'Prueba',verify:async()=>window.testContext});
  });
 }
 try{
  browser=await launch();let page=await browser.newPage();await mount(page);
  await page.getByRole('button',{name:'Crear cartucho',exact:true}).click();
  page.once('dialog',d=>d.accept('Mismo nombre'));
  await page.getByRole('button',{name:'Crear mapa en el editor',exact:true}).click();
  const frame=page.frameLocator('#lumen-editor');
  await frame.locator('#menuBtn').click();await frame.locator('#projectName').fill('Proyecto persistente');await frame.locator('#applyName').click();
  await page.getByRole('button',{name:'Guardar mapa en cartucho de trabajo',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#cartridge-status').textContent.includes('Guardado de recuperación local'));
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar cartucho',exact:true}).click();
  const download=await downloadPromise,filename=await download.path(),doc=JSON.parse(fs.readFileSync(filename,'utf8'));
  assert.equal(doc.maps[0].project.title,'Proyecto persistente');
  assert.equal(await frame.locator('#autosave').textContent(),'Mapa guardado en el cartucho de trabajo. Todavía debes exportar el archivo.');
  const native=await page.evaluate(async({doc})=>{
   const {recoveryStore}=await import('/portal/cartridge-recovery.js');
   const validate=p=>document.querySelector('iframe').contentWindow.LumenEditor.validate(p);
   const r=await recoveryStore.read(window.testContext,doc.cartridgeId,validate);
   return {snapshots:r.snapshots.length,project:r.snapshots[0].cartridge.maps[0].project};
  },{doc});assert.ok(native.snapshots>=1);assert.deepEqual(native.project,doc.maps[0].project);
  await browser.close();browser=await launch();page=await browser.newPage();await mount(page);
  const inputPromise=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Abrir cartucho existente',exact:true}).click();
  await (await inputPromise).setFiles({name:'Prueba.lumen.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
  await page.getByRole('button',{name:'Editar',exact:true}).click();
  const reopened=await page.evaluate(()=>document.querySelector('iframe').contentWindow.LumenEditor.read());
  assert.deepEqual(reopened,doc.maps[0].project);
  const metrics=await page.evaluate(async({project})=>{
   const m=await import('/portal/cartridge.js'),{recoveryStore}=await import('/portal/cartridge-recovery.js');
   const validate=p=>document.querySelector('iframe').contentWindow.LumenEditor.validate(p);
   const c=m.changeMap(m.createCartridge(window.testContext),window.testContext,validate,{name:'120',project,expectedRevision:1}).cartridge;
   const t=performance.now();await recoveryStore.save(c,window.testContext,validate);return {nativeIndexedDBSaveMs:performance.now()-t,bytes:new Blob([JSON.stringify(c)]).size};
  },{project:require('./helpers/lumen-large-map.cjs')(true)});
  console.log(JSON.stringify(metrics));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.rmSync(profile,{recursive:true,force:true});}
});
