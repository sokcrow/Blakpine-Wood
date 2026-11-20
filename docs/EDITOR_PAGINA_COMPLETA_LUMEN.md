# Editor independiente y colores LUMEN

El editor se abre ahora como página completa en `index.html?editor=1`. Al editar un mapa del cartucho, la URL añade únicamente campaña e identificador de su copia de trabajo. La herramienta ocupa la página original, sin cabecera, biblioteca ni marco visible del portal.

## Uso

1. Mis partidas → Panel DM → Mapas del mundo → abrir/crear cartucho → **Editar**, o **Crear mapa en el editor**.
2. Trabajar con las barras, propiedades, cuadrícula y controles originales. **Probar 3D** conserva su posición y abre el mismo motor con el mapa actual.
3. En **Proyecto**, usar **Guardar mapa en cartucho de trabajo**, **Exportar cartucho** o **Volver a la biblioteca**. El regreso conserva la copia completa, incluyendo cambios no exportados.
4. Para publicar la versión del mapa, usar **Abrir partida con este mapa** desde la biblioteca. La entrada del invitado y el protocolo de publicación continúan como en la entrega anterior.

Se retira el botón de prueba 3D de la biblioteca. Su iframe se conserva oculto exclusivamente como puente de validación/creación de datos del editor original; no se usa para mostrar ni editar el mapa. El editor visible es el documento principal (`window.parent === window`), no ese iframe.

## Conservación del cartucho

`portal/editor-workspace-model.js` guarda una copia completa en IndexedDB `lumen-editor-workspace-v1`, separada de las recuperaciones anteriores. Las claves se aíslan por cuenta, campaña e identificador de copia; cada escritura compara un token para detectar otra pestaña. `IndexedDBBackend` admite un nombre de base opcional; su nombre anterior y el formato de dos recuperaciones permanecen iguales.

La navegación sólo comienza después de confirmar la escritura local. La página del editor comprueba de nuevo la cuenta y la propiedad de la campaña contra el servidor de Firebase antes de abrir los datos y guardar. El modo independiente sin cartucho mantiene su borrador Legacy.

Abrir para editar un archivo físico más antiguo no sobrescribe implícitamente una recuperación más nueva. En el primer cambio se incrementa la revisión por encima del límite observado. Si otra pestaña cambió la recuperación, se conserva su versión y la copia editada queda en el espacio de trabajo, con advertencia. Los errores de cuota o validación mantienen el mapa en memoria y permiten exportarlo desde Proyecto. Las copias de trabajo se conservan localmente; no se añade borrado automático.

Guardar y volver espera las escrituras pendientes antes de navegar. El identificador de regreso se consume en la biblioteca para que Actualizar no reponga esa copia sobre cambios posteriores. Recargar directamente la URL del editor vuelve a abrir su última copia guardada. El aviso de salida permanece si hay cambios sin exportar, una escritura pendiente o fallos de recuperación. Exportar solicita una descarga; el navegador no confirma que se haya conservado el archivo.

## Colores

`juego/assets/fh-editor-theme.css` aplica negro, marrón oscuro, dorado y marfil del portal a la interfaz del editor. Sólo cambia colores: conserva tipografía, tamaños, radios, distribución, controles adaptables y ubicación de botones. Se ajustan también los colores de fondo, cuadrícula y borde del lienzo 2D.

No se modifican los colores que identifican tipos de objeto, circuitos o bandas de cobertura, ni la interfaz dentro del iframe del motor 3D. Los estilos del portal no se importan al editor, evitando que sus reglas de tamaño y composición alteren la herramienta.

## Validación

Base: `main` `ac8bb04c73f28ae74e259ff88b301a7f3abe3b40`.

- `node --test tests/lumen-*.test.cjs tests/editor-responsive-layout.test.cjs`: **76 PASS, 3 SKIP**. Incluye traspaso completo, guardado/regreso, permisos, cuota inyectada, conflictos, apertura principal frente a iframe, botón original Probar 3D, pruebas previas del cartucho y distribución adaptable. Los tres omitidos requieren Chromium o emulador Firebase.
- `node --check` de módulos nuevos/modificados, compilación `vm.Script` de scripts inline y `git diff --check`.
- La prueba nativa existente se actualizó para comprobar navegación a la página real, tamaño de viewport, descarga y reapertura, manteniendo recuperación, dos instantáneas y cuota. Usa identidades sintéticas en el límite del SDK; no equivale a probar cuentas reales. Al ejecutarla aquí Chromium no pudo arrancar (`socket() failed: Operation not permitted`). El preview administrado tampoco estaba disponible (`preview relay unavailable`).
- Revisión del diff: el DOM de las barras y la posición de `#testBtn` se conservan; el tema no introduce reglas de distribución. En `renderOn` sólo se sustituyen cuatro colores. Los textos nuevos están en `portal/cartridge-strings.js`.

**PASS en las comprobaciones automáticas; NEEDS WORK en aceptación visual y cuentas reales.** Pendiente revisar escritorio/móvil, sesión Firebase real durante el cambio de página, selección de personaje, render WebGL y descarga en el dispositivo habitual.

No se modifican `firestore.rules`, `firestore.indexes.json`, `firebase.json`, esquema del mapa, contrato portable, motor embebido, combate, colisiones, economía, HUD ni assets gráficos. No se añaden dependencias ni workflows. El despliegue Firebase pendiente de la entrega anterior sigue siendo un requisito para las partidas compartidas y es independiente de este ajuste de presentación/navegación.
