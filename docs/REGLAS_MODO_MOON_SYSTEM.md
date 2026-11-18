# Reglas de juego — Moon System

> **Documento rector del modo Moon System.** Se completa por decisiones explícitas del Director. La inspiración en los sistemas de Project Moon orienta el diseño, pero **no sustituye una especificación aprobada de las fórmulas y excepciones**.
>
> **Identificador técnico:** `moon-system`. No es DnD con monedas ni Blakpine con otra interfaz.

## 1. Identidad y alcance

- **Juego:** Moon System, reglamento independiente centrado en su propia resolución mediante monedas y enfrentamientos.
- **Ambientación principal:** ciudad distópica/futurista, con arquitectura, equipo, servicios, economía y tecnología configurados por su perfil.
- **Mecánicas señaladas por el Director:** **monedas, Power, Coin Power** y un sistema propio de resolución del éxito y los enfrentamientos.
- **Prohibición principal:** no resolver acciones Moon mediante D20, `Hit % - EVA %`, fórmulas de daño Legacy, PE Legacy ni tiradas de habilidades de Blakpine.

## 2. Núcleo de reglas Moon: no inventar fórmulas

Las piezas siguientes pertenecen al diseño Moon **y solo a él**:

| Componente | Qué debe especificar el Director | Estado |
| --- | --- | --- |
| Monedas | Cantidad, tipo, resultado de cada cara y cuándo se lanzan | PENDIENTE |
| Power | Valor de partida, contexto, modificadores y límites | PENDIENTE |
| Coin Power | Cómo modifica los resultados, acumulación y límites | PENDIENTE |
| Enfrentamientos | Orden, comparación y resultado de choques entre acciones | PENDIENTE |
| Éxito/fallo | Condición exacta para ataques, habilidades y acciones | PENDIENTE |
| Daño y defensas | Fórmulas, resistencias, mitigación y tipos si se autorizan | PENDIENTE |
| Recursos y estados | Nombres, costes, condiciones y recuperación exclusivos de Moon | PENDIENTE |
| Economía de acciones | Orden, velocidad/prioridad, selección de objetivos y turnos | PENDIENTE |
| Progresión | Equipo, habilidades, crecimiento, afinidades y excepciones | PENDIENTE |
| Guardado e interfaz | Datos persistentes, representación de monedas y resultados | PENDIENTE |

**No presuponer una fórmula específica de Project Moon, una probabilidad de cara, modificadores automáticos o un sistema de cordura** hasta que se acuerde en el propio proyecto. Nombrar Power y Coin Power no basta para declararlos implementados.

Si alguna mecánica utiliza una moneda con apariencia similar a una tirada de `FHSkills`, seguirán siendo **dos sistemas aislados** con propietarios, entradas, cálculos y efectos diferentes.

## 3. Mundo distópico y tecnología

- Perfil inicial: entornos urbanos densos, industriales y distópicos; corporaciones, servicios y herramientas **solo si el catálogo del mundo las define**.
- La capacidad de usar tecnología avanzada **no implica que cada barrio tenga electricidad, comunicaciones o recursos ilimitados**. Redes y suministros pueden ser localizados, degradados, restringidos o inexistentes.
- Luces, pantallas, terminales y equipos requieren fuente, conexión, consumo e interacciones coherentes con el perfil Moon, no datos copiados de la ciudad moderna Blakpine.
- Montañas, biomas, bosques, geología, ríos, cuevas, minas, clima, suelos y materiales físicos usan **el mismo motor universal**. El modo controla contenido, recursos, estética, tecnología y reglas de juego propias.
- La distribución espacial de la ciudad Moon se configura por sus perfiles y sistemas de construcción, sin duplicar terreno, navegación, colisión o iluminación.

## 4. Frontera con el motor compartido

**Moon decide:** monedas, Power, Coin Power, enfrentamientos, resultados de éxito/fallo, recursos, daño, habilidades, progresión e interfaz del modo.

**El motor decide:** coordenadas, existencia y posición de obstáculos, geometría, visibilidad real, contacto, rutas, niveles, iluminación física, terreno y aplicación autorizada de cambios espaciales.

Las acciones pueden **consultar** el mundo físico mediante un contexto autorizado y **proponer** sus efectos; la aplicación de efectos físicos corresponde a su propietario y ocurre una sola vez.

**Está prohibido:** importar un resolutor Legacy o DnD para completar acciones; traducir recursos entre modos; duplicar simulaciones de colisiones, visión o navegación; usar un perfil moderno o medieval para importar un reglamento ajeno.

## 5. Estado comprobado en el repositorio

- El manifiesto `contratos/multimodo/ejemplos/reglas/moon-system.json` sigue declarado **`planned`**: la identidad simbólica del adaptador **no es** un motor Moon operativo.
- `juego/rules/` no contiene todavía un reglamento funcional Moon equivalente al prototipo DnD. No anunciarlo como jugable.
- El perfil `contratos/multimodo/ejemplos/mundos/distopia.json` es **declarativo** y todavía no apunta a un mapa jugable propio.
- Las pruebas del validador de contratos o ejemplos cruzados solo prueban estructura. **No autorizan mezclas de modos**, ni acreditan resultados de monedas, Power o Coin Power en gameplay.
- No utilizar las tiradas porcentuales del sistema de habilidades de Blakpine como evidencia de que Moon está implementado.

## 6. Cómo ampliar este documento

Registrar cada regla con: **nombre, fuente autorizada o decisión del Director, situación de uso, secuencia de monedas, Power/Coin Power, fórmula exacta, éxito/fallo, costes, efectos, propietaria del estado, datos guardados, UI, casos límite y pruebas**.

Usar estados `PENDIENTE`, `APROBADA` e `IMPLEMENTADA Y PROBADA` por separado. La ausencia de una decisión es un límite explícito, **nunca un permiso para importar mecánicas**.

**Orden permanente:** Moon System mantiene reglas, estadísticas y resolución independientes y únicamente comparte el motor físico/natural.

## 7. Investigación correctiva de combate (18-11-2026)

La **especificación implementable en estado de propuesta** está en [MOON_SYSTEM_ESPECIFICACION_COMBATE_PROPUESTA.md](./MOON_SYSTEM_ESPECIFICACION_COMBATE_PROPUESTA.md).

- **Investigado (fuentes externas, NO reglas aprobadas):** Base Power, Coin Power positivo/negativo, lanzamiento ordenado de múltiples monedas, enfrentamientos sucesivos con pérdida de monedas y empates, ataque separado tras el choque, efectos y disparadores por moneda, resistencias físicas/afinidades, niveles ofensivos/defensivos, Sanity, estados, recursos de afinidad/E.G.O, defensas, velocidad y economía de turnos.
- **Documentado como propuesta:** fórmulas candidatas diferenciadas de observaciones de Limbus, algoritmos y excepciones, 10 ejemplos numéricos, contrato técnico de estados/eventos, 25 casos de prueba diseñados y decisiones D-01 a D-14 que se someten al Director. Los ejemplos **no son implementación ni validación del juego**.
- **Pendiente de decisión:** nivel de fidelidad a Limbus, reglas de monedas y Sanity, tratamiento de empates y monedas inquebrantables, daño/redondeo, estados, recursos, defensas, orden/velocidad, selección de objetivos, unidades y catálogo Moon, persistencia y versión.
- **Regla estricta de unidades:** compartir geometría, colisión, navegación y visibilidad **no** autoriza traer Sombras, criaturas DnD o NPC de otro modo. Enemigos, fichas, comportamientos y aparición pertenecen al catálogo **Moon autorizado**, todavía por definir.
- **Estado real del runtime:** sigue sin `juego/rules/moon-system/` funcional; el manifiesto **continúa `planned`**, el selector no habilita Moon y el coordinador todavía carece de un puerto Moon. No usar `FHSkills`, `bindDndCombat` ni cálculos Legacy para simularlo.
- **Condición para programar:** el Director aprueba explícitamente el subconjunto y su contrato. Solo entonces se implementa con adaptador propio y extensión autorizada del coordinador; las mejoras comprobadas se integran a `main` sin PR dependientes. No declarar `implemented` ni jugable hasta contar con implementación y pruebas reales.

## 8. Orden del Director — blanco de entrenamiento Moon (18-11-2026)

**APROBADO:** el **Training Dummy** es una **instancia en blanco para iniciar integración y pruebas**, no un enemigo de Blakpine ni una criatura con fichas/IA transferidas. **No** usar Sombras para desarrollar Moon; sus reglas, personajes, GOAP, PE y daño pertenecen exclusivamente a Blakpine Wood. Tampoco resolver Moon con D20 DnD ni con `FHSkills.roll` de Legacy.

**Secuencia exigida cuando exista una fórmula Moon aprobada:** consulta física del motor común → intención/autorización del coordinador → resolución **propia de Moon** (monedas, Power, Coin Power, choques y daño solo en el alcance aprobado) → propuesta de resultado → registro en Training Dummy y aplicación única. El Dummy **no inventa** probabilidades, estados, resistencia, Sanity, daño ni turnos para completar el reglamento; sus invariantes de entrenamiento no constituyen estadísticas Moon. Si falta aprobación o capacidad funcional, la acción se declara **no disponible**, no se adapta una Sombra ni se crea un fallback.

**Estado:** el [PR #217](https://github.com/sokcrow/Blakpine-Wood/pull/217) propone el blanco y una API de recepción, **no** un resolutor Moon ni su integración real con ataques. El manifiesto debe continuar `planned` y el selector sin Moon hasta implementar y probar el núcleo aprobado. **PENDIENTE** la integración de impacto Moon → Dummy y su trazabilidad de pruebas.
