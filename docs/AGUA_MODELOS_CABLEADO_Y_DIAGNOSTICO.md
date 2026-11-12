# Blakpine-Wood — Reparación GLB y redes de agua

## Qué está arreglado en esta rama

- **No se coloca Mueble libre.** En categoría **Agua** aparecen `Caldera / calentador GLB` y `Equipos de caldera GLB`. Al tocar la herramienta se elige uno de los **8 modelos originales** con miniatura y dimensiones. El objeto guardado es `water_boiler` o `water_boiler_aux`, con su `modelId` del ZIP. Los calentadores existentes guardados como `misc` + `modelId` conservan su función y reciben su GLB.
- **Cisterna y tinaco** siguen siendo `water_cistern` / `water_tinaco`, con sus dos GLB originales.
- **Electricidad directa:** los 4 calentadores y los accesorios que consumen energía buscan por sí solos el breaker/circuito alcanzable a través del trazado de paredes. No requieren enchufe, `outletId`, ni conexión manual. El circuito elegido se diagnostica en inspector junto con su longitud en pies.
- **No se inventa modelo 3D:** si el GLB no carga, el motor muestra un error de recurso en la consola; no dibuja la caja de «Mueble libre» para esconderlo.
- **Tuberías en el editor:** en la categoría **Agua** se dibujan en azul las rutas frías y en naranja las calientes. Se muestra la ruta eléctrica directa en ámbar. Los tramos empotrados están incluidos en el plano; en la vista de juego su malla 3D sigue oculta por diseño. Se puede poner `pipeVisibility:'visible'` para mostrar tubos en 3D.

## Por qué no aparecen tuberías

En el editor de Agua, el mensaje indica casos como los siguientes:

| Mensaje | Causa y corrección |
|---|---|
| **RED POTABLE DESACTIVADA** | En *Modelos de agua*, activar la red automática |
| **SIN TUBERÍAS** | Falta entrada pública o una `water_outlet` conectada sobre las paredes |
| **SIN TUBERÍA CALIENTE** | Falta una toma doble habilitada para agua caliente |
| **SIN RUTA CALIENTE** | La red caliente, paredes o montantes no ofrecen un camino entre caldera y toma |
| **SIN CIRCUITO DE BREAKER** | No hay un circuito eléctrico al alcance del equipo, por las paredes |
| **CIRCUITO SIN CORRIENTE** | Hay cable instalado pero el breaker o suministro no está activo |
| **SIN TOMA DE AGUA FRÍA / TUBERÍA** | La caldera no puede llenarse; necesita la toma potable conectada |
| **CALENTANDO O SIN RESERVA CALIENTE** | La caldera está conectada pero todavía no hay agua caliente disponible |

**Importante:** el mapa dibuja trayectos **reales calculados**. No se dibuja una tubería falsa cuando dos equipos están físicamente desconectados. Los montantes requieren paredes alineadas entre pisos y las redes deben pertenecer al mismo edificio.

## Archivos originales
En este PR están los siguientes recursos de los ZIP del autor:
- `forest-horror/biblioteca/agua/calderas/modelos_glb/` — 8 GLB
- `forest-horror/biblioteca/agua/calderas/miniaturas/` — 8 PNG
- `forest-horror/biblioteca/agua/almacenamiento/modelos_glb/` — 2 GLB
- `forest-horror/biblioteca/agua/almacenamiento/miniaturas/` — 2 PNG

La publicación fue hecha mediante una tarea de GitHub Actions que **regenera los mismos bytes originales y verifica SHA256** de los 20 archivos. No se ofrecen instaladores locales.

## Pruebas antes de fusionar
- `node --test juego/assets/fh-water-equipment.test.js`
- `node --test juego/assets/fh-water-storage-catalog.test.js`
- `node --test juego/assets/fh-water-hot.test.js`
- `node --test juego/assets/fh-water-potable.test.js`
- `node --test juego/assets/fh-services-engine-hook.test.js`
- `node --test tests/fh-services-core.test.js`
- Verificar visualmente los GLB y las rutas en la vista 3D.

No se modificó drenaje, baño/WC, economía ni atributos del personaje.
