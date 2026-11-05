/* Forest Horror — colocación de objetos sobre superficies de otros muebles.
 * El JSON conserva x/y absolutos para compatibilidad y añade support como relación opcional.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.FHSurfacePlacement=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const EPS=.0001;
  const SURFACE_PLACEMENTS=new Set(['surface','floor_or_surface']);

  function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function rotate(x,z,degrees){
    const r=finite(degrees)*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
    return {x:c*x-s*z,z:s*x+c*z};
  }
  function localPoint(parent,xFt,zFt,feetPerCell){
    const dx=xFt-finite(parent.x)*feetPerCell,dz=zFt-finite(parent.y)*feetPerCell;
    return rotate(dx,dz,-finite(parent.rotation));
  }
  function worldPoint(parent,xFt,zFt,feetPerCell){
    const d=rotate(xFt,zFt,finite(parent.rotation));
    return {xFt:finite(parent.x)*feetPerCell+d.x,zFt:finite(parent.y)*feetPerCell+d.z};
  }
  function providerSurfaces(parent,feetPerCell,surfaceProvider){
    const raw=typeof surfaceProvider==='function'?surfaceProvider(parent,feetPerCell):parent?.supportSurfaces;
    if(!Array.isArray(raw))return [];
    return raw.filter(s=>s&&typeof s.id==='string'&&s.id&&finite(s.widthFt)>0&&finite(s.depthFt)>0)
      .map(s=>({
        id:s.id,
        xFt:finite(s.xFt),zFt:finite(s.zFt),
        widthFt:finite(s.widthFt),depthFt:finite(s.depthFt),
        heightFt:Number.isFinite(Number(s.heightFt))?Number(s.heightFt):finite(parent?.heightFt),
        overhangFt:Math.max(0,finite(s.overhangFt))
      }));
  }
  function itemFootprintFt(item,feetPerCell){
    return {widthFt:Math.max(.01,finite(item?.w,1)*feetPerCell),depthFt:Math.max(.01,finite(item?.h,1)*feetPerCell)};
  }
  function supportedPlacement(item){return SURFACE_PLACEMENTS.has(item?.placement);}
  function findSurface(parent,surfaceId,feetPerCell,surfaceProvider){
    return providerSurfaces(parent,feetPerCell,surfaceProvider).find(s=>s.id===surfaceId)||null;
  }
  function worldPose(items,item,feetPerCell=5,surfaceProvider,seen){
    const cell=Math.max(.01,finite(feetPerCell,5));
    const fallback={x:finite(item?.x),y:finite(item?.y),heightFt:0,supported:false,parent:null,surface:null};
    if(!item?.support||!Array.isArray(items))return fallback;
    const guard=seen||new Set();
    if(guard.has(item.id))return fallback;
    guard.add(item.id);
    const parent=items.find(v=>v&&v.id===item.support.parentItemId);
    if(!parent)return fallback;
    const surface=findSurface(parent,item.support.surfaceId,cell,surfaceProvider);
    if(!surface)return fallback;
    const parentPose=worldPose(items,parent,cell,surfaceProvider,guard);
    const anchor=worldPoint({
      x:parentPose.x,y:parentPose.y,rotation:parent.rotation
    },finite(item.support.offsetXFt),finite(item.support.offsetZFt),cell);
    return {
      x:anchor.xFt/cell,y:anchor.zFt/cell,
      heightFt:parentPose.heightFt+surface.heightFt,
      supported:true,parent,surface
    };
  }
  function candidateFits(parent,surface,item,xFt,zFt,feetPerCell){
    const local=localPoint(parent,xFt,zFt,feetPerCell);
    const rel=(finite(item.rotation)-finite(parent.rotation))*Math.PI/180;
    const fp=itemFootprintFt(item,feetPerCell),c=Math.abs(Math.cos(rel)),s=Math.abs(Math.sin(rel));
    const halfX=(c*fp.widthFt+s*fp.depthFt)/2;
    const halfZ=(s*fp.widthFt+c*fp.depthFt)/2;
    const overhang=Math.max(surface.overhangFt,Math.max(0,finite(item.surfaceOverhangFt)));
    const withinX=Math.abs(local.x-surface.xFt)+halfX<=surface.widthFt/2+overhang+EPS;
    const withinZ=Math.abs(local.z-surface.zFt)+halfZ<=surface.depthFt/2+overhang+EPS;
    return withinX&&withinZ?{local,halfX,halfZ}:null;
  }
  function findSupport(items,item,feetPerCell=5,surfaceProvider,position){
    if(!Array.isArray(items)||!item)return null;
    const cell=Math.max(.01,finite(feetPerCell,5));
    const x=finite(position?.x,item.x),y=finite(position?.y,item.y),xFt=x*cell,zFt=y*cell;
    let best=null;
    for(const parent of items){
      if(!parent||parent===item||parent.id===item.id)continue;
      for(const surface of providerSurfaces(parent,cell,surfaceProvider)){
        const fit=candidateFits(parent,surface,item,xFt,zFt,cell);
        if(!fit)continue;
        const parentPose=worldPose(items,parent,cell,surfaceProvider);
        const topHeight=parentPose.heightFt+surface.heightFt;
        const dx=fit.local.x-surface.xFt,dz=fit.local.z-surface.zFt;
        const score=dx*dx+dz*dz;
        if(!best||topHeight>best.topHeight+EPS||(Math.abs(topHeight-best.topHeight)<=EPS&&score<best.score)){
          best={parent,surface,offsetXFt:fit.local.x,offsetZFt:fit.local.z,x,y,topHeight,score};
        }
      }
    }
    return best;
  }
  function attach(item,candidate){
    if(!item||!candidate)return false;
    item.support={
      parentItemId:candidate.parent.id,
      surfaceId:candidate.surface.id,
      offsetXFt:candidate.offsetXFt,
      offsetZFt:candidate.offsetZFt
    };
    item.x=candidate.x;item.y=candidate.y;
    return true;
  }
  function detach(item){if(item&&Object.prototype.hasOwnProperty.call(item,'support'))delete item.support;return item;}
  function place(item,items,feetPerCell=5,surfaceProvider,position){
    if(!item)return {ok:false,supported:false,reason:'invalid-item'};
    if(!supportedPlacement(item))return {ok:true,supported:false,reason:'not-surface-placement'};
    const candidate=findSupport(items,item,feetPerCell,surfaceProvider,position);
    if(candidate){attach(item,candidate);return {ok:true,supported:true,candidate};}
    if(item.placement==='surface')return {ok:false,supported:false,reason:'surface-required'};
    detach(item);return {ok:true,supported:false,reason:'floor-fallback'};
  }
  function syncItem(items,item,feetPerCell=5,surfaceProvider){
    const pose=worldPose(items,item,feetPerCell,surfaceProvider);
    if(!pose.supported)return false;
    item.x=pose.x;item.y=pose.y;return true;
  }
  function syncChildren(items,parentId,feetPerCell=5,surfaceProvider,visited){
    if(!Array.isArray(items)||!parentId)return 0;
    const seen=visited||new Set();if(seen.has(parentId))return 0;seen.add(parentId);
    let count=0;
    for(const child of items){
      if(child?.support?.parentItemId!==parentId)continue;
      if(syncItem(items,child,feetPerCell,surfaceProvider))count++;
      count+=syncChildren(items,child.id,feetPerCell,surfaceProvider,seen);
    }
    return count;
  }
  function syncAll(items,feetPerCell=5,surfaceProvider){
    if(!Array.isArray(items))return 0;
    let count=0;for(const item of items)if(item?.support&&syncItem(items,item,feetPerCell,surfaceProvider))count++;
    return count;
  }
  return {rotate,providerSurfaces,findSupport,place,attach,detach,worldPose,syncItem,syncChildren,syncAll,supportedPlacement};
});
