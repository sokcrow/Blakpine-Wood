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
