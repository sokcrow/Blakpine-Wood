# Blakpine Wood · Texto vivo (motor 3D)

Módulo: `juego/assets/fh-live-text.js` · Cadenas: `fh-live-text-strings.js`

## Presentaciones

- `notice(text, ms)`: aviso blanco, sin recuadro ni bloqueo.
- `showDialogue({text, speaker, kind, mood, segments, pages})`: caja narrativa rectangular (`event`) o NPC redondeada (`npc`), con nombre dentro; bloquea el movimiento mientras esté abierta.
- El Typewriter reserva todas las letras ocultas en una capa con el mismo diseño de glifos que la capa visible; el contenedor no crece cuando se revela el texto.
- La flecha inferior aparece al terminar de escribir. Clic/toque, E, espacio, Intro o flecha abajo completan o avanzan el texto. Pulsar una primera vez durante la escritura lo revela entero.
- Las frases largas se dividen automáticamente sin perder el texto ni los segmentos emocionales.

## Autoría opcional

Los efectos existentes `type: "say"` siguen siendo compatibles. Para diferenciar un NPC de una narración pueden llevar propiedades **opcionales**:

```json
{
  "type": "say",
  "text": "No abras esa puerta. ¡CORRE!",
  "speaker": "Guardabosques",
  "kind": "npc",
  "segments": [
    {"text": "No abras esa puerta. ", "mood": "miedo"},
    {"text": "¡CORRE!", "mood": "grito"}
  ]
}
```

Estados emocionales admitidos: `normal`, `miedo` (temblor persistente), `grito` (oscilación vertical), `impacto` (segmento de aparición inmediata). Al no especificar hablante ni tipo, el texto `say` se interpreta como narración.

Por ahora no hay campos gráficos dedicados a `speaker/mood/segments` en el inspector del editor; se preservan como metadatos opcionales si existen en los efectos del JSON. No se modificó el esquema `forest-horror-map-v1`.

## Texto espacial y sonidos

`FHLiveText.soundAt({id, x, y, z, floor, text?, range?})` recibe coordenadas **Three.js**, no casillas del editor. La audibilidad se calcula con distancia 3D y la palabra espacial solo se dibuja si la fuente también supera la prueba de visibilidad del motor y cae dentro de la cámara. No atraviesa paredes ni otros pisos.

Los efectos `playSound` existentes pasan su posición al módulo. IDs reconocidos: `drawer_open`, `fabric_rustle`, `tv_static`, `knock`, `door_knock`, `glass_break`, `crack` y `dragging`. Los textos visibles correspondientes están en `fh-live-text-strings.js`.

La llegada de un pedido Hamazon llama a `knockAt` y produce tres golpes separados por 440 ms desde la puerta elegida. Solo se muestra el aviso si el jugador está dentro del alcance auditivo. Los golpes son sintetizados por Web Audio; el navegador puede bloquearlos si aún no ha permitido audio.

## Integración y pruebas

`index.html` agrega el módulo al documento del motor al iniciar la prueba 3D. Los archivos `engine-00.js` a `engine-12.js` no se alteraron. La lógica del juego permanece en el motor; el editor solo inserta el adaptador.

Ejecutar: `node --test juego/assets/fh-live-text.test.js`

**Integración del repartidor:** las conversaciones de mirilla, pago y entrega conservan sus botones de decisión, ahora con nombre de NPC, cuadro redondeado y el Typewriter compartido. Los botones se habilitan al terminar la frase; pulsar E, espacio, Intro o flecha abajo completa la escritura y después E enfoca la primera opción.

**Pendiente de comprobar en navegador real:** apariencia final en móviles, audio permitido o bloqueado y sincronía visual en distintas resoluciones. Los controles avanzados del editor para emociones siguen pendientes.
