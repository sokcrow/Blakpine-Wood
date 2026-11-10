/* Configuración por planta de origen; record() conserva undo y guardado. */
(function(root){
 'use strict';
 function open(){
  const T=root.FH_ROOF_TEXT;
  if(root.FHStyleEditor?.hasActor())return toast(T.denied);
  const f=current(),config=root.FHRoof.settings(f.roof);
  const h=escapeAttr;
  const options=(list,value)=>list.map(([id,label])=>`<option value="${h(id)}"${id===value?' selected':''}>${h(label)}</option>`).join('');
  const finish=(kind,list)=>`<fieldset><legend>${h(T[kind])}</legend><label>${h(T.material)}<select id="roof-${kind}-preset">${options(list,config[kind].preset)}</select></label><label>${h(T.color)}<input id="roof-${kind}-color" type="color" value="${h(config[kind].color)}"></label><canvas id="roof-${kind}-preview" width="192" height="64" style="width:100%;height:64px;image-rendering:pixelated"></canvas></fieldset>`;
  modal(`<h2>${h(T.title)} · ${h(f.name)}</h2><p>${h(T.help)}</p>${f.roof?'':`<p>${h(T.legacy)}</p>`}<label><input type="checkbox" id="roof-enabled"${f.roof&&config.enabled?' checked':''}> ${h(T.enabled)}</label><label>${h(T.height)}<input id="roof-height" type="number" min="0" max="2" step="0.05" value="${config.parapetHeightTiles}"></label><p>${h(T.defaultHint)}</p>${finish('floor',root.FH_STYLE_TEXT.floorPresets)}${finish('wall',root.FH_STYLE_TEXT.wallPresets)}<div class="actions"><button id="roof-save" class="primary">${h(T.save)}</button><button id="roof-close">${h(T.close)}</button></div>`,()=>{
   const $=id=>document.getElementById(id);
   const value=kind=>({preset:$(`roof-${kind}-preset`).value,color:$(`roof-${kind}-color`).value,pattern:config[kind].pattern});
   for(const kind of ['floor','wall']){
    const refresh=()=>root.FHStyleRuntime.preview($(`roof-${kind}-preview`),value(kind),project);
    for(const prop of ['preset','color'])$(`roof-${kind}-${prop}`).oninput=refresh;
    refresh();
   }
   $('roof-close').onclick=closeModal;
   $('roof-save').onclick=()=>{
    if(root.FHStyleEditor?.hasActor())return toast(T.denied);
    const raw=$('roof-height').value,height=Number(raw);
    if(raw===''||!Number.isFinite(height)||height<0||height>2)return toast(T.invalid);
    f.roof=root.FHRoof.settings({enabled:$('roof-enabled').checked,parapetHeightTiles:height,floor:value('floor'),wall:value('wall')});
    record();closeModal();toast(T.saved);
   };
  });
 }
 root.FHRoofEditor=Object.freeze({open});
})(typeof window!=='undefined'?window:globalThis);
