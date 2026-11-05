/* Forest Horror: cobertura fusionada sin radios individuales.
 * Ejecutar node juego/assets/fh-light-coverage.test.js
 */
const assert=require('node:assert/strict');
const C=require('./fh-light-coverage.js');
const grid={columns:12,rows:12,feetPerCell:5};
const lamp=(id,x,y,settings={})=>({id,type:'light_fixture',x,y,lightKind:'bulb',lightRadiusFt:30,...settings});
const wall=(type,x1,y1,x2,y2)=>({type,a:{x:x1,y:y1},b:{x:x2,y:y2}});
let passed=0;
function test(label,fn){fn();passed++;console.log('PASS '+label)}
const get=items=>C.compute({items},grid);

test('Habitación sin focos: sin iluminación automática',()=>{
 assert.equal(get([wall('wall',6,0,6,12)]).mask.every(v=>v===0),true);
});
test('Muro azul corta la luz aunque el radio alcance detrás',()=>{
 const data=get([lamp('a',3,5),wall('wall',6,0,6,12)]);
 assert.equal(data.sample(4,5),true);assert.equal(data.sample(8,5),false);
});
test('Muro rojo también detiene luz',()=>{
 assert.equal(get([lamp('a',3,5),wall('red_wall',6,0,6,12)]).sample(8,5),false);
});
test('Dos focos unidos sin doble iluminación',()=>{
 const x=get([lamp('a',3,5)]),y=get([lamp('a',3,5),lamp('b',3,5)]);
 assert.deepEqual(y.mask,x.mask);
});
test('Dos focos a lados de un muro: dos espacios iluminados, sin atravesarlo',()=>{
 const data=get([lamp('a',3,5),lamp('b',9,5),wall('red_wall',6,0,6,12)]);
 assert.equal(data.sample(3,5),true);assert.equal(data.sample(9,5),true);
 assert.equal(data.sample(3,9),true);
});
test('Muro parcial deja un hueco real por donde entra luz',()=>{
 const data=get([lamp('a',3,5),wall('wall',6,0,6,4)]);
 assert.equal(data.sample(8,5),true);
});
test('Puerta cerrada es opaca, abierta deja pasar luz',()=>{
 const closed=[wall('wall',6,0,6,4),wall('wall',6,6,6,12),
 {type:'door',a:{x:6,y:4},b:{x:6,y:6},open:false}];
 const opened=closed.map(it=>it.type==='door'?{...it,open:true}:it);
 assert.equal(get([lamp('a',3,5),...closed]).sample(8,5),false);
 assert.equal(get([lamp('a',3,5),...opened]).sample(8,5),true);
});
test('Ventana no bloquea el cálculo de iluminación',()=>{
 const v={type:'window',a:{x:6,y:0},b:{x:6,y:12}};
 assert.equal(get([lamp('a',3,5),v]).sample(8,5),true);
});
test('El cono de un aplique no ilumina detrás de sí',()=>{
 const light=lamp('a',3,3,{lightKind:'wall_sconce',beamAngleDeg:90,rotation:0});
 const data=get([light]);
 assert.equal(data.sample(3,5),true);assert.equal(data.sample(3,1),false);
});
test('Porcentaje del cuarto detecta sectores oscuros',()=>{
 const data=get([lamp('a',3,5),wall('wall',6,0,6,12)]);
 const all=data.roomCoverage({x:0,y:0,w:12,h:12});
 const dark=data.roomCoverage({x:7,y:1,w:4,h:9});
 assert.ok(all.percent>0&&all.percent<100,all.percent);
 assert.equal(dark.percent,0);
});
test('Módulo no cambia el JSON original',()=>{
 const floor={items:[lamp('a',3,5),wall('wall',6,0,6,12)]};
 const orig=JSON.stringify(floor);get(floor.items);assert.equal(JSON.stringify(floor),orig);
});
test('Mapas grandes usan resolución limitada',()=>{
 assert.equal(C.resolution(500,500),1);
});
console.log(passed+' pruebas correctas');
