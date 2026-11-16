# Cargador declarativo de perfiles de mundo

`fh-world-profile-loader.js` exporta `FHWorldProfileLoader` como script clásico o
`{ create, WorldProfileError }` por CommonJS. No depende del editor, Three.js,
DOM, almacenamiento ni de un sistema de combate.

## API y dependencias

`create({ readJson, validate })` devuelve `{ prepare }`, compatible con el puerto
`worldLoader.prepare(worldProfile)` del coordinador de IA 2. La entrada es un
objeto de perfil v1, normalmente obtenido del lector de selección; se revalida
para que el cargador también pueda usarse de manera independiente.

- `readJson(repoRelativePath) -> JSON | Promise<JSON>` lee y parsea archivos
  desde una raíz fija. Debe rechazar rutas inexistentes, JSON inválido y escapes
  de raíz por enlaces simbólicos/redirecciones. Entrega datos JSON ordinarios
  del contexto de ejecución, sin funciones, ciclos ni objetos del motor.
- `validate(data, schema) -> true | Promise<true>` comprueba todas las
  restricciones del esquema canónico Draft 2020-12. Cualquier otro retorno o
  excepción significa rechazo. Ambas funciones son dependencias de confianza;
  no se proporciona un callback que acepte todo ni se instala otra dependencia.

`prepare(worldProfile)` carga exclusivamente el esquema aprobado
`contratos/multimodo/v1/perfil-mundo.schema.json`, lo utiliza antes de leer la
referencia de mapa y devuelve una promesa de una descripción JSON inmutable:

| Campo | Contenido |
| --- | --- |
| `kind` | `world-profile-description` |
| `profile` | Copia completa del perfil validado: identidad, ambiente, referencia opcional y extensiones. |
| `capabilities` | Datos de `extensions["blakpine.world-capabilities.v1"]`: `architecture`, `paths`, `materials`, `services`; `null` si no se declararon. |
| `scenario.status` | `declarative-only` sin mapa; `map-available` cuando la referencia se pudo leer y comprobar. |
| `scenario.reference` | Referencia canónica `{schema, path}`, solo si existe mapa comprobado. |
| `scenario.data` | Copia completa del JSON de mapa leído, solo si existe mapa comprobado. |

Las extensiones desconocidas se conservan como datos en `profile`; no se ejecutan.
Las copias están profundamente congeladas y no retienen referencias mutables a
las entradas. No se crean geometría, edificios, caminos, materiales gráficos,
servicios operativos, estadísticas ni guardados.

## Mapas, unidades y límites

Las rutas son relativas a la raíz del repositorio y se validan con el esquema
canónico, sin copiar sus patrones. El lector inyectado resuelve la referencia;
el cargador exige que el documento leído sea un objeto JSON y que su `schema`
coincida con `forest-horror-map-v1`, ya exigido por el perfil aprobado.

`scenario.data` conserva **todos** los datos y unidades originales, incluidos
`feetPerCell`, `metersPerCell`, origen, elevaciones y versión interna. No convierte,
normaliza ni añade valores predeterminados; si no hay `units`, no las inventa.
La validación de contenido espacial del motor sigue perteneciendo a su flujo
existente: aquí se verifica la referencia, lectura JSON y etiqueta de formato,
no se certifican geometría, colisiones, navegación o jugabilidad del mapa.

| Perfil aprobado | Referencia actual | Resultado del cargador |
| --- | --- | --- |
| `ciudad-moderna` | `forest-horror/maps/DEMO_Interacciones.json` | `map-available`: mapa real de demostración, no una ciudad generada ni una sesión multimodo activa. |
| `distopia` | Sin `map` | `declarative-only`: configuración válida, sin escenario jugable asignado. |
| `villa-medieval` | Sin `map` | `declarative-only`: configuración válida, sin escenario jugable asignado. |

Un mapa declarado pero inexistente/ilegible/incorrecto produce error; nunca se
reinterpreta como perfil sin mapa ni se sustituye por otro escenario.

`WorldProfileError.code`: `WORLD_LOADER_DEPENDENCIES_MISSING`,
`PROFILE_DATA_INVALID`, `PROFILE_SCHEMA_READ_FAILED`, `PROFILE_INVALID`,
`WORLD_MAP_READ_FAILED`, `WORLD_MAP_SCHEMA_INVALID`. `.cause` conserva el fallo
original cuando corresponde. Son códigos para el consumidor, no textos de UI.

## Coordinación y pruebas

Se conserva la firma acordada con IA 2 en el PR #200, commit
`a2bd59938db64dad6608df22633b7a72c46a004c`, sin editar sus archivos. El cargador
puede describir un perfil sin mapa; el coordinador actual lo rechaza como sesión
mediante `WORLD_MAP_MISSING` antes de invocar el cargador. Los manifiestos siguen
`planned`, por lo que actualmente rechaza toda selección explícita por reglas no
implementadas. La prueba de integración usa un adaptador/manifiesto sintéticos
solo para verificar el paso de datos entre módulos reales.

`node --test tests/world-profile-loader.test.cjs` verifica perfiles oficiales,
mapa real, unidades, ausencia de mapa, referencias y datos inválidos, aislamiento,
errores, uso sin DOM y compatibilidad con IA 2. Reutiliza las funciones puras del
validador canónico en `vm`, sin duplicar esquemas. No ejecuta el motor 3D.
