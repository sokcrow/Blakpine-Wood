/* node --test juego/assets/fh-storage-editor.test.js */
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Core=require('./fh-inventory-core.js');
const Editor=require('./fh-storage-editor.js');
const defs=[
 {id:'lata',name:'Lata',kind:'consumable',storageCategory:'food',stackable:true},
 {id:'arroz',name:'Arroz',kind:'consumable',storageCategory:'food',stackable:true},
 {id:'pan',name:'Pan',kind:'consumable',storageCategory:'food',stackable:true},
 {id:'ropa',name:'Camiseta',kind:'consumable',storageCategory:'clothing',stackable:false},
 {id:'nota',name:'Nota',kind:'note',storageCategory:'document',stackable:false}
];

test('solo muebles configurables ofrecen inspector; los modelos anteriores siguen con su perfil',()=>{
 const counter={id:'c01',type:'misc',modelId:'encimera_simple'};
 assert.equal(Editor.canConfigure(counter),true);
 assert.equal(Editor.getProfile(counter).slots,6);
 assert.equal(Editor.getProfile({id:'c02',type:'misc',modelId:'alacena_superior'}).slots,6);
 assert.equal(Editor.getProfile({id:'c03',type:'misc',modelId:'refrigerador'}).slots,20);
 assert.equal(Editor.getProfile({id:'x',type:'misc',modelId:'mesa_sin_inventario'}),null);
 assert.equal(Editor.canConfigure({id:'door1',type:'door',modelId:'puerta_electronica'}),false);
 assert.equal(Editor.canConfigure({id:'pack1',type:'misc',modelId:'caja_carton_grande',runtimePackage:{orderId:'order1'}}),false);
});

test('las restricciones de capacidad y categoría se validan con el motor de inventarios',()=>{
 const alacena={id:'a',type:'misc',modelId:'alacena_superior'};
 const settings={enabled:true,slots:6,allowedCategories:['food','kitchen'],
  initialItems:[{id:'lata',quantity:3}]};
 assert.equal(Editor.validateConfig(alacena,settings,defs).ok,true);
 assert.equal(Editor.validateConfig(alacena,{...settings,slots:5},defs).reason,'slots');
 assert.equal(Editor.validateConfig(alacena,{...settings,allowedCategories:['clothing']},defs).reason,'category');
 assert.equal(Editor.validateConfig(alacena,{...settings,initialItems:[{id:'no_existe',quantity:1}]},defs).reason,'unknownItem');
 assert.equal(Editor.validateConfig(alacena,{...settings,initialItems:[{id:'ropa',quantity:2}],allowedCategories:['clothing']},defs).reason,'notStackable');
 assert.equal(Editor.validateConfig(alacena,{...settings,categoryLimits:{food:0}},defs).reason,'categoryFull');
});

test('límites por categoría, contenido inicial y serialización JSON no duplican ítems',()=>{
 const armario={id:'a',type:'misc',modelId:'armario'};
 const settings={enabled:true,slots:24,allowedCategories:['food','clothing'],
  categoryLimits:{food:2},initialItems:[{id:'lata',quantity:2},{id:'arroz',quantity:1}]};
 const result=Editor.validateConfig(armario,settings,defs);
 assert.equal(result.ok,true);
 const over=Editor.validateConfig(armario,{...settings,initialItems:[...settings.initialItems,{id:'pan',quantity:1}]},defs);
 assert.equal(over.reason,'categoryFull');
 const project={schema:'forest-horror-map-v1',itemDefs:defs,
  floors:[{id:'F1',items:[{...armario,storage:{...settings,initialItems:result.items}}]}]};
 const imported=JSON.parse(JSON.stringify(project));
 const world=Core.createWorld(imported.itemDefs);
 const savedItem=imported.floors[0].items[0];
 assert.equal(Core.addFurniture(world,'F1:'+savedItem.id,savedItem.modelId,{
  ...savedItem.storage,items:savedItem.storage.initialItems
 }).ok,true);
 assert.equal(world.furniture['F1:a'].items.length,2);
 assert.equal(world.furniture['F1:a'].items[0].quantity,2);
});

function fakeDOM(){
 class Element{
  constructor(name){this.tagName=name.toUpperCase();this.children=[];this.type='';this.value='';
   this.className='';this.style={};this.textContent='';this.ownerDocument=doc;}
  append(...items){this.children.push(...items);}
  setAttribute(name,value){this[name]=String(value);}
 }
 const doc={createElement:name=>new Element(name)};
 const root=doc.createElement('div');
 const descendants=(node,fn)=>[...(fn(node)?[node]:[]),...node.children.flatMap(child=>descendants(child,fn))];
 return {root,descendants};
}
test('el inspector del editor graba capacidad y permite elegir ítems compatibles',()=>{
 const {root,descendants}=fakeDOM();
 const item={id:'enc01',type:'misc',modelId:'encimera_simple'};
 let saves=0,opens=0;
 const callbacks={project:{itemDefs:defs},record(){saves++},openInspector(){opens++},
  toast(message){assert.fail(message)},canEdit(){return true}};
 assert.equal(Editor.attachInspector(item,root,callbacks),true);
 const capacity=descendants(root,el=>el.tagName==='INPUT'&&el.type==='number')[0];
 assert.equal(capacity.value,'6');
 capacity.value='12';capacity.onchange();
 assert.equal(item.storage.slots,12);
 assert.equal(saves,1);
 assert.equal(opens,1);
 const next=fakeDOM();
 Editor.attachInspector(item,next.root,callbacks);
 const picker=next.descendants(next.root,el=>el.tagName==='SELECT').at(-1);
 const add=next.descendants(next.root,el=>el.tagName==='BUTTON'&&el.textContent==='＋ Agregar')[0];
 assert.ok(picker&&add);
 picker.value='lata';add.onclick();
 assert.deepEqual(item.storage.initialItems,[{id:'lata',quantity:1}]);
 assert.equal(saves,2);
 const bad=fakeDOM();
 let denied=0;
 Editor.attachInspector(item,bad.root,{...callbacks,canEdit(){return false},toast(){denied++}});
 const blocked=bad.descendants(bad.root,el=>el.tagName==='INPUT'&&el.type==='number')[0];
 blocked.value='24';blocked.onchange();
 assert.equal(item.storage.slots,12);
 assert.equal(denied,1);
});

test('mueble sin inventario predeterminado puede habilitarse individualmente',()=>{
 const item={id:'t01',type:'misc',modelId:'mesa_sin_inventario'};
 const {root,descendants}=fakeDOM();
 let saves=0;
 assert.equal(Editor.attachInspector(item,root,{project:{itemDefs:defs},record(){saves++},openInspector(){}}),true);
 const button=descendants(root,el=>el.tagName==='BUTTON')[0];
 assert.equal(button.textContent,'Habilitar inventario');
 button.onclick();
 assert.equal(item.storage.enabled,true);
 assert.equal(item.storage.slots,6);
 assert.equal(Core.furnitureProfile(item.modelId,item.storage).slots,6);
 assert.equal(saves,1);
});

test('el inspector preserva storage.items de mapas antiguos y lo migra a initialItems',()=>{
 const item={id:'a',type:'misc',modelId:'alacena_superior',storage:{
  slots:6,items:[{id:'lata',quantity:3}]
 }};
 const {root,descendants}=fakeDOM();
 let saves=0;
 Editor.attachInspector(item,root,{project:{itemDefs:defs},record(){saves++},openInspector(){}});
 const capacity=descendants(root,el=>el.tagName==='INPUT'&&el.type==='number')[0];
 capacity.value='9';capacity.onchange();
 assert.equal(saves,1);
 assert.equal(item.storage.slots,9);
 assert.deepEqual(item.storage.initialItems,[{id:'lata',quantity:3}]);
 assert.equal(Object.hasOwn(item.storage,'items'),false);
});

test('el editor principal conecta el nuevo inspector sin cambiar el esquema JSON',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const index=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 assert.match(index,/FHStorageEditor\?\.attachInspector\(it,fields/);
 assert.match(index,/fh-storage-editor\.js\?v=20261108-storage-editor-1/);
 assert.match(index,/fh-inventory-core\.js\?v=20261108-encimera-1/);
 assert.match(index,/const MAP_SCHEMA='forest-horror-map-v1'/);
});
