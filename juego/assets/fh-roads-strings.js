/* Textos del creador vial y mensajes de validación. */
(function(root){
 root.FH_ROAD_TEXT=Object.freeze({
  category:'Calles',title:'Creador de calles',road:'Calle',settings:'Configurar calle',draw:'Trazar calle',
  select:'Seleccionar',pan:'Mover mapa',erase:'Borrar',audit:'Revisar red',stop:'Alto',signal:'Semáforo',speed:'Límite',crosswalk:'Paso peatonal',portal:'Entrada / salida IA',
  help:'Configura la calle y marca dos puntos de su eje. Puedes arrastrar o tocar inicio y final. Los tramos son rectos, horizontales o verticales. Cruza dos tramos para formar una T o un cruce.',
  scope:'Primera etapa: construcción y datos viales. Todavía no circulan vehículos ni peatones con IA; los semáforos se muestran como elementos de configuración.',
  name:'Nombre',preset:'Carriles',custom:'Personalizado',forward:'Carriles de ida',reverse:'Carriles de vuelta',laneWidth:'Ancho de carril (pies)',sidewalk:'Banqueta a cada lado (pies)',limit:'Velocidad máxima (km/h)',
  from:'Inicio del eje',to:'Final del eje',x:'X (casillas)',y:'Y (casillas)',apply:'Guardar',close:'Cerrar',ready:'Marca el inicio y el final del eje de la calle.',first:'Inicio marcado. Toca el final de la calle.',placed:'Calle creada. Selecciónala para ajustar sus extremos o carriles.',
  invalid:'Revisa los valores: carriles enteros, ancho de 6 a 20 pies y velocidad de 5 a 130 km/h.',bounds:'La calle completa, incluyendo banquetas, debe quedar dentro del mapa y del máximo de 120 × 120 casillas.',short:'El tramo debe medir al menos dos casillas.',denied:'Las calles se editan en modo creador.',
  missingRoad:'Primero traza una calle y toca sobre ella.',missingJunction:'Toca la intersección de dos calles perpendiculares.',
  controlTitle:'Configurar señalización',direction:'Sentido afectado',both:'Ambos sentidos',outward:'Ida (inicio → final)',inward:'Vuelta (final → inicio)',
  green:'Verde por eje (segundos)',yellow:'Amarillo (segundos)',allRed:'Todos en rojo (segundos)',offset:'Desfase de coordinación (segundos)',stopSeconds:'Duración del alto (segundos)',
  stopRule:'Primero quien llegó; después, turnos horarios entre accesos ocupados. Esperar a que el cruce quede libre.',
  signalRule:'Fases alternadas horizontal / vertical, con amarillo e intervalo de todos en rojo. El desfase permite coordinar cruces.',
  controlReady:'Toca una calle para colocar la señal. Para altos y semáforos, toca el centro del cruce.',controlPlaced:'Control vial guardado.',
  report:'Revisión de la red vial',clean:'Sin avisos de conexión en la red actual.',noRoads:'Todavía no hay calles en este piso.',
  disconnected:'Tramo sin conexión con otras calles.',parallel:'Dos tramos paralelos se superponen. Ajusta sus extremos; no se unen automáticamente.',uncontrolled:'Cruce sin alto ni semáforo.',
  duplicate:'Hay más de un control de prioridad en el mismo cruce.',orphan:'La señal perdió su calle o su intersección. Muévela o vuelve a colocarla.',
  badControl:'Configuración de señal inválida.',badRoad:'Configuración vial inválida.',
  delete:'Eliminar elemento',edit:'Editar configuración',moveHint:'Ajusta los extremos desde Configurar calle. Las señales se revisan de nuevo después de mover una calle.',
  legend:'Ida y vuelta se leen desde el inicio hacia el final del eje. Circulación por la derecha. Los cruces permiten izquierda, recto y derecha; sin vuelta en U.',
  summary:(roads,lanes,junctions)=>`${roads} calles · ${lanes} carriles · ${junctions} cruces`,
  tips:{road_draw:'CALLE: configura sus carriles y marca dos puntos del eje.',road_stop:'ALTO: toca el centro de un cruce.',road_signal:'SEMÁFORO: toca el centro de un cruce.',road_speed:'LÍMITE: toca el tramo al que se aplica.',road_crosswalk:'PASO PEATONAL: toca una calle, fuera del centro del cruce.',road_portal:'ENTRADA / SALIDA IA: marca un extremo de la red vial.'}
 });
})(typeof globalThis!=='undefined'?globalThis:this);
