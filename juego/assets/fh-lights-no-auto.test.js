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
 assert.equal(Number(resolved[0].brightRadius.toFixed(4)),Number((16*.3048).toFixed(4)));
 assert.equal(Number(resolved[0].dimRadius.toFixed(4)),Number((16*1.4*.3048).toFixed(4)));
});

test('La luz cae de brillante a tenue sin un corte duro',()=>{
 const source={x:0,z:0,radius:2,brightRadius:2,dimRadius:4,angleDeg:360};
 const clear=()=>true;
 assert.equal(L.sourceStrength(source,1,0,[],clear),1);
 assert.equal(L.sourceStrength(source,2,0,[],clear),1);
 assert.equal(Number(L.sourceStrength(source,3,0,[],clear).toFixed(2)),.5);
 assert.equal(L.sourceStrength(source,4,0,[],clear),0);
 assert.equal(L.sourceStrength(source,4.1,0,[],clear),0);
});

test('5 pies brillantes + 5 tenues terminan en oscuridad a los 10 pies',()=>{
 const f=floor(false);
 f.items.push({id:'manual55',type:'light_fixture',roomId:'r',lightKind:'bulb',x:3,y:4,lightRadiusFt:5,lightDimFalloffFt:5});
 const source=runtime(f)[0];
 assert.equal(Number(source.brightRadius.toFixed(4)),Number((5*.3048).toFixed(4)));
 assert.equal(Number(source.dimRadius.toFixed(4)),Number((10*.3048).toFixed(4)));
});
test('Campo legado lightDimRadiusFt conserva su significado de radio exterior',()=>{
 const f=floor(false);
 f.items.push({id:'legacy',type:'light_fixture',roomId:'r',lightKind:'bulb',x:3,y:4,lightRadiusFt:10,lightDimRadiusFt:14});
 const source=runtime(f)[0];
 assert.equal(Number(source.brightRadius.toFixed(4)),Number((10*.3048).toFixed(4)));
 assert.equal(Number(source.dimRadius.toFixed(4)),Number((14*.3048).toFixed(4)));
});
test('Los focos nuevos guardan una franja tenue explícita',()=>{
 const fields=L.presetFields('bulb');
 assert.equal(fields.lightRadiusFt,16);
 assert.equal(fields.lightDimFalloffFt,6.4);
 assert.equal(Object.hasOwn(fields,'lightDimRadiusFt'),false);
});
test('Se admite una luminaria de 120 pies brillantes + 120 tenues',()=>{
 const f=floor(false);
 f.items.push({id:'long',type:'light_fixture',roomId:'r',lightKind:'bulb',x:3,y:4,lightRadiusFt:120,lightDimFalloffFt:120});
 const source=runtime(f)[0];
 assert.equal(Number(source.brightRadius.toFixed(4)),Number((120*.3048).toFixed(4)));
 assert.equal(Number(source.dimRadius.toFixed(4)),Number((240*.3048).toFixed(4)));
});
test('Un mapa legado sin campo nuevo conserva el tope anterior de 80 pies',()=>{
 const f=floor(false);
 f.items.push({id:'legacyLong',type:'light_fixture',roomId:'r',lightKind:'bulb',x:3,y:4,lightRadiusFt:120});
 const source=runtime(f)[0];
 assert.equal(Number(source.brightRadius.toFixed(4)),Number((80*.3048).toFixed(4)));
 assert.equal(Number(source.dimRadius.toFixed(4)),Number((112*.3048).toFixed(4)));
});

test('El radio tenue mantiene una fuente candidata aunque el radio brillante ya no alcance',()=>{
 const entry={floor:0,x:0,z:0,radius:2,brightRadius:2,dimRadius:4,angleDeg:360};
 const lighting={fixtureLit:()=>true};
 assert.equal(L.sourcesNear([entry],lighting,0,5.5,0,2).length,1);
 assert.equal(L.sourcesNear([entry],lighting,0,6.1,0,2).length,0);
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
