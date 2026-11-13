# Forest Horror · Comercio 02 — Corrección V2

Este ZIP sustituye al primer `Forest_Horror_Comercio_02_Tienda_Conveniencia.zip`, cuya entrega era defectuosa.

## Contenido
- `modelos_glb/`: 8 GLB reales, con **geometría 3D en metros**, Y vertical, Z frontal y base sobre Y=0.
- `miniaturas/`: 8 PNG RGBA de **320 × 320**, rasterizados **desde la geometría, UV y texturas de los GLB finales**, no dibujos independientes.
- `texturas_comercio/`: atlas Pixel Art originales de cada modelo.
- `hoja_miniaturas_comercio_02.png`: contacto para revisar visualmente.
- `catalogo_muebles.json`: medidas en pies y rutas relativas, con IDs `_c02` para **no sobrescribir** los modelos de Comercio 01.
- `generar_comercio_02.py`, `crear_miniaturas_desde_glb.py`, `validar_comercio_02.py`: fuentes y validaciones reproducibles (requieren numpy, Pillow y trimesh).

## Lo corregido frente a V1
1. La entrega anterior usaba colores sólidos en vértices: **no era textura Pixel Art**. V2 tiene un atlas 256×256 embebido en cada GLB, con sampler NEAREST.
2. Antes había geometría vertical en Z; V2 usa **Y vertical**, coherente con Three.js y el resto del proyecto.
3. Las miniaturas anteriores eran dibujos independientes. Las de V2 son rasterizadas desde el modelo 3D exportado.
4. Los IDs ahora terminan en `_c02` para evitar colisiones con Comercio 01.
5. La mercancía decorativa se resuelve mayoritariamente con texturas, para reducir triángulos.

## Alcance y límites
Son modelos visuales: **el ATM no ejecuta transacciones**, la caja no cobra por sí misma y los refrigeradores todavía no aplican reglas de inventario o consumo. No se modifica el motor, mapas, lógica de Hamazon, colisiones ni dinero.

## Regeneración
```bash
python generar_comercio_02.py
python crear_miniaturas_desde_glb.py
python validar_comercio_02.py
```
