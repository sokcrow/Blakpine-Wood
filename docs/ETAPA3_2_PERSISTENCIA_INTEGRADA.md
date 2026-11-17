# Etapa 3.2 — Persistencia multimodo conectada al juego

**Base:** `main` en `07072f515d7cec6a2896b303c46fe6edd51774ac`, posterior al PR #212 (Etapa 3.1).  
**Estado:** integración padre/iframe con separación estricta; Legacy operativo. DnD y Moon **no son jugables** mientras no existan sus adaptadores de combate y persistencia reales.

## Entradas reales protegidas

| Recorrido | Legacy | Multimodo |
| --- | --- | --- |
| Arranque desde el editor | `FHCharacterCreation.ensureCharacter`; no cambia | `prepare3DSaveSession(profile)` liga mapa/personaje/reglamento/versión/slot y token efímero; rechaza adaptadores sin estado `implemented` |
| Proyecto enviado al iframe | `__runtimeSave`, `__runtimeCharacter` | `__multimodeSave = { identity, sessionId, backupRaw }`; sin perfil ni backup Legacy |
| Lectura del motor ensamblado | `readGameSave(local, SAVE_KEY, backup)` + filtro `characterId` existentes | `FHMultimodePersistence.restore` valida sobre y adaptador *antes* de crear `GameState` |
| Escritura en el iframe | `writeGameSave(local, SAVE_KEY, GameState)` original | `fhMultimode.write(GameState,DATA)`; `pack` valida antes del primer `setItem` |
| Mensaje iframe → padre | `FOREST_GAMESTATE_SAVE` | `FOREST_MULTIMODE_SAVE` con sesión, identidad, clave, secuencia y sobre validado |
| Recepción padre | `selectMapSave`, `syncResourcesFromSave`, `syncSkillsFromSave` solo Legacy | `accept` revalida token, clave derivada, identidad, formato, reglamento y orden antes de escribir |
| Muerte | `FOREST_CHARACTER_DEATH` → `markDead` Legacy | Guardado validado y `FOREST_MULTIMODE_DEATH`; NO muta perfil Legacy |
| Cierre | Funciones originales | Se revoca sesión ligada; mensajes atrasados carecen de autorización |

El motor sigue empaquetado en `engine-00.js` a `engine-12.js`. Se modifica el documento **real** ya ensamblado en memoria, después de sus hooks, mediante `FHMultimodeSaveHook.patch`, también en el recorrido de recuperación visual. No se modifica el Base64 ni se crea una copia de motor fuera del juego.

## Identidad durable y separación de versiones

La identidad fija del guardado es `{mapId,characterId,rulesetId,rulesetVersion,saveId}`. En este editor, `mapId` se liga a `project.createdAt` (ID estable del mapa) y se rechaza una selección cuyo `mapId` no coincida. `saveId` identifica cada ranura por separado. `sessionId` es un token por ejecución, nunca se escribe en la identidad durable. El contrato del sobre exige `formatVersion:1` y `rulesetVersion:1`, validadores síncronos y `rulesetId` concordante.

Las claves existentes `fh_game_v1_<hash>` y `blakpine_character_active_v1` **no se migran ni se reescriben**. DnD/Moon usan exclusivamente claves `blakpine_multimode_save_v1:` calculadas por `FHMultimodeSaveIdentity`. El lector Legacy no recibe sobres multimodo; las estadísticas y los recursos exclusivos del adaptador no se envían a `FHCharacterCore`. Si hay datos locales incompatibles, se rechaza la restauración y **no** se sustituye por un respaldo o una partida Legacy.

## Contrato para futuros adaptadores reales

Un adaptador de guardado multimodo debe declararse en `window.FHMultimodeSaveAdapters[rulesetId]` con:

- `status:'implemented'`, `contract:'blakpine-save-adapter-v1'`, `rulesetId`.
- `validateWorldState(world,identity)`, `validateRulesetState(rules,identity)`, ambos devuelven **true exacto**, síncrono.
- `capture(gameState,map,identity)` devuelve `{world,rules:{rulesetId,rulesetVersion:1,data}}`.
- `restore(world,rules,map,identity)` y `initial(map,identity)` devuelven un estado plano y separable del motor.

**Eso por sí solo no habilita el juego.** El inicio en padre e iframe también comprueba `window.FHMultimodeCombatAdapters[rulesetId]`: `status:'implemented'`, `contract:'blakpine-combat-adapter-v1'`, `rulesetId` exacto y `evaluate()`. El registro no crea adaptadores, no cambia manifiestos de `reserved` a `implemented` ni presenta DnD/Moon como funcionales. El selector de interfaz y el cableado definitivo del combate corresponden a la Etapa 3.3.

## Validación y límites

Pruebas añadidas: `tests/multimode-save-runtime.test.cjs` (8 casos) y `tests/multimode-save-engine-hook.test.cjs` (ensamblado real, arranque del padre, simulaciones de guardado Legacy y multimodo, muerte). Los casos cubren claves antiguas, mismo mapa/personaje con reglamentos diferentes, mapa/personaje/slot distintos, cierre/reapertura, muerte y restauración, mensajes repetidos/viejos, datos y versiones incompatibles, ausencia de sobrescritura y modo bloqueado sin adaptador.

Validación ejecutada directamente durante la integración: sintaxis del script principal de `index.html`, 8 pruebas lógicas de persistencia en VM de JavaScript, compilación del hook inyectado y 4 comprobaciones dirigidas de Legacy, multimodo y bloqueo sin adaptador: **12/12 PASS**, sin fallos. Son verificaciones aisladas; **no sustituyen** `node --test` completo, un navegador real ni WebGL. El test de ensamblado real se dejó en el repositorio para ejecución con Node en un entorno con la copia del proyecto.

Comandos reproducibles en un checkout del repositorio:

```sh
node --test tests/multimode-save-isolation.test.cjs tests/multimode-save-runtime.test.cjs tests/multimode-save-engine-hook.test.cjs tests/mode-session.test.cjs
node contratos/multimodo/validar-contratos.mjs
```

**No se tocaron:** guardados históricos, claves Legacy, generación de mapas, puertas/colisión/navegación, estadísticas ni fórmulas Legacy, `engine-00.js` a `engine-12.js`, manifiestos DnD/Moon ni workflows. La validación visual en navegador queda pendiente.
