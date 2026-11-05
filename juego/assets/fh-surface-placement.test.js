/* Ejecutar: node juego/assets/fh-surface-placement.test.js */
const assert=require('node:assert/strict');
const S=require('./fh-surface-placement.js');
const provider=(item)=>item.supportSurfaces||[];
const table=(overrides={})=>({id:'table',x:10,y:10,w:1,h:1,rotation:0,heightFt:2.5,supportSurfaces:[{id:'top',widthFt:5,depthFt:5,heightFt:2.5}],...overrides});
const phone=(overrides={})=>({id:'phone',x:10,y:10,w:.3,h:.25,rotation:0,placement:'surface',...overrides});
let checks=0;const test=(desc,fn)=>{fn();checks++;console.log('OK',desc)};

test('Coloca un objeto surface sobre la mesa y guarda la relación',()=>{
 const host=table(),item=phone();const result=S.place(item,[host],5,provider);
 assert.equal(result.ok,true);assert.equal(result.supported,true);
 assert.deepEqual(item.support,{parentItemId:'table',surfaceId:'top',offsetXFt:0,offsetZFt:0,rotationOffsetDeg:0});
 assert.equal(S.worldPose([host,item],item,5,provider).heightFt,2.5);
});

test('Un objeto surface no cae al piso cuando no hay soporte',()=>{
 const item=phone({x:2,y:2});const result=S.place(item,[],5,provider);
 assert.equal(result.ok,false);assert.equal(result.reason,'surface-required');assert.equal(item.support,undefined);
});

test('floor_or_surface usa piso cuando no encuentra superficie',()=>{
 const tv=phone({id:'tv',placement:'floor_or_surface',w:.6,h:.5,x:2,y:2,support:{parentItemId:'missing',surfaceId:'top',offsetXFt:0,offsetZFt:0}});
 const result=S.place(tv,[],5,provider);assert.equal(result.ok,true);assert.equal(result.supported,false);assert.equal(tv.support,undefined);
});

test('Respeta el footprint y el overhang permitido',()=>{
 const host=table({supportSurfaces:[{id:'top',widthFt:2.75,depthFt:2.75,heightFt:2.5}]});
 const tv=phone({id:'tv',placement:'floor_or_surface',w:.6,h:.5,surfaceOverhangFt:.25});
 assert.equal(S.place(tv,[host],5,provider).supported,true);
 const tooBig=phone({id:'wide',w:.8,h:.8});assert.equal(S.place(tooBig,[host],5,provider).ok,false);
});

test('La rotación del mueble padre mueve al hijo con el mismo offset local',()=>{
 const host=table(),item=phone({x:10.3,y:10});S.place(item,[host],5,provider);
 assert.equal(item.support.offsetXFt,1.5);assert.equal(item.support.offsetZFt,0);
 host.rotation=90;S.syncChildren([host,item],host.id,5,provider);
 assert.ok(Math.abs(item.x-10)<1e-9);assert.ok(Math.abs(item.y-10.3)<1e-9);assert.equal(item.rotation,90);
});

test('El encaje funciona con superficies rotadas',()=>{
 const host=table({rotation:90,supportSurfaces:[{id:'top',widthFt:4,depthFt:2,heightFt:2.5}]});
 const item=phone({w:.6,h:.3,rotation:90,x:10,y:10});
 assert.equal(S.place(item,[host],5,provider).ok,true);
});

test('Una relación rota vuelve a la posición absoluta sin elevar el objeto',()=>{
 const item=phone({x:7,y:8,support:{parentItemId:'missing',surfaceId:'top',offsetXFt:0,offsetZFt:0}});
 assert.deepEqual(S.worldPose([item],item,5,provider),{x:7,y:8,heightFt:0,rotation:0,supported:false,parent:null,surface:null});
});

test('La altura se acumula si un soporte está sobre otro soporte',()=>{
 const base=table({id:'base',heightFt:2,supportSurfaces:[{id:'top',widthFt:5,depthFt:5,heightFt:2}]});
 const upper=table({id:'upper',heightFt:1,support:{parentItemId:'base',surfaceId:'top',offsetXFt:0,offsetZFt:0},supportSurfaces:[{id:'top',widthFt:4,depthFt:4,heightFt:1}]});
 const item=phone({support:{parentItemId:'upper',surfaceId:'top',offsetXFt:0,offsetZFt:0}});
 const pose=S.worldPose([base,upper,item],item,5,provider);assert.equal(pose.heightFt,3);
});
test('Un prop pequeño llega al borde del tablero sin salirse ni volver al centro',()=>{
 const host=table({supportSurfaces:[{id:'top',widthFt:4,depthFt:2,heightFt:2.5}]});
 const item=phone({w:.3,h:.1,x:10.39,y:10.18});
 const result=S.place(item,[host],5,provider);
 assert.equal(result.supported,true);
 assert.ok(Math.abs(item.x-10.25)<1e-9);
 assert.ok(Math.abs(item.y-10.15)<1e-9);
 assert.ok(Math.abs(item.support.offsetXFt-1.25)<1e-9);
});
test('No se permite un prop físicamente mayor que el tablero',()=>{
 const host=table({supportSurfaces:[{id:'top',widthFt:1,depthFt:1,heightFt:2.5}]});
 const item=phone({w:.6,h:.6});
 assert.equal(S.place(item,[host],5,provider).ok,false);
});
console.log(checks+' pruebas correctas');
