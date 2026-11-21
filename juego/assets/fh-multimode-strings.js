/* Única fuente de textos de la selección multimodo. */
(function(root){
 'use strict';
 root.FH_MULTIMODE_TEXT=Object.freeze({
  open:'Mundos y combate',title:'Elige tu mundo',subtitle:'Un motor 3D. Distintos mundos y reglamentos.',
  worldTitle:'Mundo',rulesTitle:'Reglamento',start:'Iniciar partida',current:'Legacy · Mapa del editor',
  close:'Cerrar selector',loading:'Comprobando perfiles y mapas reales…',
  ready:'Ciudad moderna y Legacy disponibles. Se utilizará el mapa de demostración del perfil.',
  offline:'Sin acceso HTTPS a perfiles: puedes jugar Legacy con el mapa del editor.',
  failed:'No fue posible validar los recursos del mundo. El arranque del editor sigue disponible.',
  starting:'Validando y preparando el mundo seleccionado…',
  launchError:'No se pudo iniciar esta combinación. Revisa el perfil y los recursos publicados.',
  noWorld:'Mapa no disponible',noRules:'Adaptador pendiente',
  available:'Disponible',planned:'Pendiente',missing:'No disponible',
  catalogOnly:'Catálogo del editor disponible · partida no disponible',
  catalogHint:'El reglamento cambia el catálogo del editor. Puedes cerrar el selector y seguir editando.',
  modern:'Ciudad moderna',dystopian:'Ciudad distópica',medieval:'Villa o castillo medieval',
  legacy:'Legacy',dnd:'DnD',moon:'Moon System',
  demo:'Mapa de demostración cargable',noMap:'Sin mapa cargable',adapterPending:'Sin adaptador funcional',
  localHint:'La prueba del editor conserva la entrada Legacy original, también sin conexión.'
 });
})(typeof globalThis!=='undefined'?globalThis:this);
