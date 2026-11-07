/* node --test juego/assets/fh-character-help.test.js */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'fh-character-help-strings.js'),'utf8');
const impl=fs.readFileSync(path.join(__dirname,'fh-character-help.js'),'utf8');
const core=fs.readFileSync(path.join(__dirname,'fh-skills.js'),'utf8');
const sTexts=fs.readFileSync(path.join(__dirname,'fh-skill-strings.js'),'utf8');
const scoreTexts=fs.readFileSync(path.join(__dirname,'fh-character-strings.js'),'utf8');
function mount(){
 const docHandlers={},windowHandlers={};
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.handlers={};this.attrs={};this._text='';this.style={};this.parentNode=null;this.className='';}
  set textContent(v){this.children=[];this._text=String(v);}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  setAttribute(k,v){this.attrs[k]=String(v)}
  getAttribute(k){return this.attrs[k]}
  removeAttribute(k){delete this.attrs[k]}
  append(...items){for(const c of items){this.children.push(c);c.parentNode=this}}
  remove(){if(this.parentNode){const cs=this.parentNode.children;cs.splice(cs.indexOf(this),1);this.parentNode=null}}
  addEventListener(k,cb){(this.handlers[k]??=[]).push(cb)}
  contains(other){for(let p=other;p;p=p.parentNode)if(p===this)return true;return false}
  getBoundingClientRect(){return {left:20,right:55,top:90,bottom:125,width:300,height:170}}
  focus(){}
  fire(key,e={}){for(const fn of this.handlers[key]||[])fn({target:this,stopPropagation(){},...e})}
 }
 const document={body:new Element('body'),createElement:tag=>new Element(tag),addEventListener:(key,fn)=>{docHandlers[key]=fn}};
 const win={document,innerWidth:420,innerHeight:820,addEventListener:(k,fn)=>(windowHandlers[k]??=[]).push(fn)};
 new Function('window',src)(win);
 new Function('window',impl)(win);
 return {win,document,docHandlers,windowHandlers};
}
test('catálogo cubre sin duplicados los 7 Scores, 32 habilidades y 3 recursos',()=>{
 const {win}=mount(),record=win.FH_CHARACTER_HELP_TEXT;
 const scores={};new Function('window',scoreTexts)({FH_CHARACTER_TEXT:scores});
 const S={};new Function('window','module',core)(S,{exports:{}});
 const names={};new Function('window',sTexts)(names);
 assert.equal(Object.keys(record.scores).length,7);
 assert.equal(Object.keys(record.skills).length,32);
 assert.equal(Object.keys(record.resources).length,3);
 assert.deepEqual(Object.keys(record.scores),['FOR','AGI','VOL','PRU','ING','ARC','SOC']);
 assert.deepEqual(Object.keys(record.skills).sort(),S.FHSkills.IDS.slice().sort());
 for(const [kind,values] of [['score',record.scores],['skill',record.skills],['resource',record.resources]])
  for(const [id,help] of Object.entries(values)){
   assert.ok(help.name&&help.description&&help.uses&&help.systems,kind+':'+id);
   assert.equal(win.FHCharacterHelp.lookup(kind,id).name,help.name);
  }
 assert.equal(win.FHCharacterHelp.lookup('skill','desconocida'),null);
});
test('tocar ayuda abre ficha, un toque exterior cierra y Escape no cierra el menú',()=>{
 const {win,document,docHandlers,windowHandlers}=mount(),H=win.FHCharacterHelp;
 const b=H.button('skill','cerrajeria');document.body.append(b);
 assert.equal(b.getAttribute('aria-expanded'),'false');
 b.fire('click');assert.equal(H.isOpen(),true);
 assert.equal(b.getAttribute('aria-expanded'),'true');
 assert.match(document.body.textContent,/Cerrajería/);
 assert.match(document.body.textContent,/tarjetas ni códigos/);
 docHandlers.pointerdown({target:document.body});assert.equal(H.isOpen(),false);
 b.fire('click');let prevented=0,stopped=0;
 const evt={key:'Escape',preventDefault(){prevented++},stopImmediatePropagation(){stopped++}};
 for(const fn of windowHandlers.keydown||[])fn(evt);
 assert.equal(H.isOpen(),false);assert.equal(prevented,1);assert.equal(stopped,1);
});
test('cada tooltip pertenece a su clave estable para reutilización futura',()=>{
 const {win}=mount(),H=win.FHCharacterHelp;
 for(const id of ['FOR','AGI','VOL','PRU','ING','ARC','SOC'])assert.equal(H.button('score',id).getAttribute('data-fh-help-id'),id);
 assert.equal(H.button('resource','pe').getAttribute('data-fh-help-type'),'resource');
 assert.equal(H.button('unknown','x'),null);
});
