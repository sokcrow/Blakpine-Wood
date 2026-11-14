/* Blakpine-Wood · Una Unidad tiene un cuerpo; humano/IA son controladores separados.
 * GameState.character sigue siendo el cuerpo del jugador para guardados v1.
 * GameState.units guarda cuerpos adicionales; nunca replica recursos del jugador.
 */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHUnitCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const SCORES=Object.freeze(['FOR','AGI','VOL','PRU','ING','ARC','SOC']);
 const CONTROL=Object.freeze(['human','ai','none']);
 const safeId=id=>typeof id==='string'&&id.length>0&&id.length<=120&&
  !['__proto__','prototype','constructor'].includes(id);
 const positionValid=p=>p&&Number.isInteger(p.floor)&&
  Number.isFinite(p.x)&&Number.isFinite(p.z);
 const copyPosition=p=>positionValid(p)?{floor:p.floor,x:p.x,z:p.z}:null;
 function makeBody(id,{name='Unidad',scores,resources,skills,inventory,life='alive'}={},rules=root?.FHCharacterCore){
  if(!safeId(id))throw Error('ID de unidad inválido');
  const stats={};
  for(const k of SCORES)stats[k]=Number.isInteger(scores?.[k])&&scores[k]>=1&&scores[k]<=6?scores[k]:3;
  const caps=rules?.resources?.(stats);
  if(!caps||!['pgMax','spMax','peMax'].every(k=>Number.isFinite(caps[k])&&caps[k]>0))
   throw Error('No están disponibles las reglas comunes de recursos del personaje');
  const r={...caps,pg:caps.pgMax,sp:caps.spMax,pe:caps.peMax};
  if(resources&&typeof resources==='object')for(const k of ['pg','sp','pe']){
   if(Number.isFinite(resources[k]))r[k]=Math.max(0,Math.min(r[k+'Max'],resources[k]));
  }
  return {id,name:String(name).slice(0,80),life:life==='dead'?'dead':'alive',
   scores:stats,skills:skills&&typeof skills==='object'&&!Array.isArray(skills)?skills:{},
   resources:r,inventory:Array.isArray(inventory)?inventory.slice():[],
   mental:null,survival:null,position:null};
 }
 function createRuntime(gameState,options={}){
  if(!gameState||typeof gameState!=='object')throw Error('Estado de partida inválido');
  if(!gameState.units||typeof gameState.units!=='object'||Array.isArray(gameState.units))
   gameState.units={};
  const controllers=new Map(),wrappers=new Map(),survivalRuntimes=new Map(),mentalRuntimes=new Map();
  const playerBody=()=>gameState.character?.resources&&safeId(gameState.character.id)?gameState.character:null;
  const isPlayer=id=>!!playerBody()&&playerBody().id===id;
  function wrap(id,body,player=false){
   const old=wrappers.get(id);
   if(old&&old.body===body)return old;
   const unit=Object.freeze({
    id,body,get resources(){return body.resources},get scores(){return body.scores},
    get inventory(){return body.inventory},get mental(){return body.mental},
    get survival(){return player?gameState.survival:body.survival},
    get position(){
     if(player&&typeof options.playerPosition==='function')return copyPosition(options.playerPosition());
     return copyPosition(player?options.savedPlayerPosition?.():body.position);
    },
    setPosition(point){
     if(!positionValid(point))return false;
     if(player){
      // El movimiento humano sigue autorizado por su controlador/motor.
      return typeof options.movePlayer==='function'&&options.movePlayer(copyPosition(point))===true;
     }
     body.position=copyPosition(point);
     return true;
    },
    get controller(){return controllers.get(id)||null},
    get isPlayer(){return player}
   });
   wrappers.set(id,unit);return unit;
  }
  function get(id){
   if(!safeId(id))return null;
   if(isPlayer(id))return wrap(id,playerBody(),true);
   return Object.prototype.hasOwnProperty.call(gameState.units,id)&&gameState.units[id]?.id===id
    ?wrap(id,gameState.units[id]):null;
  }
  function ensure(id,profile={}){
   if(!safeId(id)||isPlayer(id))return get(id);
   const existing=get(id);if(existing)return existing;
   if(Object.keys(gameState.units).length>=256)throw Error('Límite de unidades alcanzado');
   gameState.units[id]=makeBody(id,profile,options.characterRules||root?.FHCharacterCore);
   return get(id);
  }
  function assignController(id,config){
   const unit=get(id);if(!unit||!config||!CONTROL.includes(config.type))return false;
   if(config.type==='human'&&!unit.isPlayer&&options.allowHumanControl?.(id)!==true)return false;
   controllers.set(id,Object.freeze({type:config.type,
    ownerId:typeof config.ownerId==='string'?config.ownerId:null}));
   return true;
  }
  function createSurvival(id,callbacks={},initialMinute){
   const unit=get(id),engine=options.survivalCore||root?.FHSurvival;
   if(!unit||!engine?.createRuntime)return null;
   if(unit.isPlayer&&options.playerSurvival?.())return options.playerSurvival();
   if(survivalRuntimes.has(id))return survivalRuntimes.get(id);
   // Misma fórmula y reglas; el propietario del estado cambia, no el cuerpo.
   const runtime=engine.createRuntime(gameState,callbacks,initialMinute,unit.body);
   survivalRuntimes.set(id,runtime);return runtime;
  }
  function createMoodFear(id,callbacks={},settings={}){
   const unit=get(id),engine=options.moodCore||root?.FHMoodFear;
   if(!unit||!engine?.createRuntime)return null;
   if(unit.isPlayer&&options.playerMood?.())return options.playerMood();
   if(mentalRuntimes.has(id))return mentalRuntimes.get(id);
   const runtime=engine.createRuntime(unit.body,callbacks,settings);
   mentalRuntimes.set(id,runtime);return runtime;
  }
  function list(){const unique=new Set();return [playerBody(),...Object.values(gameState.units)]
   .filter(body=>body?.id&&safeId(body.id)&&!unique.has(body.id)&&unique.add(body.id))
   .map(body=>get(body.id)).filter(Boolean)}
  if(playerBody())assignController(playerBody().id,{type:'human'});
  return Object.freeze({get,ensure,assignController,createSurvival,createMoodFear,list,
   get player(){const body=playerBody();return body?get(body.id):null}});
 }
 return Object.freeze({SCORES,CONTROL,makeBody,createRuntime});
});
