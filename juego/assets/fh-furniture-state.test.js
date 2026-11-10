const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const S=require('./fh-furniture-state.js');
const copy=value=>JSON.parse(JSON.stringify(value));
const product={id:'mesa_pequena',name:'Mesa pequeña',widthFt:3,depthFt:2,heightFt:2.5};
const context={window:{}};
vm.runInNewContext(fs.readFileSync(__dirname+'/fh-furniture-rules.js','utf8'),context);
const applyModel=(item,p)=>context.window.FHFurnitureRules.applyCatalogModel(item,p,{PROP_ACTIONS:{}},5);
function fixture(){
 const map={floors:[{id:'floor1',items:[{id:'legacy',type:'chair',decoratable:false,x:3,y:3,w:.5,h:.5}]}]};
 const state={characterId:'player',flags:{quest:true},inventory:['key'],decoration:{poses:{'0:legacy':{x:4,y:5,rotation:90}}},delivery:{orders:[{id:'order',productId:'mesa_pequena',status:'unboxed'}],furnishings:[{id:'delivered_order',orderId:'order',productId:'mesa_pequena',floor:0,x:6,y:7,rotation:45}]}};
 return {map,state};
}
test('incorpora muebles comprados y posiciones guardadas sin duplicar sus IDs',()=>{
 const {map,state}=fixture();S.hydrate(map,state,[product],applyModel);
 assert.equal(map.floors[0].items[0].x,4);
 assert.equal(map.floors[0].items[1].w,.6);
 assert.equal(map.floors[0].items[1].rotation,45);
 S.hydrate(map,state,[product],applyModel);assert.equal(map.floors[0].items.length,2);
});
test('mover o girar en el editor actualiza la partida sin perder inventario ni progreso',()=>{
 const {map,state}=fixture();S.hydrate(map,state,[product],applyModel);const before=copy(map);
 map.floors[0].items[0].x=10;map.floors[0].items[1].x=12;map.floors[0].items[1].rotation=180;
 assert.equal(S.syncEdits(before,map,state),true);
 assert.equal(state.decoration.poses['0:legacy'],undefined);
 assert.equal(state.delivery.furnishings[0].x,12);assert.equal(state.delivery.furnishings[0].rotation,180);
 assert.deepEqual(state.inventory,['key']);assert.deepEqual(state.flags,{quest:true});
});
test('eliminar mesa comprada y silla Legacy sobrevive al guardado, carga y nueva importación',()=>{
 const {map,state}=fixture();S.hydrate(map,state,[product],applyModel);
 state.decoration.editorItems=S.capture(map);const before=copy(map);map.floors[0].items=[];
 S.syncEdits(before,map,state);
 const reloaded=JSON.parse(JSON.stringify({map,state}));S.hydrate(reloaded.map,reloaded.state,[product],applyModel);
 assert.equal(reloaded.map.floors[0].items.length,0);assert.equal(reloaded.state.delivery.furnishings.length,0);
 assert.equal(reloaded.state.delivery.orders[0].status,'unboxed');
});
test('deshacer y rehacer la eliminación restaura y vuelve a retirar el registro de entrega',()=>{
 const {map,state}=fixture();S.hydrate(map,state,[product],applyModel);const before=copy(map);
 map.floors[0].items=[];S.syncEdits(before,map,state);const deleted=copy(map);
 map.floors=copy(before.floors);S.syncEdits(deleted,map,state);
 assert.equal(state.delivery.furnishings[0].id,'delivered_order');
 S.syncEdits(map,deleted,state);assert.equal(state.delivery.furnishings.length,0);
});
test('no revive muebles almacenados ni comparte muebles entre personajes',()=>{
 const {map,state}=fixture();S.hydrate(map,state,[product],applyModel);
 state.delivery.furnishings[0].stored=true;
 assert.equal(S.runtimeItems(map.floors[0].items,state).length,1);
 state.delivery.furnishings[0].stored=false;state.characterId='another';
 assert.equal(S.runtimeItems(map.floors[0].items,state).length,1);
});
test('snapshot rescata objetos runtime sin catálogo y permite eliminarlos',()=>{
 const {map,state}=fixture();state.delivery.furnishings=[];
 state.decoration.editorItems=[{id:'floor1',items:[{id:'orphan',type:'misc',x:2,y:2,w:1,h:1}]}];
 S.hydrate(map,state);assert.ok(map.floors[0].items.some(item=>item.id==='orphan'));
 const before=copy(map);map.floors[0].items=map.floors[0].items.filter(item=>item.id!=='orphan');
 S.syncEdits(before,map,state);S.hydrate(map,state);assert.equal(map.floors[0].items.length,1);
});
test('sin catálogo existe un objeto recuperable; los cambios de tamaño no se pierden al abrir la lista',()=>{
 const {map,state}=fixture();S.hydrate(map,state);const before=copy(map);
 map.floors[0].items[1].w=3;S.syncEdits(before,map,state);S.hydrate(map,state);
 assert.equal(map.floors[0].items[1].w,3);
});
test('la selección del creador incluye Legacy bloqueado para decoración, sin incluir arquitectura ni paquetes',()=>{
 assert.equal(S.editable({id:'chair',type:'chair',x:1,y:1,decoratable:false}),true);
 assert.equal(S.editable({id:'area',type:'building',x:1,y:1}),false);
 assert.equal(S.editable({id:'wall',type:'wall',a:{x:1,y:1},b:{x:1,y:2}}),false);
 assert.equal(S.editable({id:'package',type:'misc',x:1,y:1,runtimePackage:{}}),false);
});
