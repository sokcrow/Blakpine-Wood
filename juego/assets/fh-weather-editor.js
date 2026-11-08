/* Blakpine Wood — editor: solo configura los datos, sin simular meteorología. */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(root)root.FHWeatherEditor=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const defaults=()=>({enabled:true,season:'calendar',minHours:3,maxHours:8,clockSpeed:1});
 function install({project,record,modal,closeModal,toast}={}){
  const bar=root.document?.getElementById('subbar');
  if(!bar||root.document.getElementById('fhWeatherSettings'))return;
  const T=root.FH_WEATHER_TEXT||{};
  const button=root.document.createElement('button');
  button.id='fhWeatherSettings';button.textContent='☁ '+(T.button||'Clima');
  button.setAttribute('aria-label',T.title||'Clima y estaciones');
  bar.append(button);
  button.addEventListener('click',()=>{
   const p=project(),v={...defaults(),...(p.weather||{enabled:false})};
   const seasons=['calendar','primavera','verano','otono','invierno'];
   const names=[T.calendar,T.primavera,T.verano,T.otono,T.invierno];
   const options=seasons.map((s,i)=>'<option value="'+s+'"'+(v.season===s?' selected':'')+'>'+names[i]+'</option>').join('');
   modal('<h2>'+T.title+'</h2><p>'+T.disclaimer+'</p>'+
    '<label><input id="fhWeatherEnabled" type="checkbox"'+(v.enabled?' checked':'')+'> '+T.enabled+'</label>'+
    '<label>'+T.season+'<select id="fhWeatherSeason">'+options+'</select></label>'+
    '<label>'+T.minHours+'<input id="fhWeatherMin" type="number" min="1" max="24" value="'+v.minHours+'"></label>'+
    '<label>'+T.maxHours+'<input id="fhWeatherMax" type="number" min="1" max="36" value="'+v.maxHours+'"></label>'+
    '<label>'+T.clockSpeed+'<input id="fhWeatherSpeed" type="number" min=".1" max="20" step=".1" value="'+v.clockSpeed+'"></label>'+
    '<div class="actions"><button id="fhWeatherSave" class="primary">'+T.save+'</button>'+
    '<button id="fhWeatherCancel">'+T.cancel+'</button></div>',()=>{
    const get=id=>root.document.getElementById(id);
    get('fhWeatherCancel').onclick=closeModal;
    get('fhWeatherSave').onclick=()=>{
     const min=Math.max(1,Math.min(24,Number(get('fhWeatherMin').value)||3));
     const max=Math.max(min,Math.min(36,Number(get('fhWeatherMax').value)||8));
     const speed=Math.max(.1,Math.min(20,Number(get('fhWeatherSpeed').value)||1));
     const season=get('fhWeatherSeason').value;
     p.weather={enabled:get('fhWeatherEnabled').checked,
      season:seasons.includes(season)?season:'calendar',
      minHours:min,maxHours:max,clockSpeed:speed};
     record();closeModal();toast?.(T.saved);
    };
   });
  });
 }
 return Object.freeze({install,defaults});
});