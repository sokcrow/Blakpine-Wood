# Azoteas configurables

En el nivel que contiene el perímetro rojo del edificio, abrir **⚙ Niveles → Configurar azotea**.

- Los mapas y niveles nuevos usan concreto gris y un pretil de ladrillo rojo de **0.25 tile**. A 5 pies por tile, su altura es 1.25 pies (0.381 m).
- Se pueden cambiar el material y color del piso, el material y color del pretil, y la altura entre 0 y 2 tiles. La altura 0 omite el pretil.
- La configuración corresponde a la azotea sobre la planta seleccionada y se aplica a sus contornos rojos cerrados.
- Los patios permanecen abiertos. El pretil sólo sigue los bordes expuestos, sin muros en uniones entre spans ni contra el edificio superior.
- Los pisos interiores conservan su acabado. Un retranqueo sólo recibe concreto en su terraza expuesta.
- Si la última planta tiene un contorno rojo cerrado, el motor crea su tapa final a la altura de `ceilingHeightFt`. Esa tapa es derivada: no añade pisos al editor ni al JSON del creador.

## Compatibilidad y datos

Se conserva `forest-horror-map-v1`. `floors[].roof` es opcional; los mapas anteriores sin ese campo conservan la apariencia anterior. Para aplicarles los valores nuevos, activar **Generar azotea y pretil** en el panel y guardar.

La configuración se guarda en el borrador, historial de deshacer/rehacer, exportación JSON y payload de la vista 3D. La exportación incorpora `roofSlabsByFloor`, un cálculo derivado de los mismos perímetros rojos y patios usados por `buildingSlabs()`.

La colisión del pretil utiliza `wallModel()` y los bloqueadores existentes. La visibilidad de las superficies y los muros utiliza FOW, fachadas y corte de cámara existentes. La tapa derivada no cambia la clave de guardado de la partida.

## Validación

Las pruebas `fh-roof.test.js` cubren valores predeterminados, normalización, patios, contornos en L, uniones de losas, retranqueos, configuraciones por planta, mapas anteriores, tapa final, permisos del panel, guardado, deshacer/rehacer, exportación y geometría real de Three.js con colisión perimetral y altura en metros. `fh-preview-boot.test.js` integra el adaptador en la cadena real de construcción del motor.

No se modifican los fragmentos Base64 del motor ni los sistemas de electricidad, combate o inventario.
