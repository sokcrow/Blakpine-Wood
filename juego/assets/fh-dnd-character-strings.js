/* Interfaz de creación manual de fichas D&D; todas las etiquetas visibles en español. */
(function(root){
 'use strict';
 root.FH_DND_CHARACTER_TEXT=Object.freeze({
  title:'Personajes de D&D',intro:'Elige una ficha guardada o crea una nueva. Cada personaje tiene sus propias características y guardado. No se asignan clases automáticamente.',
  chooseClass:'Elige tu clase', identity:'Tu personaje', advanced:'Personalizar ficha de campaña',
  changeClass:'Cambiar clase',create:'Crear otro personaje',enter:'Entrar en partida',
  classThemes:{barbarian:'Furia y resistencia',bard:'Música e inspiración',cleric:'Fe y protección',druid:'Naturaleza y transformación',fighter:'Armas y disciplina',monk:'Agilidad y concentración',paladin:'Juramento y defensa',ranger:'Rastreo y supervivencia',rogue:'Sigilo y precisión',sorcerer:'Magia innata',warlock:'Pactos y secretos',wizard:'Estudio y conjuros'},
  choose:'Personaje guardado',newCharacter:'Crear personaje nuevo',name:'Nombre',
  classId:'Clase',classPlaceholder:'Selecciona una clase',level:'Nivel',
  background:'Trasfondo',species:'Especie',abilities:'Seis características',
  hitPoints:'PG actuales',maxHitPoints:'PG máximos',armor:'Clase de armadura (CA)',
  speed:'Velocidad (pies)',hitDie:'Caras del dado de golpe',
  hitDiceTotal:'Dados de golpe totales',hitDiceAvailable:'Dados de golpe disponibles',
  saves:'Competencia en salvaciones',skills:'Competencia en habilidades',
  attacks:'Ataques',attackAdd:'Añadir ataque',attackRemove:'Quitar ataque',
  attackFields:Object.freeze({name:'Nombre',ability:'Característica',damageCount:'Dados',
   damageDie:'Caras',damageType:'Tipo de daño',rangeFt:'Alcance (ft)',proficient:'Competente'}),
  technical:'Datos técnicos de campaña (JSON)',attackJson:'Ataques (JSON avanzado)',
  features:'Rasgos y recursos de clase (JSON)',
  spells:'Lanzamiento de conjuros (JSON o null)',
  manual:'Ficha manual: elige valores según las reglas de tu campaña. Seleccionar una clase no aplica automáticamente sus rasgos, conjuros ni competencias.',
  cancel:'Cancelar',play:'Guardar ficha e iniciar partida',
  invalid:'Revisa los valores y los campos JSON. La ficha debe ser válida para D&D.',
  storageError:'No se pudo guardar la ficha en este navegador.',
  noStorage:'No se puede acceder al almacenamiento de personajes D&D.',
  strength:'Fuerza',dexterity:'Destreza',constitution:'Constitución',
  intelligence:'Inteligencia',wisdom:'Sabiduría',charisma:'Carisma',
  unknown:'Ficha sin nombre',selectName:'Seleccionar personaje',
  abilitiesMap:Object.freeze({str:'FUE',dex:'DES',con:'CON',int:'INT',wis:'SAB',cha:'CAR'}),
  abilityIcons:Object.freeze({str:'⚔',dex:'➶',con:'♥',int:'✦',wis:'◉',cha:'♛'}),
  skillsMap:Object.freeze({
   acrobatics:'Acrobacias',animalHandling:'Trato con animales',arcana:'Arcanos',
   athletics:'Atletismo',deception:'Engaño',history:'Historia',insight:'Perspicacia',
   intimidation:'Intimidación',investigation:'Investigación',medicine:'Medicina',
   nature:'Naturaleza',perception:'Percepción',performance:'Interpretación',
   persuasion:'Persuasión',religion:'Religión',sleightOfHand:'Juego de manos',
   stealth:'Sigilo',survival:'Supervivencia'
  }),
  classes:Object.freeze({
   barbarian:'Bárbaro',bard:'Bardo',cleric:'Clérigo',druid:'Druida',
   fighter:'Guerrero',monk:'Monje',paladin:'Paladín',ranger:'Explorador',
   rogue:'Pícaro',sorcerer:'Hechicero',warlock:'Brujo',wizard:'Mago'
  })
 });
})(typeof window!=='undefined'?window:globalThis);
