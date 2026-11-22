'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const front=require('../juego/assets/fh-object-front.js');
require('../juego/assets/fh-object-front-strings.js');
const T=globalThis.FH_OBJECT_FRONT_TEXT;
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const s=html.indexOf('function renderObjectFrontControls(it,fields){');
const e=html.indexOf('\nfunction renderInteractionInspector(',s);
assert.ok(s>=0&&e>s);
const source=html.slice(s,e);
function el(tag){
 const node={tag,children:[],style:{},attributes:{},textContent:'',disabled:false,
  append(...children){this.children.push(...children)},
  setAttribute(name,value){this.attributes[name]=value},
  querySelectorAll(){return []}};
 return node;
}
function setup(item){
 const fields=el('div'),document={createElement:el},messages=[];
 const ctx={document,window:{FH_OBJECT_FRONT_TEXT:T,FHObjectFront:front,
  FHLights:{isWall:kind=>kind==='torch_wall'}},
  current:()=>({items:[item]}),
  hasVisualFront:obj=>front.hasFront(obj,new Set(['misc'])),
  setItemField(id,key,value){assert.equal(id,item.id);assert.equal(key,'rotation');
   item.rotation=value;messages.push(value)}};
 const render=vm.runInNewContext('('+source+')',ctx);
 render(item,fields);
 return {fields,item,messages};
}
test('Frente local +Y: rotación 0 = abajo; 90 = izquierda; 270 = derecha',()=>{
 const at0=front.forward(0),at90=front.forward(90),at270=front.forward(270);
 assert.equal(at0.x,0);assert.equal(at0.y,1);
 assert.ok(Math.abs(at90.x+1)<1e-9&&Math.abs(at90.y)<1e-9);
 assert.ok(Math.abs(at270.x-1)<1e-9&&Math.abs(at270.y)<1e-9);
 assert.equal(front.turn(350,45),35);
 assert.equal(front.turn(15,-45),330);
});
test('La UI del inspector muestra frente de muebles GLB y soporta ±45°, ±90° y reiniciar',()=>{
 const obj={id:'modelo_1',type:'misc',modelId:'mesa_taberna',rotation:0};
 const h=setup(obj);
 assert.equal(h.fields.children.length,1);
 const section=h.fields.children[0],row=section.children[1],buttons=section.children[3].children;
 assert.equal(section.attributes['aria-label'],T.title);
 assert.equal(row.children[1].textContent,'Frente: 0°');
 assert.equal(buttons.length,5);
 buttons[2].onclick();assert.equal(obj.rotation,45);
 assert.equal(row.children[1].textContent,'Frente: 45°');
 buttons[3].onclick();assert.equal(obj.rotation,135);
 buttons[0].onclick();assert.equal(obj.rotation,45);
 buttons[1].onclick();assert.equal(obj.rotation,0);
 buttons[4].onclick();assert.equal(obj.rotation,0);
 assert.deepEqual(h.messages,[45,135,45,0,0]);
});
test('Los objetos medievales y las luminarias aparecen orientables sin cambiar el mapa',()=>{
 const obj={id:'antorcha',type:'light_fixture',lightKind:'candle',rotation:270};
 const original=JSON.stringify(obj),h=setup(obj);
 assert.equal(h.fields.children[0].children[1].children[1].textContent,'Frente: 270°');
 assert.equal(JSON.stringify(obj),original);
 assert.equal(front.hasFront(obj,new Set()),true);
});
test('Los objetos anclados a pared explican que no pueden girar libremente',()=>{
 const obj={id:'antorcha_pared',type:'light_fixture',lightKind:'torch_wall',rotation:90};
 const h=setup(obj),children=h.fields.children[0].children;
 assert.equal(children.length,4);
 assert.match(children[3].textContent,/muro/);
 assert.equal(obj.rotation,90);
});
test('El editor utiliza la flecha en mapa y sólo rotation existente para guardado',()=>{
 assert.match(html,/const hasVisualFront=it=>window\.FHObjectFront\?\.hasFront/);
 assert.match(html,/if\(hasVisualFront\(it\)\)\{/);
 assert.match(html,/setItemField\(it\.id,'rotation',angle\)/);
 assert.match(html,/if\(hasVisualFront\(it\)\)renderObjectFrontControls/);
 assert.doesNotMatch(source,/it\.front\s*=/);
});
