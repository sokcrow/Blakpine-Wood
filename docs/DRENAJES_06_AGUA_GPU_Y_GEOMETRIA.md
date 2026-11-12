# Blakpine-Wood — Drenajes 06: construcción reactiva, canales y agua GPU

## Alcance

Los premades siguen siendo elementos de arquitectura `hall` del contrato `forest-horror-map-v1`. El motor continúa expandiéndolos como `room`, `wall` y `opening`; no se incorpora un motor paralelo de colisiones ni de dinámica de fluidos.

## Construcción nativa

- `nativeComponents()` recibe los segmentos de arquitectura del piso y recorta los muros y las aberturas generadas cuando ya existe un muro, una puerta, una ventana o un `opening` en el mismo borde.
- La puerta existente conserva su propia interacción y colisión, sin un muro duplicado del preset delante.
- `expandProject()` solo transforma la copia cargada por el motor; las piezas originales exportadas por el editor siguen intactas e idempotentes.

## Alturas y terreno

- **Nivel base del agua:** `WATER_LEVEL=-0.2` tiles respecto al suelo seco del mismo piso.
- **Fondo del canal:** `CHANNEL_BOTTOM=-0.42` tiles, superficie oscura simple sin físicas de fluido.
- `channelRects()` y `cutFloorRects()` recortan únicamente las superficies que atraviesan el canal en el piso correspondiente; los pasillos secos permanecen.
- La integración `addDrainGeometryToEngine()` adapta el suelo nativo del motor empaquetado y la altura visual del jugador y su cámara; `depthAt()` aporta un pequeño balanceo de flotación. El movimiento horizontal sigue delegándose en `walk()` y `canWalk()` existentes.
- Los puentes mantienen su superficie seca y no activan el desplazamiento vertical del agua.

## Tres máscaras procedimentales compartidas

**No se simulan fluidos.** Un `ShaderMaterial` compartido representa toda el agua de los distintos drenajes y plantas:

1. Ruido principal en el vertex shader, cuyo valor 0 = superficie base y valor 1 = ondulación máxima de `0.032` tiles.
2. Primera máscara de ruido móvil para la variación oscura de la corriente.
3. Segunda máscara móvil a distinta escala y velocidad para romper repeticiones.

El shader utiliza coordenadas de mundo, un reloj uniforme y la dirección de la red para hacer coincidir las superficies. No se generan `CanvasTexture` individuales por tramo ni texturas de ruido actualizadas en CPU en cada cuadro. La geometría de agua y fondo se crea al construir la planta; el `frame()` solo actualiza los uniformes temporales y la visibilidad de la inundación 4×4.

## Corrientes

`flowDirection()` identifica la salida conectada del tramo y, en T y cruces, orienta la corriente de las ramas entrantes hacia el centro antes de girar. Si el tramo no tiene destino hidráulico válido, la corriente no arrastra al personaje hacia un punto imaginario. El desagüe principal mantiene su comportamiento jugable existente.

## Restricciones y validación

- No se alteran agua potable, electricidad, economía, inventario ni NPC.
- No cambia el esquema de mapas, no hay dependencias externas, ni workflows instaladores.
- Los tests automáticos cubren solapamiento de paredes, huecos de puertas, canales por planta, relación de alturas, shader compartido, lluvia y corrientes.
- La revisión visual en un navegador con WebGL y el rendimiento real en teléfono siguen requiriendo prueba manual. La flotación es una aproximación visual/jugable, no una simulación hidrodinámica.
