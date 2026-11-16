# Etapa 2 — Auditoría final independiente (IA 6)

Fecha: 16 de noviembre de 2026. Repositorio: `sokcrow/Blakpine-Wood`.

## Dictamen: NEEDS WORK

**No autorizar el cierre integral de la Etapa 2 como integración multimodo jugable.** La preparación desacoplada supera las comprobaciones ejecutadas, pero no existen conexión de combate ni aislamiento operativo de partidas multimodo. Además, las pruebas de IA 5 no están en `main` y la suite completa de arranque no finalizó en este entorno.

**PASS limitado:** 207/207 pruebas seleccionadas, 846 aserciones estructurales, composición y sintaxis del motor real, y un caso aislado de decodificación UTF-8. No se encontraron errores de lógica nuevos confirmados en las rutas aisladas examinadas. No se reprodujeron daño duplicado ni contaminación real de partidas por los módulos nuevos. Esto no certifica navegador, WebGL, rendimiento o combate conectado.

Prioridades: **P1** impide habilitar gameplay multimodo; **P2** impide cerrar su validación o integración; **P3** mejora de mantenimiento, no bloqueante. Una limitación confirmada no equivale a una regresión introducida. Los escenarios provocados con datos sintéticos se identifican expresamente.

## Base, alcance y plan ejecutado

| Elemento | Referencia auditada |
| --- | --- |
| Base anterior a Etapa 2 | `9c5293986664b67f4e21485ebb2f83a2577a4b68` |
| `main` observado por Git y API | `4e69a954150b2c9fa104fa26d827ec9eed3e955f` |
| IA 1, auditoría de integración | PR #199, `2dff401fc908ee4fba830db97e9e8dd2d34c8fe7` |
| IA 2, selección/coordinación | PR #200, `a2bd59938db64dad6608df22633b7a72c46a004c` |
| IA 3, cargador de mundo | PR #201, `c1540f035c8bfe767234a20f2e84552754e2a3a5` |
| IA 4, puente Legacy | PR #202, `69a455b76e669c3f17b7a3dc750e943ff6dc8c81` |
| IA 5, pruebas | PR #203, `71971a832920017f08bbe8d1206328468d468cfe`; fusionado en **`ia4/etapa2-legacy-combat-bridge`**, no en `main` |
| Conjunto usado para ejecutar las suites de IA 5 | `cfcb855e8cda8ab0ed688fb4b352b454be516254`, fusión de #203 |

La comparación de árboles `4e69a95..cfcb855` contiene exclusivamente `tests/multimode-runtime.test.cjs` y `tests/multimode-compatibility.test.cjs`. Por tanto, los módulos de producción ensayados son idénticos a los de `main`, aunque sus dos suites adicionales residen en otra rama. No se creó una fusión para ejecutar la auditoría.

Plan de siete pasos: fijar referencias; comparar con el motor anterior; revisar selección/perfiles/rutas; rastrear daño/eventos/persistencia; revisar contratos/dependencias/autoridad espacial; ejecutar pruebas y contrastar hipótesis; redactar exclusivamente este informe y entregarlo mediante PR sin fusionar.

Se consultaron las instrucciones del proyecto disponibles, el inventario y los contratos multimodo, el informe de IA 1, fuentes reales y pruebas de IA 2–5. No se encontraron `AGENTS.md` versionados. Se hicieron dos pasadas conceptualmente independientes: A centrada en ejecución y seguridad; B centrada en responsabilidades y contratos, antes de sintetizar hallazgos. No se ejecutaron subagentes.

## Auditoría A — Corrección y seguridad

### A1 — P1 — Falta la ruta integrada de ejecución y aplicación única

**Clasificación:** limitación confirmada y bloqueo de integración; no regresión ni doble daño observado.

**Archivos:** `juego/core/fh-session-coordinator.js:30–62`, `juego/rules/legacy/fh-legacy-combat-bridge.js:97–104`, `juego/assets/fh-shadow-ai.js:259–267`, `index.html:4822`.

**Evidencia:** `prepare()` termina en una descripción; no ejecuta reglas ni aplica efectos. El puente devuelve `connected: false` y `evaluate()` rechaza siempre. El motor ensamblado real no contiene `FHModeSelection`, `FHSessionCoordinator`, `FHWorldProfileLoader` ni `FHLegacyCombatBridge`. Sombras todavía consume PE, tira dados y actualiza cooldown antes de emitir `attack`; su consumidor aplica `damagePG`/`change('sp',...)` y después emite `combat:damage`. Las pruebas de deduplicación usan un callback de ataque simulado con cantidad fija y el mutador real de supervivencia; no recorren esa operación privada completa.

**Riesgo:** conectar un segundo resolutor después de `attack` o un aplicador en `combat:damage` duplicaría costes o daño. La deduplicación solo protege una instancia conservada del puente, no una ejecución adicional por la ruta directa ni una recarga.

**Corrección recomendada:** en una tarea posterior, exponer una frontera soportada anterior a PE/RNG/cooldown y conectar una única ruta al dueño del recurso. Mantener la notificación posterior informativa. Probar intención real, repetición, crítico, fallo posterior al descuento y coste/daño únicos con el motor conectado. Hasta entonces conservar los manifiestos `planned` y no anunciar una sesión activa a partir de `prepared`.

### A2 — P1 — El aislamiento de partidas sigue sin implementar

**Clasificación:** ausencia confirmada de aislamiento; contaminación hipotética al habilitar otro reglamento. El mecanismo Legacy es preexistente y no cambió en esta entrega.

**Archivos:** `index.html:1478–1479,3398–3411,5203–5210`; `juego/assets/fh-character-core.js:84–116`; funciones `readGameSave`, `writeGameSave` y `saveProgress` del motor Base64 ensamblado; `tests/multimode-compatibility.test.cjs:83–179` en el commit de IA 5.

**Evidencia:** la clave `fh_game_v1_<hash>` solo identifica el mapa; el perfil global usa `blakpine_character_active_v1`. El lector del iframe acepta `{version:1,state}`, y el filtro de personaje comprueba versión y `characterId`, sin reglamento. `writeGameSave` escribe antes del mensaje al padre. Se ejecutaron las funciones reales extraídas del motor con un almacenamiento en memoria: un estado sintético etiquetado `rulesetId:'dnd'` se escribió y leyó por una clave Legacy ficticia, y `selectMapSave` lo aceptó para el mismo personaje. No se tocó ninguna partida del usuario ni se ejecutó una sesión DnD real.

Las pruebas de IA 5 demuestran ausencia de IO de los módulos desacoplados y guardado Legacy de perfil con su delta esperado. Su clave `fh_game_v1_ia5-sentinel` es un centinela; no ejecutan el ciclo completo de guardado/restauración padre–iframe ni prueban estados reales DnD/Moon.

**Riesgo:** reutilizar el guardado actual para otro reglamento permitiría sobrescritura o interpretación como Legacy, incluidas sincronización de recursos/habilidades y muerte. Un filtro solo en el padre no protege la escritura previa del iframe.

**Corrección recomendada:** definir identidad y versión de guardado por mapa/personaje/reglamento, proteger lectura, escritura, restauración y sincronización en ambos contextos, y acordar compatibilidad/migración antes de habilitar adaptadores. Probar mismo mapa/personaje con reglas distintas, cierre/reapertura, muerte y versiones desconocidas; verificar que las claves Legacy conservan su contenido. No alterar ahora las claves heredadas para ocultar el pendiente.

### A3 — P2 — Las suites de IA 5 no forman parte de `main`

**Clasificación:** defecto confirmado de integración de la entrega de pruebas; no defecto de gameplay.

**Archivos:** `tests/multimode-runtime.test.cjs`, `tests/multimode-compatibility.test.cjs`.

**Evidencia:** GitHub registra #203 fusionado con base `ia4/etapa2-legacy-combat-bridge`; su commit de fusión es `cfcb855...`. `main` permanece en `4e69a95...`, carece de ambos archivos y `git merge-base --is-ancestor 71971a8 origin/main` devuelve 1. La diferencia de árboles son exactamente esas dos suites.

**Riesgo:** un checkout de la rama principal no dispone de la cobertura de 27 casos adicionales ni puede reproducir desde allí el comando de 207 pruebas tal cual.

**Corrección recomendada:** incorporar únicamente las dos suites a `main` mediante una entrega revisable de pruebas, sin reintroducir producción de IA 4, y verificar de nuevo el árbol resultante. Esta auditoría no fusiona PR ni añade esos archivos.

### A4 — P2 — Validación completa de arranque inconclusa

**Clasificación:** bloqueo de verificación reproducido también sobre la base anterior; causa no determinada. No atribuir a Etapa 2.

**Archivo:** `juego/assets/fh-preview-boot.test.js`.

**Evidencia:** la suite completa en `cfcb855` agotó 45 s, salida 124, sin casos aprobados en el resumen y un archivo cancelado. Sobre `9c52939` agotó 35 s con el mismo diagnóstico de promesa pendiente. El caso aislado `decodifica UTF-8` sí terminó: 1/1, salida 0. La composición y el análisis sintáctico independientes del motor completo también finalizaron.

**Riesgo:** faltan evidencias de arranque completo; no es válido extender el PASS de las otras suites a este recorrido. El timeout por sí solo no demuestra un fallo del juego en navegador.

**Corrección recomendada:** localizar el caso o la operación que no termina en un entorno controlado, resolver su causa y ejecutar la suite completa; después verificar navegador/WebGL y sesión Legacy real. Conservar el resultado incompleto en el historial de validación.

### A5 — P2 — La seguridad física de las rutas depende de un lector futuro

**Clasificación:** riesgo condicional de integración; no escape de raíz confirmado en producción.

**Archivos:** `juego/core/fh-mode-selection.js:34–56`, `juego/worlds/fh-world-profile-loader.js:30–55`, sus README y los esquemas canónicos v1.

**Evidencia:** ambos módulos validan antes de leer referencias y delegan IO a `readJson`. Los tests rechazan traversal, URL, rutas absolutas, inexistencia y versiones desconocidas con validación canónica. El CLI estructural comprueba `realpath`, pero no es un lector de runtime instalado. Los lectores de fixtures basados en `path.join(root,p)` no demuestran rechazo de enlaces o redirecciones en una integración futura. Las obligaciones de raíz fija y validación completa están documentadas explícitamente como dependencias de confianza.

**Riesgo:** un lector futuro que acepte symlinks o redirecciones fuera de raíz podría vulnerar el límite aunque la ruta tenga forma válida; un validador permisivo anularía la protección de referencias.

**Corrección recomendada:** ensayar el lector concreto de la plataforma antes de conectarlo: confinamiento real de raíz o URL/origen, redirecciones, enlaces, JSON inválido y errores sin fallback. No trasladar el supuesto de seguridad de los mocks a la integración ni duplicar esquemas.

## Auditoría B — Arquitectura y mantenibilidad

### B1 — P2 — El puente operativo no satisface el contrato de evaluación del coordinador

**Clasificación:** diferencia de capacidad confirmada; aceptación engañosa solo bajo un manifiesto sintético o habilitado incorrectamente. No hay selección oficial que la active hoy.

**Archivos:** `juego/core/fh-session-coordinator.js:40–49,62`, `juego/rules/legacy/fh-legacy-combat-bridge.js:97–104`, `docs/CONTRATOS_MOTOR_MULTIMODO.md:§3`.

**Evidencia:** IA 2 exige identidad, contrato y una función `evaluate`; IA 4 expone esos nombres, pero la función rechaza `LEGACY_PURE_RESOLVER_UNAVAILABLE` y el método operativo es `executeOnce`. Se probó en memoria el puente real con un manifiesto `implemented` sintético coincidente: el coordinador devuelve `prepared` aunque `connected` es falso y `evaluate` falla. Los manifiestos oficiales permanecieron intactos y bloquean esta ruta con `RULESET_NOT_IMPLEMENTED`.

**Riesgo:** cambiar únicamente el manifiesto a `implemented` confundiría una fachada de ejecución Legacy con un resolutor puro disponible. El contrato compartido identifica una familia, pero no acredita la capacidad concreta requerida.

**Corrección recomendada:** acordar antes de conectar una ruta explícita de delegación Legacy y su comprobación de capacidad, preservando la operación completa existente. No convertir un ataque con efectos en evaluación pura. Añadir la prueba del coordinador con el puente real y exigir evidencia operativa antes de habilitar el manifiesto. `prepared` debe conservar su significado documental, nunca convertirse implícitamente en `ready`.

### B2 — P3 — Las pruebas dependen de recortar texto privado del validador

**Clasificación:** acoplamiento confirmado de mantenimiento; sin fallo observado.

**Archivos:** `tests/mode-session.test.cjs:11–18`, `tests/world-profile-loader.test.cjs:14–20`, `tests/multimode-runtime.test.cjs:14–20`, `tests/multimode-compatibility.test.cjs:93–98`; `contratos/multimodo/validar-contratos.mjs`.

**Evidencia:** cuatro suites extraen funciones desde `function matchesType` hasta `const refs =` y las ejecutan mediante `vm`. Reutilizan la implementación canónica y no duplican esquemas, pero un cambio inocuo de nombres u organización del CLI puede romperlas. Las dos primeras llegaron con IA 2/3; IA 5 repite el patrón.

**Riesgo:** mantenimiento frágil y divergencia entre lo que se extrae para runtime y el CLI completo. Actualmente el CLI independiente también pasó, por lo que no se afirma que exista divergencia efectiva.

**Corrección recomendada:** cuando se trabaje en el validador, exponer una función pura reutilizable manteniendo un único esquema y el CLI actual. No añadir otra librería o una segunda especificación para resolver este acoplamiento. No requiere refactorización en esta entrega documental.

### Fronteras revisadas sin hallazgos bloqueantes adicionales

| Área | Resultado de la revisión |
| --- | --- |
| Responsabilidades | Selector lee/valida; cargador describe perfil/mapa; coordinador prepara; puente delega operación completa. Ninguno genera geometría, decide colisiones o descuenta directamente recursos. |
| Dependencias circulares | Los cuatro módulos no importan otros módulos: reciben puertos inyectados. No se encontró un ciclo nuevo ni acceso implícito a DOM, Three.js o almacenamiento. |
| Colisión, visibilidad y navegación | No se añadió ninguna segunda implementación. Permanecen en el motor y módulos existentes, sin cambios en el diff. Los permisos de `authorize` siguen siendo una obligación futura del anfitrión. |
| Esquemas | Se consumen las rutas canónicas de `contratos/multimodo/v1/`. No se añadieron esquemas paralelos ni campos al mapa. El sobre de intención en memoria no es un formato de guardado. |
| Compatibilidad IA 2/3 | `worldLoader.prepare(worldProfile)` es compatible y fue ejercitado con ambos módulos reales. Los perfiles sin mapa son descripciones válidas, pero el coordinador los rechaza como sesión preparada. |
| Complejidad | Sin dependencias nuevas ni frameworks. Las copias/congelaciones repetidas son pequeñas y protegen fronteras distintas; no justifican por sí solas una abstracción compartida o refactorización bloqueante. |

## Pruebas ejecutadas y límites

Entorno: checkout real, Node `v24.22.1`, sin instalar dependencias; `TMPDIR` existente fuera del checkout. No se cambiaron fuentes ni pruebas. Los comandos de Node se ejecutaron en `cfcb855`, salvo la comparación de arranque expresamente indicada.

Regresión seleccionada, salida **0**, **207/207 PASS**, 0 fallos, cancelaciones, omisiones o TODO; duración aproximada 10,26 s:

```sh
TMPDIR=/workspace/scratch/efd8834c942c/test-tmp timeout 55s node --test \
  tests/multimode-runtime.test.cjs tests/multimode-compatibility.test.cjs \
  tests/multimode-architecture.test.cjs tests/mode-session.test.cjs \
  tests/world-profile-loader.test.cjs tests/legacy-combat-bridge.test.cjs \
  juego/assets/fh-map-grid.test.js juego/assets/fh-floor-levels.test.js \
  juego/assets/fh-npc-goap.test.js juego/assets/fh-npc-doors-integration.test.js \
  juego/assets/fh-stair-direction.test.js juego/assets/fh-stair-block-flag.test.js \
  juego/assets/fh-door-safety.test.js juego/assets/fh-character-core.test.js \
  juego/assets/fh-character-creation.test.js juego/assets/fh-survival-core.test.js \
  juego/assets/fh-mood-fear-core.test.js juego/assets/fh-skills.test.js \
  juego/assets/fh-shadow-ai.test.js juego/assets/fh-structure-health.test.js \
  juego/assets/fh-forest-engine-hook.test.js
```

| Comprobación adicional ejecutada | Resultado |
| --- | --- |
| `node contratos/multimodo/validar-contratos.mjs` | PASS, 846 aserciones; 3 mundos × 3 reglamentos estructurales, no nueve modos jugables. |
| `timeout 45s node --test juego/assets/fh-preview-boot.test.js` con el mismo `TMPDIR` | INCONCLUSO, salida 124; no PASS. |
| Misma suite sobre `9c52939`, límite 35 s | INCONCLUSO, salida 124; bloqueo también anterior a Etapa 2. |
| `timeout 20s node --test --test-name-pattern='decodifica UTF-8' juego/assets/fh-preview-boot.test.js` | PASS, 1/1, salida 0; solo ese caso. |
| `require('./tests/helpers/forest-engine.cjs')()` y `new vm.Script` sobre el script final | PASS, composición con adaptadores reales y sintaxis válida; no ejecución completa de `startGame`. |
| Búsqueda de los cuatro módulos en el motor ensamblado | Ninguno instalado; confirma preparación externa, no conexión jugable. |
| Funciones reales de guardado y filtro de personaje con almacenamiento falso | Aceptan sobre v1 etiquetado DnD: demuestra falta de barrera, no contaminación real del juego. |
| Coordinador y puente reales con manifiesto sintético | `prepared`, `connected:false`, `evaluate` rechazado; demuestra B1 bajo esa precondición. |
| `git diff --exit-code 9c52939 cfcb855 -- index.html juego/index.html juego/assets contratos forest-horror/maps` | Sin diferencias: motor, hooks, mapas y contratos preexistentes conservados. |

La regresión cubre selección independiente, rechazos de reglas no implementadas y adaptadores ausentes/incompatibles, errores de perfiles/referencias/versiones, copias inmutables, deduplicación por instancia y ausencia de IO en preparación. Las pruebas positivas DnD/Moon usan adaptadores sintéticos. No se ensayaron combate DnD/Moon real, persistencia entre reglamentos conectada, DOM completo, navegador/WebGL ni FPS.

## Condiciones para reconsiderar el cierre y alcance de esta entrega

1. Incorporar las dos suites de IA 5 a la rama de destino y verificar el árbol final.
2. Completar la ejecución de arranque y la sesión Legacy real, sin atribuir el timeout actual a una regresión no demostrada.
3. Si se pretende activar multimodo: resolver A1/A2/B1, demostrar lector confinado y probar daño/coste únicos y guardados separados de extremo a extremo. Si el alcance sigue siendo preparación externa, declararlo así y mantener los manifiestos bloqueados.

**Aceptación documental cumplida:** dos pasadas, referencias fijadas, ejecución real y límites registrados, hallazgos con prioridad/archivo/evidencia/riesgo/corrección, y distinción entre defectos, capacidades ausentes e hipótesis.

**Único archivo creado:** `docs/ETAPA2_AUDITORIA_FINAL.md`. No se modificaron módulos revisados, `index.html`, `juego/index.html`, Base64, hooks, pruebas, mapas, manifiestos, esquemas, guardados, dependencias ni workflows. No se fusionó ningún PR. El informe se entrega para revisión; no constituye autorización de integración definitiva.
