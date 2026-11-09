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

test('el selector ofrece zonas independientes aunque repitan nombre y color',()=>{
 const {ctx,elements}=setup();ctx.refreshCircuits('b1');
 const groups=elements.circuitChooser.children.filter(c=>c.tagName==='option'&&c.value);
 assert.equal(groups.length,3);
 assert.deepEqual(groups.map(g=>g.value),['a1','a2','b1']);
 assert.notEqual(groups[0].textContent,groups[1].textContent,'IDs distinguen zonas con igual nombre');
 assert.equal(elements.circuitChooser.value,'b1');
 assert.match(elements.circuitStatus.textContent,/Pasillo.*b1.*1 breakers/);
});
test('Conexiones muestra una sección por zona y enumera los breakers que la alimentan',()=>{
 const {ctx,elements,state}=setup();ctx.modalCircuitAudit();
 const sections=elements.circuitAuditList.children.filter(c=>c.tagName==='section');
 assert.equal(sections.length,3);assert.match(state.html,/Conexiones por zona/);
 assert.match(sections[0].children[0].textContent,/a1/);
 assert.match(sections[2].children[0].textContent,/b1/);
 assert.equal(sections[0].children.filter(c=>c.tagName==='div').length,1);
 assert.match(sections[0].textContent,/Cuarto A/);assert.doesNotMatch(sections[0].textContent,/Cuarto B/);
 assert.match(sections[2].textContent,/Cuarto B/);assert.doesNotMatch(sections[2].textContent,/Cuarto A/);
 assert.match(sections[0].textContent,/1 habitaciones · 1 lámparas · 1 interruptores/);
 assert.match(sections[2].textContent,/1 habitaciones · 1 lámparas · 0 interruptores/);
});
test('los selectores de asignación conservan los IDs de zona',()=>{
 const {ctx}=setup(),options=ctx.circuitSelectOptions('orphan');
 assert.equal(options[1][0],'a1');assert.match(options[1][1],/Pasillo.*a1/);
 assert.equal(options[3][0],'b1');assert.match(options[3][1],/Pasillo.*b1/);
 assert.equal(options.at(-1)[0],'orphan');assert.match(options.at(-1)[1],/sin breaker/);
});
test('renombrar o recolorear un breaker no cambia sus asignaciones ni la selección',()=>{
 const {ctx,elements,items}=setup();ctx.refreshCircuits('b1');
 const before=JSON.stringify(items.filter(it=>it.type!=='breaker_panel'));
 items[0].label='Pasillo norte';items[0].circuits[0].circuitColor='#56a9e6';ctx.refreshCircuits();
 const groups=elements.circuitChooser.children.filter(c=>c.tagName==='option'&&c.value);
 assert.match(groups[0].textContent,/Pasillo.*a1/);
 assert.equal(elements.circuitChooser.value,'b1');assert.equal(elements.circuitColor.value,'#dc5656');
 assert.equal(JSON.stringify(items.filter(it=>it.type!=='breaker_panel')),before);
});
test('mapa sin breakers conserva estado vacío y alerta de conexiones huérfanas',()=>{
 const {ctx,elements,items,state}=setup(true);ctx.refreshCircuits();
 assert.equal(elements.circuitColor.disabled,true);assert.match(elements.circuitStatus.textContent,/Coloca un breaker/);
 ctx.modalCircuitAudit();assert.match(elements.circuitAuditList.textContent,/Aún no hay breakers/);
 items.push({id:'orphan',type:'light_fixture',zoneId:'missing'});ctx.modalCircuitAudit();
 assert.match(elements.circuitAuditList.textContent,/Sin breaker asignado: 1/);
 assert.match(state.html,/Conexiones por zona/);
});
test('los textos del menú se cargan antes de inicializar el editor',()=>{
 const script=editor.indexOf('fh-light-strings.js?v=20261109-zones-2');
 assert.ok(script>=0&&script<editor.indexOf('const ForestShared=(()=>{'));
});
test('varios breakers de una zona aparecen una sola vez en el selector y juntos en el resumen',()=>{
 const {ctx,items,elements}=setup();items[1].circuits[0].zoneId='a1';
 ctx.refreshCircuits('a1');
 const choices=elements.circuitChooser.children.filter(c=>c.tagName==='option'&&c.value);
 assert.deepEqual(choices.map(c=>c.value),['a1','a2']);assert.match(elements.circuitStatus.textContent,/2 breakers/);
 ctx.modalCircuitAudit();const group=elements.circuitAuditList.children.filter(c=>c.tagName==='section')[0];
 assert.match(group.textContent,/breaker-A/);assert.match(group.textContent,/breaker-B/);
});
test('se puede asignar un segundo breaker a una zona existente sin cambiar su ID propio',()=>{
 const {ctx,items}=setup();
 ctx.CIRCUIT_COLORS=['#dc5656'];ctx.record=()=>{};ctx.openInspector=()=>{};
 const start=editor.indexOf('function renderBreakerCircuits('),end=editor.indexOf('function renderAnchorInspector(',start);
 vm.runInContext(editor.slice(start,end),ctx);
 const fields=new Element('div');ctx.renderBreakerCircuits(items[1],fields);
 const descendants=node=>[node,...node.children.flatMap(descendants)];
 const label=descendants(fields).find(node=>node.tagName==='label'&&node.textContent.startsWith('Zona eléctrica compartida'));
 assert.ok(label);const select=label.children[0];select.value='a1';select.onchange();
 assert.equal(items[1].circuits[0].zoneId,'a1');assert.equal(items[1].circuits[0].id,'b1');
});
test('validación permite varios breakers en la misma zona sin cambiar el esquema',()=>{
 const {ctx}=setup();
 const project=JSON.parse(fs.readFileSync(path.join(__dirname,'../../forest-horror/maps/DEMO_Interacciones.json'),'utf8'));
 const panels=['new1','new2'].map(id=>({id,type:'breaker_panel',x:1,y:1,w:.75,h:.4,heightFt:5,rotation:0,zoneId:'shared',circuits:[{id:'c-'+id,zoneId:'shared',name:'Zona compartida'}]}));
 project.floors[0].items.push(...panels);ctx.projectToValidate=project;
 const result=vm.runInContext('ForestShared.validate(projectToValidate)',ctx);
 assert.equal(result.ok,true,JSON.stringify(result.errors));assert.equal(project.schema,'forest-horror-map-v1');
});
test('el color se mantiene coherente entre breakers de una zona, sin unir zonas por color',()=>{
 const {ctx,items}=setup();items[1].circuits[0].zoneId='a1';
 ctx.setZoneColor('a1','#56a9e6');
 assert.equal(items[0].circuits[0].circuitColor,'#56a9e6');assert.equal(items[1].circuits[0].circuitColor,'#56a9e6');
 assert.equal(items[0].circuits[1].circuitColor,'#dc5656');
 assert.deepEqual(Array.from(ctx.electricalZoneGroups(),z=>z.zoneId),['a1','a2']);
});
