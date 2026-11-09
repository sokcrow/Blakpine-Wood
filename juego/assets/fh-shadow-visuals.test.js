'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const shadow=require('./fh-shadow-visuals.js');

function scene({fail=false}={}){
 const events={loads:[],registered:[],unregistered:[],dirty:0,disposed:0};
 const stories=Array.from({length:2},()=>({
  children:[],
  add(actor){actor.parent?.remove(actor);this.children.push(actor);actor.parent=this},
  remove(actor){const i=this.children.indexOf(actor);if(i>=0)this.children.splice(i,1);actor.parent=null}
 }));
 const THREE={
  NearestFilter:'nearest',sRGBEncoding:'srgb',
  SpriteMaterial:class{
   constructor(opts){Object.assign(this,opts)}
   dispose(){events.disposed++}
  },
  Sprite:class{
   constructor(material){
    this.material=material;this.isObject3D=true;this.userData={};
    this.position={x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z})}};
    this.scale={x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z})}};
   }
  },
  TextureLoader:class{
   load(url,onLoad,_progress,onError){
    events.loads.push(url);
    const texture={image:{width:64,height:128},dispose(){events.disposed++}};
    queueMicrotask(()=>fail?onError(Error('imagen ausente')):onLoad());
    return texture;
   }
  }
 };
 const manager=shadow.createManager({
  THREE,stories,floorElev:[0,3],baseUrl:'https://ejemplo.test/juego/assets/enemigos/Sombras/',
  registerVisibility(sprite,getFloor){
   events.registered.push(sprite);sprite.visible=false;sprite.getFloor=getFloor;return true;
  },
  unregisterVisibility(sprite){events.unregistered.push(sprite)},
  invalidate(){events.dirty++}
 });
 return {manager,stories,events};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('los recursos corresponden a los PNG originales sin inventar otras poses',()=>{
 assert.equal(shadow.CATALOG.el_alto.pg,15);
 assert.equal(shadow.CATALOG.la_nina.pg,5);
 const {manager}=scene();
 assert.equal(manager.spriteUrl('el_alto'),'https://ejemplo.test/juego/assets/enemigos/Sombras/el_alto/idle.png');
 assert.equal(manager.spriteUrl('la_nina'),'https://ejemplo.test/juego/assets/enemigos/Sombras/la_nina/idle.png');
 assert.equal(manager.spriteUrl('desconocido'),null);
});
test('crea sprites 2.5D y conserva el registro compartido de visibilidad',async()=>{
 const {manager,stories,events}=scene();
 const id=manager.spawn('el_alto',0,2,5);
 assert.ok(id);
 assert.equal(stories[0].children.length,1);
 const sprite=stories[0].children[0];
 assert.equal(sprite.userData.fhShadowType,'el_alto');
 assert.equal(sprite.material.opacity,0);
 assert.equal(sprite.getFloor(),0);
 await flush();
 assert.equal(sprite.material.opacity,1);
 assert.equal(sprite.material.map.magFilter,'nearest');
 assert.equal(sprite.scale.y,2.7);
 assert.equal(sprite.scale.x,1.35);
 assert.equal(events.registered.length,1);
 assert.equal(manager.size,1);
 assert.equal(events.loads.length,1);
});
test('movimiento y cambio de piso no crean navegación ni modifican colisiones',async()=>{
 const {manager,stories,events}=scene();
 const id=manager.spawn('la_nina',0,1,2);
 assert.ok(manager.move(id,1,7,8));
 assert.equal(stories[0].children.length,0);
 assert.equal(stories[1].children.length,1);
 assert.equal(stories[1].children[0].getFloor(),1);
 assert.equal(manager.get(id).floor,1);
 assert.equal(stories[1].children[0].position.y,3+1.25/2);
 assert.equal(manager.move(id,3,2,3),false);
 assert.equal(manager.despawn(id),true);
 assert.equal(manager.size,0);
 assert.equal(events.unregistered.length,1);
 assert.equal(stories[1].children.length,0);
 await flush();
});
test('los PNG ausentes no se sustituyen por siluetas falsas',async()=>{
 const {manager,stories}=scene({fail:true});
 manager.spawn('la_nina',0,0,0);
 await flush();
 assert.equal(stories[0].children[0].material.opacity,0);
 assert.equal(stories[0].children[0].material.map,undefined);
});
test('valida tipo, coordenadas e identificadores repetidos',()=>{
 const {manager,stories}=scene();
 assert.equal(manager.spawn('fantasma',0,1,1),null);
 assert.equal(manager.spawn('el_alto',8,1,1),null);
 assert.equal(manager.spawn('el_alto',0,Infinity,1),null);
 assert.equal(manager.spawn('el_alto',0,1,1,{id:'entidad-a'}),'entidad-a');
 assert.equal(manager.spawn('la_nina',0,2,2,{id:'entidad-a'}),null);
 assert.equal(stories[0].children.length,1);
 manager.dispose();
 assert.equal(manager.size,0);
});
