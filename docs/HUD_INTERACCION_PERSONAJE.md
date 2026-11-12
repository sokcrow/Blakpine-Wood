# Blakpine Wood — Regla de interacción del personaje y HUD

**Ámbito:** gameplay 3D, ordenador y móvil. No se aplica al editor 2D.

1. **Un clic/toque breve sobre la unidad jugable** alterna la placa del personaje: abierta → cerrada, cerrada → abierta.
2. **Clics/toques fuera del personaje (suelo, objetos, otros paneles) no cierran esa placa.** Escape tampoco la descarta. El HUD no intercepta eventos del mundo.
3. **Mantener pulsado sobre la unidad** abre el **radial contextual del personaje**, con opción **Inventario**. El hold no ejecuta además un toque breve.
4. El radial reutiliza `FHInteractionRadial.open(context,'hold')`; Inventario entra a `FHPlayerMenu.openSection('inventory')`, que reutiliza el inventario y sus acciones reales.
5. El hold usa `FHSafeLock`, con su tiempo y tolerancia de movimiento. Si se arrastra el dedo o se gira la cámara, no aparece un radial falso.
6. Al recibir daño o recuperación de PG, PS o PE, la placa sigue apareciendo automáticamente durante 2.8 s, con prioridad aunque no esté seleccionada. Si el jugador la cierra manualmente, no reaparece por el mismo cambio; otro cambio sí puede mostrarla.
7. La placa permanece anclada a la cabeza proyectada durante el movimiento del personaje.
8. Cerrar el radial según sus reglas propias **no modifica la selección del HUD**.
9. No crear un segundo radial, inventario, sistema de gestos, controlador de recursos o estadísticas ficticias.

## Aceptación

- **PC:** clic en personaje abre/cierra; clic fuera conserva; mantener pulsado sobre él abre radial.
- **Móvil:** toque breve y hold son excluyentes; el desplazamiento cancela el hold.
- **Inventario:** abrir desde radial usa el mismo panel y las mismas interacciones existentes.
- **Daño y Heal:** alerta automática y cierre manual funcionan sin duplicar notificaciones.
- No se cambian mapas `forest-horror-map-v1`, el editor ni colisión/visibilidad.
