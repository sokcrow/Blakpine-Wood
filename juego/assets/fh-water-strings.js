/* Textos visibles al jugador: Agua 01. */
(function(root){'use strict';root.FH_WATER_TEXT=Object.freeze({
 title:'Agua y drenaje · Modelos',close:'Cerrar',choose:'Modelo de agua',selected:'Seleccionado: ',
 wall:'Pared',floor:'Piso',wallRequired:'Este modelo necesita una pared estructural completa.',
 wrongSide:'Usa el dispositivo desde su frente.',noPermission:'No tienes permiso para modificar este equipo.',
 loadError:'No pudo cargarse el modelo de agua. Se conserva el objeto anterior.',
 meterReading:liters=>'Medidor de agua: '+liters.toFixed(1)+' litros registrados.',
 heaterWater:'Calentador con suministro de agua. La temperatura aún no se simula.',
 heaterNoWater:'Calentador sin suministro de agua.',
 note:'Los medidores, válvulas, tomas y drenajes usan FHServices. La coladera utiliza el drenaje existente. El calentador actúa como toma de agua, sin simulación de temperatura.',
 networkToggle:'Red potable automática por paredes y pisos',
 tankCistern:'Cisterna · reserva potable',tankTinaco:'Tinaco · reserva potable',
 modelPending:'Modelo 3D pendiente',networkId:'Identificador de red hidráulica',
 visibility:'Visualización de tuberías',concealed:'Empotradas',visible:'Visibles',
 tankCapacity:'Capacidad (litros)',tankInitial:'Contenido inicial (litros)',
 tankFill:'Llenado (litros/min)',tankRange:'Longitud máxima de distribución (pies)',
 tankStatus:(liters,capacity)=>'Depósito de agua potable: '+liters.toFixed(1)+' / '+capacity.toFixed(1)+' litros.',
 pick:'Ver modelos de Agua'
});})(typeof window!=='undefined'?window:globalThis);
