/* Textos del jugador D&D 2024: ninguna cadena de la ficha vive en la lógica. */
(function(root){
 'use strict';
 const ability=Object.freeze({str:'FUE',dex:'DES',con:'CON',int:'INT',wis:'SAB',cha:'CAR'});
 const skills=Object.freeze({
  acrobatics:'Acrobacias',animalHandling:'Trato con animales',arcana:'Arcanos',
  athletics:'Atletismo',deception:'Engaño',history:'Historia',insight:'Perspicacia',
  intimidation:'Intimidación',investigation:'Investigación',medicine:'Medicina',
  nature:'Naturaleza',perception:'Percepción',performance:'Interpretación',
  persuasion:'Persuasión',religion:'Religión',sleightOfHand:'Juego de manos',
  stealth:'Sigilo',survival:'Supervivencia'
 });
 const signed=n=>(n>=0?'+':'')+n;
 root.FH_DND_TEXT=Object.freeze({
  title:'D&D 2024 · Partida',attack:'Atacar (F)',
  empty:'Acércate al blanco de entrenamiento.',
  hint:'D&D 2024: F ataca al blanco; las salvaciones y habilidades utilizan d20 y CD.',
  status:(hp,max)=>'PG '+hp+'/'+max,
  saveName:id=>ability[id]||id,skillName:id=>skills[id]||id,
  sheet:s=>[
   (s.name||'Personaje')+' · '+(root.FH_DND_CHARACTER_TEXT?.classes?.[s.classId]||s.classId)+' · Nivel '+s.level,
   'Trasfondo: '+s.backgroundId,
   'PG '+s.hp+'/'+s.maxHp+' · CA '+s.armorClass+
    ' · Iniciativa '+signed(s.initiative)+' · Velocidad '+s.speedFt+' pies',
   'Competencia '+signed(s.proficiency)+' · Dados de golpe '+
    s.hitDice.available+'/'+s.hitDice.total+'d'+s.hitDice.sides,
   Object.entries(s.abilities).map(([id,v])=>ability[id]+' '+v.score+' ('+signed(v.modifier)+')').join(' · '),
   'Salvaciones: '+Object.entries(s.saves).map(([id,v])=>ability[id]+' '+signed(v)).join(' · '),
   'Habilidades: '+Object.entries(s.skills).map(([id,v])=>skills[id]+' '+signed(v)).join(' · '),
   'Percepción pasiva '+s.passivePerception,
   'Ataques: '+s.attacks.map(a=>a.weaponName+' '+signed(a.attackBonus)+
    ' · '+a.damageCount+'d'+a.damageDie+signed(a.damageBonus)).join(' | '),
   ...(s.features?.secondWind?['Segundo aliento '+s.features.secondWind.current+'/'+s.features.secondWind.max]:[]),
   ...(s.features?.fightingStyle?['Estilo: '+s.features.fightingStyle]:[]),
   s.spellcasting?'Ficha de conjuros configurada':'Sin lanzamiento de conjuros'
  ].join('\n'),
  rollSave:'Lanzar salvación',rollSkill:'Probar habilidad',
  campaignTime:'Tiempo de campaña',abilityTest:'Prueba de característica',
  saveSelect:'Seleccionar salvación',skillSelect:'Seleccionar habilidad',dc:'Dificultad (CD)',
  invalidTest:'Tirada no válida. Comprueba la CD.',
  testResult:(name,r)=>name+': d20 '+r.roll+' '+signed(r.modifier)+' = '+r.total+
    ' contra CD '+r.dc+' · '+(r.success?'Éxito':'Fallo'),
  selectAttack:'Ataque del personaje',
  selectTarget:'Seleccionar blanco de entrenamiento',
  target:id=>'Blanco: '+id,
  hit:(roll,total,damage,critical)=>'D20 '+roll+' (total '+total+'): '+
   (critical?'¡Impacto crítico!':'Impacto.')+' Daño '+damage+'.',
  miss:(roll,total)=>'D20 '+roll+' (total '+total+'): ataque fallido.',
  defeated:'Criatura derrotada.',lost:'Has caído en combate.',
  unavailable:'No puedes atacar ahora.',
  unknown:'No se pudo resolver el ataque.'
 });
})(typeof window!=='undefined'?window:globalThis);
