/* Cadenas en español para inspección de habitaciones y parcelas. */
(function(root){
 'use strict';
 root.FH_CONSTRUCTION_ROOMS_TEXT=Object.freeze({
 title:'Habitaciones funcionales',
 help:'Clasifica cada habitación según su uso. Los muebles se colocan con las herramientas existentes.',
 helpRuntime:'El agua, drenaje y electricidad se comprueban durante la partida. El acceso de NPC todavía no se valida.',
 noRooms:'La parcela todavía no contiene habitaciones tipo Room.',
 noPreset:'Sin función asignada',
 presets:Object.freeze({bano:'Baño',cocina:'Cocina',dormitorio:'Dormitorio',oficina:'Oficina',descanso:'Sala de descanso'}),
 needs:Object.freeze({toilet:'inodoro',bathSink:'lavabo',kitchenSink:'fregadero',cook:'equipo de cocina',
  fridge:'refrigerador',bed:'cama',desk:'escritorio',seat:'asiento',table:'mesa',
  bano:'baño',cocina:'cocina',dormitorio:'dormitorio',oficina:'oficina',descanso:'sala de descanso'}),
 status:Object.freeze({ready:'Requisitos comprobados',unverified:'Servicios pendientes de comprobar',
  incomplete:'Requisitos incompletos'}),
 issue:Object.freeze({falta_mueble:'Falta',falta_habitacion:'Falta una habitación de tipo',
  sin_agua:'Sin agua',sin_drenaje:'Sin drenaje',sin_electricidad:'Sin electricidad',
  falta_registradora:'Falta una caja registradora',faltan_exhibidores:'Faltan góndolas o exhibidores',
  obra_pendiente:'Obra aún sin terminar'}),
 access:'La accesibilidad para NPC no está comprobada.'
 });
})(typeof window!=='undefined'?window:globalThis);
