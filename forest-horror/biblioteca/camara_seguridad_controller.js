/* Forest Horror — controlador opcional del rig de cámara GLB (Three.js r128).
 * No modifica el motor ni controla la detección de jugadores.
 * Uso: const ctrl=FH_CAMARA.bind(gltf, THREE); ... ctrl.update(deltaSeconds);
 */
(function (global) {
  'use strict';
  function bind(gltf, THREE) {
    if (!gltf || !gltf.scene || !THREE) throw new Error('Se requiere gltf.scene y THREE.');
    const pivot = gltf.scene.getObjectByName('CAM_YAW');
    if (!pivot) throw new Error('El GLB no contiene CAM_YAW.');
    const clip = (gltf.animations || []).find(c => c.name === 'Barrido_Seguridad');
    const mixer = clip && THREE.AnimationMixer ? new THREE.AnimationMixer(gltf.scene) : null;
    const action = mixer ? mixer.clipAction(clip) : null;
    let enabled = true;
    let phase = 0;
    if (action) action.play();
    return {
      root: gltf.scene, pivot, mixer,
      setEnabled(value) {
        enabled = !!value;
        if (action) action.paused = !enabled;
        if (!enabled && !action) pivot.rotation.y = 0;
      },
      update(deltaSeconds) {
        const delta = Number.isFinite(deltaSeconds) ? Math.max(0,Math.min(deltaSeconds,.1)) : 0;
        if (!enabled) return;
        if (mixer) mixer.update(delta);
        else {
          phase += delta;
          pivot.rotation.y = -Math.sin(phase * 2 * Math.PI / 7.2) * (48 * Math.PI / 180);
        }
      },
      dispose() {
        if (action) action.stop();
        if (mixer) mixer.uncacheRoot(gltf.scene);
      }
    };
  }
  global.FH_CAMARA = Object.freeze({bind});
})(typeof window !== 'undefined' ? window : globalThis);
