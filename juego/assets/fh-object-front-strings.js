/* Cadenas visibles de orientación en el editor de mapas. */
(function(root){
 'use strict';
 root.FH_OBJECT_FRONT_TEXT=Object.freeze({
  title:'Frente del objeto',rotation:'Orientación',
  angle:deg=>'Frente: '+deg+'°',
  hint:'La flecha amarilla marca el frente que utiliza el modelo 3D.',
  wallHint:'Objeto fijado a pared: el muro determina hacia dónde mira. Cambia su posición o pared para reorientarlo.',
  negative90:'Girar −90°',negative45:'Girar −45°',
  positive45:'Girar +45°',positive90:'Girar +90°',
  reset:'Restablecer a 0°',
  icon:'↓'
 });
})(typeof window!=='undefined'?window:globalThis);
