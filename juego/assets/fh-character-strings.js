/* Blakpine Wood — textos de creación de personaje. */
(function (global) {
 'use strict';
 global.FH_CHARACTER_TEXT=Object.freeze({
  chapter:'BLAKPINE WOOD · HISTORIA PERSONAL',
  title:'Antes de llegar',
  steps:['Origen','Identidad','Fortalezas','Debilidades','Capacidades','Confirmación'],
  cancel:'Cancelar', back:'Atrás', next:'Continuar', finish:'Comenzar esta historia',
  progress:(n,total)=>'Paso '+n+' de '+total,
  originTitle:'¿Qué te une a este pueblo?',
  originHelp:'Tu origen determina tu situación inicial. No escoge una casa ni crea un empleo todavía.',
  resident:'Aquí he vivido desde hace tiempo.',
  visitor:'He llegado buscando a alguien.',
  residentDetail:'Conoces algunas calles y personas. Ya tienes un empleo local, que se asignará cuando exista el sistema de trabajos.',
  visitorDetail:'Vienes con recursos por determinar y tendrás que resolver dónde quedarte.',
  identityTitle:'El nombre que te dieron',
  name:'Tu nombre', namePlaceholder:'Nombre del personaje',
  missingTitle:'¿A quién has venido a buscar?',
  missingName:'Su nombre (opcional)',missingPlaceholder:'Puedes dejarlo pendiente',
  relationship:'Tu vínculo con esa persona',
  relations:{hermano:'Hermano',hermana:'Hermana',madre:'Madre',padre:'Padre',pareja:'Pareja',amigo:'Amigo',amiga:'Amiga',otro:'Otro ser querido'},
  identityHelp:'La persona desaparecida será parte de tu historia. Su identidad se conservará entre mapas.',
  strengthsTitle:'¿En qué dos cosas siempre has destacado?',
  strengthsHelp:'Elige exactamente dos. Sus puntuaciones comenzarán en 5.',
  weaknessTitle:'¿Qué dos cosas siempre te han costado?',
  weaknessHelp:'Elige dos distintas a tus fortalezas. Sus puntuaciones quedarán en 1.',
  bonusTitle:'¿En qué más has trabajado para mejorar?',
  bonusHelp:'Distribuye 4 puntos. No puedes mejorar tus dos debilidades. Nadie puede superar 6, y solo dos Scores pueden llegar a 6.',
  remaining:'Puntos por distribuir',scoreTotal:'Total de Scores',
  summaryTitle:'Esta es tu historia hasta hoy',
  summaryHelp:'Tu formación, profesión y Traits se definirán en fases posteriores. Esta primera etapa registra identidad, origen y capacidades.',
  summaryOrigin:'Origen',summaryMissing:'Persona desaparecida',summaryStats:'Capacidades',
  summaryResources:'Recursos iniciales',summaryPending:'Vivienda, sueldo, profesión y Traits: pendientes de integración.',
  days:'El tiempo del mundo avanza. La búsqueda tiene un máximo de un año dentro del juego.',
  dead:'Tu personaje anterior ha muerto. Para jugar de nuevo debes crear a otra persona.',
  storageError:'No se pudo guardar el personaje. Revisa el almacenamiento del navegador.',
  missingEngine:'No está disponible el creador de personajes.',
  invalidName:'Escribe un nombre de al menos dos caracteres.',
  scoreNames:{FOR:'Fortaleza',AGI:'Agilidad',VOL:'Voluntad',PRU:'Prudencia',ING:'Ingenio',ARC:'Arcano',SOC:'Social'},
  scoreDescriptions:{
   FOR:'Cuerpo y esfuerzo',AGI:'Reflejos y coordinación',VOL:'Control mental',PRU:'Atención y supervivencia',
   ING:'Conocimiento práctico',ARC:'Capacidad arcana',SOC:'Relaciones e influencia'
  }
 });
})(typeof window!=='undefined'?window:globalThis);
