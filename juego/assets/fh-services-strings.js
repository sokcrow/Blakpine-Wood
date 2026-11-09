/* Blakpine-Wood: textos de infraestructura; las tarifas se incorporarán aparte. */
(function(root){
 'use strict';
 root.FH_SERVICES_TEXT=Object.freeze({
  tabElectric:'⚡ Electricidad',
  catWater:'◉ Agua y drenaje',catData:'⌁ Internet y telefonía',
  labels:Object.freeze({
   power_outlet:'Enchufe doble',power_strip:'Multiconector',phone_charger:'Cargador de celular',
   water_main:'Entrada de agua',water_valve:'Válvula de agua',
   water_outlet:'Toma de agua',drain_outlet:'Desagüe',drain_main:'Salida principal de drenaje',
   router:'Router Wi-Fi',ethernet_port:'Toma Ethernet',landline_phone:'Teléfono de pared'
  }),
  wifiCoverage:Object.freeze({
   title:'Cobertura Wi-Fi',bars3:'3 barras',bars2:'2 barras',bars1:'1 barra',
   noPower:'Sin cobertura: el router no tiene electricidad.',
   none:'Sin señal en las casillas visibles.'
  }),
  fields:Object.freeze({
   zoneId:'Circuito eléctrico',slots:'Conexiones disponibles',capacityRayos:'Límite eléctrico (rayos)',
   radiusFt:'Radio de conexión (pies)',outletId:'ID del enchufe o multiconector',
   rangeFt:'Cable disponible (pies)',flowLpm:'Caudal (litros/min)',opened:'Válvula abierta',
   wifiRadiusFt:'Radio Wi-Fi (pies)',wifiPassword:'Contraseña Wi-Fi',
   ethernetLengthFt:'Largo del cable Ethernet (pies)',ethernetLeadFt:'Cable del router a pared (pies)',
   roomId:'Habitación de origen',propertyId:'Parcela del router (opcional)',routerId:'Router asignado',
   cableLengthFt:'Cable disponible (pies)',phoneNumber:'Número de teléfono fijo',chargePerHour:'Carga de batería por hora (%)',
   rayos:'Consumo (rayos)',watts:'Potencia (vatios)',
   powerRequired:'Necesita electricidad',waterRequired:'Necesita agua',
   internetMode:'Conexión de internet',waterFlow:'Consumo de agua (litros/min)',
   drains:'Usa drenaje',breakerType:'Tipo de breaker',
   damage:'Estado de desgaste',serviceNote:'Solo se configurarán tarifas en una etapa posterior.'
  }),
  tips:Object.freeze({
   power_outlet:'Admite dos conexiones. Cada aparato puede conectarse si su cable alcanza hasta 5 pies, salvo configuración específica.',
   power_strip:'El multiconector amplía tomas. Su cable y el de cada aparato cuentan dentro del alcance del breaker.',
   phone_charger:'El celular se retira del inventario y su menú desaparece durante la carga.',
   water_main:'Distribuye suministro por los tramos conectados de pared.',
   water_valve:'Cierra o abre el flujo de la tubería asociada.',
   water_outlet:'Permite conectar muebles que requieren agua.',
   drain_outlet:'Conecta al colector de drenaje por las paredes.',
   drain_main:'Salida de aguas residuales conectada a las tuberías.',
   router:'El Ethernet recorre paredes de las habitaciones asignadas o la parcela; el Wi-Fi atraviesa paredes, pero pierde fuerza con distancia y materiales.',
   ethernet_port:'Conecta equipos por cable a un router asignado.',
   landline_phone:'El teléfono depende de su router y del servicio de telefonía fija.'
  }),
  noPower:'Sin electricidad.',noWater:'Sin agua.',noInternet:'Sin acceso a internet.',
  noCellular:'Sin señal o servicio móvil.',phoneCharging:'Celular cargando.',
  phoneTaken:'Celular recuperado.',phoneFull:'Batería completa.',phoneBatteryEmpty:'Sin batería.',
  chargerMissing:'El cargador no tiene corriente.',phonePlaced:'Celular conectado al cargador.',
  chargerAction:'Poner celular a cargar',takePhone:'Recoger celular',
  useOutlet:'Ver conexiones',useRouter:'Estado de red',useLandline:'Usar teléfono',
  usedSlots:'Conexiones utilizadas',overload:'Sobrecarga eléctrica',
  invalidLink:'Sin conexión válida.',broken:'Conector dañado.',
  serviceActive:'Servicio activo',serviceSuspended:'Servicio suspendido'
 });
})(typeof window!=='undefined'?window:globalThis);

