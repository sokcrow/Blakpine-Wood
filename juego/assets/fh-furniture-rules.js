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

  function typeFor(modelId) {
    return Object.prototype.hasOwnProperty.call(MODEL_TYPE,modelId) ? MODEL_TYPE[modelId] : 'misc';
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
    if (!shared.PROP_ACTIONS[item.type]) return;
    if (!keepExisting || !Array.isArray(item.anchors) || !item.anchors.length) {
      item.anchors = anchorsFor(item, shared);
    }
    if (!keepExisting || !item.interact) {
      const preset = item.type === 'bed'
        ? shared.interactionPreset('bed','lie')
        : item.type === 'tv'
          ? shared.interactionPreset('tv','watch')
          : shared.interactionPreset(item.type);
      item.interact = {...preset,id:'interact_'+item.id};
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
    if (Number.isFinite(Number(catalogEntry.mountHeightFt))) {
      item.mountHeightFt = Number(catalogEntry.mountHeightFt);
    }
    // Only registered seat/bed/TV models receive an existing gameplay verb.
    addBehavior(item, shared, false);
    return item;
  }

  function upgradeMap(map, shared) {
    if (!Array.isArray(map?.floors)) return 0;
    let upgraded = 0;
    for (const floor of map.floors) for (const item of floor.items || []) {
      if (item?.type !== 'misc' || !Object.prototype.hasOwnProperty.call(MODEL_TYPE,item.modelId)) continue;
      item.type = MODEL_TYPE[item.modelId];
      addBehavior(item, shared, true);
      upgraded++;
    }
    return upgraded;
  }

  global.FHFurnitureRules = Object.freeze({
    typeFor,
    defaultFor: type => Object.prototype.hasOwnProperty.call(DEFAULT_MODEL,type) ? DEFAULT_MODEL[type] : null,
    applyCatalogModel,
    upgradeMap
  });
})(window);
