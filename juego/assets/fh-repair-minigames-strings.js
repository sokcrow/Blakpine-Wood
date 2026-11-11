/* Textos de los minijuegos de mantenimiento. Todo texto visible vive aquí. */
(function(root){'use strict';
 root.FH_REPAIR_MINI_TEXT=Object.freeze({
  eyebrow:'MANTENIMIENTO / DIAGNÓSTICO',
  damage:n=>'DESGASTE DETECTADO: '+Math.round(n)+'%',
  close:'CERRAR',cancel:'CANCELAR',finish:'TERMINAR',
  progress:(done,total)=>'PROGRESO '+done+' / '+total,
  repaired:'REPARACIÓN COMPLETADA',
  ready:'Componente reparado. El sistema puede volver a comprobarse.',
  aborted:'Se canceló la intervención. El daño permanece.',
  notDamaged:'El equipo no presenta daños reparables.',
  repairFailed:'El equipo cambió de estado. No se aplicó la reparación.',
  wrong:'Conexión incorrecta. Comprueba el orden e inténtalo otra vez.',
  correct:'Contacto confirmado.',
  selectWire:'Selecciona primero un cable de la columna izquierda.',
  wirePending:'Ahora selecciona su conexión en la derecha.',
  aligned:'Ajuste registrado.',
  title:'REPARACIÓN',
  kinds:Object.freeze({
   breaker:Object.freeze({
    title:'PANEL DE BREAKERS',
    hint:'Restablece los interruptores en el orden del diagrama. Un error reinicia la secuencia.',
    names:['TOMAS','CONTROL','LUCES','SERVICIOS'],
    order:'ORDEN DE CIERRE',
    progressTotal:4
   }),
   generator:Object.freeze({
    title:'CALIBRACIÓN DEL GENERADOR',
    hint:'Gira cada regulador hasta igualar su cifra objetivo.',
    names:['FRECUENCIA','PRESIÓN','VOLTAJE'],
    target:'OBJETIVO',current:'LECTURA',less:'DISMINUIR',more:'AUMENTAR',
    progressTotal:3
   }),
   ats:Object.freeze({
    title:'REVISIÓN DEL ATS',
    hint:'Ejecuta la secuencia indicada para restablecer el control de transferencia.',
    names:['AISLAR','REVISAR','TRANSFERIR','CONECTAR'],
    order:'SECUENCIA DE CONTROL',progressTotal:4
   }),
   electronics:Object.freeze({
    title:'PLACA ELECTRÓNICA',
    hint:'Rota los cuatro contactos hasta que cada pista coincida con la referencia.',
    names:['A1','A2','B1','B2'],
    target:'REFERENCIA',current:'ORIENTACIÓN',turn:'ROTAR CONTACTO',
    progressTotal:4
   }),
   wires:Object.freeze({
    title:'RECONEXIÓN DE CABLES',
    hint:'Selecciona un terminal a la izquierda y su pareja a la derecha. Los símbolos identifican cada cable.',
    left:'CABLEADO',right:'TERMINALES',symbols:['◆','■','●','▲'],
    names:['ÁMBAR','AZUL','VERDE','ROJO'],
    progressTotal:4
   })
  })
 });
})(typeof window!=='undefined'?window:globalThis);
