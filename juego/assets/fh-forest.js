/* Bosque v1: generación independiente de la cámara y del estado de la partida. */
(function(root,factory){
 const api=factory(root.FHTerrain||(typeof require==='function'?require('./fh-terrain.js'):null),root.FHForestCatalog||(typeof require==='function'?require('./fh-forest-catalog.js'):null),root.FH_FOREST_TEXT||(typeof require==='function'?require('./fh-forest-strings.js'):null));
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.FHForest=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(Terrain,Catalog,Text){
 'use strict';
 function createRuntime(map,state={},options={}){
  const terrain=options.terrain||Terrain.create(map),cfg=terrain.config.forest,enabled=terrain.config.enabled;
  const namespace=Terrain.seed('forest-v1:'+cfg.seed).toString(36),all=new Map(),sectors=new Map(),listeners=new Set();
  const removed=new Set((Array.isArray(state.environment?.removedTreeIds)?state.environment.removedTreeIds:[]).filter(id=>typeof id==='string'));
  const excluded=new Set(cfg.exclusions),catalog=new Map(Catalog.models.map(m=>[m.id,m]));
  const weights=[['04_pino_alto',40],['12_pino_oscuro',30],['11_pino_joven',18],['05_pino_delgado',10],['07_abedul_verde',2]];
  if(cfg.snow)weights.push(['06_pino_nevado',15]);
  const weightSum=weights.reduce((s,e)=>s+e[1],0),sectorKey=(x,z)=>Math.floor(x/cfg.sectorM)+':'+Math.floor(z/cfg.sectorM);
  function choose(r){let n=r*weightSum;for(const [id,w] of weights){n-=w;if(n<0)return catalog.get(id);}return catalog.get(weights[0][0]);}
  if(enabled){
   const cols=Math.ceil(terrain.width/cfg.spacingM),rows=Math.ceil(terrain.depth/cfg.spacingM);
   if(cols*rows>250000)throw Error(Text.forestLimit);
   for(let iz=0;iz<rows;iz++)for(let ix=0;ix<cols;ix++){
    const id='forest-v1:'+namespace+':'+ix+':'+iz;
    const x=(ix+.3+Terrain.random(cfg.seed,ix,iz,1)*.4)*cfg.spacingM,z=(iz+.3+Terrain.random(cfg.seed,ix,iz,2)*.4)*cfg.spacingM;
    const density=Terrain.noise(cfg.seed+':density',x/35,z/35);
    const probability=cfg.density*Math.max(0,Math.min(1,(density-.25)/.5));
    if(Terrain.random(cfg.seed,ix,iz,3)>=probability)continue;
    const model=choose(Terrain.random(cfg.seed,ix,iz,4)),canopyRadius=model.ancho_ft*.3048/2;
    if(terrain.vegetationReservedAt(x,z,canopyRadius+.35)||excluded.has(id))continue;
    const tree={id,x,z,y:terrain.heightAt(x,z),rotation:Terrain.random(cfg.seed,ix,iz,5)*Math.PI*2,modelId:model.id,radius:model.trunkRadiusM,canopyRadius,height:model.heightM,sector:sectorKey(x,z)};
    all.set(id,tree);if(!sectors.has(tree.sector))sectors.set(tree.sector,[]);sectors.get(tree.sector).push(tree);
   }
  }
  const alive=tree=>!removed.has(tree.id);
  function nearby(x,z,r=0){
   const out=[],padding=r+1.1;
   for(let iz=Math.floor((z-padding)/cfg.sectorM);iz<=Math.floor((z+padding)/cfg.sectorM);iz++)for(let ix=Math.floor((x-padding)/cfg.sectorM);ix<=Math.floor((x+padding)/cfg.sectorM);ix++){
    for(const t of sectors.get(ix+':'+iz)||[])if(alive(t)&&Math.hypot(t.x-x,t.z-z)<=r+t.radius)out.push(t);
   }
   return out;
  }
  function collisionCandidates(f,x,z,r=1){return enabled&&f===terrain.mainFloor?nearby(x,z,r):[];}
  function removeTree(id){
   const tree=all.get(id);if(!tree||!alive(tree))return false;
   removed.add(id);state.environment={...(state.environment||{}),removedTreeIds:[...removed].sort()};
   for(const listener of listeners)listener(tree);
   options.refresh?.();options.save?.();return true;
  }
  function evaluateConstruction(r,maxSlope=5){
   if(!r||![r.x,r.z,r.w,r.d].every(Number.isFinite)||r.w<=0||r.d<=0)throw TypeError(Text.constructionInvalid);
   const reserved=terrain.reservedRect(r),vegetation=nearby(r.x+r.w/2,r.z+r.d/2,Math.hypot(r.w,r.d)/2).filter(t=>{
    const x=Math.max(r.x,Math.min(r.x+r.w,t.x)),z=Math.max(r.z,Math.min(r.z+r.d,t.z));return Math.hypot(t.x-x,t.z-z)<=t.radius;
   });
   let slope=0,min=Infinity,max=-Infinity;
   const nx=Math.max(1,Math.ceil(r.w/terrain.sx)),nz=Math.max(1,Math.ceil(r.d/terrain.sz));
   if(nx*nz>250000)throw Error(Text.queryLimit);
   for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){
    const px=r.x+r.w*x/nx,pz=r.z+r.d*z/nz,h=terrain.heightAt(px,pz);slope=Math.max(slope,terrain.slopeAt(px,pz));min=Math.min(min,h);max=Math.max(max,h);
   }
   return {reserved,treeIds:vegetation.map(t=>t.id),slopeDegrees:slope,minHeightM:min,maxHeightM:max,requiresClearing:vegetation.length>0,requiresLeveling:slope>maxSlope,available:!reserved&&vegetation.length===0&&slope<=maxSlope};
  }
  return {enabled,terrain,catalog,namespace,sectors,get trees(){return [...all.values()].filter(alive);},getTree:id=>{const t=all.get(id);return t&&alive(t)?t:null;},
   collisionCandidates,nearby,removeTree,onRemove(fn){listeners.add(fn);return ()=>listeners.delete(fn);},
   heightAt:(x,z,f=terrain.mainFloor)=>enabled&&f===terrain.mainFloor?terrain.heightAt(x,z):0,
   slopeAt:terrain.slopeAt,reservedAt:terrain.reservedAt,evaluateConstruction,
   getCurrentFloor:()=>options.getFloor?.()??terrain.mainFloor};
 }
 return Object.freeze({createRuntime});
});
