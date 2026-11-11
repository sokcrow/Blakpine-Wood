# Oscuridad y visibilidad entre niveles

La oscuridad dentro del mapa conserva el fragmento y la profundidad del material. La máscara FOW multiplica el color por su intensidad, incluido cero (negro), sin descartar el piso por falta de luz. El recorte de UV fuera del mapa y la transparencia propia de vidrios/sprites se conservan.

Las fachadas de otra planta requieren simultáneamente:

- Estar dentro del campo de cámara y superar el FOW horizontal existente.
- Si se mira desde un interior, atravesar una abertura exterior real de la planta actual.
- Tener un rayo libre de losa, tanto al subir como al bajar la mirada. Los recortes existentes de escaleras y patios se conservan.

Las capas de fachada y terreno exterior excluyen los niveles situados bajo PB. Esto no oculta la planta subterránea activa ni modifica las escaleras: impide tratar un sótano como terreno/fachada exterior visible desde arriba.

La comprobación de losas reutiliza `rayThroughExteriorOpening()` y los mismos `surfaceRectsMinusVoids()` que generan los suelos. Sus spans se calculan una vez por nivel en la vista 3D.

## Pruebas

`fh-floor-visibility.test.js` comprueba permisos de fachada, exclusión de sótanos, ventanas, puertas abiertas/cerradas y rayos bloqueados por losa o libres por un hueco.

`fh-preview-boot.test.js` ensambla el motor real y ejecuta el instalador FOW sobre un material Three.js. Comprueba negro sin descarte por oscuridad, conservación de `depthWrite`, `depthTest` y opacidad del piso, y los hooks de terreno/rayo entre niveles.

Estas pruebas de lógica, materiales y ensamblado no equivalen a una captura de la escena concreta del usuario. La comprobación visual en esa escena sigue pendiente.

No cambia el JSON del mapa, los archivos Base64 del motor, las colisiones, las alturas físicas ni los sistemas de electricidad e inventario.
