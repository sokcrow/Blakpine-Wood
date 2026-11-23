'use strict';
/*
 * Prueba de navegador HTTPS compatible sin CI ni instaladores:
 * node tests/multimode-selector-browser.cjs
 * Requiere Playwright/Chromium disponibles en el equipo de pruebas.
 * Route.fulfill sirve archivos del repo bajo un origen HTTPS virtual estable;
 * prueba la página HTML real, no sustituye ninguno de los tres módulos.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const host='https://blakpine.test/Blakpine-Wood/';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
 '.png':'image/png','.svg':'image/svg+xml','.glb':'model/gltf-binary'};
async function routeRepository(page,missingMap=false){
 await page.route('https://blakpine.test/Blakpine-Wood/**',async route=>{
  const request=new URL(route.request().url());
  const relative=decodeURIComponent(request.pathname).replace(/^\/Blakpine-Wood\//,'');
  if(!relative||relative.includes('..')||path.isAbsolute(relative)){
   await route.fulfill({status:403,body:'Ruta fuera del proyecto'});return;
  }
  if(missingMap&&relative==='forest-horror/maps/DEMO_Interacciones.json'){
   await route.fulfill({status:404,body:'Mapa ausente'});return;
  }
  const absolute=path.resolve(root,relative);
  if(!absolute.startsWith(root+path.sep)||!fs.existsSync(absolute)||!fs.statSync(absolute).isFile()){
   await route.fulfill({status:404,body:'No existe'});return;
  }
  await route.fulfill({status:200,body:fs.readFileSync(absolute),
   contentType:mime[path.extname(relative)]||'application/octet-stream'});
 });
}
async function openSelector(page){
 const target=page.locator('#fhModesBtn');
 if(!await target.isVisible())await page.locator('#subbar > .fh-overflow-toggle').click();
 await target.click();
 await page.locator('#fhModesOverlay').waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelector('#fhModesStatus').textContent!=='Comprobando perfiles y mapas reales…');
}
(async()=>{
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.LUMEN_CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-gpu-sandbox',
   '--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1440,height:900},hasTouch:true,ignoreHTTPSErrors:true});
  const page=await context.newPage();
  await routeRepository(page);
  await page.goto(host+'index.html?editor=1',{waitUntil:'load',timeout:90000});
  await openSelector(page);
  assert.equal(await page.locator('#fhWorldOptions [data-world="ciudad-moderna"]').isDisabled(),false);
  assert.equal(await page.locator('#fhWorldOptions [data-world="distopia"]').isDisabled(),true);
  assert.equal(await page.locator('#fhWorldOptions [data-world="villa-medieval"]').count(),0);
  assert.equal(await page.locator('#fhRulesOptions [data-rule="legacy"]').isDisabled(),false);
  assert.equal(await page.locator('#fhRulesOptions [data-rule="dnd"]').isDisabled(),false);
  assert.equal(await page.locator('#fhRulesOptions [data-rule="moon-system"]').isDisabled(),true);
  assert.equal(await page.locator('#fhModesStart').isDisabled(),false);
  await page.locator('#fhModesClose').focus();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'fhModesDndLocal');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#fhModesOverlay').isVisible(),false);

  await openSelector(page);
  const draft=require('../forest-horror/maps/DEMO_DnD_Iluminacion.json');
  draft.title='Mapa de la mesa';
  await page.evaluate(map=>{
   importProject(map);
   FHCharacterCore.store(FHCharacterCore.createProfile({
    name:'Prueba',origin:'resident',relationship:'amigo',strengths:['FOR','AGI'],
    weaknesses:['VOL','PRU'],bonus:{FOR:1,AGI:1,ING:2}
   }));
  },draft);
  const initialTitle=await page.evaluate(()=>project.title);
  await page.locator('#fhModesStart').tap();
  await page.waitForFunction(()=>preview3DActive);
  const launched=await page.evaluate(()=>({
   map:makeCurrent3DProject(),
   editorTitle:project.title,
   layer:document.getElementById('play3dLayer').classList.contains('show'),
   originalProject:project.floors.some(f=>f.items.some(it=>it.id==='fh-mode-runtime-spawn'))
  }));
  assert.equal(launched.layer,true);
  assert.equal(launched.map.schema,'forest-horror-map-v1');
  assert.ok(launched.map.floors.some(f=>f.items.some(it=>it.type==='spawn')));
  assert.equal(launched.editorTitle,initialTitle);
  assert.equal(launched.originalProject,false);
  await page.evaluate(()=>close3DPreview());
  assert.equal(await page.locator('#play3dLayer').isVisible(),false);
  assert.equal(await page.locator('#testBtn').isEnabled(),true);

  await openSelector(page);
  await page.locator('#fhModesDndLocal').click();
  const dndForm=page.locator('#fh-dnd-character-dialog');
  await dndForm.getByRole('button',{name:/^Mago/}).tap();
  await dndForm.getByLabel('Nombre',{exact:true}).fill('Ada');
  await dndForm.locator('button[type="submit"]').click();
  await dndForm.waitFor({state:'hidden'});
  const selectedDnd=await page.evaluate(()=>window.FHDndCharacterManager.current());
  assert.equal(selectedDnd.sheet.classId,'wizard');
  assert.equal(selectedDnd.sheet.name,'Ada');
  await page.waitForFunction(()=>preview3DActive);
  const current=await page.evaluate(()=>makeCurrent3DProject());
  assert.equal(current.title,initialTitle);
  await page.evaluate(()=>close3DPreview());

  const missing=await context.newPage();
  await routeRepository(missing,true);
  await missing.goto(host+'index.html?editor=1',{waitUntil:'load',timeout:90000});
  await openSelector(missing);
  assert.equal(await missing.locator('#fhWorldOptions [data-world="ciudad-moderna"]').isDisabled(),true);
  assert.equal(await missing.locator('#fhModesStart').isDisabled(),true);
  assert.equal(await missing.locator('#fhModesLegacyLocal').isEnabled(),true);
  await missing.close();
  await context.close();
  console.log('PASS: selección Legacy y mapa propio D&D, teclado/táctil y 404');
 }finally{await browser?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
