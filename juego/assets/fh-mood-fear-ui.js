/* HUD flotante por selección y aviso de miedo tipo cómic. No modifica la lógica del motor. */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHMoodFearUI=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
 'use strict';
 const moods=['bueno','neutral','malo'];
 const make=(tag,cls,text)=>{const e=root.document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
 const words=()=>root.FH_MOOD_FEAR_TEXT||{keys:{},reasons:{}};
 let panel=null,face=null,name=null,bars=null,selectedId=null;
 let clickTarget=null,clickHandler=null,currentLocator=null;
 function setup(){
  if(!root.document?.body)return false;
  if(panel?.isConnected)return true;
  panel=make('aside','fh-character-floating');panel.hidden=true;
  panel.setAttribute('aria-label','Estado del personaje seleccionado');
  const mood=make('div','fh-character-mood');
  face=make('img','fh-character-mood-icon');
  face.alt='';face.draggable=false;mood.append(face);
  const stats=make('div','fh-character-data');
  name=make('div','fh-character-name');stats.append(name);
  bars={};
  for(const key of ['pg','sp','pe']){
   const line=make('div','fh-character-line');
   const label=make('span','fh-character-stat',key==='sp'?'PS':key.toUpperCase());
   const track=make('div','fh-character-track fh-character-track-'+key);
   const fill=make('span','fh-character-fill fh-character-fill-'+key);
   const count=make('span','fh-character-count');
   track.append(fill);line.append(label,track,count);stats.append(line);
   bars[key]={fill,track,count};
  }
  panel.append(mood,stats);
  root.document.body.append(panel);
  return true;
 }
 function hide(){if(panel)panel.hidden=true;}
 function select(id){selectedId=id==null?null:String(id);if(selectedId===null)hide();return selectedId;}
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
    select(at.id);
    event.preventDefault();
    event.stopImmediatePropagation();
   }else select(null);
  };
  canvas.addEventListener('click',clickHandler,true);
 }
 function render(character,position){
  if(!setup())return false;
  const id=character?.id!=null?String(character.id):'';
  if(!character||!position||!id||selectedId!==id){hide();return false;}
  panel.hidden=false;
  const half=(panel.offsetWidth||310)/2,viewport=root.innerWidth||1280;
  panel.style.left=Math.max(Math.min(half+8,viewport/2),Math.min(Math.max(viewport-half-8,viewport/2),position.x))+'px';
  panel.style.top=Math.max(112,position.y-18)+'px';
  name.textContent=String(character.name||'').slice(0,60);
  const mood=moods.includes(character.mental?.mood)?character.mental.mood:'neutral';
  const art=root.FH_MOOD_FEAR_IMAGES?.[mood]||'';
  face.hidden=!art;
  if(art&&face.src!==art)face.src=art;
  face.alt=(words().mood||'Humor')+': '+(words()[mood==='bueno'?'good':mood==='malo'?'bad':'neutral']||mood);
  for(const key of ['pg','sp','pe']){
   const r=character.resources||{};
   const val=Number.isFinite(r[key])?r[key]:0;
   const max=Number.isFinite(r[key+'Max'])&&r[key+'Max']>0?r[key+'Max']:1;
   bars[key].fill.style.width=Math.max(0,Math.min(100,val/max*100))+'%';
   bars[key].track.setAttribute('role','progressbar');
   bars[key].track.setAttribute('aria-label',key==='pg'?'Puntos de golpe':key==='sp'?'Puntos de sanidad':'Puntos de energía');
   bars[key].track.setAttribute('aria-valuemax',String(max));
   bars[key].track.setAttribute('aria-valuenow',String(val));
   bars[key].count.textContent=Math.max(0,Math.round(val))+'/'+Math.round(max);
  }
  return true;
 }
 function fearChange(payload,position){
  if(!payload||!position||!root.FHLiveText?.soundAt)return false;
  const dict=words();
  const title=dict.keys?.[payload.key];
  if(!title)return false;
  const loss=payload.damage>0?' −'+payload.damage+' PS':'';
  // Se dibuja sobre la escena mediante el mismo sistema espacial que ZZZ y abrir puertas.
  root.FHLiveText.clearKind?.('fear');
  return root.FHLiveText.soundAt({
   kind:'fear',fearLevel:payload.key,text:title+loss,
   x:position.x,y:position.y,z:position.z,floor:position.floor,
   level:1,self:true
  });
 }
 return Object.freeze({setup,select,render,bind,project,fearChange,hide});
});
