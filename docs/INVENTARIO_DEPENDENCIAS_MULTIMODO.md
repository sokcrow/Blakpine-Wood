# Inventario de dependencias multimodo — Blakpine-Wood

**Tipo:** auditoría estática de dependencias, sin intervención del motor  
**Fuente:** repositorio `sokcrow/Blakpine-Wood`, rama `main`, consultada el **15 de noviembre de 2026**. Árbol Git inspeccionado: `3ee617f77157ed9b75084b3f395ab533b364602a` (SHA del árbol, no del commit).  
**Alcance solicitado:** `index.html`, `juego/index.html`, `juego/assets/` y arranque del motor 3D. Se revisaron asimismo referencias puntuales a modelos fuera de `juego/assets/` para identificar dependencias externas de recursos.  
**Convención:** **[C] Comprobado** = observado en archivos reales de esta revisión; **[P] Pendiente** = exige ejecución, inspección adicional o una comprobación que no se hizo. **[R] Riesgo de acoplamiento** = consecuencia arquitectónica deducida de una dependencia comprobada, no fallo reproducido.

## 1. Resultado ejecutivo

**[C]** El punto de entrada operativo es `index.html`. `juego/index.html` **no inicia otro motor**: redirige a `../index.html` conservando la búsqueda y el fragmento de URL, con alternativa `meta refresh`. Véanse `juego/index.html:7-16`.

**[C]** Conviven tres ámbitos de ejecución que no deben confundirse:

1. **Editor del documento padre:** funciones extensas en el propio `index.html` y módulos clásicos de `juego/assets/`; edita y exporta el mapa.
2. **Prueba 2D del documento padre:** `startPlay`, `playSolidAt`, `playTryMove`, `playRayWall`, `playPaint` y `playFrame`, también en `index.html`. No son el motor Three.js.
3. **Motor Three.js dentro de un iframe:** un HTML completo se decodifica desde `engine-00.js` a `engine-12.js`, recibe adaptadores sobre su texto y se asigna a `play3DFrame.srcdoc`. El iframe ejecuta su propia copia de `ForestShared` y carga scripts de recursos en su propio contexto.

**[C]** `ForestShared` contiene lógica compartida de mapa, colisión, puertas, escaleras, ascensores, visión, interacción, inventario y validación, pero **no es hoy un archivo JavaScript importado como biblioteca única**: está incrustado en `index.html` y también dentro del HTML Base64 del motor. Algunas funciones del motor se sustituyen por versiones del padre durante el ensamblaje.

**[C]** Existen módulos relativamente aislados para habilidades (`FHSkills`), personaje (`FHCharacterCore`), supervivencia (`FHSurvival`), miedo (`FHMoodFear`), navegación GOAP/A* (`FHNPCGOAP`), carreteras (`FHRoads`), drenajes (`FHDrainage`) y bosque (`FHForest`). Sin embargo, la **integración real** de varios de ellos todavía depende de parches de texto contra el HTML del motor.

**[C]** No se identificó en el árbol revisado una carpeta `modes/`, `modos/`, `dnd/` o `moon/`. `FHSkills` implementa actualmente tiradas de **monedas porcentuales**; la existencia de los futuros modos DnD y Moon no debe confundirse con una abstracción multimodo ya integrada.

## 2. Entradas, ensamblaje y comunicación

```text
/juego/index.html
    └── redirige a /index.html
/index.html  (documento padre)
    ├── ForestShared + editor + prueba 2D (código inline)
    ├── <script src="./juego/assets/..."> (módulos del editor)
    ├── images.js
    ├── engine-00.js → ... → engine-12.js (concatenación Base64 EN ORDEN)
    ├── decodeEmbedded3DEngine()
    ├── prepareGLBEngineDoc() + adaptadores HTML
    ├── FHServicesEngine.patch()
    ├── FHArchitectureSkins.patchEngineDoc()
    ├── FHStructureHealthEngine.patch()
    ├── FHBarriersEngine.patch() / FHCCTVEngine.patch() / FHForestEngine.patch()
    └── iframe#play3dFrame.srcdoc
           ├── copia embebida de ForestShared
           ├── Three.js, GLTFLoader y módulos inyectados en <head>
           ├── receive(project) → trimMap() → run() → startGame()
           ├── buildFloor(), canWalk(), walk(), drawSight(), frame()
           └── estado de partida + mensajes hacia el padre
```

| Tramo | Evidencia comprobada | Dependencia |
| --- | --- | --- |
| Redirección `/juego/` | `juego/index.html:7-16` | Depende de `/index.html`; no proporciona un segundo bootstrap. |
| Carga Base64 | `index.html:147-160`; `juego/assets/engine-00.js` … `engine-12.js` | Los 13 scripts agregan contenido a `window.__FOREST_EMBEDDED_ENGINE__`. **El orden es contractual**. |
| Decodificación | `index.html:3365-3377` | `PREVIEW_ENGINE_DOC_B64` + `atob` + `TextDecoder` producen HTML, no un módulo ES importable. |
| Creación de datos 3D | `index.html:3396-3410` | `makeCurrent3DProject()` toma el mapa editado y adjunta información del personaje/partida. |
| Construcción de HTML | `index.html:3515-3537`, `3522-5030` | Reemplazos textuales, scripts en `<head>`, modificaciones sobre funciones preexistentes. |
| Activación | `index.html:5033-5097` | Requiere `FHCharacterCreation.ensureCharacter()`, prepara HTML y asigna `iframe.srcdoc`. |
| Protocolo padre–iframe | `index.html:5178-5212`; motor decodificado (bloque `receive` al final) | `FOREST_PREVIEW_READY` → `FOREST_PREVIEW_MAP` → `FOREST_PREVIEW_RUNNING`; errores, muerte, guardado y cierre tienen mensajes separados. |
| Cierre | `index.html:5099-5105` | El padre limpia `srcdoc` y sustituye `src` por `about:blank`. |

**[C]** El iframe comunica `FOREST_GAMESTATE_SAVE` con la partida serializada. El padre valida la clave por `ForestShared.gameSaveKey(project)` y el personaje antes de actualizar almacenamiento/perfil: `index.html:5201-5208`. El dato transferido es un objeto `project` por `postMessage`; **no** es una importación de funciones del padre en el iframe.

**[C]** El motor Base64 reconstruido contiene `receive(obj)`, `startGame()`, `buildFloor(f)`, `canWalk(x,z)`, `walk(dx,dz)`, `drawSight()`, `installVisibility()`, `moveUpdate(dt)` y `frame(now)`. Esto se comprobó decodificando estáticamente los 13 fragmentos. **[P]** No se ejecutó un navegador para demostrar que cada hook del ensamblaje final se haya aplicado sin errores.

## 3. Contrato de datos del mapa y puntos de verdad

**[C] Contrato actual:** `ForestShared.MAP_SCHEMA = 'forest-horror-map-v1'` y `CURRENT_VERSION = 2` (`index.html:1148-1149`). *Esquema v1* y *versión interna 2* no son lo mismo. `migrate(raw)` acepta el esquema v1, completa campos heredados de pisos y `loadProject(raw)` migra/valida (`index.html:1611-1636`).

**[C] Estructura que llega al 3D:** `makeCurrent3DProject()` envía `schema`, `version`, `units`, `floors[]` con `items[]` y elevaciones, `mainFloorId`, `buildingSlabs`/`slabsByLevel`/`basementSlabs`, `itemDefs`, `initialGameState`, clima y entorno, entre otros. Calcula `metersPerCell = feetPerCell × 0.3048`; excluye imágenes de referencia pesadas. Véase `index.html:3396-3410`.

**[C]** Los mapas describen geometría y conexiones; los módulos `FHRoads`, `FHDrainage`, `FHBasement`, `FHParking`, `FHForest` y `FHServices` interpretan subconjuntos distintos. Una calle no se resuelve con el mismo algoritmo de conectividad que un drenaje: `FHRoads.topology(items,units)` construye carriles/cruces/conexiones; `FHDrainage.topology(project)` construye nodos/enlaces y relaciones hidráulicas por piso.

**[C]** No toda la información temporal pertenece al mapa: recursos del jugador, `GameState.flags`, `GameState.horror`, `GameState.environment.removedTreeIds`, `GameState.construction` y otros estados se inicializan/restauran en el motor. La vista de escenario y el sistema de combate no son actualmente capas separadas por modo en las entradas revisadas.

**[R]** Alterar `items`, unidades, `floors`, identificadores, niveles o la forma de `GameState` para un modo de combate puede afectar a colisiones, partidas antiguas, NPC, servicios y visibilidad. No se hizo ninguna modificación.

## 4. Funciones actualmente integradas en los HTML

### 4.1. `index.html` — documento padre

| Bloque | Funciones/objetos principales | Función y dependencias |
| --- | --- | --- |
| `ForestShared` inline (`211-1637`) | `solidAt`, `doorSpec`, `doorOccupiesPoint`, `stair*`, `elevator*`, `createLightingSystem`, `sightRayDistance`, `pointInSight`, `crossFloorSight`, `createPoseMachine`, `validate`, `migrate`, `loadProject` | Geometría, colisión y reglas auxiliares; base para editor, prueba 2D y validación que también usa el motor. |
| Autoría y persistencia (`1640-3300`) | `init`, `record`, `render`, `normalizeArchitecture`, `buildArchitectureGraph`, `detectFloorRegions`, `rebuildFloorSpaces`, `buildingSlabs`, `exportProject`, `importProject` | Manipulación y serialización del mapa. Llama a módulos externos de dibujo, estructura, servicios y niveles. |
| Prueba 2D (`3303-3361`) | `playSolidAt`, `playFindStart`, `playSetFloor`, `startPlay`, `playTryMove`, `playFrame`, `playRayWall`, `playPaint` | Otro lazo de movimiento y otro render/visión, dentro del documento padre. `playSolidAt` delega en `ForestShared.solidAt`; `playRayWall` es un trazador de visión de esta prueba. |
| Puente 3D (`3364-3412`) | `decodeEmbedded3DEngine`, `makeCurrent3DProject`, `preview3DError` | Convierten la captura del editor en documento y datos para el iframe. |
| Composición 3D (`3413-5030`) | `prepareGLBEngineDoc` y `addLiveTextToEngine`, `addDoorSafetyToEngine`, `addLightToEngine`, `addDeliveryToEngine`, `addWeatherToEngine`, `addBuildingLevelsToEngine`, `addFloorVisibilityToEngine`, `addSurvivalToEngine`, `addMoodFearToEngine`, `addShadowEncountersToEngine`, `addDrainAccessToEngine`, `addConstructionToEngine`, etc. | Reescriben **cadenas** de funciones del HTML 3D y agregan scripts. No son imports entre módulos. |
| Ciclo del iframe (`5033-5233`) | `start3DPreview`, `close3DPreview`, `launch3DPreview`, controlador de orientación, `window.addEventListener('message', …)` | Gestionan arranque, diagnóstico, comunicación, errores, fullscreen y cierre. |

### 4.2. HTML interno del motor Base64 — iframe

**[C]** El motor embebido incluye su propio `ForestShared`; `createGameState`, `readGameSave`, `writeGameSave` y `GameEvents`; `startGame` construye Three.js, pisos, puertas, mobiliario, jugador, luces y sistemas; `canWalk` y `walk` controlan movimiento; `drawSight`, `installVisibility` y `updateCameraCutaway` controlan FOW/ocultación; `moveUpdate` y `frame` actualizan la simulación.

**[C]** El `index.html` del padre sincroniza en el HTML de iframe ciertas implementaciones concretas: `ForestShared.validate`, `createElevatorMachine`, `createLightingSystem`, `circuitsForPanel` y `createExteriorClassifier` (`index.html:3515-3543`). **No** sincroniza automáticamente toda la copia de `ForestShared`: quedan dos textos fuente y un sistema de reemplazos.

**[R]** Una función que cambie su texto, ancla o número de apariciones puede impedir un hook: muchos parches exigen exactamente una coincidencia con `split(...).length` y lanzan `Error('Hook ... incompatible')`. El código resultante puede diferir del HTML Base64 original incluso cuando los archivos `engine-*.js` no cambian.

## 5. Inventario por subsistema

Las flechas indican **dependencias observadas** (datos, callbacks, globales o llamada a API); no implican que todos los módulos se importen con `import` ni que se ejecuten siempre.

| Subsistema | Productores / componentes | Consumidores e integración comprobada | Estado |
| --- | --- | --- | --- |
| **Mapa / cuadrícula** | `ForestShared.validate/migrate/loadProject`; `FHMapGrid` (`fh-map-grid.js`); `FHFloorLevels` (`fh-floor-levels.js`); `FHAreaMerge` | Editor (`importProject`, `exportProject`, niveles) → `makeCurrent3DProject` → validación y `buildFloor` del iframe. | **[C]** |
| **Arquitectura / interiores** | `normalizeArchitecture`, `buildArchitectureGraph` y `buildingSlabs` inline; `FHArchitectureSkins`, `FHStyleProperty`, `FHRoof`, `FHBasement`, `FHStructureHealth` | Adaptadores `FHArchitectureSkins.patchEngineDoc`, `FHStructureHealthEngine.patch` y `FHRoofEngine.patch`; geometría, puertas, losas, techos y visuales. | **[C]** |
| **Calles y tránsito físico** | `FHRoads`, `FHRoadEditor`, `FH_ROAD_TEXT`, `FHParking` | Editor autoriza tipos y topología; `FHRoads.attachFloor(THREE,DATA,stories,f,CELL)` agrega representación 3D. **No se verificó** que la topología vial sea usada como ruta de NPC. | **[C]/[P]** |
| **Drenajes / alcantarillas** | `FHDrainage`, `FHDrainageAccess`, `FHDrainageEditor`, `FHBasement` | `expandProject` antes de construir pisos; `attachFloor`, `createRuntime`, agua/corrientes/puentes, accesos y luz. La topología es distinta de `FHRoads`. | **[C]** |
| **Relieve / bosque** | `FHTerrain` → `FHForestCatalog` + `FHForest` → `FHForestVisuals` | `FHForestEngine.patch` crea `FHForestRuntime`; usa `collisionCandidates` para troncos en `solidAt` y rayos de `sightRayDistance`, alturas `heightAt` y visuales/cutaway. | **[C]** |
| **Colisión del jugador** | `ForestShared.solidAt`, `doorOccupiesPoint`, `stairRails`, `elevatorCollision` | Prueba 2D: `playSolidAt` → `playTryMove`. Iframe: `canWalk` → `walk`/`moveUpdate`; mapa, puertas, muebles, losas, accesos y extras de bosque. | **[C]** |
| **Oclusión / visibilidad** | `ForestShared.sightRayDistance`, `pointInSight`, `segmentInSight`, `furnitureInSight`, `crossFloorSight`; `FHLights`, `FHLightCoverage`, `FHFloorVisibility` | Prueba 2D: `playRayWall`. Iframe: `drawSight`, `litPointVisible`, `installVisibility`, shaders FOW; luz, fachadas, mirilla, CCTV y bosque aportan hooks. | **[C]** |
| **Personaje / presentación** | Padre: `FHCharacterCore` + `FHCharacterCreation`; iframe: `createGameState`, `FHActorPresentation`, `FHPlayerMenu`, `FHStatusHUD` | `ensureCharacter` antes de abrir iframe; perfil en `__runtimeCharacter`; `GameState.character`, hero, poses y menús durante juego. | **[C]** |
| **Estadísticas / recursos** | `FHCharacterCore.resources`, `FHSurvival`, `FHMoodFear`, `FHStatusHUD` | Recursos y estado mental en `GameState.character`; `FHSurvivalRuntime` y `FHMoodFearRuntime` se crean por hooks y actualizan con tiempo de partida. | **[C]** |
| **Habilidades / tiradas** | `FHSkills`, `FH_SKILL_TEXT`, `FHCharacterHelp` | `FHCharacterCore` inicializa/sincroniza puntos; `FHPlayerMenu` muestra habilidades; `FHSkills.odds/roll` calcula monedas y consulta penalización de `FHSurvival` cuando existe. | **[C]** |
| **Navegación / NPC** | `FHNPCGOAP.plan/chooseGoal/createAgent/route`, `FHNPCcourier` (archivo `fh-npc-courier.js`) | El motor suministra `canWalk`, transiciones de escalera y reglas de puerta; la ruta es A* 2.5D con pisos, no un motor vial. | **[C]** |
| **Enemigos / Sombras** | `FHShadowAI`, `FHShadowVisuals`, `FHNPCGOAP`, `FHSurvival`, `FHMoodFear` | `addShadowEncountersToEngine` inyecta `fhShadowInside`, `fhShadowPhaseWalkable`, `fhShadowRoute` y daño a `PG/PS`; las Sombras no deben deducir sus reglas de las carreteras. | **[C]** |
| **Audición** | `FHearing` (`fh-hearing.js`), `fh-hearing-engine.test.js` como prueba existente, audio `FHLiveText` | `FHearing.evaluate` trabaja con obstáculos/eventos; la inyección `addLiveTextToEngine` añade script de oído y sonido. | **[C]** (contrato); **[P]** (cobertura de todos los oyentes). |
| **Servicios / objetos** | `FHServices`, `FHElectricCatalog`, `FHExteriorGrid`, `FHWaterPotable`, `FHWaterHot`, `FHComputer`, `FHDelivery`, `FHEconomyCore`, `FHInventoryCore` | Adaptador `FHServicesEngine.patch` y hooks de contexto; introducen energía, inventarios y acciones que también intervienen en la interacción con mapa/colisión. | **[C]** |
| **Construcción / habitaciones** | `FHConstruction`, `FHConstructionRooms`, `FHConstructionPrefabs`, `FHConstructionVisuals` | Los hooks crean runtimes en `GameState`, calculan progreso por reloj y superponen obra; no sustituyen el esquema del mapa. | **[C]** |

### Dependencias directas relevantes verificadas en fuente

- `fh-character-core.js` → `FHSkills.emptyPoints/normalizePoints`. `fh-character-creation.js` → `FHCharacterCore`, textos, ayuda y economía.
- `fh-skills.js` → `FHSurvival.penaltySP` **opcional** en la función `odds`; ambas deben existir en el **mismo contexto** para aplicar la penalización.
- `fh-forest.js` → `FHTerrain` + `FHForestCatalog` + `FH_FOREST_TEXT`; `fh-forest-engine-hook.js` → `FHForest`, `FHForestVisuals`, `FHAssets` y cadenas de integración.
- `fh-roads-editor.js` → `FHRoads` + `FH_ROAD_TEXT` + `FHStyleEditor`. `fh-roads.js` publica su API global `FHRoads`, también utilizable desde pruebas Node.
- `fh-context-engine-hook.js` → `FHInteractionRadial`, `FHStorageRuntime`, `FHMoodFearUI`, `FHPlayerMenu`, `FHComputerRuntime`, `FHSleep`, etc.
- `fh-services-engine-hook.js` → `FHServices`, `FHEquipmentCore`, `FHStorageRuntime`, `FHComputer`, `FHPhone` y adaptadores visuales de electricidad/agua/exterior.
- `fh-glb-bridge.js` (API `FHAssets`) → catálogos/reglas de mobiliario, agua, calderas y red exterior para buscar/sustituir modelos; `FHArchitectureSkins` y otras integraciones solicitan GLB a través de este puente.
- `fh-npc-goap.js` implementa planificación/rutas sin Three.js. `fh-shadow-ai.js` recibe `route`/`canWalk`/`insideAt` **por callbacks** y el hook del iframe conecta esas funciones a colisión y niveles reales.

## 6. Colisiones, movimiento y navegación: fronteras exactas

**[C]** `ForestShared.solidAt(x,y,ctx)` (`index.html:266-297`) recibe contexto explícito: radio, límites, paredes, puertas, objetos, tipo de colisión (`box` o distancia a rectángulo) y `surfaceAllowed`. **No** es el mismo problema que `FHRoads.topology` ni que `FHDrainage.topology`.

**[C]** `playSolidAt` (`index.html:3304-3325`) prepara las paredes, puertas, ascensores, muebles y losas de la prueba 2D; `playTryMove` (`3339`) resuelve desplazamiento por incrementos y deslizamiento por ejes. En el motor 3D, `canWalk` llama a `ForestShared.solidAt` con colisionadores del piso, muebles y puertas, y `walk` realiza movimiento continuo por segmentos (motor Base64 reconstruido, `canWalk` y `walk`).

**[C]** `FHNPCGOAP.route` implementa A* sobre una cuadrícula 2.5D con ocho vecinos, evita atravesar esquinas diagonalmente y acepta `transitions[]` entre pisos. El `canWalk(f,x,z)` lo proporciona la integración del motor, no el módulo GOAP (`fh-npc-goap.js:104-163`). `planDoor` exige derechos y condiciones del portal (`89-103`).

**[C]** El hook de Sombras conecta `fhShadowRoute` con `FHNPCGOAP.route` y `fhNpcStairTransitions`, y filtra interior con `fhShadowInside`; ciertas excepciones de fase alteran **la consulta** de colisión sin mutar las puertas reales (`index.html:4819-4838`).

**[C]** `FHDrainage` aporta `walkFactor`, corrientes y accesos; `FHDrainageAccess` implementa `safeLanding` y `resolve`. `FHRoads` aporta carriles e intersecciones geométricas. Son interpretadores distintos del mismo mapa, no dos versiones verificadas del A* de NPC.

**[R]** Un modo de combate que cambie `canWalk`, `solidAt`, `CELL`, `currentFloor` o `GameState.flags` desde un adaptador podría modificar indirectamente rutas NPC, árboles, puertas y zonas transitables. No está demostrado que un selector de combate ya respete ese límite.

## 7. Visibilidad: contratos y contribuyentes

**[C]** La prueba 2D usa `playRayWall` y un recorte Canvas (`index.html:3341-3355`); el 3D usa `drawSight`/`installVisibility` sobre escena, máscaras, materiales y raycasting. Comparten utilidades `ForestShared`, pero **no** un único bucle de renderizado.

**[C]** En el iframe, `ForestShared.pointInSight`, `sightRayDistance`, `crossFloorSight` y `rayThroughExteriorOpening` alimentan detección horizontal y entre plantas. `addFloorVisibilityToEngine` controla exposición de fachadas respecto de losas y aberturas; `FHFloorVisibility` tiene `facadeCandidate`/`undergroundMask`. La luz depende también de `FHLights`, `FHLightCoverage` y del runtime de servicios (`index.html:4657-4710` y `3700-3714`).

**[C]** `FHForestEngine.patch` integra troncos como bloqueadores **tanto** de `ForestShared.solidAt` como de `sightRayDistance`; modifica en memoria el texto de esas funciones y conecta altura, vegetación y recorte de copas. La geometría del bosque proviene de `FHTerrain`/`FHForestCatalog`, con modelos en `forest-horror/biblioteca/vegetacion/modelos_glb/` (`fh-forest-engine-hook.js`).

**[C]** `FHAssets.setSightMaskInstaller(installVisibility)` conecta modelos GLB cargados posteriormente al enmascaramiento del motor. CCTV tiene su render independiente y el hook del bosque evita heredar el recorte de árboles de la cámara del jugador.

**[P]** La consistencia final entre FOW, CCTV, fachadas, sombras, luces, GLB asíncronos y árboles necesita prueba visual WebGL. El código muestra puntos de unión; no certifica su resultado en GPU.

## 8. Personajes, estadísticas y habilidades: situación actual

**[C]** El perfil `FHCharacterCore` define los siete `SCORES` **FOR, AGI, VOL, PRU, ING, ARC, SOC**; los recursos iniciales derivados son `PG máx = 26 + 2·FOR`, `PS máx = 14 + 2·VOL`, `PE máx = 6 + FOR + AGI` y `evasión % = 5 + 5·AGI` (`fh-character-core.js:5-33`). El perfil contiene `scores`, `skills` y `resources`; el motor recibe copia por `__runtimeCharacter` y la incorpora en `GameState.character` (`index.html:3396-3409, 4855-4858`).

**[C]** `FHSurvival` opera sobre `pg/sp/pe` y efectos/tiempo de juego, incluido `penaltySP` para habilidades (`fh-survival-core.js`; `index.html:4712-4772`). `FHMoodFear` crea estado de ánimo, estrés y niveles de miedo y puede descontar PS; se vincula con `GameEvents`/`FHSurvivalRuntime` (`fh-mood-fear-core.js`; `index.html:4774-4816`).

**[C]** `FHSkills` agrupa habilidades por Score, pero **sus tiradas actuales no son DnD**: `odds` usa porcentaje de cara, ventaja/desventaja y penalización por PS; `roll` lanza monedas y distingue éxito, fracaso y críticos (`fh-skills.js:4-83`). Este módulo funciona como regla de tiradas presente, no como interfaz `GameMode` comprobada.

**[C]** `FHPlayerMenu` consume `FHSkills` y los recursos de `FHCharacterRuntime`; el padre usa `FHCharacterCore` y `FHCharacterCreation`. Son dos entornos: no se debe suponer que una modificación a una variable global del padre alterará automáticamente `GameState` dentro del iframe.

**[P]** No se verificó un motor separado de combate DnD, un selector DnD/Moon ni contratos formales que permitan cambiar solamente resolución del combate. Tampoco se auditó exhaustivamente cada estadística de combate propuesta en documentos conceptuales contra todos los hooks de daño.

## 9. Qué se carga en cada contexto

**Documento padre, carga estática:** en `index.html:144-209` se cargan los fragmentos del motor, imágenes y módulos del editor de parcelas, arquitectura, calles, drenajes, clima, bosque, servicios, niveles, etc.; `index.html:5235-5300` añade creación de personajes, habilidades, economía, paneles, reglas de muebles, estructura y adaptadores de motor. Los tags son scripts clásicos: predominan APIs globales `window.FH*` / `root.FH*`.

**Iframe, carga dinámica:** `prepareGLBEngineDoc` inyecta `vendor/three.min.js`, `FHAssets`/GLB, luces, superficies, decoración, inventario, sueño, GOAP, repartidores, economía, estilos, carreteras, drenajes, sótanos, HUD, habilidades, teléfono y otros (`index.html:3522-3680` y `4844-4866`). Después se añaden, por capas, clima, iluminación natural, visibilidad de pisos, supervivencia, Mood/Miedo, Sombras, drenajes, construcción, habitaciones y diagnóstico (`index.html:4545-5030`).

**Adaptadores adicionales, en este orden en el padre:** `FHServicesEngine.patch` → `FHArchitectureSkins.patchEngineDoc` → `FHStructureHealthEngine.patch` → `FHBarriersEngine.patch` → `FHCCTVEngine.patch` → `FHForestEngine.patch` (`index.html:5063-5095`). En caso de fallo de arquitectura existe una ruta de reserva con `fhEngineDoc`; por tanto, **[P]** no es válido afirmar que todos los módulos se cargarán en todas las ejecuciones.

**Recursos físicos:** `juego/assets/vendor/three.min.js` y `GLTFLoader.js` son dependencias locales del render/GLB; múltiples catálogos referencian `forest-horror/biblioteca/.../modelos_glb/` fuera de `juego/assets/`. Se confirmó la presencia de modelos GLB, incluidos 12 de vegetación, en el árbol. **[P]** Su carga efectiva, errores HTTP, disposición de texturas y compatibilidad GPU requieren ejecución.

**Archivos de prueba:** existen, entre otros, `juego/assets/fh-preview-boot.test.js`, `fh-character-core.test.js`, `fh-skills.test.js`, `fh-npc-goap.test.js`, `fh-roads.test.js`, `fh-drainage.test.js`, `fh-forest-engine-hook.test.js` y `fh-shadow-ai.test.js`. Su presencia está comprobada; **no fueron ejecutados en esta auditoría**.

## 10. Fronteras multimodo y acoplamientos detectados

| Frontera que interesa preservar | Hecho comprobado | Qué todavía no está garantizado |
| --- | --- | --- |
| **Mundo 3D independiente de reglas de combate** | Mapa/colisión/visibilidad se calculan desde `DATA`, `ForestShared` y módulos geográficos, sin requerir `FHSkills.roll` como entrada de su geometría. | Que todos los hooks de daño, enemigo y recursos estén desacoplados de un modo de combate. |
| **Ciudad moderna / distópica / medieval** | Existen capas reutilizables de calles, parcelas, pisos, drenaje, terreno, bosque y modelos; `items` y configuración controlan la escena. | No se encontró un contrato formal de *tipología de mundo* ni catálogos de tres ambientaciones seleccionables como modos. |
| **DnD / Moon comparten navegación** | `FHNPCGOAP.route` recibe `canWalk`/transiciones; no calcula resultados de `FHSkills.roll` para encontrar caminos. | No existe una interfaz verificada para intercambiar un resolutor de combate sin tocar `GameState`, `FHSurvival` o `FHShadowAI`. |
| **Estadísticas y perfil separados del editor de mapa** | `FHCharacterCore` se presenta como independiente del mapa y el perfil se transporta por `__runtimeCharacter`. | La persistencia y el HUD todavía referencian nombres/estructuras concretas de recursos. |
| **Un solo origen funcional para geometría** | `ForestShared.solidAt` es punto compartido para prueba 2D y movimiento 3D; los hooks complementan colisión. | El código embebido, la copia del padre y los parches no son una distribución de fuente única verificable en tiempo de carga. |

**[R] Acoplamientos sensibles que no deben confundirse con errores confirmados:** el orden de los 13 fragmentos Base64; los reemplazos literales de ``source.replace`/`doc.replace`; el orden de los scripts globales; las rutas de reserva de los adaptadores; la separación de `window` padre/iframe; los campos de `project.units`/`floors`; y la sincronización de `GameState` mediante mensajes/almacenamiento.

## 11. Comprobado frente a investigación pendiente

### Comprobado en esta auditoría

- Se inspeccionó el árbol real de `main` y se comprobó que la ruta objetivo `docs/INVENTARIO_DEPENDENCIAS_MULTIMODO.md` no existía al iniciar la revisión.
- Se leyó `juego/index.html` y la estructura/carga del `index.html` raíz.
- Se recuperaron y **decodificaron estáticamente** los 13 fragmentos `engine-00.js` a `engine-12.js` (aprox. 8.59 MB de HTML/recursos decodificados), localizando arranque, `canWalk`, `drawSight`, `moveUpdate`, `frame`, `receive` y mensajes.
- Se inspeccionaron definiciones y referencias de módulos de mapa, carreteras, drenaje, niveles, terreno, bosque, personajes, habilidades, supervivencia, miedo, NPC/GOAP, Sombras y adaptadores.
- Se identificaron rutas estáticas, inyecciones dinámicas y el contrato padre–iframe; se distinguieron funciones inline y scripts externos.
- La revisión fue **de solo lectura** hasta elaborar este inventario. No se movieron archivos, no se refactorizaron funciones y no se modificó el comportamiento del motor.

### Pendiente de investigación (no afirmar como validado)

1. Arranque completo en navegador real y confirmación de cada sustitución textual tras todos los `patch()`, incluidas rutas de error y reserva.
2. Inventario **exhaustivo** de cada referencia global en los archivos restantes de `juego/assets/`; esta matriz rastrea subsistemas críticos, no certifica todo el grafo de los 348 archivos de esa carpeta.
3. Ejecución de pruebas Node y pruebas WebGL; rendimiento, FOW, colisiones reales, móvil y cargas GLB.
4. Determinar con pruebas de integración dónde se validan todas las acciones de combate, tiradas de habilidad y daños, especialmente interacciones con `FHSurvivalRuntime`, `FHShadowRuntime` y persistencia.
5. Comprobar en ejecución el uso real de la topología de carreteras por NPC, si existe, y las transiciones entre escaleras, ascensores, drenajes y bosque para cada tipo de actor.
6. Definir/verificar, en una tarea posterior y fuera del alcance de este inventario, contratos de ambientación del mapa y de resolución de combate para DnD/Moon sin tocar reglas físicas.

## 12. Cierre de auditoría

**Estado:** **PASS como inventario estático acotado**; **NEEDS WORK** para certificar dependencias dinámicas ejecutadas o compatibilidad multimodo.

**Pruebas automáticas:** no ejecutadas. **Pruebas manuales de navegador:** no ejecutadas. **Comprobaciones realizadas:** inspección de árbol/archivos, rastreo de funciones/referencias y decodificación estática del motor Base64.

**Archivos de código, funciones, rutas de recursos, tests, configuración y motor 3D modificados:** **ninguno**. **Único archivo entregado:** `docs/INVENTARIO_DEPENDENCIAS_MULTIMODO.md`.
