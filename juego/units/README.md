# Training Dummy — unidad universal

- Tipo de objeto del mapa: `training_dummy` (campo opcional en mapas `forest-horror-map-v1`).
- Se coloca desde **Áreas → Training Dummy** en el editor y se instancia en **Probar 3D**.
- Atributos comunes: **PG máximo 1, PG mínimo 1, movimiento 0**, inmortal e inmóvil.
- Cada modo de combate conserva estadísticas propias; `stats(rulesetId, custom)` impone únicamente esos invariantes. `moon-system` se mantiene como perfil preparado, no como combate habilitado.
- `window.FHTrainingDummyRuntime.list/get/position/receiveHit` expone la referencia del blanco dentro del motor 3D. `receiveHit` registra el golpe nominal, devuelve daño aplicado **0** y nunca genera derrota ni recompensa.
- La marca de práctica 3D es geometría provisional hasta incorporar el sprite original; no se hace pasar por la imagen definitiva.

## Asset solicitado

Origen: https://imgur.com/I9q0e61

**Pendiente de adquisición:** el enlace no entrega los bytes de la imagen desde el entorno disponible. No se ha guardado una copia ficticia, cambiado de fuente ni añadido un recurso inexistente bajo una extensión inventada. El destino previsto para el original, tras comprobar su formato, es `juego/assets/units/training-dummy.<ext>`.

## Integración de combate

**DnD PROTOTIPO conectado:** el HUD de DnD permite elegir un Training Dummy y atacarlo con botón o F. El recorrido utiliza `FHCombatTargetPort → FHSessionCoordinator.bindDndCombat → FHDndCombat.evaluate → FHTrainingDummyRuntime.receiveHit`, sin gastar recursos Legacy ni crear Sombras. El Dummy registra daño nominal, pero recibe daño real **0** y sigue indestructible. Ver [docs/ETAPA3_4_DND_TRAINING_DUMMY.md](../../docs/ETAPA3_4_DND_TRAINING_DUMMY.md).

**PENDIENTE:** integración del Dummy con ataques de Legacy y con Moon (Moon permanece deshabilitado); edición y combate completo DnD no aprobados. El Dummy no incorpora IA ni estadísticas de monstruos.
