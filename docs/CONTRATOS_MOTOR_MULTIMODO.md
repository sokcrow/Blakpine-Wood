# Contratos del motor central multimodo — v1

**Estado:** especificación de fronteras y ejemplos de datos. No es un motor multimodo implementado.  
**Alcance:** lectura y selección de perfiles, manifiestos e interfaces; sin geometría, físicas, navegación nueva ni resolución de combate.

## 1. Decisión arquitectónica

El mapa define **dónde están las cosas**; el perfil de mundo define **qué ambientación y perfiles de infraestructura utilizar**; el manifiesto de reglas identifica **qué sistema de combate seleccionar** y, cuando exista una integración real, el adaptador que lo ejecutará. La selección vincula ambos por **rutas de archivos independientes**, no modifica el mapa.

```text
forest-horror-map-v1 ──> Motor 3D compartido <── Perfil de mundo v1
                                │
                 colisión / visibilidad / navegación
                                │ (consulta de estado, solo lectura)
                     Adaptador de combate v1
                                ▲
                      Manifiesto de reglas v1
                                ▲
             Selección v1: mundo + reglas (archivo aparte)
```

Un perfil de mundo **no contiene** una lista de reglamentos permitidos. Un reglamento **no contiene** una lista de mundos compatibles. Por diseño, **cada uno de los 3 perfiles puede vincularse a cualquiera de los 3 manifiestos** (9 combinaciones estructurales), sin que los mapas hereden mecánicas de combate.

## 2. Contratos JSON y ubicaciones

| Documento | Identificador `kind` | Archivo de esquema |
| --- | --- | --- |
| Perfil de mundo | `blakpine-world-profile-v1` | `contratos/multimodo/v1/perfil-mundo.schema.json` |
| Manifiesto de reglas | `blakpine-ruleset-manifest-v1` | `contratos/multimodo/v1/manifiesto-reglas.schema.json` |
| Selección | `blakpine-mode-selection-v1` | `contratos/multimodo/v1/seleccion-modo.schema.json` |

Todos incluyen `version: 1`. Son JSON ordinarios con JSON Schema Draft 2020-12 para validación independiente del navegador/juego. **No hay paquetes, CDN, transpilers ni dependencias de ejecución añadidos.**

**Fuente canónica y obligatoria para IA 3, IA 4 y las demás integraciones:** los tres esquemas situados en `contratos/multimodo/v1/` son la **única fuente de esquemas** de este contrato multimodo. No duplicar contratos ni crear interfaces incompatibles. Las rutas propuestas `juego/core/`, `juego/worlds/` y `juego/rules/` pueden organizar **implementaciones futuras**, pero **no** serán fuentes paralelas de esquemas, y deberán consumir los esquemas v1 de esta entrega. Los puertos del apartado 3 son semánticos, no una segunda API implementada.

Las rutas `path`, `worldProfile` y `rulesetManifest` son relativas a la **raíz del repositorio**, con barras `/`; no aceptan URL, rutas absolutas ni segmentos `..`. `extensions` es opcional y se reserva para extensiones versionadas por otro equipo; una extensión no cambia las obligaciones del núcleo v1.

### Perfil de mundo

Campos mínimos: `kind`, `version`, `id`, `label`, `environment.archetype` y `environment.layoutProfile`.

- `environment.layoutProfile`: **identificador declarativo** para un futuro intérprete de generación/construcción; no implica que hoy exista.
- `environment.infrastructureProfiles[]`: identificadores declarativos de servicios de mundo (por ejemplo, calles y drenajes). **No** son algoritmos, scripts ni promesas de conectividad.
- `environment.tags[]`: metadatos, sin efectos físicos automáticos.
- `map` (opcional): referencia a un JSON existente cuyo `schema` sea exactamente `forest-horror-map-v1`. Si se omite, el perfil es **definible/validable pero no cargable como escenario jugable**.
- `extensions` (opcional): metadatos propios sin autoridad sobre el motor.

Las ambientaciones de ejemplo son **ciudad moderna**, **distopía** y **villa/castillo medieval**. Solo la ciudad moderna referencia un mapa real verificado del repositorio. Las otras dos son perfiles de diseño **sin mapa asignado** y no deben anunciarse como mundos 3D funcionales.

### Manifiesto de reglas

Campos mínimos: `kind`, `version`, `id`, `label`, `domain: "combat"` y `status`.

- `adapter` (opcional): identidad simbólica de un futuro adaptador y contrato `blakpine-combat-adapter-v1`. **No es una ruta de importación ni implica código instalado.**
- `statsNamespace` (opcional): espacio de nombres privado del reglamento para evitar colisiones de estadísticas.
- `status`: `planned` significa **integración multimodo pendiente**; `implemented` solo debe declararse si existen código funcional y pruebas del adaptador. `reserved` sigue disponible en el esquema general para ampliaciones futuras, pero **ningún ejemplo oficial utiliza ese estado**.
- Los adaptadores simbólicos de DnD y Moon **no** son módulos ejecutables: ambos permanecen en `planned`.

**Los tres reglamentos oficiales son:**

| ID | Sistema | Estado de integración multimodo | Alcance |
| --- | --- | --- | --- |
| `legacy` | Legacy — Blakpine Wood actual | `planned` (sin `adapter`) | Preservar el combate existente, sin introducir una implementación duplicada |
| `dnd` | DnD — dados | `planned` | Futuro combate con dados; **no sustituye** las habilidades generales actuales |
| `moon-system` | Moon System — monedas | `planned` | Futuro combate con monedas, **independiente** de las tiradas de habilidades ya existentes |

**Importante:** Legacy es el comportamiento de juego que **ya existe** cuando se utiliza la ruta habitual sin configuración multimodo. Su manifiesto tiene `status: "planned"` porque **todavía no existe un adaptador Legacy conectado al coordinador de sesiones**. No declarar `adapter`, ni `implemented`, ni simular uno en el contrato. Si más adelante se conecta Legacy al selector, deberá **reutilizar** las funciones existentes; no reimplementarlas.

DnD y Moon no están implementados en esta entrega. No se alteran `FHCharacterCore`, `FHSkills` ni las tiradas de habilidades actuales; aunque el juego ya tenga tiradas con monedas para habilidades, eso **no** constituye la integración del combate Moon System.

### Selección de modo

Contiene únicamente `worldProfile` y `rulesetManifest`, ambos archivos JSON independientes. Es el único sitio donde se decide una combinación para una sesión. Cambiar de reglamento **no reescribe** el mapa o el perfil de mundo.

Ejemplos: `contratos/multimodo/ejemplos/selecciones/moderno-dnd.json`, `distopia-moon.json` y `medieval-legacy.json`. La selección es **opcional para el flujo heredado**: los perfiles de mundo no contienen ni requieren un campo de reglamento.

## 3. Fronteras del núcleo (contrato de integración futuro, no implementación)

| Responsable | Puede leer | Puede decidir o modificar | No debe hacer |
| --- | --- | --- | --- |
| Editor | Datos de `forest-horror-map-v1` | Exportación y configuración del mapa | Ejecutar fórmulas de combate o imponer un reglamento |
| Cargador de mundo | Perfil v1, mapa referenciado | Preparar la descripción de ambiente y delegar en el motor existente | Alterar el esquema del mapa |
| Núcleo 3D compartido | Mapa, posición/identidad de actores, estado físico | Geometría, posiciones, colisiones, visibilidad, ocupación, navegación y cambios espaciales autorizados | Implementar sistemas alternativos de combate o interpretar reglas particulares de DnD/Moon |
| Adaptador de reglas | Contexto **de solo lectura** ofrecido por el núcleo, acción propuesta, estado del reglamento | Proponer resultados de combate y cambios de estadísticas **en su espacio de nombres** | Editar geometría, atravesar colisiones, recalcular su propia visibilidad o mover actores sin permiso del núcleo |
| Coordinador de sesión | Selección v1 y manifiestos | Elegir adaptador y pedir al núcleo que valide/ejecute cambios permitidos | Convertir opciones de combate en requisitos del mapa |

### Superficie conceptual de integración `blakpine-combat-adapter-v1`

```text
CoreWorldPort (una sola fuente de verdad):
  getActorSnapshot(actorId)                 -> ActorSnapshot | null
  queryCollision(actorId, targetPosition)   -> CollisionResult
  queryVisibility(observerId, targetId)     -> VisibilityResult
  queryNavigation(actorId, destination)     -> NavigationResult

CombatAdapterPort (aislado del mundo físico):
  evaluate(intent, readonlyWorldSnapshot, rulesetState)
    -> CombatProposal

SessionCoordinatorPort:
  validateAndApply(proposal, coreWorldPort)  -> AppliedResult | RejectedResult
```

Estas son **firmas semánticas para integración futura**: no existen como módulos exportados en esta entrega. `readonlyWorldSnapshot` no incluye referencias mutables a Three.js ni al documento HTML. El adaptador solo propone cambios; **el núcleo valida desplazamiento, colisión, visibilidad y permisos** antes de aplicar efectos. Los resultados de las consultas tienen valor autorizado solo si proceden de la implementación común existente, no de una segunda simulación dentro del reglamento.

Los identificadores de actor y posiciones pertenecen al núcleo. La forma de resolver golpes, dados, monedas, turnos y daño pertenece exclusivamente al adaptador. La selección de reglas **no cambia** recorridos, paredes, puertas, alcance geométrico ni lectura de la topología del mapa. No se fija todavía ninguna unidad adicional: se respeta `units` del mapa legado, incluida `feetPerCell` donde exista.

### 3.1. Límite de eventos: intención → resolución → aplicación única → notificación

**Handoff obligatorio del inventario IA 1, PR #193 (§13.2–13.3).** En la ruta Legacy de Sombras, `FHShadowAI.attack` elige recurso (`pg` o `sp`) y daño con dados; el consumidor `addShadowEncountersToEngine` llama a `FHSurvivalRuntime.change('sp', -damage)` o `FHSurvivalRuntime.damagePG(damage)` y **después** emite `GameEvents.emit('combat:damage')` y guarda progreso. Por ello `combat:damage` es **una notificación posterior al daño ya aplicado**, nunca una entrada donde reemplazar, cancelar o volver a ejecutar la resolución.

**Contrato semántico para futuros adaptadores (ninguna función implementada todavía):**

```text
1. Intención      → identidad de atacante, objetivo, acción y reglamento; sin mutación
2. Resolución     → adaptador calcula propuesta, gasto y resultado; sin efectos físicos
3. Aplicación     → coordinador comprueba autorización/colisiones/permisos y
                    delega UNA SOLA VEZ al propietario correcto del recurso/estructura
4. Notificación   → evento posterior con resultado realmente aplicado; no aplica daño
```

No reutilizar `combat:damage` como paso 1, 2 ni 3. No suscribir un adaptador que repita daño al recibir la notificación. El punto previo a la aplicación debe diseñarse **fuera** de `index.html`, de los fragmentos Base64 y de los hooks existentes; esta entrega no lo inyecta. Las consultas de navegación `ForestShared.solidAt`, `canWalk`, `FHNPCGOAP.route` y las reglas de puertas/escaleras/visibilidad siguen bajo autoridad del núcleo. Las capacidades especiales de fase de las Sombras **no se convierten** en permisos universales de movimiento.

### 3.2. Propietarios del estado y prevención de daño duplicado

| Dominio | Ruta Legacy observada en PR #193 | Restricción del futuro contrato |
| --- | --- | --- |
| Recursos de personaje `PG/PS/PE` | `GameState.character.resources.pg/sp/pe` y `FHSurvivalRuntime`; `damagePG` comprueba estado crítico | El adaptador propone efectos; el propietario de recursos los aplica **una vez**. `PS` de interfaz corresponde a `sp` interna, no a una segunda reserva. |
| Miedo y pérdida de `PS` | `horror:stimulus` → `FHMoodFearRuntime.stimulus/promote`; `promote` puede modificar `sp` directamente | No aplicar la misma pérdida desde `horror:stimulus`, `onSanityLoss` **y** `combat:damage`. Distinguir estímulo, efecto efectivo y notificación. |
| Energía de Sombras | `FHShadowAI.actor.pe` se consume para potenciar ataques/fase | **PE de criatura** diferente de `GameState.character.resources.pe` del jugador; no mezclar costos ni inventarios. |
| Estructuras y puertas | `FHStructureHealth` gestiona `GameState.structures`, `structure:damage` y cambios de colisionadores al destruir | Daño estructural no es daño PG de actor. Solo su propietario puede decidir la destrucción/actualización física; el adaptador **nunca edita directamente** geometría o colisiones. |

El mismo evento o intención no debe desembocar en dos descuentos de recursos. El guardado posterior no es permiso para volver a aplicar efectos. `FHSkills.roll` es una tirada de habilidades Legacy, **no** el punto universal de resolución para DnD ni Moon.

### 3.3. Identidades separadas y guardados antes de habilitar adaptadores

**Restricción previa a implementar DnD o Moon** (PR #193, §13.2 y §13.4): distinguir cuatro identidades, **sin agregarlas al esquema de mapa**:

- **Mapa:** `forest-horror-map-v1` y su identidad actual; no mutar, reinterpretar ni añadir campos obligatorios al mapa.
- **Personaje:** identificador individual actual, independiente de la ambientación y de la selección de combate.
- **Reglamento:** `legacy`, `dnd` o `moon-system` con su versión de contrato; ni `GameState.stats` ni `character.scores/skills` son representaciones universales de los tres modos.
- **Guardado:** identidad y versión propias, vinculadas de forma inequívoca al mapa, personaje y reglamento, con política explícita de compatibilidad/migración antes de cualquier escritura.

**Claves Legacy protegidas:** `blakpine_character_active_v1` guarda un perfil Legacy (recursos y habilidades); `fh_game_v1_<hash>` se deriva de la identidad del mapa, **sin discriminar reglamento**. El guardado actual usa un sobre `{version:1,state}`, y sincroniza recursos/habilidades Legacy por personaje. **Nunca escribir un estado DnD/Moon en esas claves ni reutilizar sus sobres sin una política aprobada de aislamiento, validación de versiones y migración**. Un guardado DnD/Moon no debe sobrescribir ni ser interpretado como Legacy. Conservar lectura y escritura Legacy actuales cuando no existe configuración multimodo. Rechazar de forma segura reglas/versiones desconocidas antes de guardar; ninguna migración se implementa aquí.

La separación de estas identidades es un **requisito futuro**, no un sobre de guardado ya creado. Este PR no define claves nuevas, no migra perfiles existentes y no cambia `ForestShared.gameSaveKey`, `FHCharacterCore` ni `FHSkills`.

### 3.4. Relevo a otras IAs y restricciones de implementación

El inventario técnico de [PR #193](https://github.com/sokcrow/Blakpine-Wood/pull/193), sobre todo §13.2–13.6, es **fuente de auditoría** para IA 3/4. La matriz identifica riesgos de acoplamiento de `prepareGLBEngineDoc`, `start3DPreview`, `GameState`, navegación, visibilidad, servicios y almacenamiento. Ninguno de los puertos descritos aquí está instalado. Antes de integrar un nuevo modo, IA 3/4 deben revisar ese inventario, **consumir exclusivamente** los esquemas de `contratos/multimodo/v1/`, no crear copias en `juego/core/`, `juego/worlds/` ni `juego/rules/`, y demostrar la separación y aplicación única mediante pruebas específicas. No añadir parches textuales a las funciones existentes del motor ni reemplazar las tiradas generales de habilidades.

## 4. Compatibilidad y fallos

1. **Entrada heredada / Legacy por defecto:** si el juego abre un JSON `forest-horror-map-v1` sin perfil ni selección multimodo, debe seguir su ruta de carga anterior y su **comportamiento Legacy actual**, sin consultar el nuevo manifiesto, sin nuevos campos obligatorios, conversión ni cambio de comportamiento. El coordinador multimodo **no existe aún**; esta regla protege su integración futura y los archivos funcionales permanecen intactos.
2. **Sin cambios al mapa:** el perfil no se inserta en `forest-horror-map-v1`. `version` del contrato multimodo y `version` interno del mapa son cosas distintas.
3. **Referencias:** rechazar rutas inexistentes, fuera del repositorio, de formato distinto o JSON inválido antes de cargar una sesión. El esquema comprueba forma; el verificador estático resuelve rutas.
4. **Estado del reglamento:** los tres manifiestos oficiales usan `planned` para la integración multimodo; no equivale a combate inexistente en Legacy. No declarar `implemented` sin código de adaptador y pruebas. `reserved` solo está permitido por el esquema para futuras extensiones, no es un sistema activo.
5. **Fallo de adaptador:** no reemplazar silenciosamente otro reglamento, ni reescribir estadísticas guardadas, ni modificar la simulación para compensarlo.
6. **Persistencia:** no se define una migración de partidas ni se mezclan `PG`, `PS`/`SP`, `PE` o atributos propios entre reglamentos. Deben separarse identidades de mapa, personaje, reglamento y guardado conforme a §3.3 **antes** de implementar adaptadores DnD/Moon.
7. **Cambios futuros:** nuevas claves obligatorias o comportamiento incompatible requieren otro contrato versionado; no se modifica `forest-horror-map-v1` para resolverlos.

## 5. Validación independiente del juego

Desde la raíz del repositorio:

```sh
node contratos/multimodo/validar-contratos.mjs
```

El script utiliza solo Node.js estándar y comprueba los ejemplos contra el subconjunto de JSON Schema empleado aquí; además revisa nombres exactos de los tres reglamentos, que Legacy no anuncie adaptador, los estados pendientes de DnD y Moon, referencias de archivos, ausencia de ejemplos obsoletos, perfiles independientes de los reglamentos, formato de mapas existentes y las **9 combinaciones** posibles. No importa Three.js, no abre `index.html`, no ejecuta combate ni modifica archivos. Una herramienta externa que admita **JSON Schema Draft 2020-12** también puede validar los esquemas individualmente, pero **no es necesaria** para el comprobador incluido.

**Límites de la validación:** nueve combinaciones **estructurales** no significan nueve modos **jugables**. No se prueba la conexión de adaptadores, la ejecución del combate ni la presencia de mapas para todos los mundos. El comportamiento Legacy se **preserva por alcance** al no modificar archivos funcionales; **no está certificado mediante regresión ejecutada del motor**. El resultado de aserciones estáticas externas tampoco equivale a ejecutar este validador con Node en un checkout real.

## 6. Observaciones de repositorio verificadas al definir el contrato

- `juego/index.html` redirige a `../index.html`; no es un punto independiente de juego.
- `juego/assets/engine-00.js` a `engine-12.js` contienen fragmentos de motor; no se editan.
- Un ejemplo real, `forest-horror/maps/DEMO_Interacciones.json`, declara `schema: "forest-horror-map-v1"`.
- `juego/assets/fh-character-core.js` y `fh-skills.js` ya gestionan perfiles y tiradas propios. **No se reemplazan**: el combate DnD y Moon debe permanecer separado de esas habilidades, y no se infiere que sus adaptadores estén conectados al motor.
- La estructura actual se debe auditar antes de integrar puertos; este documento define **fronteras propuestas**, no funciones comprobadas con esos nombres.

**No tocado:** `index.html`, `juego/index.html`, `juego/assets/`, `forest-horror/maps/`, geometría, físicas, colisiones, visibilidad, navegación, combate y persistencia.
