# Forest Horror — Arquitectura 01+02 · Hotfix de puertas y perillas

El kit contiene **ocho modelos GLB estructurales de una casilla**: seis puertas individuales y dos ventanas. Se mantienen las medidas del mapa (5 pies por casilla; GLB en metros), el esquema `forest-horror-map-v1` y la carga con `GLTFLoader` local.

## Catálogo

| Modelo | Uso |
|---|---|
| `puerta_madera.glb` | Puerta opaca de madera |
| `puerta_metal.glb` | Puerta opaca metálica |
| `puerta_mirilla.glb` | Puerta con mirilla |
| `puerta_cristal_simple.glb` | Cristal sencillo |
| `puerta_cristal_antipanico.glb` | Cristal con barra antipánico |
| `puerta_cristal_tintada.glb` | Cristal tintado |
| `ventana_clasica.glb` | Ventana clásica |
| `ventana_dividida.glb` | Ventana dividida |

Las tres puertas opacas tienen perillas y placas físicas simétricas en frente/dorso, sin una perilla pintada que aparezca invertida. El marco es `MARCO_FIJO` y la hoja usa `HOJA_PIVOTE`.

## Puertas dobles: dos puertas individuales, ningún GLB doble

Una puerta doble ocupa dos casillas. El motor crea **dos grupos de bisagra**, ambos con el mismo estado de apertura, cerradura y colisión. El adaptador visual instancia **dos copias del mismo GLB de puerta sencilla**:

- Primera hoja en la posición y orientación del motor.
- Segunda hoja en el extremo opuesto, con **+180° en su orientación base**.
- Apertura hacia el **mismo lado del muro**: el ángulo de la segunda hoja se aplica con signo inverso.
- Cada hoja se coloca sobre su bisagra correspondiente. Las hojas se ajustan visualmente para **tocarse en el centro** del vano, sin modificar bisagras ni colisiones.
- **Solo se conservan el dintel y las dos jambas exteriores** del marco original del motor. No se clona ningún marco GLB para la puerta doble; por tanto, no existe poste intermedio.
- Dos puertas sencillas separadas por una pared en **T** continúan siendo dos puertas independientes, cada una con su marco completo. No se crea ni registra un modelo doble.

El ajuste de giro se aplica en `patchEngineDoc` al documento HTML generado para la vista 3D. No se reescriben los archivos `engine-00.js` a `engine-12.js`.

## Opciones del editor y compatibilidad

Las puertas de cristal o escaparate admiten el campo opcional `architectureSkin` con las tres variantes; sin selección, usan cristal sencillo. Las ventanas conservan `windowSkin` opcional, con valor por defecto `clasica`.

El motor original conserva llaves, mirilla, colisiones, visibilidad/FOW, luz, guardado y estados de puerta. Si un GLB falla al cargar, se mantiene el aspecto provisional y se informa el error.

## Recursos y verificación

- `modelos_glb/`: ocho modelos.
- `texturas/`: atlas PNG de 128 × 128 con filtrado NEAREST.
- `miniaturas/`: ocho imágenes de catálogo.
- `catalogo_arquitectura.json`: metadatos; ninguna entrada representa una puerta doble.
- `hotfix_perillas.sha256`: 18 archivos del ZIP con huellas SHA-256 exactas.
- `generar_kit.py`, `generar_kit_cristal.py` y generadores de miniaturas: reproducción del kit.

Pruebas de Node: `node --test juego/assets/*.test.js`. GitHub Actions reconstruye con dependencias fijadas, verifica los hashes y publica los activos en la rama del hotfix.

La inspección visual dentro de una partida WebGL real y el rendimiento móvil siguen requiriendo una comprobación manual.
