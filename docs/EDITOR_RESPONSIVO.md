# Editor de mapas: distribución responsiva

Estado de esta entrega: **NEEDS WORK — pendiente de validación en navegador**.
Base inspeccionada: `6fed40e00c3ccc2d50a49140018619bfdda1e26c` (`main`).

## Cambios implementados

- Barras con medición de sus botones completos y acceso al excedente mediante desplegables. Se trasladan los nodos originales, conservando manejadores, categorías, íconos y colores.
- Categorías adicionales existentes conservadas: Áreas y accesos, Calles, Estacionamiento, Editar/mover y Zonas.
- Inspector dentro de la misma fila que el lienzo: columna independiente, estado vacío y botón para contraer o expandir. Consulta la selección real y ejecuta la cadena existente de `openInspector()` y sus editores especializados.
- En horizontal compacto, categorías y herramientas se abren bajo demanda; las propiedades requieren pulsar su botón. Elegir una herramienta cierra su desplegable. Seleccionar, mover y zoom conservan accesos visibles.
- Ayuda de herramienta, ajuste de imán, circuitos, categorías de edición y diagnóstico agrupados en Opciones. Se conserva el selector de niveles y todos los controles originales.
- En vertical estrecho, aviso «Gira tu dispositivo para editar el mapa con mayor comodidad», mapa visible sin interacción de edición y acceso a Proyecto. La adaptación no importa, reinicia ni sustituye el proyecto.
- Altura visible dinámica, áreas seguras, foco visible y cierre con Escape. El botón de pantalla completa del editor no solicita bloqueo de orientación.

## Comparación de distribuciones

La tabla describe la implementación del código, **no una comprobación visual**. No se pudieron obtener capturas en este entorno.

| Distribución | Antes, según el código inspeccionado | Implementación nueva |
| --- | --- | --- |
| Escritorio | Inspector superpuesto; varias filas inferiores; barras con desplazamiento e indicadores ocultos | Inspector en columna; dos filas inferiores; excedentes mediante Más |
| Horizontal móvil | Paleta, categorías y circuitos compiten en una fila; inspector superpuesto | Fila inferior compacta; desplegables; inspector cerrado inicialmente y en columna al abrirlo |
| Vertical móvil estrecho | Herramientas de escritorio y paneles con ancho insuficiente | Aviso en español; edición pausada; Proyecto accesible; estado conservado al girar |

El modo compacto depende del espacio: ancho menor de 900 px o altura visible de hasta 500 px. El aviso vertical aplica a anchuras menores de 600 px con altura mayor que ancho. La distribución de cada barra usa su ancho real, independientemente de esos umbrales.

## Validación realizada

Comando focalizado:

```sh
node --test tests/editor-responsive-layout.test.cjs juego/assets/fh-light-editor-ui.test.js juego/assets/fh-storage-editor.test.js juego/assets/fh-surface-editor.test.js juego/assets/fh-furniture-editor.test.js juego/assets/fh-exterior-editor.test.js juego/assets/fh-wifi-editor-overlay.test.js
```

Resultado: **28 casos reportados por node:test, 28 aprobados, 0 fallidos**. Los archivos de iluminación y superficies también ejecutaron sus comprobaciones internas satisfactoriamente.

- Casos nuevos: borde exacto de encaje, reserva del botón Más y separaciones, medidas fraccionarias, herramientas agrupadas en modo compacto y anchos de 320 a 1920 px. Son pruebas del cálculo, no del renderizado de esas resoluciones.
- `node --check` / `vm.Script`: sintaxis válida del módulo de distribución, cadenas, prueba de navegador y script inline del HTML.
- Comparación exacta del script inline frente a la base: permanece idéntico excepto los tres listeners de interfaz sustituidos (dos de categorías y uno de pantalla completa del editor).
- `git diff --check`: sin errores.
- No se pudo ejecutar un analizador CSS adicional: `tinycss2` no está instalado. No se añadió una dependencia para suplirlo.

## Pruebas de navegador pendientes

Se añadió `tests/editor-responsive-browser.cjs` para iniciar el editor completo y comprobar distribución, categorías, selección real, edición de propiedades, contracción, navegación, zoom táctil, conservación del estado al girar, guardado, exportación/importación y arranque/regreso de Probar 3D. También permite guardar capturas con `EDITOR_CAPTURE_DIR`.

El intento real de ejecución con Chromium del entorno falló **antes de cargar el editor**:

```text
FATAL:chrome/browser/process_singleton_posix.cc:297
Check failed: . socket() failed: Operation not permitted (1)
```

El navegador compartido tampoco pudo abrir el servidor local; no se obtuvo una sesión utilizable para verificar la página. **La suite de navegador está escrita pero no validada mediante una ejecución completa.** No se afirma que sus casos hayan pasado.

| Resolución | Renderizado, recortes y espacio útil | Flujos completos y errores JS |
| --- | --- | --- |
| 1920 × 1080 | Pendiente | Pendiente |
| 1440 × 900 | Pendiente | Pendiente |
| 1366 × 768 | Pendiente | Pendiente |
| 1024 × 768 | Pendiente | Pendiente |
| 390 × 844 | Pendiente | Pendiente |
| 844 × 390 | Pendiente | Pendiente |
| 667 × 375 | Pendiente | Pendiente |

Para ejecutar la prueba en un entorno con Playwright y navegador disponibles:

```sh
node tests/editor-responsive-browser.cjs
```

Opcionalmente, `CHROMIUM_EXECUTABLE` selecciona un Chromium ya instalado y `EDITOR_CAPTURE_DIR` indica dónde guardar las capturas. Esto ejecuta comprobaciones; no instala ni aplica cambios al producto. No se añadieron workflows.

Los nueve criterios de aceptación funcionales siguen pendientes de confirmación de extremo a extremo. Las pruebas de código aportan evidencia parcial de compatibilidad y del cálculo de desbordamiento; no sustituyen esa aceptación.

## Sistemas conservados

- Motor 3D, scripts `engine-*`, assets de juego, mecánicas, colisión y HUD.
- Esquema `forest-horror-map-v1`, dimensiones y coordenadas del mapa.
- Implementaciones originales de selección, edición de campos, colocación, eliminación, historial, JSON y preparación/arranque de Probar 3D.
- Editores especializados, catálogos y validaciones de permisos.
- Sin capas nuevas, minimapa decorativo ni dependencias de producción nuevas.

El PR entrega código integrado en el flujo del editor, sin instaladores ni scripts para aplicar parches. No se considera fusionado, desplegado ni listo para producción hasta verificar las pruebas pendientes.
