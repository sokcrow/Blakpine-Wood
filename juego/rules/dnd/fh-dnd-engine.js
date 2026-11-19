/* DnD PROTOTIPO: combate contra blancos neutros, nunca actores Legacy. */
(function(root,factory){
 'use strict';
 const coordinator=typeof module==='object'&&module.exports
  ?require('../../core/fh-session-coordinator.js'):root.FHSessionCoordinator;
 const combat=typeof module==='object'&&module.exports
  ?require('./fh-dnd-combat.js'):root.FHDndCombat;
 const api=factory(coordinator,combat);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.FHDndEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(coordinator,combat){
 'use strict';
 function create({targetPort,gameState,identity,sessionId,readPlayer,readMinute,
  save,notice,document:doc=typeof document!=='undefined'?document:null,
  random=Math.random}={}){
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
  let closed=false,hud=null,sequence=0;
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
   // Defensa 10 y resistencia 0 son valores del PROTOTIPO DnD, no una ficha de monstruo.
   return {actor:state.player,target:{type:'training_dummy',hp:1,maxHp:1,
    defense:combat.defaults.defense,resistance:combat.defaults.resistance}};
  }
  function updateHud(){
   if(!hud)return;
   const t=globalThis.FH_DND_TEXT;
   hud.status.textContent=t?.status(state.player.hp,state.player.maxHp)||'';
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
   hud.button.disabled=closed||state.player.hp===0;
  }
  function show(result){
   if(closed)return;
   const t=globalThis.FH_DND_TEXT;
   const message=result.hit?t?.hit(result.roll,result.total,result.damage):t?.miss(result.roll,result.total);
   if(message)notice(message,2400);
   updateHud();
  }
  function apply(result,intent){
   if(closed||intent.actor.kind!=='player'||intent.target.kind!=='training_dummy'||
    result.targetId!==intent.target.id||result.cost!==0||result.defeated!==false)
    throw Error('DND_APPLY_INVALID');
   // El puerto es el único escritor del Dummy; nunca descontar HP ni invocar defeat().
   targetPort.receiveHit(intent.target.id,result);
   state.revision++;
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
  function onKey(event){
   if(event.key?.toLowerCase()!=='f'||event.repeat||event.altKey||event.ctrlKey||
    event.metaKey||/^(input|textarea|select)$/i.test(event.target?.tagName||''))return;
   if(event.target?.isContentEditable)return;
   event.preventDefault();playerAttack(hud?.select.value||undefined);
  }
  if(doc?.body&&typeof doc.createElement==='function'){
   const box=doc.createElement('aside'),title=doc.createElement('strong'),
    status=doc.createElement('span'),select=doc.createElement('select'),
    button=doc.createElement('button'),help=doc.createElement('small');
   const t=globalThis.FH_DND_TEXT||{};
   box.setAttribute('aria-label',t.title||'Combate DnD');
   box.style.cssText='position:fixed;right:12px;bottom:92px;z-index:201;background:#15181de8;color:#fff;border:1px solid #ccc;padding:10px;display:grid;gap:5px;max-width:245px;font:13px system-ui';
   title.textContent=t.title||'Combate DnD';button.type='button';button.textContent=t.attack||'Atacar';
   help.textContent=t.hint||'';select.setAttribute('aria-label',t.selectTarget||'Seleccionar blanco');
   box.append(title,status,select,button,help);doc.body.append(box);
   button.addEventListener('click',()=>playerAttack(select.value||undefined));
   doc.addEventListener('keydown',onKey);
   hud={box,status,select,button,targetsKey:null};updateHud();
  }
  return Object.freeze({
   tick(){if(!closed)updateHud();},
   attack:playerAttack,
   getStatus:()=>Object.freeze({connected:!closed,closed,rulesetId:'dnd',prototype:true}),
   close(){if(closed)return;closed=true;session.close();
    if(hud){hud.box.remove();doc.removeEventListener('keydown',onKey);}}
  });
 }
 return Object.freeze({create});
});
