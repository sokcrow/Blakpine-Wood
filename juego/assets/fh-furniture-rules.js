/* Forest Horror — correspondence between catalog assets and existing gameplay verbs.
 * Types are not a replacement for game logic: sit/lie/watch stay in ForestShared.
 */
(function (global) {
  'use strict';

  const MODEL_TYPE = Object.freeze({
    silla_madera:'chair',
    silla_comedor:'chair',
    silla_acolchada:'chair',
    silla_oficina:'chair',
    silla_plegable:'chair',
    banco_cocina:'chair',
    sofa:'sofa',
    cama_individual:'bed',
    televisor_crt:'tv',
    mesa_pequena:'table',
    mesa_cocina_cuadrada:'dining',
    mesa_cocina_redonda:'dining',
    mesa_cocina_rectangular:'dining'
  });
  const DEFAULT_MODEL = Object.freeze({
    chair:'silla_comedor',
    sofa:'sofa',
    bed:'cama_individual',
    tv:'televisor_crt',
    table:'mesa_pequena',
    dining:'mesa_cocina_rectangular'
  });
  const SUPPORT_MODEL = Object.freeze({
    mesa_cocina_redonda:{id:'top',scaleX:.70,scaleZ:.70,heightFt:2.75},
    buro:{id:'top',scaleX:.90,scaleZ:.90,heightFt:2},
    estante_bajo:{id:'top',scaleX:.92,scaleZ:.88,heightFt:3.5},
    escritorio_clasico:{id:'desktop',scaleX:.94,scaleZ:.90,heightFt:2.75},
    escritorio_pc:{id:'desktop',scaleX:.92,scaleZ:.82,heightFt:2.75}
  });

  function typeFor(modelId) {
    return Object.prototype.hasOwnProperty.call(MODEL_TYPE,modelId) ? MODEL_TYPE[modelId] : 'misc';
  }

  function supportSurfacesFor(item, feetPerCell=5) {
    if (!item) return [];
    if (Array.isArray(item.supportSurfaces) && item.supportSurfaces.length) {
      return item.supportSurfaces.filter(surface =>
        surface && typeof surface.id === 'string' &&
        Number(surface.widthFt) > 0 && Number(surface.depthFt) > 0
      ).map(surface => ({...surface}));
    }
    const cellFt = Number(feetPerCell) > 0 ? Number(feetPerCell) : 5;
    const preset = SUPPORT_MODEL[item.modelId] ||
      (item.type === 'table' || item.type === 'dining'
        ? {id:'top',scaleX:.94,scaleZ:.94,heightFt:Number(item.heightFt) || 2.5}
        : null);
    if (!preset) return [];
    return [{
      id:preset.id || 'top',
      xFt:0,
      zFt:0,
      widthFt:Math.max(.25, (Number(item.w) || 1) * cellFt * (preset.scaleX || 1)),
      depthFt:Math.max(.25, (Number(item.h) || 1) * cellFt * (preset.scaleZ || 1)),
      heightFt:Number.isFinite(Number(preset.heightFt)) ? Number(preset.heightFt) : Number(item.heightFt) || 2
    }];
  }

  function anchorsFor(item, shared) {
    const anchors = shared.defaultPropAnchors(item);
    // This GLB is a three-seat sofa. The general preset derives two seats
    // from its six-foot physical width; preserve all three usable cushions.
    if (item.modelId === 'sofa' && item.type === 'sofa') {
      const space = Math.min(2.3, (Number(item.widthFt) || 6) / 3 * .88);
      return [-space, 0, space].map(x => ({type:'sit',x,y:.30,facing:0}));
    }
    return anchors;
  }

  function addBehavior(item, shared, keepExisting) {
    const verb=shared.PROP_ACTIONS[item.type];
    if (!verb) return;
    const validAnchors=Array.isArray(item.anchors)&&item.anchors.some(a=>
      a?.type===verb&&Number.isFinite(a.x)&&Number.isFinite(a.y));
    if (!keepExisting||!validAnchors) item.anchors=anchorsFor(item,shared);
    // Older GLB furniture could retain "examine" after changing from misc.
    if (!keepExisting||item.interact?.verb!==verb) {
      const preset=item.type==='bed'?shared.interactionPreset('bed','lie'):
        item.type==='tv'?shared.interactionPreset('tv','watch'):
        shared.interactionPreset(item.type);
      item.interact={...preset,id:'interact_'+item.id};
    }
  }
  function applyCatalogModel(item, catalogEntry, shared, feetPerCell) {
    if (!item || !catalogEntry || typeof catalogEntry.id !== 'string') return item;
    const cellFt = Number(feetPerCell) > 0 ? Number(feetPerCell) : 5;
    item.modelId = catalogEntry.id;
    item.type = typeFor(catalogEntry.id);
    item.label = catalogEntry.name;
    item.w = Number(catalogEntry.widthFt) / cellFt;
    item.h = Number(catalogEntry.depthFt) / cellFt;
    item.heightFt = Number(catalogEntry.heightFt) || 2;
    item.blocksMovement = catalogEntry.blocksMovement !== false;
    item.placement = catalogEntry.placement || 'floor';
    if (Array.isArray(catalogEntry.supportSurfaces) && catalogEntry.supportSurfaces.length) {
      item.supportSurfaces = catalogEntry.supportSurfaces.map(surface => ({...surface}));
    } else delete item.supportSurfaces;
    if (Number.isFinite(Number(catalogEntry.surfaceOverhangFt))) {
      item.surfaceOverhangFt = Math.max(0, Number(catalogEntry.surfaceOverhangFt));
    } else delete item.surfaceOverhangFt;
    if (Number.isFinite(Number(catalogEntry.mountHeightFt))) {
      item.mountHeightFt = Number(catalogEntry.mountHeightFt);
    }
    // Only registered seat/bed/TV models receive an existing gameplay verb.
    addBehavior(item, shared, false);
    return item;
  }

  function upgradeMap(map,shared){
    if(!Array.isArray(map?.floors))return 0;
    let upgraded=0;
    for(const floor of map.floors)for(const item of floor.items||[]){
      if(!item)continue;
      const mapped=Object.prototype.hasOwnProperty.call(MODEL_TYPE,item.modelId)?MODEL_TYPE[item.modelId]:null;
      const eligible=(mapped&&(item.type==='misc'||item.type===mapped))||(!mapped&&item.type==='chair');
      if(!eligible)continue;
      const beforeType=item.type,beforeVerb=item.interact?.verb;
      const oldAnchor=Array.isArray(item.anchors)&&item.anchors.some(a=>
        a?.type===shared.PROP_ACTIONS[mapped||item.type]&&Number.isFinite(a.x)&&Number.isFinite(a.y));
      if(item.type==='misc')item.type=mapped;
      addBehavior(item,shared,true);
      if(beforeType!==item.type||beforeVerb!==item.interact?.verb||!oldAnchor)upgraded++;
    }
    return upgraded;
  }

  // Move the SAME seating point slightly within a chair cushion, only if the
  // real collision system approves a safe path. Never create extra seats.
  function findReachableChair(items,player,cameraYaw,cell,isReachable,shared,maxDistance=2.05){
    if(!Array.isArray(items)||!shared||typeof isReachable!=='function')return null;
    const forward={x:-Math.sin(cameraYaw),z:-Math.cos(cameraYaw)};
    const offsets=[[0,0],[0,-.08],[0,-.14],[-.07,-.08],[.07,-.08],[0,.08],[-.07,0],[.07,0]];
    let best=null;
    for(const item of items){
      if(item?.type!=='chair'||item.interact?.verb!=='sit')continue;
      if(Math.hypot(item.x*cell-player.x,item.y*cell-player.z)>maxDistance+.45)continue;
      const a=(Number(item.rotation)||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
      for(const [index,anchor]of shared.propAnchors(item).entries()){
        if(anchor?.type!=='sit')continue;
        const at=shared.propAnchorWorld(item,anchor,cell);
        for(const [dx,dz]of offsets){
          const x=at.x+c*dx-s*dz,z=at.z+s*dx+c*dz;
          const dist=Math.hypot(x-player.x,z-player.z);
          if(!Number.isFinite(dist)||dist>maxDistance)continue;
          const candidate={x,z,dist,index,anchor,facing:at.facing};
          if(!isReachable(item,candidate))continue;
          const view=dist>.001?((x-player.x)*forward.x+(z-player.z)*forward.z)/dist:1;
          const score=dist+(1-view)*.10+((dx!==0||dz!==0)?0.02:0);
          if(!best||score<best.score)best={item,score,dist,anchor:candidate};
          break;
        }
      }
    }
    return best;
  }

  global.FHFurnitureRules = Object.freeze({
    typeFor,
    defaultFor: type => Object.prototype.hasOwnProperty.call(DEFAULT_MODEL,type) ? DEFAULT_MODEL[type] : null,
    supportSurfacesFor,
    applyCatalogModel,
    upgradeMap,
    findReachableChair
  });
})(window);
