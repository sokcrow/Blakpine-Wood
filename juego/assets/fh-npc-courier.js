/* Controlador GOAP del primer NPC, independiente de Three.js.
 * Recibe rutas/colisiones del motor; nunca modifica PG, SP, PE ni atraviesa sólidos.
 */
(function(root,factory){
 const api=factory(root.FHNPCGOAP||(typeof require==='function'?require('./fh-npc-goap.js'):null));
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHNPCCourier=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(GOAP){
 'use strict';
 function createRuntime(options){
  if(!GOAP)throw Error('GOAP no cargado');
  let job=null;
  const speed=Math.max(.2,Number(options.speed)||1.65);
  const step=Math.max(.2,Number(options.step)||.6);
  const walk=(floor,x,z)=>!!options.canWalk(floor,x,z);
  const planWalk=(floor,x,z)=>!!(options.canPlanWalk||options.canWalk)(floor,x,z);
  const transitions=()=>options.transitions?.()||[];
  function path(from,to){
   return GOAP.route(from,to,{canWalk:planWalk,step,transitions:transitions(),maxVisited:options.maxVisited||16000});
  }
  function choose(from,ends){
   let result=null;
   for(const end of ends){
    if(!walk(end.floor,end.x,end.z))continue;
    const points=path(from,end);
    if(!points)continue;
    const cost=points.reduce((n,p,i)=>i?n+Math.hypot(p.x-points[i-1].x,p.z-points[i-1].z)+(p.floor!==points[i-1].floor?step*2:0):0,0);
    if(!result||cost<result.cost)result={points,end,cost};
   }
   return result;
  }
  function publish(p){
   job.position={floor:p.floor,x:p.x,z:p.z};
   options.position?.({...job.position});
  }
  function start(orderId,destination){
   if(job)return false;
   const entrances=options.portals?.()||[];
   if(!entrances.length)return null; // Mapa heredado: no tiene portal NPC.
   const ends=[destination];
   let best=null;
   for(const portal of entrances){
    if(!walk(portal.floor,portal.x,portal.z))continue;
    const found=choose(portal,ends);
    if(found&&(!best||found.cost<best.cost))best={...found,portal};
   }
   if(!best){options.blocked?.(orderId);return false}
   const agent=GOAP.createAgent({
    initial:{presente:false,enSalida:false,enPuerta:false,esperando:false,entregado:false,paquete:true},
    goal:{entregado:true,presente:false},actions:GOAP.courierActions
   });
   if(agent.tick(id=>id==='entrar'?'done':'blocked').action!=='entrar')return false;
   const routing=agent.tick(id=>id==='ir_a_puerta'?'running':'blocked');
   if(routing.action!=='ir_a_puerta')return false;
   job={orderId,agent,portal:best.portal,position:{...best.points[0]},route:best.points,index:1,stage:'incoming',destination:{...destination},replanAt:0};
   options.spawn?.({...job.position});options.pose?.('walk');
   publish(job.position);
   return true;
  }
  function reached(){
   if(job.stage==='incoming'){
    job.agent.tick(id=>id==='ir_a_puerta'?'done':'blocked');
    job.agent.tick(id=>id==='esperar_receptor'?'done':'blocked');
    job.stage='waiting';options.pose?.('door_idle');options.arrived?.(job.orderId);return;
   }
   if(job.stage==='returning'){
    job.agent.tick(id=>id==='volver_a_salida'?'done':'blocked');
    const finish=job.agent.tick(id=>id==='salir'?'done':'blocked');
    if(finish.status==='complete'){
     const id=job.orderId;job=null;options.exited?.(id);
    }
   }
  }
  function delivered(orderId){
   if(!job||job.orderId!==orderId||job.stage!=='waiting')return false;
   const action=job.agent.tick(id=>id==='entregar'?'done':'blocked');
   if(action.action!=='entregar')return false;
   const result=choose(job.position,[job.portal]);
   if(!result){job.stage='stranded';options.blocked?.(orderId);return true}
   job.stage='returning';job.route=result.points;job.index=1;job.replanAt=0;
   job.agent.tick(id=>id==='volver_a_salida'?'running':'blocked');
   options.pose?.('walk');return true;
  }
  function tick(dt){
   if(!job||!['incoming','returning'].includes(job.stage))return;
   let budget=Math.max(0,Math.min(.12,Number(dt)||0))*speed,guard=0;
   while(job&&budget>0&&guard++<12){
    if(job.index>=job.route.length){reached();break}
    const next=job.route[job.index],p=job.position;
    if(next.floor!==p.floor){
     if(!walk(next.floor,next.x,next.z)){job.stage='stranded';options.blocked?.(job.orderId);break}
     publish(next);job.index++;continue;
    }
    const dist=Math.hypot(next.x-p.x,next.z-p.z);
    if(dist<.025){publish(next);job.index++;continue}
    const move=Math.min(dist,budget),x=p.x+(next.x-p.x)*move/dist,z=p.z+(next.z-p.z)*move/dist;
    if(!walk(p.floor,x,z)){
     // GOAP decide abrir una puerta permitida antes de volver a calcular la ruta.
     // Nunca desplazar el NPC dentro de un sólido hasta que el motor confirme el paso.
     if(options.openDoor?.({floor:p.floor,x,z,from:{...p},orderId:job.orderId})===true){
      job.replanAt=0;break;
     }
     // La puerta o los muebles cambiaron: el camino anterior dejó de ser válido.
     job.replanAt+=Number(dt)||0;
     if(job.replanAt>=.8){
      job.replanAt=0;
      const destination=job.stage==='incoming'?job.destination:job.portal;
      const found=choose(job.position,[destination]);
      if(found){job.route=found.points;job.index=1;break}
      job.stage='stranded';options.blocked?.(job.orderId);
     }
     break;
    }
    job.replanAt=0;publish({floor:p.floor,x,z});budget-=move;
    if(move>=dist-.0001)job.index++;
   }
   if(job&&['incoming','returning'].includes(job.stage)&&job.index>=job.route.length)reached();
  }
  return Object.freeze({start,tick,delivered,get active(){return !!job},get orderId(){return job?.orderId||null},
   get stage(){return job?.stage||'idle'},get position(){return job?{...job.position}:null},
   get snapshot(){return job?.agent.snapshot()||null}});
 }
 return Object.freeze({createRuntime});
});
