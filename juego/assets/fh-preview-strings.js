/* Forest Horror — textos del arranque de la prueba 3D. */
window.FH_PREVIEW_TEXT=Object.freeze({
 preparing:'Preparando tu mapa actual en 3D…',
 loading:'Cargando el motor 3D y tu mapa…',
 missing:'Faltan archivos del motor 3D. Recarga la página.',
 timeout:'El motor 3D no respondió. Regresa al editor y vuelve a intentarlo.',
 errorPrefix:'No se pudo iniciar el juego 3D: ',
 diagnosticTitle:'Diagnóstico 3D',
 diagnosticOptions:'Opciones de diagnóstico 3D',
 showDiagnostic:'Mostrar diagnóstico durante el juego',
 diagnosticAutomatic:'Los fallos se mostrarán automáticamente aunque esté desactivado.',
 copyDiagnostic:'Copiar informe',
 diagnosticCopied:'Informe copiado',
 diagnosticSelect:'Selecciona el informe para copiarlo',
 diagnosticBack:'← Volver al editor',
 resourceFailure:'No se pudo cargar el recurso',
 contextLost:'Se perdió el contexto WebGL durante el juego.',
 firstFrame:'Primer fotograma completado',
 engineReady:'Mapa 3D listo · E: usar · Q: mirilla.',
 missingModule:'Módulo no registrado',
 snapshotFailure:'No se pudo consultar el estado del motor para el informe.',
 diagnosticState:s=>{
  const n=v=>Number.isFinite(v)?Math.round(v*100)/100:'—',yes=v=>v===true?'sí':v===false?'no':'—';
  return 'Estado actual · Piso '+n(s.floor)+' · X '+n(s.x)+' · Z '+n(s.z)+' · FPS '+n(s.fps)+
   '\nPostura: '+(s.posture||'—')+' · Posición transitable: '+yes(s.walkable)+' · Oculto: '+yes(s.hidden)+
   '\nMenú abierto: '+yes(s.menu)+' · Celular abierto: '+yes(s.phone)+' · Diálogo abierto: '+yes(s.dialogue)+' · Crítico: '+(s.critical||'—')+
   '\nRender: '+n(s.calls)+' llamadas · Geometrías: '+n(s.geometries)+' · Texturas: '+n(s.textures)+' · Canvas: '+n(s.width)+' × '+n(s.height);
 },
 diagnosticWarnings:'Avisos',
 diagnosticPartial:'Diagnóstico parcial: la integración del lector no coincide con este motor.',
 diagnosticKinds:Object.freeze({stage:'Etapa',fatal:'ERROR',resource:'Recurso fallido','resource-start':'Cargando recurso'}),
 frameStopped:'El motor dejó de completar fotogramas durante más de 8 segundos.',
 diagnosticStages:Object.freeze({prepare:'Preparar motor',adapter:'Adaptadores',resources:'Cargar scripts y recursos',
  validation:'Validar mapa',webgl:'Crear WebGL',world:'Construir escenario',models:'Modelos y personaje',
  firstFrame:'Esperar primer fotograma',frame:'Actualizar fotograma',lighting:'Iluminación',services:'Servicios y teléfono',survival:'Supervivencia',
  movement:'Movimiento',camera:'Cámara',visibility:'Visibilidad y HUD',render:'Renderizar escena',playing:'Jugando'}),
 landscapeTitle:'Gameplay solo en horizontal',
 landscapeStart:'Activar horizontal y jugar',
 landscapeCancel:'Volver al editor',
 landscapeBefore:'Para iniciar la prueba 3D desde el celular, pulsa el botón. No se cargará en vertical.',
 landscapeReady:'La pantalla está en horizontal. Pulsa el botón para iniciar el juego.',
 landscapeRotate:'Gira el celular a horizontal. La prueba 3D comenzará cuando la pantalla esté apaisada.',
 unknown:'Error desconocido.'
});
