/* Blakpine-Wood: textos de infraestructura; las tarifas se incorporarán aparte. */
(function(root){
 'use strict';
 root.FH_SERVICES_TEXT=Object.freeze({
  powerSource:Object.freeze({
   title:'Origen de electricidad',primary:'Fuente principal',backup:'Generador de respaldo',none:'Sin fuente',utility:'Red exterior explícita',legacy:'Red principal heredada (mapa antiguo)',
   missing:'Fuente no disponible',on:'Con energía',off:'Sin energía',floor:'Piso destino del circuito',range:'Cable de este circuito (pies)',feedRange:'Cable de fuente a panel (pies)',priority:'Prioridad de respaldo (mayor primero)',
   hint:'El breaker distribuye energía. Asigna una fuente y un piso destino por circuito. Borrar el generador no conecta otra fuente. El tramo vertical consume cable.',
   origin:(source,floor)=>'Origen: '+source+' · '+floor,
   route:(floor,vertical,range)=>'Destino: '+floor+' · Vertical: '+vertical.toFixed(1)+' pies · Cable disponible: '+range.toFixed(1)+' pies',
   feed:feet=>'Fuente → panel: '+feet.toFixed(1)+' pies',
   vertical:floor=>'Conexión vertical → '+floor
  }),
  generator:Object.freeze({
   picker:'Generadores y respaldo',feet:'pies',estimate:h=>'Autonomía inicial estimada: '+h.toFixed(2)+' h',close:'Cerrar',chooseModel:'Modelo del equipo',loading:'Cargando modelos…',loadError:'No se pudo cargar el catálogo de generadores.',wallRequired:'El ATS debe colocarse sobre una pared estructural.',
   ats:'Tablero de transferencia automática',tank:'Tanque de combustible',noLink:'Sin asignar',atsLink:'ATS opcional',tankLink:'Tanque de combustible',fuelRate:'Consumo de combustible (litros/hora)',fuelCapacity:'Capacidad del tanque (litros)',initialFuel:'Combustible inicial (litros)',fuelNote:'Con tanque conectado, la autonomía se calcula con litros restantes ÷ litros/hora. Sin tanque se conserva la reserva en horas.',
   manual:'Activar transferencia manual',atsNote:'Un intento automático por apagón, con 10 % de fallo. Si falla, activa la transferencia manual desde el tablero. Asígnalo desde el inspector del generador de emergencia.',
   atsStatus:s=>!s?.connected?'ATS sin generador asignado':s.damaged?'ATS dañado':!s.outage?'ATS: red principal disponible':s.mode==='failed'?'ATS: fallo automático; activa la transferencia manual':s.mode==='manual'?'ATS: transferencia manual activada':'ATS: transferencia automática activada',
   tankStatus:s=>!s?'Tanque no disponible':s.liters.toFixed(2)+' / '+s.capacityLiters.toFixed(2)+' L · '+(s.connected?s.remainingHours.toFixed(2)+' h disponibles':'Sin generador asignado'),
   normal:'Generador normal',emergency:'Generador de emergencia',kind:'Tipo de generador',
   enabled:'Encendido / respaldo automático habilitado',autonomy:'Autonomía inicial (horas del juego)',
   capacity:'Capacidad (vatios)',targets:'Destinos y prioridades',inspect:'Ver reserva y estado',wholeCircuit:'Circuito completo',
   priority:'Prioridad (mayor primero)',note:'En breakers nuevos, configura la fuente desde el inspector del panel. La lista de destinos de este generador conserva conexiones de paneles antiguos. Los números de prioridad mayores se alimentan primero; cada destino se conecta completo o se desconecta si no cabe. Las conexiones entre pisos usan los IDs del piso, panel y circuito. Un generador normal sustituye la red principal en sus destinos. La reserva no se consume con la partida cerrada. Equipos sin consumo configurado: 200 W al usar generadores.',
   turnOn:'Encender generador',turnOff:'Apagar generador',enable:'Habilitar respaldo automático',disable:'Deshabilitar respaldo automático',
   running:'En funcionamiento',standby:'En espera',off:'Apagado',empty:'Reserva agotada',reserve:'Reserva restante',hours:'h',
   action:(status)=>status.kind==='emergency'?(status.enabled?'Deshabilitar respaldo automático':'Habilitar respaldo automático'):(status.enabled?'Apagar generador':'Encender generador'),
   status:(status)=> (status.remainingHours<=0?'Reserva agotada':status.running?'En funcionamiento':status.enabled?'En espera':'Apagado')+' · Reserva restante: '+status.remainingHours.toFixed(2)+' h · '+Math.round(status.watts)+' W'
  }),
  tabElectric:'⚡ Electricidad',
  catWater:'◉ Agua y drenaje',catData:'⌁ Internet y telefonía',
  labels:Object.freeze({
   generator:'Generador',generator_ats:'Tablero ATS',generator_tank:'Tanque de combustible',power_outlet:'Enchufe doble',power_strip:'Multiconector',phone_charger:'Cargador de celular',
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

