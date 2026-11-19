# Reglas de juego — Blakpine Wood

> **Documento rector del modo Blakpine Wood.** Es una guía que se complementa conforme el Director aprueba reglas. No es un listado de funciones ya verificadas ni una autorización para cambiar código por sí sola.
>
> **Identificador técnico actual:** `legacy`. Este ID conserva compatibilidad con el repositorio; **Blakpine Wood es un juego con reglamento propio**, no un reglamento genérico del que deriven DnD o Moon System.
>
> **Prioridad:** las decisiones explícitas del Director sobre este juego prevalecen sobre propuestas, demos y ejemplos de combinaciones anteriores. La implementación real debe comprobarse en la rama modificada.

## 1. Identidad y alcance

- **Juego:** Blakpine Wood, horror, exploración, supervivencia e interacción con el entorno.
- **Ambientación principal:** moderna o semimoderna, aproximadamente **2000–2016**. Equipos, celulares, comunicaciones y servicios se configuran según el año, sitio y disponibilidad; no se presume que un objeto de 2016 existiera en 2000.
- **Reglas de juego:** propias de Blakpine. Se utilizan **mecánicas inspiradas en Fear & Hunger en determinados casos**, cuando el Director lo haya especificado. Esa inspiración no autoriza copiar automáticamente todas las reglas de otro juego.
- **Frontera:** ni D20 de DnD ni Power/Coin Power de Moon son fórmulas de Blakpine. No existe una capa de éxito común que convierta unas en otras.

**Ningún modo es variante, extensión o fallback de otro.** Los ejemplos de selección multimodo del repositorio son antecedentes técnicos, no permiso para cruzar reglamentos.

**Exclusividad de unidades (APROBADA):** las Sombras, su IA/GOAP, comportamiento, habilidades, recursos, aparición, botín y condiciones de ataque son **contenido exclusivo de Blakpine Wood** (`legacy`). No se transfieren a DnD ni a Moon aunque ambos usen las capacidades del mismo motor físico. Los NPC y enemigos de cada modo deben pertenecer a su catálogo autorizado. Compartir movimiento, contacto, visión o pathfinding **no** permite trasladar entidades concretas; no transformar una Sombra en criatura DnD cambiando estadísticas. Toda excepción narrativa debe autorizarla expresamente el Director.

## 2. Responsabilidades propias de Blakpine

### Estadísticas y recursos

El proyecto ha definido o discutido estos conceptos propios del juego: PG (puntos de golpe), PS (sanidad; en el runtime pueden representarse como `sp`), PE (energía), Hit, ATQ. F., ATQ. S., RST. F., RST. S., RST. M., EVA, MOV, PA, Vis, Mood y Fear.

- **No asumir que todos los atributos citados están implementados o activados en todos los actores.** Verificar código, estado, interfaz y pruebas antes de dar una regla por operativa.
- **No reducir este reglamento a una sola fórmula** de acierto, evasión o daño: distintas interacciones pueden tener condiciones y tiradas específicas.
- Las tiradas existentes de habilidades de `FHSkills` pertenecen a Blakpine; aunque alguna use monedas, **no son el combate Moon System**.
- Mantener diferenciados recursos del jugador, recursos de criaturas, desgaste estructural y estados de ánimo/miedo. No pagar costes de una criatura con PE del jugador.

### Sistemas propios y decisiones todavía abiertas

| Área | Regla de dirección | Estado |
| --- | --- | --- |
| Resolución de combate | Conservar las operaciones y restricciones originales comprobadas; no sustituirlas por DnD ni Moon | Implementación parcial existente; auditar por acción |
| Habilidades y pruebas de éxito | Aplicar solo las condiciones y resultados definidos para Blakpine | Existen tiradas; catálogo completo a documentar |
| Supervivencia | PG/PS/PE, necesidades y estados donde estén integrados | Verificar cada sistema; no inferir completitud |
| Miedo, sanidad y Sombras | Sus estímulos, drenajes y decisiones pertenecen a Blakpine | Rutas Legacy existentes; auditar antes de ampliar |
| Construcción y daño estructural | Consultar geometría común y delegar daño al propietario de estructuras | Integración compartida, reglas por material pendientes de aprobación |
| Economía, empleos, comercio, inventario | Usar contenido del periodo y reglas particulares del juego | Según implementación; sin importar valores de otros modos |

**No introducir una tirada genérica de éxito para todos los juegos** ni declarar como norma una fórmula que no se haya aprobado para esa acción concreta.

## 3. Mundo y tecnología de Blakpine

- Configuración principal: poblaciones, bosques, instalaciones, viviendas, calles y servicios compatibles con la época elegida (2000–2016).
- Electricidad, drenaje, agua, calefacción, telefonía e internet son **infraestructuras configurables**, no garantías de disponibilidad en cualquier edificio.
- Cámaras, computadoras, celulares, vehículos y electrodomésticos requieren modelos, servicios e interacciones acordes al lugar y año.
- Montañas, relieve, vegetación, biomas, rocas, cuevas, minas, ríos y agua pertenecen al **motor natural compartido**. Blakpine configura especies, distribución, recursos y apariencia; no implementa otra colisión, relieve o navegación.
- Un objeto tiene capacidades físicas compartidas, pero sus recetas, consumo, tecnología, acceso y consecuencias en gameplay deben respetar este modo.

## 4. Frontera estricta con el motor y otros juegos

**Puede consultar:** posiciones, contacto, altura, pendientes, superficies, visibilidad, iluminación, navegación, objetos y estados físicos ofrecidos por el motor universal.

**Debe resolver por cuenta propia:** éxito y fracaso de acciones, daño, recursos, miedo, habilidades, supervivencia, progresión y efectos propios de Blakpine.

**No puede:** importar estadísticas DnD/Moon; duplicar geometría, colisión o visión; ejecutar daño dos veces; editar directamente el mapa para representar una tirada; sobrescribir el guardado de otro modo.

Conservar `forest-horror-map-v1`, sus unidades y mapas existentes. Para la integración real, respetar el ciclo intención → autorización → resolución del propietario → aplicación única → notificación, sin convertir `combat:damage` en otra fuente de daño.

## 5. Evidencia técnica y límites

- Código relevante para inspeccionar: `juego/assets/fh-skills.js`, `juego/assets/fh-character-core.js`, `juego/assets/fh-survival-core.js`, `juego/assets/fh-shadow-ai.js`, `juego/rules/legacy/` y `juego/core/fh-legacy-engine-session.js`.
- Ruta Legacy y comprobaciones documentadas en `docs/ETAPA3_1_INTEGRACION_LEGACY.md`. Comprobar siempre la versión actual antes de repetir sus conclusiones.
- La rama actual usa `legacy` en sus contratos de sesión y guardado. **Renombrar el reglamento para la documentación no autoriza cambiar identificadores persistidos ni claves de saves.**
- Los contratos multimodo históricos describen combinaciones estructurales; **no deben interpretarse como reglas de diseño aprobadas**. Endurecer el selector/validador es otra tarea, sujeta a pruebas de compatibilidad.

## 6. Cómo ampliar este documento

Cada nueva regla aprobada debe indicar: **nombre y versión, alcance, disparador, entradas/estadísticas, cálculo o decisión, coste, resultado de éxito/fallo, efectos en mundo, dueño del estado, guardado, interfaz, excepciones y pruebas**. Marcar cada apartado como `APROBADO`, `IMPLEMENTADO Y PROBADO` o `PENDIENTE`; la aprobación de diseño no equivale a implementación.

### Registro de pendientes

- Detallar, con las fuentes actuales, la tabla completa de acciones, tiradas y casos especiales de Blackpine.
- Registrar las reglas concretas inspiradas en Fear & Hunger **solo** cuando hayan sido aprobadas, sin generalizarlas.
- Validar guardados y regresiones del modo al incorporar nuevas reglas.

**Orden permanente:** preservar la identidad de Blakpine, su gameplay existente y el motor natural universal; no mezclar reglamentos.

## 7. Orden del Director — Dummy de entrenamiento y exclusividad de Sombras (18-11-2026)

**APROBADO:** las Sombras continúan siendo **enemigos exclusivos de Blakpine Wood**. No servirán de objetivos prestados, referencias de IA, fichas, habilidades, daño o recursos para construir ni probar DnD ni Moon.

El **Training Dummy** se contempla como **instancia neutra en blanco para pruebas de integración de combate**, no como una Sombra, un enemigo hostil ni un bestiario importado. El propietario del reglamento activo resuelve el ataque; el Dummy recibe la propuesta de resultado, permite inspeccionar trazas y conserva solo las invariantes de entrenamiento expresamente autorizadas. Que el Dummy sea accesible desde varios modos no transfiere **PG/PS/PE, FHSkills, GOAP ni daño Legacy** a DnD/Moon.

**Estado técnico:** el Dummy se integró a `main` desde [PR #217](https://github.com/sokcrow/Blakpine-Wood/pull/217) (squash `832bcd676edfa73f7b09cfefeff638b2044f1581`), todavía sin conexión de ataques reales comprobada. No considerar una API aislada de recepción de golpes prueba suficiente del combate de ninguno de los tres reglamentos.
