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

---

## 13. Auditoría complementaria de compatibilidad multimodo — segunda misión

**Fecha:** 15 de noviembre de 2026. **PR de continuidad:** [#193](https://github.com/sokcrow/Blakpine-Wood/pull/193). **Versión de código examinada:** árbol del commit base del PR, `3ee617f77157ed9b75084b3f395ab533b364602a`; la rama del PR contiene únicamente este documento. **Tipo de trabajo:** inspección/ejecución aislada de pruebas, sin editar archivos de juego.

Esta sección **complementa** el inventario original; no reinterpreta sus comprobaciones como pruebas ejecutadas. Etiquetas: **[C]** inspección directa de código; **[V]** ejecución del código de pruebas en intérprete V8 adaptado, **no** Node nativo; **[P]** sin comprobación de ejecución o pendiente de verificación; **[R]** riesgo inferido (no un error reproducido). Las recomendaciones a la IA 2 son **propuestas de contrato**, no funciones implementadas.

### 13.1. Conclusión de compatibilidad y fronteras de propiedad

**[C]** La escena no está condicionada a un resolutor DnD/Moon en el código inspeccionado. El motor controla `DATA`, `GameState`, `CELL`, navegación, colisiones, FOW y ciclo de fotogramas. En cambio, el combate actual contra Sombras está conectado de forma explícita a recursos y reglas **Legacy**: `FHShadowAI.attack` elige 1d4 o 2d4, `addShadowEncountersToEngine` recibe `attack` y descuenta PG/PS usando `FHSurvivalRuntime`. El evento `combat:damage` se emite **después** de modificar recursos, por lo que **no es un hook de autorización o sustitución de daño** (`fh-shadow-ai.js:259-269`; `index.html:4819-4841`).

**[C]** La evasión (`evasionPct`) se **calcula** en `FHCharacterCore.resources(scores)`, pero `createProfile` conserva en `resources` solo los máximos y valores de PG/PS/PE, no el campo `evasionPct` (`fh-character-core.js:32-52`). No se observó comprobación de Hit contra EVA en `FHShadowAI.attack` ni en el consumidor de `attack` del iframe. **[P]** Esto no certifica que ninguna otra acción o sistema futuro use EVA; describe la ruta de Sombras revisada.

**[C]** Las heridas del jugador y el daño de estructuras **no comparten registro**: `FHSurvivalRuntime` trabaja con `GameState.character.resources`, mientras `FHStructureHealth.takeDamage` trabaja con `GameState.structures`, modifica puertas/colisionadores al destruirlos y emite `structure:damage` (`fh-structure-health.js:69-99, 164-182`). No usar un mismo campo `PG` como indicador de que ambos sistemas deben pasar por el resolutor de combate.

### 13.2. Matriz de dependencias y decisiones para la IA 2

**Columna «función y archivo original»**: para código embebido, `motor original` identifica la función del HTML decodificado de `juego/assets/engine-00.js … engine-12.js`; para código inyectado, se indica `index.html` o el adaptador externo que construye su texto. **«Intocable»** significa **no alterar su implementación** para añadir nuevos modos; no prohíbe que el diseño futuro lea su interfaz desde una capa externa.

| Función y archivo original | Dependencias verificadas | Riesgo al implementar multimodo | Recomendación para IA 2 | Estado de comprobación |
| --- | --- | --- | --- | --- |
| **`ForestShared.validate/migrate/loadProject` — `index.html:1148-1636`, copia en motor Base64** | Esquema `forest-horror-map-v1`, versión interna ≤2; el motor invoca `ForestShared.loadProject(DATA)`. | Introducir campos de combate **obligatorios** en el JSON rompería mapas antiguos o su importación. | **INTOCABLE.** Mantener intacto el contrato de mapa y colocar selector/configuración de combate fuera de los campos requeridos de `forest-horror-map-v1`. | [C] estático |
| **`makeCurrent3DProject` — `index.html:3396-3410`** | `project`, `FHCharacterCreation.current()`, `ForestShared.gameSaveKey`, `__runtimeCharacter` y `__runtimeSave`. | El transporte padre–iframe no tiene selector ni sobre de modo validado. | Futuro sobre/versionado **opcional y externo al esquema de mapa**; conservar intacta la proyección geométrica. No suponer un campo multimodo ya existente. | [C] estático |
| **`decodeEmbedded3DEngine` — `index.html:3365-3377`** | 13 `engine-*.js` en orden, `window.__FOREST_EMBEDDED_ENGINE__`, `atob` y `TextDecoder`. | Reordenar fragmentos o inyectar lógica dentro de la cadena Base64 causa ruptura difícil de aislar. | **INTOCABLE.** Los contratos no deben depender de editar el empaquetado. | [C] estático |
| **`prepareGLBEngineDoc` — `index.html:3515-3700, 4844-4866, 5030`** | Sustituye mediante `.replace`/`.split` funciones embebidas (`validate`, ascensores, iluminación, circuitos), agrega scripts y encadena hooks. | Cambios de texto o de orden provocan anclas ausentes, duplicadas o reemplazos silenciosos; un modo nuevo puede romper inicialización 3D. | **INTOCABLE para IA 2.** Diseñar interfaces de adaptador evaluables fuera del texto HTML; documentar el orden actual como restricción de compatibilidad, no extenderlo para combate. | [C] anclas vistas; [P] ensamblaje completo en navegador |
| **`start3DPreview` + `play3DFrame.srcdoc` — `index.html:5033-5097`** | `FHServicesEngine.patch` → `FHArchitectureSkins.patchEngineDoc` → `FHStructureHealthEngine.patch` → `FHBarriersEngine.patch` → `FHCCTVEngine.patch` → `FHForestEngine.patch`; fallback `fhEngineDoc`. | Un adaptador fallido puede deshabilitar otros subsistemas al caer a la ruta de reserva. | **INTOCABLE.** Que IA 2 documente contratos sin añadir otro `patch()` ni asumir disponibilidad de todos los runtimes en las rutas de error. | [C] orden/fallback; [P] ejecución real |
| **`FHServicesEngine.patch` — `juego/assets/fh-services-engine-hook.js:4-9, 265-354`** | Anclas exactas en `createGameState`, `GameState`/`saveProgress`, servicios, equipamiento, visuales. | Cambiar la estructura de `GameState` o las anclas compartidas puede afectar iluminación, inventario y servicios. | **INTOCABLE.** Conservar estado de servicios/equipamiento; no introducir lógica de modo en el hook de energía. | [C] fuente; [P] montaje en 3D |
| **`FHContextEngine.patch` — `juego/assets/fh-context-engine-hook.js:5-9`** | `useFurniture`, controles HUD, inventario, `GameState.character` y sustituciones de texto. | Confluir eventos de combate con el menú/contexto podría modificar interacción y movimiento. | **INTOCABLE.** Contratos de resolución no deben secuestrar `useFurniture` ni los controles del mapa. | [C] fuente |
| **`FHForestEngine.patch` — `juego/assets/fh-forest-engine-hook.js:5-95`** | Inserta `FHForestRuntime`, modifica `ForestShared.solidAt`, `sightRayDistance`, `updateCameraCutaway`, instancias y CCTV; múltiples anclas obligatorias. | Cambiar colisión o FOW para un modo rompería árboles, recortes o NPC y haría frágiles los reemplazos. | **INTOCABLE.** Mantener mundo/obstáculos fuera del resolutor de combate. | [C] fuente; [P] visual WebGL |
| **`FHCCTVEngine.patch` — `juego/assets/fh-cctv-engine-hook.js:11-61, 204-293`** | Reescribe `drawSight` para un observador alterno y usa `GameState.clock`; valida apariciones de texto. | Un cambio de visión por combate puede alterar cámaras y máscaras del jugador. | **INTOCABLE.** Combate puede consumir información de visión por interfaz de solo lectura, no modificar `drawSight`. | [C] fuente; [P] visual |
| **`addFloorVisibilityToEngine`/`addNaturalLightToEngine` — `index.html:4566-4710`** | Fachadas, losas, luz, `drawSight`, `FHFloorVisibility`, `FHLights`, `FHNaturalLight`. | Un parche adicional de combate sobre `drawSight` puede romper occlusión y la composición CCTV. | **INTOCABLE.** Mantener visibilidad y luz como servicios del mundo. | [C] fuente; [P] WebGL |
| **`createGameState` — motor original Base64, función dentro de `startGame`; alterada por hooks de `index.html:3716, 4550, 4822, 4857, 4999`** | Estado base: `flags`, `inventory`, `doors`, `player`, `used`, `cooldowns`, `elevators`, `flashlight`, `stats`; otros hooks añaden `character`, `horror`, `survival`, `services`, `construction`, etc. | Reemplazarlo o asumir campos obligatorios por modo perdería estados previos o causaría sobrescrituras. | **INTOCABLE en la misión actual.** IA 2 debe proponer un *sobre de partida* versionado y separar estado del mundo de estado de reglas, respetando los guardados Legacy. | [C] motor decodificado y hooks; [P] migración de modos |
| **`ForestShared.solidAt` — `index.html:266-297` y motor Base64** | Radio, paredes, puertas, objetos, `surfaceAllowed`, colisión adicional de bosque. | Cambiarlo para resolver un golpe transforma colisión del jugador/NPC y obstáculos 3D. | **INTOCABLE.** El adaptador de combate solo puede consultar datos geométricos derivados, no escribir o parchear colisiones. | [C] estático |
| **`canWalk`, `walk`, `moveUpdate` — motor Base64, `canWalk` líneas decodificadas 3158-3182; `moveUpdate` 3896`** | `ForestShared.solidAt`, `CELL`, `doorList`, `blockers`, `furnitureColliders`, `SLABS`, ascensores y triggers. `addSurvivalToEngine` añade bloqueo por estado crítico (`index.html:4762-4765`). | Encajar «turnos» cambiando estas funciones afectaría física, navegación y otras inyecciones ya activas. | **INTOCABLE.** Resolver turnos/ataques fuera del movimiento. Preservar el bloqueo crítico actual mientras se define qué efectos expone el nuevo modo. | [C] motor/hooks; [P] juego 3D |
| **`playSolidAt`/`playTryMove`/`playRayWall` — `index.html:3304-3355`** | Prueba 2D, `ForestShared.solidAt`, rayos Canvas y objetos del mapa. | La prueba 2D deja de ser referencia de colisión/visión si se modifica independientemente para combate. | **INTOCABLE.** Mantener prueba 2D separada de cualquier adaptador de combate. | [C] estático |
| **`FHNPCGOAP.route`/`planDoor` — `juego/assets/fh-npc-goap.js:89-164`** | A* 2.5D, `canWalk` inyectado, `transitions[]`, `canOpenDoor` y derechos. | Un nuevo motor de combate podría imponer casillas/puertas distintas a NPC y jugador. | **INTOCABLE.** Reutilizar rutas reales; no reemplazar A* por un sistema de casillas de combate. | [C] + [V] 9 pruebas GOAP |
| **`fhNpcCanWalk`/`fhNpcOpenDoor`/`fhNpcStairTransitions` — texto inyectado en `index.html:4276-4350`** | `GameState.flags`, `FHStyleProperty`, `FHNPCGOAP.canOpenDoor/planDoor`, colisión `ForestShared.solidAt` y estado real de puertas/elevadores/escaleras. | Un modo que quite bloqueos o reemplace permisos abre rutas ilegales. | **INTOCABLE.** IA 2 no debe redefinir permisos de propiedad, geometría ni transiciones. | [C] integración textual; [P] 3D |
| **`FHNPCCourier.createRuntime`/`tick` — `juego/assets/fh-npc-courier.js:8-127`** | `FHNPCGOAP.route`, `canWalk`/`canPlanWalk`, apertura autorizada por callback, transición de pisos. | Rutas planificadas y movimiento real tienen validaciones distintas; el combate no debe saltarlas. | **INTOCABLE.** Las futuras criaturas pueden compartir interfaz de navegación, no sustituir la implementación de repartidores. | [C] fuente |
| **`fhShadowInside`/`fhShadowPhaseWalkable`/`fhShadowRoute`/`fhShadowNightmareClear` — `index.html:4819-4820` (cadena inyectada)** | `FHNPCGOAP.route`, `fhNpcCanWalk`, `fhNpcStairTransitions`, `ForestShared.solidAt`; excepciones específicas de Sombras por tipo y PE. | Confundir capacidades paranormales con movilidad universal convertiría paredes/puertas en atravesables por NPC ordinarios. | **INTOCABLE.** Separar **reglas de criatura** (fase, interior, pesadilla) de **navegación compartida**; nunca generalizar el bypass. | [C] texto; [V] 18 pruebas de Sombras aisladas |
| **`FHShadowAI.createRuntime`/`path`/`move` — `juego/assets/fh-shadow-ai.js:23-26, 125-127, 218-248`** | Callbacks `route`, `canWalk`, `move`, `canPhase`, `insideAt`; mapa implícito a través de callbacks. | Mezclar «puntos de energía de la criatura» con PE del jugador o con costos del modo altera fases y rutas. | **INTOCABLE la IA y sus callbacks de desplazamiento.** Exponer el estado del actor para una futura resolución, sin cambiar consumos de fase. | [C] + [V] 18 pruebas |
| **`FHShadowAI.attack` — `juego/assets/fh-shadow-ai.js:258-269`** | `options.chooseAttack`, `actor.pe`, `rollD4`, evento `attack` con `resource`, `damage` y `dice`. | Reglas Legacy de 1d4/2d4 están dentro de la IA; no hay tirada contra EVA en esa ruta. | **Futura zona de adaptación de combate**, **no tocar ahora**: IA 2 debe separar «intención de ataque» de «resultado Legacy» en un contrato independiente; conservar compatibilidad del evento existente. | [C] + [V] 18 pruebas |
| **`addShadowEncountersToEngine`: `chooseAttack`/`onEvent('attack')` — `index.html:4819-4841`** | `FHNPCGOAP.chooseGoal`, `GameState.horror`, `FHShadowAI`, `FHSurvivalRuntime.change('sp',…)`/`damagePG(…)`, `GameEvents.emit('combat:damage')`, `saveProgress`. | **RIESGO ALTO:** el evento `combat:damage` es posterior al daño, no permite cancelarlo; sustituirlo sin tener en cuenta el orden duplicaría daño. | **Punto de conexión futuro**, previo a aplicación de daño, diseñado por IA 2. El contrato debe separar selección de objetivo, tirada, resultado, gasto y aplicación única; no modificar aquí. | [C] fuente; [P] combates multimodo |
| **`FHSurvival.createRuntime`: `setResource`/`change`/`damagePG`/`setPGMax` — `juego/assets/fh-survival-core.js:22-90`** | Mutación de `GameState.character.resources.pg/sp/pe`, máximos y estado `critical`; `change` es genérico, `damagePG` llama `checkCritical` inmediatamente. | Usar `change('pg',-n)` en vez de `damagePG(n)` deja comprobación de crítico para `update`; escrituras directas pueden saltar callbacks. | **Mantener como propietario Legacy de recursos.** IA 2 puede definir una futura interfaz de **aplicación única** por modo; no hacer que el combate cambie la estructura de la simulación física. | [C] + [V] 13 pruebas |
| **`FHSurvival.createRuntime`: `spendPE`/`deathSave`/`update`/`wake`/`completeSleep` — `juego/assets/fh-survival-core.js:70-200`** | PE para costos, monedas Legacy de salvación, recuperación/desgaste temporal de PG/PS/PE y `GameState.survival`. | Tres modos podrían tener costos, críticos y recuperaciones incompatibles si se intercambia `GameState.survival` sin modo/versionado. | **No alterar ciclo temporal ni necesidades del mundo.** Tratar monedas y salvaciones como regla Legacy; separar estado de resolución antes de diseñar DnD/Moon. | [C] + [V] 13 pruebas |
| **`addSurvivalToEngine` — `index.html:4712-4772`** | Anclas de `createGameState`, `FHCharacterRuntime`, `moveUpdate`, `FHSurvivalRuntime`, `FHSleep`, `FHLights` y `saveProgress`. | Nuevo parche al mismo bloque de arranque o a movimiento podría invalidar esas coincidencias textuales. | **INTOCABLE.** IA 2 debe documentar la interfaz prevista, no instalar otro hook de combatientes en `moveUpdate`. | [C] fuente; [P] arranque 3D |
| **`FHMoodFear.createRuntime`: `setMood`/`promote`/`stimulus`/`tick` — `juego/assets/fh-mood-fear-core.js:30-119`** | `character.mental`, `character.scores.VOL`, `character.resources.sp/spMax`; `promote` **escribe directamente** `r.sp`, con callbacks `onSanityLoss`. | Riesgo de doble drenaje de PS si un resolutor de combate aplica otra vez el evento de miedo. | **Conservar un único propietario de los efectos de miedo.** IA 2 debe especificar si el modo consume eventos de miedo sin repetir su descuento actual. | [C] + [V] 15 pruebas |
| **`addMoodFearToEngine` — `index.html:4774-4816`** | Ancla `window.FHSurvivalRuntime=fhSurvival`; crea `FHMoodFearRuntime`, `FHScareRuntime` y escucha `horror:stimulus`; guarda estado mental en personaje. | Otro modo que añada daño de PS por el mismo estímulo provocaría doble aplicación. | **Futura conexión por evento**, pero sin tocar el emisor ni el runtime; diferenciar «estímulo» de «daño producido». | [C] estático; [P] multimodo |
| **`FHSkills.setPoints`/`odds`/`roll` — `juego/assets/fh-skills.js:34-83`** | `character.skills`, `FHSurvival.penaltySP` opcional, dificultad porcentual y monedas; `setPoints` es la que cambia puntos de habilidad, `roll` devuelve resultado. | Interpretar esas monedas como interfaz universal de tiradas DnD/Moon acoplaría todos los modos al Legacy. | **Conservar catálogo y almacenamiento actuales para Legacy.** IA 2 debe definir una interfaz de resolución diferenciada; no cambiar `FHSkills.roll` ni su formato actual. | [C] + [V] 24 aserciones |
| **`FHCharacterCore.resources`/`createProfile` — `juego/assets/fh-character-core.js:32-55`** | `SCORES`, fórmulas de PG/PS/PE máximos y evasión derivada; genera `skills` y `resources` del perfil. | Nuevos modos con otros máximos podrían sobreescribir perfil Legacy por usar los mismos nombres. | **INTOCABLE ahora.** Mantener identidad del jugador separada de recursos por sistema y documentar derivaciones por modo; no asumir EVA persistida. | [C] + [V] 37 aserciones de personaje/persistencia |
| **`FHCharacterCore.store/load`/`selectMapSave`/`syncResourcesFromSave`/`syncSkillsFromSave` — `juego/assets/fh-character-core.js:58-118`** | `localStorage['blakpine_character_active_v1']`, perfil versión 1; valida `characterId` y `payload.version===1`, no modo; sincroniza PG/PS/PE y habilidades al perfil activo. | **RIESGO ALTO:** DnD/Moon/Legacy compartirían clave/perfil sin discriminador de modo, con clamping de recursos y sobrescritura de habilidades. | **Separar almacenamiento lógico por modo/versionado** fuera del mapa, diseñar migraciones explícitas y preservar lectura de Legacy sin escribir otro modo en sus claves. | [C] + [V] 37 aserciones |
| **`gameSaveKey` — `index.html:1477-1478` y motor Base64** | Clave `fh_game_v1_<hash>` derivada de `createdAt` o título/IDs de pisos. **No utiliza modo ni personaje**. | Dos modos sobre el mismo mapa apuntarían a la misma clave de partida. | **INTOCABLE para Legacy.** IA 2 debe proponer identidad de guardado por modo y personaje sin alterar hash de mapa existente. | [C] estático |
| **`readGameSave`/`writeGameSave`/`saveProgress` — motor original Base64 (líneas decodificadas 2284-2300, 2423-2430); hooks en `index.html:4430-4433`** | Guardado `JSON.stringify({version:1,state})`; lee de `localStorage` o `__runtimeSave` y copia `GameState` completo; `saveProgress` envía `FOREST_GAMESTATE_SAVE` al padre. | `version:1` distingue sobre, no DnD/Moon/Legacy; estados incompatibles podrían reemplazarse bajo una clave igual. | **INTOCABLE.** IA 2 debe diseñar *envelope* independiente y rechazo de modos desconocidos; nunca escribir un estado DnD/Moon con el sobre/clave Legacy actual. | [C] motor decodificado; [P] pruebas de migración multimodo |
| **`startGame` y aplicación de personaje restaurado — motor Base64 + `index.html:4855-4860`** | `restored`, `__runtimeCharacter.id`, `characterId` y `GameState.stats={...scores}`; filtra restauraciones por ID cuando hay personaje. | Aunque valida ID, no valida modo; `GameState.stats` y `character.scores` no equivalen a estadísticas de combate DnD/Moon. | Respetar el filtro existente por personaje; **no reutilizar `GameState.stats` como contrato de combate universal**. | [C] fuente |
| **`window.addEventListener('message')` de guardado — `index.html:5178-5212`** | Comprueba `e.source===play3DFrame.contentWindow`, `gameSaveKey(project)` y `FHCharacterCreation.selectMapSave(json,id)` antes de guardar/sincronizar. | Autoriza por origen/clave/personaje, **no por modo**; duplicar canales sin versionado causaría colisión de estados. | Diseñar el sobre de modo sin debilitar estas comprobaciones y sin confundir mensaje de guardado con API de combate. | [C] estático |
| **`FHPlayerMenu.appendSkills` y `FHStatusHUD.update` — `juego/assets/fh-player-menu.js:81-124`, `fh-status-hud.js:127-157`** | Visualizan `FHSkills.roll`, `scores`, `pg/sp/pe` y `mental.mood`; no aplican el daño de Sombras. | Tres modos podrían mostrar resultados Legacy o máximos equivocados si la UI asume el perfil actual. | Adaptar solo **presentación** mediante un modelo de lectura por modo futuro; mantener HUD y menú existentes para Legacy. | [C] estático |
| **`FHStructureHealth.damage`/`takeDamage` — `juego/assets/fh-structure-health.js:79-99, 164-182`** | `GameState.structures`, tipos `physical/magical`, vulnerabilidad, eliminación de colisionadores, `structure:damage` y `saveProgress`. | Confundir PG estructural con PG de personaje rompe geometría/persistencia de puertas. | **INTOCABLE.** Nunca despachar daño a objetos mediante el recurso del jugador; contratos deben distinguir objetivos `actor` y `structure`. | [C] estático |
| **`FHRepair.validateJob`/`skillGroup` — `juego/assets/fh-repair.js:12-16, 37-97`** | Catálogo `FHSkills.IDS/GROUPS`, `recoverablePG` de reparación, no aplica combate. | Cambiar IDs de habilidades por DnD podría invalidar trabajos de reparación Legacy. | Mantener IDs Legacy; IA 2 debe separar catálogo de habilidades del resultado de una tirada. | [C] estático |

**Lectura de la matriz:** las filas de navegación/colisión/visibilidad y serialización Legacy son **funciones intocables**. Las zonas candidatas para futuros **adaptadores de combate** son **interfaces alrededor de la intención de ataque y del gasto/aplicación de recursos**, no nuevos reemplazos textuales del motor. Ninguna interfaz multimodo propuesta en esta tabla se ha creado.

### 13.3. Dependencias del combate: ruta efectiva verificada

```text
FHShadowAI.tick(minute, dt, player)
  ├─ lee player.pg / sp / pgMax / spMax para probabilidad de aparición
  ├─ path / move → callbacks de navegación (NO combate)
  └─ attack(actor, player)
       ├─ options.chooseAttack(...) → FHNPCGOAP.chooseGoal(...) (elección Legacy)
       ├─ actor.pe-- cuando potencia (PE DE CRIATURA, NO DEL JUGADOR)
       ├─ rollD4() (+ rollD4() si potencia)
       └─ onEvent('attack', { resource, damage, dice, ... })
            └─ hook index.html: FHSurvivalRuntime
                 ├─ resource=='sp' → change('sp', -damage)
                 └─ resource=='pg' → damagePG(damage)
                      └─ checkCritical()
                 └─ si hubo cambio:
                      GameEvents.emit('combat:damage')  ← POST-APLICACIÓN
                      saveProgress()
```

**[C]** Los eventos `horror:stimulus` siguen otra ruta: `GameEvents` → `FHMoodFearRuntime.stimulus` → `promote` puede disminuir PS directamente. Por tanto, un modo futuro debe evitar escuchar y aplicar **dos veces** el mismo daño desde `horror:stimulus`, `onSanityLoss` y `combat:damage`.

**[C]** `FHSurvivalRuntime.change`, `damagePG` y `spendPE` son mutadores del **jugador**. En contraste, `FHShadowAI.actor.pe` es un contador local de la criatura que determina ataque potenciado y fase. `FHStructureHealth.damage` es de **objetos físicos**. Estos nombres similares no dan licencia para unificar propietarios del estado.

**[R]** Contrato candidato **para diseñar**, no implementado: intención de acción con actor/objetivo/modo, cálculo de resultado separado, costo, aplicación **única** y notificación posterior. Debe permitir que la salida Legacy conserve su semántica y que un modo no altere `ForestShared.solidAt`, `canWalk` o `FHNPCGOAP.route`. El evento actual `combat:damage` no cumple todas esas etapas.

### 13.4. Persistencia: colisiones potenciales entre DnD, Moon y Legacy

**[C] Cadena existente:**

1. **Identidad de personaje:** `FHCharacterCore.KEY = 'blakpine_character_active_v1'`; perfil `version:1` con `id`, `scores`, `skills` y `resources` (`fh-character-core.js:4-5, 42-55, 60-76`).
2. **Identidad de partida:** `ForestShared.gameSaveKey(map)` produce `fh_game_v1_<hash>` **solo** a partir de identidad de mapa (`index.html:1477-1478`).
3. **Sobre de partida:** `writeGameSave` escribe `{version:1,state:GameState}`; `readGameSave` acepta sobres de versión 1 desde almacenamiento local o copia aportada por el editor (motor Base64, líneas decodificadas 2284-2300).
4. **Al lanzar:** el padre adjunta `__runtimeCharacter` y `__runtimeSave` (`index.html:3396-3409`). La integración elige `restored` comprobando `characterId` cuando hay personaje, pero no inspecciona un modo (`index.html:4855-4858`).
5. **Al guardar:** el iframe emite `FOREST_GAMESTATE_SAVE`; el padre valida origen, clave e ID de personaje y luego sincroniza `pg/sp/pe` y habilidades en el perfil global (`index.html:5178-5208`; `fh-character-core.js:90-118`).

**[R] Escenario de incompatibilidad, NO incidente observado:** si DnD y Legacy usaran la misma clave `fh_game_v1_<hash>` y el mismo `characterId`, el código actual carece de discriminador para evitar que una partida reemplace los recursos/skills interpretados por la otra. Si se agregan habilidades diferentes, `syncSkillsFromSave` normaliza contra el catálogo Legacy y descarta claves desconocidas. Si se agregan máximos distintos, `syncResourcesFromSave` limita los valores entrantes usando los máximos del perfil activo.

**Requisito de diseño para IA 2 (no implementado):** distinguir **identidad del mapa** de **identidad del personaje**, **identidad del modo de combate** y **versión del contrato de reglas/guardado**. Mantener intactos `forest-horror-map-v1` y las claves Legacy actuales; diseñar espacios de guardado distintos para modos nuevos, política explícita de lectura/migración y rechazo seguro de versiones desconocidas antes de escribir nada. No añadir campos obligatorios a mapas existentes ni reutilizar `GameState.stats` como forma universal.

### 13.5. Registro de verificación — lo ejecutado y lo no ejecutado

**Cobertura estática [C]:** inspeccionados `index.html` y `juego/index.html`; decodificados los 13 fragmentos Base64 del motor (funciones y anclas de arranque, guardado, colisión, visibilidad y eventos); revisados los adaptadores de servicios, contexto, estructura, barreras, CCTV y bosque; inspeccionados los **170 scripts `fh-*.js` que no son archivos `*.test.js`** para buscar referencias directas a recursos, estadísticas y puntos de combate, con lectura específica de los módulos que sí modifican esos datos. Este barrido de símbolos **no prueba ausencia absoluta de accesos dinámicos o indirectos**.

**Entorno de pruebas:** `node v22.16.0` y Chromium disponibles. Se intentó clonar la rama del PR con `git clone --filter=blob:none --single-branch --depth=1`, pero el contenedor devolvió **`Could not resolve host: github.com`**. No se obtuvo un checkout local completo. Se ejecutó, como alternativa parcial, el **contenido original de los archivos de pruebas y módulos leído desde GitHub** mediante JavaScript V8 aislado y adaptadores mínimos de `require`, `node:test` y `node:assert/strict`. Esto ejercita aserciones y funciones reales, pero **no equivale** a `node --test`: los adaptadores no son una implementación completa de los módulos nativos de Node y no incluyen DOM/WebGL.

| Prueba existente | Resultado de ejecución adaptada [V] | Limitación / estado |
| --- | --- | --- |
| `fh-skills.test.js` | **24 aserciones superadas**; catálogo, porcentajes, ventajas, desventajas, críticos. | Ejecutado en V8 con `assert` simulado. Un primer intento falló **por ausencia de `console` en el entorno de prueba**; repetición con un `console` simulado: aprobada. No se considera error del proyecto. |
| `fh-character-core.test.js` | **37 aserciones superadas**; perfil, recursos, sincronización, guardado y muerte. | Ejecutado con `vm`/`fs`/`path` adaptados sobre el código original recuperado. No equivale a runtime real con `localStorage` del navegador. |
| `fh-survival-core.test.js` | **13 casos superados**; recursos, crítico, sueño, desgaste, reloj y persistencia. | Ejecución V8 adaptada; no se lanzó `node --test`. |
| `fh-mood-fear-core.test.js` | **15 casos superados**; Mood, estrés, PS, oscuridad y referencias estáticas de UI. | Ejecución V8 adaptada; lectura de HTML/CSS provista por `fs` simulado. |
| `fh-npc-goap.test.js` | **9 casos superados**; A*, pisos, puertas y acciones GOAP. | Ejecución V8 adaptada; no prueba rutas en escena real. |
| `fh-shadow-ai.test.js` | **18 casos superados**; Sombras, contacto, pisos, movimiento y ataques Legacy. | Ejecución V8 adaptada; no prueba actor visual/colisión real de Three.js. |

**Balance de esta verificación:** 55 casos nombrados de cuatro suites más 61 aserciones directas de dos scripts (=116 comprobaciones ejecutadas en el entorno adaptado), **0 fallos de aserción del proyecto** en las repeticiones completas. Los resultados son **[V]**, no «Node PASS» ni «3D PASS». El fallo inicial por `console` simulado y el bloqueo DNS están registrados por separado.

**No ejecutados [P]:** `fh-preview-boot.test.js`, `fh-forest-engine-hook.test.js` y demás pruebas de composición con `fs`/`vm`/Three real; `node --test` nativo; navegador, WebGL, pruebas de GPU/FOW, guardados DnD/Moon/Legacy y sus migraciones. No se instalaron herramientas, no se crearon workflows ni se esperó ningún estado de CI.

### 13.6. Handoff para IA 2 — límites verificables del diseño

**Zona protegida del motor:** `ForestShared.validate/migrate/loadProject`, `ForestShared.solidAt`, `canWalk/walk/moveUpdate`, `FHNPCGOAP.route`, `fhNpcCanWalk/fhNpcOpenDoor/fhNpcStairTransitions`, `drawSight/installVisibility`, `FHForestEngine.patch`, `FHFloorVisibility`, `buildFloor`, ``CELLS`/`CELL`, losas, puertas y red de drenajes/calles. **No introducir resolución DnD/Moon dentro de ninguno de ellos.**

**Zonas de interfaz futura, sin tocar las implementaciones ahora:** entrada de acciones/ataques en `FHShadowAI`, punto anterior a `FHSurvivalRuntime.damagePG/change` en el consumidor de eventos, cálculo Legacy `FHSkills.odds/roll`, clasificación de efecto de `FHMoodFear.stimulus`, acceso de lectura `FHCharacterRuntime.character` y presentación en `FHStatusHUD`/`FHPlayerMenu`. La IA 2 debe proponer **contratos externos y versionados**; ningún punto existente constituye por sí solo un adaptador multimodo listo.

**Persistencia requerida antes de habilitar otros modos:** no escribir DnD/Moon bajo `fh_game_v1_<hash>` ni `blakpine_character_active_v1` sin una política explícita de compatibilidad; no mutar archivos `forest-horror-map-v1`; no asumir que los campos `stats`/`scores`/`skills` Legacy sirven para todos los modos; evitar que guardados de modos distintos sobrescriban identidades y recursos.

**Decisión de auditoría:** **apto como base de diseño de contratos por IA 2**, **NO certificado como compatible en ejecución con DnD/Moon/Legacy**. Esta misión se limita a diagnóstico. Ningún motor, función, mapa, esquema, recurso o prueba del repositorio fue modificado; la única entrega de código fuente remoto es la ampliación documental de este archivo.
