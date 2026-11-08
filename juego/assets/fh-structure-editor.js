/* Blakpine-Wood — campos iniciales de PG en el inspector 2D existente. */
(function(global){
'use strict';
const H=global.FHStructureHealth;
if(!H)return;
const css=document.createElement('style');
css.textContent='#fields .fhStructurePanel{grid-column:1/-1;display:grid;gap:9px;padding:10px 0;border-top:1px solid #788487}#fields .fhStructurePanel label{display:flex;flex-direction:column;gap:4px}#fields .fhStructurePanel .fhStructureChecks{display:flex;gap:12px;flex-wrap:wrap}#fields .fhStructurePanel .fhStructureChecks label{flex-direction:row;align-items:center;gap:6px}';
document.head.appendChild(css);
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function apply(it,key,value){
 const old=Object.prototype.hasOwnProperty.call(it,key)?structuredClone(it[key]):undefined;
 const had=Object.prototype.hasOwnProperty.call(it,key);
 const max=H.maxPG(it,key==='readerInitialPG'?'reader':'structure');
 if(key==='damageVulnerabilities'){
  if(value.length)it[key]=value;
  else delete it[key];
 }else if(key==='initialPG'||key==='readerInitialPG'){
  if(!Number.isFinite(value)||value<0||value>max)throw Error('Los PG deben estar entre 0 y '+max);
  if(value===max)delete it[key];else it[key]=value;
 }else if(key==='windowMaterial'){
  if(value==='glass')delete it[key];else it[key]=value;
 }
 const errors=H.validateItem(it);
 if(errors.length){
  if(had)it[key]=old;else delete it[key];
  throw Error(errors.map(e=>e.message).join(' · '));
 }
 return had!==Object.prototype.hasOwnProperty.call(it,key)||(!had?it[key]!==undefined:JSON.stringify(old)!==JSON.stringify(it[key]));
}
function attach(){
 const it=current().items.find(x=>x.id===selection);
 if(!it||!H.supports(it))return;
 const fields=document.getElementById('fields');
 if(!fields)return;
 const section=node('section');section.className='fhStructurePanel';
 const title=node('strong','Resistencia física · configuración inicial');section.append(title);
 const change=(key,value)=>{
  const original=current().items.find(x=>x.id===it.id);
  if(!original)return;
  if(global.FHStyleEditor&&!global.FHStyleEditor.canEditItem(original)){toast('No puedes modificar este objeto');openInspector();return;}
  try{if(apply(original,key,value))record();openInspector();}
  catch(error){toast(error.message);openInspector();}
 };
 if(it.type==='window'){
  const label=node('label','Material de ventana');
  const select=node('select');
  for(const [id,name] of [['glass','Cristal'],['wood','Madera'],['metal','Metal'],['grille','Reja'],['reinforced','Reforzado']]){
   const option=node('option',name);option.value=id;select.append(option);
  }
  select.value=H.material(it);select.onchange=()=>change('windowMaterial',select.value);
  label.append(select);section.append(label);
 }
 const max=H.maxPG(it);
 section.append(node('div','PG máximos: '+max+(H.isElectronic(it)?' · electrónicos fijos':'')));
 function numberField(key,labelText,maxValue){
  const label=node('label',labelText);
  const input=node('input');input.type='number';input.min='0';input.max=String(maxValue);input.step='.5';
  input.value=String(H.initialPG(it,key==='readerInitialPG'?'reader':'structure'));
  input.onchange=()=>change(key,input.value.trim()===''?NaN:Number(input.value));
  label.append(input);section.append(label);
 }
 numberField('initialPG','PG iniciales',max);
 if(['pin','card'].includes(it.accessDevice))
  numberField('readerInitialPG','PG iniciales del lector (máximo fijo: 10)',10);
 const checks=node('div');checks.className='fhStructureChecks';
 checks.append(node('strong','Vulnerabilidad (daño ×2)'));
 for(const [id,name] of [['physical','Físico'],['magical','Mágico']]){
  const label=node('label',name),check=node('input');check.type='checkbox';
  check.checked=(it.damageVulnerabilities||[]).includes(id);
  check.onchange=()=>{
   const list=new Set(it.damageVulnerabilities||[]);
   if(check.checked)list.add(id);else list.delete(id);
   change('damageVulnerabilities',[...list]);
  };
  label.prepend(check);checks.append(label);
 }
 section.append(checks);
 section.append(node('small','Los PG perdidos durante la partida se guardan aparte y no modifican este mapa.'));
 fields.append(section);
}
const oldOpenInspector=openInspector;
openInspector=function(){oldOpenInspector();attach();};
global.FHStructureHealthEditor=Object.freeze({apply,attach});
})(window);
