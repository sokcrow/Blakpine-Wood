/* Pruebas del comportamiento DOM del menú radial. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

function mount(){
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.id='';this.children=[];this.parent=null;this.hidden=false;this.disabled=false;this.events={};this.attributes={};this.dataset={};this._text='';this._style={};this.style={setProperty:(name,value)=>this._style[name]=value};this.classList={toggle:()=>{},contains:()=>false};}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  set textContent(value){this._text=String(value);this.children=[];}
  append(...children){for(const child of children){if(child.parent)child.parent.children=child.parent.children.filter(node=>node!==child);this.children.push(child);child.parent=this;}}
  replaceChildren(...children){this.children.forEach(child=>child.parent=null);this.children=[];this._text='';this.append(...children);}
  setAttribute(key,value){this.attributes[key]=String(value);}
  contains(node){for(let el=node;el;el=el.parent)if(el===this)return true;return false;}
  blur(){if(doc.activeElement===this)doc.activeElement=body;}
  addEventListener(type,listener){(this.events[type]||=[]).push(listener);}
  click(){if(this.disabled)return;for(const handler of this.events.click||[])handler({stopPropagation(){}})}
  focus(){doc.activeElement=this;}
 }
 const body=new Element('body'),doc={body,activeElement:body,createElement:tag=>new Element(tag)};
 doc.getElementById=id=>{const visit=node=>node.id===id?node:node.children.map(visit).find(Boolean);return visit(body);};
 const docEvents={};
 doc.addEventListener=(type,handler)=>{(docEvents[type]||=[]).push(handler);};
 doc.fire=(type,event)=>{for(const listener of docEvents[type]||[])listener(event);};
 const win={document:doc,innerWidth:900,innerHeight:700};
 const source=fs.readFileSync(path.join(__dirname,'fh-interaction-radial.js'),'utf8');
 new Function('window',source)(win);
 return {win,doc,api:win.FHInteractionRadial};
}

test('el radial no aparece sin objetivo y dispara la acción del objeto activo',()=>{
 const {doc,api}=mount();const calls=[];
 api.update(null);
 api.update({key:'puerta1',title:'Puerta',x:330,y:240,actions:[
  {id:'abrir',label:'Abrir',run:()=>calls.push('primera')}
 ]});
 const root=doc.getElementById('fhContextRadial');
 assert.equal(root.hidden,true);
 assert.equal(api.visible,false);
 api.open({key:'puerta1',title:'Puerta',x:330,y:240,actions:[{id:'abrir',label:'Abrir',run:()=>calls.push('primera')}]});
 assert.equal(root.hidden,false);
 assert.match(root.textContent,/Puerta/);
 assert.match(root.textContent,/Abrir/);
 assert.equal(api.visible,true);
 assert.equal(api.activatePrimary(),true);
 assert.deepEqual(calls,['primera']);
 api.update({key:'puerta1',title:'Puerta',x:345,y:260,actions:[
  {id:'abrir',label:'Abrir',run:()=>calls.push('segunda')}
 ]});
 api.open({key:'puerta1',title:'Puerta',x:345,y:260,actions:[{id:'abrir',label:'Abrir',run:()=>calls.push('segunda')}]});
 doc.getElementById('fhRadialWheel').children.find(child=>child.dataset.index==='0').click();
 assert.deepEqual(calls,['primera','segunda']);
 api.update(null);
 assert.equal(root.hidden,true);
 assert.equal(api.activatePrimary(),false);
});

test('el radial no ejecuta acciones bloqueadas ni aparece encima de diálogos',()=>{
 const {doc,api,win}=mount();let called=0;
 api.open({key:'p',title:'Puerta',actions:[{id:'cerrada',label:'Bloqueada',disabled:true,run:()=>called++}]});
 assert.equal(api.activatePrimary(),false);
 assert.equal(called,0);
 win.FHPlayerMenu={isOpen:()=>true};
 api.open({key:'p',title:'Puerta',actions:[{id:'abrir',label:'Abrir',run:()=>called++}]});
 assert.equal(doc.getElementById('fhContextRadial').hidden,true);
});


test('la mano central cierra el menú sin reabrirlo mientras apunta al mismo objeto',()=>{
 const {doc,api}=mount();let calls=0;
 const context={key:'puerta',title:'Puerta',actions:[{id:'abrir',label:'Abrir',run:()=>calls++}]};
 api.open(context);
 const center=doc.getElementById('fhRadialCenter');
 assert.equal(center.tagName,'BUTTON');
 assert.equal(center.attributes['aria-label'],'Cerrar menú radial');
 center.click();
 assert.equal(api.visible,false);
 api.update(context);
 assert.equal(api.visible,false);
 assert.equal(api.activatePrimary(),false);
 assert.equal(calls,0);
 api.update(null);
 assert.equal(api.visible,false);
 api.open(context);
 assert.equal(api.visible,true);
});

test('las cuatro etiquetas se sitúan arriba, derecha, abajo e izquierda',()=>{
 const {doc,api}=mount();
 api.open({key:'door',title:'Puerta 204',actions:['Abrir','Mirilla','Llamar','Examinar'].map(id=>({id,label:id,run:()=>{}}))});
 const wheel=doc.getElementById('fhRadialWheel');
 const items=wheel.children.filter(child=>child.dataset.index!==undefined);
 assert.equal(items.length,4);
 assert.equal(wheel._style['--fh-radial-step'],'90deg');
 const coords=items.map(item=>[Number(item._style['--fh-label-x'].replace('%','')),Number(item._style['--fh-label-y'].replace('%',''))]);
 assert.ok(coords[0][1]<50);
 assert.ok(coords[1][0]>50);
 assert.ok(coords[2][1]>50);
 assert.ok(coords[3][0]<50);
});

test('navegación con teclado solo mientras el radial tiene foco',()=>{
 const {doc,api}=mount();let calls=0;
 api.open({key:'puerta',title:'Puerta',actions:[
  {id:'abrir',label:'Abrir',run:()=>calls++},
  {id:'mirilla',label:'Mirilla',run:()=>calls++}
 ]});
 const items=doc.getElementById('fhRadialWheel').children.filter(child=>child.dataset.index!==undefined);
 const event=key=>({key,preventDefault(){this.prevented=true},stopPropagation(){}});
 assert.equal(api.keydown(event('ArrowRight')),false);
 items[0].focus();
 const e=event('ArrowRight');
 assert.equal(api.keydown(e),true);
 assert.equal(e.prevented,true);
 assert.equal(doc.activeElement,items[1]);
 assert.equal(api.keydown(event('Enter')),true);
 assert.equal(calls,1);
 assert.equal(api.visible,false);
 api.open({key:'puerta',title:'Puerta',actions:[{id:'abrir',label:'Abrir',run:()=>calls++}]});
 doc.getElementById('fhRadialCenter').focus();
 assert.equal(api.keydown(event('Escape')),true);
 assert.equal(api.visible,false);
});


test('la puerta mantiene cuatro sectores aunque haya acciones pendientes',()=>{
 const {doc,api}=mount();
 let opened=0;
 api.open({key:'door:204',title:'Puerta 204',actions:[
  {id:'primary',label:'Abrir',run:()=>opened++},
  {id:'peephole',label:'Mirilla',disabled:true},
  {id:'knock',label:'Llamar',disabled:true},
  {id:'examine',label:'Examinar',disabled:true}
 ]});
 const wheel=doc.getElementById('fhRadialWheel');
 const buttons=wheel.children.filter(child=>child.dataset.index!==undefined);
 assert.equal(buttons.length,4);
 assert.deepEqual(buttons.map(button=>button.children[0].textContent),['Abrir','Mirilla','Llamar','Examinar']);
 assert.deepEqual(buttons.map(button=>button.disabled),[false,true,true,true]);
 buttons[1].click();
 buttons[2].click();
 buttons[3].click();
 assert.equal(opened,0);
 assert.equal(api.activatePrimary(),true);
 assert.equal(opened,1);
});


test('tamaño compacto para móvil y escritorio sin alterar acciones',()=>{
 const {win,doc,api}=mount();let executions=0;
 const context={key:'door:test',title:'Puerta',actions:[
  {id:'open',label:'Abrir puerta',run:()=>executions++},
  {id:'look',label:'Mirilla',disabled:true},
  {id:'knock',label:'Llamar',disabled:true},
  {id:'examine',label:'Examinar',disabled:true}
 ]};
 win.innerWidth=375;win.innerHeight=700;
 api.open(context);
 const root=doc.getElementById('fhContextRadial');
 assert.equal(root._style['--fh-radial-size'],'164px');
 assert.equal(doc.getElementById('fhRadialWheel').children.filter(child=>child.dataset.index!==undefined).length,4);
 api.activatePrimary();
 assert.equal(executions,1);
 win.innerWidth=1200;win.innerHeight=800;
 api.open(context);
 assert.equal(root._style['--fh-radial-size'],'208px');
 win.innerWidth=900;win.innerHeight=250;
 api.update(context);
 assert.equal(root._style['--fh-radial-size'],'144px');
});


test('tap fuera del radial lo cierra sin reabrirlo en el mismo toque',()=>{
 const {doc,api}=mount();
 const context={key:'puerta204',title:'Puerta',actions:[{id:'abrir',label:'Abrir',run:()=>{}}]};
 api.open(context);
 const center=doc.getElementById('fhRadialCenter');
 doc.fire('pointerdown',{target:center,pointerId:11});
 assert.equal(api.visible,true);
 doc.fire('pointerdown',{target:doc.body,pointerId:12});
 assert.equal(api.visible,false);
 assert.equal(api.consumeOutsidePress(12),true);
 assert.equal(api.consumeOutsidePress(12),false);
 api.update(context);
 assert.equal(api.visible,false);
 api.open(context);
 assert.equal(api.visible,true);
 doc.fire('pointerdown',{target:doc.body,pointerId:13});
 doc.fire('pointerup',{target:doc.body,pointerId:13});
 assert.equal(api.consumeOutsidePress(13),false);
});

test('solo existe un radial y cambiar de objetivo reemplaza el menú actual',()=>{
 const {doc,api}=mount();
 api.open({key:'door:1',title:'Puerta 1',actions:[{id:'open',label:'Abrir',run:()=>{}}]});
 api.open({key:'door:2',title:'Puerta 2',actions:[{id:'close',label:'Cerrar',run:()=>{}}]});
 assert.equal(doc.body.children.filter(child=>child.id==='fhContextRadial').length,1);
 assert.equal(api.target,'door:2');
 assert.match(doc.getElementById('fhContextRadial').textContent,/Puerta 2/);
 api.update({key:'door:1',title:'Puerta 1',actions:[{id:'open',label:'Abrir',run:()=>{}}]});
 assert.equal(api.visible,false);
});
