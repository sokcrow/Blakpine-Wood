/* Textos visibles del radial de interacción y del modo Decorar. */
(function (global) {
  'use strict';
  global.FH_INTERACTION_STRINGS = Object.freeze({
    menuLabel:'Acciones del objeto',action:'Acción',interact:'Interactuar',close:'Cerrar menú radial',
    door:'Puerta',stairs:'Escalera',elevator:'Ascensor',furniture:'Mueble',openStorage:'Abrir inventario',
    elevatorOpen:'Abrir puertas',elevatorPanel:'Panel del ascensor',
    elevatorUnavailable:'El ascensor no está disponible.',elevatorNotHere:'El ascensor no está en este piso.',
    elevatorAlreadyOpen:'Las puertas ya están abiertas.',elevatorOpening:'Abriendo puertas.',
    elevatorCannotOpen:'Las puertas no pueden abrirse en este momento.',elevatorNoPower:'El ascensor no tiene energía.',
    courier:'Repartidor',talk:'Hablar',player:'Personaje',playerInventory:'Inventario',peephole:'Mirar por la mirilla',peepholeShort:'Mirilla',knock:'Llamar',examine:'Examinar',
    decorate:'Decorar',decorateMove:'Mover frente a mí',decorateSelect:'Seleccionar / mover',decorateStore:'Muebles guardados',
    decoratePlace:'Colocar',decorateCancel:'Cancelar',decorateTurnFine:'Girar 15°',
    decorateTurn:'Girar 90°',decorateStoreItem:'Guardar mueble',
    decorateOff:'Decorar: desactivado',decorateOn:'Decorar: activado',
    decorateEnable:'Activar modo Decorar',decorateDisable:'Salir de modo Decorar',
    decorateHelp:'Selecciona un mueble cercano con su radial; camina y gira la cámara con normalidad.'
  });
})(typeof window !== 'undefined' ? window : globalThis);
