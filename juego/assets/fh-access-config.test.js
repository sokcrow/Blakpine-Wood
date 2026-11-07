'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.join(__dirname,'../..');
const index=fs.readFileSync(path.join(base,'index.html'),'utf8');
const configCode=fs.readFileSync(path.join(__dirname,'fh-access-config.js'),'utf8');
const editorCode=fs.readFileSync(path.join(__dirname,'fh-access-editor.js'),'utf8');
const strs=fs.readFileSync(path.join(__dirname,'fh-architecture-strings.js'),'utf8');
function config(){
 const window={};
 vm.runInNewContext(configCode,{window,console});
 return window.FHAccessConfig;
}
function shared(){
 const start=index.indexOf('const ForestShared=(()=>{');
 const end=index.indexOf('\n})();',start);
 assert.ok(start>=0&&end>start,'módulo compartido no localizado');
 const context={};
 vm.runInNewContext(index.slice(start,end+6)+'\nthis.shared=ForestShared;',context);
 return context.shared;
}
function legacy(){
 return JSON.parse(fs.readFileSync(path.join(base,'forest-horror/maps/DEMO_Interacciones.json'),'utf8'));
}
function element(tag){
 return {tag,children:[],style:{},dataset:{},className:'',textContent:'',value:'',checked:false,
  append(...xs){this.children.push(...xs);},
  prepend(...xs){this.children.unshift(...xs);},
  setAttribute(k,v){this[k]=String(v);}
 };
}
function controls(root,key){
 const found=[];
 function walk(node){
  if(!node)return;
  if(node.dataset?.accessField===key)found.push(node);
  for(const child of node.children||[])walk(child);
 }
 walk(root);
 return found;
}
test('ausencia de campos opcionales no muta un mapa existente ni cambia el esquema',()=>{
 const c=config(),f=shared(),map=legacy(),before=JSON.stringify(map);
 const door=map.floors.flatMap(x=>x.items).find(x=>x.type==='door');
 const win=map.floors.flatMap(x=>x.items).find(x=>x.type==='window');
 assert.equal(c.effective(door,'interiorLatch'),false);
 assert.equal(c.effective(win,'windowOperation'),'fixed');
 assert.equal(c.effective(door,'unlockDurationSec'),0);
 assert.equal(c.effective(door,'lockMode'),'legacy');
 assert.equal(c.effective(door,'remoteControlPermission'),'none');
 assert.equal(map.schema,'forest-horror-map-v1');
 c.validateMap(map);
 assert.equal(JSON.stringify(map),before);
 const restored=f.loadProject(map);
 assert.equal(JSON.stringify(restored),before,'la importación no rellena los campos ausentes');
});
test('todos los campos nuevos sobreviven JSON y ForestShared.loadProject()',()=>{
 const c=config(),f=shared(),map=legacy();
 const items=map.floors.flatMap(x=>x.items);
 const door=items.find(x=>x.type==='door'),win=items.find(x=>x.type==='window');
 for(const [key,value] of Object.entries({
  accessDoorType:'electronic',doorMaterial:'reinforced',interiorLatch:true,
  credentialMode:'shared',credentialGroupId:'bloque_norte',
  unlockDurationSec:12,securityZoneId:'zona_A',
  remoteControlPermission:'authorized',lockMode:'unilateral'
 }))assert.equal(c.setField(door,key,value),true);
 assert.equal(c.setField(win,'windowOperation','operable'),true);
 assert.equal(c.setField(win,'curtains',true),true);
 const before=JSON.stringify(map);
 c.validateMap(map);
 const roundTrip=f.loadProject(JSON.parse(before));
 c.validateMap(roundTrip);
 assert.equal(JSON.stringify(roundTrip),before);
 const copied=roundTrip.floors.flatMap(x=>x.items);
 const otherDoor=copied.find(x=>x.id===door.id),otherWin=copied.find(x=>x.id===win.id);
 assert.equal(otherDoor.keyId,door.keyId,'no se altera la referencia de llave');
 assert.equal(otherDoor.credentialGroupId,'bloque_norte');
 assert.equal(otherDoor.lockMode,'unilateral');
 assert.equal(otherWin.windowOperation,'operable');
 assert.equal(otherWin.curtains,true);
 assert.equal(roundTrip.schema,'forest-horror-map-v1');
});
test('volver a predeterminado elimina solo la propiedad nueva',()=>{
 const c=config(),item={type:'door',id:'old',variant:'metal',keyId:'llave1',locked:true};
 const prior=JSON.stringify(item);
 assert.equal(c.setField(item,'interiorLatch',false),false);
 assert.equal(JSON.stringify(item),prior);
 assert.equal(c.setField(item,'interiorLatch',true),true);
 assert.equal(c.setField(item,'interiorLatch',false),true);
 assert.equal(JSON.stringify(item),prior);
 assert.equal(c.setField(item,'accessDoorType','manual'),true);
 assert.equal(c.setField(item,'accessDoorType','inherit'),true);
 assert.equal(JSON.stringify(item),prior);
});
test('valores fuera de contrato y metadatos malformados se rechazan sin cambiar otras puertas',()=>{
 const c=config(),item={type:'door',id:'d1',keyId:'original'};
 assert.throws(()=>c.setField(item,'unlockDurationSec',-2),/3600/);
 assert.throws(()=>c.setField(item,'unlockDurationSec',9999),/3600/);
 assert.throws(()=>c.setField(item,'remoteControlPermission','everyone'),/Opción/);
 assert.throws(()=>c.setField(item,'securityZoneId','x'.repeat(121)),/120/);
 assert.throws(()=>c.setField(item,'curtains',true),/incompatible/);
 assert.equal(item.keyId,'original');
 assert.equal(item.unlockDurationSec,undefined);
 const map=legacy(),door=map.floors.flatMap(x=>x.items).find(x=>x.type==='door');
 door.unlockDurationSec=Infinity;
 assert.throws(()=>c.validateMap(map),/floors\[\d+\]\.items\[\d+\]\.unlockDurationSec/);
});
test('inspector real: los cambios disparan record() y se almacenan como JSON',()=>{
 const cfg=config(),labels={};
 vm.runInNewContext(strs,{window:labels});
 const door={id:'d1',type:'door',variant:'metal',keyId:'legacy'},
  windowItem={id:'w1',type:'window',windowSkin:'clasica'};
 const project={schema:'forest-horror-map-v1',floors:[{items:[door,windowItem]}]};
 const parent=element('div'),snapshots=[];
 const doc={head:element('head'),createElement:element,
  getElementById:id=>id==='fields'?parent:null};
 const win={FHAccessConfig:cfg,FH_ARCHITECTURE_TEXT:labels.FH_ARCHITECTURE_TEXT};
 const scope={
  window:win,document:doc,current:()=>project.floors[0],selection:'d1',console,
  openInspector:()=>{parent.children=[];},
  record:()=>snapshots.push(JSON.stringify(project)),
  toast:message=>{throw Error(message)}
 };
 vm.runInNewContext(editorCode,scope);
 scope.openInspector();
 assert.equal(controls(parent,'doorMaterial').length,1);
 assert.equal(controls(parent,'accessDevice').length,0,'el lector usa el control preexistente');
 const material=controls(parent,'doorMaterial')[0].children.at(-1);
 material.value='metal';material.onchange();
 assert.equal(door.doorMaterial,'metal');
 assert.equal(snapshots.length,1);
 scope.openInspector();
 const credential=controls(parent,'credentialMode')[0].children.at(-1);
 credential.value='shared';credential.onchange();
 assert.equal(door.credentialMode,'shared');
 assert.equal(controls(parent,'credentialGroupId').length,1);
 const group=controls(parent,'credentialGroupId')[0].children.at(-1);
 group.value='   piso_b   ';group.onchange();
 assert.equal(door.credentialGroupId,'piso_b');
 scope.selection='w1';scope.openInspector();
 assert.equal(controls(parent,'interiorLatch').length,0);
 const curtains=controls(parent,'curtains')[0].children[0];
 curtains.checked=true;curtains.onchange();
 assert.equal(windowItem.curtains,true);
 assert.equal(snapshots.length,4);
 assert.equal(JSON.parse(snapshots.at(-1)).floors[0].items[1].curtains,true);
});
test('guardado local, importación y exportación consultan la validación sin duplicar keyId',()=>{
 assert.match(index,/FHAccessConfig\?\.validateMap\(draft\)/);
 assert.match(index,/FHAccessConfig\?\.validateMap\(obj\)/);
 assert.match(index,/FHAccessConfig\?\.validateMap\(doc\)/);
 assert.match(index,/fh-access-config\.js\?v=/);
 assert.match(index,/fh-access-editor\.js\?v=/);
 assert.match(editorCode,/const oldOpenInspector=openInspector/);
 assert.doesNotMatch(editorCode,/field\(section,item,'keyId'/);
 assert.doesNotMatch(editorCode,/field\(section,item,'accessSide'/);
 assert.doesNotMatch(editorCode,/field\(section,item,'accessDevice'/);
});
