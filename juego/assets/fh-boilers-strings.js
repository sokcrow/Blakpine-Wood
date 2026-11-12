(function(root){'use strict';
 root.FH_BOILERS_TEXT=Object.freeze({
  picker:'Calderas y agua caliente',close:'Cerrar',select:'Modelo de caldera',
  hint:'Los cuatro calentadores producen agua caliente con suministro frío y energía; accesorios restantes son visuales.',
  assetPending:'Modelo 3D pendiente de incorporar al repositorio',
  boiler:'Caldera',capacity:'Capacidad de agua caliente (litros)',initial:'Reserva inicial (litros)',
  temperature:'Temperatura objetivo (°C)',heatingRate:'Calentamiento (°C/min de juego)',
  fillRate:'Llenado de agua fría (L/min)',range:'Alcance de tuberías calientes (pies)',
  inlet:'Red de entrada fría',outlet:'Red de salida caliente',pipe:'Tubería caliente',
  coldOnly:'Solo agua fría',hotEnabled:'Toma doble (fría y caliente)',
  noBoiler:'Sin caldera conectada',notHot:'Caldera sin agua suficientemente caliente',
  noPower:'Caldera sin electricidad',noCold:'Caldera sin entrada de agua fría',
  report:(s)=>'Caldera: '+Number(s.liters||0).toFixed(1)+' / '+Number(s.capacityLiters||0).toFixed(1)+
   ' litros · '+Number(s.temperatureC||0).toFixed(1)+' °C · '+
   (s.ready?'Agua caliente disponible':s.coldConnected?s.powered?'Calentando o sin temperatura suficiente':'Sin energía':'Sin agua fría'),
  connection:(s)=>s.hotWater?('Agua caliente desde '+s.sourceId+' · '+Number(s.feet||0).toFixed(1)+' pies'):
   s.connected?'Conexión caliente sin temperatura suficiente':'No tiene conexión de agua caliente'
 });
})(typeof window!=='undefined'?window:globalThis);
