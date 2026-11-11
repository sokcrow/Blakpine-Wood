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
 let panel=null,face=null,name=null,bars=null,notice=null,selectedId=null;
 let clickTarget=null,clickHandler=null,currentLocator=null,noticeTimeout=null;
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
  notice=make('div','fh-fear-pop');notice.hidden=true;
  notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
  root.document.body.append(panel,notice);
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
 function bind(canvas,locator){
  if(!canvas||typeof locator!=='function')return;
  currentLocator=locator;
  if(clickTarget===canvas)return;
  if(clickTarget&&clickHandler)clickTarget.removeEventListener('click',clickHandler,true);
  clickTarget=canvas;
  clickHandler=event=>{
   if(event.button!==0)return;
   const at=currentLocator?.();
   if(at&&Math.hypot(event.clientX-at.x,event.clientY-at.y)<=38)select(at.id);
  };
  canvas.addEventListener('click',clickHandler,true);
 }
 function render(character,position){
  if(!setup())return false;
  const id=character?.id!=null?String(character.id):'';
  if(!character||!position||!id||selectedId!==id){hide();return false;}
  panel.hidden=false;
  panel.style.left=position.x+'px';
  panel.style.top=Math.max(64,position.y-18)+'px';
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
 function fearChange(payload){
  if(!payload||!setup())return;
  if(noticeTimeout)root.clearTimeout?.(noticeTimeout);
  const dict=words();
  notice.className='fh-fear-pop fh-fear-pop--'+payload.key;
  const lost=payload.damage>0?'−'+payload.damage+' PS · '+payload.percent+'%':'0 PS';
  notice.replaceChildren(
   make('strong','fh-fear-pop-name',dict.keys?.[payload.key]||payload.key),
   make('span','fh-fear-pop-loss',lost),
   make('small','fh-fear-pop-reason',dict.reasons?.[payload.reason]||'')
  );
  notice.hidden=false;
  noticeTimeout=root.setTimeout?.(()=>{notice.hidden=true;},2800);
 }
 return Object.freeze({setup,select,render,bind,project,fearChange,hide});
});
