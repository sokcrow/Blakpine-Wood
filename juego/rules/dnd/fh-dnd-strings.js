/* Textos visibles de combate DnD; sin mensajes dispersos en lógica. */
(function(root){
 'use strict';
 root.FH_DND_TEXT=Object.freeze({
  title:'Combate DnD · Prototipo',attack:'Atacar (F)',empty:'Acércate a un Training Dummy para probar el ataque.',
  hint:'F para probar un ataque D20 · Debes tener contacto y visión del blanco.',
  status:(hp,max)=>'PG '+hp+'/'+max,
  sheet:s=>[
   'PE '+s.pe+'/'+s.peMax,
   'Impacto: d'+s.hitDie+(s.attackBonus>=0?' + ':' − ')+Math.abs(s.attackBonus),
   'Daño: d'+s.damageDie+(s.damageBonus>=0?' + ':' − ')+Math.abs(s.damageBonus),
   'Defensa '+s.defense+' · Resistencia '+s.resistance,
   'Ficha de combate DnD (prueba)'
  ].join('\\n'),
   selectTarget:'Seleccionar blanco de entrenamiento',
   target:id=>'Training Dummy: '+id,
  hit:(roll,total,damage)=>'D20 '+roll+' (total '+total+'): golpe acertado. Daño '+damage+'.',
  miss:(roll,total)=>'D20 '+roll+' (total '+total+'): ataque fallido.',
  defeated:'Criatura derrotada.',lost:'Has caído en combate.',
  unavailable:'No puedes atacar ahora.',
  unknown:'No se pudo resolver el ataque.'
 });
})(typeof globalThis!=='undefined'?globalThis:this);
