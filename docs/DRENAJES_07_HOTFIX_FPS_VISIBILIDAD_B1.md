# Hotfix — drenajes: rendimiento y visibilidad desde B1

## Problema observado
Tras el PR #160 se reportaron bajones importantes dentro del drenaje y visibilidad de la planta superior desde B1.

## Costes concretos encontrados
- El desagüe 20×20 creaba una malla de agua y una caja de fondo por cada recorte rectangular.
- Las dos máscaras de ruido se ejecutaban por fragmento y la superficie transparente exigía trabajo adicional de composición.
- El bucle visual actualizaba inundaciones y anillos de todos los pisos cada fotograma.
- La función de recorte de suelos reconstruía canales al procesar repetidamente losas y áreas.
- La geometría del agua consultaba la topología varias veces al construir una sección.

## Corrección
- Un `BufferGeometry` para toda la superficie de cada sección, con atributos de flujo por vértice.
- Tres máscaras procedimentales conservadas: altura, ondulación A y ondulación B; se evalúan en el *vertex shader*, mientras el *fragment shader* solo interpola y colorea. La superficie es opaca con `depthWrite`.
- Desaparecen los fondos geométricos redundantes ocultos tras el agua opaca.
- El bucle actualiza geometría dinámica **solo del piso activo**.
- Los canales del suelo se recortan mediante caché por planta **solo en la vista 3D de un mapa inmutable**. El editor sigue usando el cálculo sin caché, para ver modificaciones.
- La topología se calcula una vez para el registro visual de un mismo proyecto.

## Visibilidad vertical
En B1 y demás plantas bajo PB no se muestran proxies de fachada, remates o terreno de plantas vecinas. La comprobación se hace antes de los bucles de visibilidad y se refuerza en `FHFloorVisibility.facadeCandidate`. La escena activa, los pasillos, escaleras y la luz filtrada por rejillas mantienen sus propios sistemas sin revelar PB.

## Compatibilidad y límites
Se conserva `forest-horror-map-v1`, sin cambiar JSON, navegación, colisiones, agua potable, física de corrientes ni motor Base64. La reducción de mallas, trabajo de fragmentos y llamadas por fotograma se comprueba con tests de contrato. **La recuperación de FPS en un móvil real y la prueba visual del B1 necesitan medición manual**; la CI no mide fotogramas.

## Hotfix de geometría y apoyo (reportado tras probar el drenaje en 3D)

La versión anterior dibujaba **solo un agua flotante** y la reja se construía como una caja con rayas; tampoco había una altura de apoyo asociada a esos objetos. Esto no era una implementación funcional de piso/puente.

- `channelSolid()` genera un `BufferGeometry` volumétrico por premade: fondo de espesor real a `CHANNEL_BOTTOM=-0.42` tiles, con caras verticales hasta el nivel de la banqueta. Los bordes que conectan con otro canal no llevan tabique duplicado.
- `bridgeSolid()` crea una malla 3D abierta de largueros y barras de acero. No hay caja opaca debajo. Se elimina también el suelo `concrete` que el motor generaba automáticamente por interpretar la reja como un área genérica.
- `supportAt()` integra la posición del jugador con la altura de la geometría. La reja soporta los pies a `BRIDGE_TOP=+0.025` tiles, el fondo del canal a `-0.42`, y la banqueta a `0`. `depthAt()` reutiliza esta función para el ancla del personaje y la cámara.
- Las colisiones horizontales, las puertas y los desplazamientos siguen usando `canWalk()` y `walk()`; no se añade un motor de física separado. El agua a `-0.2` tiles sigue siendo **no sólida**, únicamente visual.
- La reja ahora es un puente sobre el canal, no una placa que se pueda confundir con el agua.

### Prueba visual 3D reproducible

Abrir `tests/fixtures/drainage-solid-visual.html` desde el sitio estático del repositorio. Usa el **THREE vendorizado** y las funciones reales de `fh-drainage.js`, no una imagen estática. Muestra el canal, su fondo, la reja abierta y un avatar de prueba cuya altura se calcula con `supportAt()`. Permite moverse con WASD/flechas, elegir posiciones y ocultar el agua para inspeccionar el fondo.

### Criterios de aceptación manual

1. Con el agua visible, la reja tiene huecos y barras en 3D, sin placa sólida bajo ellas.
2. Al situar el avatar sobre la reja, los pies quedan al nivel de las barras sin atravesarlas.
3. En el canal, el avatar se apoya en el fondo, queda parcialmente sumergido, y al ocultar el agua se distingue el piso y sus paredes.
4. Los bordes de los canales conectados no presentan paredes que corten la conexión.
5. En B1 siguen ocultas las fachadas del nivel superior.
6. Medir FPS sobre móvil real en mapa con varios tramos; la CI no sustituye esta medición.

**Nota:** La prueba visual es un escenario del módulo real con iluminación auxiliar, no una captura de la partida completa. La aceptación visual de gameplay aún requiere revisión en el motor integrado.

## Revisión del PR 162

- Integrada la rama `main` con sus correcciones de CCTV y sombras, conservando ambos sistemas.
- La inundación secundaria queda a `0.005` tiles y su onda máxima añade `0.008`: la cresta de `0.013` queda por debajo de la reja a `0.025`. El canal conserva sus ondas anteriores y ambos usan el mismo material GPU.
- El contacto con agua del desagüe usa los mismos rectángulos que su fondo y superficie, evitando que el actor reciba corriente sobre una banqueta seca o pierda contacto en un borde mojado.
- Las paredes continuas se construyen por intervalos exactos. Un tramo recto aislado pasa de 1.368 a 120 vértices sólidos; las conexiones parciales conservan el hueco exacto sin muestreo cada medio tile. Es una reducción de geometría, no una medición de FPS.
- Tres regresiones con Three.js real comprueban cresta de inundación, rayos contra fondo/reja, contorno y conexiones parciales. Las tres fallan sobre la implementación anterior y pasan con la corrección.
- Una regresión ejecuta `updateAdjacentVisibility()` extraída del motor ensamblado: B1 oculta fachadas y terreno antes del recorrido de visibilidad; PB vuelve al camino nativo.
- Suite local: `node --test juego/assets/*.test.js tests/*.test.* server-sleep-clock.test.mjs`: **1.080 pruebas aprobadas, cero fallos**.
- La CI visual incluye `?small&rain`, conserva las capturas con/sin agua y exige un fotograma renderizado sin error de compilación de shaders. La prueba local de Chromium quedó bloqueada por la restricción de sockets del entorno; no se presenta como validación WebGL completada.

No se cambian el JSON v1, `walk()`/`canWalk()`, reglas de corriente o teletransporte, HUD, assets, dependencias ni fragmentos Base64 del motor. Continúan pendientes la partida completa y la medición en móvil real; mantener el borrador hasta esa aceptación.
