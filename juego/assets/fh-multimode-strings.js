/* Única fuente de textos de la selección multimodo. */
(function(root){
 'use strict';
 root.FH_MULTIMODE_TEXT=Object.freeze({
  open:'Mundos y combate',title:'Elige tu mundo',subtitle:'Un motor 3D. Distintos mundos y reglamentos.',
  worldTitle:'Mundo',rulesTitle:'Reglamento',start:'Iniciar partida',current:'Legacy · Mapa del editor',dndCurrent:'D&D · Mapa del editor',
  close:'Cerrar selector',loading:'Comprobando perfiles y mapas reales…',
  ready:'Ciudad moderna y Legacy disponibles. Se utilizará el mapa de demostración del perfil.',
  offline:'Los mapas publicados requieren HTTPS. El mapa del editor se puede probar localmente si el reglamento está instalado.',
  failed:'No fue posible validar los recursos del mundo. El arranque del editor sigue disponible.',
  starting:'Validando y preparando el mundo seleccionado…',
  launchError:'No se pudo iniciar esta combinación. Revisa el perfil y los recursos publicados.',
  noWorld:'Mapa no disponible',noRules:'Adaptador pendiente',
  available:'Disponible',planned:'Pendiente',missing:'No disponible',
  modern:'Ciudad moderna',dystopian:'Ciudad distópica',medieval:'Villa o castillo medieval',
  legacy:'Legacy',dnd:'DnD',moon:'Moon System',
  demo:'Mapa de demostración cargable',noMap:'Sin mapa cargable',adapterPending:'Sin adaptador funcional',
  localHint:'Prueba el mapa que tienes abierto en Legacy o D&D, sin reemplazarlo por una demostración.',
  mapIdMissing:'El mapa actual no tiene identidad de guardado. Guarda el mapa antes de jugar D&D.',
  currentMapInvalid:'El mapa actual tiene errores. Corrígelos en el editor antes de iniciar D&D.',
  dndUnavailable:'El motor D&D todavía no está disponible en esta página.'
 });
})(typeof globalThis!=='undefined'?globalThis:this);