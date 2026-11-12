const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const D=require('./fh-drainage.js');
const units={columns:120,rows:120,feetPerCell:5};
const map=(floors)=>({schema:'forest-horror-map-v1',units,floors:floors.map((items,i)=>({id:'f'+i,elevationFt:-i*12,items}))});
const section=(kind,x,y,id,rotation=0)=>D.makeSection(kind,{x:x+D.SIZES[kind]/2,y:y+D.SIZES[kind]/2},units,id,rotation);
test('medidas: 10×10 (3/4/3), 4×4 y 20×20 sin bloquear todo el pasillo',()=>{
 const a=section('straight',0,0,'a'),b=section('small',20,20,'b'),c=section('outfall',40,40,'c');
 assert.deepEqual([a.w,a.h,b.w,b.h,c.w,c.h],[10,10,4,4,20,20]);
 assert.deepEqual(D.rects(a),[{x:0,y:3,w:10,h:4}]);
 assert.deepEqual(D.rects(b),[{x:20,y:21.5,w:4,h:1}]);
 assert.equal(a.blocksMovement,false);
});
test('T y cruz giran sus salidas y la continuidad del agua',()=>{
 const a=section('tee',0,0,'t');
 assert.deepEqual(D.ports(a),['n','e','w']);
 a.rotation=90;
 assert.deepEqual(D.ports(a),['e','s','n']);
 assert.equal(D.rects(section('cross',10,0,'x')).length,2);
});
test('red conecta solo piezas que comparten borde y puerto en el mismo piso',()=>{
 const a=section('straight',0,0,'a'),b=section('straight',10,0,'b');
 const c=section('small',20,3,'c'),d=section('straight',30,0,'d');
 assert.equal(D.touches(a,b),true);
 assert.equal(D.touches(b,c),true);
 assert.equal(D.touches(c,d),false);
 const g=D.topology(map([[a,b,c], [d]]));
 assert.equal(g.links.get('f0:a').length,1);
 assert.equal(g.links.get('f0:c').length,1);
 assert.equal(g.links.get('f1:d').length,0);
});
test('corriente automática va al desagüe conectado y no atraviesa huecos',()=>{
 const a=section('straight',0,0,'a'),b=section('straight',10,0,'b');
 const sink=section('outfall',20,0,'sink'); // gran cámara conectada al borde este del 10×10
 const p=map([[a,b,sink]]);
 assert.deepEqual(D.downstream(p,0,'a'),{floorIndex:0,itemId:'b'});
 b.drainage.flowTo='a';
 assert.deepEqual(D.downstream(p,0,'b'),{floorIndex:0,itemId:'a'});
 b.drainage.flowTo='fantasma';
 assert.equal(D.topology(p).warnings.some(w=>w.code==='flowToInvalid'),true);
 assert.deepEqual(D.downstream(p,0,'b'),{floorIndex:0,itemId:'sink'});
});
test('el remolino elige cualquier drenaje del mapa pero nunca otro tipo de lugar',()=>{
 const sink=section('outfall',0,0,'sink'),far=section('straight',100,100,'lejos');
 const p=map([[sink],[],[far,{id:'obj',type:'bed',x:99,y:99}]]);
 const exit=D.randomExit(p,0,'sink',()=>.9);
 assert.deepEqual(exit,{floorIndex:2,itemId:'lejos',x:101,y:101});
 assert.equal(D.randomExit(map([[sink]]),0,'sink'),null);
});
test('la lluvia inunda el 4×4, aumenta corriente y reduce MOV solo en lo inundado',()=>{
 const small=section('small',0,0,'s'),main=section('straight',10,0,'m');
 assert.deepEqual(D.weatherState(small,0),{flooded:false,waterWidth:1,currentFactor:1,walkingFactor:1});
 assert.deepEqual(D.weatherState(small,.58),{flooded:true,waterWidth:4,currentFactor:1.58,walkingFactor:.5});
 assert.equal(D.weatherState(main,1).walkingFactor,1);
 assert.equal(D.weatherState(main,1).currentFactor,2);
});
test('puentes colocables libres, girables y con límites verificables',()=>{
 const b=D.makeBridge({x:15,y:18},units,'bridge');
 assert.deepEqual([b.w,b.h],[2,6]);assert.equal(D.validate(b,units),true);
 const b2=D.makeBridge({x:15,y:18},units,'bridge2',true);
 assert.deepEqual([b2.w,b2.h],[6,2]);
 assert.throws(()=>D.makeSection('outfall',{x:2,y:2},units,'oops'),/no cabe/);
});
test('un drenaje puede estar en otro nivel: buscar el más cercano físicamente',()=>{
 const p=map([[{id:'out',type:'drain_outlet',x:33,y:30}], [section('straight',30,30,'a')], [section('straight',95,95,'b')]]);
 assert.deepEqual({floorIndex:D.nearest(p,0,{x:33,y:30}).floorIndex,itemId:D.nearest(p,0,{x:33,y:30}).itemId},{floorIndex:1,itemId:'a'});
});
test('validación opcional no cambia mapas v1 antiguos',()=>{
 const old=map([[{id:'legacy',type:'drain_main',x:1,y:2}]]);
 assert.equal(D.validateProject(old),true);
 assert.deepEqual(D.topology(old).nodes,[]);
});
test('editor y motor enlazados desde index.html y contrato v1',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
 for(const marker of ['fh-drainage.js','fh-drainage-editor.js','FHDrainage?.draw2D','FHDrainage?.attachFloor','FHDrainage?.validateProject','FHDrainageEditor?.place'])assert.ok(html.includes(marker),marker);
});
