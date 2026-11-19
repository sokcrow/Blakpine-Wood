# IA 6 — Auditoría independiente de reglamentos (18-11-2026)

> **Resultado:** NO CONFORME para el aislamiento de **unidades DnD**, CONFORMIDAD PARCIAL de **estadísticas/guardados DnD**, **Moon pendiente y bloqueado**, **Legacy operativo parcialmente comprobado por pruebas existentes**. Esta auditoría **no implementa** reglas, no certifica DnD completo ni Moon jugable y **no bloquea PR ajenos**.
>
> **Repositorio:** `sokcrow/Blakpine-Wood`. **Base auditada:** `main@830b70c3bac6f3fd7e67e21c2b7bce362776027a`. **Modo de auditoría:** inspección de archivos GitHub, fórmulas, rutas de ejecución, contratos y fuentes de tests. **No se reejecutó** `node --test`, una partida WebGL ni un servidor local en esta entrega; resultados previos de tests y presencia de `assert` **no cuentan como ejecución independiente**.

## 1. Autoridad normativa y semántica de estados

**Fuentes rectoras, en orden por ámbito, sin fusionarlas:**

- **R-L:** [`docs/REGLAS_MODO_BLAKPINE_WOOD.md`](./REGLAS_MODO_BLAKPINE_WOOD.md): identificador `legacy`; `FHSkills` y Sombras **propios**; PG/PS/PE Legacy; conservar combate real y motor espacial compartido. Sombras exclusivas (§1); las fórmulas individuales requieren trazabilidad antes de ampliarse (`2 y `6).
- **R-D:** [`docs/REGLAS_MODO_DND.md`](./REGLAS_MODO_DND.md): identificador `dnd`; prototipo parametrizable D20/D4 **no equivale** a edición aprobada; ningún PE/cooldown por comodidad; la IA y unidades de Sombras **prohibidas en DnD** (`1, `2, `4, `8); edición/turnos/críticos/muerte pendientes.
- **R-M:** [`docs/REGLAS_MODO_MOON_SYSTEM.md`](./REGLAS_MODO_MOON_SYSTEM.md): identificador `moon-system`; Power, Coin Power y choques en investigación, pero **ninguna fórmula aprobada** (`2); no reutilizar FHSkills, DnD ni Legacy; manifiesto `planned` (§5, §7). [Propuesta investigativa](./MOON_SYSTEM_ESPECIFICACION_COMBATE_PROPUESTA.md) **no modifica la autoridad** del Director.

**Cuatro etiquetas de esta matriz, que no son sinónimos:**

- **APROBADA:** orden/contrato expreso del Director. No presupone implementación.
- **IMPLEMENTADA Y PROBADA:** comportamiento real con prueba funcional ejecutada y atribuible a una revisión concreta. En **esta** auditoría no se alcanzó ese nivel para ningún comportamiento nuevo; se identifican pruebas preexistentes y sus alcances, pero no se anuncian como reejecutadas.
- **PROTOTIPO:** código o fórmula de demostración real, sin aprobación como reglamento completo, incluso si posee tests automatizados escritos.
- **PENDIENTE:** requiere decisión, implementación, prueba o alguna combinación de ellas; una propuesta documentada no cambia este estado.

Se informa también el **veredicto de correspondencia** (`conforme`, `no conforme`, `no verificable`) sin confundirlo con las cuatro etiquetas normativas.

## 2. Matriz de documento → decisión → fórmula/código → prueba → veredicto

Enlaces de código se refieren a `main` auditado. Números de línea del archivo existente en esta revisión; una línea puede desplazarse con próximos commits.

| ID | Regla rectora / decisión | Fórmula o implementación real | Evidencia de prueba existente | Etiqueta / veredicto |
| --- | --- | --- | --- | --- |
| L-01 | R-L `2: habilidades exclusivas Blakpine; **no** resolutor Moon | `juego/assets/fh-skills.js` L46–81: `heads% = clamp(100 + 5*points - penalty*difficulty - 10*disadvantage - sanityPenaltyPct,0,100)`; `coins=max(1,1+advantage-disadvantage)`; `P(success)=1-(1-p)^coins`; éxito si alguna cara | `juego/assets/fh-skills.test.js`: odds, cara/cruz, extremos y SP; **no son pruebas Moon** | **PROTOTIPO** de balance Legacy (constante 10 ajustable), propietario correcto; **conforme** con no reutilización |
| L-02 | R-L `2: daños/recursos de Sombras exclusivamente Blakpine | `juego/assets/fh-shadow-ai.js` L260–269: `damage=1d4 + (boost?1d4:0)`, `peSpent=boost?1:0`; L358–359: ataque por detección de movimiento/contacto y cooldown | `juego/assets/fh-shadow-ai.test.js`: pruebas de PG/PS, dos dados, PE de criatura, puertas, contacto; `tests/legacy-real-engine.test.cjs`: ciclo coordinado | **APROBADA** exclusividad y conservación de mecánicas existentes; pruebas codificadas, **no reejecutadas** |
| L-03 | R-L `4: única aplicación de daño sin duplicación de evento | `fh-session-coordinator.js` L44–135 → `fh-legacy-combat-bridge.js` L67–99, L111–113: puerto y propietario Legacy; `evaluate()` puro rechaza, no calcula DnD/Moon | `tests/legacy-combat-bridge.test.cjs`, `tests/legacy-combat-integration.test.cjs`, `tests/legacy-real-engine.test.cjs` | **APROBADA** como contrato; implementado con pruebas existentes, ejecución actual **no verificada** |
| D-01 | R-D `2: D20 y modificador contra defensa, **prototipo**, edición sin elegir | `juego/rules/dnd/fh-dnd-combat.js` L9–12 y L64–75: `total=roll+attackBonus`; `hit=total>=defense`, dados de ataque 20 por defecto | `tests/dnd-combat.test.cjs` L18–48 | **PROTOTIPO** descrito fielmente; **conforme solo al prototipo**, no certifica 5e |
| D-02 | R-D `2: D4, resistencia configurable, no trasladar daño Legacy | `fh-dnd-combat.js` L69–75: `damage=hit?min(target.hp,max(0,damageDieRoll+damageBonus-target.resistance)):0` | `tests/dnd-combat.test.cjs` L18–31 | **PROTOTIPO**; fuente de esta fórmula es **decisión de demo R-D**, **NO** D&D 5e. No presentarla como resistencia de edición aprobada |
| D-03 | R-D `2/`4: ataque básico sin energía ni espera de minuto | `fh-dnd-combat.js` L10–12, L68–75: `cost:0`; `fh-dnd-engine.js` L73–94 no bloquea por minuto/energía; campos `energy`/`maxEnergy`/`energyCost` y `lastPlayerMinute` aún validados por compatibilidad v1 | `tests/dnd-combat.test.cjs` L33–48 y L108–145 | **APROBADA** la prohibición; parte ejecutada en **PROTOTIPO**; **conforme** para coste del ataque, no para turnos |
| D-04 | R-D `1/`4/`8: **Sombras nunca son unidades DnD** | **INCUMPLIMIENTO:** `fh-multimode-save-hook.js` L50–61 pasa `shadowRuntime:fhHorror`; `fh-dnd-engine.js` L13–17, L31–45, L61, L68–86, L115 consume, combate y elimina Sombras de Blakpine | `tests/dnd-combat.test.cjs` L108–145 **exige** que DnD derrote Sombras: test verde **validaría un comportamiento prohibido** | **APROBADA / NO CONFORME**, fallo funcional **ALTO**; no adoptar Shadow como bestiario temporal |
| D-05 | R-D `2/`4: turnos/acciones propios y sin cooldown Legacy | `fh-dnd-engine.js` L73–94 permite repetir `playerAttack()` por nuevas `actionId` mientras tenga contacto; las Sombras atacan si el jugador se mueve y cumple `attackCooldown:9` del `fh-shadow-ai.js` L16 y L358–359 | Tests DnD cubren ataques consecutivos, **no** economía de turnos; tests Sombras comprueban cooldown Legacy | **PENDIENTE** economía DnD; uso efectivo de IA Legacy **NO CONFORME** por D-04 |
| D-06 | R-D `2: crítico, 1/20 naturales, ventaja/desventaja, atributos, muerte no aprobados | `fh-dnd-combat.js` L66–75: solo comparación de sumas; `fh-dnd-engine.js` L55–61: llegar a HP 0 y retirar criatura, sin reglas de muerte ni muerte instantánea; no fichas de edición | `tests/dnd-combat.test.cjs` solo fórmula de demo | **PENDIENTE**, **no** implementar 2014 ni 2024 unilateralmente; manifest `implemented` **solo** significa adaptador |
| D-07 | R-D `4: DnD usa capacidades físicas comunes, no IA/catálogo Legacy | `fh-shadow-ai.js` L251–259 define `contactClear` por muestras `walkable` del mismo runtime; `fh-dnd-engine.js` L79–86 consulta `shadowRuntime.canPlayerAttack`, L115 hace `shadowRuntime.tick` | Tests de contacto validan Shadow, **no** un puerto físico universal DnD sin Sombras | **APROBADA / NO CONFORME** la frontera de contenido; no se observó **nuevo** motor de colisión, pero no hay desacople universal |
| D-08 | R-D `1/`3: perfil medieval por defecto; ejemplos cruzados NO aprobados | `juego/assets/fh-multimode-selector.js` L62–65 valida solamente mapa disponible + adaptador; L97–99 registra DnD; el arranque DnD usa mapa moderno | `tests/multimode-selector.test.cjs` L31–37 registra **solo Legacy** en su fixture, L77–89 espera «solo moderno/Legacy»: **no prueba** el registro DnD del editor real | **APROBADA / NO CONFORME**, fallo de filtrado de combinación **MEDIO**; tarea separada de perfil/selector |
| D-09 | R-D `2/`4: estadísticas DnD privadas, no leer PG/PS/PE Legacy | `fh-dnd-combat.js` L17–45 crea `dnd.player.hp` / `dnd.actors`; `fh-dnd-save-adapter.js` L13–40 excluye claves Legacy de nivel superior y persiste `rules.data=dnd`; no usa `FHSkills` ni `FHSurvival` para resolver ataque | `tests/dnd-combat.test.cjs` L69–106 y `tests/multimode-save-isolation.test.cjs` | **APROBADA / CONFORMIDAD PARCIAL**: separación de combate DnD evidenciada; aislamiento **total** de estado no demostrado |
| D-10 | R-D `1/`4/`8: **tampoco** persistir simulación de Sombras como catálogo DnD | El motor ensamblado siempre crea `fhHorror` con `state:GameState.horror` (fuente `index.html`, ensamblador de Sombras); `fh-dnd-save-adapter.js` L13–26 excluye `character/stats/skills/resources`, pero **no excluye `horror`** de `world.runtime`. El DnD importado arranca con estado de spawn Legacy | No existe aserción de «sin `horror` de Legacy en guardado DnD»; pruebas de aislamiento usan claves fixture separadas | **APROBADA / NO CONFORME** para contenido privado; preservar mundo físico común pero separar datos de las entidades |
| M-01 | R-M `2: Power, Coin Power, choque, daño y recursos sin fórmula aprobada | No hay `juego/rules/moon-system/`; `contratos/multimodo/ejemplos/reglas/moon-system.json` L7 `status: planned`; `fh-multimode-selector.js` L87–100 **no** registra Moon | `docs/MOON_SYSTEM_ESPECIFICACION_COMBATE_PROPUESTA.md` tiene ejemplos/25 **tests diseñados, no ejecutados** | **PENDIENTE / CONFORME** con no habilitar ni inventar resolución |
| M-02 | R-M `1/`2: prohibidos FHSkills, D20 y stats Legacy como resolver Moon | `FHSkills.roll` vive en `juego/assets/fh-skills.js` L66–83 y calcula éxitos por porcentaje; no existe módulo Moon que lo invoque; `bindDndCombat` solo acepta `rulesetId:dnd` en `fh-session-coordinator.js` L142–168 | Ninguna suite de combate Moon funcional; `fh-skills.test.js` pertenece solo a Legacy | **APROBADA** la separación; ausencia de infracción **en ejecución actual** porque Moon aún no existe; cobertura futura **PENDIENTE** |
| M-03 | R-M `4: guardar Moon privado, sin habilitarlo | `fh-multimode-save-identity.js` L12, L55–73 reserva claves con `rulesetId` y version 1; **no** hay `moon-save-adapter` real; `fh-multimode-persistence.js` L21–36 exige adaptador implementado | `tests/multimode-save-isolation.test.cjs` usa `fixtureCoins` **ficticio**, no captura/restaura combate Moon | **PENDIENTE / CONFORME** como contrato futuro; jamás etiquetar «persistencia Moon probada» |
| U-01 | R-L `3–4, R-D `3–4, R-M `3–4: una autoridad física para todos | El motor 3D contiene callbacks de `canWalk`/rutas/visibilidad; `fh-shadow-ai.js` y el puente DnD actual reutilizan callbacks del mismo motor, **pero a través de la IA Sombras**; Moon no tiene runtime | `fh-shadow-ai.test.js` y `legacy-real-engine.test.cjs` prueban recorridos Legacy; sin prueba de tres modos funcionando sobre puertos universales | **APROBADA / VERIFICACIÓN PARCIAL**; no se encontró segundo motor físico en adaptadores revisados; **no se puede certificar** tres modos cuando Moon no existe |
| U-02 | R-D `2, R-M `5: estado de implementación no equivale a juego acabado | Manifiesto `dnd.json` L7 = `implemented`, `moon-system.json` L7 = `planned` y `legacy.json` L7 = `planned` (Legacy sí es nativo); el registry valida adaptador **no cobertura reglamentaria** | Tests estructurales y de adaptador no cubren completitud de edición ni mundo Moon | **PROTOTIPO** DnD, **PENDIENTE** Moon; no anunciar los tres jugables |

### Fuentes externas para **contrastar**, no para autorizar reglas

- **E-D14** [D&D Basic Rules 2014, Combat](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/combat): ataque contra AC, 1/20 naturales, daño crítico y resistencias por tipo. Demuestra que `damageRoll + bonus - resistance` del prototipo **no** es una representación completa de esa edición; el Director **todavía no ha elegido 2014**.
- **E-D24** [D&D 2024, Playing the Game](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game): 1/20 naturales, estructura de acciones y modificaciones de la edición; **no** autoriza implementarlas.
- **E-M1** [Limbus Company Wiki, Battles](https://limbuscompany.wiki.gg/wiki/Battles), **E-M2** [Skills](https://limbuscompany.wiki.gg/wiki/Skills), **E-M3** [Damage Formula](https://limbuscompany.wiki.gg/wiki/Damage_Formula): monedas, choques, ataques posteriores, defensas, resistencias y modificadores de daño. **Observación del juego de origen, NO reglamento Moon aprobado**.
- **E-M4** [Limbus Company Wiki, Sanity](https://limbuscompany.wiki.gg/wiki/Sanity): probabilidad de cara dependiente del recurso; **no** sustituir con porcentaje de `FHSkills`.
- Fórmulas investigativas `Power=Base+Σ(head*CoinPower)`, `P(head)=(50+SP)/100` y daño/multiplicadores del documento de propuesta Moon siguen **PENDIENTES**. Ninguna de esas fórmulas existe implementada en el adaptador (ausente).

## 3. Hallazgos accionables, alcance y prueba de corrección

### H1 — CRÍTICO: DnD ejecuta criaturas exclusivas de Legacy

- **Responsable funcional futuro:** integración DnD / adaptador de unidades, **no** reglas de Sombras Legacy.
- **Archivos:** `fh-multimode-save-hook.js` L50–61, `fh-dnd-engine.js` L13–45, L61, L68–86, L115, y `fh-shadow-ai.js` L272–315, L358–379.
- **Fallo:** el reglamento DnD no reutiliza únicamente contacto/ruta, **reutiliza un NPC enemigo completo con su GOAP, spawns, PE de fase y cooldown**. Distintos valores `hp:8` o defensa 10 en DnD no lo convierten en criatura DnD autorizada.
- **Corrección exigible:** separar entidad/catalogo/spawn de Sombras y DnD. DnD toma lecturas **solo** de puerto físico universal; si no hay catálogo DnD autorizado, **no** fabrica NPC. Legacy conserva comportamiento original.
- **Pruebas de aceptación:** (a) activar DnD con `horror` configurado → **0 Sombras activas**, (b) no se crea actor DnD para IDs `fh-shadow-*`, (c) modo Legacy aún presenta las dos Sombras y daños 1d4/boost según configuración, (d) DnD sin catálogo rechaza ataque con motivo explícito, (e) no se crean nuevos raycasts/pathfinding.

### H2 — ALTO: guardado DnD separa combate pero puede retener mundo Legacy `horror`

- **Responsable:** futura corrección de persistencia/routing de entidades DnD, **no** convertir `horror` a datos Moon/DnD.
- **Archivos:** `fh-dnd-save-adapter.js` L13–26, L37–40; ensamblador `index.html` estado `GameState.horror` y `FHShadowAI.createRuntime`.
- **Fallo demostrado estructuralmente:** `worldRuntime` filtra claves Legacy conocidas de nivel superior, pero deja pasar cualquier otra incluyendo `horror`. Ese estado controla apariciones de Sombras: guardar datos bajo `world.runtime` no los convierte en datos neutros.
- **Corrección:** definir lista positiva/versionada de estado **físico universal**; almacenar datos del catálogo de cada modo en `ruleset` propio. Compatibilidad de saves v1 y migración decidida antes de cambiar esquema.
- **Pruebas:** `capture({dnd:validDnd,horror:{...},clock:{...}})` no incorpora simulación de Sombras en guardado nuevo DnD, sí conserva reloj/mundo autorizados; leer v1 sin pérdida silenciosa; saves Legacy intactos.

### H3 — MEDIO: selector habilita combinaciones por disponibilidad técnica, no autorización de catálogo

- **Responsable:** selector/perfiles/mundo, independiente del futuro controlador DnD.
- **Código:** `fh-multimode-selector.js` L62–65, L97–99 permite seleccionar DnD sobre mapa moderno si hay adaptador/escenario disponible. El documento R-D `5 advierte que esta demo no es un mundo DnD autorizado.
- **Corrección:** contrato de compatibilidad explícita reglamento × perfil × catálogo de unidades; no asumir que «mapa disponible» significa «ambientación aprobada». No inventar perfil medieval jugable ni aplicar excepción Eberron automáticamente.
- **Pruebas:** DnD+moderno rechazado por defecto; Moon+moderno rechazado; DnD+perfil aprobado pero sin catálogo/escenario no inicia; Legacy+moderno conserva arranque.

### H4 — ALTO PARA ASEGURAMIENTO: dos pruebas actuales sostienen conclusiones equivocadas

- **`tests/dnd-combat.test.cjs` L108–145:** prueba **positiva** del combate DnD con Sombras que **ahora está prohibido**. Sustituir al corregir H1 por prueba **negativa** de exclusividad, no borrarla sin cobertura.
- **`tests/multimode-selector.test.cjs` L31–37, L77–89:** fixture registra solo Legacy; expectativa «solo moderno/Legacy» **no cubre** `mount()` real que registra DnD. Añadir montaje real y matriz de compatibilidad en pruebas separadas.
- **`tests/multimode-save-isolation.test.cjs` L8–40:** los guardados con `fixtureCoins` simulan identidad Moon, **no** el reglamento ni un guardado Moon real. Renombrar/describir su ámbito para impedir que se cite como prueba de Moon implementado.
- **Criterio:** un test que consolida contenido prohibido **no es aprobado** por estar verde. Los tests ajenos a H1/H3 siguen siendo evidencia válida en su propio alcance; **no bloquear PR ajenos**.

### H5 — PENDIENTE sin infracción: edición DnD y combate Moon

- **DnD:** aún no existe controlador de iniciativa/turnos, críticos de edición, atributos completos ni muerte reglamentaria. `fh-dnd-combat.js` L69–75 usa fórmula de demo **expresamente clasificada PROTOTIPO en R-D**; **no** sustituir por reglas 2014/2024 hasta decisión escrita.
- **Moon:** `status=planned`, sin resolutor ni selectores habilitados. Mantener así hasta aprobación del Director de Power/Coin Power, secuencia/choques, daño, recursos, turnos y catálogo Moon. Las **25 pruebas de la especificación son diseños** pendientes de ejecutar contra código futuro.
- **Legacy:** `FHSkills` utiliza monedas porcentuales propias; su fórmula de balance (dificultad por puntos 10, modificadores) está en código y pruebas, pero el documento rector no la consagra como **fórmula general** para todos los sistemas. No introducirla como regla Moon/DnD ni alterar ese sistema en esta auditoría.

## 4. Pruebas auditadas y límites reales

| Suite / evidencia | Qué acredita por diseño | Qué NO acredita |
| --- | --- | --- |
| `juego/assets/fh-skills.test.js` | Odds y tiradas Legacy en ejemplos controlados | Moon, DnD ni fórmula universal aprobada |
| `juego/assets/fh-shadow-ai.test.js` | Comportamiento de Sombras Legacy, contacto, daño, PE y cooldown | Licencia para crear Sombras en DnD |
| `tests/legacy-real-engine.test.cjs` | Integración del motor ensamblado y único daño Legacy bajo fixtures Node/VM | Partida gráfica ni turnos DnD |
| `tests/dnd-combat.test.cjs` | D20/D4 de demo, costes 0, coordenación, persistencia, **acoplamiento prohibido a Sombras** | DnD de edición completa o catálogo autorizado |
| `tests/multimode-save-isolation.test.cjs` | Identidad de guardado por `rulesetId` y rechazo cruzado de **fixtures** | Guardado Moon real o exclusión semántica de `horror` |
| `tests/multimode-save-engine-hook.test.cjs` | Inserción del hook y simulación de transporte/guardado | Aislamiento de criaturas ni WebGL |
| `tests/multimode-selector.test.cjs` | Contratos y selección con registro **solo Legacy** del fixture | Compatibilidad completa del montaje DnD real |
| `docs/MOON_SYSTEM_ESPECIFICACION_COMBATE_PROPUESTA.md` | Investigación y casos de aceptación **diseñados** | Implementación ni tests ejecutados Moon |

**Validación efectuada en esta auditoría:** lectura y comparación textual de fuentes **en `main`**, localización de funciones, fórmulas, dependencias e instrucciones de prueba, verificación de manifiestos, selector y ausencia de módulo Moon. **No se efectuó** ejecución independiente de Node, pruebas WebGL, pruebas físicas de tres modos, pruebas automatizadas de migración ni cálculo de cobertura cuantitativa.

## 5. Criterio de cierre y no bloqueo de PR ajenos

**No se autoriza** actualizar `dnd.status` o `moon-system.status` como sustituto de corregir código. `dnd.status=implemented` nombra un **adaptador funcional de prototipo**, no reglamento completo; considerar un estado/capability más fino en una entrega de metadatos aprobada, respetando consumidores existentes.

No crear workflows ni esperar checks verdes. Este informe es **auditoría de trazabilidad**: sus H1–H4 deben corregirse en los entregables propietarios, con pruebas focalizadas, y publicarse a `main` cuando cada corrección esté comprobada. **No** exigir que un PR ajeno (p. ej. una reparación de UI independiente) corrija también H1–H4.

### Condiciones mínimas para levantar hallazgos

1. **H1:** ruta DnD jamás instancia ni ataca Sombras; prueba negativa y regresión Legacy pasan **ejecutadas**.
2. **H2:** `world.runtime` de DnD no incorpora datos de criaturas Legacy; compatibilidad v1/guardados resuelta con pruebas reales.
3. **H3:** selector comprueba combinación autorizada y perfil/catálogo, no solo disponibilidad de mapa.
4. **H4:** suites ya no califican como éxito un comportamiento prohibido y cubren montaje/guardado real correspondientes.
5. **DnD/Moon:** no anunciar reglamentos completos hasta aprobación de edición/fórmulas/estados, implementación y ejecución comprobada de pruebas.

**Dictamen final:** **APROBADA** la separación de reglamentos y contenido como arquitectura objetivo; **PROTOTIPO** la fórmula de combate DnD y odds Legacy en lo no autorizado como regla universal; **PENDIENTE** la implementación Moon y la edición DnD; **IMPLEMENTADA Y PROBADA** no se concede a funciones nuevas por simple existencia de tests sin correrlos. **No conforme** la ruta actual de enemigos DnD y la persistencia del estado de Sombras; **no verificado** el uso de una única autoridad física por **tres modos operativos** (Moon no existe).


## 6. Rectificación de alcance: Training Dummy de pruebas — PR #217

**Referencia actualizada:** [PR #217: `feat(units): Training Dummy inmóvil e indestructible (1/1 PG)`](https://github.com/sokcrow/Blakpine-Wood/pull/217), **FUSIONADO en `main`** mediante squash `832bcd676edfa73f7b09cfefeff638b2044f1581`. La auditoría original se hizo sobre un `main` anterior al merge; el módulo, el editor y las pruebas del Dummy **ahora están en `main`**. Esto no significa que sus ataques estén conectados al coordinador ni que DnD/Moon estén completos.

**Clasificación:** **PROTOTIPO INTEGRADO EN `main`** de objetivo/unidad de entrenamiento. El concepto de **blanco de pruebas universal** es distinto de importar bestiarios o IA hostiles: no debe interpretar la regla de exclusividad de Sombras como prohibición de un objeto de entrenamiento común. La **aprobación precisa** de su integración al ataque de cada modo, las estadísticas especiales y su comportamiento de guardado deben quedar trazados; un PR fusionado tampoco prueba el cumplimiento de esas condiciones.

### Matriz complementaria de trazabilidad

| ID | Fuente / comportamiento declarado | Implementación de PR #217 en `main` | Test existente en `main` (no reejecutado aquí) | Estado y dictamen |
| --- | --- | --- | --- | --- |
| TD-01 | Blanco de práctica, sin IA de ataque, 1/1 vida, MOV 0 e indestructible; descripción del PR y `juego/units/README.md` | `juego/units/fh-training-dummy.js` L10–40: `HP=1`, `movement:0`, `indestructible:true`, `receiveHit` impone `hp:1` / `damageApplied:0` / `defeated:false` / `reward:false` | `tests/training-dummy.test.cjs` casos de invariantes y 1000 impactos repetidos | **PROTOTIPO** con tests escritos; pruebas no reejecutadas aquí; comportamiento real de combate pendiente |
| TD-02 | Disponible como objeto en editor y prueba 3D, compatible con mapa v1 según PR | `index.html` añade `training_dummy` como punto de mapa, herramienta `Áreas`, script y parche del motor; `createRuntime` instancia una marca Three.js y expone `get/list/receiveHit` | Test de posición, pisos, inyección de ancla y recepción directa | **PROTOTIPO**; sin verificación WebGL ni sprite definitivo; el asset de Imgur consta como pendiente en PR |
| TD-03 | Cada modo debe lanzar y resolver su ataque propio; ni Sombras ni FHSkills reciclados | **No conectado:** `FHTrainingDummyRuntime.receiveHit` no aparece como destino en los adaptadores de ataque; DnD aún selecciona actores de `FHShadowAI` | Test llama `receiveHit` directamente: **no** simula ataque por coordinador real ni golpe desde HUD | **PENDIENTE**; prohibido declarar que se puede atacar al Dummy desde el gameplay |
| TD-04 | Separación semántica de estadísticas y recursos por reglamento (R-L, R-D, R-M) | `stats(rulesetId,custom)` L12–23 copia `{...custom}` y luego fija `PG/PGMax/MOV` para Legacy o `hp/maxHp/speed` para DnD/Moon. **Riesgo concreto:** en DnD una entrada `{PG:999,MOV:25}` persiste como claves Legacy adicionales, aunque `hp=1, speed=0`; y el esquema de fichas Moon todavía no está aprobado | El test de invariantes aporta `{hp:999,PG:999,speed:25,MOV:25}` a **todos** los modos pero solo verifica los tres campos propios, **no** ausencia de claves cruzadas | **PROTOTIPO / AISLAMIENTO NO DEMOSTRADO**. Corregir en una entrega funcional del módulo ya fusionado, con validación de atributos por modo y tests de exclusión, sin inventar esquema Moon |
| TD-05 | Datos persistentes del Dummy y contador de impactos no deben mutar guardados de otro modo | `createRuntime` L54–85 mantiene las unidades en un `Map` privado; la documentación del PR no declara adaptador de persistencia ni reconexión al guardado multimodo | No hay prueba de serializar/restaurar `hitsReceived` tras recarga ni de su ausencia de contaminación cruzada | **PENDIENTE** la política de persistencia: decidir si el Dummy es efímero de pruebas o se guarda, sin cambiar esquema sin autorización |

### Consecuencia para hallazgos H1–H4

1. **H1 permanece:** el Dummy NO justifica reutilizar Sombras como adversarios de DnD. Una unidad de prueba neutral puede tener representación física común, pero su resultado de impacto debe provenir del adaptador autorizado **Legacy, DnD o Moon**, no de la IA Shadow.
2. **H2 permanece:** el Dummy no resuelve la fuga semántica de `GameState.horror` al estado global DnD. Su propio contador y catálogo requieren política de persistencia independiente si se decide guardarlos.
3. **H3 permanece:** colocar `training_dummy` como ítem de mundo y admitir `rulesetId:'moon-system'` en `create()` **no habilita Moon**, ni concede autorización de combinaciones de mundos y reglamentos.
4. **H4 se amplía:** las pruebas de `receiveHit` son útiles para un blanco de pruebas, **pero no comprueban** que las reglas de impacto, choque, daño o turnos funcionen desde las rutas reales del jugador. Añadir pruebas de conexión y de no mezcla de estadísticas por modo.

**Acción de entrega:** mantener TD-01 a TD-05 como comprobaciones para la próxima corrección funcional del módulo integrado por **PR #217**. No fusionar decisiones de edición DnD ni fórmulas Moon no aprobadas; no exigir que otro PR sin relación resuelva esos pendientes. Esta sección es una **ampliación documental** de la auditoría IA 6, no una implementación de los ataques al Dummy.

## 7. Aclaración vinculante del Director — Dummy en blanco, NO Sombras como fixture (18-11-2026)

**APROBADA (decisión del Director):** el **Training Dummy** es el **blanco neutro de pruebas para iniciar la integración** de los distintos modos; no hace falta asignarle las Sombras ni tomar sus mecánicas. Las Sombras son enemigas exclusivas de Blakpine Wood y **por ahora no funcionan como contenido integrable DnD/Moon**: no convertirles habilidades, estadísticas, daño, GOAP, recursos ni comportamiento. Esto **no** exige que el Dummy sea un NPC ni implica una ficha de combate completa para cada modo.

**Lectura correcta de [PR #217](https://github.com/sokcrow/Blakpine-Wood/pull/217):** su interfaz `receiveHit`, inmovilidad y resistencia a destrucción conforman un **prototipo de instrumento de test**, no un adversario. Los campos `hp:1`, `maxHp:1` y `speed:0` propuestos describen invariantes técnicas del Dummy y **no** aprueban los atributos, categorías o reglas de las fichas de DnD/Moon. La copia de `customStats` sin filtrar sigue siendo riesgo de contaminación de namespaces (TD-04). No usar el Dummy como prueba de daño real hasta que exista enlace de ataque por coordinador, validado y ejecutado.

**Matriz de aceptación para próximas entregas:**

| Caso | Aceptación | Estado |
| --- | --- | --- |
| TDB-01 · DnD sin Sombras | DnD alcanza a un Training Dummy autorizado usando solo posición/contacto comunes. Cero actores `FHShadowAI` / GOAP Legacy en el encuentro. | **APROBADA** la frontera; **PENDIENTE** implementación y test |
| TDB-02 · Resultado DnD | `fh-dnd-combat` o sustituto autorizado produce una propuesta de ataque; el Dummy registra acierto/fallo y daño **reportado**, sin resolverlo por su cuenta ni heredar PE Legacy. | **PROTOTIPO** fórmula DnD; **PENDIENTE** enlace y test |
| TDB-03 · Moon sin préstamos | Monedas/choques/Power **aprobados por el Director** alimentan la propuesta al Dummy; nunca se llama `FHSkills.roll`, `bindDndCombat` ni Shadow. | **PENDIENTE** fórmulas Moon/implementación |
| TDB-04 · Aislamiento | Stats, identificadores, eventos y persistencia de la prueba no trasladan enemigos ni recursos de otro modo. | **APROBADA** frontera; **PENDIENTE** pruebas reales |
| TDB-05 · Una aplicación | Repetir `actionId`, muerte/interrupción de escena o cambios de sesión no registran doble golpe ni doble coste. | **APROBADA** coordinación; **PENDIENTE** test Dummy |
| TDB-06 · Legacy sin regresiones | Sombras conservan en **Legacy** su ataque/drain/GOAP; pruebas de Dummy no alteran las suites de Sombras. | **APROBADA** exclusividad; **PENDIENTE** regresión ejecutada |

**Impacto sobre el informe:** H1 sigue siendo un **incumplimiento del runtime DnD**, pero la salida permitida para validar el adaptador **antes de contar con un bestiario autorizado** es el **Dummy de pruebas**, no fabricar monstruos ni trasladar Sombras. El PR #217 ya quedó fusionado; la conexión futura de adaptadores pertenece a sus entregas responsables. Este cambio documenta la orden sin tocar lógica de combate, habilitación Moon, selector o persistencia.
