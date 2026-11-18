# PLANO DEL DIRECTOR — Modos de juego, perfiles de mundo y fronteras del motor

> **Documento rector del proyecto Blakpine Wood.** Se dirige al Director que asigna órdenes a las IA implementadoras. No es una explicación al jugador ni certifica que los perfiles de mundo ya funcionen.
>
> **Regla de precedencia:** las decisiones explícitas del Director sobre modo, escenario y edición prevalecen sobre defaults. Nunca sustituir una decisión faltante con una mecánica importada de otro modo.

## 1. Mandato principal

**Tenemos UN motor 3D, NO un único reglamento ni un único catálogo de mapas.** La partida define su reglamento de combate y sus mecánicas; el perfil de mundo y mapa define la época, la tecnología, los props permitidos, las recetas y los servicios. Compartir renderizado, colisión o luz no autoriza mezclar celulares, antorchas, PE, hechizos ni infraestructura eléctrica.

**Cada nueva orden debe declarar:**
1. `rulesetId` (Legacy/Blackpine, DnD, Moon o capacidad universal).
2. Perfil de mundo, subperfil o excepción autorizada.
3. Capa responsable (motor, reglamento, mundo/mapa, UI).
4. Contenido permitido y bloqueado.
5. Contrato de datos y pruebas de compatibilidad.

Si un dato indispensable no está acordado, **queda PENDIENTE**, sin inventar mecánicas para cerrar una etapa.

## 2. Plano de arquitectura

```text
NUEVA PARTIDA
    |
    +-- REGLAMENTO -------- Legacy | DnD | Moon
    |       |               estadísticas, tiradas/monedas, daño,
    |       |               acciones, magia/habilidades, recursos
    |       |
    +-- PERFIL DE MUNDO --- Moderno | Medieval | Distopía | Excepción autorizada
    |       |               tecnología, arquitectura, economía,
    |       |               iluminación, recetas y catálogo de props
    |       |
    +-- MAPA / BIOMA ------ bosque, montaña, río, ciudad, cueva, ruina...
    |       |               geometría compartida + assets/variantes permitidas
    |       |
    +-- INTERFAZ ---------- información y objetos que puede consultar el jugador
    |                       reloj/celular/magia, HUD, inventario
    |
    +-- SESIÓN Y GUARDADO - mapId + characterId + rulesetId + versión + ranura
    |
    +-- MOTOR UNIVERSAL --- Three.js, render, colisión, navegación,
                            visibilidad, luz física, tiempo interno,
                            interacción espacial, IA base
```

**La misma función de luz ilumina una habitación moderna con foco eléctrico, una taberna con vela y un edificio Moon con panel luminoso.** Son **fuentes y requisitos diferentes**, no tres motores de iluminación.

### Fronteras estrictas

| Capa | Se hace cargo de | No debe hacer |
|---|---|---|
| Motor universal | Mapa 3D, geometría, colisiones, raycast, navegación, visión, propagación visual de luz, reloj interno, coordenadas, sonido, interacción, soporte de NPCs y ciclo del mundo | Elegir reglas de combate, asumir electricidad o declarar qué objeto existe |
| Adaptador de reglamento | Estadísticas, tiradas, modificadores, daño, iniciativa, acciones, magia, efectos y recursos **de ese modo** | Duplicar colisiones, navegador, física, visión o reloj global |
| Perfil de mundo | Época, disponibilidad tecnológica, biomas, arquitectura, mobiliario, infraestructura, recetas, fuentes de energía, interacción cultural | Importar mecánicas de combate de otro reglamento |
| Perfil de UI | HUD, inventario y acceso a información según objetos/capacidades del personaje | Mostrar información del motor que el personaje no tiene modo de conocer |

**Universalidad espacial:** montaña, roca, árbol, follaje, río, cueva, mina, relieve y paredes son capacidades reutilizables. Pero textura, especie, material, mobiliario, enemigos, construcción y tecnología se eligen por **perfil y bioma**. Un sistema común de puertas no hace que todas las puertas tengan cerradura electrónica.

## 3. Tres modos: identidades intransferibles

| Propiedad | Blackpine Horror / Legacy | DnD | Moon System |
|---|---|---|---|
| Reglamento | Fórmulas y atributos Legacy (PG, PS, PE, Hit, ATQ, RST, EVA, etc.) | Dados y reglas de **edición/libros DnD autorizados** | Mecánicas y monedas propias del sistema Moon |
| Ambientación base | **Moderna, 2000–2016** | **Medieval fantástica** | **Distopía futurista** |
| Electricidad convencional | Sí | **No por defecto** | Sí |
| Iluminación característica | Focos, linternas, alumbrado y aparatos eléctricos | Antorchas, velas, aceite, braseros, magia, piedras o flora luminosa permitidas | Neón, paneles, electricidad e iluminación futurista |
| Comunicación | Celular de época, telefonía, PC, internet según año/servicio | Cartas, mensajeros, señales, conjuros u objetos mágicos | Celular/comunicador y redes de su escenario |
| Consulta de hora | Reloj y celular si están disponibles | Sol, campanas, reloj mecánico/solar o magia; sin hora exacta omnisciente por defecto | Relojes y dispositivos digitales |
| Edificación/servicios | Casas, tiendas, oficinas, energía, gas, drenaje y redes modernas | Villas, castillos, tabernas, fogones, pozos, establos, talleres y magia | Megaciudades, corporaciones, automatización e infraestructura futurista |
| Interfaz propia | Objetos y aplicaciones modernas de su periodo | Equipo y herramientas diegéticas medievales/fantásticas | Interfaces y herramientas futuristas |

**Prohibido trasladar PE al ataque básico DnD**, traducir la economía de acciones a cooldown de un minuto o usar las tiradas DnD en Legacy/Moon. En Moon no implementar monedas «como DnD» ni daño Legacy por conveniencia.

### Excepciones y alcance

- **Eberron** puede habilitar *magitecnología* **solo si el perfil Eberron está elegido**. Eso no equivale automáticamente a electricidad doméstica convencional, celulares, PC o internet. Sus objetos y fuentes mágicas deben configurarse como tales.
- Otros escenarios y épocas solo se habilitan con **perfil explícito aprobado**; el modo no autoriza todo el contenido de todos los mapas.
- El celular es una **mecánica particular de Blackpine y Moon**, con diferencias entre ellos. En Blackpine un teléfono de 2002 no tiene por defecto las mismas aplicaciones que uno de 2016.
- El motor calcula minuto exacto para NPCs, iluminación y eventos. **Que el motor conozca la hora no implica que el jugador DnD pueda leerla**. La precisión visible depende de observación, reloj, campanario o magia disponible.
- No confundir **HUD técnico de combate** con **dispositivo diegético**. Mostrar HP no autoriza inventar un smartphone medieval.

## 4. Compatibilidad predeterminada de mundo y reglamento

| Ruleset \ Perfil de mundo | modern-2000-2016 | medieval-fantasy | future-dystopia | Otros |
|---|---|---|---|---|
| Legacy | **Default válido** | No automático | No automático | Requiere aprobación |
| DnD | No automático | **Default válido** | No automático | Eberron u otro perfil autorizado |
| Moon | No automático | No automático | **Default válido** | Requiere aprobación |

**«No automático» significa que el Director debe definir y validar una excepción antes de permitirlo.** No se deben invalidar ni modificar mapas `forest-horror-map-v1` antiguos retroactivamente: cualquier nuevo perfil exige defaults compatibles y estrategia de transición.

**Defecto vigente conocido:** la Etapa 3.4 arranca DnD sobre una **demo de ciudad moderna** porque es el mapa que se utilizó para comprobar el puente de combate. **Eso NO equivale a un mundo medieval DnD, ni demuestra un filtro de tecnología.** Corregirlo requiere una orden de perfiles y contenido del mapa; no afirmar que ya existe.

## 5. Catálogo de objetos: función universal, tecnología propia

| Capacidad compartida | Blackpine | DnD | Moon |
|---|---|---|---|
| Dar luz | Foco, lámpara conectada, linterna | Antorcha, vela, farol de aceite, piedra mágica | Panel lumínico, neón |
| Mantener fuente activa | Red/batería, interruptor | Aceite, cera, madera, efecto mágico | Red/batería y sistemas propios |
| Preparar alimentos | Estufa moderna | Fogón, horno de leña | Cocina futurista |
| Conservar alimentos | Refrigerador eléctrico | Despensa fría, salazón, hielo o magia | Refrigeración avanzada |
| Construir | Obras y materiales modernos | Herramientas, albañilería y materiales medievales | Construcción industrial/futurista |
| Obtener hora | Reloj/celular | Sol/campanas/reloj de época/conjuro | Terminal/reloj digital |
| Enviar mensaje | Telefonía o internet | Mensajero/carta/conjuro | Red/comunicador futurista |

Todo prop debe tener **capacidad funcional** + **requisitos tecnológicos/materiales** + **perfiles que lo permiten**. El motor ofrece interacción; el catálogo decide si el objeto existe. Los NPCs, economía y recetas de obra solo deben referenciar recursos del perfil del mundo.

## 6. Contrato de inicio de partida (flujo obligatorio)

1. Seleccionar `rulesetId` y verificar adaptador **implementado**; si está `planned`, no iniciar como si fuera funcional.
2. Seleccionar `worldProfileId` y excepciones autorizadas, si las hay.
3. Validar la combinación reglamento/perfil; no inferir compatibilidad por compartir motor.
4. Seleccionar `mapId` y validar catálogo, props, energía, iluminación, bioma y recetas de ese mapa.
5. Crear sesión y clave de guardado multimodo; conservar aislamientos de estadísticas y versión.
6. Cargar adaptador propio del reglamento; nunca usar Legacy como fallback silencioso.
7. Montar UI contextual; mostrar solo la información que se ha autorizado al jugador.
8. Ejecutar motor espacial común; no añadir renderizadores, colisiones o navegaciones específicas por reglamento.

**Contrato editor/motor:** preservar `forest-horror-map-v1`, con nuevos campos **opcionales y defaults** que no rompan mapas existentes. El editor expone parámetros; el motor aplica reglas. No introducir v2 sin orden explícita y plan de migración.

### Propuesta de metadatos, NO implementada

```json
{
  "extensions": {
    "blakpine.world-profile.v1": {
      "worldProfileId": "medieval-fantasy",
      "technologyProfileId": "medieval-standard",
      "contentProfileId": "dnd-medieval"
    }
  }
}
```

El ejemplo **no es un esquema aprobado ni un campo operativo del JSON actual**. Primero verificar cómo se validan las extensiones y qué default aplicaría a mapas antiguos.

## 7. Ficha que debe rellenar el Director ANTES de ordenar cambios

```md
# ORDEN DEL DIRECTOR — [objetivo verificable]
Base: main · Repositorio: sokcrow/Blakpine-Wood
Modo: [legacy | dnd | moon-system | universal]
Perfil de mundo y excepción: [modern-2000-2016 | medieval-fantasy | future-dystopia | aprobado]
Propietario: [motor | ruleset | mundo/mapa | UI]
Comportamiento requerido: [...]
Objetos, tecnologías y fuentes de energía autorizadas: [...]
Objetos/reglas explícitamente prohibidos: [...]
Edición/libros o contrato de reglas: [nombre concreto | PENDIENTE]
Archivos y contratos verificados: [...]
Compatibilidad requerida: [mapas v1, guardados, Legacy, DnD, Moon]
Pruebas: [positivas del modo, negativas contra contaminación, regresión]
Entrega: [commit/PR GitHub, merge si corresponde, pruebas realmente ejecutadas]
No hacer: instaladores locales, esperar workflows, reglas inventadas, motor duplicado.
```

### Rechazo automático de órdenes y PRs

- **DnD consume energía Legacy para ataques normales**, o usa `Hit% - EVA%` → RECHAZAR.
- **DnD usa cooldown artificial por minuto** para sustituir turnos → RECHAZAR.
- **Mapa medieval recibe enchufe, foco, celular, PC o refrigerador eléctrico** solo porque el motor lo soporta → RECHAZAR.
- **Moon o Legacy heredan reglas de combate DnD** sin autorización → RECHAZAR.
- **Jugador DnD ve hora exacta** porque el motor sabe el minuto → RECHAZAR.
- **Se duplica colisión, visibilidad, navegación, reloj o fuente de verdad** → RECHAZAR.
- **Se rompe compatibilidad con `forest-horror-map-v1`** sin migración explícita → RECHAZAR.
- **Se marca `implemented` o PASS sin prueba del comportamiento prometido** → RECHAZAR.

## 8. Estado actual frente a próximas órdenes

**Hecho en código:** el motor común, los puentes Legacy y DnD, D20 básico y persistencia multimodo; esta corrección quita coste de energía y cooldown arbitrario del ataque DnD. **No equivale a reglas DnD completas.**

**Pendiente de otra orden DnD:** decidir edición, implementar economía de acciones, iniciativa, turnos, perfiles de criaturas, magia, clases, equipo y muerte conforme a esa edición. No inventar valores antes de elegir el reglamento.

**Pendiente de otra orden de mundo:** perfil medieval operativo, assets, iluminación no eléctrica, recetas de construcción y validador de compatibilidad mapa/modo; conservar demos y mapas v1.

**Pendiente Moon:** reglamento propio y perfil futurista implementados, sin heredar combate de los otros modos.

**Cierre obligatorio del implementador:** criterios de aceptación cumplidos; pruebas exactas realmente ejecutadas; límites sin verificar; qué NO se tocó; enlace a commit o PR publicado y estado real de fusión.

**Regla final del Director:** *el motor determina qué se puede simular; el reglamento y el mapa determinan qué puede existir y cómo funciona en esa partida.*
