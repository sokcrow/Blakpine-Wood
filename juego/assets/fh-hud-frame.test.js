/* Ejecutar: node juego/assets/fh-hud-frame.test.js */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const frame=require('./fh-hud-frame.js');
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}

test('marco doble con diagonales y muescas en escritorio',()=>{
  const d=frame.outlinePath(400,76,.5);
  const inner=frame.outlinePath(400,76,4.5);
  assert.ok(d.startsWith('M '));
  assert.ok(d.endsWith(' Z'));
  assert.ok(d.split(' L ').length>=14);
  assert.notEqual(d,inner);
  assert.doesNotMatch(d,/NaN|Infinity/);
});
test('conserva muescas y chaflanes en celular',()=>{
  const d=frame.outlinePath(225,64,.5);
  assert.ok(d.split(' L ').length>=14);
  assert.doesNotMatch(d,/NaN|Infinity/);
});
test('dimensiones inválidas no generan rutas',()=>{
  assert.equal(frame.outlinePath(0,100,.5),'');
  assert.equal(frame.outlinePath(100,0,.5),'');
  assert.equal(frame.outlinePath(100,100,-1),'');
});
test('montaje SVG idempotente sin alterar etiquetas existentes',()=>{
  const prior=global.document;
  const fakeDocument={
    createElementNS(ns,tag){
      assert.equal(ns,'http://www.w3.org/2000/svg');
      return {
        tagName:tag,children:[],attributes:{},parentNode:null,
        classList:{add(){}},
        setAttribute(key,val){this.attributes[key]=String(val);},
        append(...items){this.children.push(...items);}
      };
    }
  };
  const classes=new Set();
  const node={
    children:[],
    classList:{add(name){classes.add(name);}},
    getBoundingClientRect(){return {width:350,height:76};},
    insertBefore(child){child.parentNode=this;this.children.unshift(child);}
  };
  try{
    global.document=fakeDocument;
    assert.equal(frame.mount(node,'test'),true);
    assert.equal(frame.mount(node,'test'),true);
    assert.equal(node.children.length,1);
    assert.equal(classes.has('fh-hud-framed'),true);
    const svg=node.children[0];
    assert.equal(svg.tagName,'svg');
    assert.equal(svg.attributes['viewBox'],'0 0 350 76');
    assert.equal(svg.children.length,3); // defs + contorno exterior + interior
    assert.equal(svg.children[1].tagName,'path');
    assert.equal(svg.children[2].tagName,'path');
    // Simula replaceChildren() del HUD contextual.
    node.children=[];svg.parentNode=null;
    assert.equal(frame.mount(node,'test'),true);
    assert.equal(node.children[0],svg);
  }finally{
    if(prior===undefined)delete global.document;
    else global.document=prior;
  }
});
test('CSS afecta al juego y desactiva bordes recortados y sombras del panel',()=>{
  const css=fs.readFileSync(path.join(__dirname,'fh-hud-redesign.css'),'utf8');
  assert.match(css,/body\.fh-player-menu-ready #hud\.fh-location-hud/);
  assert.match(css,/body\.fh-player-menu-ready #fhPlayerMenu/);
  assert.match(css,/clip-path:none/);
  assert.match(css,/box-shadow:none/);
  assert.match(css,/#fhFloorCode\[hidden\]/);
});
test('vista previa carga nuevas capas después del HUD existente',()=>{
  const index=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
  assert.match(index,/fh-hud-redesign\.css\?v=/);
  assert.match(index,/fh-hud-frame\.js\?v=/);
  assert.match(index,/locationScript\+hudRedesignCss\+gameUiCss\+hudFrameScript\+mobileMenusCss\+statusCss\+statusStrings\+statusScript\+phoneCss\+phoneStrings\+phoneScript\+mobileCameraScript\+'<\/head>'/);
});
test('la lógica F1\/B1 y las zonas del mapa conservan su módulo',()=>{
  const location=fs.readFileSync(path.join(__dirname,'fh-location-hud.js'),'utf8');
  assert.match(location,/basement\?'B':'F'/);
  assert.match(location,/function resolve\(map,floorIndex,point/);
});
console.log(passed+' pruebas correctas');
