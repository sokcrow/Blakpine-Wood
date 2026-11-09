/* Forest Horror — etiquetas de iluminación en el editor. */
window.FH_LIGHT_TEXT=Object.freeze({
 breakerIdentity:(name,id)=>name+' [ID: '+id+']',
 circuitIdentity:(name,id)=>name+' ['+id+']',
 chooseBreaker:'— Elige breaker y circuito —',
 noBreaker:'Coloca un breaker para crear circuitos',
 connectionCounts:n=>n.rooms+' habitaciones · '+n.lamps+' lámparas · '+n.switches+' interruptores',
 connectionSummary:(breaker,circuit,n)=>breaker+' · '+circuit+': '+n.rooms+' habitaciones · '+n.lamps+' lámparas · '+n.switches+' interruptores',
 connectionTitle:'Conexiones por breaker',
 connectionIntro:'Cada grupo corresponde a un breaker y contiene sus circuitos. El nombre y el ID identifican la conexión aunque se repita el color.',
 backToMap:'Volver al plano',
 noBreakers:'Aún no hay breakers en este piso. Coloca uno en la capa Luz.',
 assignedRooms:names=>'Habitaciones: '+names.join(', '),
 unassignedConnections:n=>'Sin breaker asignado: '+n+' elementos. Selecciona el circuito de un breaker y usa «Conectar zona» para vincularlos.',
 noCircuit:'Sin circuito (main)',
 missingBreaker:zone=>zone+' (sin breaker)',
 autoReady:n=>n+' lámpara(s) automáticas convertidas en objetos editables.',
 autoEmpty:'Las lámparas de esta planta ahora se gestionan desde el mapa.',
 outside:'Los focos de techo deben quedar dentro de una habitación. Usa apliques para exteriores.',
 wall:'Las lámparas de pared necesitan una pared cercana para montarse.',
 brightRange:'Luz brillante (pies)',dimRange:'Luz tenue adicional (pies)',angle:'Cono (grados)',kind:'Tipo de luminaria',
 note:'La luz brillante mantiene intensidad completa. La luz tenue es una franja adicional de caída gradual; fuera de la suma vuelve la oscuridad. Las paredes y puertas opacas bloquean la luz; las ventanas dejan pasar sus rayos.',
 presets:[['bulb','Foco de techo'],['strip','Tubo largo de techo'],['panel','Panel de techo'],['wall_sconce','Aplique de pared'],['wall_flood','Reflector de pared']]
});

