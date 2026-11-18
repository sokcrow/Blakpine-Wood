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
- **El ataque básico del jugador no tiene cooldown artificial de un minuto.** Sin embargo, las Sombras todavía pasan por el disparador por movimiento y el `attackCooldown` del motor compartido (`fh-shadow-ai.js`, **9 minutos de reloj por defecto**). Eso es un comportamiento provisional de la demo, **no** una regla DnD aprobada ni un controlador de turnos.
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

## 7. Auditoría correctiva de correspondencia (17 de noviembre de 2026)

**Alcance auditado:** `juego/rules/dnd/fh-dnd-combat.js`, `fh-dnd-engine.js`, `fh-dnd-save-adapter.js`, `juego/core/fh-session-coordinator.js`, `fh-multimode-persistence.js`, `fh-multimode-save-identity.js`, `fh-multimode-save-hook.js`, `juego/assets/fh-shadow-ai.js` y `tests/dnd-combat.test.cjs`, sobre `main`. Los PR **#215** y **#216** ya están fusionados. Esta auditoría **no selecciona ninguna edición** ni amplía el combate.

### Clasificación de autoridad

- **APROBADO (contrato propio del proyecto):** reglamento `dnd` aislado; motor común para contacto, movimiento real, luz y navegación; D20 parametrizable de demostración; ataques básicos sin gastar PE ni «energía DnD»; ausencia de cooldown artificial **del jugador**; coordinación con `actionId`, autorización, revisión y aplicación única; compatibilidad con guardados DnD v1; nada de `FHSkills` como resolutor.
- **IMPLEMENTADO COMO PROTOTIPO, NO COMO REGLA DE EDICIÓN:** `playerHp:20`, `creatureHp:8`, `defense:10`, `resistance:0`, `attackBonus:0`, `damageBonus:0`, D20 de ataque, D4 de daño y su fórmula actual. Los campos `energy:6/4`, `maxEnergy`, `energyCost`, `lastPlayerMinute`, `actionSequence` existen en el esquema v1 por compatibilidad: **no son recursos ni acciones aprobados**. `energyCost:0` expresa la prohibición de consumir energía, no una nueva economía de turnos.
- **PENDIENTE DEL DIRECTOR:** edición y suplementos; iniciativa, rondas y turnos; acciones/acciones adicionales/reacciones/movimiento; atributos, competencia, niveles y tiradas; AC y defensas específicas; armas, crítico, 1 y 20 naturales, ventajas/desventajas, daño por tipo y resistencias; muerte y salvaciones; capacidades, magia, estados, descanso, HUD de turnos y esquema persistente de encuentros.
- **ACOPLAMIENTOS TEMPORALES DETECTADOS, NO APROBADOS COMO REGLA:** la Sombra ataca al detectar movimiento, si está en contacto y ha pasado `attackCooldown` (**9 minutos por defecto**) en `fh-shadow-ai.js` (líneas aproximadas 283–359); su `pe` todavía participa en **movimiento/fase** del sistema de Sombras, aunque no se gasta para resolver ataques DnD; `touchFt:2` es el radio por defecto del motor de Sombras, **no** el alcance reglamentario de un arma. No solucionar estos acoplamientos alterando físicamente el motor sin contrato de turnos autorizado.

### Matriz: documento rector × fuente externa × código vigente

| Tema | Documento / autoridad | Fuente externa de comparación (NO adoptada) | Código existente en `main` | Decisión / propuesta técnica |
| --- | --- | --- | --- | --- |
| Edición | §1, edición pendiente | Reglas básicas 2014 y 2024; SRD 3.5; fuentes 4e/AD&D 2e | Adaptador `status:implemented` solo para **prototipo** | Director elige edición, libros, erratas y variantes; después declarar `editionId` y versión **sin alterar** `rulesetId:dnd` ni atribuir conformidad retrospectiva |
| Iniciativa | §2 pendiente | 2014: prueba de Destreza y sorpresa priva primer turno; 2024: sorpresa da desventaja a iniciativa | `fh-dnd-engine.js` carece de iniciativa; Sombras actúan mediante `tick` del mundo | Proponer estado de encuentro `initiativeOrder`, `initiativeRolls`, desempates y regla de sorpresa **solo tras edición aprobada** |
| Rondas y turnos | §2 pendiente | 2014/2024: orden de iniciativa por rondas; 3.5/4e usan economías diferentes | No existen `round`, `turnIndex`, transición de turno ni fin de encuentro | Proponer controlador DnD aparte del reloj físico; definir cuándo entra/sale de combate y quién avanza turno, con pruebas de jugador/NPC |
| Acción y acción adicional | §2 pendiente; prohibidos cooldown y PE | 2014/2024: acción, bonus action solo si una capacidad la concede; 3.5: estándar/movimiento/completa/rápida/inmediata; 4e: estándar/movimiento/menor | `playerAttack()` está disponible repetidamente si hay contacto; no consume economía de acciones | Proponer `turnBudget` **derivado exclusivamente de la edición seleccionada**, validado antes de `requestAttack`; nunca inventar barra de energía |
| Reacciones | §2 pendiente | 2014/2024: reacción condicionada a disparador, normalmente recuperada al comienzo del turno propio | Sin eventos ni reservas de reacción DnD; `FHShadowAI` responde al movimiento mediante un ataque ordinario | Proponer cola de disparadores y reacción de la edición aprobada; no presentar el ataque automático de Sombra como «ataque de oportunidad» |
| Movimiento y alcance | §3–4: el motor es dueño de colisión/navegación | 2014/2024: movimiento conforme a velocidad y alcance/posición; otras ediciones difieren | `contactClear()`, `canPlayerAttack()`, `touchFt:2`, `canWalk()`; sin presupuesto DnD de movimiento | Registrar velocidad, alcance y desplazamiento consumido en DnD; consultar siempre posición real al motor, sin segundo raycast ni teletransporte |
| Ataques y tiradas | §2 prototipo autorizado D20 parametrizable | 2014/2024: d20 + modificadores contra AC; competencia/atributos y ventaja varían por capacidad | `evaluate()` usa `dice.hit + attackBonus >= defense` | Mantener hasta autorización; añadir origen trazable de bonificadores, dado(s) y reglas de ventaja al definir edición; no usar `FHSkills.roll` |
| Defensas y daño | §2: `defense`, `resistance` son parámetros de demo | 5e 2014/2024: AC y resistencia por **tipo** de daño que normalmente reduce daño a la mitad; 4e: AC/Fortitude/Reflex/Will | `defense:10`; `damage = max(0, dado + bono − resistance)`, limitado a HP | No llamar `resistance` numérica «resistencia 5e». Tras decisión: esquema de AC, tipos, resistencias/inmunidades y orden de aplicación |
| Críticos y 1/20 | §2: **no implementados** | 2014/2024: 20 natural en ataque impacta/crítico y duplica dados; 1 natural falla | `evaluate()` compara solo suma y defensa: **no** hay 1/20 especial ni dados críticos | Aprobar primero edición/excepciones; después registrar `naturalRoll`, resultado crítico y dados extra con tests de límites |
| Atributos, clases, competencia | §2 pendiente; prohibida reutilización Legacy | 5e: seis características, modificadores, competencia y progresión; ediciones antiguas y 4e difieren | Solo `attackBonus`/ `damageBonus` configurables por actor; sin ficha, clases, nivel ni salvaciones | Definir una ficha DnD propia y validadores, separada de `character`, `stats`, `skills`, PG/PS/PE Legacy |
| Muerte y 0 HP | §2 pendiente | 2014/2024: 0 HP puede producir inconsciencia, salvaciones de muerte y excepciones; regla de monstruos con tratamiento propio | `apply()` resta HP hasta 0; la Sombra se retira; el jugador deja de atacar; **no hay salvaciones ni estado de muerte DnD** | Definir `unconscious`, `stable`, muerte instantánea y salvaciones según edición; no transformar automáticamente 0 HP del personaje en muerte reglamentaria |
| Coordinación e idempotencia | §2, §4 **aprobado** | No depende de la edición | `bindDndCombat()` valida sesión, revisión, capacidad y `actionId`, reclama acción antes de callbacks y aplica una vez | Conservar. Cuando existan turnos, validar autoridad/turno/reacción dentro del coordinador sin duplicar física; probar reentrada, repetición y revocación |
| Persistencia | §2, §4 **aprobado** aislamiento v1 | No depende de la edición | `fh-dnd-save-adapter.js` y `fh-multimode-persistence.js`: estado `dnd` privado, identidad compuesta y reglas v1 exactas | Mantener lectura de v1; decidir nueva versión/migración para fichas y encuentros **antes** de cambiar validador o guardados |
| HUD y mapa | §3–5: motor común / perfil medieval | No hay elección de mundo implícita en reglas de combate | HUD solo muestra HP y ataque; demo moderna; selector registra adaptador DnD | HUD de orden/turnos y perfil medieval después de aprobar contrato; no convertir la demo moderna ni Eberron en regla general |

### Diferencias de edición que alteran el diseño

**5e 2014 y 5e 2024 comparten** la estructura de D20, AC, características, turno, acción, posible acción adicional y reacción, pero **no son intercambiables**. Un caso que obliga a escoger edición antes de implementar es **sorpresa**: 2014 puede impedir actuar y moverse en el primer turno, mientras que 2024 impone desventaja a iniciativa. El catálogo y nombres de acciones de 2024 incluyen `Magic`, `Influence`, `Search`, `Study` y `Utilize`, y no debe copiarse sin aprobación. Ambos contienen críticos y salvaciones de muerte, ausentes en el prototipo.

**3.5** exige considerar acciones estándar, de movimiento, de asalto completo, gratuitas, rápidas e inmediatas, con ataques de oportunidad; **4e** introduce economía estándar/movimiento/menor, poderes y defensas AC/Fortitude/Reflex/Will; **AD&D 2e** usa THAC0 e iniciativa distinta. Estas son **alternativas** para estudiar, no una lista de módulos autorizados ni una recomendación de mezclar sistemas.

### Fuente y trazabilidad de reglas externas (solo para contrastar)

1. 2014, Basic Rules, combate, iniciativa, economía, ataques, críticos y muerte: https://www.dndbeyond.com/sources/dnd/basic-rules-2014/combat
2. 2024, Free Rules, `Playing the Game`, acciones, iniciativa, sorpresa, ataques, daño y muerte: https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game
3. 2024, `Rules Glossary`, reacciones, alcance, condiciones y resistencia: https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary
4. 3.5, SRD, `Actions in Combat`: https://www.d20srd.org/srd/combat/actionsInCombat.htm
5. 4e, referencia del `Player's Handbook` y glosario de defensas: https://anyflip.com/dovce/swms/basic/251-300 y https://www.dyasdesigns.com/dnd4e/static-site/glossary/glossary179-defense-scores.html
6. AD&D 2e, referencia secundaria para iniciativa y THAC0: https://adnd2e.fandom.com/wiki/Initiative_%28PHB%29 (contrastar con libro primario si el Director elige 2e).

### Decisiones pendientes que deben volver al Director **antes de programar**

1. ¿Edición base exacta: 5e 2014, 5e 2024, 3.5, 4e, AD&D 2e u otra, y cuáles libros/erratas/variantes?
2. ¿Encuentros estrictamente por turnos, y cómo se pausa o convive el reloj del mundo con el combate? ¿Qué ocurre con jugadores/NPCs externos al encuentro?
3. ¿Cómo se autorizan atributos, clase/nivel/competencia, iniciativa, sorpresa, movimiento, economía de acciones, reacciones y desencadenantes?
4. ¿Qué armas, tipos de daño, armaduras, defensas, resistencias, ventajas, críticos y salvaciones se usan?
5. ¿Qué significa 0 HP para jugador, criatura, NPC especial y estados persistidos? ¿Qué recuperación, muerte y descansos se autorizan?
6. ¿Las Sombras del prototipo serán criaturas DnD con ficha/turno, o entidades exclusivas de la demo? ¿Cómo se retiran sus cooldowns/PE de IA sin romper Legacy?
7. ¿Cuál será el esquema, migración y HUD para fichas, recursos, encuentros y turnos? **No** cambiar `rulesetVersion:1` unilateralmente.

**Resultado de esta auditoría:** las decisiones anteriores quedan **PENDIENTES**. El adaptador implementado no equivale a reglamento completo; no se introducen turnos, críticos, atributos, muerte, costes ni edición por inferencia.
