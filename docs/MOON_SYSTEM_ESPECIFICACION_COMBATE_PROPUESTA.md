# Moon System — investigación y especificación de combate propuesta

> **ESTADO: INVESTIGADA / PROPUESTA / NO APROBADA / NO IMPLEMENTADA.** Documento técnico subordinado a [REGLAS_MODO_MOON_SYSTEM.md](./REGLAS_MODO_MOON_SYSTEM.md). Fecha de revisión: **18-11-2026**.
>
> Las reglas observadas de *Limbus Company* son **referencias externas**; ningún ejemplo o pseudocódigo equivale a aprobación del Director. `moon-system` sigue en `planned`. Este documento no habilita selector, personajes, enemigos ni combates.

## 0. Auditoría del repositorio y fronteras

- `contratos/multimodo/ejemplos/reglas/moon-system.json`: `status: "planned"`, adaptador nominal `combat.moon-system` y `combatResolution: "coins-planned"`. El registro **no** acredita implementación.
- `juego/rules/` contiene `legacy/` y `dnd/`, **no contiene un adaptador Moon**. `juego/assets/fh-multimode-selector.js` solo registra Legacy y DnD al montar; Moon no puede iniciarse.
- `juego/core/fh-session-coordinator.js` posee un camino Legacy y otro **específico de DnD** (`bindDndCombat`): **no** usar el método DnD para simular Moon. Si se autoriza implementar Moon habrá que **extender el coordinador común** con un puerto de acciones Moon, con su propia autorización e idempotencia; mantener intacto el resto.
- `fh-multimode-save-identity.js` reconoce el identificador Moon para futuros guardados `rulesetVersion:1`, pero eso **no** implica que exista un adaptador de guardado Moon, estado aprobado o una migración autorizada.
- Enemigos, personajes, NPC, habilidades, equipos, recursos, spawns y GOAP son **exclusivos por juego y catálogo autorizado**. No usar Sombras de Blakpine, unidades DnD ni ciberpsicópatas de otra ambientación como relleno. Solo compartir geometría, posición, colisión, alcance físico, navegación, luz y visibilidad del motor.

## 1. Fuentes, alcance de la observación y precauciones

Son documentos públicos de **terceros** que describen comportamientos del juego, no una licencia para reproducir sus personajes ni una copia certificada del código interno de Project Moon. Fuentes consultadas en noviembre de 2026:

- **[L1]** Limbus Company Wiki (wiki comunitaria), *Battles*: https://limbuscompany.wiki.gg/wiki/Battles — encuentro, velocidades, choques, recursos, monedas, estados y resistencias.
- **[L2]** Limbus Company Wiki, *Skills*: https://limbuscompany.wiki.gg/wiki/Skills — monedas inquebrantables, disparadores `On Use`, `Clash Win`, `On Hit`, `Heads Hit` y defensas.
- **[L3]** Limbus Company Wiki, *Damage Formula*: https://limbuscompany.wiki.gg/wiki/Damage_Formula — daño por moneda, términos estáticos/dinámicos, niveles y resistencias.
- **[L4]** Limbus Company Wiki, *Sanity*: https://limbuscompany.wiki.gg/wiki/Sanity — probabilidad dependiente de Sanity/SP.
- **[L5]** Prydwen, *Combat mechanics*: https://www.prydwen.gg/limbus-company/guides/combat-mechanics/ — tipos de daño, afinidades, daño, Sanity, choque y E.G.O.
- **[L6]** Prydwen, *Beginner guide* (actualizado **13-05-2024**, útil para terminología, no versión canónica de 2026): https://www.prydwen.gg/limbus-company/guides/beginner-guide — velocidades, niveles, resonancia y recursos E.G.O.
- **[L7]** Prydwen, *Advanced Combat Mechanics*: https://www.prydwen.gg/limbus-company/guides/advanced-combat-mechanics — defensas chocables y monedas inquebrantables.
- **[L8]** Limbus Deck, *Clash Win Rate Calculator* (implementación **no oficial** que explica empates y tope de 99): https://limbusdeck.com/en/clash-calculator — corroboración computacional de casos de choque.
- **[L9]** Limbus Company Wiki, *Status Effects*: https://limbuscompany.wiki.gg/wiki/Status_Effects — taxonomía de efectos, no una lista para copiar indiscriminadamente.
- **[L10]** Limbus Company Wiki, *Offense Level & Defense Level*: https://limbuscompany.wiki.gg/wiki/Offense_Level — modificadores en choque y daño.
- **[L11]** Limbus Company Wiki, *Coin Boost & Coin Drop*: https://limbuscompany.wiki.gg/wiki/Coin_Boost_%26_Coin_Drop — modificaciones a monedas.
- **[L12]** Calculadora comunitaria de daño, **no verificación oficial**: https://www.limbuscompany.tools/damage-calculator — contraste de redondeos y multiplicadores.

**Discrepancias de referencia:** [L5] presenta pedagógicamente choques «moneda a moneda»; [L1]/[L8] describen **relanzar todas las monedas activas** en cada intercambio y romper una moneda del perdedor. Se toma el segundo como **comportamiento mejor sustentado**, sin declararlo ya adoptado por Moon. [L3] describe redondeo final hacia abajo, mientras [L12] emplea redondeo al entero más cercano con empate al par. **No elegir redondeo ni fidelidad de daño sin cotejo con una versión concreta del juego y aprobación.** Las actualizaciones y habilidades especiales pueden introducir excepciones.

### Vocabulario obligatorio para no confundir sistemas

- **Base Power:** valor inicial impreso de una habilidad; distinto de `Coin Power`.
- **Coin Power:** incremento **positivo o negativo** aportado por una moneda cuando sale cara; puede modificarse.
- **Final Power:** valor resultante con monedas y bonificaciones aplicables; el **Clash Power** incluye bonificaciones propias del choque, que no deben contaminar daño.
- **Cara / cruz:** resultados de **cada moneda**, no éxito/fallo binario de una habilidad completa.
- **Choque (Clash):** competencia entre habilidades opuestas, potencialmente con varios intercambios.
- **Ataque sin oposición (Unopposed Attack):** ejecución de habilidad sin choque; no debe tratarse como victoria ficticia de choque.
- **Sanity/SP de Limbus:** recurso propio de su juego. **No** es la Sanidad `PS`/`sp` Legacy de Blakpine; si Moon lo adopta, su nombre, rangos, eventos y persistencia serán privados.
- **Cracked / Unbreakable:** moneda inquebrantable que se agrieta tras perder un choque y puede producir ataque residual; **no** equivale a moneda normal eliminada.

## 2. Fichas de mecánicas (observación vs propuesta no aprobada)

Cada fórmula siguiente es un **contrato candidato para deliberación**, no una instrucción de implementación.

### M01 — Power y Coin Power

- **Fuente:** [L1], [L2], [L5], [L6], [L11].
- **Observado:** cada habilidad tiene Base Power, una lista ordenada de monedas y Coin Power. En habilidades positivas, caras suman; en habilidades negativas, caras pueden restar. Modificadores de **Base**, **Coin**, **Final** y **Clash Power** actúan en lugares distintos. Los resultados de monedas múltiples afectan al total.
- **Fórmula candidata (núcleo simple, sin efectos):** `Power(rolls) = BasePower + sum(coin[i].coinPower * indicadorCara[i]) + baseMods + finalMods`; `indicadorCara = 1` si cara, `0` si cruz. **Power de choque** agrega `clashOnlyMods`; **Power de ataque** no los agrega. Considerar `coinPower` individual por moneda, no un solo valor obligatorio para todas.
- **Variantes:** `coinPower < 0`; caras siempre favorables **no es cierto**; efectos por moneda; condiciones que cambian Coin Power; `Paralysis`; monedas especiales; `Clash Power Up` distinto de daño.
- **Casos límite:** bonus negativo; exceso de reducciones; potencia nula o negativa; monedas de distinto signo; modificación de un efecto entre dos monedas; orden de operaciones.
- **Pendiente Director:** si se conserva exactamente esa fórmula, qué buffs y mínimos hay, precedencia de modificadores, límites por habilidad y si se autorizan habilidades de monedas negativas.

### M02 — Probabilidad y secuencia de monedas

- **Fuente:** [L1], [L2], [L4], [L5], [L8].
- **Observado:** cara/cruz no es una tasa arbitraria global. Para una unidad normal con Sanity, [L4] documenta `P(cara) = (50 + SP)/100` con `SP` entre -45 y +45: 5%, 50% y 95% en los extremos y centro. Algunas unidades no tienen Sanity (probabilidad base ~50%) y efectos especiales pueden modificar/sustituir la regla. Las monedas se tiran en las fases apropiadas, con registro de cara/cruz y efectos de moneda.
- **Fórmula candidata para la **variante de referencia Limbus**, NO aprobada:** `pHead = (50 + clamp(moonSanity,-45,45))/100` **solo si** el Director aprueba ese recurso y rango; generador inyectado `rng()` en [0,1) con `heads = rng() < pHead`. Las monedas del choque se **relanzan** en la fase del ataque; nunca reutilizar por accidente las tiradas previas.
- **Variantes:** unidades sin Sanity; habilidades que fijan cara o cruz; poderes de moneda positivos/negativos; aumentos explícitos a probabilidad; monedas eliminadas, agrietadas o reutilizadas.
- **Casos límite:** 0, +45, -45; valores fuera de rango; RNG = 0 y cercano a 1; moneda marcada como destruida; guardar/reproducir secuencia determinista; efectos que conceden cara garantizada.
- **Pendiente Director:** adoptar o no Sanity, rangos y ganancias/pérdidas; probabilidades especiales por unidad; si hay resultados predeterminados; número máximo de monedas; cómo presentar resultados. **Prohibido** convertir todo Moon en un 50/50 fijo.

### M03 — Choques entre habilidades

- **Fuente:** [L1], [L2], [L6], [L8], [L10].
- **Observado:** dos habilidades enfrentadas lanzan **todas sus monedas aún válidas** por intercambio, suman poder de choque y comparan. La habilidad con menor poder pierde/agrieta **una** moneda, habitualmente la más temprana todavía activa; si empatan, no pierde ninguna. Se repite hasta que un lado se queda sin monedas aptas para chocar; el rival gana. El mayor nivel ofensivo suele dar `floor(diferencia / 3)` de Clash Power **solo al lado superior** en choque de ataques; las defensas chocables tienen particularidades. [L8] describe cancelación por 99 intercambios sin resolución.
- **Algoritmo candidato:** crear dos copias de la lista ordenada de monedas; por intercambio, relanzar **todas las monedas no destruidas ni agrietadas que sigan participando**; calcular `clashPower` para cada lado; si A>B, B pierde su primera moneda elegible, si A<B, A la suya, si A=B ninguna; actualizar historial y continuar. Resultado estructurado `win | lose | canceled`, nunca un booleano derivado de la primera moneda. Si se aprueba una fidelidad mayor, la regla de selección/rotura de moneda y las especiales deben venir de fuente verificada.
- **Variantes:** empate; diferencia de niveles; habilidades que no chocan; ataques sin oposición; `clashable counter` y `clashable guard`; monedas inquebrantables o con comportamientos excepcionales.
- **Casos límite:** 1 contra 3 monedas; empate repetido; 99 intercambios; muerte/interrupción durante choque; cambio de objetivo; dos actores derrotados; nivel igual; 3/5/6 puntos de diferencia.
- **Pendiente Director:** reglas precisas de empates/tope, bonificaciones, selección de moneda rota, excepciones especiales y elegibilidad de choques; **no** crear «win rate» fijo para reemplazar la simulación.

### M04 — Ganar y perder enfrentamientos; ataques posteriores

- **Fuente:** [L1], [L2], [L5], [L7], [L8].
- **Observado:** ganar un choque normal cancela el ataque del perdedor cuando se agotaron sus monedas **rompibles**; el vencedor ejecuta la fase de ataque con sus monedas restantes, que **se vuelven a lanzar**. Cada moneda de ataque puede generar un impacto separado y activar efectos `On Hit`. Los ataques sin oposición también recorren la fase de ataque. Las monedas inquebrantables agrietadas pueden atacar **tras recibir** el golpe rival con Coin Power modificado, salvo interrupciones (p. ej. Stagger); perder no siempre significa hacer 0 daño.
- **Fórmula candidata:** `survivors = coins.filter(eligibleForDamageAfterClash)`; para `j` en orden, lanzar moneda de daño y calcular `Power_j = BasePower + sum_{i<=j, i activo}(coinPower_i * indicadorCara_i) + modsAplicables_j`; aplicar evento de cada moneda sin volver a sumar daños pasados. Es **un daño por moneda**, no «un total de choque como único impacto». Variante especial: programar subevento `crackedRetaliation` **solo si** se autorizan inquebrantables.
- **Variantes:** normal, sin oposición, sin monedas, monedas reutilizadas, habilidades con múltiples objetivos, contras, ataques residuales inquebrantables.
- **Casos límite:** ganador pierde 2 de 3 monedas y conserva solo la tercera; efectos de las primeras rotas no disparan; el objetivo cae a mitad de secuencia; el perdedor tiene moneda inquebrantable; anulación tras Stagger; reevaluar rango físico antes de aplicar cuando corresponda.
- **Pendiente Director:** comportamiento frente a objetivo derrotado, interrupciones, retargeting, `On Kill`, límites de monedas reutilizadas y autorización de inquebrantables. **No** asumir que el daño usa el roll del choque.

### M05 — Daño, tipos, defensas y resistencias

- **Fuente:** [L1], [L3], [L5], [L6], [L10], [L12].
- **Observado:** cada moneda atacante tiene Final Power de ataque. El cálculo de daño de Limbus separa modificadores **estáticos** (resistencia física, afinidad de pecado, ventaja ofensiva/defensiva, críticos, número de intercambios, etc.) y **dinámicos** (estados, pasivas, efectos de habilidad y regalos). Hay tipos físicos `Slash`, `Pierce`, `Blunt`, afinidades de siete pecados y niveles ofensivos/defensivos. [L3] documenta `levelTerm = (offenseLevel - defenseLevel) / (abs(offenseLevel-defenseLevel) + 25)`. Las resistencias por debajo de 1 tienen contribución negativa **reducida a la mitad** al término estático; no son reducción fija como Legacy.
- **Fórmula candidata **solo para referencia**, sin adoptar todavía detalles:** `raw_j = attackPower_j * (1 + staticMods_j) * (1 + dynamicMods_j)`; donde `staticMods` incluye `resistTerm(phys)+resistTerm(sin)+levelTerm+critTerm+clashCountTerm+otros` y `resistTerm(r)=r-1` si `r>=1`, o `(r-1)/2` si `r<1`. En [L3], `clashCountTerm=0.03*n` y los críticos habituales añaden `0.20` al término estático; **no** aplicar automáticamente en Moon hasta aprobación.
- **Variantes:** Guard (escudo/absorción), Evade (evitación), Counter, defensas chocables, `Stagger`, `Poise` crítico, protección, daño fijo/adicional, tipos múltiples, partes de enemigos, E.G.O, resistencias alteradas por estado.
- **Casos límite:** daño base 0 o negativo, mitigación total, límite mínimo de daño, redondeo, enorme disparidad de nivel, resistencia 0/1/2, críticos y Stagger simultáneos, daño de múltiples monedas, sobre-daño, inmunidad genuina si existe.
- **Pendiente Director:** nivel de fidelidad; tipos y afinidades permitidos; fórmula exacta y orden de operaciones; **redondeo y mínimo** (ver discrepancia [L3]/[L12]); defensas/mitigación; daño a partes, Stagger, críticos y efectos. Nunca usar `ATQ.F - RST.F` ni `PG/PS/PE` de Legacy.

### M06 — Recursos, Sanity y estados

- **Fuente:** [L1], [L2], [L4], [L5], [L6], [L9].
- **Observado:** Limbus distingue HP, Sanity/SP cuando la unidad lo tiene, niveles, velocidad, recursos de afinidad para E.G.O y medidores específicos de identidad (`Charge`, `Poise`, `Sinking`, etc.) con reglas particulares. Se pueden ganar recursos de afinidad usando habilidades y gastar en E.G.O, que además puede consumir Sanity. Los eventos de estados dependen de momento y tipo: `On Use`, `Combat Start`, `Clash Win`, `On Hit`, `Heads Hit`, `Tails Hit`, `Attack End` y `Turn End`. Estados con potencia/cantidad no se comportan todos igual.
- **Fórmula candidata:** `resourceNext = applyAuthorizedEvent(resourceOld, event, skillSpec)` y `statusNext = resolveStatus(statusOld, trigger, context)`, validadas en el *ruleset Moon*; ningún coste de «energía por ataque básico» inventado. Si se aprueba E.G.O: `allowed = affinityInventory >= skillCosts && additionalRequirements`; solo descontar una vez tras autorización, con rollback/rechazo atómico de una intención inválida.
- **Variantes:** sin Sanity, E.G.O, sobre-reloj/corrosión, stacks de potencia y cuenta, estado que dura turno, escudo, Stagger, pasivas, habilidades condicionadas.
- **Casos límite:** recurso insuficiente, coste cero, estados expirados, coste por ataque fallido si una regla aprobada lo prescribe, no gastar dos veces en reintento, efectos simultáneos, máximo/mínimo, perder conciencia antes de aplicar efecto.
- **Pendiente Director:** qué recursos y estados **propios de Moon** se importan conceptualmente (sin reutilizar valores Legacy); cómo se ganan/pierden; coste/ventana de E.G.O; límites, orden de eventos, guardado y HUD.

### M07 — Economía de acciones, velocidad y selección de objetivos

- **Fuente:** [L1], [L2], [L5], [L6].
- **Observado:** Limbus resuelve encuentros por turnos/fases; cada unidad tiene velocidad que puede cambiar por turno, ranuras de habilidades y objetivos. En encuentros enfocados, velocidades permiten interceptar o redirigir ciertos ataques y seleccionar enfrentamientos. Habilidades defensivas y E.G.O tienen requisitos propios. No es DnD con acción/bonus/reacción, ni PE/cooldown Legacy. Las variantes de encuentro de Limbus no comparten siempre el mismo mecanismo de selección.
- **Fórmula candidata:** planificación `plan = [{slotId, unitId, skillId, targetId, speed, phase}]`; validar disponibilidad/compatibilidad de cada ranura; resolver prioridades y choques de un plan **según contrato elegido**, consultar alcance/obstáculos en motor común y mantener progresión de turno dentro de Moon. **No** convertir velocidad en probabilidad plana de éxito.
- **Variantes:** encuentro normal vs enfocado, defensa, contra, ataques sin oposición, múltiples ranuras, cambios de velocidad, empate de iniciativa/velocidad, objetivo deshabilitado.
- **Casos límite:** dos ataques al mismo objetivo, intento de interceptar con velocidad igual/inferior, una ranura usada dos veces, objetivo que se mueve o desaparece, ataque cancelado, muerte antes de ejecutar la acción, cambio de fase.
- **Pendiente Director:** modelo exacto de encuentro, ranuras por personaje, velocidad, prioridades, intercepciones, control NPC, temporización con mundo 3D y reglas de movimiento físico (que pertenece al motor universal).

### M08 — Efectos de moneda, defensas especiales y progreso de habilidades

- **Fuente:** [L2], [L7], [L9], [L11].
- **Observado:** efectos activados por eventos de fases distintas; `On Hit` no equivale a `Clash Win`. Las defensas principales incluyen Guard, Evade, Counter y variantes chocables. Monedas **Unbreakable** pueden quedar `Cracked` con respuesta tras derrota del choque. Algunas habilidades cambian Coin Power, número de monedas o ataques; identidades tienen pasivas/condiciones.
- **Fórmula candidata:** tabla de eventos versionada `when -> preconditions -> proposalEffects`; ordenar eventos por `(turn, phase, skillSlot, coinIndex, eventSequence)`; el resolutor produce **propuestas** y nunca altera posición o HP por su cuenta; la aplicación física viene de autoridad correspondiente. Para `Cracked`, modelar estado explícito independiente de `destroyed`.
- **Variantes:** monedas reutilizables/inquebrantables, habilidades de defensa chocable, escudo, esquiva, counter, condiciones por afinidad y efectos al matar.
- **Casos límite:** evento repetido, doble daño por multiobjetivo, evento de moneda perdida, `On Hit` durante choque (debe rechazarse salvo excepción), bucle infinito de reuso, reentrancia de efectos.
- **Pendiente Director:** escoger **subconjunto inicial exacto**, prioridad de triggers, pasivas, reuso, defensa y progresión, y quién controla IA de unidades Moon. Ninguna unidad ni catálogo Project Moon se importa automáticamente.

## 3. Ejemplos numéricos reproducibles (hipótesis de referencia, NO reglas adoptadas)

Se usan secuencias fijas de `H` (cara) y `T` (cruz) y **sin** efectos no declarados.

**E1 — monedas positivas.** Base Power 5, tres monedas de Coin Power +3. Con `T,H,H`: `Power=5+0+3+3=11`. En ataque con esos resultados, el poder progresivo por golpe sería `[5,8,11]`; no sumar `5+8+11` a una tirada de choque.

**E2 — monedas negativas.** Base Power 18, tres monedas de -4. Con `H,T,H`: `Power=18-4-0-4=10`; durante ataque progresivo `[14,14,10]`. Cara no significa necesariamente mayor Power.

**E3 — choque con ganador y ataque separado.** A usa Base 5, 2 monedas +3; B Base 8, 1 moneda +2; sin otros modificadores. Intercambio 1: A `H,H => 11`, B `H => 10`. B pierde su única moneda normal; A gana con dos. **Nueva tirada independiente de daño** para A: `T,H` da dos impactos de poderes `5` y `8`. Con factores de daño unitarios y sin defensas, **13 de daño total** en el modelo de ejemplo (`5+8`), no 11, no 22, y no daño automático cuando empieza el choque.

**E4 — empate y continuación.** A obtiene poder de choque 7 y B también 7: ninguno pierde moneda. En el siguiente intercambio, si A=9 y B=7, B pierde su primera moneda apta. Un empate no equivale a un acierto crítico ni cancela instantáneamente el encuentro. Si todos los intercambios empatan, el tope 99 de [L8] es **variante pendiente**.

**E5 — nivel de ataque para choque.** Ofensiva 45 frente a 40: diferencia +5, bono propuesto `floor(5/3)=+1` para el superior. Con 46 frente a 40: diferencia +6, `+2`. Este bono **no** se añade automáticamente al Power usado para daño.

**E6 — probabilidades ligadas a Sanity, no arbitrariedad.** Sanity -45 => `5%` cara; 0 => `50%`; +45 => `95%`. La propuesta no obliga a usar Sanity: el Director debe aprobarlo.

**E7 — daño por moneda, multiplicadores separados.** Coin attack Power 10; resistencia física 1.5 => contribución +0.5; resistencia de afinidad 0.5 => contribución -0.25; sin otros términos estáticos; bonus dinámico +20% => `10*(1+0.5-0.25)*(1+0.20)=15` daño **antes del redondeo**. No multiplicar `1.5*0.5` ni restar «resistencia 5» por analogía con Legacy. Este ejemplo **no** autoriza la fórmula final ni el redondeo.

**E8 — niveles en daño.** Offense 45, Defense 40 => `Δ=5`; término de nivel `5/(5+25)=0.166666…` (aprox. +16.67% dentro del bloque estático), no `+5` puntos de daño ni `+1 Clash Power` aplicado dos veces.

**E9 — moneda perdida.** A tenía 3 monedas con efectos distintos; pierde dos monedas normales iniciales, pero gana el choque con la tercera. La fase de ataque solo ejecuta **la tercera**; los `On Hit` de las primeras no se disparan.

**E10 — moneda inquebrantable.** Si pierde el choque y su moneda queda `Cracked`, no destruirla como normal ni disparar automáticamente un ataque completo: debe quedar una fase de respuesta condicional y limitada conforme a la regla especial que el Director apruebe.

## 4. Secuencia técnica implementable propuesta (bloqueada hasta aprobación)

### Modelo de datos candidato (pseudocontrato, NO registro ni archivo runtime)

~~~text
rulesetId: 'moon-system'
MoonEncounter {
  encounterId, phase, round, revision, rngCursor?, unitsById,
  skillSlots, actionPlan, clashes, eventQueue, appliedActionIds
}
MoonUnit {
  unitId, ownerRuleset: 'moon-system', catalogueId, hp?, sanity?,
  offenseLevel?, defenseLevel?, speed?, resistances?,
  resourcePool?, statuses?, skillRefs?, active
}
MoonSkill {
  skillId, basePower, orderedCoins: [
    {coinId, coinPower, kind: normal|unbreakable, triggers: []}
  ], clashOnlyModifiers?, attackModifiers?, damageType?, affinity?,
  eventRules?, resourceRequirements?
}
MoonIntent {
  sessionId, rulesetId:'moon-system', actionId, revision, encounterId,
  actorId, targetIds, skillId, skillSlotId, phase
}
MoonProposal {
  rulesetId:'moon-system', actionId, revision,
  clashTrace:[{exchange, rollsA, rollsB, powerA, powerB, brokenCoinId?, tie}],
  result: win|lose|unopposed|canceled|special,
  attackTrace:[{coinId, head, finalPower, damageBeforeRound, damage?, triggers:[]}],
  resourceDelta?, statusEvents?, worldEffectRequests?, postStateHash?
}
~~~

Los campos con interrogación **no están definidos ni aprobados**; son posibles dependencias. La identidad autorizada de la sesión y la clave multimodo de persistencia siguen siendo del sistema común; el contenido del guardado será estrictamente Moon cuando exista su adaptador autorizado.

### Canal de ejecución y autoridad

1. **Validar** `rulesetId`, sesión, identidad, actor/catálogo Moon, objetivos autorizados, fase, turno, slot, requerimientos y capacidades de mundo; rechazar Sombras, DnD, `FHSkills` y recursos Legacy.
2. **Reclamar `actionId` antes de efectos/RNG** en una futura extensión del coordinador común. En reintento idéntico devolver resultado conocido; fingerprint distinto => conflicto. Ninguna ejecución por duplicado.
3. **Congelar entradas/estado** para la resolución. Usar RNG inyectado y secuencia trazable para reproducir choques y ataques; no llamar a motor físico ni mutar entidades desde la fórmula.
4. **Resolver** cada intercambio de choque y cada moneda de ataque por separado, generando `MoonProposal` con trazas y eventos. Si existen inquebrantables u otras reglas especiales no aprobadas, **rechazar la intención o declarar capacidad no disponible**.
5. **Revalidar autorización y revisión** antes de aplicar. El coordinador aplica resultados de reglamento **una sola vez**; motor/autoridad de mundo aplica solo efectos espaciales previamente autorizados. Si el guardado falla, no repetir daño/costes por usar el mismo `actionId`.
6. **Persistir** estado Moon, encuentro, fase, acciones reclamadas y RNG/replay necesarios. Diseñar primero versión/migración con compatibilidad de identidad multimodo, sin asumir que `rulesetVersion:1` admite los campos propuestos.
7. **Mostrar** HUD de monedas, Base Power, Coin Power, probabilidad condicionada, choque, monedas rotas/agrietadas, daño por moneda, estados y turnos **solo cuando esas reglas estén autorizadas y ejecutadas**.

### Separación de módulos que se propone después de aprobar

~~~text
juego/rules/moon-system/
  moon-combat.js          # evaluación pura, sin DOM/Three ni FHSkills
  moon-clash.js           # intercambio de monedas y trazas
  moon-status-events.js   # fases y disparadores autorizados
  moon-engine.js          # adaptador a capacidades físicas comunes
  moon-save-adapter.js    # estado privado moon-system y versión aprobada
tests/moon-*.test.cjs     # unitarias, contratos y motor ensamblado
~~~

Estos nombres son **propuestas de rutas**, no archivos creados. **No registrar** adaptador en el selector ni cambiar `planned` antes de aprobar, implementar y ejecutar pruebas.

## 5. Tabla de pruebas de aceptación diseñadas (NINGUNA ejecutada: no hay adaptador)

Las pruebas usarán un generador determinista que entregue caras/cruces declaradas; cada valor esperado de fórmulas candidatas aplica **solo** si el Director aprueba la variante indicada.

| ID | Entrada/escenario | Resultado esperado del modelo candidato | Bloqueo o condición |
| --- | --- | --- | --- |
| M-T01 | Base 5, +3 x3, T,H,H | choque 11; ataque secuencial 5,8,11 | fórmula Power aprobada |
| M-T02 | Base 18, -4 x3, H,T,H | choque 10; ataque 14,14,10 | monedas negativas aprobadas |
| M-T03 | Choque A 5,+3x2 HH vs B 8,+2x1 H | A gana, B pierde 1 moneda | choque normal aprobado |
| M-T04 | Ataque tras M-T03: A relanza T,H | daño base por moneda 5 y 8; total 13 sin mods | separación choque/ataque aprobada |
| M-T05 | Poder empate 7/7 | ninguna moneda perdida, nuevo intercambio | política empate aprobada |
| M-T06 | 99 intercambios empatados | cancelación sin daño solo en variante fiel a [L8] | **pendiente** tope |
| M-T07 | Diferencia Offense +2 / +3 / +5 / +6 | Clash bonus 0 / 1 / 1 / 2 | niveles aprobados |
| M-T08 | SP -45 / 0 / +45 | probabilidad 0.05 / 0.50 / 0.95 | **pendiente** Sanity |
| M-T09 | Moneda atacante Power 10, phys 1.5, sin 0.5, dinámico +0.20 | daño antes de redondeo 15 | **pendiente** daño |
| M-T10 | Offense 45, Defense 40 | modificador nivel 5/30 | **pendiente** nivel |
| M-T11 | 3 monedas; se rompen primeras 2 | sobrevive tercera; no `On Hit` de rotas | choque/eventos aprobados |
| M-T12 | Choque perdido con monedas normales agotadas | sin fase de ataque ordinario del perdedor | choque normal aprobado |
| M-T13 | Choque perdido con moneda inquebrantable | no eliminarla; rama `Cracked`/respuesta y límites | **pendiente** inquebrantables |
| M-T14 | `Clash Power +2` y `damagePower` sin otros mods | +2 solo al choque, **0** extra al daño | tipos de Power aprobados |
| M-T15 | Misma `actionId` enviada dos veces | resolución/coste/daño aplicados una sola vez | contrato coordinador |
| M-T16 | `actionId` igual con objetivo distinto | rechazo por conflicto sin efectos | contrato coordinador |
| M-T17 | revisión, sesión o fase caducada | rechazo antes de gasto/daño | contrato coordinador |
| M-T18 | `rulesetId:dnd/legacy` o catálogo de Sombra en Moon | rechazo, sin instanciar unidad ni reescribir guardados | frontera obligatoria |
| M-T19 | E.G.O con recurso insuficiente | rechazo atómico; nada consumido | **pendiente** E.G.O |
| M-T20 | skill sin monedas o Coin Power no finito | validación/rechazo, sin RNG ni mutación | validadores aprobados |
| M-T21 | 2 impactos y objetivo cae tras el primero | no duplicar efectos; política resto de monedas explicitada | **pendiente** post-muerte |
| M-T22 | redirección bloqueada por obstáculo del mundo | motor universal rechaza contacto/ruta, sin física nueva | frontera del motor |
| M-T23 | guardado Moon/motor y restauración | estado y revisión aislados; Legacy y DnD intactos | **pendiente** esquema/versionado |
| M-T24 | manifest Moon `planned` y adaptador ausente | selector deshabilitado, ningún lanzamiento Moon | situación actual obligatoria |
| M-T25 | Guard/Evade/Counter frente a ataque | condiciones exactas según variante aprobada; ninguna por defecto | **pendiente** defensas |

**Prueba numérica independiente de regresión documental (no una prueba del juego):** `5+3+3=11`; `18-4-4=10`; `5+8=13`; `10*(1+0.5-0.25)*1.2=15`; `5/(5+25)=1/6`. No presentar estos cálculos como `node --test` de un motor que no existe.

## 6. Decisiones numeradas para el Director — obligatorias antes de programar

| Decisión | Opciones a evaluar (no elegidas) | Impacto |
| --- | --- | --- |
| **D-01 Fidelidad** | reproducir núcleo Limbus documentado / adaptación propia explícita / subconjunto acotado | fija alcance y fuentes vigentes |
| **D-02 Power** | base + monedas firmadas / efectos adicionales delimitados / límites de potencia | evaluación y validación |
| **D-03 Monedas** | cantidad, orden, modificadores, caras y semillas, negativas, inquebrantables | RNG y trazas |
| **D-04 Sanity** | adoptar SP Moon propio con 50+SP / otra regla documentada y aprobada / sin Sanity | probabilidades, HUD, IA, guardado |
| **D-05 Choques** | intercambio con todas las monedas y rotura de una / variante expresamente diseñada | resolución, empates y estado |
| **D-06 Desempate** | tope 99 y cancelación / tope distinto explícito / otra solución aprobada | prevención de bucles |
| **D-07 Ataque** | relanzar supervivientes secuencialmente / variantes de daño y efectos autorizados | eventos, multi-impacto |
| **D-08 Daño** | fórmula de referencia completa / subconjunto con reglas declaradas; redondeo y mínimo | balance y tests |
| **D-09 Defensa** | Guard, Evade, Counter, clashables, Stagger, partes, inmunidad | defensor, daño y estados |
| **D-10 Recursos** | Sanity, afinidades, E.G.O, Charge/Poise/etc. elegidos uno a uno | economía, validadores |
| **D-11 Turnos** | velocidad, ranuras, intercepciones, orden y tipos de encuentro | controlador y UI |
| **D-12 Contenido** | catálogo de unidades, enemigos, NPC, armas y habilidades **originales/autorizadas Moon** | no copiar Sombras, DnD ni otros juegos |
| **D-13 Persistencia** | esquema y versión de estado Moon; migración y replay | guardados multimodo |
| **D-14 Integración** | capacidades físicas públicas y nuevo puerto Moon en coordinador, con pruebas | evita segundo motor y efectos dobles |

### Puertas de aprobación

- **Fase A (esta entrega):** investigación y especificación candidata, `NO APROBADA`, manifiesto `planned`, selector cerrado. Solo documentación en `main`.
- **Fase B (requiere Director):** registrar decisión explícita **D-01 a D-14** que aplique a un subconjunto, versiones de fuentes y casos límite. No convertir silenciosamente una fuente comunitaria en norma.
- **Fase C (implementación futura autorizada):** crear adaptador y pruebas unitarias deterministas; extender coordinador sin importar `bindDndCombat`, usar solo motor físico; probar persistencia, UI y unidades Moon.
- **Fase D (integración):** publicar incrementos **aprobados** directamente a `main`, con regresiones reales, sin acumular PR encadenados. Cambiar `planned` únicamente cuando el adaptador y su ruta jugable estén comprobados; no confundir pruebas de contrato con ejecución WebGL.

**Orden final:** ningún `FHSkills`, D20, PE/PG/PS Legacy, resistencia Legacy, enemigo de otro juego, moneda «50/50 por comodidad» ni cooldown artificial sustituyen las reglas Moon faltantes.
