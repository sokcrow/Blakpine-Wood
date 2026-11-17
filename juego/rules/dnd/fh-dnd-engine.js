/* Puente DnD al mismo runtime de Sombras: el motor conserva contacto y movimiento. */
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
 function create({shadowRuntime,gameState,identity,sessionId,readPlayer,readMinute,
  save,notice,document:doc=typeof document!=='undefined'?document:null,
  random=Math.random}={}){
  if(!shadowRuntime||typeof shadowRuntime.connectCombat!=='function'||
   typeof shadowRuntime.canPlayerAttack!=='function'||typeof shadowRuntime.defeat!=='function'||
   !gameState||typeof readPlayer!=='function'||typeof readMinute!=='function'||
   typeof save!=='function'||typeof notice!=='function'||
   typeof identity?.characterId!=='string'||identity.rulesetId!=='dnd'||
   typeof sessionId!=='string'||!sessionId||!coordinator?.create)throw Error('DND_ENGINE_INVALID');
  if(!gameState.dnd)gameState.dnd=combat.initialState();
  if(!combat.validState(gameState.dnd))throw Error('DND_STATE_INVALID');
  const state=gameState.dnd,playerId=identity.characterId;
  let closed=false,connection=null,hud=null,sequence=0;
  function player(){return {...readPlayer(),inactive:state.player.hp===0||readPlayer().inactive===true};}
  function context(){
   return {sessionId,playerId,rulesetId:'dnd',revision:state.revision,minute:readMinute(),
    player:player(),state};
  }
  function currentActors(){return shadowRuntime.read().active;}
  function actor(id){
   const view=currentActors().find(item=>item.id===id);
   if(!view)return null;
   if(!Object.hasOwn(state.actors,id)){
    state.actors[id]=combat.combatant({hp:combat.defaults.creatureHp,energy:combat.defaults.creatureEnergy});
   }
   return state.actors[id].hp?{view,stats:state.actors[id]}:null;
  }
  function world(intent){
   const creatureId=intent.actor.kind==='creature'?intent.actor.id:intent.target.id;
   const enemy=actor(creatureId);
   if(!enemy)return null;
   return {actor:intent.actor.kind==='player'?state.player:enemy.stats,
    target:intent.target.kind==='player'?state.player:enemy.stats};
  }
  function show(result){
   if(closed)return;
   const t=globalThis.FH_DND_TEXT;
   const message=result.hit?t?.hit(result.roll,result.total,result.damage):t?.miss(result.roll,result.total);
   if(message)notice(message,2400);
   if(result.defeated)notice(result.targetId===playerId?t?.lost:t?.defeated,2600);
   updateHud();
  }
  function apply(result,intent){
   const attacking=intent.actor.kind==='player'?state.player:state.actors[intent.actor.id];
   const receiving=intent.target.kind==='player'?state.player:state.actors[intent.target.id];
   if(!attacking||!receiving||attacking.energy<result.cost)throw Error('DND_APPLY_INVALID');
   attacking.energy-=result.cost;
   receiving.hp=Math.max(0,receiving.hp-result.damage);
   if(intent.actor.kind==='player')state.lastPlayerMinute=readMinute();
   state.revision++;
   if(result.defeated&&intent.target.kind==='creature')shadowRuntime.defeat(intent.target.id);
   try{save();}catch(error){ // Efectos consumidos: la acción jamás puede repetirse.
    console.error('[DnD] No se pudo guardar el combate:',error);
   }
   show(result);
   return null;
  }
  const session=coordinator.create().bindDndCombat({sessionId,playerId,rulesAdapter:combat,
   readContext:context,readWorld:world,apply,
   roll:sides=>combat.rollDie(sides,random)});
  connection=shadowRuntime.connectCombat({sessionId,playerId,rulesetId:'dnd',
   readContext:context,requestAttack:session.requestAttack});
  function playerAttack(targetId){
   if(closed)return null;
   const now=readMinute(),p=player(),t=globalThis.FH_DND_TEXT;
   if(p.inactive||p.sleeping||p.inElevator||state.player.hp===0||
    now-state.lastPlayerMinute<combat.defaults.playerAttackCooldownMinutes){
    notice(t?.unavailable||'',1500);return null;
   }
   if(state.player.energy<state.player.energyCost){notice(t?.noEnergy||'',1500);return null;}
   const targets=targetId?[targetId]:currentActors().map(view=>view.id);
   const id=targets.find(value=>shadowRuntime.canPlayerAttack(value,p));
   if(!id){notice(t?.empty||'',1500);return null;}
   const intent={sessionId,rulesetId:'dnd',actionId:sessionId+':player:'+(++sequence),
    revision:state.revision,action:'attack',actor:{kind:'player',id:playerId},
    target:{kind:'creature',id}};
   try{return session.requestAttack(intent,{
    authorize:()=>!closed&&readMinute()===now&&shadowRuntime.canPlayerAttack(id,player())&&
     state.player.hp>0&&readMinute()-state.lastPlayerMinute>=combat.defaults.playerAttackCooldownMinutes,
    execute:()=>null
   });}catch(error){notice(t?.unknown||'',1500);return null;}
  }
  function updateHud(){
   if(!hud)return;
   const t=globalThis.FH_DND_TEXT;
   hud.status.textContent=t?.status(state.player.hp,state.player.maxHp,
    state.player.energy,state.player.maxEnergy)||'';
   hud.button.disabled=closed||state.player.hp===0||state.player.energy<state.player.energyCost;
  }
  function onKey(event){
   if(event.key?.toLowerCase()!=='f'||event.repeat||event.altKey||event.ctrlKey||
    event.metaKey||/^(input|textarea|select)$/i.test(event.target?.tagName||''))return;
   if(event.target?.isContentEditable)return;
   event.preventDefault();playerAttack();
  }
  if(doc?.body&&typeof doc.createElement==='function'){
   const box=doc.createElement('aside'),title=doc.createElement('strong'),
    status=doc.createElement('span'),button=doc.createElement('button'),help=doc.createElement('small');
   const t=globalThis.FH_DND_TEXT||{};
   box.setAttribute('aria-label',t.title||'Combate DnD');
   box.style.cssText='position:fixed;right:12px;bottom:92px;z-index:201;background:#15181de8;color:#fff;border:1px solid #ccc;padding:10px;display:grid;gap:5px;max-width:245px;font:13px system-ui';
   title.textContent=t.title||'Combate DnD';button.type='button';button.textContent=t.attack||'Atacar';
   help.textContent=t.hint||'';box.append(title,status,button,help);doc.body.append(box);
   button.addEventListener('click',()=>playerAttack());
   doc.addEventListener('keydown',onKey);
   hud={box,status,button};updateHud();
  }
  return Object.freeze({
   tick(dt){if(closed)return;shadowRuntime.tick(readMinute(),dt,player());updateHud();},
   attack:playerAttack,
   getStatus:()=>Object.freeze({connected:!closed,closed,rulesetId:'dnd'}),
   close(){if(closed)return;closed=true;session.close();connection?.close();
    if(hud){hud.box.remove();doc.removeEventListener('keydown',onKey);}}
  });
 }
 return Object.freeze({create});
});
