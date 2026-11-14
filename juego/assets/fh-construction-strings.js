/* Textos visibles del sistema de obras; separados de la lógica. */
(function(root){
 'use strict';
 root.FH_CONSTRUCTION_TEXT=Object.freeze({
 title:'Construcción de parcela', preset:'Proyecto', simulated:'Simular obra durante la partida',
 existing:'Instantánea (sin obra)', live:'Obra visible en la partida',
 phases:Object.freeze({planificada:'Planificada',cimientos:'Cimientos',estructura:'Estructura',
  instalaciones:'Instalaciones',inspeccion:'Inspección',terminada:'Terminada'}),
 presets:Object.freeze({ayuntamiento:'Ayuntamiento',apartamentos:'Apartamentos',
  casas:'Casas',tienda:'Tienda de conveniencia',personalizado:'Personalizado'}),
 help:'Define el tipo de proyecto. Los muebles y servicios se colocan con las herramientas existentes.',
 saved:'Proyecto de construcción guardado',
 none:'Sin proyecto de construcción'
 });
})(typeof window!=='undefined'?window:globalThis);
