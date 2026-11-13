(function(root){'use strict';
 root.FH_BOILERS_TEXT=Object.freeze({
  picker:'Calderas y agua caliente',close:'Cerrar',select:'Modelo de caldera',
  hint:'Los cuatro calentadores producen agua caliente con suministro frío y energía; accesorios restantes son visuales.',
  assetPending:'Modelo 3D pendiente de incorporar al repositorio',
  boiler:'Caldera',capacity:'Capacidad de agua caliente (litros)',initial:'Reserva inicial (litros)',
  enable:'Activar producción de agua caliente',
  temperature:'Temperatura objetivo (°C)',heatingRate:'Calentamiento (°C/min de juego)',
  fillRate:'Llenado de agua fría (L/min)',range:'Alcance de tuberías calientes (pies)',
  inlet:'Red de entrada fría',outlet:'Red de salida caliente',pipe:'Tubería caliente',
  liftPump:'Usar como bomba de elevación desde una cisterna',
  pumpFlow:'Caudal de bombeo (L/min)',pumpInlet:'Tubería de aspiración (pies)',
  pumpRange:'Longitud máxima hasta el tinaco o piso superior (pies)',
  pumpReady:'Bomba conectada a electricidad',pumpNoPower:'Bomba sin corriente o circuito',
  pumpNotReady:'Sin ruta de bombeo diagnosticada',
  pipeFeet:ft=>Number(ft||0).toFixed(1)+' pies de tubería caliente instalada',
  coldOnly:'Solo agua fría',hotEnabled:'Toma doble (fría y caliente)',
  noBoiler:'Sin caldera conectada',notHot:'Caldera sin agua suficientemente caliente',
  noPower:'Caldera sin electricidad',noCold:'Caldera sin entrada de agua fría',
  report:(s)=>'Caldera: '+Number(s.liters||0).toFixed(1)+' / '+Number(s.capacityLiters||0).toFixed(1)+
   ' litros · '+Number(s.temperatureC||0).toFixed(1)+' °C · '+
   (s.ready?'Agua caliente disponible':s.coldConnected?s.powered?'Calentando o sin temperatura suficiente':'Sin energía':
    s.coldReason==='noOutlet'?'Sin toma de agua fría cercana':
    s.coldReason==='sourceUnavailable'?'Toma fría sin suministro':
    'Sin ruta fría desde la toma al suministro'),
  connection:(s)=>s.hotWater?('Agua caliente desde '+s.sourceId+' · '+Number(s.feet||0).toFixed(1)+' pies'):
   s.connected?'Conexión caliente sin temperatura suficiente':
   s.reason==='noHotOutlet'?'Sin toma doble cercana para agua caliente':
   'Sin ruta caliente: revisa red, paredes y montantes'
 });
})(typeof window!=='undefined'?window:globalThis);
