# Puente de ejecución Legacy — Etapa 2, IA 4

Base verificada: `main` en `6849134c8ca23671155fef9a2891ae4aec57a5d6`.
Leídos el informe `docs/ETAPA2_AUDITORIA_INTEGRACION.md` de IA 1 y los apartados
3.1–3.3 de `docs/CONTRATOS_MOTOR_MULTIMODO.md`. Las fuentes de combate citadas
no cambiaron respecto de la base `9c529398...` auditada por IA 1.

## Ruta real y bloqueo

| Responsabilidad actual | Implementación comprobada | Restricción |
| --- | --- | --- |
| Resolución de Sombras | `juego/assets/fh-shadow-ai.js:259–269`, `attack(actor,player,minute)` | Elige ataque, consume PE de criatura, tira dados y cambia cooldown antes de emitir `attack`. Es privada; la API solo expone `tick/dispose/read`. No es evaluación pura. |
| Daño PG del jugador | Consumidor de `attack` en `index.html:4822` → `FHSurvivalRuntime.damagePG` en `fh-survival-core.js:78–83` | Conserva límites y `checkCritical`. No sustituir por asignación ni por `change('pg', ...)`. |
| Daño PS del jugador | Mismo consumidor → `FHSurvivalRuntime.change('sp', -damage)` | PS visible es SP interna; no existe una segunda reserva PS. |
| Notificación del golpe | Consumidor anterior → `combat:damage`, aviso y guardado, solo si hubo cambio | Ya ocurrió el descuento. No volver a resolver ni aplicar desde ese evento. |
| PE del jugador | `FHSurvivalRuntime.spendPE` | Propietario distinto de `FHShadowAI.actor.pe`; el puente no transforma uno en otro. |
| Estructuras | `FHStructureHealth.takeDamage` → `damage`, destrucción/actualización, `structure:damage`, guardado | El dueño estructural conserva PG, vulnerabilidades, puertas y colisionadores. No usar PG del jugador. |

El callback de aplicación de Sombras también está construido en texto privado del
editor y cierra sobre el estado y guardado. **No hay un puerto público seguro para
inyectar hoy la operación completa**. Esta entrega no lo crea ni modifica HTML,
Base64, hooks o mecánicas. Tampoco supone que todo muro/objeto soporte daño: esa
decisión sigue siendo del propietario estructural existente.

## Funciones públicas

Script clásico: `FHLegacyCombatBridge`; CommonJS: `{ create, LegacyBridgeError }`.

`create({ sessionId, playerId, authorize, playerAttack, structureAttack })`
crea una instancia que el anfitrión debe conservar durante toda la sesión.
Identidades no vacías son obligatorias. Las tres dependencias son funciones de
confianza, capturadas al crear el puente; pueden ser síncronas o asíncronas:

| Dependencia | Obligación |
| --- | --- |
| `authorize(intent)` | Devolver exactamente `true` solo si sesión, actores, objetivo, revisión, alcance/contacto y permisos reales siguen autorizados. No consumir recursos. Consultar al núcleo existente; no implementar otra colisión o navegación. |
| `playerAttack(intent)` | Delegar **la operación Legacy completa** de criatura contra el jugador identificado: selección/resolución, coste/cooldown, aplicación por `damagePG` o `change('sp',...)` y notificaciones existentes. No cobrar PE del jugador por el PE de la criatura. Este puerto todavía no está expuesto por el motor. |
| `structureAttack(intent)` | Delegar la operación estructural al dueño existente y su `takeDamage({floorId,id,amount,kind,part})`, con el importe obtenido por la ruta Legacy autorizada. No escribir recursos del jugador ni geometría desde el puente. |

Los wrappers futuros deben preservar el receptor/estado de las funciones
originales y resolver IDs mediante registros autorizados. Deben revalidar en el
propietario si una espera asíncrona permite que cambie la revisión; el puente no
implementa transacciones del mundo ni serializa acciones distintas. Cada wrapper
realiza su operación una vez; no puede aplicar de nuevo desde sus observadores.

`getStatus()` devuelve `{ prepared, connected: false }`. `prepared` solo indica
que están suministradas las tres funciones; con simulaciones no certifica un
puerto real. `connected` permanece siempre falso en esta entrega. No hay setter
para anunciar una conexión inexistente.

`evaluate(intent, readonlyWorldSnapshot, rulesetState)` rechaza con
`LEGACY_PURE_RESOLVER_UNAVAILABLE`, sin ejecutar callbacks. No se disfraza
`attack()` como cálculo sin efectos. `id: legacy-combat-bridge-v1`,
`rulesetId: legacy` y `contract: blakpine-combat-adapter-v1` identifican el puente
preparatorio y su familia de integración, **no una implementación completa del
contrato de evaluación/aplicación**. El manifiesto oficial sigue `planned` y sin
`adapter`; no se modifica para hacerlo pasar por un adaptador implementado.

`executeOnce(intent)` recibe únicamente este sobre operativo en memoria (no un
nuevo esquema canónico ni formato de guardado):

- `sessionId`, `rulesetId: 'legacy'`, `actionId` no vacío.
- `revision`: entero seguro no negativo; `action: 'attack'`.
- `actor: {kind: 'creature'|'player', id}`. El jugador actor debe coincidir con
  `playerId`. El ataque contra jugador requiere actor criatura.
- `target: {kind: 'player', id: playerId}` o
  `{kind: 'structure', id, floorId, part: 'structure'|'reader'}`.

No admite campos adicionales, cantidades, recursos ni eventos posteriores como
entrada. Copia/congela la intención y elige un único callback por tipo de objetivo.
El puente no tira dados, descuenta recursos, emite eventos ni guarda partidas.
Devuelve una promesa de `{status: 'completed', sessionId, actionId, result}`;
`result` es la copia JSON congelada del retorno del propietario (`null` si no
retornó nada). `completed` indica retorno de la operación, no daño efectivo ni
éxito del ataque. El propietario conserva su semántica de `changed/ok`.

## Garantía de no repetición y límites

El registro por `actionId` se instala antes de cualquier callback. Una repetición
idéntica comparte la misma promesa y resultado/error; cambios de actor, objetivo,
piso, parte o revisión con ese ID producen `LEGACY_ACTION_CONFLICT`. La clave es
la identidad de la intención, no el ID del evento o el importe del daño.

La garantía cubre **una invocación completa por intención dentro de esa instancia**,
incluidos coste, resolución y daño delegados, no solo la notificación. Rechazos de
autorización, operaciones sin cambio y errores también quedan registrados. Si el
propietario mutó antes de fallar (incluido un fallo de notificación/guardado o
retorno no JSON), no se reintenta ni se revierte a ciegas: hace falta reconciliar
el estado por su dueño. Un nuevo ID representa otra acción; no usarlo para repetir
una operación de resultado incierto.

El anfitrión debe asignar un ID estable antes de resolver, mantener **un solo
puente por sesión** y enrutar la acción exclusivamente por él. Crear otro puente,
recargar o ejecutar simultáneamente la ruta original fuera del puente elimina
esa protección. No hay garantía distribuida o durable, migración ni registro en
partidas. El registro no se vacía ni expulsa entradas durante la sesión; se libera
con la instancia al finalizarla. No se prometen efectos exactamente una vez de
un propietario que falle; se garantiza no volver a invocarlo por la misma intención.

## Conexión futura al coordinador

1. Exponer con autorización un puerto completo anterior a `attack()` y a sus
   costes, conservando selección, RNG, cooldown, recursos y avisos Legacy.
2. Instanciar el puente único de sesión con wrappers de ese puerto, dueño
   estructural y autorización del núcleo. Evitar además la llamada directa antigua.
3. Añadir explícitamente al coordinador una ruta Legacy de ejecución que use
   `executeOnce`; hoy IA 2 solo prepara descripciones y no invoca ese método.
   No conectar el puente al método `evaluate` suponiendo que es puro.
4. Verificar en gameplay intención/coste/daño únicos, críticos, estructuras,
   fallos y guardados antes de cambiar el manifiesto a `implemented`. Para otros
   reglamentos, aislar identidades y persistencia como exige §3.3.

Esos pasos no están ejecutados ni autorizados por esta entrega. Sin selección,
el flujo Legacy existente sigue intacto; una selección explícita aún recibe
`RULESET_NOT_IMPLEMENTED` del coordinador. No se implementan DnD/Moon, miedo o
habilidades generales ni se toca `FHSkills`/`FHCharacterCore`.

Errores con `.code`: `LEGACY_SESSION_INVALID`, `LEGACY_DEPENDENCIES_MISSING`,
`LEGACY_INTENT_INVALID`, `LEGACY_TARGET_INVALID`, `LEGACY_ACTION_CONFLICT`,
`LEGACY_NOT_AUTHORIZED`, `LEGACY_OPERATION_FAILED`,
`LEGACY_PURE_RESOLVER_UNAVAILABLE`. `.cause` conserva fallos originales cuando
corresponde. Son diagnósticos para el consumidor, no cadenas de UI.

Pruebas: `node --test tests/legacy-combat-bridge.test.cjs`. Usan operaciones
simuladas de importes fijos y el propietario `FHSurvival` real para PG/SP/crítico.
No equivalen a conexión al motor ni a una sesión WebGL ejecutada.
