'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const Exterior=require('./fh-exterior-grid.js');
const code=fs.readFileSync(require('node:path').join(__dirname,'fh-exterior-editor.js'),'utf8');
const strings=fs.readFileSync(require('node:path').join(__dirname,'fh-exterior-strings.js'),'utf8');
class El{
 constructor(tag){this.tagName=tag;this.children=[];this.value='';this.style={};this.dataset={};this.hidden=false;this.checked=false;
  this.classList={add(){},remove(){}};this._text='';this.onclick=null;}
 append(...args){this.children.push(...args);}
 appendChild(e){this.append(e);return e;}
 set textContent(v){this._text=v;this.children=[];}
 get textContent(){return this._text;}
 replaceChildren(...els){this.children=els;}
 setAttribute(){}
 addEventListener(){}
 focus(){}
 querySelector(){return null;}
}
function createHarness(){
 const byId={tools:new El('div'),fields:new El('div'),inspTitle:new El('span')};
 const document={baseURI:'https://blakpine.example/index.html',head:new El('head'),body:new El('body'),activeElement:null,
  createElement:tag=>new El(tag),createTextNode:text=>text,
  getElementById:id=>{
   const search=(item)=>{if(!item||typeof item!=='object')return null;if(item.id===id)return item;
    for(const child of item.children||[]){const result=search(child);if(result)return result;}return null;};
   return byId[id]||search(document.body)||search(byId.tools)||search(document.head);
  },
  querySelector:selector=>selector==='#tools'?byId.tools:null};
 const entry={id:'transformador_poste_simple',name:'Transformador de poste',thumbnail:'miniaturas/transformador_poste_simple.png',widthFt:4,heightFt:20,depthFt:4};
 const project={units:{feetPerCell:5},floors:[{id:'pb',elevationFt:0,items:[]}]};
 let selection=null,tool='',category='';const messages=[];
 const root={document,FHExteriorGrid:Exterior,FHFurnitureRules:{applyCatalogModel(item,e,shared,feet){item.modelId=e.id;item.type='misc';item.label=e.name;item.w=e.widthFt/feet;return item;}}};
 const ctx={window:root,document,URL,console,ForestShared:{},project,fetch:async()=>({ok:true,json:async()=>({furniture:[entry]})}),
   get activeCategory(){return category;},
   get floorIndex(){return 0;},
   get selection(){return selection;},
   setCategory(cat){category=cat;byId.tools.replaceChildren();},
   chooseTool(t){tool=t;},
   createObject(type,pos){return {id:'obj_123',type,...pos};},
   openInspector(){byId.inspTitle.textContent='Mueble libre';byId.fields.replaceChildren();},
   current:()=>project.floors[0],toast:msg=>messages.push(msg),record(){},render(){}};
 vm.runInNewContext(strings,ctx,{filename:'fh-exterior-strings.js'});
 vm.runInNewContext(code,ctx,{filename:'fh-exterior-editor.js'});
 return {root,ctx,entry,project,byId,messages,select:val=>selection=val,cat:()=>category,tool:()=>tool};
}
test('el picker activa la capa Iluminación y conserva el modelo eléctrico al colocar',async()=>{
 const h=createHarness();h.ctx.setCategory('lighting');
 await h.root.FHExteriorEditor.open();
 await new Promise(setImmediate);
 const picker=h.ctx.document.getElementById('fhExteriorPicker');
 assert.ok(picker,'el picker se crea');
 const panel=picker.children[0],choices=panel.children[1];
 assert.equal(choices.children.length,1);
 choices.children[0].onclick();
 assert.equal(h.cat(),'lighting','el selector no cambia a muebles');
 assert.equal(h.tool(),'misc','conserva el mecanismo genérico de creación v1');
 assert.match(h.ctx.document.getElementById('fhExteriorPlaceTool')?.textContent||'',/Transformador/);
 const obj=h.ctx.createObject('misc',{x:1,y:2});
 assert.equal(obj.modelId,'transformador_poste_simple');
 assert.equal(obj.exteriorKind,'transformer');
 assert.equal(obj.exteriorGridEnabled,true);
 const panelItem={id:'breaker',type:'breaker_panel',x:1.5,y:2,exteriorAutoConnect:true,powerSource:{kind:'none'}};
 h.project.floors[0].items.push(obj,panelItem);
 const grid=Exterior.createRuntime(h.project,{});
 assert.equal(grid.panelConnection(0,panelItem)?.powered,true);
 h.select(obj.id);h.ctx.openInspector();
 assert.match(h.byId.inspTitle.textContent,/Transformador eléctrico/);
 assert.ok(h.byId.fields.children.some(e=>/breaker/.test(e.textContent)));
});
test('la red exterior se dibuja en la capa eléctrica sin depender de muebles',()=>{
 const h=createHarness();const transformer={id:'t',type:'misc',modelId:'transformador_poste_simple',x:1,y:1};
 const lamp={id:'l',type:'misc',modelId:'poste_luz_con_brazo',x:2,y:1};
 const panel={id:'p',type:'breaker_panel',x:3,y:1,exteriorAutoConnect:true};
 h.project.floors[0].items.push(transformer,lamp,panel);
 const marks=[];
 const c={save(){},restore(){},beginPath(){},setLineDash(){},moveTo(x,y){marks.push(['move',x,y])},lineTo(x,y){marks.push(['line',x,y])},stroke(){}};
 h.root.FHExteriorEditor.drawGrid(c,1,item=>({x:item.x,y:item.y}));
 assert.ok(marks.filter(a=>a[0]==='line').length>=2,'enlaces entre postes y breaker visibles');
});


test('inspector permite conectar y desconectar un poste mediante selector eléctrico',()=>{
 const h=createHarness(),t={id:'t',modelId:'transformador_poste_simple',x:0,y:0},
  pole={id:'poste',type:'misc',modelId:'poste_luz_concreto',x:5,y:0};
 h.project.floors[0].items.push(t,pole);
 h.select(pole.id);h.ctx.openInspector();
 const label=h.byId.fields.children.find(x=>x.textContent===h.root.FH_EXTERIOR_TEXT.linkParent);
 assert.ok(label,'selector de alimentación del poste');
 const input=label.children[0];input.value='off';input.onchange();
 assert.equal(pole.exteriorLinkMode,'off');
 assert.equal(Exterior.createRuntime(h.project,{}).links().length,0);
 input.value='node:t';input.onchange();
 assert.equal(pole.exteriorLinkMode,'manual');
 assert.equal(pole.exteriorParentId,'t');
 const grid=Exterior.createRuntime(h.project,{});
 assert.equal(grid.energized(grid.nodes[1]),true);
});
test('inspector de breaker selecciona nodo de red y muestra demanda',()=>{
 const h=createHarness(),t={id:'t',modelId:'transformador_poste_simple',x:0,y:0},
  p={id:'panel',type:'breaker_panel',x:1,y:0,powerSource:{kind:'utility'},capacityWatts:2400};
 h.project.floors[0].items.push(t,p);
 h.select(p.id);h.ctx.openInspector();
 const label=h.byId.fields.children.find(x=>x.textContent===h.root.FH_EXTERIOR_TEXT.breakerSource);
 assert.ok(label,'fuente específica del breaker');
 const input=label.children[0];input.value='node:t';input.onchange();
 assert.equal(p.exteriorConnectionMode,'manual');
 assert.equal(p.exteriorNodeId,'t');
 assert.equal(p.exteriorAutoConnect,true);
 const grid=Exterior.createRuntime(h.project,{});
 assert.equal(grid.panelConnection(0,p)?.powered,true);
 assert.ok(h.byId.fields.children.some(x=>x.textContent===h.root.FH_EXTERIOR_TEXT.demandWatts));
});
test('cobertura de farola aparece en mapa 2D mientras tiene energía',()=>{
 const h=createHarness(),tx={id:'t',modelId:'transformador_poste_simple',x:0,y:0},
  lamp={id:'l',modelId:'poste_luz_con_brazo',x:5,y:0};
 h.project.floors[0].items.push(tx,lamp);
 let fills=0;
 const c={save(){},restore(){},beginPath(){},setLineDash(){},moveTo(){},lineTo(){},stroke(){},
  arc(){},fill(){fills++;}};
 h.root.FHExteriorEditor.drawGrid(c,1,item=>({x:item.x,y:item.y}));
 assert.equal(fills,2,'cobertura brillante y tenue');
 lamp.exteriorLinkMode='off';
 h.root.FHExteriorEditor.drawGrid(c,1,item=>({x:item.x,y:item.y}));
 assert.equal(fills,2,'farola desconectada no ilumina');
});
