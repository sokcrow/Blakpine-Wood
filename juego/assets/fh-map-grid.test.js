const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const G=require('./fh-map-grid.js');
const source=fs.readFileSync(__dirname+'/../../index.html','utf8');
const copy=value=>JSON.parse(JSON.stringify(value));
const between=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
function fixture(){return {units:{columns:40,rows:40,gridPx:70,fitGridToImage:true,originPx:{x:0,y:0}},floors:[{id:'f1',reference:{data:'image',width:600,height:1200},items:[{id:'chair',type:'chair',x:10,y:20,w:.5,h:.5,rotation:90},{id:'wall',type:'wall',a:{x:3,y:4},b:{x:8,y:4}}]}]};}
function geometry(project){
 const context={project,window:{FHMapGrid:G},current:()=>project.floors[0]};
 vm.createContext(context);
 vm.runInContext("const origin=()=>project.units.originPx;\n"+between('const gridX=()=>','function ensureGridConfig'),context);
 return context;
}
test('los mapas nuevos son 40 × 40 y pueden existir sin imagen',()=>{
 const context={SCHEMA:'forest-horror-map-v1',ForestShared:{CURRENT_VERSION:1},window:{FH_MAP_GRID_TEXT:{noReference:'Sin referencia'}}};
 vm.createContext(context);
 vm.runInContext(between('const floorDefault=','let project=newProject()')+'\nthis.result=newProject();',context);
 assert.equal(context.result.units.columns,40);assert.equal(context.result.units.rows,40);
 assert.ok(context.result.floors.every(floor=>floor.reference.data===''));
 assert.equal(context.result.units.fitGridToImage,false);
});
test('referencias verticales y horizontales no distorsionan casillas ni coordenadas',()=>{
 const map=fixture(),context=geometry(map);
 const at=()=>copy(vm.runInContext('({cellX:gridX(),cellY:gridY(),pixel:toPixel({x:10,y:20}),point:toGrid(toPixel({x:10,y:20}))})',context));
 const first=at();map.floors[0].reference={width:2400,height:300};
 assert.deepEqual(at(),first);assert.equal(first.cellX,first.cellY);assert.deepEqual(first.point,{x:10,y:20});
});
test('migrar un mapa anterior conserva dimensiones, objetos, rotación e identificadores',()=>{
 const map=fixture();map.units.columns=16;map.units.rows=22;const before=copy(map.floors[0].items);
 G.normalize(map);assert.equal(map.units.columns,16);assert.equal(map.units.rows,22);
 assert.equal(map.units.fitGridToImage,false);assert.deepEqual(map.floors[0].items,before);
});
test('la referencia conserva proporción y su escala no cambia al ampliar la cuadrícula',()=>{
 const map=fixture();G.normalize(map);const ref=map.floors[0].reference,rect=G.referenceRect(map.units,ref);
 assert.equal(rect.width/rect.height,.5);
 const objects=copy(map.floors[0].items);map.units.columns=80;map.units.rows=60;
 assert.deepEqual(G.referenceRect(map.units,ref),rect);assert.deepEqual(map.floors[0].items,objects);
 ref.widthCells=12;ref.xCells=3;ref.yCells=-2;const next=G.referenceRect(map.units,ref);
 assert.deepEqual(next,{x:210,y:-140,width:840,height:1680});
 assert.deepEqual(map.floors[0].items,objects);
});
test('Ajustar encuadra el mapa completo incluso con origen desplazado o imágenes pequeñas',()=>{
 const project=fixture();project.units.originPx={x:100,y:-90};
 const context={project,window:{FHMapGrid:G},canvas:{clientWidth:800,clientHeight:600},view:{},render:()=>{}};
 vm.runInNewContext(between('function fitMap(){','function resize(){'),context);context.fitMap();
 const b=G.bounds(project.units),v=context.view;
 assert.ok(b.x*v.scale+v.tx>=9);assert.ok(b.y*v.scale+v.ty>=11);
 assert.ok((b.x+b.width)*v.scale+v.tx<=791);assert.ok((b.y+b.height)*v.scale+v.ty<=589);
});
test('dibujar usa límites del mapa; ocultar referencia o exportar limpio omite la imagen',()=>{
 const project=fixture(),images=[],rectangles=[];
 const canvas=new Proxy({drawImage:(...args)=>images.push(args),fillRect:(...args)=>rectangles.push(args)}, {get:(target,key)=>key in target?target[key]:(()=>{})});
 const context={project,window:{FHMapGrid:G},current:()=>project.floors[0],loadedImgs:[{}],floorIndex:0,gridVisible:true,
  activeCategory:'structure',activeLayer:'lighting',gridX:()=>70,gridY:()=>70,origin:()=>project.units.originPx};
 const start=source.indexOf('function renderOn('),end=source.indexOf('\nconst items=current().items;',start);
 vm.runInNewContext(source.slice(start,end)+'\nc.restore();}',context);
 context.renderOn(canvas,800,600,{tx:0,ty:0,scale:1});assert.equal(images.length,1);
 assert.ok(rectangles.some(rect=>rect[2]===2800&&rect[3]===2800));
 context.renderOn(canvas,800,600,{tx:0,ty:0,scale:1},{clean:true});assert.equal(images.length,1);
 project.floors[0].reference.visible=false;context.renderOn(canvas,800,600,{tx:0,ty:0,scale:1});assert.equal(images.length,1);
});
test('PNG usa dimensiones del mapa y no de la imagen de referencia',()=>{
 const project=fixture();let exported;
 const context={project,window:{FHMapGrid:G},document:{createElement:()=>({getContext:()=>({}),toBlob:callback=>callback({})})},renderOn:(ctx,w,h,cam,options)=>{exported={w,h,cam,options};},downloadBlob:()=>{},fileBase:()=> 'map',current:()=>project.floors[0],toast:()=>{}};
 vm.runInNewContext(between('function exportPNG(){','function importProject('),context);context.exportPNG();
 assert.equal(exported.w,2800);assert.equal(exported.h,2800);assert.equal(exported.options.clean,true);
});
