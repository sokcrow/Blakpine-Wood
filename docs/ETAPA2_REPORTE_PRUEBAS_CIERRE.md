# Etapa 2 — Reporte de pruebas de cierre

**Responsable:** IA 5, calidad. **Fecha:** 17 de noviembre de 2026.
**Repositorio:** `sokcrow/Blakpine-Wood`. Node `v24.22.1`, Linux.
**Base main verificada:** `4e69a954150b2c9fa104fa26d827ec9eed3e955f`.

## Dictamen

Las dos suites de A3 se recuperaron sin modificaciones y se publicaron en el
[PR #209](https://github.com/sokcrow/Blakpine-Wood/pull/209), directamente contra
`main`, con **solo esos dos archivos de pruebas**. Está abierto, sin fusionar:
la incorporación a `main` aún requiere su revisión/fusión por el responsable.

A4 se reprodujo con un presupuesto de 40 segundos y se diagnosticó sin cambiar
código: la suite completa termina con 19 casos aprobados al disponer de más
tiempo. En el comando estándar tardó **115,96 s**; una ejecución diagnóstica
sin aislamiento del archivo tardó **88,45 s**. No se observó un bloqueo permanente
ni un fallo de aserción en esas ejecuciones completas. El límite externo de
40 s es inferior al trabajo que efectivamente realiza el harness en este entorno.

Los módulos nuevos de IA 2, 3 y 4 también se probaron juntos, sobre un árbol
temporal identificado abajo. **No procede declarar cerrada toda la Etapa 2:**
persisten el puerto de combate real ausente, la integración de persistencia y
lectores en el motor, y la comprobación jugable de Legacy, bloqueada por WebGL.

## Estados utilizados

| Estado | Significado |
| --- | --- |
| PASS | La comprobación indicada se ejecutó y cumplió sus aserciones. No amplía su alcance a gameplay no probado. |
| FAIL | El intento indicado terminó con un error observado. Se distingue fallo de entorno de fallo de aserción. |
| TIMEOUT | Se alcanzó el límite externo de tiempo; no implica que los casos sin resultado hayan pasado o fallado. |
| NO EJECUTADA | La comprobación objetivo no pudo realizarse o permanece pendiente. Un TODO no se cuenta como PASS. |

## A3 — Recuperación exacta del PR #203

El [PR #203](https://github.com/sokcrow/Blakpine-Wood/pull/203) figura fusionado,
pero su base era `ia4/etapa2-legacy-combat-bridge`, no `main`. Sus archivos no
estaban en la base main examinada. Se obtuvieron del head
`71971a832920017f08bbe8d1206328468d468cfe` mediante el ref `pull/203/head`, sin
cherry-pick de commits de producción.

| Archivo recuperado | Blob original y entregado |
| --- | --- |
| `tests/multimode-runtime.test.cjs` | `b074cfed70e8e64b4ee138a936629c10eaf2f595` |
| `tests/multimode-compatibility.test.cjs` | `c2256586ee3a204dee0cbe98dfe204c8909ddee8` |

Árbol Git resultante, main + esas dos suites:
`bc6ab2af703a86c39cba96f290e04ec98c564650`.
Commit publicado en #209: `378565c8179acd1522de60a89e021c3981b90af3`.

```sh
TMPDIR="$PWD" node --test tests/multimode-runtime.test.cjs tests/multimode-compatibility.test.cjs
```

**PASS:** 27 aprobadas, 0 fallidas, 0 canceladas, 0 omitidas, 0 TODO; duración
informada por Node **318,09 ms**. `git diff --cached --check`: PASS. El listado
remoto del PR confirma exclusivamente esos dos archivos, 327 líneas añadidas.

Los casos positivos de adaptadores y la operación de ataque conservan fixtures
sintéticas de importes fijos. Los módulos, esquemas/validador y mutadores
`FHSurvival` sí son reales. No se añadieron fórmulas ni producción para aprobarlos.

## A4 — Diagnóstico del tiempo de arranque

Se inspeccionaron `juego/assets/fh-preview-boot.test.js`,
`tests/helpers/forest-engine.cjs`, el ensamblador de `index.html` y los 13
fragmentos `engine-00.js` a `engine-12.js`, sin modificarlos.

| Ejecución en main + suites recuperadas | Estado | Resultado |
| --- | --- | --- |
| `timeout 40s node --test --test-reporter=spec juego/assets/fh-preview-boot.test.js` | TIMEOUT | Salida 124. Node registra interrupción/cancelación del archivo y «Promise resolution is still pending but the event loop has already resolved». No hay total de aserciones aprobadas atribuible a esa ejecución. |
| Ejecución diagnóstica con envoltorio temporal que requiere la suite y mide CPU, límite 180 s | PASS | Salida 0; 19/19, 0 fallos; 88.446,84 ms según Node. CPU de proceso: 39,47 s usuario y 49,80 s sistema. No hubo cambios en la suite o producción. |
| `timeout 180s node --test --test-reporter=spec juego/assets/fh-preview-boot.test.js` | PASS | Salida 0; 19/19, 0 fallos/cancelaciones/omitidos/TODO; 115.959,20 ms. Comando estándar, sin instrumentación. |
| Caso «construcción se instala», con CPU profiler y límite 40 s | PASS | 1/1, salida 0; 13.108,83 ms para el caso, 13.157,39 ms total. La instrumentación añade coste; no se compara como benchmark con las ejecuciones sin profiler. |

**Causa comprobada de la interrupción a 40 s:** presupuesto insuficiente para
el tiempo observado de esta suite en este entorno. El mensaje sobre una promesa
pendiente aparece en la ejecución interrumpida; no demuestra por sí mismo que
una promesa del juego esté en deadlock.

**Trabajo del harness que contribuye al tiempo:** `integrationEnvironment()`
crea contextos VM, evalúa los 13 fragmentos, decodifica y vuelve a ensamblar el
motor en múltiples casos. Los fragmentos suman **11.451.110 bytes** en disco.
Los casos de composición consumen varios segundos cada uno. En la ejecución
diagnóstica, la suma de duraciones de los 19 casos fue 88.379,24 ms, muy próxima
al total de 88.446,84 ms; el caso más lento duró 9.163,47 ms. Hay trabajo
distribuido entre casos, no una única espera que impida terminar en esa ejecución.

Se ejecutó también un perfil CPU de un solo caso, sin alterar sus fuentes:

```sh
timeout 40s node --cpu-prof --cpu-prof-dir=.. --cpu-prof-name=ia5-boot.cpuprofile --test --test-isolation=none --test-name-pattern='construcción se instala' juego/assets/fh-preview-boot.test.js
```

Las muestras con mayor tiempo propio se localizaron en `prepareGLBEngineDoc`
(aprox. 1.907 ms), `addLightToEngine` (1.419 ms), `addDeliveryToEngine` (839 ms)
y `addLiveTextToEngine` (774 ms). Esto aporta evidencia de coste del ensamblado
invocado repetidamente por el harness, no de una espera de red o del combate
multimodo. Son tiempos de muestreo de ese caso instrumentado, no duración
universal de esas funciones. No se modificaron para reducir u ocultar el coste.

**Entorno comprobado:** `/tmp` no existe. Las pruebas que crean fixtures y el
primer intento de Playwright fallaron inicialmente por ello; se estableció
`TMPDIR="$PWD"` para esas comprobaciones. No se detectó que la suite de arranque
requiera ese directorio: el comando estándar completo pasó sin ajustar TMPDIR.
No se confunden estos dos problemas. La variación 88–116 s no permite atribuir
un porcentaje preciso del coste a VM, asignación de memoria o sistema operativo.

**Atribución a Etapa 2:** no hay evidencia de regresión causada por los PR nuevos.
Se compararon #206, #207 y #208 con la base: no cambian esta suite, su helper,
`index.html` o los fragmentos del motor. Ni la suite ni `index.html` importan
los módulos multimodo nuevos. Sus pruebas se completan separadamente.
Esto no certifica el rendimiento de toda revisión histórica ni el navegador.

No se aumentó un timeout en código, se quitaron casos o se alteró producción
para fabricar un resultado. Para repetir esta suite en este entorno conviene
darle un presupuesto externo explícito que abarque sus tiempos medidos. Una
optimización futura podría reutilizar partes inmutables del ensamblado, pero
debe conservar el aislamiento entre casos y no forma parte de esta entrega.

## Verificación conjunta de IA 2, IA 3 e IA 4

Se creó un checkout temporal desde la misma base main y se incorporaron solo
los módulos/tests pertinentes de los siguientes heads, además de las suites
recuperadas. **No se fusionaron esos PR ni se incluyó su producción en #209.**

| Entrega | Head probado |
| --- | --- |
| IA 2, [#206](https://github.com/sokcrow/Blakpine-Wood/pull/206) | `d4ccf78f051a9cd38b521bc9f117bacab4c051e4` |
| IA 3, [#207](https://github.com/sokcrow/Blakpine-Wood/pull/207) | `cf72c65fbe62543dc4e222347b082d2d0371572d` |
| IA 4, [#208](https://github.com/sokcrow/Blakpine-Wood/pull/208) | `2e8dc3fac5c2a165fe2f68341a046f1ea7e75bd5` |

Árbol de integración medido con `git write-tree`:
`b003c211eb49c7931d1ba09394d2b5853b69fb97`.
Ese identificador describe el índice temporal probado, no un commit fusionado.

```sh
TMPDIR="$PWD" node --test tests/multimode-save-isolation.test.cjs tests/multimode-resource-reader.test.cjs tests/legacy-combat-integration.test.cjs tests/multimode-runtime.test.cjs tests/multimode-compatibility.test.cjs tests/mode-session.test.cjs tests/world-profile-loader.test.cjs tests/legacy-combat-bridge.test.cjs
node contratos/multimodo/validar-contratos.mjs
```

| Comprobación | Estado | Evidencia y límite |
| --- | --- | --- |
| Conjunto focalizado | PASS | 108 aprobadas, 0 fallidas, 0 canceladas/omitidas; **1 TODO adicional**, separado de las aprobadas. Total enumerado 109, duración 9.559,98 ms. |
| Persistencia aislada IA 2 | PASS | 9 casos. DnD/Moon con mismo mapa/personaje/slot, claves distintas, rechazo cruzado, identidades/versiones, selectores Legacy reales y claves Legacy preservadas en fixtures. |
| Persistencia multimodo en padre/iframe del juego | NO EJECUTADA | Módulo no integrado en la lectura/escritura/restauración/sincronización real. Fixtures no certifican protección jugable. |
| Recursos y perfiles IA 3 | PASS | 18 casos nuevos, tres perfiles y nueve pares existentes; FS real, rutas/allowlist/symlinks y validadores reales. Transporte web simulado en VM: origen, redirecciones, MIME, tamaño, timeout. |
| Lector multimodo instalado en el arranque HTTPS real | NO EJECUTADA | No se instaló en el motor. La simulación HTTP no equivale a despliegue ni inspecciona aliases del servidor. |
| Enlace modular de daño IA 4 | PASS | 15 casos nuevos ejecutados: puente y FHSurvival reales; capacidad/puerto de motor sintético, aplicación PG/SP única, crítico, deduplicación, revisión, cierre y fallos parciales. |
| Combate conectado `tick` real → coordinador → `attack` privado → consumidor real | NO EJECUTADA | El runtime real carece de `connectCombat`. Se verifica su rechazo; el TODO explícito no pasa a PASS. No se acredita protección de PE/RNG/cooldown de esa ruta integrada. |
| Contratos canónicos en árbol conjunto | PASS | 846 aserciones, 3 mundos, 3 reglamentos y 9 combinaciones estructurales; no nueve modos jugables. |

## Sesión Legacy en navegador

Se intentó primero Chromium headless local mediante Playwright. El paquete y
`/usr/bin/chromium` existen. Tras corregir el directorio temporal, el proceso
falló en `chrome/browser/process_singleton_posix.cc`: `socket() failed:
Operation not permitted`. **FAIL de lanzamiento por entorno**, anterior a
cargar la aplicación; no se atribuye al juego. No se solicitaron ni usaron
escalaciones de permisos para sortearlo.

Después se usó el navegador remoto disponible sobre
`https://sokcrow.github.io/Blakpine-Wood/`. Es la publicación observada; no se
verificó su SHA de despliegue y no se presenta como ejecución del árbol temporal.
No se modificó código desde consola ni se instalaron parches.

| Paso observado en UI real | Estado | Evidencia |
| --- | --- | --- |
| Abrir editor, cargar ejemplo arquitectónico y colocar spawn | PASS | El editor mostró 4 habitaciones y el jugador de prueba. Se usó el flujo normal de UI. |
| Crear personaje Legacy sin selección multimodo | PASS | Asistente completo con personaje `QA Etapa 2`, fortalezas/debilidades y confirmación PG 38, SP 16, PE 18. |
| Lanzar 3D, entregar mapa y alcanzar creación del renderer | FAIL | Diagnóstico visible «No se pudo iniciar el juego 3D: Error creating WebGL context». Logs: `THREE.WebGLRenderer: Error creating WebGL context`, en `startGame`, tras las etapas «Cargar scripts y recursos» y «Validar mapa». |
| Caminar, interactuar, recibir ataque y verificar guardado/restauración durante una sesión jugable | NO EJECUTADA | No se obtuvo contexto WebGL. No hay evidencia para dar PASS ni para atribuir ese error a Etapa 2. |

El error de WebGL del navegador es distinto del tiempo de las pruebas Node/VM.
El intento real se realizó y documenta un bloqueo de capacidad gráfica; una
sesión jugable Legacy completa todavía requiere un navegador con WebGL operativo.

## Alcance y pendientes de cierre

No se modificaron producción, `index.html`, ensamblaje del iframe, Base64,
mapas, perfiles, contratos JSON, manifiestos, estadísticas ni workflows.
No se fusionó ningún PR ni se esperaron checks ajenos.

El reporte se entrega en un PR documental independiente para que #209 contenga
exclusivamente las dos suites solicitadas. Las comprobaciones de A3 y módulos
aislados tienen PASS dentro de su alcance; la carrera completa de combate,
persistencia instalada y sesión jugable siguen pendientes. No se fabrica un
PASS integral a partir de mocks, TODO o un error de WebGL.
