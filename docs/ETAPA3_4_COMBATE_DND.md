# Blakpine Wood — Etapa 3.4: DnD operativo

## Entrada jugable

Desde el editor en un origen **HTTPS**, abrir **Mundos y combate**, elegir
**Ciudad moderna** + **DnD** y pulsar **Iniciar partida**. Se reutiliza
`forest-horror/maps/DEMO_Interacciones.json` y el arranque original del motor.
Se exige el personaje del creador actual para la identidad durable del guardado;
sus estadísticas Legacy no se trasladan ni se modifican.

En el iframe de juego, el panel **Combate DnD** muestra puntos de vida y energía.
Al estar junto a una Sombra, pulsar **Atacar** o **F**. Las Sombras continúan
apareciendo y recorriendo el mundo por su propio sistema nocturno y GOAP;
sus ataques entran en el mismo coordinador DnD, sin llamar al daño Legacy.
El usuario puede perder puntos de vida DnD y derrotar a las Sombras.

## Resolución de prueba — parametrizable, no edición de DnD

- Dado de ataque de 20 caras por defecto; `tirada + bonus >= defensa` acierta.
- Daño por defecto 1D4, con `max(0, dado + bonus - resistencia)`.
- Coste de energía DnD por ataque, incluso fallido, por defecto 1.
- Estado privado por sesión: HP, defensa, resistencia, bonus, energía, actores,
  revisión y último ataque del jugador, todo persistido bajo `dnd`.
- El coordinador reclama cada `actionId` antes de ejecutar callbacks,
  comprueba sesión/revisión, evalúa y aplica el resultado **una sola vez**.
- El mismo `contactClear` de Sombras decide si un actor es atacable.
  No se crean colisiones, visibilidad, navegación ni físicas propias.

Valores iniciales en `juego/rules/dnd/fh-dnd-combat.js`:
jugador 20 HP / 6 energía, Sombra 8 HP / 4 energía,
defensa 10, resistencia 0, D20, D4, coste 1.
No se incluyen críticos automáticos, ventajas, iniciativa, clases,
atributos permanentes ni reglas de ninguna edición de DnD: pendientes de acuerdo.

## Fronteras

- `FHSessionCoordinator.bindDndCombat`: autorización y aplicación única.
- `FHShadowAI`: consultas reales de contacto, búsqueda y ciclo de vida.
- `FHDndEngine`: puente a acciones DnD del jugador/Sombras.
- `FHDndSaveAdapter`: contrato de persistencia multimodo, aislamiento de
  `character`, `stats`, `skills` y recursos Legacy.
- `FHMultimodeSaveHook`: instala combate y guardado DnD en el documento
  3D real, únicamente cuando la sesión declara `rulesetId:'dnd'`.
- El selector registra DnD solamente cuando los adaptadores existen;
  Legacy sigue nativo y Moon System sigue `planned` y bloqueado.

## Pruebas

```sh
node --test tests/dnd-combat.test.cjs tests/legacy-real-engine.test.cjs \
  tests/multimode-save-engine-hook.test.cjs tests/multimode-selector.test.cjs
node --test tests/mode-session.test.cjs tests/multimode-runtime.test.cjs \
  tests/multimode-architecture.test.cjs tests/multimode-save-runtime.test.cjs
node contratos/multimodo/validar-contratos.mjs
```

Las pruebas de integración ensamblan el motor embebido real en Node/VM.
Validación visual del HUD y WebGL en navegador HTTPS requiere ejecución en
navegador, que no equivale a estas pruebas.
