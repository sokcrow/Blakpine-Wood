/* Textos del sistema de supervivencia. */
(function(root){
 'use strict';
 root.FH_SURVIVAL_TEXT=Object.freeze({
  critical:'Estado crítico',
  stable:'Estable · inconsciente',
  dead:'Muerte permanente',
  deathRoll:'Tirar salvación de muerte',
  saves:(a,b)=>'Salvaciones '+a+'/3 · Fallos '+b+'/3',
  lastRoll:(success,faces)=>(success?'Salvación':'Fallo')+' · '+faces.map(x=>x==='heads'?'Cara':'Cruz').join(', '),
  fatigue:'Falta de sueño',
  missingResources:'No se encuentran los recursos del personaje.'
 });
})(typeof window!=='undefined'?window:globalThis);