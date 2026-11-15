# Perfiles declarativos de mundos — IA 3

**Estado:** preparación estructural. No implementa escenarios 3D, generadores, recursos gráficos ni servicios operativos.

## Contrato utilizado

Los perfiles se mantienen en `contratos/multimodo/ejemplos/mundos/` y utilizan exclusivamente `blakpine-world-profile-v1`, definido en `contratos/multimodo/v1/perfil-mundo.schema.json`. Se conservan los campos `kind`, `version`, `id`, `label`, `environment` y, donde existe, `map`.

Se utiliza el campo **opcional ya aprobado** `extensions`, bajo la clave versionada `blakpine.world-capabilities.v1`. Esta clave es información de diseño de IA 3, **no otro esquema del motor ni una API implementada**. El contrato v1 permite `extensions` pero no impone ni valida la semántica interna de esta extensión. Un intérprete futuro tendrá que reconocer expresamente dicha clave antes de utilizarla.

## Separación de capacidades

| Grupo | Significado declarativo | Lo que no hace |
| --- | --- | --- |
| `architecture` | Tipologías y capacidades generales de edificaciones | No construye geometría, habitaciones ni edificios |
| `paths` | Clases de vías y accesos previstos para el escenario | No calcula rutas, colisiones ni conectividad real |
| `materials` | Familias descriptivas de materiales | No crea un catálogo, texturas ni asignaciones visuales |
| `services` | Infraestructuras o servicios que el mundo puede representar | No instala, simula ni garantiza redes funcionales |

Cada grupo es una lista de identificadores de diseño `kebab-case`, sin rutas de assets, parámetros de ejecución, scripts ni referencias a un sistema de combate. Estas listas no sustituyen `environment.layoutProfile` ni `environment.infrastructureProfiles`; los campos originales conservan su significado. Un identificador declarado no equivale a una función del motor disponible.

## Escenarios

| Perfil | Orientación arquitectónica | Caminos | Materiales | Servicios |
| --- | --- | --- | --- | --- |
| `ciudad-moderna` | Edificios multinivel y bloques de uso mixto | Calles pavimentadas, aceras y accesos de servicio | Hormigón, acero, ladrillo, vidrio y asfalto | Electricidad, agua, drenaje y telecomunicaciones |
| `distopia` | Bloques densos, reutilización industrial y perímetros controlados | Calles estrechas, accesos restringidos y pasos elevados | Hormigón, acero, mampostería y materiales recuperados | Redes segmentadas y servicios de distribución local |
| `villa-medieval` | Estructuras de madera y piedra, recintos, patios y torres | Caminos de tierra, callejones empedrados y accesos por puertas | Piedra, madera, mortero, teja y paja | Pozos, drenaje superficial y calefacción por combustible sólido |

Estas orientaciones son **metadatos**, no un listado nuevo de objetos o piezas construibles.

## Compatibilidad y límites

- `ciudad-moderna` conserva su referencia a `forest-horror/maps/DEMO_Interacciones.json`; esa referencia es un ejemplo de mapa existente, no una ciudad generada.
- `distopia` y `villa-medieval` **no tienen** `map`: sus configuraciones pueden validarse, pero no son escenarios jugables por sí solas.
- Los tres perfiles son agnósticos del combate. Únicamente los archivos independientes de selección multimodo vinculan mundo y reglamento.
- No se modifica `forest-horror-map-v1`, ningún JSON Schema de IA 2, manifiestos de reglas, selecciones de ejemplo, motor, editor ni catálogos.
- La validación estática de IA 2 comprueba la forma exterior del perfil y que no imponga reglamentos; los cuatro grupos internos se revisan además por estructura, unicidad y formato, pero todavía no existe un consumidor de la extensión.

**Siguiente responsable de la integración futura:** deberá decidir cómo interpretar estos identificadores con sistemas reales y declarar explícitamente el soporte de esta extensión, sin inferir que está operativa solo porque figure en los datos.
