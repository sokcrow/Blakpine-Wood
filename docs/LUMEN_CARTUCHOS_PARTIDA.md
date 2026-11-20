# LUMEN: entrada al mapa del cartucho

Estado: **NEEDS WORK para producción**. Código y protocolo probados; faltan despliegue de reglas/índices en `rol-serv`, recorrido con cuentas reales y aceptación visual/WebGL. Esta entrega habilita la carga inicial del mismo mapa; las posiciones, puertas y acciones todavía no se sincronizan entre jugadores.

## Recorrido implementado

| Persona | Recorrido |
| --- | --- |
| DM, prueba local | Mis partidas → Panel DM → Mapas del mundo → crear/abrir/recuperar cartucho → Editar (página completa) → Probar 3D |
| DM, partida | En el mapa elegido, Abrir partida con este mapa → publicación de la versión → Entrar al mapa → selección de personaje existente |
| Invitado | Unirse con código → Sala de espera → Entrar a la sala → Entrar a la partida → Entrar al mapa → selección de personaje existente |

Abrir partida crea una sala si no hay una abierta. Se mantiene la inscripción cuando el DM cambia el mapa dentro de la misma sala. Cerrar y reabrir una sala cambia su identificador y exige inscribirse de nuevo. El enlace de partida sólo aparece para el DM o miembros inscritos y cuando la publicación corresponde a la sala actual.

El editor usa ahora su página original completa y la paleta del portal. Guardar el cartucho y volver están en Proyecto. Véase [EDITOR_PAGINA_COMPLETA_LUMEN.md](EDITOR_PAGINA_COMPLETA_LUMEN.md) para este ajuste y sus verificaciones; la prueba 3D permanece en el editor.

## Fidelidad y persistencia

- Se publica el **mapa seleccionado completo**, con todos sus pisos, imágenes, servicios y propiedades desconocidas. Los otros mapas del cartucho permanecen locales. No se cambia `forest-horror-map-v1` ni `formatVersion:1` del archivo portable.
- El sobre publicado identifica campaña, propietario, cartucho, revisión y mapa. Se serializa una copia antes de las operaciones asíncronas. Editar después no cambia la publicación: hay que abrir partida con la nueva versión.
- Tanto el DM como el invitado descargan la publicación desde el servidor y verifican longitud, número de fragmentos, SHA-256 e identidad antes de enviar el proyecto al motor existente. Se vuelve a comprobar acceso y versión al pulsar Entrar al mapa.
- La huella detecta corrupción o mezcla de versiones; los permisos de Firebase determinan quién publica. La huella no es una firma ni una prueba de autoría independiente de Firebase.
- El motor usa una copia y los adaptadores existentes. Si falta spawn, conserva la búsqueda determinista de una posición libre que ya utiliza el selector de mundos. No añade ese spawn al cartucho ni al editor. La generación de personaje sigue siendo local.
- En esta ruta no se leen ni escriben guardados Legacy del mapa: el mundo empieza desde el estado inicial publicado. No se persiste progreso compartido ni se promete reanudar la simulación al salir.
- El cartucho y las recuperaciones IndexedDB siguen siendo las fuentes de edición del DM. La publicación no sustituye la exportación portable.

## Firebase

| Ruta bajo `campaigns/{cid}` | Uso y permisos |
| --- | --- |
| `worldReleases/{releaseId}` | Manifiesto inmutable; sólo el propietario de una campaña Legacy activa lo crea |
| `worldReleases/{releaseId}/chunks/{n}` | JSON UTF-8 convertido a base64; documentos numerados, creación exclusiva del DM antes del manifiesto, sin actualización |
| `playSession/current` | Referencia a publicación y sala; sólo el DM escribe, propietario/miembros leen metadatos |

La publicación escribe grupos de hasta ocho fragmentos; sólo después confirma manifiesto y referencia activa en una transacción junto con la apertura de sala cuando corresponde. Un fallo previo no reemplaza la partida anterior. Se reutiliza la publicación cuando sus bytes y la sala no cambian. Publicaciones anteriores y fragmentos de intentos incompletos se conservan; no hay recolección automática en esta entrega.

Cada fragmento tiene un máximo de 262 144 caracteres ASCII; el máximo por publicación es 256 fragmentos y 48 MiB de JSON UTF-8. Si se excede, se rechaza sin recortar el mapa local. No es una garantía de fluidez móvil: el coste de copias y base64 requiere medir dispositivos reales.

El invitado sólo obtiene la publicación activa mientras mantiene membresía activa e inscripción en la sala abierta correspondiente. No puede listar publicaciones, modificar fragmentos ni publicar. Al cambiar de cuenta, sala, publicación, estado de campaña o membresía se cierra el iframe. También se cierra al perder red o al pasar una escucha ya confirmada al estado de caché. Las comprobaciones de acceso usan lecturas de servidor.

`firestore.indexes.json` conserva `members/userId` con ámbito `COLLECTION_GROUP` y exime `chunks/data` del índice. La descarga de mapas usa documentos numerados y no necesita índices compuestos.

**Error de la captura:** `failed-precondition` en membresías es compatible con que el índice requerido no esté habilitado en la base activa. El archivo del repositorio ya contenía su declaración correcta. No se comprobó el índice activo: abrir Firebase redirigió al acceso de Google y la revisión automática bloqueó esa autenticación. No se afirma que el error de producción esté corregido.

## Pruebas ejecutadas

Base: `main`, `66fbb63793823bf7ec51f946cb57f89f967e7c83`.

- `node --test tests/lumen-*.test.cjs`: **52 PASS, 3 SKIP**. Los omitidos son navegador y dos pruebas que requieren el emulador. Incluye validación del puente real, aislamiento del guardado del motor, copia íntegra y Unicode, revisión/campaña equivocadas, fragmentos corruptos/truncados, permisos, cambios de cuenta/sala durante descarga y ciclo de vida del iframe.
- Firestore Emulator **1.22.0**, proyecto descartable `demo-lumen-play`: **2 PASS** con reglas reales. Se comprueban publicación exclusiva del DM, inmutabilidad, límites, invitado inscrito, externo, expulsado y sala cerrada. El protocolo real publica y descarga el mapa derivado de **7 484 175 bytes**, cinco pisos y 18 038 elementos; DM e invitado reciben un proyecto idéntico y la expulsión invalida la escucha. Firebase CLI **15.37.0**, `@firebase/rules-unit-testing` y SDK `firebase/firestore` **13.4.0** como herramientas de prueba; no se agregan dependencias al producto.
- `TMPDIR=<scratch> node --test juego/assets/fh-preview-*.test.js tests/multimode-selector.test.cjs`: **41/47 PASS**. Se ejecutó también contra el `index.html` original de la base: mismos **seis fallos**. Tres fixtures de arranque y uno de orientación no definen `preview3DSelectedMap`; otro espera una asignación antigua del botón, y el contrato de ubicación omite el mismo estado del selector. No se modifican estos fallos preexistentes para ocultarlos.
- `node --check` de los módulos modificados y compilación de scripts inline mediante `vm.Script`; `git diff --check`.
- La prueba Chromium existente se intentó con el ejecutable instalado: no pudo arrancar por `socket() failed: Operation not permitted`. La alternativa de preview administrado tampoco estaba disponible (`preview relay unavailable`). **No se acredita prueba visual, móvil ni WebGL.**

La prueba de reglas es opcional por defecto y exige `FIRESTORE_EMULATOR_HOST` y las dependencias de desarrollo `firebase`, `firebase-tools` y `@firebase/rules-unit-testing`. Se ejecutó con `emulators:exec --only firestore --project demo-lumen-play` y `node --test tests/lumen-play-rules.test.cjs`; nunca contra `rol-serv`.

## Aceptación pendiente y límites

1. Aplicar y verificar reglas e índices en `rol-serv`; confirmar que desaparece el error de membresías.
2. Probar DM e invitado reales en navegadores distintos: crear/publicar, inscribirse, cargar, salir, cambiar mapa, cerrar sala y expulsar.
3. Comprobar render real, recursos externos, entradas táctiles/teclado y regreso de selección de personaje en escritorio y móvil. Una copia exacta de JSON no prueba por sí sola que todos sus recursos se hayan renderizado.
4. La simulación compartida, sincronización de movimientos/acciones, transiciones entre mapas y guardado del mundo quedan para la siguiente integración.

No se alteran fórmulas de combate, módulos de colisión/visibilidad, servicios, economía, adaptadores Legacy/DnD/Moon, sprites ni modelos. No se crean workflows de GitHub Actions.
