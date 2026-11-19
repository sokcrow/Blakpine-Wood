# Training Dummy — unidad universal

- Tipo de objeto del mapa: `training_dummy` (campo opcional en mapas `forest-horror-map-v1`).
- Se coloca desde **Áreas → Training Dummy** en el editor y se instancia en **Probar 3D**.
- Atributos comunes: **PG máximo 1, PG mínimo 1, movimiento 0**, inmortal e inmóvil.
- Cada modo de combate conserva estadísticas propias; `stats(rulesetId, custom)` impone únicamente esos invariantes. `moon-system` se mantiene como perfil preparado, no como combate habilitado.
- `window.FHTrainingDummyRuntime.list/get/receiveHit` expone la referencia del blanco dentro del motor 3D. `receiveHit` registra el golpe nominal, devuelve daño aplicado **0** y nunca genera derrota ni recompensa.
- La marca de práctica 3D es geometría provisional hasta incorporar el sprite original; no se hace pasar por la imagen definitiva.

## Asset solicitado

Origen: https://imgur.com/I9q0e61

**Pendiente de adquisición:** el enlace no entrega los bytes de la imagen desde el entorno disponible. No se ha guardado una copia ficticia, cambiado de fuente ni añadido un recurso inexistente bajo una extensión inventada. El destino previsto para el original, tras comprobar su formato, es `juego/assets/units/training-dummy.<ext>`.

## Integración de combate

El blanco ya existe como unidad de mapa y objetivo con API para recibir golpes. La conexión concreta entre cada adaptador de ataque (Legacy/DnD/Moon) y esta API es un trabajo aparte: aquí no se alteraron fórmulas, coordinadores ni daño de criaturas. No asumir que el ataque jugable del jugador selecciona al Dummy hasta que se conecte su selección en el motor.
