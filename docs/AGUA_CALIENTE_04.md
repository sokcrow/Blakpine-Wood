# Blakpine-Wood — Agua 04: Calderas y circuito caliente

## Objetivo
Agregar agua caliente funcional **independiente del agua fría**, reutilizando los recorridos de tuberías por paredes y montantes verticales de Agua potable 01. Mantener mapas `forest-horror-map-v1` y no activar ducha/WC jugable.

## Modelos de Agua 02

El ZIP `Forest_Horror_Agua_02_Calderas.zip` contiene ocho GLB originalmente **solo visuales**:

| ID | Tipo | Tratamiento en Agua 04 |
|---|---|---|
| `calentador_domestico_vertical` | Calentador | Calentamiento eléctrico y reserva potable configurable |
| `calentador_domestico_horizontal` | Calentador | Calentamiento eléctrico y reserva potable configurable |
| `caldera_residencial_mediana` | Caldera | Calentamiento eléctrico y reserva potable configurable |
| `caldera_industrial_grande` | Caldera | Calentamiento eléctrico y reserva potable configurable |
| `tanque_expansion` | Accesorio | Solo visual |
| `bomba_recirculacion` | Accesorio | Solo visual; no simula presión |
| `colector_tuberias` | Accesorio | Solo visual |
| `panel_control_caldera` | Accesorio | Solo visual |

**Los cuatro calentadores son los únicos que producen agua caliente.** Su producción requiere entrada fría conectada, equipo activo y electricidad proveniente de la red existente. Las calderas *no* generan ni contratan agua.

Los parámetros de equilibrio de juego **no vienen especificados en el pack original**: capacidad, llenado, temperatura objetivo, tasa de calentamiento, potencia y longitud máxima de tubería son valores iniciales configurables, no cifras industriales verificadas.

## Circuito
1. `water_main` / cisterna / tinaco → tubería fría existente.
2. Una `water_outlet` próxima al calentador permite **llenar** su reserva.
3. El calentador activo y con corriente eleva la temperatura hacia el objetivo, según `heatCPerMinute`. Al apagarse, el agua almacenada se enfría gradualmente.
4. La salida `hotNetworkId` se enruta por paredes y por montantes automáticos, pero solo conecta a tomas `water_outlet` con `hotWaterEnabled=true` o modelo `toma_agua_doble`.
5. Una toma caliente puede abastecer lavabos, fregaderos, bañeras y regaderas próximos (máximo radio existente de la toma). No conecta automáticamente WC o mingitorios.
6. Una conexión no equivale a agua caliente disponible: requiere reserva a la temperatura mínima. El estado informa `connected`, `hotWater`, `sourceId`, `temperatureC`, `feet`.
7. La longitud de tubería caliente se mide separadamente de la fría, uniendo los tramos compartidos de la misma red sin duplicarlos.

No hay conversión automática de agua fría a caliente por proximidad: un calentador sin suministro frío o una toma sin tubería caliente no funciona.

## Editor
En **Agua → Calderas y agua caliente**, seleccionar uno de los cuatro calentadores o sus accesorios.
Los calentadores se guardan como objetos `misc` con `modelId` real y un campo opcional
`service.waterHeating=true`. Los demás objetos históricos permanecen sin calentamiento.

El inspector permite configurar capacidad, reserva inicial, temperatura objetivo, velocidad de calentamiento, llenado, alcance de la red y los IDs de ambas redes.
Las `water_outlet` incluyen un selector de toma doble y el diagnóstico de agua caliente.

El overlay del editor usa **azul** para tuberías frías y **naranja** para calientes.
Solo los tramos `pipeVisibility='visible'` se dibujan en 3D; los empotrados no generan malla jugable.
No se introducen nuevas colisiones, luces ni shaders.

## Persistencia
`GameState.services.hotWater['floorId:itemId']` guarda `liters` y `temperatureC`.
El motor conserva los valores durante guardados sin crear un segundo reloj.
`FHServices.tick(dt,1)` usa 1 segundo real = 1 minuto del juego.
La prueba de calentamiento utiliza minutos de juego; no acelera el reloj.

## API para futuras interacciones
- `FHServicesRuntime.hotWaterStatus(f,item)`: consulta sin consumir.
- `FHServicesRuntime.hotWater.draw(f,item,litros,strict)`: consume agua almacenada y registra litros; **no está asociada todavía a ducha ni WC**.
- `FHServicesRuntime.hotWater.diagnostics()`: informes de calderas, tuberías y disponibilidad.

## Pruebas automáticas
```bash
node --test juego/assets/fh-water-hot.test.js
node --test juego/assets/fh-water-potable.test.js
node --test tests/fh-services-core.test.js
```
CI: `.github/workflows/agua-caliente-04.yml`. Además, revisar visualmente editor y gameplay en móvil y escritorio antes de fusionar.

## Pendientes de esta rama
**Assets GLB/PNG:** aunque el ZIP original está disponible para su inspección, los binarios no están incorporados al repositorio. El selector muestra los IDs y dimensiones reales y el cargador conserva la representación procedural en vez de intentar descargar archivos inexistentes. No considerar completada la integración visual hasta incorporar los originales a GitHub.

**Fuera de alcance:** gas natural, combustible para calderas, presión física, válvulas termostáticas, temperaturas de ducha/WC, animaciones o beneficios de PS/PE/humor.
