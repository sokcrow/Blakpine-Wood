# Forest Horror — Biblioteca unificada de props 01–06

**Versión 06 · 78 props GLB + 78 miniaturas PNG.** Este paquete reemplaza los ZIP individuales de packs anteriores. Se conserva la escala del proyecto y los 77 GLB de los packs 01–05 sin modificación.

## Colecciones

| Pack | Contenido | GLB |
|---|---|---:|
| 01 | Mobiliario doméstico | 8 |
| 02 | Cocina y utensilios | 25 |
| 03 | Cajas de delivery | 3 |
| 04 | Oficina y electrónica retro | 21 |
| 05 | Baños y sanitarios | 20 |
| 06 | Cámara de seguridad con cabezal giratorio | 1 |
| **TOTAL** | | **78** |

## Estructura

- `modelos_glb/`: 78 modelos 3D, texturas pixeladas integradas.
- `miniaturas/`: 78 miniaturas PNG 256×256, de los GLB exportados.
- `catalogo_muebles.json`: IDs, medidas, rutas, categorías, packs y metadatos.
- `catalogo_pack06.json`: ficha del prop de seguridad.
- `muebles.js`: constructores procedurales y `FH_MUEBLES.createFurniture(...)`; en la cámara incluye una vista previa con el nodo `CAM_YAW`. El GLB es el asset definitivo.
- `visualizador.html` y `textos_es.js`: catálogo y panel 3D. En un servidor HTTP, el visor carga el GLB real de la cámara mediante `GLTFLoader`; si se abre mediante `file://`, muestra su equivalente procedural.
- `camara_seguridad_controller.js`: controlador **opcional**, no conectado al motor; reproduce el clip incluido `Barrido_Seguridad` con `THREE.AnimationMixer`.
- `reporte_topologia.json`, `reporte_pack06.json`: inventario técnico.
- `hoja_miniaturas.png`, `hoja_miniaturas_seguridad.png`: vistas de referencia.
- `pruebas_catalogo.js`, `validar_entrega.py`, `validar_pack06.py`: comprobaciones de la biblioteca.

## Abrir el visualizador

Para navegar por la biblioteca, abre `visualizador.html` con un navegador compatible con WebGL y conexión a internet (Three.js r128 se obtiene por CDN). Para **ver la cámara con la textura exacta del GLB**, sirve esta carpeta por HTTP:

```bash
python -m http.server 8000
```

Después visita `http://localhost:8000/visualizador.html`. Si no hay conexión o se abre como archivo, se conserva el preview procedural de la cámara; los GLB originales están todos dentro del paquete.

## Cámara de seguridad (Pack 06)

- ID: `camara_seguridad`
- Medidas: **1.75 × 2 × 1.25 ft** (ancho × fondo × alto), posición de montaje propuesta a **7 ft**.
- GLB: **196 triángulos**, **2 mallas** (soporte fijo y cabezal), **1 material** y textura Pixel Art.
- Nodo giratorio: `CAM_YAW`, eje Y, giro previsto **±48°**.
- Animación GLB: `Barrido_Seguridad`, duración 7.2 segundos, bucle opcional.
- Rig de tipo **nodo transform**, no es un esqueleto con huesos. Se separan dos mallas porque una debe girar.
- Para usar el clip, después de cargarlo con `GLTFLoader`:

```javascript
const gltf = await new Promise((resolve, reject) => {
  new THREE.GLTFLoader().load('modelos_glb/camara_seguridad.glb', resolve, undefined, reject);
});
scene.add(gltf.scene);
const controlador = FH_CAMARA.bind(gltf, THREE);
// En tu bucle de render, donde deltaSeconds es el tiempo del frame:
controlador.update(deltaSeconds);
```

**Esto no integra automáticamente la cámara con el motor.** El motor debe registrar los props y controlar la animación, posición, y futura lógica de vigilancia.

## Escala y optimización

- Unidades del catálogo: pies (ft), paso mínimo de 0.25 ft, ancho máximo 15 ft.
- Escala Three.js GLB: 1 ft = 0.3048 m. Cuadrícula de referencia: 1 tile = 5 ft.
- Cámara: 2 mallas / 1 material por necesidad de movimiento; los otros 77 GLB: 1 malla / 1 material.
- Triángulos de los 78 props: **13,736** (13,540 anteriores + 196 cámara).
- Para multitud de instancias del mismo GLB, conviene reutilizar geometrías/materiales y aplicar instancing donde sea compatible con su animación.
- `exportar_glb.py` y `crear_miniaturas.py` regeneran los props procedurales previos, **no** el GLB riggeado de la cámara, que debe conservarse como archivo original.

## Verificaciones

Ejecuta `node pruebas_catalogo.js` para comprobar tamaños y la huella del catálogo. Ejecuta `python validar_pack06.py` para comprobar los 78 GLB y PNG, que el clip `Barrido_Seguridad` exista y que los assets previos no hayan cambiado. El ZIP final también se valida mediante `zipfile.testzip()`.

La carga WebGL y el rendimiento en un teléfono real dependen del dispositivo. No se ha alterado el motor, los mapas, las colisiones ni la iluminación de Forest Horror.
