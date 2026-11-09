# Sombras — sprites iniciales

Este directorio contiene los archivos originales de los enemigos, organizados por entidad:

- `el_alto/idle.png` — El Alto. Origen: https://imgur.com/EtOrF6z
- `la_nina/idle.png` — La Niña. Origen: https://imgur.com/T0lfzmL

No existen todavía sprites de caminata, ataque ni ocho direcciones. No generar poses artificiales ni reemplazar los originales por ilustraciones de referencia.

## Uso en la vista 3D

`juego/assets/fh-shadow-visuals.js` expone `FHShadowVisuals.createManager()`, reutilizando `THREE.Sprite` y el registro compartido `FHActorVisibility` para conservar el campo de visión del motor. El adaptador en `index.html` deja disponible `window.FHShadowActors` durante el juego:

```js
const id = window.FHShadowActors.spawn('el_alto', piso, x, z);
window.FHShadowActors.move(id, piso, nuevaX, nuevaZ);
window.FHShadowActors.despawn(id);
```

El generador de criaturas y las decisiones de IA todavía deberán invocar estas funciones cuando estén implementados; este paso **no crea apariciones automáticas**. La navegación real sigue a cargo del motor/GOAP existente; `move` únicamente actualiza la representación en el piso indicado. Las alturas visuales por defecto son provisionales y pueden especificarse al crear una entidad.
