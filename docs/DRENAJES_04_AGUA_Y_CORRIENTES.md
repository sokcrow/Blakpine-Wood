# Blakpine-Wood — Drenajes 04: agua animada, lluvia y corrientes

## Alcance entregado

La vista 3D crea texturas de agua pixeladas con `CanvasTexture` y las desplaza en cada actualización meteorológica. Los conductos de 4×4 poseen una lámina adicional que cubre las cuatro casillas **solo durante lluvia**. El agua normal del canal permanece cuando no llueve. Las superficies, paredes y aberturas del motor nativo se mantienen; no se dibujan muros ficticios.

`FHDrainage.createRuntime()` se integra en el `frame()` real mediante `addNaturalLightToEngine()`, reusando `FHWeatherRuntime.view()`, `currentFloor`, el jugador y las funciones `walk()`, `canWalk()` y `changeFloor()` del motor.

## Mecánicas de movimiento

- La posición del jugador se comprueba contra los canales mediante `FHDrainage.waterAt`. Una reja `drainageBridge` es suelo seguro.
- Los 4×4 inundados reducen el movimiento voluntario al **50 %**. Esa regla no se aplica indiscriminadamente a los corredores principales ni a las zonas secas.
- La corriente se acelera con lluvia: al mover físicamente al jugador invoca `walk(dx*CELL,dy*CELL,true)`, que conserva la colisión con muros y puertas del juego. El argumento adicional evita aplicar dos veces el freno por inundación al empuje hidráulico.
- `flowTo` conectado y `downstream()` controlan la dirección. En tramos aislados existe una dirección visual y de empuje local, pero el motor impide atravesar muros.
- El desagüe principal empuja hacia el agujero central. Cuando el personaje entra en el radio de activación, `randomExit()` escoge **otro drenaje válido de cualquier sector y piso del mapa** —no exige continuidad hidráulica—; `changeFloor()` y el almacenamiento de progreso existentes realizan la transición.
- Se impone una pausa de 4 segundos tras el remolino para evitar saltos continuos. Si no hay destino, no hay teletransporte.
- La lluvia intensa de tipo nieve (`phase:'nieve'`) no activa inundación por lluvia.

## Contrato de datos y compatibilidad

Se conserva `forest-horror-map-v1`, las piezas guardadas siguen siendo `hall` con `drainage` y no se modifica el agua potable. Todos los elementos generados siguen usando los módulos arquitectónicos nativos. La física hidráulica sigue siendo una aproximación jugable a base de fuerzas, **no** Navier–Stokes.

## Pruebas

`fh-drainage.test.js` incluye colisión sobre puentes, transición con destino aleatorio, aumento de velocidad, protección ante nieve, dibujado y desplazamiento UV simulado con Three.js, e integración estática al adaptador meteorológico.

## Pendientes conocidos

No se ha añadido aún una animación/estado específico de natación, atributos de natación/entrada de drenajes de NPCs, partículas de lluvia que atraviesen rejas desde el exterior, ni audio ambiental hidráulico dedicado. La revisión visual manual en navegador sigue siendo necesaria antes de dar por cerrada la experiencia artística completa.
