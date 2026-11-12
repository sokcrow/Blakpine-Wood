# Blakpine-Wood — Sótanos 03: continuidad del edificio

## Problema

El editor y el motor calculaban `basementSlabs` exclusivamente a partir de los muros rojos de cada sótano. Un sótano sin contorno estructural propio quedaba sin huella ni suelo físico aunque existiera un edificio cerrado directamente encima. El motor tampoco construía el perímetro de ese edificio dentro del sótano.

## Corrección

- `FHBasement.resolveSlabs(project, slabFor)` usa la huella del nivel principal como **respaldo** para todos los sótanos que carecen de contorno propio; una huella de sótano definida por el creador tiene prioridad.
- Editor (exportación) y vista 3D calculan las mismas huellas mediante `FHBasement.resolveSlabs`.
- `FHBasement.expandProject(DATA)` construye únicamente en la copia runtime muros `wall` a partir del perímetro `red_wall` del nivel principal (y aberturas del contorno exterior que deben permanecer cerradas abajo). Solo se generan si el sótano no tiene su propio contorno rojo.
- Estos muros pasan por el `buildFloor()`, `wallModel()`, bloqueos de movimiento y visibilidad del **mismo motor**; no se crea una escena 3D paralela.
- La expansión es idempotente y no copia muebles, habitaciones, NPCs, aparatos, luces ni puertas de la planta principal. Los drenajes de sótanos se expanden después de esta herencia.

## Comportamiento

- Sótano sin perímetro: se usa la huella de la planta principal.
- Sótano con perímetro rojo propio: conserva su huella y paredes específicas.
- Mapa sin sótanos: sin cambios.
- Edificio sin huella válida y no vacía (por ejemplo, un muro rojo suelto): no se inventa estructura subterránea.
- Contrato JSON: `forest-horror-map-v1` y campos opcionales existentes.

## Pruebas y pendientes

Pruebas de huellas, prioridad de perímetro propio, generación nativa, no duplicación y retrocompatibilidad en `fh-basement-structure.test.js`.

La comprobación visual de la continuidad entre nivel suelo y sótanos en navegadores reales sigue pendiente. Esta fase **no** crea accesos nuevos, escaleras automáticas, corrientes, natación, inundaciones ni remolinos: son mecánicas independientes.
