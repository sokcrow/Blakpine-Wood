/* Ejecutar: node --test juego/assets/fh-status-hud.test.js */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const H=require('./fh-status-hud.js');
const directory=__dirname;
const editor=fs.readFileSync(path.resolve(directory,'../../index.html'),'utf8');
const css=fs.readFileSync(path.join(directory,'fh-status-hud.css'),'utf8');

test('PG/SP toman los valores reales y los limitan a su máximo',()=>{
 assert.deepEqual(H.reading({pg:18,pgMax:36},'pg'),{current:18,maximum:36,percent:50});
 assert.deepEqual(H.reading({sp:60,spMax:20},'sp'),{current:20,maximum:20,percent:100});
 assert.equal(H.reading({pg:10},'pg'),null);
 assert.equal(H.reading({pg:NaN,pgMax:36},'pg'),null);
 assert.equal(H.reading({pg:0,pgMax:0},'pg'),null);
});
test('Cada PE es un cuadrito; se admiten cambios del máximo',()=>{
 assert.deepEqual(H.segmentStates({pe:3,peMax:6}),[true,true,true,false,false,false]);
 assert.deepEqual(H.segmentStates({pe:2,peMax:2}),[true,true]);
 assert.deepEqual(H.segmentStates({pe:-3,peMax:3}),[false,false,false]);
 assert.deepEqual(H.segmentStates({pe:12,peMax:10}),Array(10).fill(true));
});
test('El motor pasa los recursos de FHCharacterRuntime durante el ciclo HUD',()=>{
 assert.match(editor,/FHStatusHUD\?\.update\(window\.FHCharacterRuntime\?\.character\?\.resources\)/);
 for(const file of ['fh-status-strings.js','fh-status-hud.js','fh-status-hud.css'])
  assert.ok(editor.includes('juego/assets/'+file),'Falta recurso: '+file);
});
test('La ubicación se centra y desaparece; el estado va a la esquina sin caja',()=>{
 assert.match(css,/left:50%;\s*transform:translateX\(-50%\)/);
 assert.match(css,/fh-location-hidden\s*\{\s*opacity:0/);
 assert.match(css,/#fhStatusHUD\s*\{[\s\S]*?width:min\(210px,calc\(100vw - 24px\)\)/);
 assert.match(css,/#fhStatusHUD\s*\{[\s\S]*?background:none;\s*border:0/);
 assert.match(css,/z-index:41; \/\* El anuncio temporal/);
 assert.match(css,/#fhStatusHUD\s*\{[\s\S]*?position:fixed;\s*top:calc\(15px \+ env\(safe-area-inset-top,0px\)\)/);
 assert.match(css,/@media\s*\(min-width:651px\) and \(max-width:756px\)\s*\{\s*#fhStatusHUD\s*\{width:min\(210px,calc\(50vw - 168px\)\);\}/);
 assert.match(css,/@media\(max-width:650px\)[\s\S]*?#fhStatusHUD\s*\{\s*width:min\(150px,calc\(100vw - 24px\)\);\s*\}/);
 assert.doesNotMatch(css,/top:calc\(83px \+ env\(safe-area-inset-top,0px\)\)/);
 assert.match(css,/--fh-status-pg:#c94d4a/);
 assert.match(css,/--fh-status-sp:#34c8d8/);
 assert.match(css,/--fh-status-pe:#ffe28a/);
 assert.match(css,/body\.fh-sleeping #fhStatusHUD/);
 assert.doesNotMatch(css,/clip-path|filter:blur|border-radius:\d+px/);
});
test('Los recursos no se posicionan a partir del panel de ubicación',()=>{
 const moduleText=fs.readFileSync(path.join(directory,'fh-status-hud.js'),'utf8');
 assert.doesNotMatch(moduleText,/function place\(|host\.getBoundingClientRect\(\)/);
 assert.match(moduleText,/panel\.append\(rows\[key\]\.row\)/);
});

test('Entre 651 y 756 px, PG/SP/PE permanecen a la izquierda del banner',()=>{
 for(const width of [651,675,700,743,756]){
  const leftBanner=(width-300)/2;
  const resourceWidth=Math.min(210,width/2-168);
  const rightResources=12+resourceWidth;
  assert.ok(rightResources<=leftBanner-5,
   'Se solapan a '+width+' px: recursos hasta '+rightResources+', banner desde '+leftBanner);
 }
});

test('Paleta de Heal, DMG, consumo de PE y veneno',()=>{
 const tones={
  'pg-heal':'#a8e6a3','sp-heal':'#9de8f0','pe-recover':'#ffe28a',
  'pg-damage':'#ff3434','sp-damage':'#ff9292',
  'pe-use':'#be9aff',poison:'#65ff32'
 };
 for(const [tone,hex] of Object.entries(tones)){
  assert.ok(css.includes('--fh-status-'+tone+':'+hex),'Falta color '+tone);
  assert.ok(css.includes('.fh-status-change--'+tone),'Falta estilo '+tone);
 }
 assert.match(css,/\.fh-status-pe-cell\.is-filled\s*\{[\s\S]*?background:var\(--fh-status-pe\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)[\s\S]*?#fhStatusHUD \.fh-status-change \{animation:none\}/);
 assert.deepEqual([
  H.changeTone('pg',12),H.changeTone('sp',3),H.changeTone('pe',2),
  H.changeTone('pg',-5),H.changeTone('sp',-2),H.changeTone('pe',-1),
  H.changeTone('pg',-5,'poison')
 ],['pg-heal','sp-heal','pe-recover','pg-damage','sp-damage','pe-use','poison']);
 assert.equal(H.changeTone('pe',-1,'poison'),'pe-use');
 assert.equal(H.changeTone('pg',0),null);
 assert.equal(H.changeTone('fake',-2),null);
 assert.equal(H.changeLabel('pe',4),'+4 PE');
 assert.equal(H.changeLabel('pg',-5,'poison'),'Veneno −5 PG');
 assert.equal(H.changeLabel('sp',-1.25),'−1.3 SP');
 assert.equal(H.changeLabel('pg',Number.NaN),'');
});
