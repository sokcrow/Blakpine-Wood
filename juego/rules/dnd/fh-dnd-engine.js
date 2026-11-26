/* DnD 2024: ficha, pruebas d20 y ataques al blanco de entrenamiento. */
(function(root,factory){
 'use strict';
 const coordinator=typeof module==='object'&&module.exports
  ?require('../../core/fh-session-coordinator.js'):root.FHSessionCoordinator;
 const combat=typeof module==='object'&&module.exports
  ?require('./fh-dnd-combat.js'):root.FHDndCombat;
 const sheet=typeof module==='object'&&module.exports
  ?require('./fh-dnd-sheet.js'):root.FHDndSheet;
 const api=factory(coordinator,combat,sheet);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHDndEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(coordinator,combat,sheet){
 'use strict';
 // La ficha activa DnD pertenece al reglamento, nunca a recursos/scores Legacy.
 function readStats(player){return sheet.overview(player);}
 function create({targetPort,gameState,identity,sessionId,readPlayer,readMinute,
  save,notice,setStatusView,document:doc=typeof document!=='undefined'?document:null,
  random=Math.random,time=null}={}){
  if(!targetPort||typeof targetPort.read!=='function'||
   typeof targetPort.list!=='function'||typeof targetPort.canAttack!=='function'||
   typeof targetPort.receiveHit!=='function'||!gameState||
   typeof readPlayer!=='function'||typeof readMinute!=='function'||
   typeof save!=='function'||typeof notice!=='function'||
   typeof identity?.characterId!=='string'||identity.rulesetId!=='dnd'||
   typeof sessionId!=='string'||!sessionId||!coordinator?.create)
   throw Error('DND_ENGINE_INVALID');
  if(!gameState.dnd)gameState.dnd=combat.initialState();
  if(!combat.validState(gameState.dnd))throw Error('DND_STATE_INVALID');
  const state=gameState.dnd,playerId=identity.characterId;
  let closed=false,hud=null,clockHud=null,sequence=0;
  function player(){
   const value=readPlayer()||{};
   return {...value,inactive:state.player.hp===0||value.inactive===true};
  }
  function context(){
   return {sessionId,playerId,rulesetId:'dnd',revision:state.revision,minute:readMinute(),
    player:player(),state};
  }
  function world(intent){
   if(intent.actor.kind!=='player'||intent.target.kind!=='training_dummy')return null;
   const target=targetPort.read(intent.target.id);
   if(!target)return null;
   // Sólo blanco indestructible de entrenamiento; usa CA 10 para las tiradas.
   return {actor:state.player,target:{type:'training_dummy',hp:1,maxHp:1,
    armorClass:combat.defaults.trainingAc,resistances:[],vulnerabilities:[],immunities:[]}};
  }
  // Presentación D&D separada del cálculo de hoja: sólo trabaja con readStats().
  function renderDndSheet(host,stats){
   const T=globalThis.FH_DND_TEXT||{},U=T.ui||{};
   const el=(tag,cls,txt)=>{
    const node=doc.createElement(tag);if(cls)node.className=cls;
    if(txt!==undefined)node.textContent=String(txt);return node;
   };
   const image=(folder,id,size,className)=>{
    const img=el('img',className);img.alt='';img.loading='lazy';img.decoding='async';
    img.setAttribute('width',String(size));img.setAttribute('height',String(size));
    img.src=new URL('./juego/assets/dnd-icons/'+folder+id+'.png',doc.baseURI).href;
    return img;
   };
   const signed=n=>(n>=0?'+':'')+n;
   const card=(icon,name,value,small)=>{
    const node=el('div','dnd-stat-card');
    const pict=icon.startsWith('stat:')?
     image('',icon.slice(5),32,'dnd-stat-icon dnd-stat-icon-image'):el('span','dnd-stat-icon',icon);
    node.append(pict,el('span','dnd-stat-label',name),
     el('strong','dnd-stat-value',value));
    if(small!==undefined)node.append(el('small','dnd-stat-detail',small));
    return node;
   };
   const header=el('header','dnd-sheet-header');
   header.append(el('strong','dnd-sheet-name',stats.name||U.character),el('span','dnd-sheet-origin',
    (globalThis.FH_DND_CHARACTER_TEXT?.classes?.[stats.classId]||stats.classId)+' · '+U.level+' '+stats.level));
   const vital=el('div','dnd-sheet-vitals');
   vital.append(card('♥',U.hp,stats.hp+'/'+stats.maxHp),
    card('⬡',U.ac,stats.armorClass),
    card('➤',U.speed,stats.speedFt+' '+U.feet),
    card('✦',U.proficiency,signed(stats.proficiency)));
   const attrs=el('div','dnd-sheet-abilities');
   for(const [id,entry]of Object.entries(stats.abilities)){
    const attribute=el('div','dnd-stat-card dnd-ability-card');
    attribute.append(image('',id,32,'dnd-stat-icon dnd-stat-icon-image'),
     el('span','dnd-stat-label',T.saveName?.(id)||id),
     el('strong','dnd-stat-value',signed(entry.modifier)),
     el('small','dnd-modifier-label',U.modifier),
     el('small','dnd-stat-detail',U.score+' '+entry.score));
    attrs.append(attribute);
   }
   const group=(title,values,format,kind)=>{
    const details=el('details','dnd-sheet-details');
    const summary=el('summary','',title);
    const grid=el('div','dnd-sheet-detail-grid');
    for(const [id,value] of Object.entries(values)){
     const row=el('div','dnd-sheet-detail-line');
     // El reglamento usa camelCase; los archivos originales usan snake_case.
     const filename=id.replace(/[A-Z]/g,c=>'_'+c.toLowerCase());
     row.append(image(kind==='skill'?'skills/':'',filename,24,'dnd-detail-icon'),
      el('span','',format(id)),el('strong','',signed(value)));grid.append(row);
    }
    details.append(summary,grid);return details;
   };
   const details=el('div','dnd-sheet-breakdown');
   details.append(group(U.saves,stats.saves,id=>T.saveName?.(id)||id,'save'),
    group(U.skills,stats.skills,id=>T.skillName?.(id)||id,'skill'));
   const attacks=el('div','dnd-sheet-attacks');
   attacks.append(el('strong','dnd-group-title',U.attacks));
   for(const attack of stats.attacks){
    const row=el('div','dnd-attack-row'),weapon=el('div','dnd-weapon'),bonus=el('div','dnd-attack-bonus');
    weapon.append(el('strong','',attack.weaponName),el('small','',U.damage+' '+
     attack.damageCount+'d'+attack.damageDie+signed(attack.damageBonus)));
    bonus.append(el('span','',U.attackBonus),el('strong','',signed(attack.attackBonus)));
    row.append(el('span','dnd-stat-icon','⚔'),weapon,bonus);attacks.append(row);
   }
   const open=Array.from(host.querySelectorAll('details'),node=>node.open);
   host.replaceChildren(header,vital,el('h5','dnd-group-title',U.abilities),attrs,
    details,attacks);
   host.querySelectorAll('details').forEach((node,index)=>{node.open=!!open[index]});
  }
  function updateHud(){
   if(!hud)return;
   clockHud?.update();
   const t=globalThis.FH_DND_TEXT;
   hud.status.textContent=t?.status(state.player.hp,state.player.maxHp)||'';
   const overview=readStats(state.player),statsKey=JSON.stringify(overview);
   if(statsKey!==hud.statsKey){renderDndSheet(hud.stats,overview);hud.statsKey=statsKey;}
   const targets=targetPort.list(),key=targets.map(value=>value.id).join('\u0000');
   if(key!==hud.targetsKey){
    const previous=hud.select.value;
    const options=targets.map(value=>{
     const item=doc.createElement('option');
     item.value=value.id;item.textContent=t?.target?.(value.id)||value.id;
     return item;
    });
    hud.select.replaceChildren(...options);
    if(targets.some(value=>value.id===previous))hud.select.value=previous;
    hud.targetsKey=key;
   }
   hud.select.disabled=closed||targets.length===0;
   const weapons=state.player.attacks||[],weaponKey=weapons.map(a=>a.id).join('\u0000');
   if(weaponKey!==hud.weaponKey){
    const options=weapons.map(attack=>{
     const item=doc.createElement('option');
     item.value=attack.id;item.textContent=attack.name||attack.id;return item;
    });
    hud.weapon.replaceChildren(...options);hud.weaponKey=weaponKey;
   }
   hud.weapon.value=state.player.activeAttackId;
   hud.weapon.disabled=closed||weapons.length<=1;
   hud.button.disabled=closed||state.player.hp===0||targets.length===0;
  }
  function show(result){
   if(closed)return;
   const t=globalThis.FH_DND_TEXT;
   const message=result.hit?t?.hit(result.roll,result.total,result.damage,result.critical):t?.miss(result.roll,result.total);
   if(message)notice(message,2400);
   updateHud();
  }
  function apply(result,intent){
   if(closed||intent.actor.kind!=='player'||intent.target.kind!=='training_dummy'||
    result.targetId!==intent.target.id||result.defeated!==false)
    throw Error('DND_APPLY_INVALID');
   // El puerto es el único escritor del Dummy; nunca descontar HP ni invocar defeat().
   targetPort.receiveHit(intent.target.id,result);
   state.revision++;
   time?.action();
   try{save();}catch(error){
    // La acción ya fue aplicada: nunca reintentar por fallo de persistencia.
    console.error('[DnD] No se pudo guardar el combate:',error);
   }
   show(result);
   return null;
  }
  const session=coordinator.create().bindDndCombat({sessionId,playerId,rulesAdapter:combat,
   readContext:context,readWorld:world,apply,
   roll:sides=>combat.rollDie(sides,random)});
  function playerAttack(targetId){
   if(closed)return null;
   const p=player(),t=globalThis.FH_DND_TEXT;
   if(p.inactive||p.sleeping||p.inElevator||state.player.hp===0){
    notice(t?.unavailable||'',1500);return null;
   }
   const candidate=targetId?[targetPort.read(targetId)].filter(Boolean):targetPort.list(p);
   const target=candidate.find(value=>targetPort.canAttack(value.id,p));
   if(!target){notice(t?.empty||'',1500);return null;}
   const targetIdChosen=target.id;
   const intent={sessionId,rulesetId:'dnd',actionId:sessionId+':player:'+(++sequence),
    revision:state.revision,action:'attack',actor:{kind:'player',id:playerId},
    target:{kind:'training_dummy',id:targetIdChosen}};
   try{return session.requestAttack(intent,{
    authorize:()=>!closed&&state.player.hp>0&&targetPort.canAttack(targetIdChosen,player()),
    execute:()=>null
   });}catch(error){notice(t?.unknown||'',1500);return null;}
  }
  // Estas tiradas usan el mismo reglamento que ataques y no consumen PE.
  function rollTest(kind,id,dc=12,options={}){
   if(closed||!sheet.valid(state.player))return null;
   try{
    const result=sheet.testD20(state.player,kind,id,{dc,random,...options});
    const label=kind==='save'?(globalThis.FH_DND_TEXT?.saveName?.(id)||id):
     (globalThis.FH_DND_TEXT?.skillName?.(id)||id);
    notice(globalThis.FH_DND_TEXT?.testResult?.(label,result)||'',2700);
    return result;
   }catch(error){notice(globalThis.FH_DND_TEXT?.invalidTest||'',1500);return null;}
  }
  function onKey(event){
   if(event.key?.toLowerCase()!=='f'||event.repeat||event.altKey||event.ctrlKey||
    event.metaKey||/^(input|textarea|select)$/i.test(event.target?.tagName||''))return;
   if(event.target?.isContentEditable)return;
   event.preventDefault();playerAttack(hud?.select.value||undefined);
  }
  if(doc?.body&&typeof doc.createElement==='function'){
   const box=doc.createElement('section'),title=doc.createElement('h4'),
    status=doc.createElement('span'),stats=doc.createElement('div'),select=doc.createElement('select'),
    weapon=doc.createElement('select'),button=doc.createElement('button'),help=doc.createElement('small'),
    dc=doc.createElement('input'),saveSelect=doc.createElement('select'),
    skillSelect=doc.createElement('select'),saveButton=doc.createElement('button'),
    skillButton=doc.createElement('button');
   const t=globalThis.FH_DND_TEXT||{},U=t.ui||{};
   box.setAttribute('aria-label',t.title||'Combate DnD');
   box.className='fh-dnd-status';
   title.className='dnd-sheet-kicker';
   status.className='dnd-sr-only';
   stats.className='fh-dnd-stats';
   title.textContent=t.title||'Combate DnD';button.type='button';button.textContent=t.attack||'Atacar';
   help.textContent=t.hint||'';select.setAttribute('aria-label',t.selectTarget||'Seleccionar blanco');
   weapon.setAttribute('aria-label',t.selectAttack||'Ataque o arma DnD');
   dc.type='number';dc.min='1';dc.max='100';dc.value='12';
   dc.setAttribute('aria-label',t.dc||'Dificultad (CD)');
   saveSelect.setAttribute('aria-label',t.saveSelect||'Salvación');
   skillSelect.setAttribute('aria-label',t.skillSelect||'Habilidad');
   for(const ability of sheet.ABILITIES){
    const option=doc.createElement('option');
    option.value=ability;option.textContent=t.saveName?.(ability)||ability;
    saveSelect.append(option);
   }
   for(const skill of Object.keys(sheet.SKILLS)){
    const option=doc.createElement('option');
    option.value=skill;option.textContent=t.skillName?.(skill)||skill;
    skillSelect.append(option);
   }
   saveSelect.value='dex';skillSelect.value='perception';
   saveButton.type='button';saveButton.textContent=t.rollSave||'Tirar salvación';
   skillButton.type='button';skillButton.textContent=t.rollSkill||'Tirar habilidad';
   const make=(tag,cls,text)=>{const node=doc.createElement(tag);node.className=cls;
    if(text!==undefined)node.textContent=text;return node;};
   const field=(label,control)=>{const node=make('label','dnd-field');
    node.append(make('span','dnd-field-label',label),control);return node;};
   const layout=make('div','dnd-sheet-layout'),sidebar=make('aside','dnd-sheet-tools');
   const action=make('section','dnd-action-panel'),tests=make('details','dnd-test-panel');
   action.append(make('h5','dnd-group-title',U.combat),field(t.selectAttack,weapon),
    field(t.selectTarget,select),button);
   button.className='dnd-attack-button';
   const saveRow=make('div','dnd-roll-row'),skillRow=make('div','dnd-roll-row');
   saveRow.append(field(t.saveSelect,saveSelect),saveButton);
   skillRow.append(field(t.skillSelect,skillSelect),skillButton);
   tests.append(make('summary','',U.tests),field(t.dc,dc),saveRow,skillRow,help);
   sidebar.append(action,tests);
   clockHud=globalThis.FHDndClock?.mount({clock:time,host:sidebar,document:doc,text:t.time});
   layout.append(stats,sidebar);box.append(title,status,layout);
   weapon.addEventListener('change',()=>{
    if(closed||!state.player.attacks.some(a=>a.id===weapon.value))return;
    state.player.activeAttackId=weapon.value;
    state.revision++;try{save();}catch(error){console.error('[DnD] Guardado de arma:',error);}
    updateHud();
   });
   button.addEventListener('click',()=>playerAttack(select.value||undefined));
   saveButton.addEventListener('click',()=>rollTest('save',saveSelect.value,Number(dc.value)));
   skillButton.addEventListener('click',()=>rollTest('skill',skillSelect.value,Number(dc.value)));
   doc.addEventListener('keydown',onKey);
   hud={box,status,stats,select,weapon,button,targetsKey:null,weaponKey:null};updateHud();
   setStatusView?.(host=>{host.querySelector?.('.fh-section-title')?.remove();host.append(box);});
  }
  return Object.freeze({
   tick(){if(!closed)updateHud();},
   attack:playerAttack,rollSave:(id,dc,options)=>rollTest('save',id,dc,options),
   rollSkill:(id,dc,options)=>rollTest('skill',id,dc,options),
   getStatus:()=>Object.freeze({connected:!closed,closed,rulesetId:'dnd',characterId:playerId}),
   close(){if(closed)return;closed=true;session.close();
    clockHud?.close();
    if(hud){setStatusView?.(null);hud.box.remove();doc.removeEventListener('keydown',onKey);}}
  });
 }
 return Object.freeze({create,readStats});
});
