# Blakpine Wood — Etapa 3.3: selector de mundos y reglamentos

## Alcance
El editor continúa en index.html y utiliza el motor 3D original. **Mundos y combate** abre el selector; **Probar 3D** conserva el comportamiento heredado incluso en file://. juego/index.html continúa redirigiendo al editor original.

La nueva entrada lee los documentos oficiales de Etapa 2 mediante:
- FHMultimodeResourceReader.createBrowser: HTTPS, mismo origen, lista cerrada de recursos, MIME JSON, sin redirecciones y tamaño limitado.
- FHModeSelection.readSelection: valida el vínculo mundo + reglas con esquemas oficiales.
- FHWorldProfileLoader.create(...).prepare: verifica y carga la descripción y los datos del mapa.
- FHMultimodeSchemaValidator: aplica las restricciones efectivamente utilizadas en los esquemas canónicos v1, sin cambiar los contratos.
- ForestShared.validate: valida el mapa mediante el motor compartido real.

No se permite el lector multimodo HTTP ni file://. En esos contextos solamente funciona el arranque Legacy del mapa actual del editor.

## Disponibilidad
| Mundo | Mapa | Legacy | DnD | Moon System |
| --- | --- | --- | --- | --- |
| Ciudad moderna | forest-horror/maps/DEMO_Interacciones.json | Sí, Legacy nativo | Pendiente | Pendiente |
| Ciudad distópica | Sin mapa | Pendiente | Pendiente | Pendiente |
| Villa o castillo medieval | Sin mapa | Pendiente | Pendiente | Pendiente |

**Ciudad moderna no es un mapa generado**, es el mapa real de demostración del perfil. Este JSON no contiene spawn. Para esta sesión solamente, se calcula una posición segura mediante ForestShared.solidAt y se añade un spawn a la copia temporal enviada al motor. No se escribe el mapa original, el editor, el perfil ni el almacenamiento.

La selección Legacy llama al mismo launch3DPreview → start3DPreview → FOREST_PREVIEW_MAP → motor 3D ya existente. No introduce otra fórmula de combate ni reemplaza el enlace operativo Legacy de la Etapa 3.1.

## Registro para IA 4 / IA 5
El registro FHModeAdapterRegistry.create() expone register({adapter,start}), registerNativeLegacy(start) y resolve(manifest). La instancia del selector se ofrece como window.FHMultimodeAdapters al iniciar el HTML.

Para registrar un reglamento nuevo se exige adapter.id, adapter.rulesetId, adapter.contract = "blakpine-combat-adapter-v1", adapter.evaluate real y start(prepared,mode) real. El manifiesto oficial debe contener status = "implemented" y una identidad coincidente; el coordinador real debe preparar la sesión antes de iniciar. La mera presencia del módulo no habilita DnD ni Moon.

Legacy sigue con manifest.status = "planned", porque su entrada jugable es nativa y no se ha publicado un evaluador multimodo puro. No falsear este estado para el selector.

## Fallos y recuperación
Un perfil, manifiesto o mapa ausente/inválido deshabilita la opción y no sustituye sus recursos con otros. Una referencia desconocida no amplía el permiso del lector. Un sitio sin HTTPS conserva exclusivamente Legacy desde el editor.

## Verificación reproducible
- node --test tests/multimode-selector.test.cjs
- node contratos/multimodo/validar-contratos.mjs
- node --test tests/mode-session.test.cjs tests/world-profile-loader.test.cjs tests/multimode-resource-reader.test.cjs tests/legacy-real-engine.test.cjs

Es necesario comprobar aparte el arranque de la demo moderna, el botón de regreso al editor y WebGL en un despliegue HTTPS de navegador real. La ejecución en Node/VM no certifica un render visual.
