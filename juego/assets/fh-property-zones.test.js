/* Pruebas automáticas de parcelas; ejecutar node juego/assets/fh-property-zones.test.js */
const assert=require('node:assert/strict');
const Z=require('./fh-property-zones.js');
const P=require('./fh-style-property.js');
let checks=0;const test=(name,fn)=>{fn();checks++;console.log('PASS '+name)};
const make=()=>({schema:'forest-horror-map-v1',properties:[],floors:[{id:'f1',items:[]}]});
const zone=(m,a={x:1,y:1},b={x:4,y:5},id='parcel_a')=>Z.create(m,'f1',a,b,16,22,id).zone;
test('Parcela sin muro ni colisión',()=>{const m=make(),z=zone(m);m.properties.push(z);assert.equal(m.floors[0].items.length,0);assert.equal(z.polygon.length,4)});
test('No se pierde en reconcileProperties',()=>{const m=make();m.properties.push(zone(m));P.reconcileProperties(m,'f1');assert.equal(m.properties.length,1);assert.equal(m.properties[0].source,'zone')});
test('Rechaza solape',()=>{const m=make();m.properties.push(zone(m));assert.equal(Z.create(m,'f1',{x:2,y:2},{x:5,y:6},16,22,'b').ok,false)});
test('Permite parcela adyacente',()=>{const m=make();m.properties.push(zone(m));assert.equal(Z.create(m,'f1',{x:4,y:1},{x:8,y:5},16,22,'b').ok,true)});
test('Propietario pinta pared existente en lindero',()=>{const m=make(),z=zone(m);z.ownerId='ana';m.properties.push(z);const wall={id:'w',type:'wall',a:{x:1,y:2},b:{x:4,y:2}};m.floors[0].items.push(wall);assert.equal(P.canPaintWall(m,'f1',wall,'A','ana'),true);assert.equal(P.canPaintWall(m,'f1',wall,'B','otro'),false)});
test('No divide muros por la parcela',()=>{const m=make();m.properties.push(zone(m,{x:2,y:1},{x:4,y:5}));m.floors[0].items.push({id:'w',type:'wall',a:{x:0,y:2},b:{x:6,y:2}});assert.equal(P.splitAtPropertyLimits(m,'f1',()=>'new'),0);assert.equal(m.floors[0].items.length,1)});
test('Puerta de parcela detectada por geometría',()=>{const m=make();m.properties.push(zone(m));assert.equal(Z.doorAt(m,'f1',{type:'door',a:{x:1,y:2},b:{x:1,y:3}})?.id,'parcel_a');assert.equal(Z.doorAt(m,'f1',{type:'door',a:{x:7,y:2},b:{x:7,y:3}}),null)});
test('Entrada exterior con mirilla identifica el nombre de parcela, no ID de habitación',()=>{
 const m=make(),p=zone(m);p.name='Apartamento 5 A';m.properties.push(p);
 const door={type:'peephole_door',a:{x:1,y:2},b:{x:1,y:3}};
 assert.equal(P.entrancePropertyAt(m,'f1',door)?.name,'Apartamento 5 A');
 assert.equal(P.entrancePropertyAt(m,'f1',{...door,a:{x:2,y:2},b:{x:2,y:3}}),null,'puerta entre habitaciones no es acceso exterior');
 assert.equal(P.entrancePropertyAt(m,'f1',{...door,a:{x:8,y:2},b:{x:8,y:3}}),null,'puerta fuera de la propiedad no debe asociarse');
});
test('No adjudica una puerta entre dos parcelas vecinas',()=>{
 const m=make(),a=zone(m),b=zone(m,{x:4,y:1},{x:8,y:5},'parcel_b');
 m.properties.push(a,b);
 const door={type:'peephole_door',a:{x:4,y:2},b:{x:4,y:3}};
 assert.equal(P.entrancePropertyAt(m,'f1',door),null);
});
test('Conteo de arquitectura interior',()=>{const m=make(),z=zone(m);m.properties.push(z);m.floors[0].items.push({type:'wall',a:{x:2,y:2},b:{x:3,y:2}},{type:'door',a:{x:1,y:3},b:{x:1,y:4}},{type:'hall',x:1,y:1,w:2,h:1},{type:'chair',x:2,y:2},{type:'chair',x:12,y:12});assert.deepEqual(Z.counts(m.floors[0],z),{walls:1,areas:1,objects:1,doors:1})});
test('Compatibilidad con propiedades heredadas',()=>{const m=make();m.properties.push({id:'old',floorId:'f1',polygon:Z.polygon({x:0,y:0,w:5,h:5}),ownerId:'ana'});assert.equal(P.canEditAt(m,'f1',{x:2,y:2},'ana'),true)});
test('Pintar habitación contenida en parcela',()=>{const m=make(),z=zone(m);z.ownerId='ana';m.properties.push(z);assert.equal(P.canPaintRoom(m,'f1',{type:'room',x:2,y:2,w:1,h:1},'ana'),true)});
console.log(checks+' pruebas correctas');
