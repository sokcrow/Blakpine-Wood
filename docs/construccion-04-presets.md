# Construcción 04 — edificios nativos, viviendas privadas y circulación común

## Flujo del editor

En **Zonas → Colocar edificio**, primero se elige **Ayuntamiento, Casas, Apartamentos o Tienda**, la cantidad de plantas (1–3) y si se activa **Simular obra durante la partida**. Después se extiende el contorno del edificio sobre el mapa, con medidas visibles en tiles y pies; el arrastre se detiene al máximo del preset. Antes de aplicarlo se muestra una confirmación, mientras el contorno permanece visible. La parcela se crea con un margen exterior de una casilla; el edificio ocupa exactamente la huella escogida, sin recortes silenciosos. La herramienta crea la parcela de forma automática con un nombre único (p. ej., **Apartamentos 1**) y, tras validar el espacio y el catálogo, inserta el edificio. También se conserva la opción antigua de generar en una parcela ya creada desde **Editar zona → Proyecto**.

El proyecto **Personalizado** sigue siendo manual. Las herramientas habituales del editor permiten mover, girar, eliminar y modificar **cada pared, puerta, habitación, escalera, mueble y punto de servicio** generado. No existe un único GLB monolítico ni una estructura decorativa bloqueada.

- Cada preset tiene un máximo técnico (en tiles): Ayuntamiento 22×16, Casas 19×16, Apartamentos 64×28 y Tienda 22×16. La interfaz muestra también las medidas en pies. El trazado nuevo **no puede superar su máximo**; la API rechaza tamaños excesivos. Se conserva una casilla exterior de margen en la parcela.

## Arquitectura y vivienda

- **Pared roja**: perímetro y losas, con puertas/ventanas que conservan el cierre arquitectónico.
- **Pared azul**: tabiques internos; las puertas sustituyen tramos de muro, no se superponen.
- **Apartamentos**: se generan **varias unidades por piso según anchura disponible** (no dos unidades rígidas). Cada unidad tiene un identificador persistente, una entrada propia desde un **pasillo común**, baño cerrado, recámara separada y sala-cocina conectadas. La zona de escaleras se mantiene fuera de las viviendas.
- Los pasillos y vestíbulos son comunes y no obligan a atravesar el departamento de otro vecino. Las escaleras entre plantas enlazan los IDs de pisos vecinos mediante el sistema nativo de niveles. Cada tramo de subida tiene **1×2 tiles**; el motor existente calcula el hueco solo en la media escalera que requiere paso y genera la bajada vinculada en la planta superior.
- El edificio se genera **planta baja primero, después las superiores**. Las paredes estructurales y tabiques alcanzan el siguiente nivel con una altura igual al desnivel real, evitando el vacío de 1 ft del primer generador.
- **Baños** compactos de menos de 3 × 3 tiles, con pared, puerta de interior inicialmente cerrada, inodoro, lavabo y metadato opcional `requiresClosedDoor`. Ese campo prepara la futura regla de privacidad de NPC; **aún no ejecuta automáticamente la conducta de uso del baño**.
- **Recámaras** privadas y separadas, de mayores dimensiones. **Sala y cocina** comparten habitación en este preset; una cocina separada sigue siendo posible mediante edición manual.
- **Casas** de uno o varios pisos con dormitorios, baños y escaleras. El costo adicional de una segunda planta sigue pendiente del sistema económico; no se inventaron tarifas.
- **Tiendas** con área de ventas, baño, almacén, registradora y exhibidores. **Ayuntamiento** con oficinas y baño.

## Posición de mobiliario y servicios

El posicionador usa las dimensiones **widthFt** y **depthFt** del catálogo GLB (convertidas con `feetPerCell`), acepta coordenadas fraccionarias, busca el anclaje sobre una pared, rota el frente hacia el interior, comprueba la huella tras rotación, mantiene acceso frontal libre y evita los giros sobre puertas. La cama evita ocupar el espacio cercano a las ventanas siempre que el plano lo permita. Si una habitación no admite el mobiliario con espacio de uso, la operación **falla por completo**, no lo inserta flotando o atravesando una pared.

Se colocan salidas de agua/drenaje cerca de los aparatos. Los enchufes eléctricos se **anclan a la pared estructural real**, conservan el identificador `wallId`, posición y orientación correctas; el editor vuelve a resolver el anclaje si fusiona o fragmenta el muro. Si no hay una pared adecuada, se rechaza el plano. **NO se generan redes eléctricas, fuentes ni conexiones de agua o drenaje ficticias**. Los diagnósticos de Construcción 02 pueden quedar en **No verificado** hasta conectar servicios reales.

## Parcelas, pisos y persistencia

Se conserva el esquema **`forest-horror-map-v1`**. Se añaden metadatos opcionales `constructionParcelId`, `constructionPhase`, `privateRoom`, `requiresClosedDoor` y `generatedPrefab: {version,preset,itemIds,floorIds,apartments}`. Cada vivienda mantiene `apartmentId` y una entrada de propiedad `source: 'zone', propertyRole: 'apartment', claimable: true` por piso, con `ownerId` vacío hasta que se reclame. La parcela contenedora del edificio tiene `propertyRole: 'building', claimable: false` y no suplanta los permisos de sus viviendas. Pasillos y escaleras son comunes y no se pueden reclamar como departamentos. **No se crean propietarios ni residentes ficticios.**

La colocación es **transaccional**: valida terreno ocupado, otros inmuebles, modelos ausentes, dimensiones mínimas y niveles; solo modifica el mapa si se pudo preparar todo. No regenera una parcela ya materializada para evitar destruir cambios manuales.

Los edificios generados **con anterioridad** a esta corrección conservan su geometría y propiedades tal como se guardaron: no se regeneran automáticamente para evitar borrar cambios manuales. Genera un **nuevo** preset para probar escaleras y parcelas corregidas.

Las plantas nuevas conservan `reference` y las cotas del editor. Si el piso superior ya existe con la elevación correcta, se reutiliza sin alterar sus elementos fuera de la huella seleccionada.

## Duraciones y límites actuales

El tiempo de obra usa los **minutos del reloj del juego** y una duración por preset, que aumenta al seleccionar más pisos. Es configurable mediante `FHConstruction.plan(...,{durationMinutes,stories})`; los mapas anteriores sin duración conservan el avance legado.

**Pendiente de completar:** si se marca **Simular obra**, las paredes y los muebles nativos aún aparecen completos en el motor desde el inicio, aunque el porcentaje y la valla de obra progresen. Falta integrar **render, colisiones y disponibilidad de piezas por fase**, y comprobarlo visualmente en navegador/móvil. Por eso **Construcción 04 sigue sin completar las obras progresivas**; corregir la generación de edificios no equivale a terminar la simulación de obra.

Tampoco se han agregado NPC obreros, alcaldes PJ/IA, gestión política, contratación, costo de construcción, ocupación automática de departamentos ni alquileres.

## Pruebas

- `node --test juego/assets/fh-construction-prefabs.test.js`: planos, dormitorios y baños, varias unidades por piso, puertas, corredores, frentes/huellas de GLB, pisos, escaleras, auto-parcela, servicios no inventados y rechazo transaccional.
- `node --test juego/assets/fh-construction.test.js`: estado y reloj de obras.
- Queda pendiente la prueba visual real en Three.js, móviles, navegación NPC real y estrés de edificios grandes.

No se agregan workflows, instaladores ni dependencias.