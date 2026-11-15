/* Textos visibles del generador de construcciones; solo datos de interfaz. */
(function(root){
 'use strict';
 root.FH_CONSTRUCTION_PREFABS_TEXT=Object.freeze({
  tool:'Colocar edificio',hint:'Marca el terreno y elige un edificio. Se crea la parcela con nombre automático.',
  modalTitle:'Construir edificio',modalHelp:'Marca la parcela, elige el proyecto y la cantidad de pisos. Todos los elementos seguirán siendo editables.',
  floors:'Cantidad de pisos',confirm:'Generar edificio',cancel:'Cancelar',
  dmOnly:'Solo el DM puede construir edificios.',
  homes:'departamentos',
  button:'Generar edificio completo',
  help:'Crea paredes rojas y azules, puertas, baños privados, habitaciones, mobiliario y servicios editables. No inventa conexión a redes. Las obras por fases aún necesitan integración física.',
  success:'Edificio generado. Puedes editar sus paredes, habitaciones y muebles.',
  busy:'Generando edificio...',generated:'Esta parcela ya tiene una construcción generada.',
  select:'Selecciona un proyecto antes de generar.',
  errors:Object.freeze({
   unknown_preset:'Ese proyecto necesita diseño manual.',
   no_floor:'No se encontró el piso de esta parcela.',
   no_zones:'No se pudo acceder a la herramienta de propiedades.',
   generated:'Ya existe un edificio generado en esta parcela.',
   invalid_parcel:'Selecciona una parcela rectangular con margen de una casilla alrededor del edificio, sin superponer otra propiedad.',
   small_parcel:'La parcela no tiene espacio para distribuir habitaciones, pasillos y puertas.',
   occupied:'Hay una construcción, objeto o calle dentro del terreno. Despeja el espacio antes de construir.',
   missing_catalog:'No se pudo cargar el catálogo de muebles.',
   missing_model:'Falta un modelo del mobiliario del edificio.',
   furniture_no_space:'No caben los muebles y sus zonas de acceso. Amplía el terreno.',
   invalid_stories:'La cantidad de pisos no es válida.',
   levels_conflict:'Las alturas o pisos existentes impiden construir niveles adicionales.',
   invalid_catalog:'No se pudo preparar la distribución del edificio.'
  })
 });
})(typeof window!=='undefined'?window:globalThis);