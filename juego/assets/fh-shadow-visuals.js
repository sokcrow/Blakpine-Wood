/* Blakpine-Wood — presentación de Sombras. La IA y el movimiento siguen en el motor.
 * Usa los mismos THREE.Sprite y registro FOW que los demás actores.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHShadowVisuals=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const CATALOG=Object.freeze({
  el_alto:Object.freeze({name:'El Alto',folder:'el_alto',pg:15,defaultHeight:2.7}),
  la_nina:Object.freeze({name:'La Niña',folder:'la_nina',pg:5,defaultHeight:1.25})
 });
 function createManager({THREE,stories,floorElev,baseUrl,registerVisibility,unregisterVisibility,invalidate}={}){
  if(!THREE||!Array.isArray(stories)||typeof THREE.Sprite!=='function'||
   typeof THREE.SpriteMaterial!=='function'||typeof THREE.TextureLoader!=='function'||
   typeof registerVisibility!=='function'||typeof unregisterVisibility!=='function')
   throw Error('Presentación de Sombras: falta el motor de actores o su registro de visibilidad.');
  const assetRoot=String(baseUrl||'').replace(/\/+$/,'')+'/';
  const loader=new THREE.TextureLoader(),textures=new Map(),actors=new Map();
  let nextId=0;
  function changed(){if(typeof invalidate==='function')invalidate()}
  function spriteUrl(kind){const entry=CATALOG[kind];return entry?assetRoot+entry.folder+'/idle.png':null}
  function textureFor(kind){
   if(textures.has(kind))return textures.get(kind);
   const promise=new Promise(resolve=>{
    let texture=null;
    try{
     texture=loader.load(spriteUrl(kind),()=>{
      texture.encoding=THREE.sRGBEncoding;
      texture.magFilter=texture.minFilter=THREE.NearestFilter;
      resolve(texture);
     },undefined,()=>{texture?.dispose?.();resolve(null)});
    }catch(_error){texture?.dispose?.();resolve(null)}
   });
   textures.set(kind,promise);
   return promise;
  }
  function spawn(kind,floor,x,z,{height,id}={}){
   const type=CATALOG[kind];
   if(!type||!Number.isInteger(floor)||!stories[floor]||!Number.isFinite(x)||!Number.isFinite(z))return null;
   const key=id==null?'sombra-'+(++nextId):String(id);
   if(!key||actors.has(key))return null;
   const h=Number.isFinite(height)&&height>0?height:type.defaultHeight;
   const material=new THREE.SpriteMaterial({transparent:true,depthWrite:false,opacity:0,alphaTest:0.02});
   const sprite=new THREE.Sprite(material);
   sprite.userData.fhShadowType=kind;
   sprite.scale.set(h*.5,h,1);
   sprite.position.set(x,(Number(floorElev?.[floor])||0)+h/2,z);
   stories[floor].add(sprite);
   if(!registerVisibility(sprite,()=>stories.indexOf(sprite.parent))){
    sprite.parent?.remove(sprite);material.dispose?.();return null;
   }
   const actor={key,kind,floor,height:h,sprite,material};
   actors.set(key,actor);
   textureFor(kind).then(texture=>{
    if(actors.get(key)!==actor)return;
    if(!texture){changed();return}
    const ratio=texture.image?.width&&texture.image?.height?
     texture.image.width/texture.image.height:.5;
    sprite.scale.set(h*ratio,h,1);
    material.map=texture;material.opacity=1;material.needsUpdate=true;
    changed();
   });
   changed();return key;
  }
  function move(id,floor,x,z){
   const actor=actors.get(String(id));
   if(!actor||!Number.isInteger(floor)||!stories[floor]||
    !Number.isFinite(x)||!Number.isFinite(z))return false;
   if(actor.floor!==floor){
    stories[floor].add(actor.sprite);
    actor.floor=floor;
   }
   actor.sprite.position.set(x,(Number(floorElev?.[floor])||0)+actor.height/2,z);
   changed();return true;
  }
  function despawn(id){
   const key=String(id),actor=actors.get(key);
   if(!actor)return false;
   actors.delete(key);
   unregisterVisibility(actor.sprite);
   actor.sprite.parent?.remove(actor.sprite);
   actor.material.dispose?.();
   changed();return true;
  }
  function clear(){for(const id of [...actors.keys()])despawn(id)}
  function dispose(){
   clear();
   for(const pending of textures.values())pending.then(texture=>texture?.dispose?.());
   textures.clear();
  }
  function get(id){
   const actor=actors.get(String(id));
   return actor?Object.freeze({id:actor.key,type:actor.kind,floor:actor.floor,x:actor.sprite.position.x,z:actor.sprite.position.z}):null;
  }
  return Object.freeze({spawn,move,despawn,clear,dispose,get,spriteUrl,get size(){return actors.size}});
 }
 return Object.freeze({CATALOG,createManager});
});
