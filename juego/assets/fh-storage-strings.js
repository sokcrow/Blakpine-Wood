/* Etiquetas del panel de almacenamiento. */
(function (global) {
  'use strict';
  global.FH_STORAGE_STRINGS = Object.freeze({
    open: 'Abrir inventario', close: 'Cerrar', personal: 'Bolsillos',
    container: 'Contenedor', slots: 'espacios', empty: 'Vacío',
    help: 'Selecciona un objeto para mover una unidad.',
    store: 'Guardar', take: 'Sacar', moved: 'Objeto transferido.',
    full: 'No hay espacios libres.',
    category: 'Este mueble no admite ese tipo de objeto.',
    categoryFull: 'Límite alcanzado para esta categoría.',
    inaccessible: 'No puedes acceder a ese inventario.',
    missing: 'El objeto ya no está disponible.',
    invalid: 'No se pudo transferir el objeto.'
  });
})(typeof window !== 'undefined' ? window : globalThis);
