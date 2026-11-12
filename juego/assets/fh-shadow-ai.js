/* Blakpine-Wood — encuentros de Sombras; reloj de juego y navegación del motor. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHShadowAI=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const TYPES=Object.freeze(['el_alto','la_nina']);
 const DEFAULTS=Object.freeze({
  firstMin:12,firstMax:24,intervalMin:28,intervalMax:56,
  durationMin:40,durationMax:80,maxActors:2,
  spawnMinDistance:3,spawnMaxDistance:11,detectDistance:8,
  touchDistance:1.2,attackCooldown:9,attackDamage:1,
  speed:0.85,routeInterval:2.5,flickerCooldown:15
 });
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
 function createRuntime(options={}){
  const cfg={...DEFAULTS,...(options.config||{})};
  if(cfg.enabled===false)return Object.freeze({tick:()=>{},dispose:()=>{},read:()=>({active:[],enabled:false})});
  if(typeof options.spawn!=='function'||typeof options.move!=='function'||
     typeof options.despawn!=='function'||typeof options.canWalk!=='function'||
     typeof options.route!=='function')throw Error('Sombras: faltan los adaptadores del motor.');
  const state=options.state&&typeof options.state==='object'?options.state:{};
  state.seed=(Number(state.seed)>>>0)||0x97e2c01a;
  state.seq=Number.isSafeInteger(state.seq)&&state.seq>=0?state.seq:0;
  let nextAt=finite(state.nextAt)?state.nextAt:null;
  const active=new Map();
  const event=(name,payload)=>{if(name==='blocked'){state.lastBlocked=payload.reason;state.blockedCount=(state.blockedCount||0)+1;}options.onEvent?.(name,payload);};
  function random(){
   if(typeof options.random==='function')return clamp(options.random(),0,0.999999);
   let s=state.seed;s^=s<<13;s^=s>>>17;s^=s<<5;
   state.seed=s>>>0;return state.seed/4294967296;
  }
  const between=(lo,hi)=>lo+(hi-lo)*random();
  function schedule(minute,first=false){
   const lo=first?cfg.firstMin:cfg.intervalMin,hi=first?cfg.firstMax:cfg.intervalMax;
   nextAt=minute+Math.max(1,between(lo,Math.max(lo,hi)));
   state.nextAt=nextAt;
  }
  function remove(actor,reason){
   active.delete(actor.id);options.despawn(actor.id);
   event('despawn',{kind:actor.kind,id:actor.id,reason});
  }
  function walkable(f,x,z){return options.canWalk(f,x,z)===true}
  function route(from,to){
   const path=options.route(from,to);
   return Array.isArray(path)&&path.length>0?path.filter(p=>p&&p.floor===from.floor&&finite(p.x)&&finite(p.z)):null;
  }
  function findPosition(player){
   const ranges=[[cfg.spawnMinDistance,cfg.spawnMaxDistance],[1.3,Math.max(3,cfg.spawnMinDistance)]];
   for(const range of ranges){
    for(let attempt=0;attempt<12;attempt++){
     const angle=between(0,Math.PI*2),radius=between(range[0],Math.max(range[0],range[1]));
     const target={floor:player.floor,x:player.x+Math.cos(angle)*radius,z:player.z+Math.sin(angle)*radius};
     if(!walkable(target.floor,target.x,target.z))continue;
     if(active.size&&[...active.values()].some(a=>distance(a,target)<2))continue;
     if(!route(target,{floor:player.floor,x:player.x,z:player.z}))continue;
     return target;
    }
   }
   return null;
  }
  function summon(minute,player){
   state.lastAttempt=minute;
   const position=findPosition(player);
   if(!position){event('blocked',{reason:'sin_ruta',minute});return false;}
   const kind=TYPES[state.seq%TYPES.length],id='fh-shadow-'+(++state.seq);
   const accepted=options.spawn(kind,position.floor,position.x,position.z,id);
   if(!accepted){event('blocked',{reason:'sprite',kind,minute});return false;}
   const actor={id,kind,...position,appearedAt:minute,expiresAt:minute+between(cfg.durationMin,cfg.durationMax),
    lastHit:-Infinity,lastFlicker:-Infinity,routeAt:-Infinity,routeNodes:[],target:null,noticed:false};
   active.set(id,actor);state.spawnCount=(state.spawnCount||0)+1;state.lastSpawn=minute;state.lastBlocked=null;
   event('spawn',{id,kind,floor:position.floor,minute});
   return true;
  }
  function chooseTarget(actor,player,minute){
   const near=actor.floor===player.floor&&distance(actor,player)<=cfg.detectDistance;
   let target=near?{floor:player.floor,x:player.x,z:player.z}:actor.target;
   if(!near&&(!target||distance(actor,target)<0.8)){
    const angle=between(0,Math.PI*2),radius=between(2.5,7);
    target={floor:actor.floor,x:actor.x+Math.cos(angle)*radius,z:actor.z+Math.sin(angle)*radius};
   }
   if(near&&distance(actor,player)<6&&!actor.noticed){
    actor.noticed=true;event('presence',{kind:actor.kind,id:actor.id,minute});
   }
   if(near&&distance(actor,player)<8&&minute-actor.lastFlicker>=cfg.flickerCooldown){
    actor.lastFlicker=minute;event('flicker',{kind:actor.kind,id:actor.id,duration:1.7,minute});
   }
   const changed=!actor.target||distance(target,actor.target)>1.5;
   if(changed||minute>=actor.routeAt){
    actor.target=target;
    actor.routeNodes=route(actor,target)||[];
    actor.routeAt=minute+Math.max(0.5,cfg.routeInterval);
   }
   return near;
  }
  function move(actor,dt){
   if(!actor.routeNodes.length||dt<=0)return;
   let left=Math.min(0.10,dt)*Math.max(0,cfg.speed);
   while(left>0&&actor.routeNodes.length){
    const node=actor.routeNodes[0],dist=distance(actor,node);
    if(dist<0.08){actor.routeNodes.shift();continue;}
    const step=Math.min(left,dist),x=actor.x+(node.x-actor.x)/dist*step,
     z=actor.z+(node.z-actor.z)/dist*step;
    if(!walkable(actor.floor,x,z)){actor.routeNodes=[];break;}
    if(!options.move(actor.id,actor.floor,x,z)){actor.routeNodes=[];break;}
    actor.x=x;actor.z=z;left-=step;
    if(step>=dist-0.001)actor.routeNodes.shift();
   }
  }
  // El alcance no basta: usar la misma colisión del motor para todo el
  // segmento de contacto impide dañar a través de muros y puertas cerradas.
  function contactClear(actor,player){
   if(actor.floor!==player.floor||distance(actor,player)>cfg.touchDistance)return false;
   const dist=distance(actor,player),steps=Math.max(1,Math.ceil(dist/0.1));
   for(let i=1;i<=steps;i++){
    const t=i/steps;
    if(!walkable(actor.floor,actor.x+(player.x-actor.x)*t,
       actor.z+(player.z-actor.z)*t))return false;
   }
   return true;
  }
  function tick(minute,dt,player){
   if(!finite(minute)||!player||!Number.isInteger(player.floor)||!finite(player.x)||!finite(player.z))return;
   if(nextAt===null)schedule(minute,true);
   if(player.sleeping||player.inactive){
    for(const actor of [...active.values()])remove(actor,'pausa');
    if(minute>=nextAt)schedule(minute,true);
    return;
   }
   if(minute>=nextAt){
    if(active.size<Math.max(1,Math.min(2,cfg.maxActors))){
     const ok=summon(minute,player);
     schedule(minute,ok?false:true);
     if(!ok){nextAt=minute+5;state.nextAt=nextAt;}
    }else schedule(minute);
   }
   for(const actor of [...active.values()]){
    if(actor.floor!==player.floor||minute>=actor.expiresAt){
     remove(actor,actor.floor!==player.floor?'otro_piso':'tiempo');continue;
    }
    const near=chooseTarget(actor,player,minute);
    move(actor,dt);
    if(near&&minute-actor.lastHit>=cfg.attackCooldown&&contactClear(actor,player)){
     actor.lastHit=minute;
     event('attack',{id:actor.id,kind:actor.kind,damage:Math.max(1,Math.floor(cfg.attackDamage)),minute});
    }
   }
  }
  function dispose(){for(const actor of [...active.values()])remove(actor,'cierre');}
  function read(){return {enabled:true,nextAt,lastAttempt:state.lastAttempt??null,lastSpawn:state.lastSpawn??null,lastBlocked:state.lastBlocked??null,spawnCount:state.spawnCount||0,blockedCount:state.blockedCount||0,active:[...active.values()].map(a=>({
   id:a.id,kind:a.kind,floor:a.floor,x:a.x,z:a.z,expiresAt:a.expiresAt}))};}
  return Object.freeze({tick,dispose,read});
 }
 return Object.freeze({TYPES,DEFAULTS,createRuntime});
});
