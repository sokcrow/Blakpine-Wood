'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const HUD=require('./fh-nameplate-hud.js');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');

test('PG PS PE se leen de las claves reales con límite',()=>{
 assert.deepEqual(HUD.reading({pg:15,pgMax:30},'pg'),{current:15,maximum:30,percent:50});
 assert.deepEqual(HUD.reading({sp:25,spMax:20},'sp'),{current:20,maximum:20,percent:100});
 assert.deepEqual(HUD.reading({pe:-2,peMax:12},'pe'),{current:0,maximum:12,percent:0});
 assert.equal(HUD.reading({pg:1},'pg'),null);
 assert.equal(HUD.reading({pg:NaN,pgMax:1},'pg'),null);
 assert.equal(HUD.reading({pg:2,pgMax:0},'pg'),null);
});
test('Mood real se dibuja con los rostros existentes, no con una raya',()=>{
 assert.equal(HUD.moodIcon('bueno'),'☺');
 assert.equal(HUD.moodIcon('neutral'),'●');
 assert.equal(HUD.moodIcon('malo'),'☹');
 assert.equal(HUD.moodIcon(undefined),'◇');
 const js=read('fh-nameplate-hud.js');
 assert.match(js,/FH_MOOD_FEAR_IMAGES/);
 assert.match(js,/fh-np-mood-image/);
 assert.match(js,/ui\.moodImage\.setAttribute\('src', art\)/);
});
test('forma diagonal, barras reales y refresco independiente',()=>{
 const js=read('fh-nameplate-hud.js'),css=read('fh-nameplate-hud.css');
 assert.match(js,/root\.FHCharacterRuntime\?\.character/);
 assert.doesNotMatch(js,/requestAnimationFrame|if \(root\.document\) start\(\)/);
 assert.match(js,/function update\(character = root\.FHCharacterRuntime\?\.character \?\? null, position = null\)/);
 assert.match(js,/ui\.host\.style\.left = x \+ 'px'/);
 assert.match(js,/character\.mental\?\.mood/);
 assert.match(js,/character\.resources/);
 assert.match(js,/fh-np-health-fill/);
 assert.match(css,/\.fh-np-main-frame\s*\{[\s\S]*?clip-path:polygon/);
 assert.match(css,/\.fh-np-mood-frame\s*\{[\s\S]*?clip-path:polygon/);
 assert.match(css,/\.fh-np-meter\s*\{[\s\S]*?clip-path:polygon/);
 assert.match(css,/transition:width \.25s ease-out/);
 assert.match(css,/\#fhNameplateHUD \.fh-np-lower \{[\s\S]*?width:calc\(100% - 58px\)/);
 assert.match(css,/gap:1px;/);
 assert.match(css,/background:#09d9ee/);
 assert.match(css,/background:#51e584/);
 assert.match(css,/transform:translate\(-50%,-100%\)/);
 assert.doesNotMatch(js,/localStorage|GameState\s*=/);
});

test('sin personaje seleccionado no existe montaje automático ni HUD en esquina',()=>{
 const js=read('fh-nameplate-hud.js'),css=read('fh-nameplate-hud.css');
 assert.doesNotMatch(js,/if \(root\.document\) start\(\)/);
 assert.match(js,/if \(!character \|\| !pg \|\| !position/);
 assert.match(js,/function hide\(\)/);
 assert.doesNotMatch(css,/top:calc\(16px \+ env\(safe-area-inset-top/);
});

test('la placa está oculta hasta seleccionar, usa imágenes Mood y actualiza porcentajes',()=>{
 const doc=globalThis.document,art=globalThis.FH_MOOD_FEAR_IMAGES;
 const originalWidth=globalThis.innerWidth;
 class Element {
  constructor(tag){this.tagName=tag;this.className='';this.children=[];this.style={};this.attributes={};this.isConnected=true;this.hidden=false;this.offsetWidth=336;this.offsetHeight=110;}
  append(...nodes){this.children.push(...nodes);}
  setAttribute(key,value){this.attributes[key]=String(value);}
  getAttribute(key){return this.attributes[key]??null;}
  remove(){this.isConnected=false;}
 }
 const body=new Element('body');
 try{
  globalThis.document={body,createElement:tag=>new Element(tag),getElementById:()=>null};
  globalThis.innerWidth=844;
  globalThis.FH_MOOD_FEAR_IMAGES={bueno:'data:rostro-bueno',neutral:'data:rostro-neutral',malo:'data:rostro-malo'};
  assert.equal(HUD.mount(),true);
  const host=body.children[0];
  assert.equal(host.id,'fhNameplateHUD');
  assert.equal(host.hidden,true);
  const character={id:'jugador',name:'RAY',mental:{mood:'neutral'},resources:{pg:25,pgMax:100,sp:60,spMax:80,pe:30,peMax:60}};
  assert.equal(HUD.update(character),false,'sin posición no debe abrir');
  assert.equal(HUD.update(character,{x:420,y:250}),true);
  assert.equal(host.hidden,false);
  assert.equal(host.style.left,'420px');
  assert.equal(host.style.top,'233px');
  const head=host.children[0],mood=head.children[0].children[0].children[0];
  const sprite=mood.children[0],symbol=mood.children[1];
  assert.equal(sprite.getAttribute('src'),'data:rostro-neutral');
  assert.equal(sprite.hidden,false);
  assert.equal(symbol.hidden,true,'no debe aparecer la raya del placeholder');
  const pg=head.children[1].children[0].children[0].children[0];
  const lower=host.children[1];
  assert.equal(pg.style.width,'25%');
  assert.equal(lower.children[0].children[0].children[0].children[0].style.width,'75%');
  assert.equal(lower.children[1].children[0].children[0].children[0].style.width,'50%');
  character.resources.pg=10;
  character.resources.sp=24;
  character.resources.pe=0;
  character.mental.mood='malo';
  HUD.update(character,{x:430,y:260});
  assert.equal(pg.style.width,'10%');
  assert.equal(sprite.getAttribute('src'),'data:rostro-malo');
  assert.equal(lower.children[0].children[0].children[0].children[0].style.width,'30%');
  assert.equal(lower.children[1].children[0].children[0].children[0].style.width,'0%');
  assert.equal(HUD.hide(),false);
  assert.equal(host.hidden,true);
 }finally{
  HUD.hide();
  if(doc===undefined)delete globalThis.document;else globalThis.document=doc;
  if(art===undefined)delete globalThis.FH_MOOD_FEAR_IMAGES;else globalThis.FH_MOOD_FEAR_IMAGES=art;
  if(originalWidth===undefined)delete globalThis.innerWidth;else globalThis.innerWidth=originalWidth;
 }
});
