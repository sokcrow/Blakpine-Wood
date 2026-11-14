# Bosques y relieve — motor v1

La configuración es opcional dentro de `forest-horror-map-v1`. Un mapa sin
`environment`, o con `enabled:false`, conserva su terreno anterior. Se activa desde
**Bosque y relieve** en la barra del editor. No se modifica el formato del mapa.

```json
{
  "environment": {
    "enabled": true,
    "version": 1,
    "terrain": {
      "seed": "blakpine-relieve-1",
      "amplitudeM": 1.2,
      "wavelengthM": 65,
      "transitionM": 8,
      "meshStepM": 1.5
    },
    "forest": {
      "seed": "blakpine-bosque-1",
      "density": 0.65,
      "spacingM": 5,
      "sectorM": 24,
      "snow": false,
      "exclusions": []
    }
  }
}
```

Las semillas se conservan en el JSON; no se usa `Math.random`, el reloj ni la
cámara para generar árboles. Los IDs incluyen la versión del algoritmo, la
semilla forestal y la celda candidata. Cambiar el algoritmo requerirá una nueva
versión explícita. Los parámetros se normalizan dentro de límites acotados.
Se rechazan más de 250 000 celdas forestales o 1 000 000 de celdas de relieve
antes de construir geometría.

## Terreno y reservas

`fh-terrain.js` calcula ruido espacial independiente para el relieve. Sus
consultas interpolan los mismos triángulos que se dibujan, no otro campo de
alturas aproximado. La malla se divide en bloques de hasta 16 × 16 celdas.

Las reservas leen polígonos de `properties` y `locationZones`, incluidas sus
listas de polígonos, superficies, edificios, habitaciones, pasillos, objetos
rotados, tramos y accesos. Las calles incluyen la banqueta configurada. Se
protegen también las proyecciones de estructuras y escaleras de otros niveles.
La protección no depende de que el motor de propiedades pueda reconstruir un
edificio. Alrededor de construcciones y calles se mantiene una franja plana de
**15 ft (4.572 m)** en todas las direcciones, medida desde el borde exterior,
incluidas las esquinas. En calles se mide desde el borde de la banqueta
configurada. Después de esa franja comienza la transición gradual del relieve.
La malla conserva un margen adicional ligado a su resolución para impedir que
la interpolación introduzca pendientes dentro de los 15 ft. Esta franja sólo
afecta al relieve: no amplía las exclusiones de árboles ni convierte esa
superficie en una reserva para Construcción. La elevación original de cada
planta permanece intacta.

La malla natural respeta los recortes originales de `surfaceRectsMinusVoids`,
incluidos escaleras, patios heredados y drenajes; no rellena sus aberturas. El
jugador, su cámara, linterna y el NPC repartidor siguen la altura del suelo.

## Recursos y representación

El pack completo proporcionado se conserva en
`forest-horror/biblioteca/vegetacion/`: 12 GLB, miniaturas, atlas y manifiesto.
`catalogo_vegetacion.json` y `fh-forest-catalog.js` contienen la misma metadata.
Los GLB usan pies: **una unidad del GLB equivale a 0.3048 m**. Por ejemplo, el pino
alto mide 19.812 m. Esta conversión se aplica a la geometría del bosque y no
modifica `fh-glb-bridge.js` ni la escala de los muebles.

Predominan pinos altos, oscuros, jóvenes y delgados. Los nevados sólo participan
si el autor habilita `snow` para un entorno compatible; no se modifica ni se
consulta la simulación de clima. Un abedul verde constituye una variante
secundaria de baja frecuencia. Los otros modelos permanecen disponibles en el
catálogo del pack.

Cada especie se descarga una vez y se representa con `InstancedMesh` por sector.
Geometría, materiales y texturas se comparten. Los límites espaciales incluyen
las copas y alturas para permitir el descarte por cámara en Three.js r128.
Se conserva el filtrado de textura por vecino más cercano. No se añade oclusión
forestal adicional ni dependencias.

El FOW original continúa enmascarando los materiales, con la transformación de
cada instancia incluida en el cálculo de posición mundial. El bosque no añade
otra máscara de oscuridad.

## Colisión, visión y retirada

El radio del tronco se obtiene de la base de cada GLB, separado del ancho de
copa. La colocación respeta las reservas con margen de copa; los movimientos y
rayos sólo utilizan el tronco circular. `ForestShared.solidAt` y
`ForestShared.sightRayDistance` siguen siendo las consultas de colisión y visión
compartidas. Sus candidatos forestales proceden del índice por sectores.
La planta se transmite explícitamente para NPC y observadores CCTV; un árbol
de PB no se convierte en un obstáculo de otra planta.

La API `window.ForestHorrorEnvironmentAPI` expone:

| Operación | Resultado |
| --- | --- |
| `removeTree(id)` | Retira una vez; actualiza representación, consultas y guardado |
| `getTree(id)` | Árbol activo o `null` |
| `heightAt(x,z)` | Altura del suelo en metros de escena |
| `slopeAt(x,z)` | Pendiente en grados |
| `vegetationAt(x,z,r=0)` | Troncos que intersectan el círculo consultado |
| `reservedAt(x,z,r=0)` | Zona, infraestructura o límite reservado |
| `evaluateConstruction({x,z,w,d},maxSlope=5)` | Reserva, árboles, pendiente, alturas y requisitos de preparación |

Las coordenadas de esta API se expresan en metros. La evaluación devuelve
`requiresClearing`, `requiresLeveling` y `available`; no concede permisos ni
inicia obras. La presencia de árboles indica desmonte pendiente, no una zona
permanentemente prohibida.

La partida guarda únicamente el delta:

```json
{"environment":{"removedTreeIds":["forest-v1:semilla:columna:fila"]}}
```

El mapa original no se edita por talar. El editor puede seleccionar un tronco en
su previsualización y añadir su ID a `forest.exclusions`. Las exclusiones sí son
parte del diseño y participan del historial de deshacer/rehacer y del JSON.

## Integración y comprobación

El adaptador forestal se compone al final, después de servicios, arquitectura,
PG, barreras y CCTV. Se conserva la corrección del anclaje visual de
Construcción ya incorporada en `main`, junto con sus pruebas de regresión.
No cambian las reglas de Construcción, supervivencia ni miedo.

Pruebas reproducibles, sin workflows nuevos:

```sh
node --test juego/assets/fh-terrain.test.js juego/assets/fh-forest.test.js juego/assets/fh-forest-visuals.test.js juego/assets/fh-forest-engine-hook.test.js
node --test juego/assets/fh-preview-boot.test.js
node --test juego/assets/fh-npc-doors-integration.test.js juego/assets/fh-glb-bridge.test.js juego/assets/fh-construction.test.js juego/assets/fh-construction-rooms.test.js juego/assets/fh-construction-room-rebuild.test.js
node tests/forest-browser.cjs
```

La prueba de navegador requiere Playwright y un Chromium disponibles en el
entorno de pruebas. `CHROMIUM_PATH` permite seleccionar un ejecutable existente.
No se añade esa dependencia al juego. La prueba verifica el editor, el arranque
del documento realmente ensamblado, los 12 GLB en metros, la compilación de
materiales instanciados y la retirada con recarga de estado.

**Pendiente de validar:** ejecución visual WebGL y rendimiento en dispositivos
móviles físicos. El entorno de esta entrega impidió lanzar Chromium por su
restricción de sockets; el navegador compartido tampoco alcanzó el servidor
local. Las pruebas de geometría, estado y composición no sustituyen esa
validación. El objetivo sigue siendo 60 FPS, sin garantía de resultado.

Fuera del cambio: mecánicas de tala, inventario de madera, costes, nivelación,
cimentaciones, empleos, GOAP, economía, suministros, combate y clima. No se crean
workflows ni se publica un despliegue de producción.
