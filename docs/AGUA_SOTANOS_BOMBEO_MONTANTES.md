# Blakpine-Wood — Agua de sótanos, montantes y bombeo

## Objetivo
Resolver la distribución de agua fría y caliente desde sótanos hacia plantas superiores, sin inventar escasez municipal ni cambiar el esquema `forest-horror-map-v1`. Los campos nuevos son opcionales.

## Suministro municipal y reservas
- `water_main` representa la red municipal. Mientras el contrato esté activo, no tiene un contador ficticio de litros disponibles ni una cuota máxima por día.
- La cisterna (`water_cistern`) y el tinaco (`water_tinaco`) tienen **litros reales**. El llenado gradual desde una entrada municipal conectada respeta `fillLpm` y `capacityLiters`.
- Los valores predeterminados anteriores permanecen: cisterna 2,500 L y 30 L/min; tinaco 1,100 L y 20 L/min. `initialLiters` sigue siendo configurable y por defecto es 0.
- Al suspenderse el contrato, una reserva con litros sigue disponible hasta consumirse, según sus rutas y la configuración de elevación. No se crea ninguna escasez aleatoria.
- Los litros actuales persisten en `GameState.services.waterTanks['floorId:itemId']`.
- El alcance de una ruta sigue limitado por `rangeFt`; no se ha introducido simulación de presión física.

## Conectar plantas
1. En **Agua → Modelos de agua**, activar **Red potable automática por paredes y pisos**.
2. Si las paredes de plantas consecutivas están alineadas, el motor crea montantes automáticos, tanto desde cotas negativas (sótanos) como hacia pisos altos.
3. Para un montante manual, colocar una toma `water_outlet` en cada nivel consecutivo y escribir el mismo **Montante entre plantas (ID compartido)**, por ejemplo `escalera-norte`, en el inspector de ambas tomas.
4. Las dos tomas de un montante manual deben pertenecer al mismo edificio, estar en plantas consecutivas y quedar separadas horizontalmente **15 pies como máximo**, por defecto. No se vinculan tomas de edificios con IDs diferentes.
5. El circuito frío respeta `networkId`. El caliente respeta `hotNetworkId` **por separado**. Para recibir caliente, habilitar **Toma doble (fría y caliente)** y conectar un calentador con agua fría y electricidad.
6. Las rutas diagnosticadas se reflejan en el editor y las tuberías marcadas como visibles se renderizan en 3D, incluidos los montantes manuales con desplazamiento horizontal.

## Elevar agua desde una cisterna
1. En **Agua → Modelos de agua**, activar **Exigir bomba para elevar reservas de agua desde niveles inferiores** (`plumbing.requireLiftPump=true`).
2. Colocar una cisterna en el sótano, un tinaco en un piso más alto y un accesorio **Bomba de recirculación** próximo a la cisterna.
3. Seleccionar la bomba y activar **Usar como bomba de elevación desde una cisterna**. El modelo de recirculación conserva su uso visual anterior cuando no se activa esa opción; no se añadió un GLB nuevo.
4. Ajustar `pumpFlowLpm` (30 L/min), `pumpInletRangeFt` (15 pies), `pumpRangeFt` (240 pies), `networkId` y `pipeLeadFt` según el trazado.
5. La bomba necesita alimentación real desde un circuito/breaker existente. Con electricidad, mueve litros de la cisterna al tinaco sin fabricar agua; se detiene si no tiene corriente, si la cisterna está vacía o si el tinaco está lleno.
6. Durante un corte municipal, una bomba alimentada eléctricamente puede elevar la reserva existente. El tinaco conserva sus litros durante un apagón y puede abastecer consumidores por gravedad. No se introdujo un sistema nuevo de economía ni de presión física.

**Compatibilidad:** los mapas antiguos que no activen `plumbing.requireLiftPump` mantienen su comportamiento anterior de elevación lógica entre plantas. No se exige actualizar todos los mapas existentes ni se cambia la versión del JSON.

## Diagnósticos
- **Sin toma de agua fría cercana:** falta una toma potable local al equipo.
- **Sin ruta fría desde la toma al suministro:** hay toma, pero no se encuentra camino conectado.
- **Toma fría sin suministro:** existe la ruta, pero la fuente no puede entregar agua (por ejemplo, contrato suspendido y reserva agotada).
- **Sin toma doble cercana para agua caliente:** no hay una toma habilitada para caliente junto al consumidor.
- **Sin ruta caliente:** revisar `hotNetworkId`, montantes y trazado por paredes.
- **Bomba sin corriente o circuito:** comprobar breaker y alimentación de ese equipo.

## Pruebas
- `node --test juego/assets/fh-water-potable.test.js`
- `node --test juego/assets/fh-water-hot.test.js`
- `node --test juego/assets/fh-water-lift.test.js`
- `node --test tests/fh-services-core.test.js`
- CI: `.github/workflows/agua-caliente-04.yml`.

Queda pendiente la revisión visual del editor y gameplay en móvil y escritorio antes de fusionar. No se han cambiado drenaje, colisiones, FOW, atributos del personaje ni economía.
