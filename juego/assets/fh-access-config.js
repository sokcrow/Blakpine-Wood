/* Forest Horror — metadatos opcionales de accesos (editor, sin reglas de gameplay).
 * El esquema del mapa sigue siendo forest-horror-map-v1. No se rellenan campos
 * ausentes durante carga ni exportación: sólo se materializan al editarlos.
 */
(function(global){
 'use strict';
 const defaults=Object.freeze({
  accessDoorType:'inherit',
  doorMaterial:'inherit',
  windowOperation:'fixed',
  interiorLatch:false,
  curtains:false,
  credentialMode:'individual',
  credentialGroupId:'',
  unlockDurationSec:0,
  securityZoneId:'',
  remoteControlPermission:'none',
  lockMode:'legacy'
 });
 const definitions=Object.freeze({
  accessDoorType:{scope:'door',values:['inherit','manual','electronic']},
  doorMaterial:{scope:'door',values:['inherit','wood','metal','glass','grille','reinforced']},
  windowOperation:{scope:'window',values:['fixed','operable']},
  interiorLatch:{scope:'door',kind:'boolean'},
  curtains:{scope:'window',kind:'boolean'},
  credentialMode:{scope:'door',values:['individual','shared']},
  credentialGroupId:{scope:'door',kind:'id'},
  unlockDurationSec:{scope:'door',kind:'seconds'},
  securityZoneId:{scope:'door',kind:'id'},
  remoteControlPermission:{scope:'door',values:['none','owner','authorized']},
  lockMode:{scope:'door',values:['legacy','unilateral','total']}
 });
 const isDoor=it=>it?.type==='door'||it?.type==='peephole_door';
 const accepts=(it,key)=>Object.prototype.hasOwnProperty.call(definitions,key)&&
  (definitions[key].scope==='door'?isDoor(it):it?.type==='window');
 function effective(it,key){
  if(!accepts(it,key))return undefined;
  return Object.prototype.hasOwnProperty.call(it,key)?it[key]:defaults[key];
 }
 function checkValue(key,value){
  const def=definitions[key];
  if(!def)return 'Campo de configuración desconocido';
  if(def.values)return def.values.includes(value)?'':'Opción no reconocida';
  if(def.kind==='boolean')return typeof value==='boolean'?'':'Debe ser verdadero o falso';
  if(def.kind==='id')return typeof value==='string'&&value.length<=120&&!/[\u0000-\u001f\u007f]/.test(value)
   ?'':'Debe ser texto de hasta 120 caracteres';
  if(def.kind==='seconds')return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=3600
   ?'':'Debe estar entre 0 y 3600 segundos';
  return 'Tipo de campo inválido';
 }
 function setField(it,key,value){
  if(!accepts(it,key))throw new TypeError('Campo incompatible con este elemento: '+key);
  const def=definitions[key];
  const next=def.kind==='id'&&typeof value==='string'?value.trim():value;
  const invalid=checkValue(key,next);
  if(invalid)throw new TypeError(key+': '+invalid);
  const had=Object.prototype.hasOwnProperty.call(it,key);
  if(next===defaults[key]){
   if(had){delete it[key];return true;}
   return false;
  }
  if(had&&it[key]===next)return false;
  it[key]=next;
  return true;
 }
 function validateItem(it,path='item'){
  if(!it||typeof it!=='object')return [];
  const errors=[];
  for(const key of Object.keys(definitions)){
   if(!accepts(it,key)||!Object.prototype.hasOwnProperty.call(it,key))continue;
   const reason=checkValue(key,it[key]);
   if(reason)errors.push({path:path+'.'+key,message:reason});
  }
  return errors;
 }
 function validateMap(map){
  const errors=[];
  if(Array.isArray(map?.floors))for(const [fi,floor] of map.floors.entries()){
   if(!Array.isArray(floor?.items))continue;
   for(const [ii,item] of floor.items.entries())
    errors.push(...validateItem(item,'floors['+fi+'].items['+ii+']'));
  }
  if(errors.length){
   const error=new Error('Configuración de accesos inválida: '+
    errors.map(e=>e.path+': '+e.message).join(' · '));
   error.name='AccessConfigurationError';
   error.errors=errors;
   throw error;
  }
  return map;
 }
 global.FHAccessConfig=Object.freeze({defaults,definitions,effective,setField,validateItem,validateMap});
})(window);
