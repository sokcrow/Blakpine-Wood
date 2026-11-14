# Blakpine-Wood — Pack de árboles low poly / pixel art

**Contenido:** 12 modelos GLB individuales, un atlas de texturas pixel art (PNG), 12 vistas previas de modelos y un catálogo (MINIATURA_PACK.png).

## Características

- Cada archivo `.glb` contiene malla 3D con UV y textura PNG **incrustada**. No requiere cargar el PNG externo.
- Estética low poly, material PBR sin metal, textura de mosaicos pixelados de 4x4 px dentro del atlas de 256x128 px.
- Coordenadas para Three.js: **Y arriba**; origen X=0, Y=0, Z=0 situado en la base del tronco.
- Sin animación, colisiones, scripts o lógica: **recursos visuales solamente**.
- La geometría está escalada físicamente en pies: **1 unidad GLB = 1 ft**. Todas las alturas son exactas al exportar; no aplicar escalado adicional si el cargador respeta pies.
- Follaje elevado: los árboles frondosos dejan aproximadamente 62–65 % del alto despejado bajo la primera hoja; los pinos dejan aproximadamente 34 % de tronco libre. El árbol seco no lleva hojas.
- Se retiraron hierbas y piedras decorativas de las bases para evitar que queden gigantes al escalar a ft.
- Las miniaturas fueron generadas a partir de las propias mallas del pack. No son capturas de un motor en ejecución.

## Importación mínima Three.js (con GLTFLoader)

```js
const loader = new THREE.GLTFLoader(); // Asegura que GLTFLoader esté cargado en tu proyecto.
loader.load('modelos_glb/01_roble_verde.glb', (gltf) => {
  const arbol = gltf.scene;
  arbol.position.set(0, 0, 0);
  scene.add(arbol);
});
```

Para conservar los píxeles nítidos, en las texturas importadas puedes establecer magFilter/minFilter como THREE.NearestFilter cuando estén cargadas; la imagen usa un atlas de baja resolución y mapas UV. Ejemplo dentro del callback:

```js
gltf.scene.traverse((obj) => {
  if (!obj.isMesh) return;
  const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
  for (const mat of mats) {
    if (mat.map) {
      mat.map.magFilter = THREE.NearestFilter;
      mat.map.minFilter = THREE.NearestFilter;
      mat.map.needsUpdate = true;
    }
  }
});
```

## Modelos incluidos

| Archivo | Árbol | Altura (ft) | Primera hoja (ft) | Triángulos |
| --- | --- | ---: | ---: | ---: |
| `01_roble_verde.glb` | Roble verde | 45.0 | 28.72 | 692 |
| `02_roble_otonal.glb` | Roble otoñal | 43.0 | 27.44 | 692 |
| `03_cerezo_rosa.glb` | Cerezo rosado | 25.0 | 15.96 | 692 |
| `04_pino_alto.glb` | Pino alto | 65.0 | 22.32 | 181 |
| `05_pino_delgado.glb` | Pino delgado | 48.0 | 16.48 | 181 |
| `06_pino_nevado.glb` | Pino nevado | 46.0 | 15.67 | 251 |
| `07_abedul_verde.glb` | Abedul verde | 40.0 | 25.53 | 692 |
| `08_abedul_otonal.glb` | Abedul otoñal | 38.0 | 24.25 | 692 |
| `09_arbol_seco.glb` | Árbol seco | 35.0 | Sin hojas | 308 |
| `10_manzano.glb` | Manzano | 18.0 | 11.49 | 1052 |
| `11_pino_joven.glb` | Pino joven | 12.0 | 4.04 | 133 |
| `12_pino_oscuro.glb` | Pino oscuro | 58.0 | 19.92 | 205 |

## Consideraciones para Blakpine-Wood

- Se utiliza el convenio **1 unidad 3D = 1 ft** como escala de exportación; el código del motor documenta **5 ft por celda** como valor usual (`project.units.feetPerCell`). Confirmar que la transformación de escena no reescale los assets al importar.
- El motor debe importar los GLB con `GLTFLoader` o el cargador equivalente compatible con tu versión de Three.js; la integración a código **no viene incluida**.
- La colisión del tronco debe configurarse en el juego si se requiere; este pack no trae colisionadores.
- No se modificó el contrato JSON `forest-horror-map-v1` ni archivos del editor/motor.
- Esta entrega es un ZIP de recursos solicitado expresamente, **no** un commit o PR al repositorio.
