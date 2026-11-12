/* HUD flotante por selección o cambio de recursos; aviso de miedo en la escena. */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHMoodFearUI=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
 'use strict';
 const words=()=>root.FH_MOOD_FEAR_TEXT||{keys:{},reasons:{}};
 const RESOURCE_KEYS=Object.freeze(['pg','sp','pe']);
 const AUTO_DURATION_MS=2800;
 let selectedId=null,observedId=null,observedResources=null,autoVisibleUntil=0;
 // Los cambios reales activan la placa: no la primera lectura ni la carga de otro actor.
 function watchResources(character){
  const id=character?.id==null?null:String(character.id);
  if(id===null||!character?.resources){
   observedId=null;observedResources=null;autoVisibleUntil=0;return null;
  }
  const next={};
  for(const key of RESOURCE_KEYS){
   const value=character.resources[key],maximum=character.resources[key+'Max'];
   next[key]=Number.isFinite(value)&&Number.isFinite(maximum)&&maximum>0
    ?Math.max(0,Math.min(value,maximum)):null;
   next[key+'Max']=maximum;
  }
  let before=null;
  if(observedId===id&&observedResources){
   const changed=RESOURCE_KEYS.some(key=>next[key]!==null&&observedResources[key]!==null&&
    next[key]!==observedResources[key]);
   if(changed){before=observedResources;autoVisibleUntil=Date.now()+AUTO_DURATION_MS;}
  }else autoVisibleUntil=0;
  observedId=id;observedResources=next;
  return before;
 }
 let clickTarget=null,clickHandler=null,currentLocator=null,dismissHandlersBound=false;
 function setup(){return Boolean(root.FHNameplateHUD?.mount?.());}
 function hide(){root.FHNameplateHUD?.hide?.();}
 function select(id){
  selectedId=id==null?null:String(id);
  if(selectedId===null)hide();
  return selectedId;
 }
 function selected(){return selectedId;}
 function project(THREE,camera,renderer,world){
  if(!THREE?.Vector3||!camera||!world||!renderer?.domElement)return null;
  const v=new THREE.Vector3(world.x,world.y,world.z).project(camera);
  if(!Number.isFinite(v.x)||!Number.isFinite(v.y)||v.z<-1||v.z>1||Math.abs(v.x)>1.1||Math.abs(v.y)>1.1)return null;
  const box=renderer.domElement.getBoundingClientRect();
  return {x:box.left+(v.x+1)*box.width/2,y:box.top+(1-v.y)*box.height/2};
 }
 function distanceToActor(px,py,at){
  const x=Number.isFinite(at?.bodyX)?at.bodyX:at.x;
  const y=Number.isFinite(at?.bodyY)?at.bodyY:at.y+48;
  const dx=x-at.x,dy=y-at.y;
  const ratio=dx*dx+dy*dy;
  const t=ratio>0?Math.max(0,Math.min(1,((px-at.x)*dx+(py-at.y)*dy)/ratio)):0;
  return Math.hypot(px-at.x-t*dx,py-at.y-t*dy);
 }
 function bind(canvas,locator){
  if(!canvas||typeof locator!=='function')return;
  currentLocator=locator;
  if(clickTarget===canvas)return;
  if(clickTarget&&clickHandler)clickTarget.removeEventListener('click',clickHandler,true);
  clickTarget=canvas;
  clickHandler=event=>{
   if(event.button!==0)return;
   const at=currentLocator?.();
   if(!at){select(null);return;}
   const height=Math.abs((Number.isFinite(at.bodyY)?at.bodyY:at.y+48)-at.y);
   const radius=Math.min(36,Math.max(18,height*.27));
   if(distanceToActor(event.clientX,event.clientY,at)<=radius){
    select(selectedId===String(at.id)?null:at.id);
    event.preventDefault();
    event.stopImmediatePropagation();
   }else select(null);
  };
  canvas.addEventListener('click',clickHandler,true);
  if(!dismissHandlersBound&&typeof root.addEventListener==='function'){
   dismissHandlersBound=true;
   root.addEventListener('keydown',event=>{if(event.key==='Escape'&&selectedId!==null)select(null);});
   root.document?.addEventListener?.('pointerdown',event=>{
    if(selectedId===null)return;
    if(event.target===clickTarget||clickTarget?.contains?.(event.target)||
       root.document?.getElementById?.('fhNameplateHUD')?.contains?.(event.target))return;
    select(null);
   },true);
  }
 }
 function render(character,position){
  const before=watchResources(character);
  const id=character?.id!=null?String(character.id):'';
  // Daño, PS perdida y recuperación prevalecen aun sin selección manual.
  if(!character||!position||!id||(selectedId!==id&&Date.now()>=autoVisibleUntil)){
   hide();return false;
  }
  return root.FHNameplateHUD?.update?.(character,position,before)??false;
 }
 function fearChange(payload,position){
  if(!payload||!position||!root.FHLiveText?.soundAt)return false;
  const dict=words();
  const title=dict.keys?.[payload.key];
  if(!title)return false;
  // Se dibuja sobre la escena mediante el mismo sistema espacial que ZZZ y abrir puertas.
  root.FHLiveText.clearKind?.('fear');
  return root.FHLiveText.soundAt({
   kind:'fear',fearLevel:payload.key,text:title,
   x:position.x,y:position.y,z:position.z,floor:position.floor,
   level:1,self:true
  });
 }
 return Object.freeze({setup,select,selected,render,bind,project,fearChange,hide});
});
