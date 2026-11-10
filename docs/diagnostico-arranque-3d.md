# Diagnóstico del arranque 3D

Comparación: PR #100 (`73613fee`) → `bea3169` (PR #111 integrado).

## Hallazgos comprobados

| Área | Evidencia | Resultado |
| --- | --- | --- |
| Motor embebido | Sin diferencias en `engine-00.js` a `engine-12.js` en este intervalo | El motor base no se eliminó ni reemplazó. Los adaptadores sí cambiaron. |
| Menú del jugador y HUD de ubicación | Sin diferencias en sus archivos JS/CSS desde #100 | La aparición de una interfaz distinta no permite atribuir el fallo a un rediseño posterior a #100. Debe comprobarse qué recursos cargaron. |
| Inicialización de Sombras | `fe9430a` mueve su inicialización después del jugador | El arreglo ya está integrado; las pruebas ejecutan ese fragmento con Three real. |
| Supervivencia | #106 utilizaba `lightBlockers` fuera de su ámbito | #111 corrige una excepción reproducible a oscuras. No demuestra por sí solo que la partida afectada sea jugable. |
| Señal de arranque | Se enviaba RUNNING al retornar `startGame()`, antes del primer `requestAnimationFrame` | Un error del primer fotograma podía dejar una pantalla negra después de anunciar éxito. |
| Excepciones durante juego | La captura original cubría construcción síncrona; no existía un lector de `error`/`unhandledrejection` del iframe | El nuevo lector conserva etapa, mensaje, archivo, línea y stack cuando el navegador los proporciona. |
| GLB de servicios | Carga asíncrona; sus callbacks conservan placeholders ante fallos | No se comprobó que un GLB sea la causa del bloqueo móvil. El lector registra URLs fallidas y avisos de sustitución visual. |

## Cambio de diagnóstico

- El lector se instala antes que Three y los demás scripts del iframe.
- RUNNING y el aviso de mapa listo llegan después de completar render y máscara del primer fotograma.
- Se registran validación, WebGL, escenario, servicios, supervivencia, movimiento, cámara, visibilidad y render.
- Los fallos de scripts, imágenes, estilos, GLB, shaders y contexto WebGL aparecen en el informe.
- El panel está oculto por defecto. Los errores fatales y los recursos fallidos lo muestran automáticamente; las etapas y las cargas normales no lo muestran.
- La flecha junto a «Probar 3D» despliega «Mostrar diagnóstico durante el juego». Su estado se recuerda en el dispositivo y permite ver el panel durante una prueba sin errores.
- El panel ofrece copiar el informe y volver al editor, incluso si falló el menú interno del juego.
- El informe conserva hasta 80 entradas y mantiene el primer error fatal. No serializa el JSON del mapa ni las partidas guardadas y no se transmite automáticamente.
- El estado vivo muestra posición, FPS, transitabilidad, postura, menú/celular/diálogo abierto, estado crítico, llamadas de render, geometrías, texturas y tamaño del canvas. Permite distinguir una animación activa con movimiento bloqueado de una excepción o un render sin geometría.
- El código `3d-diag-20261109-2` permite distinguir esta versión de una página almacenada en caché.
- Si el lector no está disponible, el motor conserva la señal de éxito después del primer render; el lector no es un requisito nuevo para jugar.
- Si un hook del propio lector deja de coincidir, se conserva el motor sin instrumentar y se muestra «Diagnóstico parcial». En ese caso no se certifica el primer fotograma. Un fallo al montar el panel tampoco impide construir el motor.

## Validación y límites

Las pruebas ejecutan el fotograma ensamblado con render simulado y provocan excepciones en movimiento, cámara y render. Verifican que no se anuncie éxito y que no se programe un siguiente fotograma tras la excepción. Otras pruebas cubren recursos fallidos, rechazos de promesas, shaders, contexto perdido, copia, origen del iframe, límite del informe y vigilancia de fotogramas con pestañas ocultas.

La composición de adaptadores se comprueba con servicios, los tres módulos de GLB de servicios, arquitectura y PG estructurales, además de comprobar sintaxis del JavaScript resultante.

Esto valida el lector y el orden de arranque, no certifica renderizado GPU ni jugabilidad móvil. La prueba anterior en el navegador compartido falló al crear WebGL; la prueba local nueva fue bloqueada por la política del navegador para archivos locales. Ninguno de esos bloqueos identifica la causa en el dispositivo del jugador.

## Prueba en el dispositivo afectado

1. Con esta versión integrada y publicada, abrir «Probar 3D».
2. Para verlo durante una prueba normal, desplegar la flecha del editor y activar «Mostrar diagnóstico durante el juego». El panel muestra `3d-diag-20261109-2`.
3. Si falla, copiar el informe. El primer ERROR y su etapa son la referencia para la reparación.
4. Si aparece «Primer fotograma completado» pero sigue negro o no responde, conservar también los avisos de recursos: un render completado no demuestra que todos los modelos o controles estén disponibles.

El usuario confirmó después de #112 que el escenario y el HUD son visibles; su informe mostró 52 FPS y ningún error. La causa de la pantalla negra anterior no quedó identificada por ese informe exitoso. No se revirtió ninguna mejora ni se modificaron mapas o partidas.
