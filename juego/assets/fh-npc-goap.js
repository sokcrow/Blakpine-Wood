/* Blakpine Wood — GOAP y navegación agnósticos del tipo de entidad.
 * La física, los recursos y la confirmación de acciones pertenecen al motor.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHNPCGOAP=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const same=(s,p)=>Object.entries(p||{}).every(([key,value])=>s[key]===value);
 const keyOf=state=>JSON.stringify(Object.keys(state).sort().map(key=>[key,state[key]]));
 function plan(initial,goal,actions,opts={}){
  if(!initial||!goal||!Array.isArray(actions))return null;
  const limit=Math.max(1,Math.min(10000,Number(opts.limit)||2000));
  const blocked=new Set(opts.blocked||[]);
  const queue=[{state:{...initial},cost:0,steps:[]}],seen=new Map();
  let visited=0;
  while(queue.length&&visited++<limit){
   let best=0;
   for(let i=1;i<queue.length;i++)if(queue[i].cost<queue[best].cost)best=i;
   const node=queue.splice(best,1)[0],signature=keyOf(node.state);
   if((seen.get(signature)??Infinity)<=node.cost)continue;
   seen.set(signature,node.cost);
   if(same(node.state,goal))return node.steps;
   for(const action of actions){
    if(!action||typeof action.id!=='string'||blocked.has(action.id)||!same(node.state,action.pre))continue;
    const cost=Number(action.cost??1);
    if(!Number.isFinite(cost)||cost<=0||!action.effects)continue;
    const next={...node.state,...action.effects},newCost=node.cost+cost;
    if((seen.get(keyOf(next))??Infinity)<=newCost)continue;
    queue.push({state:next,cost:newCost,steps:node.steps.concat(action.id)});
   }
  }
  return null;
 }
 function chooseGoal(state,goals,actions,options={}){
  if(!Array.isArray(goals))return null;
  let best=null;
  for(const goal of goals){
   if(!goal||!goal.desired)continue;
   const steps=plan(state,goal.desired,actions,options);
   if(!steps)continue;
   const priority=Number(goal.priority)||0;
   if(!best||priority>best.priority||(priority===best.priority&&steps.length<best.steps.length))
    best={id:goal.id,priority,steps};
  }
  return best;
 }
 function createAgent({initial={},goal={},actions=[]}={}){
  let beliefs={...initial},blocked=new Set();
  function snapshot(){return {...beliefs}}
  function observe(facts={}){beliefs={...beliefs,...facts};blocked.clear();return snapshot()}
  function tick(execute){
   if(same(beliefs,goal))return {status:'complete',action:null};
   const steps=plan(beliefs,goal,actions,{blocked});
   if(!steps||!steps.length)return {status:'blocked',action:null};
   const id=steps[0],action=actions.find(a=>a.id===id);
   const result=typeof execute==='function'?execute(id,snapshot()):'blocked';
   if(result===true||result==='done'){
    beliefs={...beliefs,...action.effects};blocked.clear();
    return {status:same(beliefs,goal)?'complete':'progress',action:id};
   }
   if(result===false||result==='blocked'){
    blocked.add(id);return {status:'blocked',action:id};
   }
   return {status:'running',action:id};
  }
  return Object.freeze({tick,observe,snapshot,get complete(){return same(beliefs,goal)}});
 }
 const courierActions=Object.freeze([
  {id:'entrar',pre:{presente:false,paquete:true},effects:{presente:true,enSalida:true},cost:1},
  {id:'ir_a_puerta',pre:{presente:true,paquete:true,enSalida:true},effects:{enSalida:false,enPuerta:true},cost:2},
  {id:'esperar_receptor',pre:{enPuerta:true,paquete:true},effects:{esperando:true},cost:1},
  {id:'entregar',pre:{enPuerta:true,esperando:true,paquete:true},effects:{entregado:true,paquete:false,esperando:false},cost:1},
  {id:'volver_a_salida',pre:{presente:true,entregado:true,enPuerta:true},effects:{enPuerta:false,enSalida:true},cost:2},
  {id:'salir',pre:{presente:true,enSalida:true,entregado:true},effects:{presente:false},cost:1}
 ]);
 function planCourier(beliefs={},options={}){
  return plan({presente:false,enSalida:false,enPuerta:false,esperando:false,entregado:false,paquete:true,...beliefs},
   {entregado:true,presente:false},courierActions,options);
 }
 /* GOAP de puertas: reutilizable por cualquier entidad.
  * Los permisos los calcula el motor a partir del mapa y del estado real.
  * Una puerta de parcela, apartamento, mirilla, garaje o cerradura activa no se fuerza.
  */
 const doorActions=Object.freeze([
  {id:'abrir_puerta',pre:{cerrada:true,autorizada:true},effects:{cerrada:false,transitable:true},cost:1}
 ]);
 function canOpenDoor(door,rights={}){
  if(!door||door.kind!=='door'||door.locked===true||door.open===true||door.passable===true)return false;
  if(door.family==='garage'||door.electronic===true||rights.propertyAccess===true||rights.blockedFlag===true)return false;
  const meta=rights.meta||{};
  if(door.apartmentId||door.role==='entrance'||door.doorRole==='entrance')return false;
  if(meta.apartmentId||meta.doorRole==='entrance'||meta.propertyDoorRole||meta.propertyId)return false;
  if(meta.electronic===true||meta.pinpadId||meta.cardReaderId||meta.requiresCard||meta.requiresCode)return false;
  return true;
 }
 function planDoor(door,rights={}){
  if(door?.open===true&&door.passable!==false)return [];
  if(!canOpenDoor(door,rights))return null;
  return plan({cerrada:true,autorizada:true,transitable:false},{transitable:true},doorActions);
 }
 /* A* 2.5D: canWalk suministrado por el mismo motor que mueve al jugador. */
 function route(start,end,{canWalk,step=0.5,maxVisited=12000,transitions=[]}={}){
  if(typeof canWalk!=='function'||!start||!end||!Number.isFinite(step)||step<=0)return null;
  const f0=Number(start.floor),f1=Number(end.floor);
  if(!Number.isInteger(f0)||!Number.isInteger(f1))return null;
  const N=Math.max(10,Math.min(100000,Number(maxVisited)||12000));
  const quant=n=>Math.round(n/step),pos=n=>n*step;
  const valid=(f,x,z)=>Number.isInteger(f)&&Number.isFinite(x)&&Number.isFinite(z)&&!!canWalk(f,x,z);
  const normal=p=>({floor:p.floor,x:pos(quant(p.x)),z:pos(quant(p.z))});
  const nearest=(p,maxRadius=1)=>{
   const q=normal(p);
   if(valid(q.floor,q.x,q.z))return q;
   for(let rad=1;rad<=maxRadius;rad++)for(let x=-rad;x<=rad;x++)for(let z=-rad;z<=rad;z++){
    if(Math.max(Math.abs(x),Math.abs(z))!==rad)continue;
    const candidate={floor:q.floor,x:q.x+x*step,z:q.z+z*step};
    if(valid(candidate.floor,candidate.x,candidate.z))return candidate;
   }
   return null;
  };
  const from=nearest({...start,floor:f0}),to=nearest({...end,floor:f1});
  if(!from||!to)return null;
  const k=n=>String(n.floor)+':'+quant(n.x)+':'+quant(n.z);
  const portalEdges=new Map();
  for(const t of transitions){
   const a=t?.from,b=t?.to;if(!a||!b)continue;
   const aa=nearest(a),bb=nearest(b);if(!aa||!bb)continue;
   const add=(v,w)=>{const id=k(v);if(!portalEdges.has(id))portalEdges.set(id,[]);portalEdges.get(id).push({...w,transition:true})};
   add(aa,bb);if(t.bidirectional!==false)add(bb,aa);
  }
  const h=n=>n.floor===to.floor?Math.hypot(n.x-to.x,n.z-to.z):0;
  const gScore=new Map([[k(from),0]]),parent=new Map(),nodes=new Map([[k(from),from]]);
  const open=[{key:k(from),g:0,f:h(from)}];let visited=0;
  const dirs=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
  while(open.length&&visited++<N){
   let best=0;for(let i=1;i<open.length;i++)if(open[i].f<open[best].f)best=i;
   const cur=open.splice(best,1)[0],current=nodes.get(cur.key);
   if(cur.g!==gScore.get(cur.key))continue;
   if(cur.key===k(to)){
    const output=[current];let here=cur.key;
    while(parent.has(here)){here=parent.get(here);output.push(nodes.get(here))}
    return output.reverse();
   }
   const neighbors=[];
   for(const [dx,dz] of dirs){
    const x=current.x+dx*step,z=current.z+dz*step;
    if(!valid(current.floor,x,z))continue;
    if(dx&&dz&&(!valid(current.floor,current.x+dx*step,current.z)||!valid(current.floor,current.x,current.z+dz*step)))continue;
    neighbors.push({floor:current.floor,x,z,cost:Math.hypot(dx,dz)*step});
   }
   for(const edge of portalEdges.get(cur.key)||[])neighbors.push({...edge,cost:step*2});
   for(const next of neighbors){
    const dest=k(next),candidate=cur.g+next.cost;
    if(candidate>=(gScore.get(dest)??Infinity))continue;
    const node={floor:next.floor,x:next.x,z:next.z};
    if(next.transition)node.transition=true;
    gScore.set(dest,candidate);parent.set(dest,cur.key);nodes.set(dest,node);
    open.push({key:dest,g:candidate,f:candidate+h(node)});
   }
  }
  return null;
 }
 return Object.freeze({plan,chooseGoal,createAgent,planCourier,courierActions,doorActions,canOpenDoor,planDoor,route});
});
