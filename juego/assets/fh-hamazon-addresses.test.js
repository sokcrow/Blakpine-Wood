'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const terminal=fs.readFileSync(path.join(__dirname,'fh-terminal.html'),'utf8');
const property=require('./fh-style-property.js');
function addressResolver(map,doorList,nearest){
 const begin=html.indexOf('function fhDeliveryAddresses(pc,pcFloor){');
 const end=html.indexOf('function fhBeginDoorEvent(door){',begin);
 assert.ok(begin>=0&&end>begin,'el motor declara el catálogo de direcciones');
 const code=html.slice(begin,end);
 const context={
  DATA:map,doorList,
  fhDoorProperty:d=>{
   const floor=map.floors[d.f],source=floor?.items.find(item=>item.id===d.id);
   return source?property.entrancePropertyAt(map,floor.id,source):null;
  },
  fhDeliveryDoor:()=>nearest||null,
  window:{FHStyleProperty:property,FH_DELIVERY_TEXT:{defaultAddress:'Entrada principal'}}
 };
 return vm.runInNewContext(code+'\nfhDeliveryAddresses',context);
}
test('El selector muestra nombres de parcelas y habitaciones de varios pisos y evita IDs técnicos',()=>{
 const door=(id,y=2)=>({id,type:'peephole_door',a:{x:1,y},b:{x:1,y:y+1}});
 const map={properties:[
  {id:'parcel_01',floorId:'f1',source:'zone',name:'Apartamento 5 A',polygon:[{x:1,y:1},{x:5,y:1},{x:5,y:6},{x:1,y:6}]},
  {id:'parcel_02',floorId:'f2',source:'zone',name:'Apartamento 2 B',polygon:[{x:1,y:1},{x:5,y:1},{x:5,y:6},{x:1,y:6}]}
 ],floors:[
  {id:'f1',name:'Planta 1',items:[door('front'),{...door('main',4),propertyDoorRole:'main'},
   {id:'living',type:'room',x:2,y:2,w:2,h:1,label:'Sala',roomId:'sala'},
   {id:'bedroom',type:'room',x:2,y:4,w:1,h:1,label:'Recámara',roomId:'recamara'}]},
  {id:'f2',name:'Planta 2',items:[door('upstairs'),{id:'guest',type:'room',x:2,y:2,w:1,h:1,label:'Sala',roomId:'sala_up'}]}
 ]};
 const doors=[[{id:'front',f:0,kind:'peephole_door',role:'entrance'},{id:'main',f:0,kind:'peephole_door',role:'entrance'}],
  [{id:'upstairs',f:1,kind:'peephole_door',role:'entrance'}]];
 const entries=addressResolver(map,doors)(null,0);
 assert.equal(entries.length,5);
 assert.equal(entries.find(a=>a.id==='property:parcel_01').doorId,'main','entrada principal tiene prioridad');
 const room=entries.find(a=>a.id==='room:f1:living');
 assert.equal(room.label,'Apartamento 5 A · Sala · Planta 1');
 assert.equal(room.propertyName,'Apartamento 5 A');
 assert.equal(room.roomId,'sala');
 assert.equal(room.doorId,'main','la habitación usa la entrada de su parcela');
 assert.equal(entries.find(a=>a.id==='property:parcel_02').floor,1);
 assert.ok(entries.every(a=>!a.label.includes('parcel_')&&!a.label.includes('apto_')));
});
test('El selector no inventa rutas hacia parcelas sin mirilla',()=>{
 const map={properties:[{id:'parcel_without_door',floorId:'f1',source:'zone',name:'Apartamento 7',
  polygon:[{x:1,y:1},{x:5,y:1},{x:5,y:5},{x:1,y:5}]}],
  floors:[{id:'f1',name:'Planta 1',items:[]}]};
 assert.equal(addressResolver(map,[[]],null)(null,0).length,0);
});
test('Hamazon mantiene una interfaz en español para elegir cantidad, dirección y consultar pedidos',()=>{
 assert.match(terminal,/fhHamazonView==='checkout'/);
 assert.match(terminal,/setHamazonAddresses\(items\)/);
 assert.match(terminal,/quantity:draft\.quantity,addressId:draft\.addressId/);
 assert.match(terminal,/fhHamazonView='orders'/);
 for(const match of terminal.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
  if(match[1].trim())assert.doesNotThrow(()=>new vm.Script(match[1]),'script inline válido');
 }
});
