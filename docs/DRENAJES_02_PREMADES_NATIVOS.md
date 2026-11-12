# Blakpine-Wood — Drenajes 02: premades con arquitectura nativa

## Alcance de este PR

Este cambio sustituye los muros decorativos del primer lote por **habitaciones, muros y aberturas procesados por el motor de arquitectura ya existente**. Sigue siendo una fase de arquitectura: **no** activa todavía nado, arrastre físico por corrientes, inundación dinámica ni teletransporte por remolino.

### Catálogo

| Perfil | Principal | Secundario |
| --- | --- | --- |
| Recta | `straight` 10×10 | `small` 4×4 (alias de mapas v1) |
| Codo 90° | `elbow` 10×10 | `small_elbow` 4×4 |
| T | `tee` 10×10 | `small_tee` 4×4 |
| Cruce | `cross` 10×10 | `small_cross` 4×4 |
| Inicio / callejón sin salida | `dead_end` 10×10 | `small_dead_end` 4×4 |
| Desagüe principal | `outfall` 20×20 | — |

Todos permiten rotación en intervalos de 90°. Cada perfil define puertos hidráulicos reales para la red; el extremo tiene **un** puerto y **tres** lados cerrados, el codo dos puertos adyacentes.

### Reutilización del motor

- El mapa guarda **una única pieza** con `type:'hall'` y metadatos opcionales `drainage:{version:1,kind,flowTo}`.
- `FHDrainage.nativeComponents(piece)` genera un elemento `room` y cuatro segmentos `wall` o `opening`, según los puertos. No inventa otro detector de colisiones ni una segunda simulación de paredes.
- `FHDrainage.expandProject(DATA)` transforma **solamente la copia del mapa cargada en el motor**, justo antes del `buildFloor()` original. Los muros resultantes pasan por `wallModel()`, `blockers[f]` y `sightWalls[f]` del motor, para usar las mismas colisiones y visibilidad que las paredes normales.
- Los elementos generados llevan `drainageGenerated:true` y `drainageOwnerId`. La expansión es idempotente para que no duplique muros.
- `attachFloor()` solo añade la superficie visual del agua y las rejas. **Ya no dibuja muros alternativos**. La agua es visual por ahora; no declarar que tiene física.
- El editor 2D dibuja los bordes físicos derivados de los mismos componentes. Selección, movimiento, orientación y serialización siguen trabajando con un único objeto de mapa.
- `FHAreaMerge.forEngine()` mantiene las piezas individuales porque no están fusionadas por el editor y sus metadatos son distintos.

### Compatibilidad

`forest-horror-map-v1` se mantiene. La antigua pieza `small` sigue siendo una recta 4×4 y los mapas sin drenajes no generan componentes. No se alteran los servicios de agua potable ni electricidad.

### Validación y límites

Las pruebas comprueban perfiles, rotación, conteo de paredes y aberturas, continuidad hidráulica, expansión idempotente, conservación del JSON y la ruta de integración al motor.

**Pendientes para otras fases:** comprobar manualmente el renderizado en navegador y el acceso desde sótanos y edificios; resolver continuidad de losas y niveles; animación y acumulación de agua con lluvia, corrientes, estado de natación, penalización MOV y remolino funcional. Esos puntos requieren integración específica con el motor existente y no se declaran entregados aquí.
