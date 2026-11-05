# Pavimentos y estacionamientos — Forest Horror

Este cambio amplía el editor publicado en `index.html` sin sustituir la arquitectura del juego ni cambiar el esquema `forest-horror-map-v1`.

## Pavimentos pintables

En **Áreas y accesos** están disponibles: **asfalto, callejón manchado, banqueta, concreto, grava, adoquín, baldosa, alfombra y madera**. Permanecen los tipos anteriores `pavement`, `parking`, `grass` y `dirt`. Cada superficie es un rectángulo con coordenadas en casillas; se puede dibujar encima de otra superficie. La última área pintada gana la superposición visual y la selección en el editor.

En 3D las superficies tienen texturas pixel art de 32×32 con repetición en escala física y `NearestFilter`. Se respetan `surfaceStyle`, los patrones ya exportados y las reglas de propiedades. Los materiales nuevos se consideran áreas visuales: **no producen colisión**.

## Marcas del estacionamiento

Abre la categoría **Estacionamiento**. Están disponibles:

- **Cajones N:** ancho de 9 pies y largo de 18 pies por defecto; cantidad de 1 a 100, separación en pies, rotación, número inicial, prefijo y una lista de posiciones accesibles (por ejemplo `1,3`).
- **Flecha de circulación**, **cebra peatonal**, **doble línea amarilla**, **línea discontinua**, **reductor de velocidad pintado** y **guarnición/banqueta pintada**.
- Tras elegir una herramienta aparece la configuración; también se puede reabrir desde **▤ Marcas** en la barra. Toca el mapa para colocar el primer centro del conjunto.

Cada marca es un item `parking_decal` con `decalKind`, `x/y` (centro), `w/h` en casillas, `rotation`, `widthFt/lengthFt` para mostrar los tamaños, `color`, y si corresponde, `number` y `accessible`. Todos los decals tienen `blocksMovement:false` y nunca se registran como muros ni como muebles. El texto y los símbolos se generan una sola vez en un canvas y se usan tanto en 2D como en un `CanvasTexture` en Three.js.

Los decals 3D son planos con `MeshBasicMaterial`, `NearestFilter`, `depthWrite:false`, `polygonOffset` y una elevación local inicial de **0,064 metros**, por encima de las superficies de suelo. No se altera `pixelSize`, la FOW, los controles ni las reglas de colisión.

## Coche de tamaño correcto

En la categoría **Muebles → Coche**, los coches **nuevos** miden **6×15 pies** (ancho y largo), equivalentes a **1,2×3 casillas** con la escala de 5 pies/casilla. El motor original ya utiliza los valores `w/h` del JSON para dimensionar el modelo.

Los coches **existentes** del mapa se mantienen en su tamaño guardado; no se ejecuta una migración que altere silenciosamente un mapa anterior. El inspector permite ajustar manualmente su tamaño.

## Demo de aceptación 8/4

En **Proyecto → ▤ Demo: 8 cajones y 4 coches**, acepta reemplazar los objetos **sólo del piso actual**. La demo coloca:

- Una superficie `asphalt` bajo el estacionamiento.
- Ocho `parking_decal` de tipo `stall`, numerados del 1 al 8, de 9×18 pies.
- Cuatro `car` centrados en los primeros cuatro cajones, de 6×15 pies.
- Un punto de aparición `spawn` para **▶ Probar 3D**.

La cuadrícula debe tener al menos 16 columnas y 12 filas y usar la escala predeterminada de 5 pies/casilla para que la distribución de ejemplo quepa sin ajustes. Con otras escalas se deben ampliar columnas/filas según las dimensiones físicas. La demo no altera los otros pisos.

Después prueba **▶ Probar 3D** y **Proyecto → Exportar JSON**; al volver a importarlo, el mismo `items[]` conserva las posiciones, tamaños, tipos, números, colores y rotaciones.

## Ejemplo mínimo de decal

```json
{
  "id": "slot_01",
  "type": "parking_decal",
  "decalKind": "stall",
  "x": 1.7, "y": 6.8,
  "w": 1.8, "h": 3.6,
  "widthFt": 9, "lengthFt": 18,
  "rotation": 0,
  "number": "1",
  "accessible": false,
  "color": "#F3EFDC",
  "blocksMovement": false
}
```

## Verificación realizada

- `node juego/assets/fh-parking.test.js`: **33/33** verificaciones de medidas, fila de ocho cajones, números, accesibilidad, separación, rotación, cuatro coches y JSON de ida y vuelta. Incluye una prueba del mismo canvas de dibujo utilizado por 2D y 3D y del offset del plano sin escritura de profundidad.
- `node juego/assets/fh-style-property.test.js`: **23/23** verificaciones existentes de acabados y propiedad.
- Comprobación sintáctica del código del editor y los módulos JavaScript. También se comprobó que el puente del motor 3D acepta los hooks esperados sin modificar los fragmentos Base64.

**Pruebas pendientes:** abrir la web en navegador real para inspeccionar las marcas y el rendimiento de la escena en dispositivos móviles. Esta comprobación no equivale a una captura visual real ni a una medición de 60 FPS.

## Archivos sin modificar

No se modifican los fragmentos `juego/assets/engine-00.js` … `engine-12.js`, los modelos GLB, los mapas preexistentes en `forest-horror/maps/`, el sistema de colisión y visión compartido ni la lógica del multijugador.
