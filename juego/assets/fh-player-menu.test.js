/* Regresión del HUD: datos del personaje y controles reales de Opciones.
   Ejecutar: node --test juego/assets/fh-player-menu.test.js */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const menuSource=fs.readFileSync(path.join(__dirname,'fh-player-menu.js'),'utf8');
const stringsSource=fs.readFileSync(path.join(__dirname,'fh-player-menu-strings.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'fh-player-menu.css'),'utf8');
const skillSource=fs.readFileSync(path.join(__dirname,'fh-skills.js'),'utf8');
const skillTextSource=fs.readFileSync(path.join(__dirname,'fh-skill-strings.js'),'utf8');
const helpTextSource=fs.readFileSync(path.join(__dirname,'fh-character-help-strings.js'),'utf8');
const helpModuleSource=fs.readFileSync(path.join(__dirname,'fh-character-help.js'),'utf8');

function scene(profile){
  let focus=null;
  const clicks={};
  class Element {
    constructor(tag='div'){
      this.tagName=tag.toUpperCase();this.id='';this.className='';this._text='';
      this.children=[];this.parentNode=null;this.attributes={};this.dataset={};
      this.handlers={};this.hidden=false;this.disabled=false;this.tabIndex=0;
      this.scrollTop=0;this.onclick=null;this.style={};
    }
    get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
    set textContent(value){this.replaceChildren();this._text=String(value??'');}
    get classList(){return{
      add:key=>{if(!this.className.split(' ').includes(key))this.className+=(this.className?' ':'')+key;},
      remove:key=>{this.className=this.className.split(' ').filter(v=>v!==key).join(' ');},
      contains:key=>this.className.split(' ').includes(key)
    };}
    get isConnected(){let node=this;while(node.parentNode)node=node.parentNode;return node===body;}
    append(...children){
      for(const child of children){
        if(child.parentNode){
          const siblings=child.parentNode.children;
          siblings.splice(siblings.indexOf(child),1);
        }
        this.children.push(child);child.parentNode=this;
      }
    }
    replaceChildren(...children){
      for(const child of this.children)child.parentNode=null;
      this.children=[];this._text='';this.append(...children);
    }
    setAttribute(key,value){
      this.attributes[key]=String(value);
      if(key==='tabindex')this.tabIndex=Number(value);
    }
    getAttribute(key){return this.attributes[key];}
    removeAttribute(key){delete this.attributes[key];}
    remove(){if(this.parentNode){const siblings=this.parentNode.children;siblings.splice(siblings.indexOf(this),1);this.parentNode=null;}}
    getBoundingClientRect(){return {left:12,right:46,top:42,bottom:76,width:300,height:220};}
    addEventListener(key,handler){(this.handlers[key]??=[]).push(handler);}
    focus(){focus=this;}
    click(){
      if(this.disabled)return;
      const event={target:this};
      this.onclick?.(event);
      for(const handler of this.handlers.click??[])handler(event);
    }
    querySelectorAll(selector){
      const found=[];
      function matches(element){
        if(selector==='button')return element.tagName==='BUTTON';
        if(selector==='[data-fh-setting]')return !!element.dataset.fhSetting;
        if(selector==='[aria-selected="true"]')return element.attributes['aria-selected']==='true';
        if(selector.startsWith('#'))return element.id===selector.slice(1);
        if(selector.startsWith('.'))return element.className.split(' ').includes(selector.slice(1));
        return false;
      }
      function visit(node){
        for(const child of node.children){
          if(matches(child))found.push(child);
          visit(child);
        }
      }
      visit(this);
      return found;
    }
    querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
    contains(element){
      for(let node=element;node;node=node.parentNode)if(node===this)return true;
      return false;
    }
    getClientRects(){return [{}];}
    closest(){return null;}
  }
  const body=new Element('body');
  const document={
    body,readyState:'complete',
    createElement:tag=>new Element(tag),
    getElementById:id=>body.querySelector('#'+id),
    get activeElement(){return focus??body;},
    addEventListener(type,callback){(this.handlers??={})[type]=callback;}
  };
  function add(tag,id,value){
    const element=new Element(tag);element.id=id;element.textContent=value??'';
    body.append(element);return element;
  }
  add('div','hud');add('details','hudOptions');
  add('button','inventoryToggle','Mochila 3/8');add('div','inventoryPanel');
  add('span','floorLabel','Piso 1');add('span','regionLabel','Cabaña');
  add('button','flashlightToggle','Linterna 65%');
  for(const [id,value,next] of [
    ['pixelBtn','Píxel: 2x','Píxel: 3x'],
    ['fhDecorModeBtn','Decorar: desactivado','Decorar: activado'],
    ['gridBtn','Cuadrícula: no','Cuadrícula: sí'],
    ['fullscreenBtn','Horizontal','Salir'],
    ['mapBtn','Editor','Editor'],
    ['floorBtn','Piso 1','Piso 2']
  ]){
    const control=add('button',id,value);
    control.onclick=()=>{clicks[id]=(clicks[id]||0)+1;control.textContent=next;};
  }
  const global={
    document,parent:null,console:{warn(){}},addEventListener(){},
    get FHCharacterRuntime(){return {character:profile.current};}
  };
  global.parent=global;
  new Function('window',stringsSource)(global);
  new Function('window','module',skillSource)(global,{exports:{}});
  new Function('window',skillTextSource)(global);
  new Function('window',helpTextSource)(global);
  new Function('window',helpModuleSource)(global);
  new Function('window',menuSource)(global);
  const menu=document.getElementById('fhMenuToggle');
  const tabs=document.getElementById('fhPlayerMenuNav');
  const detail=document.getElementById('fhPlayerMenuDetail');
  menu.click();
  return {global,menu,tabs,detail,document,clicks,focus:()=>focus};
}

const example={
  name:'Elena Flores',origin:'resident',
  scores:{FOR:5,AGI:4,VOL:3,PRU:2,ING:6,ARC:1,SOC:4},
  resources:{pg:20,pgMax:36,sp:14,spMax:24,pe:7,peMax:15}
};

test('Estado lee nombre, origen, siete atributos y PG/SP/PE actuales de la partida',()=>{
  const profile={current:structuredClone(example)};
  const {tabs,detail}=scene(profile);
  assert.equal(tabs.children.length,4);
  tabs.children[2].click();
  assert.match(detail.textContent,/Elena Flores/);
  assert.match(detail.textContent,/Residente/);
  assert.equal(detail.querySelectorAll('.fh-stat-row').length,7);
  assert.equal(detail.querySelectorAll('.fh-skill-row').length,32);
  assert.equal(detail.querySelectorAll('.fh-help-trigger').length,42);
  const help=detail.querySelectorAll('.fh-help-trigger')[0];
  assert.equal(help.getAttribute('data-fh-help-id'),'FOR');
  help.click();
  assert.equal(help.getAttribute('aria-expanded'),'true');
  assert.match(detail.textContent,/20 \/ 36/);
  assert.match(detail.textContent,/14 \/ 24/);
  assert.match(detail.textContent,/7 \/ 15/);
  for(const bar of detail.querySelectorAll('.fh-resource-track')){
    assert.equal(bar.getAttribute('role'),'progressbar');
    assert.ok(bar.getAttribute('aria-valuenow')!==undefined);
  }
  profile.current.resources.pg=4;
  tabs.children[3].click();
  tabs.children[2].click();
  assert.match(detail.textContent,/4 \/ 36/);
});

test('Estado no genera estadísticas cuando falta el personaje',()=>{
  const {tabs,detail}=scene({current:null});
  tabs.children[2].click();
  assert.match(detail.textContent,/No hay datos de un personaje activo/);
  assert.equal(detail.querySelectorAll('.fh-stat-row').length,7);
  for(const value of detail.querySelectorAll('.fh-resource-number'))
    assert.equal(value.textContent,'—');
});

test('Opciones ofrece Decorar en lugar de Pixel y separa la salida al editor',()=>{
  const {tabs,detail,global,clicks}=scene({current:structuredClone(example)});
  tabs.children[3].click();
  const controls=detail.querySelectorAll('[data-fh-setting]');
  assert.equal(controls.length,2);
  assert.doesNotMatch(detail.textContent,/Cuadrícula/);
  assert.doesNotMatch(detail.textContent,/Cambiar piso/);
  controls[0].click();
  assert.equal(clicks.fhDecorModeBtn,1);
  assert.match(controls[0].textContent,/activado/);
  assert.equal(clicks.pixelBtn,undefined);
  assert.equal(clicks.gridBtn,undefined);
  controls[1].click();
  assert.equal(clicks.fullscreenBtn,1);
  assert.match(controls[1].textContent,/Salir/);
  assert.match(detail.textContent,/Salir de la partida/);
  detail.querySelector('.fh-setting-editor').click();
  assert.equal(clicks.mapBtn,1);
  assert.equal(clicks.floorBtn,undefined);
  assert.equal(global.FHPlayerMenu.isOpen(),false);
});

test('Estado y Opciones mantienen distribución adaptable y foco visible',()=>{
  assert.match(css,/\.fh-status-grid/);
  assert.match(css,/grid-template-columns:minmax\(0,1\.08fr\) minmax\(0,1fr\)/);
  assert.match(css,/@media\(max-width:740px\) and \(orientation:portrait\)/);
  assert.match(css,/\.fh-setting-control:focus-visible|#fhPlayerMenu button:focus-visible/);
});
