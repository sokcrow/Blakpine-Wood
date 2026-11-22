/* D&D 2024 · ficha aislada de Legacy y Moon; referencia: SRD 5.2.1 (CC BY 4.0).
 * https://www.dndbeyond.com/srd · Guerrrero de nivel 1: personaje PILOTO, no creador completo.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHDndSheet=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const ABILITIES=Object.freeze(['str','dex','con','int','wis','cha']);
 const SKILLS=Object.freeze({
  acrobatics:'dex',animalHandling:'wis',arcana:'int',athletics:'str',
  deception:'cha',history:'int',insight:'wis',intimidation:'cha',
  investigation:'int',medicine:'wis',nature:'int',perception:'wis',
  performance:'cha',persuasion:'cha',religion:'int',sleightOfHand:'dex',
  stealth:'dex',survival:'wis'
 });
 const SKILL_NAMES=Object.freeze({
  acrobatics:'Acrobacias',animalHandling:'Trato con animales',arcana:'Arcanos',
  athletics:'Atletismo',deception:'Engaño',history:'Historia',insight:'Perspicacia',
  intimidation:'Intimidación',investigation:'Investigación',medicine:'Medicina',
  nature:'Naturaleza',perception:'Percepción',performance:'Interpretación',
  persuasion:'Persuasión',religion:'Religión',sleightOfHand:'Juego de manos',
  stealth:'Sigilo',survival:'Supervivencia'
 });
 const int=(n,lo,hi)=>Number.isSafeInteger(n)&&n>=lo&&n<=hi;
 const modifier=score=>{if(!int(score,1,30))throw Error('DND_ABILITY_INVALID');return Math.floor((score-10)/2);};
 const proficiency=level=>{if(!int(level,1,20))throw Error('DND_LEVEL_INVALID');return 2+Math.floor((level-1)/4);};
 const profBonus=(sheet,kind,id)=>kind==='save'?sheet.saveProficiencies.includes(id)?proficiency(sheet.level):0:
  kind==='skill'?(sheet.expertise.includes(id)?2:sheet.skillProficiencies.includes(id)?1:0)*proficiency(sheet.level):0;
 function bonus(sheet,kind,id){
  if(!valid(sheet))throw Error('DND_SHEET_INVALID');
  const ability=kind==='skill'?SKILLS[id]:id;
  if(!ABILITIES.includes(ability)||kind==='skill'&&!Object.hasOwn(SKILLS,id)||
   !['skill','save','ability'].includes(kind))throw Error('DND_TEST_INVALID');
  return modifier(sheet.abilities[ability])+(kind==='ability'?0:profBonus(sheet,kind,id));
 }
 function rollD20({advantage=false,disadvantage=false,random=Math.random}={}){
  if(typeof random!=='function')throw Error('DND_RANDOM_INVALID');
  const one=()=>{const v=random();if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>=1)throw Error('DND_RANDOM_INVALID');return Math.floor(v*20)+1;};
  const first=one(),second=advantage!==disadvantage?one():null;
  return {roll:second===null?first:advantage?Math.max(first,second):Math.min(first,second),dice:second===null?[first]:[first,second]};
 }
 function testD20(sheet,kind,id,{dc,advantage=false,disadvantage=false,random=Math.random}={}){
  if(!int(dc,1,100))throw Error('DND_DC_INVALID');
  const {roll,dice}=rollD20({advantage,disadvantage,random});
  const mod=bonus(sheet,kind,id),total=roll+mod;
  // 20/1 naturales automáticos sólo en tiradas de ataque, no en pruebas ni salvaciones.
  return Object.freeze({kind,id,roll,dice,modifier:mod,total,dc,success:total>=dc});
 }
 function createPilot(){
  // Guerrero 1 (matriz estándar + trasfondo Soldado: FUE +2, CON +1).
  // Estilo Defensa con cota de malla: CA 16+1. Sin PE general.
  return {
   kind:'dnd-character-2024-v1',rules:'srd-5.2.1',
   classId:'fighter',level:1,backgroundId:'soldier',speciesId:'human',
   abilities:{str:17,dex:14,con:14,int:8,wis:10,cha:12},
   saveProficiencies:['str','con'],
   skillProficiencies:['athletics','intimidation','insight','perception'],
   expertise:[],tools:['gaming_set'],languages:['common'],
   hp:12,maxHp:12,temporaryHp:0,armorClass:17,speedFt:30,
   hitDice:{sides:10,total:1,available:1},
   attacks:[
    {id:'flail',name:'Mayal',ability:'str',damageCount:1,damageDie:8,damageType:'bludgeoning',rangeFt:5,proficient:true},
    {id:'greatsword',name:'Espadón',ability:'str',damageCount:2,damageDie:6,damageType:'slashing',rangeFt:5,proficient:true},
    {id:'javelin',name:'Jabalina',ability:'str',damageCount:1,damageDie:6,damageType:'piercing',rangeFt:30,longRangeFt:120,proficient:true}
   ],
   activeAttackId:'flail',
   features:{fightingStyle:'defense',originFeat:'savageAttacker',secondWind:{current:2,max:2},weaponMastery:['flail','greatsword','javelin']},
   spellcasting:null, // Únicamente las clases/capacidades con magia poseen espacios de conjuro.
   deathSaves:{successes:0,failures:0},conditions:[],exhaustion:0,
   senses:{darkvisionFt:0},heroicInspiration:false
  };
 }
 function valid(p){
  return p&&p.kind==='dnd-character-2024-v1'&&p.rules==='srd-5.2.1'&&
   typeof p.classId==='string'&&int(p.level,1,20)&&
   p.abilities&&ABILITIES.every(k=>int(p.abilities[k],1,30))&&
   ['saveProficiencies','skillProficiencies','expertise'].every(k=>Array.isArray(p[k]))&&
   p.saveProficiencies.every(k=>ABILITIES.includes(k))&&
   p.skillProficiencies.every(k=>Object.hasOwn(SKILLS,k))&&
   p.expertise.every(k=>Object.hasOwn(SKILLS,k))&&
   int(p.hp,0,100000)&&int(p.maxHp,1,100000)&&p.hp<=p.maxHp&&
   int(p.temporaryHp,0,100000)&&int(p.armorClass,1,100)&&
   int(p.speedFt,0,1000)&&Array.isArray(p.attacks)&&
   p.attacks.length>0&&p.attacks.every(a=>typeof a.id==='string'&&
    ABILITIES.includes(a.ability)&&int(a.damageCount,1,20)&&int(a.damageDie,2,100)&&
    typeof a.damageType==='string'&&int(a.rangeFt,1,1000))&&
   p.attacks.some(a=>a.id===p.activeAttackId)&&
   p.hitDice&&int(p.hitDice.sides,2,100)&&int(p.hitDice.total,1,20)&&
   int(p.hitDice.available,0,p.hitDice.total)&&
   p.deathSaves&&int(p.deathSaves.successes,0,3)&&int(p.deathSaves.failures,0,3)&&
   Array.isArray(p.conditions)&&int(p.exhaustion,0,6)&&
   (p.spellcasting===null||typeof p.spellcasting==='object');
 }
 function attack(sheet,id=sheet.activeAttackId){
  if(!valid(sheet))throw Error('DND_SHEET_INVALID');
  const weapon=sheet.attacks.find(x=>x.id===id);
  if(!weapon)throw Error('DND_WEAPON_UNKNOWN');
  const m=modifier(sheet.abilities[weapon.ability]);
  return Object.freeze({id,weaponName:weapon.name,hitDie:20,
   attackBonus:m+(weapon.proficient?proficiency(sheet.level):0),
   damageBonus:m,damageCount:weapon.damageCount,damageDie:weapon.damageDie,
   damageType:weapon.damageType,rangeFt:weapon.rangeFt,longRangeFt:weapon.longRangeFt||null});
 }
 function overview(sheet){
  if(!valid(sheet))throw Error('DND_SHEET_INVALID');
  return Object.freeze({classId:sheet.classId,level:sheet.level,backgroundId:sheet.backgroundId,
   abilities:Object.fromEntries(ABILITIES.map(id=>[id,{score:sheet.abilities[id],modifier:modifier(sheet.abilities[id])}])),
   proficiency:proficiency(sheet.level),armorClass:sheet.armorClass,
   initiative:modifier(sheet.abilities.dex),speedFt:sheet.speedFt,
   hp:sheet.hp,maxHp:sheet.maxHp,temporaryHp:sheet.temporaryHp,
   hitDice:{...sheet.hitDice},
   saves:Object.fromEntries(ABILITIES.map(id=>[id,bonus(sheet,'save',id)])),
   skills:Object.fromEntries(Object.keys(SKILLS).map(id=>[id,bonus(sheet,'skill',id)])),
   passivePerception:10+bonus(sheet,'skill','perception'),
   attacks:sheet.attacks.map(w=>attack(sheet,w.id)),
   features:sheet.features,spellcasting:sheet.spellcasting});
 }
 return Object.freeze({ABILITIES,SKILLS,SKILL_NAMES,modifier,proficiency,bonus,rollD20,testD20,
  createPilot,valid,attack,overview});
});
