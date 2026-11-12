# Drenajes 05 — Accesos de calle y edificios

## Objetivo
Conectar los drenajes subterráneos a la planta superior mediante **pares de entradas** que usan la transición y las colisiones existentes de Forest Horror. No se crea otro motor de físicas, navegación ni visibilidad.

## Editor de mapas → Agua
- **Respiradero de calle**: se coloca en planta baja encima de un tramo de drenaje del piso inferior inmediato. El editor busca una casilla de paso seca dentro de esa misma sección y crea automáticamente la contraparte subterránea.
- **Acceso desde edificio**: requiere que en la planta superior exista una puerta o un hueco a no más de 2.2 casillas del acceso real. Vincula con un tramo de drenaje situado en el nivel inferior contiguo.
- Cada pareja usa IDs únicos y referencias recíprocas (`targetFloorId`, `targetItemId`) en `drainageAccess`. El JSON sigue siendo `forest-horror-map-v1`.
- El inspector muestra el piso y casilla destino. Al eliminar una entrada se elimina su contraparte. No se permite mover o duplicar una mitad de la pareja por separado.
- No crea puertas nuevas ni abre paredes automáticamente: se deben construir puertas/pasillos con las herramientas de arquitectura existentes.

## Gameplay
- El botón habitual **Usar (E)** activa las entradas; el motor invoca `changeFloor()` después de verificar el destino con **`canWalk()`** en su piso real.
- El regreso se realiza mediante la entrada recíproca: no se teletransporta a un área aleatoria.
- El tipo `drain_access` no tiene colisión artificial. La rejilla y las gotas son visuales; la física y la máscara FOW siguen perteneciendo al motor.
- Entradas sin pareja o fuera del drenaje son rechazadas en la validación del editor e importación/exportación.

## Claridad, lluvia y NPCs
- Una rejilla de calle **expuesta al exterior** filtra luz solo hacia el sótano conectado. Radio de 5 ft de iluminación brillante y 5 ft adicionales de iluminación tenue. Con poca luz solar el alcance se atenúa; bajo techo, de noche y en los accesos de edificio sin rejilla no se produce claridad exterior.
- La lluvia se representa con gotas en el tramo subterráneo conectado, únicamente si la rejilla superior está al exterior y el clima indica lluvia. No se introduce otra simulación del agua: el caudal ya pertenece a Drenajes 04.
- `canNpcUse(item,npc,{flooded})` define permisos opt-in: `canEnterDrainage===true`, y también `canSwim===true` si el paso está inundado. **Esto es el contrato de capacidades, no una migración de la navegación GOAP entre plantas.** El seguimiento entre niveles de enemigos permanece pendiente de integrar con su propio comportamiento.

## Compatibilidad y limitaciones
- Mapas sin `drain_access` no cambian.
- Accesos solo entre niveles adyacentes; la planta baja requiere un sótano previo.
- Una rejilla de calle no es un túnel libre que atraviesa todos los pisos; otros niveles requerirán conexiones propias.
- No se generan nuevas escaleras físicas ni agujeros volumétricos en las losas. El cambio de nivel se realiza mediante la interacción del motor; la vista del eje vertical es representativa.
- La validación CI no sustituye una partida visual en navegador.

## Pruebas
`node --test juego/assets/fh-drainage-access.test.js juego/assets/fh-drainage.test.js juego/assets/fh-drainage-services.test.js`.
