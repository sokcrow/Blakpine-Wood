/* Configuración por planta de origen; record() conserva undo y guardado. */
(function(root){
 'use strict';
 function open(){
  const T=root.FH_ROOF_TEXT;
  if(root.FHStyleEditor?.hasActor())return toast(T.denied);
  const rulesetId=typeof lumenCartridgeMode!=='undefined'&&lumenCartridgeMode?lumenEditorRuleset:root.FHEditorCatalog?.ruleset?.()||'legacy';
  const f=current(),config=root.FHRoof.settings(f.roof,rulesetId);
  const h=escapeAttr;
  const options=(list,value)=>list.map(([id,label])=>`<option value="${h(id)}"${id===value?' selected':''}>${h(label)}</option>`).join('');
  const finish=(kind,list)=>`<fieldset><legend>${h(T[kind])}</legend><label>${h(T.material)}<select id="roof-${kind}-preset">${options(list,config[kind].preset)}</select></label><label>${h(T.color)}<input id="roof-${kind}-color" type="color" value="${h(config[kind].color)}"></label><canvas id="roof-${kind}-preview" width="192" height="64" style="width:100%;height:64px;image-rendering:pixelated"></canvas></fieldset>`;
  modal(`<h2>${h(T.title)} · ${h(f.name)}</h2><p>${h(T.help)}</p>${f.roof?'':`<p>${h(rulesetId==='dnd'?T.dndDefault:T.legacy)}</p>`}<label><input type="checkbox" id="roof-enabled"${config.enabled?' checked':''}> ${h(T.enabled)}</label><label>${h(T.shape)}<select id="roof-shape">${options([['auto',T.auto],['flat',T.flat],['gable',T.gable]],config.shape)}</select></label><label id="roof-height-label">${h(T.height)}<input id="roof-height" type="number" min="0" max="2" step="0.05" value="${config.parapetHeightTiles}"></label><label id="roof-rise-label">${h(T.rise)}<input id="roof-rise" type="number" min="1" max="30" step="0.5" value="${config.riseFt}"></label><label id="roof-axis-label">${h(T.axis)}<select id="roof-ridge">${options([['auto',T.axisAuto],['x',T.axisX],['z',T.axisZ]],config.ridgeAxis)}</select></label><label id="roof-cover-label">${h(T.coverColor)}<input id="roof-coverColor" type="color" value="${h(config.coverColor)}"></label><p>${h(rulesetId==='dnd'?T.dndHint:T.defaultHint)}</p>${finish('floor',root.FH_STYLE_TEXT.floorPresets)}${finish('wall',root.FH_STYLE_TEXT.wallPresets)}<div class="actions"><button id="roof-save" class="primary">${h(T.save)}</button><button id="roof-close">${h(T.close)}</button></div>`,()=>{
   const $=id=>document.getElementById(id);
   const value=kind=>({preset:$(`roof-${kind}-preset`).value,color:$(`roof-${kind}-color`).value,pattern:config[kind].pattern});
   for(const kind of ['floor','wall']){
    const refresh=()=>root.FHStyleRuntime.preview($(`roof-${kind}-preview`),value(kind),project);
    for(const prop of ['preset','color'])$(`roof-${kind}-${prop}`).oninput=refresh;
    refresh();
   }
   const shapeControls=()=>{
    const gable=$('roof-shape').value==='gable';
    const pitched=gable||($('roof-shape').value==='auto'&&rulesetId==='dnd');
    $('roof-height').disabled=gable;
    $('roof-rise').disabled=!pitched;
    $('roof-ridge').disabled=!pitched;
    $('roof-coverColor').disabled=!pitched;
    // Automática puede combinar tejado y balcón en la misma planta.
    for(const id of ['roof-height-label','roof-rise-label','roof-axis-label','roof-cover-label'])
     $(id).hidden=id==='roof-height-label'?gable:!pitched;
   };
   $('roof-shape').onchange=shapeControls;shapeControls();
   $('roof-close').onclick=closeModal;
   $('roof-save').onclick=()=>{
    if(root.FHStyleEditor?.hasActor())return toast(T.denied);
    const raw=$('roof-height').value,height=Number(raw);
    if(raw===''||!Number.isFinite(height)||height<0||height>2)return toast(T.invalid);
    const rise=Number($('roof-rise').value);
    if(($('roof-shape').value==='gable'||($('roof-shape').value==='auto'&&rulesetId==='dnd'))&&(!Number.isFinite(rise)||rise<1||rise>30))return toast(T.invalidRise);
    f.roof=root.FHRoof.settings({enabled:$('roof-enabled').checked,
     shape:$('roof-shape').value,ridgeAxis:$('roof-ridge').value,riseFt:rise,
     coverColor:$('roof-coverColor').value,
     parapetHeightTiles:height,floor:value('floor'),wall:value('wall')});
    record();closeModal();toast(T.saved);
   };
  });
 }
 root.FHRoofEditor=Object.freeze({open});
})(typeof window!=='undefined'?window:globalThis);
