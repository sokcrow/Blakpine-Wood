/* Blakpine Wood — habilidades y tiradas porcentuales. Sin dados de daño. */
(function(global){
 'use strict';
 const GROUPS=Object.freeze({
  FOR:Object.freeze(['atletismo','fuerzaBruta','forcejeo','cargaFisica']),
  AGI:Object.freeze(['sigilo','acrobacias','manipulacionFina','cerrajeria','conduccion']),
  VOL:Object.freeze(['temple','concentracion','autocontrol','resistenciaMental']),
  PRU:Object.freeze(['percepcion','rastreo','orientacion','evaluacionPeligros']),
  ING:Object.freeze(['investigacion','informatica','electronica','mecanica','medicina']),
  ARC:Object.freeze(['sensibilidadArcana','interpretacionArcana','canalizacion','proteccionArcana','rituales']),
  SOC:Object.freeze(['persuasion','engano','intimidacion','empatia','interpretacionSocial'])
 });
 const IDS=Object.freeze(Object.values(GROUPS).flat());
 // Valor inicial ajustable por tirada; aún no es un balance definitivo.
 const DEFAULT_DIFFICULTY_PENALTY=10;
 const emptyPoints=()=>Object.fromEntries(IDS.map(id=>[id,0]));
 function normalizePoints(raw){
  const points=emptyPoints();
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return points;
  for(const id of IDS){
   const value=Object.hasOwn(raw,id)?raw[id]:0;
   if(Number.isSafeInteger(value)&&value>=0)points[id]=value;
  }
  return points;
 }
 function assertSkill(id){
  if(typeof id!=='string'||!IDS.includes(id))throw Error('Habilidad desconocida.');
 }
 function readPoints(character,id){
  assertSkill(id);
  const value=character?.skills?.[id];
  return Number.isSafeInteger(value)&&value>=0?value:0;
 }
 function setPoints(character,id,points){
  assertSkill(id);
  if(!character||typeof character!=='object'||!Number.isSafeInteger(points)||points<0)
   throw Error('Puntos de habilidad inválidos.');
  character.skills=normalizePoints(character.skills);
  character.skills[id]=points;
  return points;
 }
 const integer=(value,min,max,name)=>{
  if(!Number.isSafeInteger(value)||value<min||value>max)throw Error(name+' inválido.');
  return value;
 };
 function odds(character,id,options={}){
  const points=readPoints(character,id);
  const difficulty=integer(options.difficulty??0,0,100,'Dificultad');
  const advantage=integer(options.advantage??0,0,20,'Ventaja');
  const disadvantage=integer(options.disadvantage??0,0,20,'Desventaja');
  const penalty=options.difficultyPenaltyPerPoint??DEFAULT_DIFFICULTY_PENALTY;
  if(!Number.isFinite(penalty)||penalty<0||penalty>100)
   throw Error('Penalización de dificultad inválida.');
  const coins=Math.max(1,1+advantage-disadvantage);
  const sanityPenaltyPct=global.FHSurvival?.penaltySP?.(character?.resources)||0;
  const headsPercent=Math.min(100,Math.max(0,100+5*points-penalty*difficulty-10*disadvantage-sanityPenaltyPct));
  const heads=headsPercent/100;
  return {
   skill:id,points,difficulty,advantage,disadvantage,sanityPenaltyPct,difficultyPenaltyPerPoint:penalty,
   coinCount:coins,headsPercent,
   successPercent:100*(1-Math.pow(1-heads,coins)),
   criticalSuccessPercent:coins>=2?100*Math.pow(heads,coins):0,
   criticalFailurePercent:coins>=2?100*Math.pow(1-heads,coins):0
  };
 }
 function roll(character,id,options={}){
  const chances=odds(character,id,options);
  const rng=options.rng??Math.random;
  if(typeof rng!=='function')throw Error('Generador de monedas inválido.');
  const coins=[];
  for(let i=0;i<chances.coinCount;i++){
   const value=rng();
   if(!Number.isFinite(value)||value<0||value>=1)throw Error('Valor de moneda inválido.');
   coins.push(value*100<chances.headsPercent?'heads':'tails');
  }
  const allHeads=coins.every(coin=>coin==='heads');
  const allTails=coins.every(coin=>coin==='tails');
  const success=coins.some(coin=>coin==='heads');
  const outcome=coins.length>=2&&allHeads?'critical-success':
   coins.length>=2&&allTails?'critical-failure':success?'success':'failure';
  return {...chances,coins,success,outcome};
 }
 global.FHSkills=Object.freeze({GROUPS,IDS,DEFAULT_DIFFICULTY_PENALTY,emptyPoints,normalizePoints,readPoints,setPoints,odds,roll});
 if(typeof module==='object'&&module.exports)module.exports=global.FHSkills;
})(typeof window!=='undefined'?window:globalThis);
