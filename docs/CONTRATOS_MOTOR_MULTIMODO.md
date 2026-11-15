# Contratos del motor central multimodo — v1

**Estado:** especificación de fronteras y ejemplos de datos. No es un motor multimodo implementado.  
**Alcance:** lectura y selección de perfiles, manifiestos e interfaces; sin geometría, físicas, navegación nueva ni resolución de combate.

## 1. Decisión arquitectónica

El mapa define **dónde están las cosas**; el perfil de mundo define **qué ambientación y perfiles de infraestructura utilizar**; el manifiesto de reglas define **qué adaptador de combate seleccionar**. La selección vincula ambos por **rutas de archivos independientes**, no modifica el mapa.

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
- `status`: `planned` (diseñado, no confirmado como conectado), `implemented` (declaración pendiente de verificar con código/pruebas) o `reserved` (identidad provisional sin reglamento operativo).
- `reserved` no debe inicializar un combate; no afirmar compatibilidad ejecutable para un manifiesto reservado.

Se incluyen `dnd` y `moon-system` como **propuestas de adaptadores**, sin asignar tiradas, probabilidades ni resultados. El tercer sistema de combate **no fue especificado**: el manifiesto `tercer-sistema-pendiente` reserva el espacio sin inventar reglas.

### Selección de modo

Contiene únicamente `worldProfile` y `rulesetManifest`, ambos archivos JSON independientes. Es el único sitio donde se decide una combinación para una sesión. Cambiar de reglamento **no reescribe** el mapa o el perfil de mundo.

Ejemplo: `contratos/multimodo/ejemplos/selecciones/moderno-dnd.json`.

## 3. Fronteras del núcleo (contrato de integración futuro, no implementación)

| Responsable | Puede leer | Puede decidir o modificar | No debe hacer |
| --- | --- | --- | --- |
| Editor | Datos de `forest-horror-map-v1` | Exportación y configuración del mapa | Ejecutar fórmulas de combate o imponer un reglamento |
| Cargador de mundo | Perfil v1, mapa referenciado | Preparar la descripción de ambiente y delegar en el motor existente | Alterar el esquema del mapa |
| Núcleo 3D compartido | Mapa, posición/identidad de actores, estado físico | Colisiones, visibilidad, ocupación, navegación, cambios espaciales autorizados | Aplicar probabilidades, estadísticas o turnos exclusivos de DnD/Moon |
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

## 4. Compatibilidad y fallos

1. **Entrada heredada:** si el juego abre un JSON `forest-horror-map-v1` sin perfil ni selección, debe seguir su ruta de carga anterior, sin nuevos campos obligatorios, conversión ni cambio de comportamiento.
2. **Sin cambios al mapa:** el perfil no se inserta en `forest-horror-map-v1`. `version` del contrato multimodo y `version` interno del mapa son cosas distintas.
3. **Referencias:** rechazar rutas inexistentes, fuera del repositorio, de formato distinto o JSON inválido antes de cargar una sesión. El esquema comprueba forma; el verificador estático resuelve rutas.
4. **Estado del reglamento:** `reserved` no inicia; `planned` no se presume operativo; `implemented` debe respaldarse con una implementación real y pruebas.
5. **Fallo de adaptador:** no reemplazar silenciosamente otro reglamento, ni reescribir estadísticas guardadas, ni modificar la simulación para compensarlo.
6. **Persistencia:** no se define una migración de partidas ni se mezclan `PG`, `PS`/`SP`, `PE` o atributos propios entre reglamentos. Será un contrato separado cuando se concrete cada sistema.
7. **Cambios futuros:** nuevas claves obligatorias o comportamiento incompatible requieren otro contrato versionado; no se modifica `forest-horror-map-v1` para resolverlos.

## 5. Validación independiente del juego

Desde la raíz del repositorio:

```sh
node contratos/multimodo/validar-contratos.mjs
```

El script utiliza solo Node.js estándar y comprueba los ejemplos contra el subconjunto de JSON Schema empleado aquí; además revisa referencias de archivos, formato de mapas existentes y las **9 combinaciones** posibles. No importa Three.js, no abre `index.html`, no ejecuta combate ni modifica archivos. Una herramienta externa que admita **JSON Schema Draft 2020-12** también puede validar los esquemas individualmente, pero **no es necesaria** para el comprobador incluido.

**Límites de la validación:** la comprobación estructural no demuestra que existan intérpretes de ambientes, que un reglamento esté implementado, ni que todos los mundos tengan geometría jugable.

## 6. Observaciones de repositorio verificadas al definir el contrato

- `juego/index.html` redirige a `../index.html`; no es un punto independiente de juego.
- `juego/assets/engine-00.js` a `engine-12.js` contienen fragmentos de motor; no se editan.
- Un ejemplo real, `forest-horror/maps/DEMO_Interacciones.json`, declara `schema: "forest-horror-map-v1"`.
- `juego/assets/fh-character-core.js` y `fh-skills.js` ya gestionan perfiles y tiradas propios. **No se reemplazan** y no se infiere que DnD o Moon estén conectados al motor.
- La estructura actual se debe auditar antes de integrar puertos; este documento define **fronteras propuestas**, no funciones comprobadas con esos nombres.

**No tocado:** `index.html`, `juego/index.html`, `juego/assets/`, `forest-horror/maps/`, geometría, físicas, colisiones, visibilidad, navegación, combate y persistencia.
