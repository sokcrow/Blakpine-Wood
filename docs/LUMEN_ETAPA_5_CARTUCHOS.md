# LUMEN — Etapa 5: cartuchos locales

Estado: **NEEDS WORK** hasta verificar el recorrido con cuentas Firebase reales y la aceptación visual. El recorrido técnico de navegador con identidades de prueba sí pasó en GitHub Actions. Los PRs A/B/C son dependientes y no equivalen a despliegue.

## Archivos del cambio

| Archivos | Responsabilidad |
| --- | --- |
| `portal/cartridge.js` | Contrato portable, validación e identidad, catálogo y revisiones |
| `portal/cartridge-access.js` | Autorización mediante lectura Firebase externa y comprobación de sesión |
| `portal/cartridge-recovery.js` | IndexedDB, dos instantáneas y token contra conflictos |
| `portal/map-library.js`, `portal/cartridge-strings.js` | Biblioteca, editor integrado, recuperación y textos en español |
| `portal/app.js`, `portal/index.html`, `portal/portal.css` | Ruta DM, navegación, aviso permanente, iframe del mismo origen y estilo LUMEN |
| `index.html` | Aislamiento del borrador y API del editor; exportación completa e historial inicial |
| `tests/lumen-cartridge.test.cjs`, `tests/lumen-editor-bridge.test.cjs`, `tests/lumen-library-behavior.test.cjs` | Datos, editor y comportamiento de autorización/biblioteca |
| `tests/lumen-recovery.test.cjs`, `tests/lumen-performance.test.cjs`, `tests/helpers/lumen-large-map.cjs` | Recuperación, fallos y medición 120 × 120 |
| `tests/lumen-browser.test.cjs` | Integración Chromium con almacenamiento nativo y descarga; se conserva como prueba reproducible sin workflow permanente |
| `docs/LUMEN_ETAPA_5_CARTUCHOS.md` | Contrato, evidencia, límites y aceptación pendiente |

## Contrato v1

Archivo portable `Nombre-de-Partida.lumen.json`, JSON UTF-8. No está cifrado ni firmado: el propietario puede editarlo externamente. Los identificadores no prueban autenticidad ni conceden permisos de Firebase.

| Campo | Contrato |
| --- | --- |
| `formatVersion` | `1`; otras versiones se rechazan |
| `cartridgeId` | UUID generado con Web Crypto al crear; permanente al exportar/importar |
| `campaignId` | ID de campaña Firebase autorizada |
| `ownerUid` | UID autenticado, igual al propietario de la campaña |
| `rulesetId` | `legacy` en esta entrega |
| `revision` | Entero seguro positivo, aumenta al cambiar mapas |
| `createdAt`, `updatedAt` | Fechas ISO; modificación no anterior a creación |
| `maps` | Lista de `{mapId,name,project,createdAt,updatedAt}`; IDs únicos dentro del cartucho |
| `connections` | Lista vacía reservada; futuras versiones podrán definir `sourceMapId`, salida, `targetMapId`, entrada, tipo y condiciones |
| `worldState` | `{version:1,data:null}`; sin captura ficticia de NPCs o mundo |

`project` conserva todo el JSON `forest-horror-map-v1`, incluidos campos desconocidos, referencias gráficas, pisos, puertas, circuitos, electricidad y servicios. Se valida una copia con `ForestShared.loadProject` y los validadores del editor; no se almacena su resultado migrado. La versión interna de mapa existente no cambia de esquema. Al abrir y devolver sin editar se devuelve exactamente el proyecto original. Al editar se usa `exportProject(true)` del único editor para incluir imágenes y actualizar los datos derivados de geometría; no se recortan propiedades para reducir tamaño. No se copian sesiones, tokens, contraseñas ni invitaciones al sobre del cartucho.

## Flujo

DM autenticado → Mis partidas → campaña Legacy activa → Mapas del mundo → Crear/Abrir cartucho → Crear/Importar mapa → Editar → Guardar mapa → Exportar cartucho.

La vista usa `getDocFromServer` para autorizar campaña y UID antes de las acciones. Cambiar la URL no autoriza. Se comprueba de nuevo la sesión después de las lecturas asíncronas. El jugador no recibe la biblioteca ni acceso automático a cartuchos. Las reglas Firestore no se amplían.

El editor se carga en un iframe del mismo origen con `editor=1&lumenCartridge=1`. `LumenEditor` permite validar, crear, cargar y devolver proyectos; el padre controla la campaña y el mapa. El parámetro solo aísla el editor y no contiene identidades ni datos de campaña. Entrar directamente abre un editor vacío, sin acceder a cartuchos.

La navegación de la sesión mantiene campaña, cartucho y mapa seleccionado; se detiene si la edición pendiente no valida, conservando el editor para corregirla. Cerrar sesión pide confirmar si aún hay cambios sin exportar o errores de recuperación; la reapertura puede recuperar el mapa activo de una instantánea. No se utiliza `fh_editor_map_v1` en modo cartucho. La prueba 3D se bloquea únicamente en esta vista hasta integrar la sesión del anfitrión; sigue disponible en el editor independiente. No hay otra implementación de editor ni de Three.js.

## Recuperación y exportación

IndexedDB `lumen-cartridge-recovery-v1`, almacén `cartridges`, clave JSON `[uid,campaignId,cartridgeId]`. Guarda dos instantáneas con revisión, fecha, mapa activo y copia completa del cartucho. Las escrituras son transacciones atómicas que comparan un token local con la última lectura; otra pestaña produce `RECOVERY_CONFLICT` y no se pisa.

Cada instantánea se valida antes de ofrecerla. Si la más nueva está corrupta, solo se ofrece una predecesora válida. Al abrir un archivo se compara con su recuperación: contenido diferente con revisión igual/mayor o fecha más reciente exige elegir recuperar o conservar el archivo. Conservarlo no sobrescribe automáticamente la recuperación. Su primera modificación obtiene una revisión superior a la recuperación observada.

El autoguardado del editor espera 700 ms desde el último cambio y encola la transacción local. La interfaz distingue recuperación local, cambios del editor, cartucho de trabajo y descarga portable solicitada. No hay escritura directa del archivo elegido. Una descarga solicitada no permite al navegador comprobar que el usuario la conservó: la interfaz pide comprobarlo. La exportación manual es obligatoria para portabilidad y respaldo independiente del navegador.

Hay un aviso permanente mientras existen cambios pendientes de exportar o fallos de recuperación. Cuota, permisos, bloqueo o ausencia de IndexedDB se comunican sin borrar el cartucho en memoria ni impedir su descarga. «Solicitar almacenamiento persistente» consulta `navigator.storage.persist()`; una concesión tampoco sustituye la copia exportada. El navegador puede eliminar datos locales y el cierre durante una transacción puede dejar únicamente la última instantánea completada.

## Verificación ejecutada

Base inspeccionada: `main` `2fdaee383655afb7b4021055e22d58461cc6f4be`.

- `node --test tests/lumen-*.test.cjs`: **37 PASS**, 1 prueba de navegador omitida explícitamente. Incluye módulos reales de datos y recuperación, puente real del editor ejecutado en VM, dos campañas/IDs, importación/exportación, retención de propiedades, autorización antes/después de lectura, corrupción, conflictos, cuota y permisos inyectados y ausencia de IndexedDB. El backend en memoria prueba la política de recuperación; IndexedDB nativo se verifica por separado en Chromium.
- `TMPDIR=<scratch> node --test tests/multimode-*.test.cjs tests/legacy-*.test.cjs tests/mode-session.test.cjs`: **143/147 PASS**. Cuatro fallos preexistentes: tres expectativas DnD `RULES_ADAPTER_MISSING` en `multimode-runtime.test.cjs`, y `SAVE_ENGINE_HOOK_MISMATCH` en `multimode-save-engine-hook.test.cjs`. Se contrastan con el `index.html` original de main mediante precarga diagnóstica, sin modificar el checkout.
- Primera regresión previa a editar `index.html`: **56/59 PASS**; tres fallos `preview3DSelectedMap is not defined` en fixtures de `fh-preview-boot.test.js`.
- `node contratos/multimodo/validar-contratos.mjs`: **846 aserciones PASS**.
- `node --check` de módulos nuevos; compilación `vm.Script` de scripts inline del editor; `git diff --check`.
- Chromium local: no pudo arrancar por restricción de sockets del entorno (`Operation not permitted`). Navegador remoto: servidor local inaccesible (`ERR_CONNECTION_REFUSED`). Esas limitaciones locales se sortearon ejecutando la prueba técnica de Chromium en GitHub Actions. No se acredita inspección visual ni WebGL.

### Medición de 120 × 120

Mediciones puntuales de Node en este entorno, sin umbrales arbitrarios; no son cifras de móvil. `tests/helpers/lumen-large-map.cjs` conserva el escenario real `DEMO_Circuitos_Identificados.json` con cinco pisos y amplía su cuadrícula. La carga de estrés agrega copias identificadas de una silla real del repositorio; **es un escenario derivado**, no un mapa de producción diseñado a mano.

| Escenario | Pisos / elementos | JSON UTF-8 | Serializar | Parsear | Validar | Importar y validar | Exportar y validar |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mapa del repositorio, cuadrícula 120 × 120 | 5 / 38 | 8 175 B | 0,08 ms | 0,13 ms | 0,51 ms | 1,56 ms | 0,54 ms |
| Estrés derivado 120 × 120 | 5 / 18 038 | 7 484 175 B | 43,94 ms | 40,43 ms | 181,69 ms | 218,39 ms | 219,42 ms |

**Pendiente:** coste de dos instantáneas de tamaño grande en dispositivos habituales, llenado físico de cuota, rendimiento móvil habitual, mapas reales de usuario densamente diseñados y cartuchos con muchas imágenes/mapas. La cuota nativa impuesta se verificó después en Chromium; queda pendiente el llenado de cuota física y su comportamiento en dispositivos reales. No se afirma que estos tamaños garanticen fluidez móvil. El código mantiene varias copias durante validación, edición y recuperación; el consumo de memoria supera el tamaño serializado. Si las mediciones reales lo requieren, evolucionar `formatVersion` a un contenedor de entradas independientes y compresión reversible, preservando los proyectos internos completos y la importación v1 explícita. No se implementa esa evolución aquí.

### Prueba de navegador ejecutada en GitHub Actions

`LUMEN_BROWSER_TEST=1 node --test tests/lumen-browser.test.cjs` necesita Playwright y Chromium de pruebas; `LUMEN_CHROMIUM_PATH` permite elegir el ejecutable existente. Es una prueba de desarrollo, no un instalador ni un parche del producto. Usa identidades sintéticas claramente locales, editor real, descarga, IndexedDB nativo, cierre/reapertura del perfil y medición nativa de guardado. No sustituye la prueba Firebase con DM y jugador.

Ejecución [44735937133](https://github.com/sokcrow/Blakpine-Wood/actions/runs/44735937133): **37 pruebas de datos PASS + 1 prueba nativa Chromium PASS**. Editor real, exportación completa, descarga y cierre/reapertura del perfil con reimportación exacta. Guardado IndexedDB nativo del cartucho de estrés: **209,2 ms**, **7 484 175 B**. Se fijó Ubuntu 24.04 porque el primer intento con Ubuntu 26.04 no era compatible con la versión de Playwright de pruebas.

Ejecución final de código [44736457978](https://github.com/sokcrow/Blakpine-Wood/actions/runs/44736457978), commit `78139886a6bef507435d33b17cd65a59ff3d8a28`: **37 pruebas de datos PASS + 1 integración Chromium PASS**. Añade recuperación sin seleccionar archivo después de reabrir el perfil, retención nativa de dos revisiones y rechazo real de la escritura IndexedDB por cuota. Para este último caso se reduce la cuota de un origen de prueba nuevo mediante CDP; no se llena el disco físico. Resultado: `RECOVERY_QUOTA`, cartucho en memoria idéntico y exportable, ninguna instantánea parcial. El primer intento de reducir cuota en un origen ya usado no produjo rechazo, por lo que se aisló el origen antes de abrir IndexedDB. Guardado inicial nativo del cartucho de 7 484 175 B: **201,1 ms**; se comprobaron dos instantáneas tras sucesivas revisiones.

### Aceptación pendiente

Verificar en el despliegue autorizado, sin credenciales inventadas:

1. DM real crea dos campañas Legacy; jugador real conserva exclusivamente su membresía y sala.
2. Ejecutar el recorrido completo de exportación, cierre, nuevo inicio de sesión y reapertura del archivo en ambas campañas.
3. Confirmar recuperación más nueva y elección de conservar el archivo, predecesora válida, cuota del dispositivo real y navegación mientras hay cambios. El rechazo de cuota nativo bajo una cuota impuesta ya pasó en Chromium.
4. Comprobar teclado, foco, vistas móviles y escritorio; referencia de imágenes y todos los servicios tras editar.
5. Verificar arranque 3D independiente con guardados Legacy preexistentes y resolver los fallos de pruebas anteriores por una tarea separada.

No se modifican `firestore.rules`, `firestore.indexes.json`, `portal/config.js`, `juego/core/`, adaptadores Legacy/DnD/Moon ni los assets del motor. Permanecen intactas fórmulas, electricidad, economía, combate y guardados históricos. Firebase conserva cuentas, campañas, miembros y sala; no recibe mapas ni estados del mundo. Sin WebRTC, presencia fiable, transiciones o sincronización multijugador.

## Integración en main

Los PRs [#220](https://github.com/sokcrow/Blakpine-Wood/pull/220), [#221](https://github.com/sokcrow/Blakpine-Wood/pull/221) y [#222](https://github.com/sokcrow/Blakpine-Wood/pull/222) se fusionaron en orden A → B → C el 20-11-2026. El workflow temporal `lumen-cartridges.yml` se retiró después de la integración conforme a la política de no mantener workflows personalizados; las pruebas y la documentación de sus ejecuciones históricas permanecen. La aceptación con cuentas Firebase reales y revisión visual sigue pendiente.
