/* Forest Horror — GLB bridge for the existing Three.js r128 game engine.
 * Reads catalog metadata only; never changes collisions, map layout or saves.
 */
(function (global) {
  'use strict';
  const scriptUrl = new URL(document.currentScript.src, document.baseURI);
  const libraryBase = new URL('../../forest-horror/biblioteca/', scriptUrl);
  const catalogUrl = new URL('catalogo_muebles.json', libraryBase);
  const deliveryCatalogUrl = new URL('catalogo_delivery.json', libraryBase);
  const models = new Map();
  const mirrors = new WeakMap();
  let catalogPromise = null;
  let loaderPromise = null;
  let sightMaskInstaller = null;
  const sightWaiters = [];

  function setSightMaskInstaller(applyMask) {
    if (typeof applyMask !== 'function') throw new TypeError('Se requiere el FOW del motor existente');
    sightMaskInstaller = applyMask;
    while (sightWaiters.length) sightWaiters.shift()();
  }
  function sightReady() {
    return sightMaskInstaller ? Promise.resolve() : new Promise(resolve => sightWaiters.push(resolve));
  }

  function catalog() {
    if (!catalogPromise) {
      const loadDocument = (url, optional = false) => fetch(url.href).then(response => {
        if (!response.ok) throw new Error('Catálogo GLB HTTP ' + response.status);
        return response.json();
      }).catch(error => {
        if (!optional) throw error;
        console.warn('[Forest GLB] Catálogo de paquetería no disponible:', error);
        return {schema:'forest-horror-furniture-catalog-v1', furniture:[]};
      });
      catalogPromise = Promise.all([loadDocument(catalogUrl), loadDocument(deliveryCatalogUrl, true)]).then(documents => {
        const entries = new Map();
        for (const data of documents) {
          if (data.schema !== 'forest-horror-furniture-catalog-v1' || !Array.isArray(data.furniture)) {
            throw new Error('Formato de catálogo GLB no reconocido');
          }
          for (const entry of data.furniture) {
            if (!entry || typeof entry.id !== 'string' || !/^[a-z0-9_]+$/.test(entry.id) ||
                typeof entry.glb !== 'string' || !/^modelos_glb\/[a-z0-9_]+\.glb$/.test(entry.glb) ||
                entries.has(entry.id)) {
              throw new Error('Entrada inválida o duplicada en el catálogo GLB');
            }
            entries.set(entry.id, entry);
          }
        }
        return entries;
      });
    }
    return catalogPromise;
  }

  function loader() {
    if (!loaderPromise) {
      loaderPromise = new Promise((resolve, reject) => {
        if (!global.THREE) return reject(new Error('Three.js no está inicializado'));
        if (global.THREE.GLTFLoader) return resolve(new global.THREE.GLTFLoader());
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
        script.onload = () => global.THREE.GLTFLoader
          ? resolve(new global.THREE.GLTFLoader())
          : reject(new Error('GLTFLoader no se registró'));
        script.onerror = () => reject(new Error('No se pudo cargar GLTFLoader'));
        document.head.appendChild(script);
      });
    }
    return loaderPromise;
  }

  async function load(modelId) {
    const entries = await catalog();
    const item = entries.get(modelId);
    if (!item) throw new Error('Modelo no registrado: ' + modelId);
    if (!models.has(modelId)) {
      const pending = loader().then(inst => new Promise((resolve, reject) => {
        inst.load(new URL(item.glb, libraryBase).href, gltf => {
          gltf.scene.traverse(node => {
            if (!node.isMesh) return;
            node.castShadow = false;
            node.receiveShadow = true;
            for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
              if (!material || !material.map) continue;
              material.map.magFilter = global.THREE.NearestFilter;
              material.map.minFilter = global.THREE.NearestMipmapNearestFilter;
              material.map.needsUpdate = true;
            }
          });
          resolve(gltf);
        }, undefined, reject);
      }));
      models.set(modelId, pending.catch(error => {
        models.delete(modelId); // Reintentar si el recurso o la red vuelven a estar disponibles.
        throw error;
      }));
    }
    return { entry: item, gltf: await models.get(modelId) };
  }

  function replaceVisual(root, scene) {
    // El GLB se muestra únicamente con el shader de visibilidad del motor.
    if (!sightMaskInstaller) throw new Error('La máscara FOW aún no está lista');
    const instance = scene.clone(true);
    sightMaskInstaller(instance);
    // Preserve the group used by collisions, item sight, camera and rotations.
    while (root.children.length) root.remove(root.children[0]);
    root.add(instance);
  }

  function mirror(source, duplicate) {
    if (!source || !duplicate) return;
    let clones = mirrors.get(source);
    if (!clones) { clones = new Set(); mirrors.set(source, clones); }
    clones.add(duplicate);
  }

  function attach(root, item) {
    if (!root || !item) return;
    // Objects created before the GLB library still use their original
    // type, interaction anchors and collider, but now display a real model.
    const modelId = typeof item.modelId === 'string' && item.modelId
      ? item.modelId
      : global.FHFurnitureRules?.defaultFor(item.type);
    if (!modelId) return; // No se inventa un asset para props sin modelo asignado.
    root.userData.fhModelId = modelId;
    root.userData.fhModelState = 'loading';
    // El modelo procedural no es parte del GLB: se descarta antes de cargar.
    while (root.children.length) root.remove(root.children[0]);
    load(modelId).then(async ({ gltf, entry }) => {
      await sightReady();
      if (root.userData.fhModelId !== modelId) return;
      const apply = target => {
        replaceVisual(target, gltf.scene);
        target.userData.fhModelState = 'ready';
        // GLB geometry is already in meters. Only its authored mounting offset
        // is applied here; it is never stretched to fit an unrelated tile size.
        const mounted = Number.isFinite(Number(item.mountHeightFt))
          ? Number(item.mountHeightFt)
          : Number(entry.mountHeightFt) || 0;
        if (mounted && (item.placement || entry.placement) === 'wall') {
          target.children[0].position.y += mounted * 0.3048;
        }
      };
      apply(root);
      for (const duplicate of mirrors.get(root) || []) apply(duplicate);
    }).catch(error => {
      root.userData.fhModelState = 'error';
      root.userData.fhModelError = String(error?.message || error);
      console.error('[Forest Horror GLB] No se pudo mostrar el GLB:', modelId, error);
    });
  }

  global.FHAssets = Object.freeze({ catalog, load, attach, mirror, setSightMaskInstaller });
})(window);
