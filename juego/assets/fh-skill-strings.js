/* Textos españoles de habilidades y tiradas con monedas. */
(function(global){
 'use strict';
 global.FH_SKILL_TEXT=Object.freeze({
  title:'Habilidades',explanation:'Puntos de habilidad separados de los Scores. Las tiradas usan monedas porcentuales, no dados de daño.',
  difficulty:'Dificultad',advantage:'Ventajas',disadvantage:'Desventajas',
  roll:'Lanzar monedas',points:'Puntos',heads:'Heads',tails:'Tails',
  headsChance:'Probabilidad de Heads por moneda',successChance:'Probabilidad total de éxito',
  noCharacter:'No hay personaje para realizar la tirada.',
  outcomes:{
   'critical-success':'Éxito crítico','success':'Éxito',
   'critical-failure':'Fallo crítico','failure':'Fallo'
  },
  names:{
   atletismo:'Atletismo',fuerzaBruta:'Fuerza bruta',forcejeo:'Forcejeo',cargaFisica:'Carga física',
   sigilo:'Sigilo',acrobacias:'Acrobacias',manipulacionFina:'Manipulación fina',cerrajeria:'Cerrajería',conduccion:'Conducción',
   temple:'Temple',concentracion:'Concentración',autocontrol:'Autocontrol',resistenciaMental:'Resistencia mental',
   percepcion:'Percepción',rastreo:'Rastreo',orientacion:'Orientación',evaluacionPeligros:'Evaluación de peligros',
   investigacion:'Investigación',informatica:'Informática',electronica:'Electrónica',mecanica:'Mecánica',medicina:'Medicina',
   sensibilidadArcana:'Sensibilidad arcana',interpretacionArcana:'Interpretación arcana',canalizacion:'Canalización',
   proteccionArcana:'Protección arcana',rituales:'Rituales',
   persuasion:'Persuasión',engano:'Engaño',intimidacion:'Intimidación',empatia:'Empatía',interpretacionSocial:'Interpretación social'
  }
 });
})(typeof window!=='undefined'?window:globalThis);
