# Blakpine Wood — Etapa 2: auditoría de dependencias e integración

**Responsable:** IA 1, auditor de dependencias e integración.

**Fecha:** 16 de noviembre de 2026.

**Repositorio:** `sokcrow/Blakpine-Wood`. **Rama examinada:** `main`.

**Commit utilizado:** `9c5293986664b67f4e21485ebb2f83a2577a4b68`, obtenido mediante clonación real y `git rev-parse HEAD`. Todas las referencias de líneas corresponden a ese commit, no al futuro HEAD de `main`.

**Entrega:** exclusivamente este documento. No instala puertos, adaptadores ni parches.

## 1. Dictamen y fuentes

**Apto para diseñar la integración; pendiente para habilitar DnD/Moon en el juego.** La frontera útil está entre intención/resolución de ataque y aplicación del resultado al propietario del recurso. No existe actualmente una API pública que permita insertar esa frontera completa sin trabajo posterior de integración. En particular, `combat:damage` es una notificación posterior al descuento y no permite interceptarlo.

Se leyeron completos `docs/INVENTARIO_DEPENDENCIAS_MULTIMODO.md` —especialmente §13— y `docs/CONTRATOS_MOTOR_MULTIMODO.md` —especialmente §3, incluidos §3.1–3.4— y se contrastaron sus afirmaciones relevantes con el código actual. Se inspeccionaron también los README de `juego/core/`, `juego/rules/` y `juego/worlds/`: reservan ubicaciones futuras; no contienen implementaciones ejecutables de esos puertos.

Las firmas `CoreWorldPort.getActorSnapshot/queryCollision/queryVisibility/queryNavigation`, `CombatAdapterPort.evaluate` y `SessionCoordinatorPort.validateAndApply` siguen siendo semánticas. Los esquemas canónicos son únicamente los de `contratos/multimodo/v1/`. Los manifiestos de Legacy, DnD y Moon están en `planned`; el combate Legacy existente no constituye un adaptador multimodo instalado.

**Convenciones de evidencia:** **C** = lectura directa; **E** = ejecución de pruebas/herramientas indicada en §8; **R** = riesgo deducido, no incidente reproducido; **P** = propuesta o comprobación pendiente.

Para el código embebido, **B:n** significa línea del HTML original obtenido concatenando en orden y decodificando los 13 archivos `juego/assets/engine-00.js` a `engine-12.js`. **B no es un archivo fuente nuevo del repositorio.** Los hooks modifican ese HTML: las líneas B describen la base y deben leerse junto con los inyectores citados. Se compuso además el HTML final mediante `tests/helpers/forest-engine.cjs`, sin guardarlo dentro del repositorio.

Enlaces de referencia fijados al commit: [editor y ensamblador](https://github.com/sokcrow/Blakpine-Wood/blob/9c5293986664b67f4e21485ebb2f83a2577a4b68/index.html), [IA de Sombras](https://github.com/sokcrow/Blakpine-Wood/blob/9c5293986664b67f4e21485ebb2f83a2577a4b68/juego/assets/fh-shadow-ai.js), [supervivencia](https://github.com/sokcrow/Blakpine-Wood/blob/9c5293986664b67f4e21485ebb2f83a2577a4b68/juego/assets/fh-survival-core.js), [personaje y persistencia](https://github.com/sokcrow/Blakpine-Wood/blob/9c5293986664b67f4e21485ebb2f83a2577a4b68/juego/assets/fh-character-core.js).

## 2. Arranque real, mapa y personaje

| Fase | Ruta y funciones verificadas | Comportamiento observado (C) |
| --- | --- | --- |
| Entrada | `juego/index.html:7–16` | Redirige a `../index.html`, conserva búsqueda y fragmento. No inicia otro motor. |
| Elección de personaje | `index.html:5035–5050`, `juego/assets/fh-character-creation.js:21–28`, `fh-character-core.js:35–76` | `start3DPreview()` exige spawn y espera `FHCharacterCreation.ensureCharacter()`. Se reutiliza perfil vivo o se abre asistente; `createProfile/store` crean y persisten identidad, scores, habilidades y recursos Legacy. |
| Documento 3D | `index.html:3366–3379,3524–3546,4847–4867,5035–5098` | `decodeEmbedded3DEngine()` decodifica Base64 UTF-8. `prepareGLBEngineDoc()` sincroniza implementaciones seleccionadas de `ForestShared`, inyecta scripts y aplica transformaciones textuales; no importa un núcleo ES independiente. |
| Composición exterior | `index.html:5067–5096` | Sobre el documento preparado: servicios → arquitectura → salud estructural → barreras → CCTV → bosque → `play3DFrame.srcdoc`. Hay capturas de error y rutas de reserva; no se puede asumir que todos los runtimes existan en un arranque degradado. |
| Three.js | `index.html:3560`; B:2305–2322,4286–4295 | El ensamblador añade `juego/assets/vendor/three.min.js`; la base también contempla vendor embebido y proveedores CDN de r128. `next()` verifica `window.THREE` y libera el mapa en cola; `startGame()` crea `THREE.Group`, `Scene`, `WebGLRenderer` y dos `PerspectiveCamera`. |
| Entrega de mapa | `index.html:3398–3412,5180–5186`; B:4269–4301 | El iframe anuncia `FOREST_PREVIEW_READY`; el padre envía `FOREST_PREVIEW_MAP` con `makeCurrent3DProject()`. El receptor exige `event.source===parent`, llama `receive()` → `trimMap()` → `ForestShared.loadProject()` → `run()`. |
| Estado y geometría | B:2305–2313,2423–2431,2470–2472,2773,2813 | `run()` asigna `window.ForestHorrorLoadedMap` y llama `startGame()`. Se valida `DATA`, se calcula `CELL`, se restaura `GameState`, y `DATA.floors.forEach((_,i)=>buildFloor(i))` construye los pisos. |
| Personaje en el iframe | `index.html:4857–4861`; B:3118–3124,3830–3834 | El ensamblador filtra restauración por `characterId`, copia `__runtimeCharacter` vivo a `GameState.character`, fija `characterId` y mezcla scores en `GameState.stats`. `firstSafeSpawn()` y la posición restaurada inicializan `user`; `hero` es una malla visual distinta del perfil. |
| Recursos y actualización | `index.html:3754–3763,4726–4765,4792–4812,4822–4826` | `FHCharacterRuntime`, `FHSurvivalRuntime`, miedo y Sombras se conectan en el contexto del iframe. La actualización alimenta Sombras con piso, posición, PG/PS, sueño, ascensor y estado inactivo/crítico del jugador. |

**Límite de disponibilidad (C):** las inicializaciones inyectadas deben respetar las dependencias de `user`, `hero`, `shadow` y `HERO_H`. Las pruebas existentes ejecutan fragmentos ensamblados para comprobar ese orden. Un puerto nuevo no puede declararse listo solo porque exista `window.THREE` o se haya recibido `FOREST_PREVIEW_READY`.

## 3. Datos compartidos y propietarios

| Frontera | Datos reales | Propietario y restricción |
| --- | --- | --- |
| Editor → iframe | `makeCurrent3DProject()` envía `schema`, `version`, `units`, `floors/items`, IDs, elevaciones, propiedades, losas, `itemDefs`, `initialGameState`, clima y entorno opcional, más `__runtimeCharacter` y `__runtimeSave`. | Proyección del mapa editado mediante copias; `metersPerCell=feetPerCell×0.3048`. Excluye imágenes de referencia. No contiene hoy selección multimodo validada. |
| Transporte | `{type:'FOREST_PREVIEW_MAP',project:...}` por `postMessage`; confirmaciones `FOREST_PREVIEW_READY/RUNNING`, errores, cierre y muerte. | Clonación de datos entre contextos, no referencias compartidas a funciones/Three.js. El padre comprueba `e.source===play3DFrame.contentWindow` y sesión activa. `RUNNING` está enriquecido por los hooks; no es una API de combate. |
| Dentro del iframe | `DATA`, `GameState`, `user`, `currentFloor`, `CELL`, colisionadores, puertas y `GameEvents` viven en cierres del motor. Módulos clásicos cargados en el iframe reciben estado/callbacks y publican globales `FH*`. | `ForestShared` tiene copia en padre y motor; algunas funciones se sincronizan por texto, no todas automáticamente. El bus `GameEvents` es local al motor, no un canal `postMessage` del padre. |
| Lectura de personaje | `window.FHCharacterRuntime.character` devuelve `GameState.character`; `FHSurvivalRuntime.resources` referencia sus recursos. | **No son snapshots inmutables**: congelar la fachada no congela el perfil devuelto. Un futuro adaptador necesita una copia de lectura sin referencias vivas al estado, DOM o Three.js. |
| Mutaciones de jugador | `GameState.character.resources.pg/sp/pe`, `GameState.survival`, `character.mental`. | Supervivencia aplica recursos y críticos; miedo también escribe `sp` directamente. `PS` visible y `sp` interno son la misma reserva. No hay un único mutador universal para todos los efectos actuales. |
| Sombras | `GameState.horror`, semilla/secuencia, registro nocturno; actores activos con `id`, `kind`, piso/posición y `pe`. | `FHShadowAI` administra actores y consume PE de criatura; no son los PE del jugador. `read()` ofrece información, pero no es el `CoreWorldPort` contractual ni un registro completo de actores del mundo. |
| Estructuras | `GameState.structures`, runtime `FHStructureHealth`. | Propietario independiente: destruir puertas/ventanas modifica colisionadores mediante su implementación existente. No se aplica como PG del jugador. |
| Iframe → padre | `{type:'FOREST_GAMESTATE_SAVE',key,json}`, sobre JSON `{version:1,state:GameState}`; muerte con `characterId`. | `saveProgress()` escribe localmente y manda copia al padre incluso si falla almacenamiento del iframe. El padre valida clave/personaje y sincroniza recursos/habilidades; muerte puede marcar el perfil como muerto. |

Evidencia: `index.html:3398–3412,3754–3763,4726–4738,4792–4807,4822,5180–5215`; B:2187–2196,2284–2301,2423–2431; `fh-character-core.js:79–118`; `fh-shadow-ai.js:23–36,322–330`; `fh-mood-fear-core.js:56–70`; `fh-structure-health.js:164–182`.

## 4. Ruta efectiva del combate Legacy

**C — Origen del ataque:** `index.html:4826` añade `fhHorror.tick(...)` al ciclo del motor. En `juego/assets/fh-shadow-ai.js:270–320`, `tick(minute,dt,player)` procesa aparición, objetivo y movimiento; para atacar requiere jugador despierto, movimiento detectado, cercanía, cooldown y `contactClear()`. Esta última comprueba mismo piso, alcance y recorrido con el callback de colisión existente (`249–257`). No se introduce otra colisión.

**C — Resolución:** `attack(actor,player,minute)` (`fh-shadow-ai.js:259–269`) consulta `options.chooseAttack`. La integración de `index.html:4822` lo conecta con `FHNPCGOAP.chooseGoal`: favorece potenciar cuando `actor.pe>=4`. La IA solo potencia si aún tiene PE, descuenta 1 PE de criatura, tira 1d4 o 2d4, fija `lastHit` y emite mediante callback `onEvent('attack',payload)`. La Niña elige `sp`; El Alto, `pg`. El payload incluye ID, clase, recurso, daño, dados, gasto/PE restante y minuto. **No es el evento `combat:attack` del bus.** No hay comprobación Hit contra EVA en esta ruta; `FHCharacterCore.resources()` calcula evasión, pero `createProfile()` no la persiste en `resources`.

**C — Aplicación y notificación:** el consumidor `onEvent` de `addShadowEncountersToEngine()` (`index.html:4821–4844`, cadena principal en línea 4822) ejecuta:

1. Para `payload.resource==='sp'`: `FHSurvivalRuntime.change('sp',-payload.damage)`.
2. Para la otra rama Legacy: `FHSurvivalRuntime.damagePG(payload.damage)`.
3. Solo si devuelve cambio: `GameEvents.emit('combat:damage',...)`, aviso al jugador y `saveProgress()`.

`FHSurvival.createRuntime()` captura los recursos del personaje (`fh-survival-core.js:22–25`). `setResource/change` limitan a `[0,max]` y notifican; `damagePG()` llama además a `checkCritical()` inmediatamente (`44–83`). No sustituirlo por una escritura directa o por `change('pg',...)` suponiendo semántica idéntica.

**Matiz contractual:** `combat:damage` transmite el daño **solicitado** del payload, no necesariamente el delta efectivo tras limitar PG/PS a cero. Tampoco lleva identificador único de intención, objetivo explícito ni reglamento. No usarlo para reconstruir una transacción idempotente ni como prueba del daño neto. Si no hubo cambio, la notificación no se emite, aunque la IA ya consumió su coste y cooldown.

**Otros efectos Legacy, con propietarios distintos:**

- Miedo: `horror:stimulus` → `FHMoodFearRuntime.stimulus()` → `promote()` puede escribir `character.resources.sp` **antes** de `onSanityLoss`; ese callback solo marca guardado pendiente en la integración actual (`index.html:4795–4802`, `fh-mood-fear-core.js:56–80`).
- Supervivencia: `update/wake/deathSave` gestionan desgaste, recuperación y críticos fuera del ataque de Sombras (`fh-survival-core.js:91–200`). Reemplazar solo la tirada de ataque no convierte esos mecanismos al nuevo reglamento.
- Estructuras: `FHStructureHealth.takeDamage()` → `damage()` → destrucción/actualización física → `structure:damage` → guardado (`fh-structure-health.js:79–99,167–182`). Es otra notificación posterior, no daño al personaje.
- Habilidades: `FHSkills.odds/roll` (`fh-skills.js:45–83`) y sus monedas siguen siendo habilidades Legacy; no son el resolutor del futuro combate Moon.

## 5. Riesgos para DnD/Moon

Son **R**, escenarios derivados del código; no se reprodujo daño duplicado ni contaminación de partidas multimodo.

| Prioridad | Punto comprobado | Riesgo y medida recomendada |
| --- | --- | --- |
| Alta | `onEvent('attack')` aplica recursos y luego emite `combat:damage`. | Un suscriptor DnD/Moon que descuente otra vez duplica daño. Elegir exactamente un resolutor y un aplicador antes del mutador; mantener el evento posterior informativo. |
| Alta | `attack()` ya consumió PE, RNG y cooldown antes del callback. | Interceptar solo el callback para volver a tirar deja costes Legacy y consume aleatoriedad dos veces. Separar intención antes de esos efectos; no resolver de nuevo un payload Legacy ya resuelto. |
| Alta | `promote()` descuenta PS antes de `onSanityLoss`. | Aplicar pérdida desde estímulo y también desde callback/notificación repite efecto. Distinguir estímulo de pérdida aplicada; preservar al propietario actual hasta diseñar la política por modo. |
| Alta | `ForestShared.gameSaveKey()` (`index.html:1478–1479`; B:1507–1508) usa `createdAt` o título/IDs de pisos y produce `fh_game_v1_<hash>`. | Mismo mapa comparte clave entre modos y personajes; el filtro por personaje no añade aislamiento por reglas. No escribir DnD/Moon en esa clave. |
| Alta | `writeGameSave()` persiste antes de `FOREST_GAMESTATE_SAVE`; el padre valida versión/clave/ID, no reglamento. | Aislar solo el receptor del padre llega tarde: el iframe puede haber escrito ya la clave Legacy. Separar lectura, escritura y restauración en ambos contextos antes de activar un modo. |
| Alta | Perfil global `blakpine_character_active_v1`; `selectMapSave/syncResourcesFromSave/syncSkillsFromSave` (`fh-character-core.js:86–118`). | Un sobre v1 con mismo personaje y otro reglamento sería aceptado: recursos limitados a máximos Legacy, habilidades normalizadas a catálogo Legacy. No reutilizar perfil/sobre como estado universal; aislar también muerte y sincronización. |
| Media | `GameState.stats` mezcla scores; HUD, miedo y supervivencia leen perfil vivo. | Sustituir estadísticas o máximos puede cambiar críticos, pérdidas de PS, presentación y recuperación aunque el golpe se resuelva aparte. Crear modelo de lectura y estado de reglas privado; evitar escrituras indirectas al perfil. |
| Media | PE de actor, PG estructural y PG/PS/PE de jugador son dominios separados. | Un despachador genérico por nombre puede cobrar a otro actor o destruir geometría. Validar identidad y tipo de objetivo; delegar al propietario autorizado. |
| Media | Parches sobre texto y rutas de reserva del arranque. | Añadir otro reemplazo puede invalidar anclas o dejar una sesión parcialmente conectada. No extender hooks en esta misión; comprobar capacidades reales antes de declarar adaptador disponible. |
| Media | `canWalk/solidAt`, visión, puertas/escaleras y `FHNPCGOAP.route` pertenecen al motor. | Una simulación de combate paralela divergiría de obstáculos, niveles y excepciones de fase. Consultar la implementación existente por una futura fachada de lectura; nunca duplicarla. |

## 6. Punto propuesto antes del daño: alcance y bloqueo actual

**P — Frontera primaria para aplicación:** inmediatamente al entrar en la rama `type==='attack'` del consumidor de Sombras, **antes** de `survival.change/damagePG`. Es el sitio comprobado donde un resultado ya calculado llega a su propietario Legacy. Es una referencia de ubicación, **no una orden de editar `index.html` ni una API invocable hoy**.

**P — Frontera anterior necesaria para sustituir reglas:** cuando `tick()` ha autorizado contacto/cooldown y antes de ejecutar las mutaciones y tiradas de `attack()`. Un adaptador DnD/Moon necesita recibir intención sin que se hayan aplicado costes Legacy. La frontera de aplicación por sí sola no resuelve esto; `chooseAttack` solo devuelve selección normal/potenciada, no una propuesta arbitraria de combate.

El flujo externo propuesto para IA 2/IA 4 es:

1. Capturar intención con ID estable de acción, sesión, atacante, objetivo, reglamento y revisión del estado; copiar solo los datos autorizados del mundo.
2. Seleccionar **un** resolutor. En Legacy, reutilizar su resolución existente; en otro modo, no ejecutar además `attack()` Legacy ni cargar adaptadores `planned` como funcionales.
3. Resolver sin referencias mutables: resultado, coste, recurso/estado de reglas y objetivo tipado. Separar PE de criatura y PE de jugador.
4. Validar sesión/reglamento, identidades, versión del estado, permisos, alcance/contacto y aplicador disponible; rechazar propuestas obsoletas o repetidas antes de descontar. El registro de aplicación por ID debe cubrir coste y efecto, no solo el evento final.
5. Aplicar una sola vez mediante el propietario autorizado. En la ruta Legacy, conservar `damagePG/checkCritical` y el comportamiento de `change('sp',...)`; mantener estructuras y miedo en sus propietarios.
6. Notificar el resultado realmente aplicado —incluido delta efectivo cuando se diseñe el contrato— y persistir en el espacio correcto. Los observadores no vuelven a descontar.

**Bloqueo actual (C/P):** `attack` es local a `FHShadowAI.createRuntime`; su API pública solo devuelve `tick/dispose/read`. El callback de aplicación está construido dentro del texto inyectado por el editor y cierra sobre `GameState`, `GameEvents` y `saveProgress`. Ningún módulo externo puede reemplazar de forma soportada toda esa secuencia hoy. Envolver globales, escuchar `combat:damage`, modificar prototipos o añadir otro parche textual no constituye una integración segura.

Por tanto, el núcleo/adaptadores pueden diseñarse y probarse fuera del motor, pero **conectarlos de extremo a extremo exige una tarea posterior explícita que exponga una frontera soportada**. Con las restricciones de §3 de contratos no corresponde a esta auditoría instalarla ni anunciarla como disponible. Si IA 4 carece de esa autorización/frontera, debe mantener DnD/Moon deshabilitados en juego y reportar la dependencia; no inventar una conexión silenciosa.

## 7. Recomendaciones de relevo

### IA 2 — Contratos y coordinación

- Conservar los esquemas de `contratos/multimodo/v1/` como única fuente canónica. Diseñar la forma de intención/propuesta/resultado y sus versiones sin confundir firmas semánticas con exports existentes.
- Especificar selección única de resolutor, coste y daño aplicados una sola vez, rechazo por estado obsoleto y reglas de notificación. Diferenciar atacante, objetivo actor/estructura y dueño de cada recurso.
- Definir la política de persistencia **antes** de habilitar DnD/Moon: identidades de mapa, personaje, reglamento y guardado; versión de reglas y sobre; claves aisladas; rechazo de versiones desconocidas; política explícita de migración. No introducir campos obligatorios en `forest-horror-map-v1` ni modificar las claves Legacy.
- Especificar si supervivencia, miedo y críticos siguen siendo Legacy en una sesión con otro combate. No deducir una conversión de estadísticas a partir del manifiesto o de `statsNamespace`.
- Mantener el arranque sin selección por su ruta Legacy actual, sin exigir nuevas consultas o contratos al mapa antiguo.

### IA 4 — Integración posterior

- Revalidar las anclas y funciones contra el SHA de su propia base; este informe está fijado al commit indicado. Consumir los contratos, no duplicar esquemas.
- Separar el trabajo externo de núcleo/adaptadores de la exposición futura del puerto real del motor. No modificar aquí Base64, `index.html`, hooks, navegación ni colisión para simular disponibilidad.
- Convertir datos vivos en snapshots sin referencias mutables. Preservar `ForestShared.solidAt`, `canWalk/walk`, `drawSight/installVisibility`, puertas, escaleras y `FHNPCGOAP.route`; no generalizar la fase de Sombras.
- Antes de habilitar otro modo, demostrar con pruebas: una intención → un gasto y un daño; una repetición → ningún gasto/daño adicional; delta limitado por recursos; crítico exactamente preservado en Legacy; miedo no repetido; PE de criatura separado; objetivo estructural delegado; adaptador ausente rechazado sin escrituras.
- Verificar aislamiento al cargar, guardar, sincronizar perfil, notificar muerte y recargar en ambos contextos; comparar claves Legacy antes/después de sesiones DnD/Moon. Probar también entrada sin selección, fallos de adaptadores y cierre/reapertura. Estos casos siguen pendientes.

## 8. Verificación efectivamente realizada

**Entorno:** checkout real; Node.js `v24.22.1`. No se instalaron dependencias ni se modificaron pruebas. No hubo subagentes ni ejecución V8 con aserciones simuladas.

| Comprobación | Resultado y límite |
| --- | --- |
| Clonación de `main`, `git rev-parse HEAD`, inspección de fuentes y búsqueda de `AGENTS.md` versionados | SHA registrado; no se encontraron `AGENTS.md` versionados. Se aplicaron las instrucciones de esta conversación y fuentes del proyecto disponibles. |
| Decodificación de 13 fragmentos por Node `vm`/`Buffer`, lectura de funciones B | PASS. Artefacto temporal fuera del checkout; no se alteraron fragmentos. |
| `require('./tests/helpers/forest-engine.cjs')()` | PASS. Composición completa de adaptadores reales, incluido bosque, sin navegador/WebGL. Se inspeccionó el resultado ensamblado. |
| `node --test juego/assets/fh-shadow-ai.test.js juego/assets/fh-survival-core.test.js juego/assets/fh-mood-fear-core.test.js juego/assets/fh-character-core.test.js juego/assets/fh-skills.test.js juego/assets/fh-preview-boot.test.js juego/assets/fh-forest-engine-hook.test.js tests/multimode-architecture.test.cjs` | Primera ejecución: **86 casos, 81 aprobados y 5 fallidos**. Los cinco fallaron al crear temporales por `ENOENT` en `/tmp`, no por aserciones del juego; no se oculta ese resultado. Las otras siete entradas completaron sus comprobaciones. Los scripts de personaje/habilidades cuentan como archivos de prueba dentro del total de Node. |
| `TMPDIR=/workspace/scratch/aa869af67f92/test-tmp node --test tests/multimode-architecture.test.cjs` tras crear ese directorio fuera del checkout | **13/13 aprobados**, 0 fallos. Repetición exclusivamente de la suite afectada, incluyendo fixtures negativas, traversal, enlaces e identidades de reglamentos. En conjunto, todos los 86 casos seleccionados tienen resultado aprobado en las ejecuciones indicadas. |
| `node contratos/multimodo/validar-contratos.mjs` | PASS: **846 aserciones estructurales**, 3 mundos, 3 reglamentos y 9 combinaciones. No certifica nueve modos jugables. |
| Revisión documental en dos pasadas | Corrección: secuencia resolución/aplicación/notificación, límites de recursos y guardado contrastados con fuentes. Arquitectura: propietarios, contextos y APIs propuestas separados de implementaciones existentes. |

**Pendiente:** navegador real, WebGL/GPU, inspección visual, FPS, sesión jugable de extremo a extremo, ejecución de DnD/Moon, deduplicación transaccional y migración/aislamiento de guardados multimodo. Las pruebas de arranque usan el entorno de pruebas del repositorio; no equivalen a abrir el juego en un navegador real. No se atribuyen a esta misión las pruebas adaptadas de la auditoría anterior.

## 9. Alcance conservado y aceptación

**Único archivo creado:** `docs/ETAPA2_AUDITORIA_INTEGRACION.md`.

**No tocados:** `index.html`, `juego/index.html`, los 13 `juego/assets/engine-*.js`, todos los módulos `juego/assets/fh-*.js` y hooks, vendors, pruebas, mapas y recursos, `contratos/multimodo/`, los documentos previos de inventario/contratos y los README reservados de núcleo/reglas/mundos. Ninguna función de arranque, personaje, combate, persistencia, colisión, visibilidad o navegación se modificó. No se crearon nuevos sistemas ni instaladores.

**Criterios de aceptación:** commit real de `main` registrado; documentos requeridos leídos; arranque/mapa/personaje y combate hasta daño rastreados; datos y propietarios inventariados; riesgos de duplicación/guardado identificados; fronteras preaplicación y preresolución propuestas con sus limitaciones; recomendaciones para IA 2/IA 4 y pruebas reales documentadas. **PASS documental; integración multimodo pendiente.** La publicación se realiza en rama propia con PR, sin fusión.
