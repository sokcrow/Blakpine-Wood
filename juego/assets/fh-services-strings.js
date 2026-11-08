/* Blakpine-Wood: textos de infraestructura; las tarifas se incorporarán aparte. */
(function(root){
 'use strict';
 root.FH_SERVICES_TEXT=Object.freeze({
  tabElectric:'⚡ Electricidad',
  catWater:'◉ Agua y drenaje',catData:'⌁ Internet y telefonía',
  labels:Object.freeze({
   power_outlet:'Enchufe doble',power_strip:'Multiconector',phone_charger:'Cargador de celular',
   water_main:'Entrada de agua',water_valve:'Válvula de agua',
   water_outlet:'Toma de agua',drain_outlet:'Desagüe',
   router:'Router Wi-Fi',ethernet_port:'Toma Ethernet',landline_phone:'Teléfono de pared'
  }),
  fields:Object.freeze({
   zoneId:'Circuito eléctrico',slots:'Conexiones disponibles',capacityRayos:'Límite eléctrico (rayos)',
   radiusFt:'Radio de conexión (pies)',outletId:'ID del enchufe o multiconector',
   rangeFt:'Recorrido por pared (pies)',flowLpm:'Caudal (litros/min)',opened:'Válvula abierta',
   wifiRadiusFt:'Radio Wi-Fi (pies)',wifiPassword:'Contraseña Wi-Fi',
   ethernetLengthFt:'Largo del cable Ethernet (pies)',routerId:'ID del router',
   cableLengthFt:'Cable disponible (pies)',chargePerHour:'Carga de batería por hora (%)',
   rayos:'Consumo (rayos)',watts:'Potencia (vatios)',
   powerRequired:'Necesita electricidad',waterRequired:'Necesita agua',
   internetMode:'Conexión de internet',waterFlow:'Consumo de agua (litros/min)',
   drains:'Usa drenaje',breakerType:'Tipo de breaker',
   damage:'Estado de desgaste',serviceNote:'Solo se configurarán tarifas en una etapa posterior.'
  }),
  tips:Object.freeze({
   power_outlet:'Coloca el enchufe sobre una pared energizada. Admite dos conexiones por defecto.',
   power_strip:'El multiconector amplía tomas, no la capacidad eléctrica de la pared.',
   phone_charger:'El celular se retira del inventario y su menú desaparece durante la carga.',
   water_main:'Distribuye suministro por los tramos conectados de pared.',
   water_valve:'Cierra o abre el flujo de la tubería asociada.',
   water_outlet:'Permite conectar muebles que requieren agua.',
   drain_outlet:'Conexión de drenaje, independiente de la entrada de agua.',
   router:'Requiere electricidad. El Wi-Fi llega a los dispositivos con contraseña.',
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
