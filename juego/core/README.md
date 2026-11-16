# Preparación multimodo independiente del motor

`fh-mode-selection.js` y `fh-session-coordinator.js` funcionan como CommonJS en
Node o como scripts clásicos (`FHModeSelection` y `FHSessionCoordinator`). No se
incluyen en el HTML ni se conectan al gameplay en esta entrega.

## Funciones públicas

### `FHModeSelection.readSelection(selection, { readJson, validate })`

Devuelve una promesa. `selection` es el objeto JSON externo de selección v1,
no una ruta ni el JSON del mapa. Solo `null` y `undefined` significan ausencia:
retorna `{ kind: 'legacy' }` sin consultar dependencias.

Con selección explícita exige dos funciones inyectadas:

- `readJson(repoRelativePath) -> JSON | Promise<JSON>`: lee y parsea documentos
  desde una raíz fija del repositorio. Debe rechazar inexistencia, JSON inválido
  y cualquier escape de raíz (incluidos enlaces simbólicos y redirecciones).
- `validate(data, canonicalSchema) -> true | Promise<true>`: validador compatible
  con los esquemas JSON Schema Draft 2020-12 canónicos. Debe comprobar todas sus
  restricciones, devolver exactamente `true` al aceptar y rechazar o devolver
  otro valor al fallar. Es una dependencia de confianza; no usar un callback que
  acepte todo. No se instala ni duplica un validador o esquema en estos módulos.

El lector carga los tres esquemas directamente de `contratos/multimodo/v1/`.
Valida la selección antes de leer sus referencias relativas a raíz y valida
cada documento contra su esquema correspondiente. Devuelve
`{ kind: 'multimode', selection, worldProfile, rulesetManifest }` con copias
profundamente congeladas. No carga el mapa, importa adaptadores ni interpreta
extensiones. Admite únicamente datos JSON; las dependencias no deben entregar
objetos del motor, funciones, ciclos o getters.

Errores `ModeSelectionError` con `.code` estable: `SELECTION_DEPENDENCIES_MISSING`,
`DOCUMENT_READ_FAILED`, `CONTRACT_INVALID`, `INVALID_SELECTION` e
`INVALID_JSON_DATA` (este último puede aparecer en `.cause`). La causa original
se conserva. Son códigos de diagnóstico para el consumidor, no textos de UI.

### `FHSessionCoordinator.create({ readSelection, worldLoader, rulesAdapter })`

Devuelve `{ prepare }`. No valida ni invoca dependencias al crear el coordinador.
`readSelection(selection)` debe ser el lector anterior con sus dependencias
ligadas. Los puertos nuevos acordados durante esta tarea con IA 3 e IA 4 son:

| Dependencia | Firma y obligaciones |
| --- | --- |
| `worldLoader` | `prepare(worldProfile) -> Promise<WorldDescription>` (también admite retorno síncrono). Recibe solo el perfil validado e inmutable, comprueba existencia/JSON/schema real del mapa `forest-horror-map-v1` y prepara una descripción inmutable. No inicia Three.js, escribe partidas ni modifica estado del juego. No deduce soporte operativo de metadatos. |
| `rulesAdapter` | Objeto con `id`, `contract`, `rulesetId` y `evaluate(intent, readonlyWorldSnapshot, rulesetState)`. Identidad y contrato deben coincidir exactamente con el manifiesto; `rulesetId` coincide con su `id`. `evaluate` conserva la firma conceptual de §3 y **no se llama en esta preparación**. |

No existe una implementación real de estos dos puertos en `main` de referencia.
El objeto `WorldDescription` es un registro JSON de descripción, sin objetos del
motor. El coordinador devuelve una copia profundamente congelada; rechaza
arrays como raíz, tipos ajenos a JSON y referencias cíclicas. Ningún puerto recibe acceso al almacenamiento o
al estado vivo a través del coordinador.

### `coordinator.prepare(selection)`

Devuelve una promesa de uno de estos resultados:

- Sin selección: `{ kind: 'legacy' }`, sin invocar lector, validador, cargador ni
  adaptador. Es una indicación para continuar por el arranque existente, no una
  reimplementación de Legacy. El arranque actual sigue intacto.
- Selección explícita: exige manifiesto `implemented`, declaración `adapter`,
  dependencia con identidad coincidente y `evaluate` ejecutable. Después exige
  perfil con `map` y cargador disponible. Solo entonces llama al cargador y
  devuelve `{ kind: 'prepared', mode, worldDescription }`.

`prepared` describe preparación externa, **no sesión jugable ni autorización
para aplicar efectos**. No hay método de combate, `validateAndApply`, persistencia,
registro de sesiones activas ni activación/cierre del motor. Llamadas concurrentes
preparan descripciones independientes; no seleccionan una sesión global.

Errores `SessionPreparationError` con `.code`: `SELECTION_READER_MISSING`,
`SELECTION_FAILED`, `SELECTION_INVALID`, `RULESET_NOT_IMPLEMENTED`,
`RULES_ADAPTER_MISSING`, `RULES_ADAPTER_MISMATCH`, `WORLD_MAP_MISSING`,
`WORLD_LOADER_MISSING`, `WORLD_PREPARATION_FAILED`, `WORLD_DESCRIPTION_INVALID`.
Los fallos de lectura/carga conservan `.cause`. No se intenta otro reglamento.
Un cargador que rechace el mapa produce `WORLD_PREPARATION_FAILED`.

Los tres manifiestos oficiales siguen en `planned`: **toda selección explícita
actual, incluso Legacy, produce `RULESET_NOT_IMPLEMENTED` antes del cargador**.
Distopía y villa medieval además carecen de mapa. No se modifican los manifiestos
para eludir estos límites. Los tests positivos usan fixtures sintéticas.

## Base, coordinación y bloqueo de integración

Base inspeccionada: `main` en `9c5293986664b67f4e21485ebb2f83a2577a4b68`.
Se consultaron los contratos canónicos, inventario §13, contratos del motor §3,
perfiles IA 3 y [auditoría IA 1 del PR #199](https://github.com/sokcrow/Blakpine-Wood/pull/199)
en `2dff401fc908ee4fba830db97e9e8dd2d34c8fe7`.
Las interfaces de preparación se revisaron y acordaron antes de implementar con
agentes IA 3 (mundos) e IA 4 (reglas), sobre esas fuentes. Este acuerdo de diseño
no acredita la existencia de cargadores/adaptadores ni una aprobación del motor.

Según IA 1, falta una frontera soportada anterior a costes/tiradas de
`FHShadowAI.attack` y otra para la aplicación autorizada al dueño del recurso.
`combat:damage` es posterior al descuento. Exponer esas fronteras y aislar
lectura/escritura de partidas en padre e iframe requiere autorización y trabajo
posteriores: no se instala aquí otro parche textual, suscriptor ni fallback.
No se definen claves, migraciones o estadísticas universales.

## Verificación

- `node --test tests/mode-session.test.cjs`: selección, aislamiento de copias,
  validación con el validador real del repositorio, errores y puertos sintéticos.
  El test aísla las funciones puras del CLI canónico en `vm`, sin duplicarlas.
- `node contratos/multimodo/validar-contratos.mjs`: contratos oficiales.
- Suites Legacy/arranque y arquitectura indicadas en el PR.

No se ejecuta navegador/WebGL ni se afirma combate o guardado multimodo funcional.
