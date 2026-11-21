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
const furniture=require('../forest-horror/biblioteca/catalogo_muebles.json').furniture;
const demo=require('../forest-horror/maps/DEMO_Sofa_TV_Cama.json');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
 '.png':'image/png','.svg':'image/svg+xml','.glb':'model/gltf-binary'};
async function routeRepository(page,missingMap=false,origin=host){
 await page.route(origin+'**',async route=>{
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
async function toolbarClick(page,bar,selector){
 const button=page.locator(selector);
 if(!await button.isVisible())await page.locator('#'+bar+' > .fh-overflow-toggle').click();
 await button.click();
}
async function openSelector(page){
 await toolbarClick(page,'subbar','#fhModesBtn');
 await page.locator('#fhModesOverlay').waitFor({state:'visible'});
 await page.waitForFunction(()=>document.querySelector('#fhModesStatus').textContent!=='Comprobando perfiles y mapas reales…');
}
async function chooseRuleset(page,id){
 await openSelector(page);
 const selected=page.locator('#fhRulesOptions [data-rule="'+id+'"]');
 await selected.click();
 assert.equal(await selected.getAttribute('aria-pressed'),'true');
 assert.equal(await selected.evaluate(el=>el===document.activeElement),true);
 const canStart=await page.locator('#fhModesStart').isEnabled();
 await page.locator('#fhModesClose').click();
 return canStart;
}
async function openFurniture(page){
 await toolbarClick(page,'categories','#categories [data-cat="furniture"]');
 await toolbarClick(page,'tools','#tools [data-tool="misc"]');
 const cards=page.locator('#fhCatModal .fhCatCard');
 await cards.first().waitFor();
 return cards;
}
async function catalogIds(cards){
 return cards.locator('img').evaluateAll(images=>images.map(
  img=>new URL(img.src).pathname.split('/').at(-1).replace(/\.png$/,'')
 ));
}
async function checkEditorCatalog(page){
 const legacyIds=furniture.map(entry=>entry.id);
 assert.deepEqual(await catalogIds(await openFurniture(page)),legacyIds);
 await page.locator('#fhCatModal .fhCatCard').filter({hasText:'Televisor CRT'}).click();
 assert.equal(await page.evaluate(()=>createObject('misc',{x:4,y:4}).modelId),'televisor_crt');
 assert.equal(await chooseRuleset(page,'dnd'),true);
 assert.equal(await page.evaluate(()=>createObject('misc',{x:4,y:4}).modelId),undefined);
 for(const id of ['tv','bath','toilet','kitchen','car','battery_pickup']){
  assert.equal(await page.locator('#tools [data-tool="'+id+'"]').count(),0,id);
 }
 const cards=await openFurniture(page);
 const dndIds=await catalogIds(cards);
 for(const id of ['mesa_pequena','silla_madera','cama_individual','estante_bajo','armario']){
  assert.ok(dndIds.includes(id),id);
 }
 for(const id of ['televisor_crt','inodoro_clasico','gabinete_pc','refrigerador','lampara_escritorio','poste_luz_madera']){
  assert.ok(!dndIds.includes(id),id);
 }
 await page.locator('#fhCatModal input').fill('televisor');
 assert.equal(await cards.count(),0);
 assert.equal(await page.locator('#fhCatModal .fhCatCategories button').filter({hasText:'Computadoras'}).count(),0);
 await page.locator('#fhCatModal input').fill('silla_madera');
 await cards.first().click();
 assert.equal(await page.evaluate(()=>createObject('misc',{x:4,y:4}).modelId),'silla_madera');

 await toolbarClick(page,'categories','#categories [data-cat="lighting"]');
 for(const selector of ['[data-tool="light_fixture"]','[data-tool="power_outlet"]','#fhElectricLauncher',
  '#fhGeneratorLauncher','#fhExteriorLauncher']){
  assert.equal(await page.locator('#tools '+selector).count(),0,selector);
 }
 assert.equal(await page.locator('#categories [data-cat="network"]').isVisible(),false);
 await toolbarClick(page,'categories','#categories [data-cat="water"]');
 assert.equal(await page.locator('#fhWaterLauncher,#fhBoilersLauncher,#tools [data-tool="water_boiler"]').count(),0);
 await toolbarClick(page,'categories','#categories [data-cat="structure"]');
 await toolbarClick(page,'tools','#tools [data-tool="door"]');
 const doorCards=page.locator('#fhArchCatalog .fhArchCard');
 await doorCards.first().waitFor();
 assert.ok((await doorCards.allTextContents()).some(label=>/madera/i.test(label)));
 assert.ok((await doorCards.allTextContents()).every(label=>!/electrónica|antipánico|mirilla/i.test(label)));
 await page.keyboard.press('Escape');

 await page.locator('#jsonInput').setInputFiles(path.join(root,'forest-horror/maps/DEMO_Sofa_TV_Cama.json'));
 await page.waitForFunction(title=>project.title===title,demo.title);
 const before=await page.evaluate(()=>JSON.stringify(project));
 const loadedMap=JSON.parse(before);
 assert.equal(loadedMap.schema,demo.schema);
 for(const item of demo.floors[0].items){
  assert.ok(loadedMap.floors[0].items.some(loaded=>loaded.id===item.id&&loaded.type===item.type),item.id);
 }
 assert.equal(await chooseRuleset(page,'moon-system'),false);
 assert.deepEqual(await catalogIds(await openFurniture(page)),legacyIds);
 await page.locator('#fhCatModal input').press('Escape');
 assert.equal(await chooseRuleset(page,'legacy'),true);
 assert.deepEqual(await catalogIds(await openFurniture(page)),legacyIds);
 await page.locator('#fhCatModal input').press('Escape');
 assert.equal(await chooseRuleset(page,'dnd'),true);
 assert.equal(await page.evaluate(()=>JSON.stringify(project)),before);
 assert.equal(await chooseRuleset(page,'legacy'),true);
 console.log('PASS: catálogos de los tres modos, selección previa, paletas, búsqueda y mapa v1 importado intacto');
}
(async()=>{
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-gpu-sandbox',
   '--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1440,height:900},hasTouch:true,ignoreHTTPSErrors:true});
  await context.addInitScript(()=>localStorage.setItem('fh_editor_help_seen_v2','1'));
  const page=await context.newPage();
  await routeRepository(page);
  await page.goto(host+'index.html?editor=1',{waitUntil:'load',timeout:90000});
  await openSelector(page);
  assert.equal(await page.locator('#fhWorldOptions [data-world="ciudad-moderna"]').isDisabled(),false);
  for(const id of ['distopia','villa-medieval']){
   assert.equal(await page.locator('#fhWorldOptions [data-world="'+id+'"]').isDisabled(),true,id);
  }
  assert.equal(await page.locator('#fhRulesOptions [data-rule="legacy"]').isDisabled(),false);
  for(const id of ['dnd','moon-system']){
   assert.equal(await page.locator('#fhRulesOptions [data-rule="'+id+'"]').isDisabled(),false,id);
  }
  assert.equal(await page.locator('#fhModesStart').isDisabled(),false);
  await page.locator('#fhModesClose').focus();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'fhModesLegacyLocal');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#fhModesOverlay').isVisible(),false);

  await checkEditorCatalog(page);

  await openSelector(page);
  const initialTitle=await page.evaluate(()=>project.title);
  await page.evaluate(()=>{
   const original=window.FHCharacterCreation;
   window.FHCharacterCreation={...original,ensureCharacter:async()=>({id:'smoke-test'})};
   window.__testedModeMap=null;
   const before=window.makeCurrent3DProject;
   window.makeCurrent3DProject=function(){
    const result=before();
    window.__testedModeMap=result;
    return result;
   };
  });
  await page.locator('#fhModesStart').tap();
  await page.waitForFunction(()=>!!window.__testedModeMap,{timeout:65000});
  const launched=await page.evaluate(()=>({
   map:window.__testedModeMap,
   editorTitle:project.title,
   layer:document.getElementById('play3dLayer').classList.contains('show'),
   originalProject:project.floors.some(f=>f.items.some(it=>it.id==='fh-mode-runtime-spawn'))
  }));
  assert.equal(launched.layer,true);
  assert.equal(launched.map.schema,'forest-horror-map-v1');
  assert.ok(launched.map.floors.some(f=>f.items.some(it=>it.type==='spawn')));
  assert.equal(launched.editorTitle,initialTitle);
  assert.equal(launched.originalProject,false);
  await page.locator('#play3dBack').click();
  assert.equal(await page.locator('#play3dLayer').isVisible(),false);
  assert.equal(await page.locator('#testBtn').isEnabled(),true);

  const missing=await context.newPage();
  await routeRepository(missing,true);
  await missing.goto(host+'index.html?editor=1',{waitUntil:'load',timeout:90000});
  await openSelector(missing);
  assert.equal(await missing.locator('#fhWorldOptions [data-world="ciudad-moderna"]').isDisabled(),true);
  assert.equal(await missing.locator('#fhModesStart').isDisabled(),true);
  assert.equal(await missing.locator('#fhModesLegacyLocal').isEnabled(),true);
  await missing.close();
  const offline=await context.newPage(),offlineHost=host.replace('https:','http:');
  await routeRepository(offline,false,offlineHost);
  await offline.goto(offlineHost+'index.html?editor=1');
  assert.equal(await chooseRuleset(offline,'dnd'),false);
  assert.ok(!(await catalogIds(await openFurniture(offline))).includes('televisor_crt'));
  await offline.close();
  await context.close();
  console.log('PASS: HTML real con HTTPS y sin HTTPS, teclado, Legacy en iframe y perfil con mapa 404');
 }finally{await browser?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
