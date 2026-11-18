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
