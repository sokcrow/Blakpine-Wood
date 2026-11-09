'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const editor=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const strings=fs.readFileSync(path.join(__dirname,'fh-light-strings.js'),'utf8');

class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.style={};this._text='';this.value='';}
 append(...children){this.children.push(...children)}
 replaceChildren(...children){this.children=[...children]}
 set textContent(value){this._text=String(value);this.children=[]}
 get textContent(){return this._text+this.children.map(c=>c.textContent).join(' ')}
}
function setup(empty=false){
 const panel=(id,zones)=>({id,type:'breaker_panel',label:'Panel',circuits:zones.map(zoneId=>({id:zoneId,zoneId,name:'Pasillo',circuitColor:'#dc5656'}))});
 const items=empty?[]:[panel('breaker-A',['a1','a2']),panel('breaker-B',['b1']),
  {id:'rA',type:'room',zoneId:'a1',label:'Cuarto A'},
  {id:'rB',type:'room',zoneId:'b1',label:'Cuarto B'},
  {id:'lightA',type:'light_fixture',zoneId:'a1'},
  {id:'lightB',type:'light_fixture',zoneId:'b1'},
  {id:'switchA',type:'light_switch',zoneId:'a1'}];
 const floor={id:'f',items};
 const elements=Object.fromEntries(['circuitChooser','circuitColor','circuitStatus','circuitAuditList','closeCircuitAudit'].map(id=>[id,new Element('div')]));
 elements.circuitChooser.tagName='select';
 const window={},state={html:''};
 const ctx=vm.createContext({window,document:{createElement:tag=>new Element(tag)},
  current:()=>floor,$:selector=>elements[selector.slice(1)],
  modal:(html,ready)=>{state.html=html;elements.circuitAuditList.replaceChildren();ready()},closeModal(){}});
 const sharedStart=editor.indexOf('const ForestShared=(()=>{'),sharedEnd=editor.indexOf("\n'use strict';",sharedStart);
 const menuStart=editor.indexOf('function availableCircuits()'),menuEnd=editor.indexOf('function setLayer(',menuStart);
 const auditStart=editor.indexOf('function modalCircuitAudit()'),auditEnd=editor.indexOf('function renderBreakerCircuits(',auditStart);
 assert.ok(sharedStart>=0&&sharedEnd>sharedStart&&menuEnd>menuStart&&auditEnd>auditStart);
 vm.runInContext(strings+editor.slice(sharedStart,sharedEnd)+editor.slice(menuStart,menuEnd)+editor.slice(auditStart,auditEnd),ctx);
 return {ctx,elements,items,state};
}

test('el selector agrupa por breaker aunque se repitan nombre, circuito y color',()=>{
 const {ctx,elements}=setup();ctx.refreshCircuits('b1');
 const groups=elements.circuitChooser.children.filter(c=>c.tagName==='optgroup');
 assert.equal(groups.length,2);
 assert.match(groups[0].label,/Panel.*breaker-A/);assert.match(groups[1].label,/Panel.*breaker-B/);
 assert.deepEqual(groups.map(g=>g.children.map(o=>o.value)),[['a1','a2'],['b1']]);
 assert.notEqual(groups[0].children[0].textContent,groups[0].children[1].textContent,'IDs distinguen circuitos con igual nombre');
 assert.equal(elements.circuitChooser.value,'b1');
 assert.match(elements.circuitStatus.textContent,/breaker-B.*Pasillo/);
});
test('Conexiones muestra una sección por breaker y sus propios dispositivos',()=>{
 const {ctx,elements,state}=setup();ctx.modalCircuitAudit();
 const sections=elements.circuitAuditList.children.filter(c=>c.tagName==='section');
 assert.equal(sections.length,2);assert.match(state.html,/Conexiones por breaker/);
 assert.match(sections[0].children[0].textContent,/breaker-A/);
 assert.match(sections[1].children[0].textContent,/breaker-B/);
 assert.equal(sections[0].children.filter(c=>c.tagName==='div').length,2);
 assert.equal(sections[1].children.filter(c=>c.tagName==='div').length,1);
 assert.match(sections[0].textContent,/Cuarto A/);assert.doesNotMatch(sections[0].textContent,/Cuarto B/);
 assert.match(sections[1].textContent,/Cuarto B/);assert.doesNotMatch(sections[1].textContent,/Cuarto A/);
 assert.match(sections[0].textContent,/1 habitaciones · 1 lámparas · 1 interruptores/);
 assert.match(sections[1].textContent,/1 habitaciones · 1 lámparas · 0 interruptores/);
});
test('los selectores de asignación anteponen el breaker y conservan los IDs del mapa',()=>{
 const {ctx}=setup(),options=ctx.circuitSelectOptions('orphan');
 assert.equal(options[1][0],'a1');assert.match(options[1][1],/^Panel.*breaker-A.*Pasillo.*a1/);
 assert.equal(options[3][0],'b1');assert.match(options[3][1],/^Panel.*breaker-B.*Pasillo.*b1/);
 assert.equal(options.at(-1)[0],'orphan');assert.match(options.at(-1)[1],/sin breaker/);
});
test('renombrar o recolorear un breaker no cambia sus asignaciones ni la selección',()=>{
 const {ctx,elements,items}=setup();ctx.refreshCircuits('b1');
 const before=JSON.stringify(items.filter(it=>it.type!=='breaker_panel'));
 items[0].label='Pasillo norte';items[0].circuits[0].circuitColor='#56a9e6';ctx.refreshCircuits();
 const groups=elements.circuitChooser.children.filter(c=>c.tagName==='optgroup');
 assert.match(groups[0].label,/Pasillo norte.*breaker-A/);
 assert.equal(elements.circuitChooser.value,'b1');assert.equal(elements.circuitColor.value,'#dc5656');
 assert.equal(JSON.stringify(items.filter(it=>it.type!=='breaker_panel')),before);
});
test('mapa sin breakers conserva estado vacío y alerta de conexiones huérfanas',()=>{
 const {ctx,elements,items,state}=setup(true);ctx.refreshCircuits();
 assert.equal(elements.circuitColor.disabled,true);assert.match(elements.circuitStatus.textContent,/Coloca un breaker/);
 ctx.modalCircuitAudit();assert.match(elements.circuitAuditList.textContent,/Aún no hay breakers/);
 items.push({id:'orphan',type:'light_fixture',zoneId:'missing'});ctx.modalCircuitAudit();
 assert.match(elements.circuitAuditList.textContent,/Sin breaker asignado: 1/);
 assert.match(state.html,/Conexiones por breaker/);
});
test('los textos del menú se cargan antes de inicializar el editor',()=>{
 const script=editor.indexOf('fh-light-strings.js?v=20261108-breaker-groups-1');
 assert.ok(script>=0&&script<editor.indexOf('const ForestShared=(()=>{'));
});
