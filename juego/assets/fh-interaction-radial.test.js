/* Pruebas del comportamiento DOM del menú radial. */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

function mount(){
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.id='';this.children=[];this.parent=null;this.hidden=false;this.disabled=false;this.events={};this.attributes={};this.dataset={};this._text='';this._style={};this.style={setProperty:(name,value)=>this._style[name]=value};}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  set textContent(value){this._text=String(value);this.children=[];}
  append(...children){for(const child of children){this.children.push(child);child.parent=this;}}
  replaceChildren(...children){this.children=[];this._text='';this.append(...children);}
  setAttribute(key,value){this.attributes[key]=String(value);}
  addEventListener(type,listener){(this.events[type]||=[]).push(listener);}
  click(){if(this.disabled)return;for(const handler of this.events.click||[])handler({stopPropagation(){}})}
  focus(){doc.activeElement=this;}
 }
 const body=new Element('body'),doc={body,activeElement:body,createElement:tag=>new Element(tag)};
 doc.getElementById=id=>{const visit=node=>node.id===id?node:node.children.map(visit).find(Boolean);return visit(body);};
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
 assert.equal(root.hidden,false);
 assert.match(root.textContent,/Puerta/);
 assert.match(root.textContent,/Abrir/);
 assert.equal(api.visible,true);
 assert.equal(api.activatePrimary(),true);
 assert.deepEqual(calls,['primera']);
 api.update({key:'puerta1',title:'Puerta',x:345,y:260,actions:[
  {id:'abrir',label:'Abrir',run:()=>calls.push('segunda')}
 ]});
 doc.getElementById('fhRadialWheel').children[0].click();
 assert.deepEqual(calls,['primera','segunda']);
 api.update(null);
 assert.equal(root.hidden,true);
 assert.equal(api.activatePrimary(),false);
});

test('el radial no ejecuta acciones bloqueadas ni aparece encima de diálogos',()=>{
 const {doc,api,win}=mount();let called=0;
 api.update({key:'p',title:'Puerta',actions:[{id:'cerrada',label:'Bloqueada',disabled:true,run:()=>called++}]});
 assert.equal(api.activatePrimary(),false);
 assert.equal(called,0);
 win.FHPlayerMenu={isOpen:()=>true};
 api.update({key:'p',title:'Puerta',actions:[{id:'abrir',label:'Abrir',run:()=>called++}]});
 assert.equal(doc.getElementById('fhContextRadial').hidden,true);
});
