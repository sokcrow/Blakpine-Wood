/* Cadenas del sistema de drenajes. */
(function(root){'use strict';root.FH_DRAIN_TEXT=Object.freeze({
 straight:'Pasillo drenaje 10×10',tee:'Unión T 10×10',cross:'Cruce 10×10',
 small:'Conducto 4×4',outfall:'Desagüe principal 20×20',bridge:'Puente de reja',
 audit:'Revisar red de drenajes',settings:'Drenaje',place:'Pieza colocada',
 blocked:'No tienes permiso para construir aquí.',drag:'Coloca la pieza con un toque, sin arrastrar.',
 overlap:'Ya existe un premade de drenaje en esa superficie.',
 rotate:'Girar 90°',flow:'Corriente hacia',auto:'Automática (hacia desagüe accesible)',
 disconnected:'Sin conexión hidráulica',invalid:'Destino de corriente inválido',
 report:'Diagnóstico del alcantarillado',clean:'No se detectaron conexiones incompatibles.',
 none:'Aún no existen tramos de drenaje en este mapa.',
 near:'Salida residual más próxima',noNear:'Sin drenajes en el mapa',
 closed:'Cerrar',
 tips:{
  drain_straight:'Pasillo 10×10: 3 tiles de camino, 4 de agua, 3 de camino.',
  drain_tee:'Unión T: tres canales centrales conectables. Gírala para cambiar sus salidas.',
  drain_cross:'Cruce de drenaje: cuatro direcciones con agua conectada.',
  drain_small:'Conducto 4×4: canal pequeño. Se inunda con lluvia.',
  drain_outfall:'Desagüe 20×20: laterales transitables, remolino y agujero en el centro.',
  drain_bridge:'Coloca un puente de reja sobre el agua donde lo necesites.',
  drain_audit:'Muestra las conexiones válidas, piezas aisladas y destinos incorrectos.'
 }
});})(typeof window!=='undefined'?window:globalThis);
