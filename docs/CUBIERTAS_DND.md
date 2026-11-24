# Cubiertas de D&D

En **⚙ Niveles → Configurar cubierta**, la configuración corresponde a la cubierta sobre el nivel seleccionado.

- **Automática según reglamento:** en D&D, una casa sin continuación en la planta superior recibe un tejado a dos aguas. Si continúa arriba con una huella menor, el retranqueo queda como balcón o terraza plana. Cada casa separada se resuelve por su propia huella. En Blakpine/Legacy la opción automática permanece plana.
- **Azotea o balcón plano:** fija una cubierta plana, también en D&D.
- **Tejado a dos aguas:** fija el tejado inclinado ya disponible, con altura y orientación de cumbrera y color de tejas.

La opción automática permite configurar tanto la cumbrera como el pretil de los balcones. Los patios se conservan abiertos y el encuentro con la planta superior no añade un pretil contra su pared.

Los niveles nuevos creados en contexto D&D usan automático. Los mapas con cubiertas guardadas explícitamente como planas conservan esa elección: para adoptar el estilo D&D, cambia su tipo a **Automática según reglamento** y guarda el mapa. Un mapa sin configuración de cubierta adopta el valor del reglamento al ejecutarse.

La configuración sigue siendo opcional dentro de `forest-horror-map-v1`, con `roof.shape: "auto"`. No se migran paredes ni losas. La tapa final sólo se añade a la copia del motor, igual que antes. El guardado de la partida mantiene su identidad y el editor no recibe pisos artificiales.

Esta entrega no modifica el reloj, la duración del combustible ni los sistemas de iluminación.
