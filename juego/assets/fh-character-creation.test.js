/* node juego/assets/fh-character-creation.test.js */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const pattern of [
 /fh-character-creation\.css/,
 /fh-character-strings\.js/,
 /fh-character-core\.js/,
 /fh-character-creation\.js/,
 /async function start3DPreview\(/,
 /await window\.FHCharacterCreation\.ensureCharacter\(\)/,
 /__runtimeCharacter:fhProfile/,
 /fhSavedState\?\.characterId===DATA\.__runtimeCharacter\.id/,
 /fhBackupState\?\.characterId===DATA\.__runtimeCharacter\.id/,
 /GameState\.characterId=fhIncomingCharacter\.id/,
 /FOREST_CHARACTER_DEATH/,
 /FHCharacterCore\?\.syncResourcesFromSave/,
 /GameEvents\.on\('character:death',fhNotifyCharacterDeath\)/
])assert.match(index,pattern);
const src=fs.readFileSync(path.join(__dirname,'fh-character-core.js'),'utf8');
const strings=fs.readFileSync(path.join(__dirname,'fh-character-strings.js'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'fh-character-creation.js'),'utf8');
const helpTexts=fs.readFileSync(path.join(__dirname,'fh-character-help-strings.js'),'utf8');
const helpUI=fs.readFileSync(path.join(__dirname,'fh-character-help.js'),'utf8');
class Node {
 constructor(tag,document){this.tag=tag;this.document=document;this.children=[];this.listeners={};this.className='';this.attrs={};this.textContent='';this.isConnected=true;this.disabled=false;this.value=''}
 append(...nodes){this.children.push(...nodes);for(const n of nodes)n.parent=this}
 replaceChildren(...nodes){this.children=nodes;for(const n of nodes)n.parent=this}
 setAttribute(k,v){this.attrs[k]=v}
 addEventListener(k,fn){(this.listeners[k]??=[]).push(fn)}
 focus(){this.document.activeElement=this}
 remove(){this.parent.children=this.parent.children.filter(n=>n!==this);this.isConnected=false}
 querySelector(){return null}
 querySelectorAll(selector){return this.children.flatMap(n=>[n,...n.querySelectorAll(selector)])}
}
const doc={activeElement:null,createElement(tag){return new Node(tag,this)}};doc.body=doc.createElement('body');
const values=new Map();
const window={document:doc,localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},
 crypto:{randomUUID:()=> 'first-id'},addEventListener(){},removeEventListener(){}};
const context={window,Date,Math,JSON,Object,Set,Error,Number,String,Array};
for(const [filename,code] of [['helpTexts',helpTexts],['helpUI',helpUI],['strings',strings],['core',src],['creation',ui]])vm.runInNewContext(code,context,{filename});
const P=window.FHCharacterCreation,T=window.FH_CHARACTER_TEXT;
function panel(){return doc.body.children[0].children[0]}
function content(){return panel().children[4]}
function nav(){return panel().children[6]}
function next(){nav().children[2].onclick()}
function pick(title){
 const choices=content().children.find(n=>n.className==='fhcc-choices');
 const choice=choices.children.find(n=>n.children[0]?.children[0]?.textContent===title||n.children[0]?.textContent===title);
 assert.ok(choice,title);
 const button=choice.children[0]?.tag==='button'?choice.children[0]:choice;
 button.onclick();
}
(async()=>{
 const pending=P.ensureCharacter();
 assert.equal(doc.body.children.length,1);
 pick(T.resident);next();
 const fields=content().children.filter(n=>n.tag==='label');
 fields[0].children[1].value='María';fields[0].children[1].listeners.input[0]();
 fields[1].children[1].value='Lucía';fields[1].children[1].listeners.input[0]();
 fields[2].children[1].value='hermana';fields[2].children[1].onchange();next();
 assert.equal(content().children.find(n=>n.className==='fhcc-choices').children.filter(n=>n.className==='fhcc-score-choice').length,7);
 const choiceHelp=content().children.find(n=>n.className==='fhcc-choices').children[0].children[1];
 assert.equal(choiceHelp.className,'fh-help-trigger');
 assert.equal(choiceHelp.attrs['data-fh-help-type'],'score');
 choiceHelp.listeners.click[0]({stopPropagation(){}});
 assert.equal(window.FHCharacterHelp.isOpen(),true);
 window.FHCharacterHelp.close();
 pick('Fortaleza');pick('Agilidad');next();
 pick('Voluntad');pick('Prudencia');next();
 for(const key of ['FOR','AGI','ING','SOC']){
  const row=content().children.find(n=>n.className==='fhcc-score-row'&&n.children[1].attrs['data-score']===key);
  assert.ok(row,key);row.children[3].onclick();
 }
 assert.equal(nav().children[2].disabled,false);next();
 const helpCount=content().querySelectorAll('button').filter(n=>n.className==='fh-help-trigger').length;
 assert.equal(helpCount,10);
 next();
 const created=await pending;
 assert.equal(created.scores.FOR,6);assert.equal(created.scores.AGI,6);
 assert.equal(P.current().name,'María');assert.equal(doc.body.children.length,0);
 assert.equal(P.markDead(created.id),true);
 const second=P.ensureCharacter();assert.equal(doc.body.children.length,1);
 nav().children[0].onclick();assert.equal(await second,null);
 console.log('PASS fh-character-creation: entrada, cuestionario y nueva vida');
})().catch(err=>{console.error(err);process.exitCode=1});
