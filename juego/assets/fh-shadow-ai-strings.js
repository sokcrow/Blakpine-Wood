/* Blakpine-Wood — textos de la categoría Sombras. */
(function(root){
 'use strict';
 const names=Object.freeze({el_alto:'El Alto',la_nina:'La Niña'});
 const strings=Object.freeze({
  category:'Sombras',names,
  nearby:'Sientes una presencia cerca.',
  attacked:(kind,damage,resource,dice)=>names[kind]+' te ha drenado '+damage+' '+(resource==='sp'?'PS':'PG')+(dice===2?' (2d4).':'.'),
  nightmare:'La Niña invade tus sueños. Una pesadilla te despierta.'
 });
 root.FH_SHADOW_TEXT=strings;
 if(typeof module==='object'&&module.exports)module.exports=strings;
})(typeof window!=='undefined'?window:globalThis);
