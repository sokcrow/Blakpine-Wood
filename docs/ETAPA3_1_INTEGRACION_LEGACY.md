# Etapa 3.1 — Combate Legacy conectado al motor

Base: `main` en `52fea4deef0422bf205b39f962915872aab52160`, con los PR #205 y #208 fusionados.

## Recorrido instalado

`frame → fhLegacySession.tick → FHShadowAI.tick → dispatchAttack → FHSessionCoordinator.bindLegacyCombat → FHLegacyCombatBridge.executeOnce → capacidad privada → attack original → consumidor original de index.html → FHSurvival`.

El corte ocurre antes de selección, PE, dados y cooldown. `attack`, `contactClear`, el GOAP y el consumidor de daño conservan sus implementaciones. `combat:damage` sigue siendo una notificación posterior; no se registra un consumidor que vuelva a descontar recursos.

El módulo `juego/core/fh-legacy-engine-session.js` recibe lectores desde el cierre del motor y vincula una sesión al personaje, sus recursos y su runtime de supervivencia. Captura esos propietarios en el primer tick, cuando ya terminó la inicialización. La revisión cambia al variar reloj, posición, estado o recursos. El runtime añade una generación por tick y comprueba identidad del actor, vigencia nocturna, cooldown, contacto y estado vivo antes de la continuación síncrona.

Cada atacante tiene una reserva pendiente. La capacidad se consume antes de llamar al ataque original; no hay fallback directo después de conectar, rechazar o cerrar. El coordinador y puente del PR #208 conservan deduplicación y rechazo de conflictos. Dos atacantes pueden despachar; si el primero cambia recursos/crítico, el segundo debe rechazar su revisión obsoleta sin gasto.

## Ciclo de vida

- Un runtime nuevo sin conexión conserva su ruta Legacy directa.
- El motor ensamblado carga puente, coordinador y propietario de sesión, en ese orden, y conecta una sola vez sin exigir selección multimodo.
- Cerrar el enlace revoca capacidades; no restaura la ruta directa. `dispose` impide ticks futuros.
- El editor cierra explícitamente la sesión antes de retirar el iframe. `pagehide` y `beforeunload` también cierran; el cierre es idempotente.
- Cambiar personaje, ID, recursos o propietario de supervivencia cierra la sesión. Reabrir crea otro runtime.

## Evidencia ejecutable

`tests/legacy-real-engine.test.cjs` compone el documento completo mediante el ensamblador del repositorio y ejecuta su fragmento real de Sombras y sesión. Carga las implementaciones de GOAP, Sombras, coordinador, puente y supervivencia. No reemplaza `attack`, su fórmula, su consumidor ni el puente por importes fijos. Fija RNG y entradas del mundo; sustituye presentación 3D, avisos y guardado por contadores en Node/VM.

Casos cubiertos: PG/PS únicos para ambas criaturas; PE de criatura y cooldown únicos; PE del jugador intacto; corte sin efectos antes de microtareas; dos atacantes; ticks repetidos; crítico y muerte; cambio de contexto; cierre, cancelación y reapertura; reentrada desde aviso; fallo tras daño; notificación sin mutación; dependencias y cierre del iframe. Para probar dos actores en contacto simultáneo se configura mayor alcance en esa fixture, porque la aparición real exige separación entre ellos; no se cambian los valores del juego.

Las suites existentes del puente mantienen concurrencia y repetición de la misma intención, conflictos de identidad/capacidad, cierre durante autorización y errores parciales. Las suites originales de Sombras conservan los casos directos sin conexión, colisiones y movimiento. Arranque comprueba sintaxis, composición y ejecución de fragmentos/fotograma del motor.

Comandos de validación:

```sh
node --test tests/*.test.cjs juego/assets/fh-shadow*.test.js juego/assets/fh-survival-core.test.js juego/assets/fh-preview-boot.test.js
node contratos/multimodo/validar-contratos.mjs
git diff --check
```

Resultado: **PASS, 239 pruebas aprobadas, 0 fallos, 0 TODO**.

En este entorno se usa `TMPDIR` dentro del workspace para las fixtures temporales del lector de perfiles. El validador canónico aprueba 846 aserciones. No acredita modos multimodo jugables.

## Límites y alcance conservado

Se intentó iniciar Chromium local para una verificación adicional; el entorno impide crear su socket de proceso (`Operation not permitted`). No se verificaron visualmente WebGL ni interacción manual. Las pruebas ejecutables del recorrido real son Node/VM, con límites de presentación e IO indicados arriba.

No se modifican fragmentos Base64, fórmulas Legacy, supervivencia, colisión, navegación, visibilidad, mapas, manifiestos, guardados, workflows ni adaptadores DnD/Moon. Sus estados `planned` siguen bloqueados. La ruta estructural del puente continúa rechazando operaciones sin puerto funcional. Esta integración no presenta `evaluate` como un resolutor puro ni habilita reglamentos adicionales.
