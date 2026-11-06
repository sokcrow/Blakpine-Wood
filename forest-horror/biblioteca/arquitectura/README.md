# Forest Horror — Kit 01 · Puertas y ventanas

Recursos importados de \`Forest_Horror_Kit_01_Puertas_y_Ventanas.zip\`.

## Estructura

- \`modelos_glb/\`: cinco modelos estructurales en metros (1 casilla = 1.524 m).
- \`texturas/\`: cinco atlas pixel art con filtrado NEAREST.
- \`miniaturas/\`: vistas de catálogo de los cinco modelos.
- \`catalogo_arquitectura.json\`: catálogo separado del mobiliario.
- \`kit_01.sha256\`: huellas exactas de los quince recursos del ZIP.
- \`generar_kit.py\`, \`generar_miniaturas.py\`: generadores reproducibles del paquete.

## Uso dentro de Blakpine Wood

El editor continúa creando segmentos \`type:'door'\`, \`type:'peephole_door'\` y \`type:'window'\`, sin muebles ficticios. \`juego/assets/fh-architecture-skins.js\` sustituye únicamente el aspecto 3D:

- Puerta sencilla de madera → \`puerta_madera.glb\`.
- Puerta sencilla metálica → \`puerta_metal.glb\`.
- Puerta con mirilla → \`puerta_mirilla.glb\`.
- Ventana → \`ventana_clasica.glb\` o \`ventana_dividida.glb\`.

La selección de ventana se guarda en el campo opcional \`windowSkin\`; ausencia o valor desconocido utiliza \`clasica\`. Los mapas anteriores siguen siendo \`forest-horror-map-v1\`.

Las puertas dobles, las puertas de garaje y las acristaladas conservan su aspecto anterior por ahora. El ángulo de apertura actual no se modifica en esta tarea. Los eventos, la interacción de mirilla, las llaves, las colisiones, el FOW y la iluminación siguen dependiendo del motor.

Si GLTFLoader o un GLB no se carga, el aspecto original se conserva. Para servir los archivos, se recomienda ejecutar el editor desde un servidor HTTP local.

## Pruebas

\`node --test juego/assets/*.test.js\`

La automatización de GitHub reconstruye los binarios con las versiones fijadas de NumPy, Pillow y trimesh, comprueba los quince SHA-256 del ZIP y ejecuta la suite del motor. La inspección visual en un navegador WebGL y FPS en móvil se deben validar manualmente.
