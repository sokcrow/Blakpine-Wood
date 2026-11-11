# Creador de calles — primera entrega

## Uso en un mapa existente

1. Abre **Categorías → Calles** en el editor.
2. En **Configurar calle**, elige 2, 4 o 6 carriles o un reparto personalizado. Ida se lee desde el primer punto al segundo; vuelta circula al contrario. Se circula por la derecha.
3. Ajusta ancho de carril y banquetas en pies y velocidad en km/h. Con la escala habitual, una casilla son 5 pies. Guarda la configuración.
4. Elige **Trazar calle** y marca dos puntos de su eje, mediante dos toques o un arrastre. Se ajusta al eje horizontal o vertical predominante. La calzada y ambas banquetas deben caber en el mapa (hasta 120 × 120 casillas).
5. Cruza otro tramo perpendicular para formar una T o un cruce de cuatro accesos. Las banquetas se abren en la calzada y las marcas se interrumpen en la intersección.
6. Selecciona **Alto** o **Semáforo** y toca dentro del cruce. Guarda duración del alto o tiempos y desfase del semáforo. Solo puede existir un control de prioridad por intersección.
7. **Límite** vincula una velocidad y un sentido al tramo tocado; **Paso peatonal** coloca la cebra; **Entrada / salida IA** marca el extremo más cercano del tramo. Un límite es un punto de cambio para la futura simulación: no cambia retroactivamente todos los carriles.
8. Pulsa **Revisar red** para ver cruces sin control, señales huérfanas, tramos aislados y solapes paralelos.
9. Con **Seleccionar**, toca una calle o un control y usa **Editar configuración**. Para mover una calle, cambia los extremos en ese formulario. El arrastre y los atajos de giro/duplicación se deshabilitan para estos elementos para evitar desajustar la red.
10. Guarda o exporta tu mapa normalmente. Deshacer y rehacer incluyen las operaciones viales. Borrar una calle borra sus controles dependientes en la misma operación reversible.

No hay una herramienta que borre o sustituya tu mapa para generar una demo. Se añaden elementos al piso que estás editando. **Revisar red** se aplica a ese piso.

## Datos y representación

- Se conserva `forest-horror-map-v1`. No se cambia la versión del mapa.
- Una calle usa un item `asphalt` con el campo opcional `road`. Sus coordenadas son la esquina superior izquierda de la calzada, igual que las otras superficies del editor.
- `road` contiene versión interna 1, eje `x/y`, signo `1/-1`, carriles de ida/vuelta, ancho en pies, banqueta en pies y velocidad en km/h.
- Los controles usan items `misc` sin colisión y el campo opcional `roadControl`. Los controles de tramo guardan `roadId`, sentido y posición proporcional. Los controles de cruce guardan las referencias de las calles y el identificador de su intersección.
- `FHRoads.topology()` deriva carriles dirigidos, cruces y continuaciones por extremos coincidentes. Todavía no es un planificador de rutas ni conecta cada giro entre carriles.
- Una textura por piso reproduce la red vial en editor y vista 3D, con un máximo de 2048 píxeles por lado y caché de dos texturas. Las señales se muestran como marcadores planos; no son todavía postes o semáforos modelados.
- Los mapas anteriores sin estos campos no se convierten ni se reescriben. Los controles y cruces se calculan por piso; una calle sobre otra en diferente piso no crea una intersección.
- Los tramos paralelos superpuestos se diagnostican y no se fusionan. Para prolongar una calle, comparte exactamente los extremos de sus ejes. Al mover calles, revisa nuevamente los controles de cruce; los controles de tramo siguen su posición proporcional.

## Reglas preparadas para la simulación

- Alto: primero quien llegó, después turnos horarios entre accesos ocupados; duración configurable y cruce libre.
- Semáforo: verde horizontal, amarillo horizontal, todos en rojo, verde vertical, amarillo vertical, todos en rojo. Tiempos configurables y desfase para coordinación.
- Carriles: izquierda, recto y derecha habilitados como valores iniciales; sin vuelta en U. Las restricciones específicas por giro quedan pendientes de su herramienta.

## Alcance pendiente

Esta entrega **no** implementa automóviles manejables, tráfico o peatones con IA, selección de destino, sincronización multijugador, combustible, cajuela, asientos, faros, luces de freno o direccionales. Tampoco añade rampas vehiculares, curvas ni guarniciones con colisión. Los semáforos guardan configuración, pero todavía no cambian de luz ni regulan vehículos; no tienen todavía conexión eléctrica.

La siguiente etapa debe consumir estos datos en el motor con carriles y giros conectados, derecho de paso, ocupación de intersecciones y detección de obstáculos. La lógica de tráfico pertenece al motor, no al editor.

## Verificación

- `node --test juego/assets/fh-roads.test.js`: geometría, sentidos, límites, cruces, controles, contrato real del mapa, formularios y representación 3D con objetos de prueba.
- `node --test juego/assets/*.test.js`: tras integrar `main` en d171923, 703/707 pruebas aprobadas. Los cuatro fallos (contratos de visibilidad y luz natural, escalones de PS y fixture de supervivencia sin `fhFear`) se reprodujeron en un checkout limpio de ese mismo `main`; no son regresiones de calles. Las 21 pruebas viales pasan. El resultado anterior a esa actualización fue 698/698.
- Se inspeccionó una imagen producida por el mismo pintor de calles.
- **NEEDS WORK en validación interactiva:** Chromium local no pudo arrancar por la restricción de sockets del entorno. El navegador compartido no alcanzó el servidor local y bloqueó la apertura de archivos locales. Quedan pendientes la prueba con mouse/táctil, la captura de la interfaz completa, el recorrido 3D en navegador y la medición de FPS en móvil.

No se modificaron los fragmentos Base64 del motor, el sistema eléctrico, las reglas de azoteas/visibilidad, el inventario, los personajes ni mapas del usuario.
