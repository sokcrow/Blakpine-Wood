# Acabados por cara y propiedades — Forest Horror

Implementación para el editor real \`index.html\`, sin cambiar \`forest-horror-map-v1\` ni volver a generar \`juego/assets/engine-00.js\` … \`engine-12.js\`. Los campos agregados son **opcionales**.

## Paleta

- **Roja (\`red_wall\`)**: sigue delimitando edificios y generando losas. El dueño por defecto se define en Proyecto → Propiedades y dueños, con dueño específico para cada edificio rojo.
- **Amarilla (\`property_wall\`)**: nueva pared de propiedad. Cuatro segmentos formando un contorno cerrado crean una propiedad editable por el \`ownerId\` asignado. Los contornos se recalculan desde los segmentos; puertas en estos límites conservan \`propertyBoundary\`. No genera losas.
- **Verde y restantes**: no cambian de función.

En **Proyecto → Propiedades y dueños** puedes asignar dueños; en el campo **Jugador de prueba** puedes simular sus permisos. Vacío significa creador/administrador. Este modo de prueba local **no es autenticación ni control de acceso de un servidor**: un cliente malicioso podría alterar el JSON. Para multijugador real, validar operaciones y propietario en el servidor con identidad autenticada.

## Pintura de paredes

Selecciona **Pintar cara** en Arquitectura, o una pared y usa **Pintar cara A** / **Pintar cara B**. La cara A está a la izquierda de la dirección del tramo \`a → b\` en el plano; la B, a la derecha. La textura de una cara no modifica la contraria. Desde el diálogo puedes previsualizar, copiar, pegar o aplicar el acabado a las caras colindantes de una habitación.

Los acabados \`wall.finish.A\` y \`wall.finish.B\` son independientes. Faltando uno, el sistema infiere el material por habitaciones existentes, espacios exteriores y el contorno rojo. Los muros que cruzan un límite de propiedad se dividen en piezas antes de pintarse y sus IDs quedan independientes.

## Pisos

Selecciona una habitación o área de piso y pulsa **Pintar piso**. Los pisos usan \`surfaceStyle\`; en las habitaciones puedes aplicar el mismo acabado a todas las habitaciones contenidas completamente en una propiedad. Los cambios se exportan e importan con el mapa.

## Tapices

Proyecto → **Diseñar tapiz**. Lienzo 16×16 o 32×32 píxeles, paleta fija de 16 colores y bordes opuestos sincronizados. Guarda PNG base64 en \`project.patterns[]\`. Validación: máximo 24 diseños y máximo 12 KiB por PNG; tamaños permitidos 16×16 y 32×32. Los PNG mantienen sus bytes intactos en la exportación y la importación.

## Texturas 3D y escala

**Una sola constante \`TEXEL_PER_FOOT = 8\`** en \`fh-style-property.js\`. Así un muro de 9 pies tiene 72 téxeles de alto y un cuadrado de 4 pies ocupa 32×32 téxeles: los patrones se repiten de forma uniforme sin desenfoque ni imágenes gigantes. \`NearestFilter\`, \`RepeatWrapping\`, sin mipmaps y con paleta limitada. El motor original se adapta en memoria en \`prepareGLBEngineDoc\`; no se cambia su \`pixelSize\` ni se reemplaza la detección de colisiones.

## Datos JSON (muestra mínima)

\`\`\`json
{
  "schema": "forest-horror-map-v1",
  "styleSystem": 1,
  "buildingOwnerId": "dueño_general",
  "buildingOwners": {"floor1_building_1": "dueño_edificio"},
  "properties": [
    {"id": "floor1_prop_1", "floorId": "floor1", "ownerId": "jugador123",
     "polygon": [{"x":2,"y":2},{"x":8,"y":2},{"x":8,"y":8},{"x":2,"y":8}]}
  ],
  "patterns": [{"id":"tapiz_azul","width":16,"height":16,"png":"data:image/png;base64,..."}]
}
\`\`\`

En \`floors[].items[]\`, pared: \`{"finish":{"A":{"preset":"ladrillo","color":"#96564C","pattern":null},"B":{"preset":"tapiz","color":"#8899AA","pattern":"tapiz_azul"}}}\`. Habitación: \`{"surfaceStyle":{"preset":"madera","color":"#846B52","pattern":null}}\`.

## Verificación

Ejecutar: \`node juego/assets/fh-style-property.test.js\`. Casos: contornos, dueño del edificio, cara A/B, habitación del jugador, derivación interior/exterior, patrón PNG, JSON de ida/vuelta, solapamientos inválidos y división de segmentos. El hook completo del motor 3D se comprobó contra los fragmentos originales Base64.

**Pendientes de comprobación manual:** pintar desde el navegador en dispositivos reales, rendimiento móvil en mapas grandes y comparación visual píxel a píxel del tapiz después de exportar/importar. El sistema de permisos incluye API y simulación local; el control de acceso autoritativo y la interacción de pintar desde un personaje en sesión multijugador requieren integrar los datos de sesión del juego.
