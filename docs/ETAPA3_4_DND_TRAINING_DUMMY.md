# Etapa 3.4 — Integración DnD × Training Dummy (IA 4)

> **Alcance:** prototipo de combate DnD contra un **blanco neutro**. No es un reglamento completo de ninguna edición. Fuente normativa: [REGLAS_MODO_DND.md, §§8–9](./REGLAS_MODO_DND.md). El Dummy se incorporó en [PR #217](https://github.com/sokcrow/Blakpine-Wood/pull/217).

## Recorrido implementado

`jugador (HUD, F o attack(id)) → FHCombatTargetPort → FHSessionCoordinator.bindDndCombat → FHDndCombat.evaluate → FHTrainingDummyRuntime.receiveHit → persistencia DnD`.

- `juego/core/fh-combat-target-port.js`: solo acepta `training_dummy` existente, vivo, indestructible y declarado `rulesetId:dnd`. Comprueba piso, posición, proximidad y visibilidad/contacto mediante las capacidades espaciales inyectadas por **el mismo motor físico**. No resuelve ninguna tirada.
- `fh-multimode-save-hook.js`: vincula el puerto al motor real con `readRuntime:()=>window.FHTrainingDummyRuntime`. El contacto exige la proximidad de **una casilla física (`CELL`)**, adoptada únicamente como umbral de interacción del prototipo; para paredes, muebles, pisos y puertas consulta `fhNpcCanWalk(...,false)` con muestreo de segmento de 0.05 m. No añade un nuevo resolutor de colisiones, rutas o iluminación. `canContact` y `canSee` usan la misma **línea de visión geométrica**, no una regla DnD de oscuridad.
- **Cero Sombras en DnD:** la expresión que crea `FHShadowAI` devuelve `null` en una sesión `dnd`; el estado `GameState.horror` tampoco se importa como actividad DnD. El `FHLegacyEngineSession` original permanece intacto en la rama Legacy.
- `juego/rules/dnd/fh-dnd-engine.js`: crea únicamente intenciones jugador → `training_dummy` y utiliza el coordinador; no invoca `FHShadowAI`, GOAP, cooldown, fases, PE ni estados de criaturas prestadas. El HUD permite escoger un Dummy, atacar con botón o F.
- `juego/core/fh-session-coordinator.js`: acepta como destino `training_dummy` exclusivamente para un actor `player`, conservando el registro previo de `actionId`, autorización síncrona, revalidación, RNG y aplicación única. El puerto Legacy no cambia.
- `juego/rules/dnd/fh-dnd-combat.js`: para el Dummy valida un blanco de ensayo `{type:'training_dummy',hp:1,maxHp:1,defense,resistance}`, **no** una ficha de monstruo. Conserva `hit = (D20 + attackBonus >= defense)` y `rawDamage = max(0,D4 + damageBonus - resistance)` por defecto. Contra Dummy se **registra `rawDamage` sin limitarlo a su PG 1** y `defeated:false`; para objetivos normales se mantiene la fórmula anterior y sus límites. El umbral de demostración `defense:10` y `resistance:0` vienen **del prototipo existente**, no de una edición aprobada.
- `juego/units/fh-training-dummy.js`: su API expone `position(id)` a partir de la posición real del ítem en el mapa. `receiveHit` conserva siempre **PG 1/1, MOV 0, sin muerte, sin desaparición ni recompensa**, incrementa los aciertos y guarda el daño nominal sin aplicar daño real.
- `juego/rules/dnd/fh-dnd-save-adapter.js`: preserva el esquema privado DnD v1, pero evita copiar `horror` de Sombras al nuevo mundo guardado o al estado restaurado. Permite **leer** sobres anteriores que contenían esa propiedad y la descarta, sin reescribir claves Legacy. También retira del estado DnD restaurado y capturado los actores históricos con ID `fh-shadow-*`, manteniendo intactos los demás actores v1. Los golpes del Dummy se mantienen **en memoria de la sesión de entrenamiento**; no se inventa un formato duradero para su contador.

## Contratos y límites

**APROBADA:** independencia DnD/Legacy/Moon; Dummy como blanco de integración neutro; autoridad física compartida; una aplicación por acción; Dummy invulnerable. **PROTOTIPO:** fórmula D20/D4 parametrizable y umbral de ensayo, HUD, distancia física de una casilla. **PENDIENTE:** edición, iniciativa, turnos, críticos, reglas de muerte, bestiario DnD, persistencia opcional de impactos Dummy, e iluminación como requisito adicional de visibilidad si así lo decide el Director.

**Moon sigue `planned` y deshabilitado**. No existen llamadas de DnD a `FHSkills.roll` ni dependencia a módulos Moon.

## Pruebas de aceptación incluidas en la rama

- `tests/dnd-combat.test.cjs`: D20 acertado/fallido, modificadores/resistencia/daño nominal superior a PG 1, rango/contacto/visibilidad, 30 impactos sin destrucción, rechazo de Sombras, selección mediante HUD, coordinación y `actionId` sin doble aplicación, guardado/restauración DnD v1 sin `horror`, selector y hook.
- `tests/training-dummy.test.cjs`: posición física del Dummy, piso correcto, propiedad indestructible, golpes y validación.
- Las suites Legacy existentes (`fh-shadow-ai.test.js`, `legacy-combat-integration.test.cjs` y otras) permanecen sin cambios; los ataques originales de Sombras solo se invocan desde Legacy.

**Ejecución documentada durante desarrollo:** ver descripción final del PR para los resultados focalizados, distinguibles de Node nativo. La lectura de código y las pruebas sintéticas no prueban interacción WebGL manual. No esperar workflows de GitHub.

## Qué NO se cambió

No se cambiaron fórmulas normales de daño DnD, inteligencia de Sombras, combate Legacy, `FHSkills`, GOAP, motor físico central, navegación, generador de mapas, formato `forest-horror-map-v1`, economía de recursos DnD ni la disponibilidad del modo Moon. Solo se añadió una **consulta geométrica** al motor común desde el hook, no una física nueva.
