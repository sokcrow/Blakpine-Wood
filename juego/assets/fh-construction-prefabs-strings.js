/* Textos visibles de Construcción 04. */
(function(root){
 'use strict';
 root.FH_CONSTRUCTION_PREFABS_TEXT=Object.freeze({
  button:'Generar edificio completo',help:'Crea paredes, puertas, losa, habitaciones, muebles y puntos de servicio editables. No conecta redes inexistentes.',
  success:'Edificio generado. Puedes editar sus paredes, habitaciones y muebles.',
  busy:'Generando edificio...',generated:'Esta parcela ya tiene una construcción generada.',
  select:'Selecciona un proyecto antes de generar.',
  errors:Object.freeze({
   unknown_preset:'Ese proyecto necesita diseño manual.',
   no_floor:'No se encontró el piso de esta parcela.',
   generated:'Ya existe un edificio generado en esta parcela.',
   invalid_parcel:'La parcela debe ser rectangular y dejar un margen de una casilla alrededor del edificio.',
   small_parcel:'La parcela no tiene espacio suficiente para este edificio.',
   occupied:'Hay una construcción, objeto o calle dentro del espacio previsto. Despeja el terreno.',
   missing_catalog:'No se pudo cargar el catálogo de muebles.',
   missing_model:'Falta un modelo del mobiliario de este edificio.',
   invalid_catalog:'No se pudo preparar el mobiliario del edificio.'
  })
 });
})(typeof window!=='undefined'?window:globalThis);