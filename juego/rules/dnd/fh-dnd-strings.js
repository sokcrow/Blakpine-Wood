/* Textos visibles de combate DnD; sin mensajes dispersos en lógica. */
(function(root){
 'use strict';
 root.FH_DND_TEXT=Object.freeze({
  title:'Combate DnD',attack:'Atacar (F)',empty:'Acércate a una criatura para atacar.',
  hint:'F para atacar · Debes estar junto al objetivo.',
  status:(hp,max,energy,maxEnergy)=>'Vida '+hp+'/'+max+' · Energía '+energy+'/'+maxEnergy,
  hit:(roll,total,damage)=>'D20 '+roll+' (total '+total+'): golpe acertado. Daño '+damage+'.',
  miss:(roll,total)=>'D20 '+roll+' (total '+total+'): ataque fallido.',
  defeated:'Criatura derrotada.',lost:'Has caído en combate.',
  unavailable:'No puedes atacar ahora.',noEnergy:'Energía insuficiente.',
  unknown:'No se pudo resolver el ataque.'
 });
})(typeof globalThis!=='undefined'?globalThis:this);
