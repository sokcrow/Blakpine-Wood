# Reglas de juego — DnD

> **Documento rector del modo DnD.** Se complementa conforme el Director elige edición, libros y reglas aplicables. Distingue **prototipo actual** de **reglamento aprobado**.
>
> **Identificador técnico:** `dnd`. DnD no es Legacy con un D20 añadido ni Moon con dados. Su resolución, estadísticas y economía de acciones pertenecen exclusivamente a DnD.

## 1. Identidad y alcance

- **Juego:** DnD, con sus propias reglas de dados, modificadores, defensas, tiradas, recursos y acciones.
- **Ambientación principal:** fantasía medieval. Herramientas, viviendas, castillos, caminos, transporte, oficios y fuentes de iluminación deben provenir del perfil de mundo DnD elegido.
- **Edición y libros aplicables:** **PENDIENTE DE DECISIÓN DEL DIRECTOR**. No declarar conformidad con una edición específica mientras no se elija.
- Las reglas de éxito y fallo no se derivan de `Hit % - EVA %`, PE, Fear & Hunger ni de monedas Moon.

## 2. Resolución DnD

### Estado actual verificado en código (prototipo, no edición completa)

El módulo `juego/rules/dnd/fh-dnd-combat.js` contiene una evaluación de ataque **parametrizable**:

- Tirada de ataque por defecto de **D20**; `tirada + bonus >= defensa` determina impacto en el prototipo.
- Daño de demostración por defecto **1D4**, ajustado con bono y resistencia configurables y limitado a la vida restante.
- **Ataque básico con coste 0**: no gastar PE Legacy ni un recurso de energía inventado para acertar o fallar.
- **Sin cooldown artificial de un minuto** para reemplazar la economía de acciones.
- Campos antiguos como `energy`, `energyCost` y `lastPlayerMinute` pueden persistir **solo por compatibilidad con guardados DnD v1**; no autorizan coste o bloqueo de ataque.
- El coordinador mantiene identidad de acción (`actionId`), autorización y **aplicación única**; no transforma reglas DnD en cálculos Legacy.
- El alcance/contacto se consulta en el motor de Sombras/espacio actual, **sin una segunda física o navegación**.

**Estos valores son un prototipo de prueba; no son una definición de DnD por el Director.** El estado DnD debe seguir aislado de atributos, habilidades y recursos Legacy.

### Reglas DnD pendientes de acordar

| Apartado | Decisión necesaria |
| --- | --- |
| Edición y suplementos | Edición exacta, libros y variantes autorizadas |
| Personajes | Atributos, clases, niveles, competencia, progresión |
| Pruebas | Tipos de tirada, modificadores, dificultad, éxito/fallo, especiales |
| Combate por turnos | Iniciativa, encuentro, rondas, orden y fin de turno |
| Economía de acciones | Acción, acción adicional, reacción y movimiento según edición |
| Ataques y defensas | Alcance, armas, armaduras, críticos, ventaja/desventaja si aplica |
| Recursos y descanso | Vida, capacidades, espacios y recuperación conforme a la edición |
| Magia y estados | Conjuros, concentración, duraciones, efectos y salvaciones |
| Criaturas y muerte | Fichas, IA durante turnos, incapacitación y reglas de muerte |
| Guardado e interfaz | Persistencia de encuentros, turnos, recursos y HUD correspondiente |

**Prohibido completar esos vacíos con reglas de Blakpine o Moon**, o atribuir al prototipo una edición que no se ha elegido.

## 3. Mundo, recursos naturales y excepciones

- Configuración predeterminada: asentamientos medievales/fantásticos, materiales, vías, alimentos, armas y oficios autorizados para el escenario.
- Iluminación habitual: velas, antorchas, faroles de aceite, braseros y fuentes mágicas **si el perfil elegido las permite**. La ausencia de electricidad moderna por defecto no implica ausencia de toda forma de tecnología o magia.
- **Eberron es una excepción de ambientación configurable:** puede incluir magitecnología e infraestructura especial, pero **no presupone** automáticamente enchufes domésticos estándar, red eléctrica moderna, internet, teléfonos o potencias equivalentes a Blakpine. Cada dispositivo y fuente debe definirse en el perfil aprobado.
- El motor universal aporta relieve, montañas, ríos, biomas, vegetación, cuevas, minas, geología, luz, clima cuando exista, colisiones, visibilidad y navegación. DnD define qué materiales, especies, objetos y recursos se colocan, no crea otro motor físico.
- El reloj físico existe para el mundo, pero eso **no concede al personaje conocimiento exacto de la hora** sin medio diegético autorizado.

## 4. Fronteras de implementación

**Propiedad de DnD:** tiradas y reglas de éxito, iniciativa, acciones, daño DnD, estadísticas, progresión, conjuros, estados, equipo y persistencia privada DnD.

**Propiedad del motor común:** geometría, movimiento real, contacto, colisión, visibilidad, fuentes físicas de luz, navegación, estructura de puertas y mapas.

**No permitido:** usar `FHSkills.roll` como resolutor DnD; usar PG/PS/PE Legacy como representación interna DnD; gastar PE en ataques por conveniencia; fabricar cooldowns en vez de turnos; usar Power/Coin Power; mover actores atravesando obstáculos por decisión del adaptador; aplicar daño dos veces.

La combinación técnica con una demo moderna utilizada durante la integración **no convierte DnD en un juego moderno**, ni autoriza intercambiar reglamentos entre juegos. El uso de mapas de demostración debe reconocerse como **limitación técnica temporal**.

## 5. Evidencia actual y estado

- Implementación: `juego/rules/dnd/fh-dnd-combat.js`, `fh-dnd-engine.js`, `fh-dnd-save-adapter.js`, el coordinador y el selector.
- Registro oficial: `contratos/multimodo/ejemplos/reglas/dnd.json`, marcado `implemented` para el **adaptador existente**, no para DnD completo.
- Informe de etapa: `docs/ETAPA3_4_COMBATE_DND.md`. Sus valores iniciales de demo no son reglas definitivas de edición.
- **Pendiente:** iniciativa y controlador completo de rondas/turnos, edición y contenido medieval jugable. El perfil medieval declarativo no equivale a mapa 3D completado.
- Los ejemplos cruzados de perfiles/reglamentos que existen por motivos de pruebas estructurales **no son combinaciones de juego autorizadas**. Su bloqueo real en el selector requerirá un cambio independiente; este documento no modifica el runtime.

## 6. Cómo añadir una regla DnD

Anotar en esta ficha: **edición/libro/fuente autorizada, condición, dados y modificadores, economía de acciones, resultados, excepciones, estado propietario, persistencia, interfaz y pruebas**. Clasificarla `APROBADA`, `IMPLEMENTADA Y PROBADA` o `PENDIENTE`. No anunciar una capacidad como operativa por estar escrita aquí.

**Orden permanente:** DnD conserva su propio reglamento y usa únicamente las capacidades físicas universales del motor.
