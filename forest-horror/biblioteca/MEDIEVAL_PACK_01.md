# Pack Medieval 01 — muebles low-poly y pixel art

**Contenido:** ocho modelos GLB 2.0 autocontenidos con atlas RGBA de 64×64 integrado, texturas en modo NEAREST y miniaturas PNG transparentes de 112×112.

| Modelo | Tamaño (ancho × fondo × alto, pies) |
| --- | --- |
| `barril_madera_medieval` | 2.5 × 2.5 × 3.1 |
| `tonel_bodega_medieval` | 5.1 × 3.4 × 3.7 |
| `banco_largo_medieval` | 6 × 1.6 × 1.75 |
| `arcon_reforzado_medieval` | 3.6 × 2.2 × 2.4 |
| `cama_paja_medieval` | 3.4 × 6.4 × 1.8 |
| `estanteria_madera_medieval` | 4.5 × 1.65 × 6.1 |
| `mesa_taberna_medieval` | 6.2 × 3 × 2.8 |
| `armario_rustico_medieval` | 4.2 × 2.3 × 6.3 |

## Uso e integración

- El archivo `catalogo_muebles.json` existente registra el pack con identificador `medieval_01` y etiquetas `medieval`, `fantasia`.
- Geometría en metros (0.3048 m por pie), eje Y vertical; coordenadas próximas al suelo y centro de la planta en X/Z.
- `banco_largo_medieval` utiliza el tipo existente de asiento múltiple (`sofa`); `cama_paja_medieval` usa `bed`; `mesa_taberna_medieval` usa `dining` y una superficie superior.
- Barriles, toneles, arcones, estanterías y armarios son visuales por ahora. **No tienen lógica de inventario, apertura o animación**.
- Sillas, mesas y camas anteriores quedan intactas; el filtro por ambientación corresponde a un trabajo independiente.
- El atlas está **incrustado dentro de cada GLB** para evitar rutas o materiales externos.

Para regenerar todos los archivos desde la raíz del repositorio: `node tools/generate-medieval-furniture.cjs`. El generador no tiene dependencias externas.
