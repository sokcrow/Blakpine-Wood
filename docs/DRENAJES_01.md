# Blakpine-Wood — Drenajes 01 · Premades y conexión de agua residual

## Objetivo de esta entrega
Permitir que el creador diseñe una red subterránea de alcantarillado mediante premades y conectar las tomas de **agua residual** con el drenaje más cercano. No se sustituye la red potable existente ni se cambia el esquema `forest-horror-map-v1`.

## Premades colocables
En la categoría **Agua** del editor:
- **Pasillo recto, unión T y cruce 10×10 tiles:** cuatro tiles centrales de agua residual y tres tiles de camino en cada lateral; las T y cruces tienen canales adicionales conectados.
- **Conducto secundario 4×4 tiles:** canal central pequeño; su estado de lluvia calcula inundación de todo el ancho.
- **Desagüe principal 20×20 tiles:** recorridos transitables en los bordes, canales de entrada, agua alrededor del centro y agujero/remolino central.
- **Puente de reja:** superficie de 2×6 o 6×2 tiles, colocable libremente por el creador, con giro de 90°.

El inspector de las piezas permite rotar y definir `flowTo`, una referencia explícita a un premade vecino **conectado físicamente**. En ausencia de `flowTo`, la función `FHDrainage.downstream()` busca una salida principal accesible por la red. El editor ofrece un diagnóstico de tramos aislados y referencias de corriente incorrectas.

## Datos del mapa
Los nuevos elementos reutilizan tipos ya compatibles con `forest-horror-map-v1`, sin añadir tipos desconocidos al validador histórico:

```json
{
  "id": "drenaje_01",
  "type": "hall",
  "x": 20,
  "y": 20,
  "w": 10,
  "h": 10,
  "rotation": 0,
  "heightFt": 0,
  "blocksMovement": false,
  "drainage": {
    "version": 1,
    "kind": "straight",
    "flowTo": "drenaje_02"
  }
}
```

Clases `kind`: `straight`, `tee`, `cross`, `small` y `outfall`. Los puentes se guardan como áreas `concrete` con `drainageBridge: { "version": 1 }`. Las dimensiones y los límites del mapa se validan. Los mapas antiguos no requieren migración.

## Agua residual
En `FHServices.createRuntime`, si el mapa contiene alguna pieza de alcantarillado, cada `drain_outlet` activa enlaza con la pieza más cercana por distancia y diferencia de elevación entre pisos. La respuesta `drainStatus` incluye `via` e `floorIndex` del destino. Esta asociación es **topológica**, no una tubería visible ni una simulación de flujo volumétrico. La conexión no mezclará nunca agua limpia y residual.

Si no hay premades, sigue funcionando exactamente el sistema previo `drain_outlet` / `drain_main`, incluidas sus restricciones existentes.

## Clima y diseño jugable previsto
Se añade la función pura `FHDrainage.weatherState(piece, rainIntensity)` para relacionar drenajes con `FHWeatherCore.view().intensity`:
- Sin lluvia: el 4×4 mantiene canal de 1 tile.
- Con lluvia: el 4×4 se inunda (4 tiles), presión/corriente mayor y MOV teórico x0.5 en superficie afectada.
- Tramos principales: la intensidad incrementa el factor de corriente, sin reducir el MOV de los caminos secos.

También se incluye `FHDrainage.randomExit(map, fromFloorIndex, fromItemId, rng)`, que **calcula** una salida aleatoria segura en cualquier otro tramo de drenaje del mapa, incluso en un piso o sector no conectado. No elige viviendas, calles ni otros tipos de área.

**IMPORTANTE:** Estas dos funciones son una preparación para el motor. En este PR **no se implementa todavía** arrastre efectivo de jugadores, estado de natación, activación del remolino en gameplay, efecto físico de presión/inundación en 3D, vertido de lluvia por respiraderos, iluminación diurna filtrada ni capacidades de natación de NPCs. La representación 3D es geométrica/visual y no sustituye la colisión o física del motor. Tampoco se añaden aún herramientas para puertas, pozos o respiraderos de acceso entre superficie y drenajes: eso requiere conectar los pisos al motor de tránsito de jugadores.

## Pruebas automáticas
```sh
node --test juego/assets/fh-drainage.test.js juego/assets/fh-drainage-services.test.js
node --test tests/fh-services-core.test.js
```

Cobertura: medidas y franjas de agua, giro y puertos, continuidad física, dirección de descarga, conexiones aisladas, remolino a sector remoto, clima, puentes, enlace a aguas residuales y compatibilidad con mapas históricos. Los tests y el workflow de GitHub Actions forman parte de este PR.

## Próximas etapas sugeridas
1. Crear accesos reales entre calle/edificios y alcantarillado, más rejillas/respiraderos e iluminación interior.
2. Asociar el clima a geometría/corriente dinámica y estado de MOV del motor.
3. Integrar natación, arrastre, colisiones y viaje por remolino sin teletransportes encadenados.
4. Conectar capacidades `puedeNadar` y `puedeEntrarAlDrenaje` al motor de NPCs existente, sin inventar otro subsistema.
