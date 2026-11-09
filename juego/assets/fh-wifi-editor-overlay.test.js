/* Ejecutar: node --test juego/assets/fh-wifi-editor-overlay.test.js */
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const FH=require('./fh-services-core.js');
const WiFi=require('./fh-wifi-editor-overlay.js');

function fixture(){
 const items=[
  {id:'base',type:'wall',a:{x:0,y:0},b:{x:6,y:0}},
  {id:'split',type:'wall',a:{x:3,y:0},b:{x:3,y:6}},
  {id:'breaker',type:'breaker_panel',x:0,y:0,circuits:[{zoneId:'a',rangeFt:40}]},
  {id:'plug',type:'power_outlet',x:3,y:3,zoneId:'a',slots:2,capacityRayos:6},
  {id:'router',type:'router',x:3,y:3.4,outletId:'plug',wifiRadiusFt:120}
 ];
 return {schema:'forest-horror-map-v1',units:{feetPerCell:5,columns:30,rows:24},
  floors:[{id:'f0',elevationFt:0,items}]};
}
function barsAt(coverage,x,y){
 const i=Math.floor((x-coverage.x0)/coverage.step);
 const j=Math.floor((y-coverage.y0)/coverage.step);
 return i>=0&&i<coverage.width&&j>=0&&j<coverage.height?
  coverage.bars[j*coverage.width+i]:0;
}
test('router seleccionado: intensidad idéntica a wifiAt del motor en cada casilla',()=>{
 const project=fixture(),runtime=FH.createRuntime(project,{});
 const coverage=WiFi.computeCoverage(project,0,'router');
 assert.equal(coverage.powered,true);
 assert.ok(coverage.covered>0);
 for(const [x,y] of [[3,3],[6,3],[12,3],[20,3],[25,15]]){
  const expected=runtime.wifiAt(0,x+.5,y+.5).find(n=>n.routerId==='router')?.bars||0;
  assert.equal(barsAt(coverage,x,y),expected,'Casilla '+x+','+y);
 }
});
test('pared estructural y puerta cerrada reducen la cobertura; puerta abierta recupera intensidad',()=>{
 const project=fixture(),point={x:20,y:3};
 const direct=barsAt(WiFi.computeCoverage(project,0,'router'),point.x,point.y);
 assert.equal(direct,2);
 const obstacle={id:'obstacle',type:'red_wall',a:{x:10,y:0},b:{x:10,y:24}};
 project.floors[0].items.push(obstacle);
 assert.equal(barsAt(WiFi.computeCoverage(project,0,'router'),point.x,point.y),0);
 obstacle.type='door';obstacle.open=false;
 assert.equal(barsAt(WiFi.computeCoverage(project,0,'router'),point.x,point.y),1);
 obstacle.open=true;
 assert.equal(barsAt(WiFi.computeCoverage(project,0,'router'),point.x,point.y),2);
});
test('cobertura sin electricidad queda vacía; no simula un router desconectado',()=>{
 const project=fixture();
 project.floors[0].items=project.floors[0].items.filter(it=>it.type!=='breaker_panel');
 const coverage=WiFi.computeCoverage(project,0,'router');
 assert.equal(coverage.powered,false);
 assert.equal(coverage.covered,0);
 assert.ok(coverage.bars.every(n=>n===0));
});
test('selección y pisos: otro router no sustituye al seleccionado',()=>{
 const project=fixture();
 const before=WiFi.computeCoverage(project,0,'router');
 project.floors[0].items.push({id:'router2',type:'router',x:3,y:3.2,outletId:'plug',wifiRadiusFt:120});
 const after=WiFi.computeCoverage(project,0,'router');
 assert.deepEqual([...after.bars],[...before.bars]);
 project.floors.push({id:'f1',elevationFt:12,items:[]});
 assert.equal(WiFi.computeCoverage(project,1,'router'),null);
 assert.equal(WiFi.computeCoverage(project,0,'no-existe'),null);
});
test('no modifica mapa JSON ni esquema y limita cantidad de muestras',()=>{
 const project=fixture(),before=JSON.stringify(project);
 project.units.columns=500;project.units.rows=500;
 project.floors[0].items.find(it=>it.id==='router').wifiRadiusFt=3000;
 const snapshot=JSON.stringify(project),coverage=WiFi.computeCoverage(project,0,'router');
 assert.equal(project.schema,'forest-horror-map-v1');
 assert.equal(JSON.stringify(project),snapshot);
 assert.ok(coverage.width<=80&&coverage.height<=80);
 assert.ok(before.includes('forest-horror-map-v1'));
});
test('integración en index.html: solo Redes + router, no dentro del motor 3D',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 assert.match(html,/fh-wifi-editor-overlay\.js/);
 assert.match(html,/activeCategory==='network'/);
 assert.match(html,/it=>it\.id===selection&&it\.type==='router'/);
 assert.match(html,/window\.FHWifiEditorOverlay\?\.draw\(/);
 assert.match(html,/wifiCoverageLegend/);
});
test('leyenda y raster: visible con router; oculta sin selección',()=>{
 const oldDoc=global.document;
 const legend={hidden:true,children:[],replaceChildren(...v){this.children=v;},
  append(...v){this.children.push(...v);}};
 const calls=[];
 const doc={
  getElementById(id){return id==='wifiCoverageLegend'?legend:null;},
  createTextNode(value){return {textContent:value};},
  createElement(tag){
   if(tag==='canvas')return {width:0,height:0,getContext(){return {
    createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},
    putImageData(data){calls.push(['raster',data.data.length]);}
   }}};
   return {tag,style:{},children:[],textContent:'',
    append(...nodes){this.children.push(...nodes);},
    setAttribute(){}};
  }
 };
 global.document=doc;
 try{
  const project=fixture(),router=project.floors[0].items.find(it=>it.id==='router');
  const ctx={save(){},restore(){},drawImage(){calls.push(['draw']);}};
  const opts={project,floorIndex:0,router,toPixel:p=>p,gridX:1,gridY:1};
  const result=WiFi.draw(ctx,opts);
  assert.equal(result.powered,true);assert.equal(legend.hidden,false);
  assert.ok(calls.some(call=>call[0]==='draw'));
  const rasters=()=>calls.filter(call=>call[0]==='raster').length;
  const initial=rasters();
  WiFi.draw(ctx,opts);
  assert.equal(rasters(),initial,'pan y zoom reutilizan el raster almacenado');
  router.wifiRadiusFt=50;
  const revised=WiFi.draw(ctx,opts);
  assert.equal(revised.powered,true);
  assert.equal(rasters(),initial+1,'al modificar el router se recalcula la imagen');
  WiFi.draw(ctx,{...opts,router:null});
  assert.equal(legend.hidden,true);
 }finally{global.document=oldDoc;}
});
