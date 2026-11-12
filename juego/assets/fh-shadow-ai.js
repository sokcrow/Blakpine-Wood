/* Blakpine-Wood — categoría Sombras: IA de La Niña y El Alto. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHShadowAI=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const TYPES=Object.freeze(['el_alto','la_nina']);
 const FT=.3048;
 const DEFAULTS=Object.freeze({
  firstMin:12,firstMax:24,intervalMin:28,intervalMax:56,
  durationMin:40,durationMax:80,maxActors:2,
  spawnMinDistance:3,spawnMaxDistance:11,
  attackCooldown:9,routeInterval:2.5,flickerCooldown:15,
  detectFt:5,touchFt:2,interestMin:5,altoSpawnFt:50,altoNoticeFt:20,altoWanderFt:30,
  pe:6,ninaSpeed:3.2,altoSpeed:.9
 });
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
 function createRuntime(options={}){
  const cfg={...DEFAULTS,...(options.config||{})};
  if(cfg.enabled===false)return Object.freeze({tick:()=>{},dispose:()=>{},read:()=>({active:[],enabled:false})});
  for(const fn of ['spawn','move','despawn','canWalk','route'])
   if(typeof options[fn]!=='function')throw Error('Sombras: falta el adaptador '+fn+'.');
  const state=options.state&&typeof options.state==='object'?options.state:{};
  state.seed=(Number(state.seed)>>>0)||0x97e2c01a;
  state.seq=Number.isSafeInteger(state.seq)&&state.seq>=0?state.seq:0;
  let nextAt=finite(state.nextAt)?state.nextAt:null;
  const active=new Map();
  let previousPlayer=null;
  function event(name,payload){
   if(name==='blocked'){state.lastBlocked=payload.reason;state.blockedCount=(state.blockedCount||0)+1;}
   options.onEvent?.(name,payload);
  }
  function random(){
   if(typeof options.random==='function')return clamp(options.random(),0,.999999);
   let s=state.seed;s^=s<<13;s^=s>>>17;s^=s<<5;
   state.seed=s>>>0;return state.seed/4294967296;
  }
  const between=(min,max)=>min+(Math.max(min,max)-min)*random();
  const meters=feet=>feet*FT;
  function schedule(minute,first=false){
   nextAt=minute+Math.max(1,between(first?cfg.firstMin:cfg.intervalMin,first?cfg.firstMax:cfg.intervalMax));
   state.nextAt=nextAt;
  }
  function inside(f,x,z){
   return options.insideAt?options.insideAt(f,x,z)===true:true;
  }
  function walkable(f,x,z){return inside(f,x,z)&&options.canWalk(f,x,z)===true;}
  function canPhase(kind,f,x,z){
   return inside(f,x,z)&&typeof options.canPhase==='function'&&options.canPhase(kind,f,x,z)===true;
  }
  function remove(actor,reason){
   active.delete(actor.id);options.despawn(actor.id);
   event('despawn',{id:actor.id,kind:actor.kind,reason});
  }
  function path(from,to,actor){
   const nodes=options.route(from,to,{kind:actor?.kind,pe:actor?.pe??cfg.pe});
   return Array.isArray(nodes)&&nodes.length?nodes.filter(p=>p&&Number.isInteger(p.floor)&&finite(p.x)&&finite(p.z)):null;
  }
  function findPosition(kind,player){
   const max=kind==='el_alto'?meters(cfg.altoSpawnFt):cfg.spawnMaxDistance;
   for(const [lo,hi] of [[cfg.spawnMinDistance,max],[meters(5),cfg.spawnMinDistance]]){
    for(let attempt=0;attempt<20;attempt++){
     const angle=between(0,Math.PI*2),radius=between(lo,hi);
     const pos={floor:player.floor,x:player.x+Math.cos(angle)*radius,z:player.z+Math.sin(angle)*radius};
     if(!walkable(pos.floor,pos.x,pos.z))continue;
     if([...active.values()].some(a=>a.floor===pos.floor&&distance(a,pos)<meters(6)))continue;
     if(!path(pos,player,{kind,pe:cfg.pe}))continue;
     return pos;
    }
   }
   return null;
  }
  function summon(minute,player){
   state.lastAttempt=minute;
   const kind=TYPES[state.seq%TYPES.length];
   const pos=findPosition(kind,player);
   if(!pos){event('blocked',{reason:'sin_ruta',minute});return false;}
   const id='fh-shadow-'+(state.seq+1);
   if(!options.spawn(kind,pos.floor,pos.x,pos.z,id)){
    event('blocked',{reason:'sprite',kind,minute});return false;
   }
   state.seq++;
   const actor={id,kind,...pos,pe:Math.max(0,Math.floor(cfg.pe)),mode:'approach',
    appearedAt:minute,expiresAt:minute+between(cfg.durationMin,cfg.durationMax),
    lastHit:-Infinity,lastFlicker:-Infinity,routeAt:-Infinity,routeNodes:[],
    target:null,noticed:false,nearSince:null,phaseActive:false,nightmareDone:false};
   active.set(id,actor);state.spawnCount=(state.spawnCount||0)+1;state.lastSpawn=minute;state.lastBlocked=null;
   event('spawn',{id,kind,floor:pos.floor,minute,pe:actor.pe,category:'Sombras'});
   return true;
  }
  function wanderTarget(actor,player,maxFt){
   const from=actor.kind==='el_alto'?player:actor;
   for(let tries=0;tries<10;tries++){
    const a=between(0,Math.PI*2),r=between(meters(4),meters(maxFt));
    const candidate={floor:actor.floor,x:from.x+Math.cos(a)*r,z:from.z+Math.sin(a)*r};
    if(walkable(candidate.floor,candidate.x,candidate.z)&&path(actor,candidate,actor))return candidate;
   }
   return {floor:actor.floor,x:actor.x,z:actor.z};
  }
  function chooseTarget(actor,player,minute){
   const sameFloor=actor.floor===player.floor;
   const dist=sameFloor?distance(actor,player):Infinity;
   if(sameFloor&&dist<meters(20)&&!actor.noticed){
    actor.noticed=true;event('presence',{id:actor.id,kind:actor.kind,minute});
   }
   if(sameFloor&&dist<meters(26)&&minute-actor.lastFlicker>=cfg.flickerCooldown){
    actor.lastFlicker=minute;event('flicker',{id:actor.id,kind:actor.kind,minute,duration:1.7});
   }
   let target=null;
   if(actor.kind==='la_nina'){
    if(actor.mode!=='search'){
     if(dist<=meters(cfg.touchFt)&&contactClear(actor,player)){
      if(actor.nearSince===null)actor.nearSince=minute;
      if(minute-actor.nearSince>=cfg.interestMin){
       actor.mode='search';actor.nearSince=null;actor.target=null;
       event('interest_lost',{id:actor.id,kind:actor.kind,minute});
      }
     }else actor.nearSince=null;
    }
    if(actor.mode==='search'){
     if(!actor.target||actor.floor!==actor.target.floor||distance(actor,actor.target)<meters(2)){
      target=options.nextRoom?.(actor.floor,actor,player)||wanderTarget(actor,player,24);
     }
    }else if(dist<=meters(cfg.touchFt)&&contactClear(actor,player)){
     actor.routeNodes=[];target={floor:actor.floor,x:actor.x,z:actor.z};
    }else target={floor:player.floor,x:player.x,z:player.z};
   }else{
    if(actor.mode==='approach'&&dist<=meters(cfg.touchFt)&&contactClear(actor,player)){
     actor.mode='stare';actor.nearSince=minute;actor.target=null;actor.routeNodes=[];
    }
    if(actor.mode==='stare'&&actor.nearSince!==null&&minute-actor.nearSince>=cfg.interestMin){
     actor.mode='roam';actor.nearSince=null;actor.target=null;
     event('interest_lost',{id:actor.id,kind:actor.kind,minute});
    }
    if(actor.mode==='stare'&&dist>meters(cfg.altoNoticeFt)){
     actor.mode='approach';actor.nearSince=null;
    }
    if(actor.mode==='approach')target={floor:player.floor,x:player.x,z:player.z};
    if(actor.mode==='roam'&&(!actor.target||actor.floor!==actor.target.floor||distance(actor,actor.target)<meters(2)))
     target=wanderTarget(actor,player,cfg.altoWanderFt);
   }
   if(!target)target=actor.target;
   if(!target)return;
   const changed=!actor.target||actor.target.floor!==target.floor||distance(target,actor.target)>meters(3);
   if(changed||minute>=actor.routeAt){
    actor.target=target;
    actor.routeNodes=path(actor,target,actor)||[];
    actor.routeAt=minute+Math.max(.2,cfg.routeInterval);
   }
  }
  function move(actor,dt){
   if(!actor.routeNodes.length||dt<=0)return;
   let remaining=Math.min(.1,dt)*(actor.kind==='la_nina'?cfg.ninaSpeed:cfg.altoSpeed);
   while(remaining>0&&actor.routeNodes.length){
    const node=actor.routeNodes[0];
    if(node.floor!==actor.floor){
     if(node.transition!==true||!inside(node.floor,node.x,node.z)||
      !options.move(actor.id,node.floor,node.x,node.z)){actor.routeNodes=[];break;}
     actor.floor=node.floor;actor.x=node.x;actor.z=node.z;actor.phaseActive=false;
     actor.routeNodes.shift();continue;
    }
    const d=distance(actor,node);
    if(d<.08){actor.routeNodes.shift();continue;}
    const step=Math.min(d,remaining,.025);
    const x=actor.x+(node.x-actor.x)/d*step,z=actor.z+(node.z-actor.z)/d*step;
    const free=walkable(actor.floor,x,z);
    if(!free){
     if(!canPhase(actor.kind,actor.floor,x,z)){actor.routeNodes=[];break;}
     if(!actor.phaseActive){
      if(actor.pe<=0){actor.routeNodes=[];break;}
      actor.pe--;actor.phaseActive=true;
      event('phase',{id:actor.id,kind:actor.kind,pe:actor.pe,minute:actor.lastMinute});
     }
    }else actor.phaseActive=false;
    if(!options.move(actor.id,actor.floor,x,z)){actor.routeNodes=[];break;}
    actor.x=x;actor.z=z;remaining-=step;
    if(step>=d-.001)actor.routeNodes.shift();
   }
  }
  function contactClear(actor,player){
   if(actor.floor!==player.floor||distance(actor,player)>meters(cfg.touchFt))return false;
   const d=distance(actor,player),steps=Math.max(1,Math.ceil(d/.025));
   for(let i=1;i<=steps;i++){
    const t=i/steps;
    if(!walkable(actor.floor,actor.x+(player.x-actor.x)*t,actor.z+(player.z-actor.z)*t))return false;
   }
   return true;
  }
  function rollD4(){return 1+Math.floor(random()*4);}
  function attack(actor,player,minute){
   const power=actor.pe>0&&options.chooseAttack?.({
    kind:actor.kind,pe:actor.pe,mode:actor.mode,distanceFt:distance(actor,player)/FT
   },player)==='potenciado';
   if(power)actor.pe--;
   const damage=rollD4()+(power?rollD4():0);
   actor.lastHit=minute;
   event('attack',{id:actor.id,kind:actor.kind,category:'Sombras',resource:actor.kind==='la_nina'?'sp':'pg',
    damage,dice:power?2:1,peSpent:power?1:0,pe:actor.pe,minute});
  }
  function tick(minute,dt,player){
   if(!finite(minute)||!player||!Number.isInteger(player.floor)||!finite(player.x)||!finite(player.z))return;
   if(nextAt===null)schedule(minute,true);
   const moved=previousPlayer!==null&&previousPlayer.floor===player.floor&&distance(previousPlayer,player)>.015;
   previousPlayer={floor:player.floor,x:player.x,z:player.z};
   const escape=player.inElevator===true||player.outside===true||!inside(player.floor,player.x,player.z);
   if(escape||player.inactive){
    for(const actor of [...active.values()])remove(actor,player.inElevator?'elevador':player.inactive?'pausa':'exterior');
    if(minute>=nextAt)schedule(minute,true);
    return;
   }
   if(minute>=nextAt){
    if(active.size<Math.max(1,Math.min(2,cfg.maxActors))){
     const ok=summon(minute,player);
     schedule(minute,!ok);
     if(!ok){nextAt=minute+5;state.nextAt=nextAt;}
    }else schedule(minute);
   }
   for(const actor of [...active.values()]){
    actor.lastMinute=minute;
    if(minute>=actor.expiresAt){remove(actor,'tiempo');continue;}
    chooseTarget(actor,player,minute);
    move(actor,dt);
    const near=actor.floor===player.floor&&distance(actor,player)<=meters(cfg.detectFt);
    if(actor.kind==='la_nina'&&player.sleeping===true&&near&&!actor.nightmareDone&&contactClear(actor,player)){
     actor.nightmareDone=true;
     event('nightmare',{id:actor.id,kind:actor.kind,minute});
    }
    if(!player.sleeping&&moved&&near&&minute-actor.lastHit>=cfg.attackCooldown&&contactClear(actor,player))
     attack(actor,player,minute);
   }
  }
  function dispose(){for(const actor of [...active.values()])remove(actor,'cierre');}
  function read(){return {enabled:true,nextAt,lastAttempt:state.lastAttempt??null,lastSpawn:state.lastSpawn??null,
   lastBlocked:state.lastBlocked??null,spawnCount:state.spawnCount||0,blockedCount:state.blockedCount||0,
   active:[...active.values()].map(a=>({id:a.id,category:'Sombras',kind:a.kind,
    floor:a.floor,x:a.x,z:a.z,pe:a.pe,mode:a.mode,expiresAt:a.expiresAt}))};}
  return Object.freeze({tick,dispose,read});
 }
 return Object.freeze({TYPES,DEFAULTS,createRuntime});
});
