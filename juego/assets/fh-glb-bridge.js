/* Forest Horror — GLB bridge for the existing Three.js r128 game engine.
 * Reads catalog metadata only; never changes collisions, map layout or saves.
 */
(function (global) {
  'use strict';
  const scriptUrl = new URL(document.currentScript.src, document.baseURI);
  const libraryBase = new URL('../../forest-horror/biblioteca/', scriptUrl);
  const catalogUrl = new URL('catalogo_muebles.json', libraryBase);
  const models = new Map();
  const mirrors = new WeakMap();
  let catalogPromise = null;
  let loaderPromise = null;
  let sightMaskInstaller = null;

  function setSightMaskInstaller(applyMask) {
    if (typeof applyMask !== 'function') throw new TypeError('Se requiere el FOW del motor existente');
    sightMaskInstaller = applyMask;
  }

  function catalog() {
    if (!catalogPromise) {
      catalogPromise = fetch(catalogUrl.href).then(response => {
        if (!response.ok) throw new Error('Catálogo GLB HTTP ' + response.status);
        return response.json();
      }).then(data => {
        if (data.schema !== 'forest-horror-furniture-catalog-v1' || !Array.isArray(data.furniture)) {
          throw new Error('Formato de catálogo de muebles no reconocido');
        }
        const entries = new Map();
        for (const entry of data.furniture) {
          if (!entry || typeof entry.id !== 'string' || !/^[a-z0-9_]+$/.test(entry.id) ||
              typeof entry.glb !== 'string' || !/^modelos_glb\/[a-z0-9_]+\.glb$/.test(entry.glb) ||
              entries.has(entry.id)) {
            throw new Error('Entrada inválida o duplicada en el catálogo GLB');
          }
          entries.set(entry.id, entry);
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
      models.set(modelId, pending);
    }
    return { entry: item, gltf: await models.get(modelId) };
  }

  function replaceVisual(root, scene) {
    // Los GLB llegan después de installVisibility: deben compartir su shader FOW.
    // Si aún no existe el enmascarador, conservamos el mueble provisional.
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
    if (!modelId) return;
    root.userData.fhModelId = modelId;
    load(modelId).then(({ gltf, entry }) => {
      if (root.userData.fhModelId !== modelId) return;
      const apply = target => {
        replaceVisual(target, gltf.scene);
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
      console.warn('[Forest Horror GLB] Se mantiene el modelo provisional:', modelId, error);
    });
  }

  global.FHAssets = Object.freeze({ catalog, load, attach, mirror, setSightMaskInstaller });
})(window);
