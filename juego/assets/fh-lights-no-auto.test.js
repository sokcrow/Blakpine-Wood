/* Forest Horror · Verificación: solo iluminación creada manualmente.
 * Ejecutar: node juego/assets/fh-lights-no-auto.test.js
 */
const assert=require('node:assert/strict');
global.window=global;
require('./fh-lights.js');
const L=global.FHLights;
let passed=0;
function test(label,run){run();passed++;console.log('PASS',label)}
const room=(id='r')=>({id,type:'room',roomId:id,x:1,y:1,w:8,h:7,spans:[{x:1,y:1,w:8,h:7}]});
const floor=(manual=false)=>({lightingManual:manual,items:[room()]});
const runtime=(f,rooms=[f.items[0]])=>L.resolve(0,f,rooms,()=>null,1.524);

test('Mapa antiguo sin luminarias: ninguna luz automática',()=>{
 const f=floor(false);
 assert.deepEqual(runtime(f),[]);
});
test('Mapa nuevo sin luminarias: ninguna luz automática',()=>{
 const f=floor(true);
 assert.deepEqual(runtime(f),[]);
});
test('Habitaciones extensas tampoco generan luces',()=>{
 const f=floor(false);
 f.items[0].spans=[{x:1,y:1,w:30,h:4}];
 assert.equal(runtime(f).length,0);
});
test('materialize conserva intactos los mapas anteriores',()=>{
 const f=floor(false),snapshot=JSON.stringify(f);
 assert.equal(L.materialize(f,()=>{throw Error('Nunca debe generar IDs')}),0);
 assert.equal(JSON.stringify(f),snapshot);
});
test('La antigua recomendación automática está desactivada',()=>{
 assert.deepEqual(L.recommended(room()),[]);
});
test('Lámpara colocada manualmente continúa en el motor',()=>{
 const f=floor(false),lamp={id:'manual1',type:'light_fixture',roomId:'r',lightKind:'bulb',x:3,y:4};
 f.items.push(lamp);
 const resolved=runtime(f);
 assert.equal(resolved.length,1);
 assert.equal(resolved[0].lamp,lamp);
});
test('El circuito sigue decidiendo si la lámpara está encendida',()=>{
 const f=floor(false);
 f.items.push({id:'manual1',type:'light_fixture',roomId:'r',lightKind:'bulb',x:3,y:4});
 const entries=runtime(f),on={fixtureLit:()=>true},off={fixtureLit:()=>false};
 assert.equal(L.sourcesNear(entries,on,0,4.572,6.096,5).length,1);
 assert.equal(L.sourcesNear(entries,off,0,4.572,6.096,5).length,0);
});
test('Fuentes dinámicas independientes siguen disponibles',()=>{
 const id='test_flashlight';
 try{
  assert.equal(L.setDynamicSource(id,{floor:0,x:0,z:0,radius:3}),true);
  assert.equal(L.sourcesNear([],{fixtureLit:()=>false},0,0,0,3).length,1);
 }finally{L.removeDynamicSource(id);}
});
console.log(passed+' pruebas correctas');
