const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('./fh-drainage.js');
const Draw=require('./fh-drainage-draw.js');
const units={columns:120,rows:120,feetPerCell:5};
const map=items=>({schema:'forest-horror-map-v1',units,floors:[{id:'f0',items}]});
const section=(kind,x,y,id,rotation=0)=>D.makeSection(kind,{x:x+D.SIZES[kind]/2,y:y+D.SIZES[kind]/2},units,id,rotation);
let n=0;
const id=()=>String(++n);
const path=(items,x1,y1,x2,y2,kind='main')=>Draw.applyPath(items,{x:x1,y:y1},{x:x2,y:y2},kind,units,id);
const at=(items,x,y)=>items.find(it=>it.x===x&&it.y===y);

test('las rectas 10×10 conectan sin huecos y respetan los extremos',()=>{
 const r=path([],5,5,35,5);
 assert.deepEqual(r.items.map(it=>[it.x,it.drainage.kind,it.rotation]),[
  [0,'dead_end',0],[10,'straight',0],[20,'straight',0],[30,'dead_end',180]]);
 assert.equal(r.added.length,4);
 assert.equal(r.items.every(Draw.isAuto),true);
 assert.equal(D.topology(map(r.items)).warnings.length,0);
 assert.equal(D.validateProject(map(r.items)),true);
});

test('el trazado 4×4 conserva el tipo histórico small y las reglas de lluvia',()=>{
 const items=path([],1,1,13,1,'small').items;
 assert.deepEqual(items.map(it=>it.drainage.kind),['small_dead_end','small','small','small_dead_end']);
 assert.equal(items.every(it=>it.w===4&&it.h===4),true);
 assert.equal(D.topology(map(items)).warnings.length,0);
 assert.equal(D.weatherState(items[1],.58).walkingFactor,.5);
});

test('una curva se genera al extender perpendicularmente un extremo',()=>{
 const items=path(path([],5,15,25,15).items,25,15,25,35).items;
 assert.deepEqual([at(items,20,10).drainage.kind,at(items,20,10).rotation],['elbow',180]);
 assert.equal(D.topology(map(items)).warnings.length,0);
});

test('las intersecciones producen T o cruz según sus cuatro vecinos',()=>{
 const horizontal=path([],5,25,45,25).items;
 const tee=path(horizontal,25,25,25,45).items;
 assert.equal(at(tee,20,20).drainage.kind,'tee');
 assert.equal(D.ports(at(tee,20,20)).length,3);
 const cross=path(horizontal,25,5,25,45).items;
 assert.deepEqual([at(cross,20,20).drainage.kind,at(cross,20,20).rotation],['cross',0]);
 assert.equal(D.topology(map(cross)).warnings.length,0);
});

test('borrar una pieza recalcula los extremos sin mutar el estado anterior',()=>{
 const old=path([],5,5,35,5).items,copy=JSON.stringify(old);
 const deleted=at(old,20,0);
 const updated=Draw.rebuild(old.filter(it=>it!==deleted));
 assert.equal(JSON.stringify(old),copy);
 assert.deepEqual([at(updated.items,10,0).drainage.kind,at(updated.items,10,0).rotation],['dead_end',180]);
 assert.equal(updated.items.some(it=>it.id===deleted.id),false);
});

test('premades manuales, muebles e IDs originales se conservan',()=>{
 const manual=section('straight',40,0,'manual'),chair={id:'chair',type:'chair',x:80,y:80};
 const before=JSON.stringify(manual);
 const result=path([manual,chair],5,5,35,5).items;
 assert.equal(JSON.stringify(manual),before);
 assert.equal(result.find(it=>it.id==='manual'),manual);
 assert.equal(result.find(it=>it.id==='chair'),chair);
 assert.deepEqual(D.ports(at(result,30,0)),['e','w']);
 assert.equal(D.topology(map(result)).warnings.length,0);
});

test('los canales 10×10 y los conductos manuales 4×4 se enlazan si hay puerto',()=>{
 const small=section('small',10,3,'s');
 const items=path([small],5,5,5,5).items;
 assert.equal(D.touches(at(items,0,0),small),true);
 assert.equal(D.topology(map(items)).warnings.length,0);
});

test('una pieza manual rotada nunca se reescribe para forzar la conexión',()=>{
 const small=section('small',10,3,'s',90),initial=JSON.stringify(small);
 const items=path([small],5,5,5,5).items;
 assert.equal(JSON.stringify(small),initial);
 assert.equal(D.touches(at(items,0,0),small),false);
});

test('rechaza superposición con piezas manuales sin alterar el mapa',()=>{
 const original=[section('straight',10,0,'old')],copy=JSON.stringify(original);
 assert.throws(()=>path(original,5,5,25,5),/superpone/);
 assert.equal(JSON.stringify(original),copy);
});

test('mapas de dimensiones irregulares rechazan una última pieza incompleta',()=>{
 const original=[{id:'chair',type:'chair'}],copy=JSON.stringify(original);
 const smaller={columns:115,rows:115,feetPerCell:5};
 assert.throws(()=>Draw.applyPath(original,{x:114,y:5},{x:114,y:5},'main',smaller,id),/no cabe/);
 assert.equal(JSON.stringify(original),copy);
});

test('repetir el mismo trazado no duplica piezas ni altera IDs',()=>{
 const original=path([],5,5,35,5).items,ids=original.map(it=>it.id);
 const result=path(original,5,5,35,5);
 assert.deepEqual(result.items.map(it=>it.id),ids);
 assert.equal(result.added.length,0);
 assert.equal(result.updated.length,0);
});

test('el recálculo limpia solo destinos flowTo inválidos automáticos',()=>{
 const items=path([],5,5,25,5).items;
 at(items,10,0).drainage.flowTo=at(items,20,0).id;
 const legacy=section('straight',40,0,'old');legacy.drainage.flowTo='otro';
 const result=Draw.rebuild(items.filter(it=>it.x!==20).concat(legacy));
 assert.equal(at(result.items,10,0).drainage.flowTo,null);
 assert.equal(legacy.drainage.flowTo,'otro');
});

test('el JSON sigue siendo v1 y la expansión no genera muros nuevos',()=>{
 const data=map(path([],5,5,35,5).items),original=JSON.stringify(data);
 const expanded=D.expandProject(JSON.parse(original));
 assert.equal(data.schema,'forest-horror-map-v1');
 assert.equal(JSON.stringify(data),original);
 assert.equal(expanded.floors[0].items.filter(it=>it.drainageGenerated).length,4);
 assert.equal(expanded.floors[0].items.filter(it=>it.drainageGenerated&&['wall','opening'].includes(it.type)).length,0);
});