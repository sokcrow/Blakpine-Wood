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
 const launch=async()=>{
  const context=await chromium.launchPersistentContext(profile,{headless:true,acceptDownloads:true,...(process.env.LUMEN_CHROMIUM_PATH?{executablePath:process.env.LUMEN_CHROMIUM_PATH}:{})});
  // Synthetic identities at the SDK boundary; actual editor and native storage remain real.
  await context.route('https://www.gstatic.com/firebasejs/13.3.0/*',route=>{
   const file=new URL(route.request().url()).pathname.split('/').pop();
   const source={
    'firebase-app.js':"export const getApps=()=>[];export const initializeApp=()=>({});",
    'firebase-auth.js':"const user={uid:'test-dm',displayName:'Prueba'};const auth={currentUser:user};export const getAuth=()=>auth;export const onAuthStateChanged=(a,cb)=>{let active=true;queueMicrotask(()=>{if(active)cb(user)});return()=>{active=false}};",
    'firebase-firestore.js':"export const getFirestore=()=>({});export const doc=()=>({});export const getDocFromServer=async()=>({exists:()=>true,data:()=>({ownerId:'test-dm',ruleset:'legacy',status:'active',name:'Prueba'})});"
   }[file];
   return source?route.fulfill({contentType:'text/javascript',body:source}):route.abort();
  });return context;
 };
 let browser;
 async function mount(page,base=origin){
  await page.goto(base+'/__lumen_test__');
  await page.evaluate(async()=>{
   const {mountMapLibrary}=await import('/portal/map-library.js');
   window.testContext={uid:'test-dm',ownerUid:'test-dm',campaignId:'a'.repeat(20),rulesetId:'legacy',status:'active'};
   window.cleanup=await mountMapLibrary({element:document.querySelector('#test-root'),context:window.testContext,campaignName:'Prueba',verify:async()=>window.testContext});
  });
 }
 async function readyEditor(page){
  await page.waitForURL('**/index.html?editor=1&lumenCartridge=1&campaign=*&workspace=*');
  await page.waitForFunction(()=>window.LumenEditor&&!document.getElementById('app').inert);
  assert.equal(await page.evaluate(()=>window.parent===window),true);
  assert.equal(await page.locator('#lumen-editor').count(),0);
  const rect=await page.locator('#app').boundingBox(),size=page.viewportSize();
  assert.ok(Math.abs(rect.width-size.width)<2&&Math.abs(rect.height-size.height)<2);
 }
 async function backToLibrary(page){
  await page.locator('#menuBtn').click();await page.getByRole('button',{name:'Volver a la biblioteca',exact:true}).click();
  await page.waitForURL('**/portal/#mapas/**');await page.getByRole('button',{name:'Editar',exact:true}).waitFor();
 }
 try{
  browser=await launch();let page=await browser.newPage();await mount(page);
  await page.getByRole('button',{name:'Crear cartucho',exact:true}).click();
  page.once('dialog',d=>d.accept('Mismo nombre'));
  await page.getByRole('button',{name:'Crear mapa en el editor',exact:true}).click();
  await readyEditor(page);const frame=page;
  await frame.locator('#menuBtn').click();await frame.locator('#projectName').fill('Proyecto persistente');await frame.locator('#applyName').click();
  await page.getByRole('button',{name:'Guardar mapa en cartucho de trabajo',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#autosave').textContent.includes('Mapa guardado.'));
  const downloadPromise=page.waitForEvent('download');await page.locator('#menuBtn').click();await page.getByRole('button',{name:'Exportar cartucho',exact:true}).click();
  const download=await downloadPromise,filename=await download.path(),doc=JSON.parse(fs.readFileSync(filename,'utf8'));
  assert.equal(doc.maps[0].project.title,'Proyecto persistente');
  await page.waitForFunction(()=>document.querySelector('#autosave').textContent.includes('Descarga del cartucho'));
  const native=await page.evaluate(async({doc})=>{
   const {recoveryStore}=await import('/portal/cartridge-recovery.js');
   const validate=p=>window.LumenEditor.validate(p);
   const context={uid:'test-dm',ownerUid:'test-dm',campaignId:'a'.repeat(20),rulesetId:'legacy',status:'active'};
   const r=await recoveryStore.read(context,doc.cartridgeId,validate);
   return {snapshots:r.snapshots.length,project:r.snapshots[0].cartridge.maps[0].project};
  },{doc});assert.ok(native.snapshots>=1);assert.deepEqual(native.project,doc.maps[0].project);
  await browser.close();browser=await launch();page=await browser.newPage();await mount(page);
  await page.getByRole('button',{name:'Recuperar instantánea local',exact:true}).click();
  await page.getByRole('button',{name:new RegExp('Recuperar instantánea local · '+doc.cartridgeId)}).click();
  await page.getByRole('button',{name:'Editar',exact:true}).click();
  await readyEditor(page);const recovered=await page.evaluate(()=>window.LumenEditor.read());
  assert.deepEqual(recovered,doc.maps[0].project);
  await backToLibrary(page);
  page.once('dialog',d=>d.accept());
  const inputPromise=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Abrir cartucho existente',exact:true}).click();
  await (await inputPromise).setFiles({name:'Prueba.lumen.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
  await page.getByRole('button',{name:'Editar',exact:true}).click();
  await readyEditor(page);const reopened=await page.evaluate(()=>window.LumenEditor.read());
  assert.deepEqual(reopened,doc.maps[0].project);
  const metrics=await page.evaluate(async({project})=>{
   const m=await import('/portal/cartridge.js'),{recoveryStore}=await import('/portal/cartridge-recovery.js');
   const validate=p=>window.LumenEditor.validate(p);
   const context={uid:'test-dm',ownerUid:'test-dm',campaignId:'a'.repeat(20),rulesetId:'legacy',status:'active'};
   const c=m.changeMap(m.createCartridge(context),context,validate,{name:'120',project,expectedRevision:1}).cartridge;
   const t=performance.now();const first=await recoveryStore.save(c,context,validate),elapsed=performance.now()-t;
   c.revision++;const second=await recoveryStore.save(c,context,validate,{expectedToken:first.token});
   c.revision++;await recoveryStore.save(c,context,validate,{expectedToken:second.token});
   const stored=await recoveryStore.read(context,c.cartridgeId,validate);
   if(stored.snapshots.length!==2||stored.snapshots[0].revision!==c.revision||stored.snapshots[1].revision!==c.revision-1)throw Error('Native snapshot retention failed');
   return {nativeIndexedDBSaveMs:elapsed,bytes:new Blob([JSON.stringify(c)]).size,snapshotCount:stored.snapshots.length};
  },{project:require('./helpers/lumen-large-map.cjs')(true)});
  console.log(JSON.stringify(metrics));
  // Native Chromium enforces a reduced quota for this disposable test origin.
  const quotaOrigin=origin.replace('127.0.0.1','localhost'),quotaPage=await browser.newPage();
  await mount(quotaPage,quotaOrigin);
  const cdp=await browser.newCDPSession(quotaPage);
  await cdp.send('Storage.overrideQuotaForOrigin',{origin:quotaOrigin,quotaSize:1});
  const quota=await quotaPage.evaluate(async({project})=>{
   const m=await import('/portal/cartridge.js'),{recoveryStore}=await import('/portal/cartridge-recovery.js');
   const validate=p=>document.querySelector('iframe').contentWindow.LumenEditor.validate(p);
   const doc=m.changeMap(m.createCartridge(window.testContext),window.testContext,validate,{name:'Quota',project,expectedRevision:1}).cartridge;
   const before=m.exportCartridge(doc,window.testContext,validate);let code='';
   try{await recoveryStore.save(doc,window.testContext,validate);}catch(e){code=e.code;}
   return {code,preserved:before===m.exportCartridge(doc,window.testContext,validate),cartridgeId:doc.cartridgeId};
  },{project:require('./helpers/lumen-large-map.cjs')(true)});
  assert.equal(quota.code,'RECOVERY_QUOTA');assert.equal(quota.preserved,true);
  await cdp.send('Storage.overrideQuotaForOrigin',{origin:quotaOrigin});
  const remaining=await quotaPage.evaluate(async id=>{
   const {recoveryStore}=await import('/portal/cartridge-recovery.js');
   return (await recoveryStore.read(window.testContext,id,p=>document.querySelector('iframe').contentWindow.LumenEditor.validate(p))).snapshots.length;
  },quota.cartridgeId);
  assert.equal(remaining,0);console.log(JSON.stringify({nativeQuota:{code:quota.code,preserved:quota.preserved,snapshots:remaining}}));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));fs.rmSync(profile,{recursive:true,force:true});}
});
