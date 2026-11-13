'use strict';
// Prueba del editor completo. Playwright es una herramienta de desarrollo, no una dependencia del producto.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const output=process.env.EDITOR_CAPTURE_DIR;
const sizes=[[1920,1080],[1440,900],[1366,768],[1024,768],[390,844],[844,390],[667,375]];
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.glb':'model/gltf-binary'};
const server=http.createServer((req,res)=>{
 let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}
 catch{res.writeHead(400).end();return;}
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.stat(file,(err,stat)=>{
  if(err||!stat.isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
 });
});
async function settle(page){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function reveal(page,selector){
 const target=page.locator(selector);
 if(!await target.isVisible()){
  const bar=selector.startsWith('#categories')?'#categories':selector.startsWith('#tools')?'#tools':'#subbar';
  await page.locator(bar+'>.fh-overflow-toggle').click();
 }
 return target;
}
async function category(page,cat){await (await reveal(page,`#categories [data-cat="${cat}"]`)).click();await settle(page);}
async function geometry(page){
 return page.evaluate(()=>{
  const box=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
  const shown=el=>!!el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
  const map=box(document.getElementById('map'));
  const clipped=[...document.querySelectorAll('#headActions button,#subbar button,#palette button')].filter(shown).filter(el=>{
   const r=box(el);if(!r.w||!r.h)return false;
   if(r.x<-.5||r.y<-.5||r.right>innerWidth+.5||r.bottom>innerHeight+.5)return true;
   // Comprobar recorte por ancestros que realmente recortan, no sólo documentElement.
   for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement){
    const c=getComputedStyle(p),b=box(p);
    if(['hidden','clip','auto','scroll'].includes(c.overflowX)&&(r.x<b.x-.5||r.right>b.right+.5))return true;
    if(['hidden','clip','auto','scroll'].includes(c.overflowY)&&(r.y<b.y-.5||r.bottom>b.bottom+.5))return true;
    if(p.matches(':popover-open'))break;
   }
   return false;
  }).map(el=>el.id||el.textContent.trim());
  return {map,clipped,overflow:document.documentElement.scrollWidth>innerWidth,portrait:document.body.classList.contains('fh-portrait')};
 });
}
async function fixtures(page){
 return page.evaluate(()=>{
  project=newProject();floorIndex=0;selection=null;activeCategory='structure';
  history=[];historyIndex=-1;loadedImgs=project.floors.map(()=>null);
  const a=createObject('chair',{x:5,y:5}),b=createObject('chair',{x:8,y:5});
  a.label='Silla A';b.label='Silla B';current().items.push(a,b);record();refreshFloorTabs();
  view={scale:.6,tx:20-5*gridX()*.6,ty:canvas.clientHeight/2-5*gridY()*.6};
  chooseTool('select');closeInspector();render();return [a.id,b.id];
 });
}
async function selectObject(page,id){
 const p=await page.evaluate(id=>{const it=current().items.find(it=>it.id===id),p=toPixel(it),r=canvas.getBoundingClientRect();return {x:r.x+view.tx+p.x*view.scale,y:r.y+view.ty+p.y*view.scale};},id);
 await page.mouse.click(p.x,p.y);await settle(page);
 assert.equal(await page.evaluate(()=>selection),id);
}
async function capture(page,name){if(output){fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,name+'.png')});}}
async function main(){
 let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const base='http://127.0.0.1:'+server.address().port;
  for(const [width,height] of sizes){
   const context=await browser.newContext({viewport:{width,height},hasTouch:width<=1024});
   await context.addInitScript(()=>localStorage.setItem('fh_editor_help_seen_v2','1'));
   const page=await context.newPage(),errors=[];page.on('pageerror',err=>errors.push(err.message));
   await page.goto(base+'/index.html');await page.waitForFunction(()=>!!window.FHEditorLayout);await settle(page);
   const g=await geometry(page);assert.equal(g.overflow,false);assert.deepEqual(g.clipped,[]);
   if(width===390){
    assert.equal(await page.locator('#fhOrientationNotice strong').textContent(),'Gira tu dispositivo para editar el mapa con mayor comodidad');
    assert.equal(await page.locator('#stage').evaluate(el=>el.inert),true);
    assert.equal(await page.locator('#palette').isVisible(),false);
    await capture(page,`${width}x${height}`);await context.close();console.log(`PASS ${width}x${height}: aviso vertical`);continue;
   }
   assert.ok(g.map.h>height*.6,`Altura insuficiente: ${g.map.h}/${height}`);
   if(height<=500){
    // Regresión del teclado: simular cambios de altura y eventos de visualViewport.
    // No sustituye una prueba del teclado real en Android/iOS.
    for(const id of ['quickColumns','quickRows']){
     await page.locator('#subbar>.fh-overflow-toggle').click();
     const input=page.locator('#'+id);await input.focus();await input.fill('41');
     await page.setViewportSize({width,height:220});
     await page.evaluate(()=>{visualViewport?.dispatchEvent(new Event('resize'));visualViewport?.dispatchEvent(new Event('scroll'));});
     await settle(page);
     assert.equal(await page.locator('#fhMore-subbar').isVisible(),true);
     assert.equal(await input.evaluate(el=>el===document.activeElement),true);
     assert.equal(await input.inputValue(),'41');
     await input.press('Tab');await settle(page);
     assert.equal(await page.evaluate(id=>project.units[id==='quickColumns'?'columns':'rows'],id),41);
     await page.keyboard.press('Escape');
     await page.setViewportSize({width,height});await settle(page);
    }
   }
   // P1: un renderizado en un piso elevado no debe cerrar ni realimentar los menús.
   await page.evaluate(()=>changeFloor(1));await settle(page);
   for(const bar of ['categories','tools']){
    const trigger=page.locator('#'+bar+'>.fh-overflow-toggle');
    if(await trigger.isVisible()){
     await trigger.click();
     for(let frame=0;frame<8;frame++){await page.evaluate(()=>render());await settle(page);}
     assert.equal(await page.locator('#fhMore-'+bar).isVisible(),true,'Menú estable en piso elevado: '+bar);
     await page.keyboard.press('Escape');
    }
   }
   // P2: el popover de Opciones no puede quedar por encima del diálogo Conexiones.
   await category(page,'lighting');await page.keyboard.press('Escape');await settle(page);
   await page.locator('#fhOptionsToggle').click();await page.locator('#circuitAudit').click();
   assert.equal(await page.locator('#fhEditOptions').isVisible(),false);
   assert.equal(await page.locator('#overlay').isVisible(),true);
   assert.equal(await page.locator('#overlay').evaluate(el=>el.contains(document.activeElement)),true);
   await page.keyboard.press('Escape');await page.evaluate(()=>changeFloor(0));await settle(page);

   for(const cat of ['structure','furniture','lighting','water','network','property','areas','roads','parking_marks','navigate']){
    await category(page,cat);await page.keyboard.press('Escape');await settle(page);assert.equal(await page.evaluate(()=>activeCategory),cat);
    const tools=await page.locator('#tools [data-tool]').count();assert.ok(tools>0);
    const toggle=page.locator('#tools>.fh-overflow-toggle');
    if(await toggle.isVisible()){
     await toggle.click();assert.equal(await page.locator('#fhMore-tools').isVisible(),true);
     // Los elementos del desplegable pueden desplazarse verticalmente, nunca horizontalmente.
     assert.equal(await page.locator('#fhMore-tools').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
     await page.keyboard.press('Escape');
    }
    assert.equal((await geometry(page)).overflow,false);
   }
   await category(page,'structure');const ids=await fixtures(page);await settle(page);
   await selectObject(page,ids[0]);
   if(height<=500){assert.equal(await page.locator('#inspector').isVisible(),false);await page.locator('#fhPropertiesToggle').click();}
   await page.locator('#fields').getByLabel('Etiqueta',{exact:true}).fill('Silla editada');
   await page.locator('#fields').getByLabel('Etiqueta',{exact:true}).press('Tab');await settle(page);
   assert.equal(await page.evaluate(id=>current().items.find(it=>it.id===id).label,ids[0]),'Silla editada');
   assert.ok((await page.locator('#inspTitle').textContent()).includes(ids[0].slice(-5)));
   await selectObject(page,ids[1]);assert.equal(await page.locator('#fields').getByLabel('Etiqueta',{exact:true}).inputValue(),'Silla B');
   // El panel ocupa su columna y nunca se superpone al lienzo.
   const boxes=await page.evaluate(()=>{const a=canvas.getBoundingClientRect(),b=document.getElementById('inspector').getBoundingClientRect();return {right:a.right,left:b.left};});
   assert.ok(boxes.right<=boxes.left+.5);
   await page.locator('#inspClose').click();assert.equal(await page.locator('#inspector').isVisible(),false);
   const scale=await page.evaluate(()=>view.scale);await page.locator('#plusBtn').click();assert.ok(await page.evaluate(()=>view.scale)>scale);
   await page.locator('#minusBtn').click();
   const before=await page.evaluate(()=>({x:view.tx,y:view.ty}));
   await page.locator('[data-editor-tool="pan"]').click();const map=await page.locator('#map').boundingBox();
   await page.mouse.move(map.x+map.width/2,map.y+map.height/2);await page.mouse.down();await page.mouse.move(map.x+map.width/2+35,map.y+map.height/2+25);await page.mouse.up();
   assert.notDeepEqual(await page.evaluate(()=>({x:view.tx,y:view.ty})),before);
   if(width<=1024){
    const cdp=await context.newCDPSession(page),r=await page.locator('#map').boundingBox();
    const x=r.x+r.width/2,y=r.y+r.height/2,initialScale=await page.evaluate(()=>view.scale);
    const touch=(id,dx)=>({id,x:x+dx,y,radiusX:3,radiusY:3,force:1});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(1,-24),touch(2,24)]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(1,-44),touch(2,44)]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle(page);
    assert.ok(await page.evaluate(()=>view.scale)>initialScale,'Pellizco táctil');
    assert.equal(await page.evaluate(()=>pointerStates.size),0);await cdp.detach();
   }
   // Conservar JSON, selección, herramienta y cámara al girar sin recargar.
   const snapshot=await page.evaluate(()=>({data:JSON.stringify(project),selection,activeTool,view:{...view}}));
   await page.setViewportSize({width:390,height:844});await settle(page);
   await page.setViewportSize({width,height});await settle(page);
   assert.deepEqual(await page.evaluate(()=>({data:JSON.stringify(project),selection,activeTool,view:{...view}})),snapshot);
   await page.waitForFunction(()=>!dirty);
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(key())).schema),'forest-horror-map-v1');
   // Exportación e importación a través de los controles originales.
   await (await reveal(page,'#subbar #fitBtn')).click();await page.locator('#menuBtn').click();
   const downloadPromise=page.waitForEvent('download');await page.locator('#fullExport').click();const download=await downloadPromise;
   const exported=await download.path();assert.ok(exported);const doc=JSON.parse(fs.readFileSync(exported,'utf8'));
   assert.equal(doc.schema,'forest-horror-map-v1');assert.deepEqual([doc.units.columns,doc.units.rows],[40,40]);
   await page.keyboard.press('Escape');await page.locator('#menuBtn').click();
   const chooserPromise=page.waitForEvent('filechooser');await page.locator('#importJSON').click();const chooser=await chooserPromise;await chooser.setFiles(exported);
   await page.waitForFunction(()=>!document.getElementById('overlay').classList.contains('show'));await settle(page);
   assert.equal(await page.evaluate(id=>current().items.find(it=>it.id===id)?.label,ids[0]),'Silla editada');
   await capture(page,`${width}x${height}`);
   assert.deepEqual((await geometry(page)).clipped,[]);assert.deepEqual(errors,[]);
   // Probar 3D: llegar al motor real y regresar al mismo proyecto.
   const dataBefore3D=await page.evaluate(()=>JSON.stringify(project));
   await (await reveal(page,'#subbar #testBtn')).click();
   const gate=page.locator('#play3dLandscapeGate');
   if(await gate.isVisible())await page.locator('#play3dLandscapeStart').click();
   await page.waitForFunction(()=>preview3DActive&&preview3DRunning&&document.querySelector('#play3dFrame')?.contentDocument?.readyState==='complete',null,{timeout:60000});
   const frame=page.frames().find(f=>f!==page.mainFrame());assert.ok(frame);
   await page.locator('#play3dBack').click();assert.equal(await page.evaluate(()=>JSON.stringify(project)),dataBefore3D);
   assert.deepEqual(errors,[]);console.log(`PASS ${width}x${height}: categorías, inspector, zoom, navegación, orientación, JSON, 3D`);
   await context.close();
  }
 }finally{await browser?.close();if(server.listening)await new Promise(resolve=>server.close(resolve));}
}
main().catch(err=>{console.error(err);process.exitCode=1;});
