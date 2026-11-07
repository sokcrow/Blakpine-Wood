/* Forest Horror — panel de metadatos opcionales en el inspector existente.
 * No agrega herramientas, objetos de mapa ni mecánicas de acceso al motor.
 */
(function(global){
 'use strict';
 const config=global.FHAccessConfig,T=global.FH_ARCHITECTURE_TEXT;
 if(!config||!T)throw Error('Falta configuración o textos de accesos');
 const css=document.createElement('style');
 css.textContent='#fields .fhAccessPanel{grid-column:1/-1;display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:9px;padding:12px 0 4px;border-top:1px solid #6c7d83}#fields .fhAccessPanel>strong,#fields .fhAccessPanel>p{grid-column:1/-1;margin:0}#fields .fhAccessPanel>p{font-size:12px;color:#c6d1d4}#fields .fhAccessPanel label{display:flex;flex-direction:column;gap:4px;min-width:0}#fields .fhAccessPanel label.fhAccessCheck{flex-direction:row;align-items:center;gap:8px}#fields .fhAccessPanel input:not([type=checkbox]),#fields .fhAccessPanel select{max-width:100%;min-width:0}';
 document.head.appendChild(css);
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const enums={
  accessDoorType:[['inherit',T.configDoorInherited],['manual',T.configDoorManual],['electronic',T.configDoorElectronic]],
  doorMaterial:[['inherit',T.configMaterialInherited],['wood',T.configMaterialWood],['metal',T.configMaterialMetal],
   ['glass',T.configMaterialGlass],['grille',T.configMaterialGrille],['reinforced',T.configMaterialReinforced]],
  windowOperation:[['fixed',T.configWindowFixed],['operable',T.configWindowOperable]],
  credentialMode:[['individual',T.configCredentialIndividual],['shared',T.configCredentialShared]],
  remoteControlPermission:[['none',T.configRemoteNone],['owner',T.configRemoteOwner],
   ['authorized',T.configRemoteAuthorized]],
  lockMode:[['legacy',T.configLockLegacy],['unilateral',T.configLockUnilateral],['total',T.configLockTotal]]
 };
 function field(section,item,key,title){
  const spec=config.definitions[key],label=el('label',title);
  const value=config.effective(item,key);
  let input;
  if(spec.kind==='boolean'){
   input=el('input');input.type='checkbox';input.checked=value;
   label.className='fhAccessCheck';label.prepend(input);
  }else if(enums[key]){
   input=el('select');
   for(const [id,caption] of enums[key]){
    const opt=el('option',caption);opt.value=id;input.append(opt);
   }
   input.value=value;
   label.append(input);
  }else{
   input=el('input');
   input.type=spec.kind==='seconds'?'number':'text';
   input.value=String(value);
   input.autocomplete='off';
   if(spec.kind==='seconds'){input.min='0';input.max='3600';input.step='1';}
   if(spec.kind==='id')input.maxLength=120;
   label.append(input);
  }
  label.dataset.accessField=key;
  input.onchange=()=>{
   const it=current().items.find(x=>x.id===item.id);
   if(!it||it.type!==item.type)return;
   if(global.FHStyleEditor&&!global.FHStyleEditor.canEditItem(it)){
    toast(T.notAllowed);openInspector();return;
   }
   let next=spec.kind==='boolean'?input.checked:
    spec.kind==='seconds'?(input.value.trim()===''?NaN:Number(input.value)):input.value;
   try{
    const had=Object.prototype.hasOwnProperty.call(it,key),previous=it[key];
    if(config.setField(it,key,next)){
     const problems=global.FHStructureHealth?.validateItem(it)||[];
     if(problems.length){
      if(had)it[key]=previous;else delete it[key];
      throw Error(problems.map(x=>x.message).join(' · '));
     }
     record();
    }
    openInspector();
   }catch(error){
    toast(T.configInvalid+' '+error.message);
    openInspector();
   }
  };
  section.append(label);
 }
 const oldOpenInspector=openInspector;
 openInspector=function(){
  oldOpenInspector();
  const item=current().items.find(it=>it.id===selection);
  if(!item||!['door','peephole_door','window'].includes(item.type))return;
  const parent=document.getElementById('fields');
  if(!parent)return;
  const section=el('section');
  section.className='fhAccessPanel';
  section.append(el('strong',T.configTitle),el('p',T.configNote));
  if(item.type==='window'){
   field(section,item,'windowOperation',T.configWindowOperation);
   field(section,item,'curtains',T.configCurtains);
  }else{
   section.append(el('p',T.existingDoorFields));
   field(section,item,'accessDoorType',T.configDoorType);
   field(section,item,'doorMaterial',T.configMaterial);
   field(section,item,'interiorLatch',T.configInteriorLatch);
   field(section,item,'credentialMode',T.configCredentialMode);
   if(config.effective(item,'credentialMode')==='shared')
    field(section,item,'credentialGroupId',T.configCredentialGroup);
   field(section,item,'unlockDurationSec',T.configUnlockSeconds);
   field(section,item,'securityZoneId',T.configSecurityZone);
   field(section,item,'remoteControlPermission',T.configRemotePermission);
   field(section,item,'lockMode',T.configLockMode);
  }
  parent.append(section);
 };
 global.FHAccessEditor=Object.freeze({fieldsFor:it=>
  it?.type==='window'?['windowOperation','curtains']:
  ['door','peephole_door'].includes(it?.type)?[
   'accessDoorType','doorMaterial','interiorLatch','credentialMode',
   ...(config.effective(it,'credentialMode')==='shared'?['credentialGroupId']:[]),
   'unlockDurationSec','securityZoneId','remoteControlPermission','lockMode']:[]});
})(window);
