/* Blakpine-Wood — textos de encuentros con Sombras. */
(function(root){
 'use strict';
 const names=Object.freeze({el_alto:'El Alto',la_nina:'La Niña'});
 const strings=Object.freeze({
  names,
  nearby:'Sientes una presencia cerca.',
  attacked:(kind,damage)=>names[kind]+' te ha alcanzado. -'+damage+' PG.'
 });
 root.FH_SHADOW_TEXT=strings;
 if(typeof module==='object'&&module.exports)module.exports=strings;
})(typeof window!=='undefined'?window:globalThis);
