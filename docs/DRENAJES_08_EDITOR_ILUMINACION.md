# Blakpine-Wood — Drenajes 08 · Corrección de la propuesta visual e iluminación de mantenimiento

> **Tipo:** especificación corregida, basada en el código de `main` inspeccionado el 13-11-2026 (`a0923a994e4ab57523e5455b8939c0b96a9dc515`).
> **Estado:** propuesta de cambios **no implementados**. Este documento no afirma que haya luminarias eléctricas de mantenimiento instaladas en los drenajes.
> **Objetivo único de este PR:** reemplazar las suposiciones de una propuesta anterior por un plan trazable al código existente. No cambiar gameplay.

## 1. Qué se pidió

- El drenaje del editor no debe verse como una «plasta» plana: deben distinguirse **canal de agua, banqueta, muro, aperturas, puente/reja y cambios de nivel**.
- Los drenajes necesitan **luminarias discretas de mantenimiento en las paredes**, alimentadas por electricidad real y con un alcance deliberadamente pequeño.
- Deben verse con claridad tanto en la edición como en la vista 3D sin alterar automáticamente la física, la hidráulica, la visión del jugador o los mapas existentes.

No se ha aprobado todavía una potencia exacta, altura fija, intervalo entre focos, color definitivo ni política de respaldo eléctrico. Esos valores no se inventan como hechos.

## 2. Estado verificado en el código

| Tema | Implementación encontrada | Implicación |
| --- | --- | --- |
| Drenajes 2D | `FHDrainage.draw2D()` pinta una base uniforme `#384347`, rellena el agua con `#376f80`, traza las paredes derivadas de `nativeComponents()` y representa la reja con franjas. | **Aquí está el origen concreto** de la poca diferenciación del editor. Hay que mejorar esta función, no sustituir el modelo del mapa. |
| Perfiles | `FHDrainage.SIZES` contiene rectas, codos, T, cruces y callejones de 10×10 y 4×4, más el desagüe de 20×20. | El estilo debe contemplar todos los perfiles y sus rotaciones. |
| Canales y paredes | `rects()`, `channelRects()`, `nativeComponents()` y `cutFloorRects()` ya describen geometría/aberturas; el motor expande a arquitectura nativa. | **No** dibujar paredes arbitrarias ni introducir una segunda topología. |
| Agua, profundidad y reja | `WATER_LEVEL=-0.2`, `CHANNEL_BOTTOM=-0.42`, `BRIDGE_TOP=0.025`; existen `channelSolid()`, `bridgeSolid()` y `supportAt()`. | No presentar el agua como una placa sólida ni recrear una segunda física. |
| Accesos | `FHDrainageAccess` conecta respiraderos de calle/edificio con su piso inferior y admite luz solar filtrada en rejillas exteriores. | Esa luz **no es** iluminación eléctrica de mantenimiento. |
| Luces del mapa | `FHLights.PRESETS.wall_sconce` y `wall_flood` ya existen; el objeto persistente es `type:'light_fixture'`. | Reutilizar el aplique de pared en lugar de inventar un `maintenanceLighting` como segundo sistema. |
| Cobertura | `FHLightCoverage` utiliza `lightRadiusFt`, `lightDimFalloffFt`, dirección, cono y bloqueo por muros; el editor tiene herramienta de cobertura. | Mantener una sola lógica de alcance; la cobertura geométrica del editor no significa por sí sola que haya suministro. |
| Energía | `fixtureLit()` exige `fixturePowered` y circuito válido (o generación válida), además del estado de alimentación. `FHServices` ofrece `electricalStatus()`. | No alimentar lámparas automáticamente por cercanía, piso o por ser drenaje. |
| Autogeneración de luces | `FHLights.recommended()` devuelve `[]` y `materialize()` devuelve `0`; `resolve()` consume focos expresamente presentes en el mapa. | No reactivar autogeneración global: cualquier colocación asistida debe ser una operación explícita y limitada a drenajes nuevos. |
| Interfaz | `FHDrainageEditor.place()`, `rotate()`, `inspector()` y `FHDrainage.draw2D()` son los puntos actuales de editor. | Integrar la mejora en ese flujo; no inventar rutas, archivos ni componentes que el repositorio no tiene. |

### Fuentes de código consultadas

- [`juego/assets/fh-drainage.js`](../juego/assets/fh-drainage.js) — definición de perfiles, datos, `draw2D`, geometría.
- [`juego/assets/fh-drainage-editor.js`](../juego/assets/fh-drainage-editor.js) — colocación y edición.
- [`juego/assets/fh-drainage-access.js`](../juego/assets/fh-drainage-access.js) — accesos entre plantas y luz solar de rejillas.
- [`juego/assets/fh-lights.js`](../juego/assets/fh-lights.js) y [`juego/assets/fh-light-coverage.js`](../juego/assets/fh-light-coverage.js) — focos, montajes y radios.
- [`index.html`](../index.html) — `fixtureLit()`, edición, renderizado del plano y circuitos.
- [`juego/assets/fh-services-core.js`](../juego/assets/fh-services-core.js) — estado eléctrico.
- [`docs/DRENAJES_02_PREMADES_NATIVOS.md`](DRENAJES_02_PREMADES_NATIVOS.md), [`docs/DRENAJES_06_AGUA_GPU_Y_GEOMETRIA.md`](DRENAJES_06_AGUA_GPU_Y_GEOMETRIA.md) y [`docs/DRENAJES_07_HOTFIX_FPS_VISIBILIDAD_B1.md`](DRENAJES_07_HOTFIX_FPS_VISIBILIDAD_B1.md) — restricciones arquitectónicas, nivel del canal y rendimiento.

## 3. Cambio visual propuesto en el editor

Modificar **solo la presentación** de `FHDrainage.draw2D()` en un PR de código separado:

1. Dibujar la **banqueta seca** con una trama sutil distinta del canal; evitar que las superficies transitables parezcan agua.
2. Usar los rectángulos y contornos existentes para resaltar el **agua**, el borde del canal y su desnivel mediante líneas/sombras 2D. No alterar `rects()`, `channelRects()` ni el nivel físico.
3. Mantener los segmentos de **muro y apertura** obtenidos de `nativeComponents()`, y distinguir visualmente un cierre de una salida conectada; no añadir muros falsos.
4. Dibujar el **puente de reja como barras y huecos**, no como una placa homogénea. Respetar 2×6/6×2.
5. Dibujar marcadores discretos para **accesos** ya existentes, sin solaparlos con el agua ni con su selección.
6. Mantener selección, zoom, rotación de 90°, escalado por `gx/gy` y lectura en móvil. Las tramas o adornos se degradarán a un modo simple al reducir mucho el zoom.
7. La vista superior no debe depender de focos encendidos: incluso sin electricidad deben diferenciarse recorridos y salidas.

**No se requiere para esta mejora:** nueva cámara Three.js, miniaturas renderizadas en vivo, un sistema de pisos paralelo ni nuevos campos JSON. Un modo de corte 3D puede evaluarse como tarea aparte después de verificar coste real.

## 4. Iluminación mural de mantenimiento

### 4.1 Diseño y objeto existente

- Usar un `light_fixture` con `lightKind:'wall_sconce'`, o un modelo equivalente que **respete el mismo contrato existente**, fijado sobre un segmento de pared nativa del tramo.
- Debe apuntar hacia el **pasillo transitable**; no quedar dentro del muro, sobre el canal, tapando un portal o flotando.
- Se prefiere una luz industrial débil, con radios configurables por foco usando **`lightRadiusFt` + `lightDimFalloffFt`**. El ejemplo **5 + 5 ft** es solo una propuesta de balance, no una regla aprobada ni un valor de código vigente para drenajes.
- No imponer la misma cantidad de focos a una recta 10×10, a un 4×4 y a un desagüe 20×20. Altura, espaciado, carcasa y color se resolverán con una inspección visual.
- En la vista del editor, representar el aplique con un ícono pequeño y orientación; diferenciar «sin configurar», «sin alimentación» y «alimentado» cuando esa información sea consultable. No usar solo color para comunicar estado.

### 4.2 Conexión eléctrica real

- El **motor** decide si ilumina. El editor solo configura focos, asociación y herramientas de diagnóstico.
- Aprovechar `fixtureLit()`, circuitos declarados mediante `breaker_panel`, flags de alimentación y el servicio `FHServices.electricalStatus()`; comprobar en código qué campos y vínculos concretos necesita un aplique de drenaje antes de implementar.
- **No** suponer que el aplique de B1 recibe electricidad del breaker de PB sin un circuito válido.
- Sin alimentación válida, la lámpara debe quedar **apagada**. No se crea un circuito ficticio para que luzca encendida.
- Un modo de emergencia requiere fuente de reserva **real** y una tarea separada; **no está implementado aquí**.

### 4.3 Colocación asistida sin contradecir el sistema actual

Actualmente el juego **no genera focos automáticamente**; reactivar `recommended()` / `materialize()` para todos los mapas causaría regresiones.

Propuesta concreta: ofrecer, al crear o seleccionar un premade, una **acción explícita** «Añadir luces de mantenimiento» que genere objetos `light_fixture` normales, anclados en paredes verificadas. Las luces pasan a ser objetos autorados/guardados en el mapa y deben poder revisarse, retirarse y conectarse.

Antes del PR funcional habrá que verificar cómo resolver correctamente `roomId`, `zoneId`, `wallId`, `rotation`, altura y la relación con el `room` que genera `expandProject()` solo para el motor. **No** asumir que el cuarto virtual del drenaje equivale a una habitación persistida por el editor.

La regla deseada de «iluminación de mantenimiento disponible» se cumple cuando el creador coloca/configura esas luces y las conecta a un circuito real. La política de generación por defecto al colocar una pieza **queda pendiente de decisión**, porque afecta el comportamiento de autogeneración y a mapas nuevos.

## 5. Contrato y compatibilidad

- Conservar **`forest-horror-map-v1`** y los premades con `type:'hall'` y `drainage:{version:1,kind,flowTo}`.
- Los focos deben ser `light_fixture` ordinarios; **no** agregar el bloque especulativo `maintenanceLighting` ni los campos `powerBinding` / `emergencyBackup` sin validar que se necesiten.
- Si después se propone un campo nuevo, será **opcional** con valor por defecto y pruebas de importación/exportación.
- Mapas históricos sin focos nuevos mantienen su apariencia y comportamiento eléctrico previos: **no insertar iluminación al cargar**.
- La mejora gráfica no modifica `walk()`, `canWalk()`, visibilidad/FOW, corrientes, inundación, remolino, colisiones, soportes ni el render 3D.
- Conservar los textos de jugador en español y centralizarlos en [`fh-drainage-strings.js`](../juego/assets/fh-drainage-strings.js) u otro archivo de cadenas **existente y pertinente**.
- Sin dependencias nuevas. Vigilar el coste de luces dinámicas y la previsualización de mapas grandes (objetivo de proyecto: 60 FPS en móvil medio, **no medidos aquí**).

## 6. División propuesta en cambios de código

**PR A — Claridad del plano de drenajes.** Objetivo único: mejorar el dibujo 2D. Archivos candidatos verificados: `juego/assets/fh-drainage.js` (`draw2D`) y tests del drenaje. Sin cambios a energía.

**PR B — Colocación explícita de apliques.** Objetivo único: crear/editar `light_fixture` mural normal desde el flujo de drenajes. Candidatos: `fh-drainage-editor.js`, `fh-drainage-strings.js` y las funciones de montaje existentes en el editor. Requiere primero comprobar y aprobar `roomId/zoneId/wallId` y anclaje.

**PR C — Alimentación y comprobación funcional.** Objetivo único: comprobar/ajustar la compatibilidad del foco de drenaje con `fixtureLit` y `FHServices` sin circuito paralelo. La necesidad de modificar código se determinará con un caso mínimo real.

**PR opcional — Vista de corte 3D/diagnóstico de energía.** Solo si aporta legibilidad y rendimiento aceptable; no forma parte del primer arreglo.

Cada PR de implementación exige **confirmación del alcance, plan de 5–10 líneas y pruebas** según las reglas del proyecto.

## 7. Criterios de aceptación para implementación futura

**Visual 2D**
- [ ] Se reconocen canal, banquetas, muros, conexiones y rejas en recta, curva, T, cruce, extremos y desagüe.
- [ ] Uniones 10×10 ↔ 4×4 respetan huecos reales y no aparentan muros inexistentes.
- [ ] El editor sigue permitiendo seleccionar, arrastrar, girar y exportar las piezas; legible con zoom reducido.
- [ ] No hay impacto en el agua 3D, su shader, la geometría física ni la visibilidad por pisos.

**Luz/energía**
- [ ] El aplique tiene anclaje y orientación válidos en una pared real, no en agua o abertura.
- [ ] Un `light_fixture` de mantenimiento conectado se enciende con circuito activo y se apaga con corte o falta de conexión.
- [ ] Respeta radios brillante/tenue y oclusión del sistema existente, sin ampliar artificialmente la estadística `Vis`.
- [ ] Funciona en el piso de drenaje correspondiente; no hay electricidad transferida implícitamente desde otro piso.
- [ ] No aparecen luces nuevas al importar mapas antiguos.
- [ ] No se generan focos duplicados ni huérfanos al repetir la acción, girar o borrar una pieza (según la política que se apruebe).

**Pruebas relevantes existentes** (a ejecutar en los PR de código, **no ejecutadas en esta revisión**):
```sh
node --test juego/assets/fh-drainage.test.js juego/assets/fh-drainage-access.test.js juego/assets/fh-light-coverage.test.js juego/assets/fh-lights-no-auto.test.js
node --test tests/fh-services-core.test.js
```
Prueba manual pendiente: [`tests/fixtures/drainage-solid-visual.html`](../tests/fixtures/drainage-solid-visual.html) y editor real en navegador/WebGL; validar consumo de FPS en móvil. Esa fixture tiene luces auxiliares para la prueba y **no demuestra** mantenimiento eléctrico conectado.

## 8. Revisión y estado de entrega

**Hechos comprobados:** existencia de las rutas, nombres de funciones, tipos de datos y condiciones referidas en la sección 2 mediante lectura del código de `main`.

**No comprobado:** funcionamiento interactivo en navegador, estado de los focos en un drenaje concreto, potencia o rango final recomendado, FPS de hardware ni integración eléctrica ya implementada para apliques en premades.

**Este PR cambia:** únicamente este documento.

**Este PR NO cambia:** `index.html`, `juego/assets/*.js`, assets 3D, JSON, motor Base64, hidráulica, colisiones, servicios ni electricidad.

**Pruebas automáticas ejecutadas para este documento:** ninguna. **Validación:** `PASS` como especificación auditada contra fuentes; `NEEDS WORK` para implementación real, todavía inexistente.
