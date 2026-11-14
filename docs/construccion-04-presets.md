# Construcción 04 — Presets que generan edificios

El editor **Zonas → Delimitar propiedad → Proyecto** permite seleccionar Ayuntamiento, Casas, Apartamentos o Tienda. Después de seleccionar un proyecto, el botón **Generar edificio completo** crea una estructura real en el piso de esa parcela. **Personalizado** conserva el editor manual.

## Datos y construcción
- Solo se generan edificios en parcelas rectangulares creadas con la herramienta de Zonas; otras parcelas requieren edición manual.
- Debe quedar libre una casilla de margen en cada lado; el edificio ocupa una huella máxima propia del preset, no necesariamente toda la propiedad.
- No se elimina ni sobrescribe ninguna pared, calle, pieza, habitación, mueble o infraestructura existente. Se rechaza el área ocupada.
- Se generan objetos nativos en `floor.items`: paredes rojas de perímetro y losa, huecos con puertas y ventanas, divisiones interiores, vestíbulo y habitaciones `room` con `constructionRoom`.
- Los GLB se colocan a partir de la metadata física existente en `catalogo_muebles.json`; `FHFurnitureRules.applyCatalogModel` mantiene sus tipos e interacciones donde aplica.
- Las habitaciones exigidas por Construcción 02 se equipan con mobiliario. Las tiendas incluyen registradora y dos exhibidores. Apartamentos crea **dos viviendas** separadas con accesos desde un corredor común, en una sola planta; no se han agregado plantas ni escaleras automáticamente.
- Se colocan tomas de agua, desagües y enchufes cerca de los aparatos. **No se crean fuentes, contratos, circuitos o conexiones ficticias**. Los diagnósticos existentes siguen identificando instalaciones no verificadas o desconectadas.
- Todos los objetos generados incluyen `constructionParcelId`; la parcela registra `generatedPrefab: {version,preset,itemIds}`. Son campos opcionales que preservan `forest-horror-map-v1`. No se borra ninguna edición manual posterior.
- Para no duplicar ni eliminar cambios del creador, el botón rechaza una segunda generación sobre la misma parcela. Modifica sus elementos con el editor normal.

## Estado de obra y límites
La opción **Simular obra durante la partida** conserva las fases, porcentajes y vallado ligeros de Construcción 01. **Limitación pendiente:** las paredes y muebles generados se incorporan a la geometría desde el inicio del mapa; todavía no aparecen progresivamente en cada fase y no participan obreros. Tampoco hay alcalde funcional, PC municipal, economía de construcción, viviendas ocupadas ni empleados. No considerar la obra visual por etapas completada.

## Validación y mantenimiento
Pruebas de Construcción 04: generación de cuatro presets, cierre real de perímetro reconocido por arquitectura, contenidos por habitación, protección ante calles y solapes, no duplicación, límites de huella, conservación del JSON y falta de modelos. Ejecutar:

```sh
node --test juego/assets/fh-construction-prefabs.test.js
```

No se incorporan dependencias, instaladores ni workflows.