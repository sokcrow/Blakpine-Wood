# Etapa 2 — Contrato de integración del combate Legacy

**Responsable:** IA 1, arquitectura de integración del motor. **Destinataria:** IA 4.
**Fecha:** 17 de noviembre de 2026 (America/Ciudad_Juarez).
**Base comprobada:** `main`, commit `4e69a954150b2c9fa104fa26d827ec9eed3e955f`.
**Entrega exclusiva:** este documento; ninguna modificación ejecutable.

## 1. Decisión y alcance del cierre A1

El punto seguro es la llamada a `attack(actor,player,minute)` desde `tick`, en
`juego/assets/fh-shadow-ai.js:306–307`, después de comprobar la elegibilidad y
**antes de entrar en `attack`**. Con el puente activo, esa llamada directa debe
ser sustituida por un despacho exclusivo. La única continuación autorizada
volverá a invocar la función privada original, que conserva elección, coste,
dados, cooldown y emisión de `attack`; su consumidor actual conserva aplicación,
notificación y guardado. No se copia la fórmula ni se crea otro resolutor Legacy.

Este contrato resuelve el diseño de A1 y entrega las firmas de implementación.
**No afirma que el puerto esté instalado ni que A1 esté cerrado en ejecución.**
Hoy no existe ese puerto. El puente declara `connected:false` y el coordinador
solo prepara sesiones. Su conexión posterior requiere exponer las capacidades
descritas aquí y verificar las pruebas de aceptación. DnD/Moon siguen bloqueados.

Se contrastaron `docs/ETAPA2_AUDITORIA_INTEGRACION.md`, inventario §13,
`docs/CONTRATOS_MOTOR_MULTIMODO.md` §3 y README/código de núcleo y puente.
No se encontró en esta base otro informe que enumerase literalmente «A1»;
se usa esa etiqueta para el hallazgo descrito en la orden del director, consistente
con el bloqueo de la auditoría §6. **Comprobado** significa lectura del código;
**propuesto** significa API futura que este PR no implementa.

## 2. Fuentes y firmas existentes comprobadas

Todas las líneas siguientes pertenecen al commit fijado, no a un HEAD futuro.
Enlaces: [Sombras](https://github.com/sokcrow/Blakpine-Wood/blob/4e69a954150b2c9fa104fa26d827ec9eed3e955f/juego/assets/fh-shadow-ai.js),
[supervivencia](https://github.com/sokcrow/Blakpine-Wood/blob/4e69a954150b2c9fa104fa26d827ec9eed3e955f/juego/assets/fh-survival-core.js),
[consumidor](https://github.com/sokcrow/Blakpine-Wood/blob/4e69a954150b2c9fa104fa26d827ec9eed3e955f/index.html#L4821),
[puente](https://github.com/sokcrow/Blakpine-Wood/blob/4e69a954150b2c9fa104fa26d827ec9eed3e955f/juego/rules/legacy/fh-legacy-combat-bridge.js),
[coordinador](https://github.com/sokcrow/Blakpine-Wood/blob/4e69a954150b2c9fa104fa26d827ec9eed3e955f/juego/core/fh-session-coordinator.js).

| Archivo y líneas | Firma real / punto | Hecho relevante |
| --- | --- | --- |
| `juego/assets/fh-shadow-ai.js:23–45,310–318` | `FHShadowAI.createRuntime(options={}) -> {tick,dispose,read}` | `active`, RNG y funciones de ataque viven en el cierre. No existe export `FHShadowAI.attack`; ese nombre describe la función privada. Con `config.enabled===false` devuelve un runtime inerte. |
| Mismo archivo, `249–257` | `contactClear(actor,player) -> boolean`, privada | Reutiliza piso, alcance `touchFt` y `walkable`; no sustituir por otra colisión. |
| Mismo archivo, `259–268` | `attack(actor,player,minute) -> undefined`, privada | `chooseAttack` → decremento PE si potenciado → `rollD4` una o dos veces → `lastHit=minute` → callback `attack`. |
| Mismo archivo, `269–308` | `tick(minute,dt,player) -> undefined` | La elegibilidad culmina en `306–307`. `move` ya pudo gastar PE por fase en `239–241`: ese coste de movimiento queda fuera del ataque. |
| `index.html:4821–4843` | `addShadowEncountersToEngine(doc) -> doc` | La cadena `insert` de la línea 4822 crea `fhHorror` con `FHShadowAI.createRuntime`, `chooseAttack` y `onEvent`. La 4826 inyecta `tick` y construye `player` sin ID de personaje. |
| `index.html:3761,4728–4738` | `window.FHCharacterRuntime.character`; `window.FHSurvivalRuntime=fhSurvival` | Son accesos al estado del iframe. La fachada de personaje no es un snapshot inmutable. |
| `juego/assets/fh-survival-core.js:22–25,46–83,197` | `FHSurvival.createRuntime(gameState,callbacks={},initialMinute)`; runtime `change(key,delta) -> boolean`, `damagePG(amount) -> boolean` | Captura `gameState.character.resources`. `damagePG` limita PG y llama a `checkCritical`; `change('pg',...)` no equivale a esta operación. |
| `juego/rules/legacy/fh-legacy-combat-bridge.js:31–35,67–104` | `FHLegacyCombatBridge.create({sessionId,playerId,authorize,playerAttack,structureAttack}={})`; `bridge.executeOnce(value) -> Promise` | Las tres dependencias deben ser funciones para `prepared:true`. Guarda la promesa por acción antes de llamar callbacks. No instala el puerto. |
| Mismo archivo, `79–90` | `authorize(intent) -> true o Promise<true>`; `playerAttack(intent)` / `structureAttack(intent)` | Solo `true` autoriza; elige una operación por tipo de objetivo. Aun con callbacks síncronos, hay microtareas/`await`: es obligatoria una revalidación justo al ejecutar. |
| Mismo archivo, `97–104` | `getStatus() -> {prepared,connected:false}`; `evaluate()` | `evaluate` rechaza con `LEGACY_PURE_RESOLVER_UNAVAILABLE`. No usarlo para invocar el ataque. |
| `juego/core/fh-session-coordinator.js:28–64` | `FHSessionCoordinator.create({readSelection,worldLoader,rulesAdapter}={}) -> {prepare}`; `prepare(selection) -> Promise` | No hay registro de sesión activa, método de combate ni `validateAndApply` exportado. Sin selección devuelve `{kind:'legacy'}`. Una preparación no autoriza efectos. |

## 3. Flujo anterior y descarte de puntos tardíos

1. El iframe alimenta `fhHorror.tick(minute,dt,player)`.
2. `tick` gestiona aparición, objetivos y movimiento. Comprueba jugador despierto,
   desplazamiento acumulado, proximidad, cooldown y `contactClear`.
3. Llama directamente a la función privada `attack`.
4. `attack` consulta `chooseAttack`, consume **PE de criatura**, consume RNG para
   1d4/2d4, actualiza `lastHit` y emite `onEvent('attack',payload)`.
5. El consumidor de `index.html:4822` invoca `survival?.change('sp',-damage)`
   para La Niña o `survival?.damagePG(damage)` para El Alto.
6. Solo si `changed` es verdadero emite `GameEvents.emit('combat:damage',...)`,
   presenta el aviso y llama a `saveProgress()`.

Interceptar al principio de `onEvent('attack')` permite frenar el descuento,
pero llega después de PE/RNG/cooldown. `chooseAttack` solo selecciona
normal/potenciado y tampoco ofrece cancelación o sustitución completa.
`combat:damage` llega aún más tarde. Ninguno satisface A1.

El payload interno de `attack` tiene `id,kind,category,resource,damage,dice,
peSpent,pe,minute`. La notificación del bus contiene
`sourceId,category,kind,resource,damage`; no lleva sesión, objetivo ni acción.
`damage` es importe solicitado, no necesariamente delta efectivo después del
límite a cero. Si `changed` es falso, puede haber coste/cooldown sin notificación.

## 4. Firmas propuestas para exponer la frontera

**Todo este apartado es diseño nuevo, no una descripción de exports presentes.**
Son contratos de funciones en memoria; no añaden un esquema JSON canónico,
campos al mapa ni formatos de guardado. Las funciones/capacidades no viajan
por `postMessage` ni se entregan a un adaptador de reglas no confiable.

### 4.1 Puerto del runtime de Sombras

```ts
// Método futuro del objeto devuelto por FHShadowAI.createRuntime.
shadowRuntime.connectCombat({
  sessionId, playerId, readContext, requestAttack
}): { close(): void }

readContext(): LegacyLiveContext | null          // síncrono, anfitrión de confianza
requestAttack(intent: LegacyIntent,
              operation: LegacyAttackCapability): Promise<LegacyCompletion>

type LegacyIntent = {
  sessionId: string; rulesetId: 'legacy'; actionId: string;
  revision: number; action: 'attack';
  actor: { kind: 'creature'; id: string };
  target: { kind: 'player'; id: string };
};
type LegacyLiveContext = {
  sessionId: string; rulesetId: 'legacy'; playerId: string;
  revision: number; minute: number;
  player: {
    floor: number; x: number; z: number;
    sp: number; spMax: number; pg: number; pgMax: number;
    sleeping: boolean; inElevator: boolean; outside: boolean; inactive: boolean;
  };
};
type LegacyAttackCapability = {
  authorize(): boolean; // sin gasto ni RNG; consulta contexto vivo y registro privado
  execute(): null;      // síncrona; revalida y llama al attack privado una sola vez
};
type LegacyCompletion = {
  status: 'completed'; sessionId: string; actionId: string; result: null;
};
```

La configuración queda ligada a una única generación del runtime y a una sesión
Legacy activa. Rechazar conexiones simultáneas, IDs vacíos y funciones ausentes;
un runtime deshabilitado no ofrece una conexión operativa. Un `close()` revoca
la generación y las capacidades pendientes, es idempotente y no restaura la ruta
directa durante esa sesión. Para volver al Legacy sin puente se cierra la sesión
y se crea un runtime nuevo. No se cambia de ruta con acciones pendientes.

`readContext` se implementará en el dueño del motor, con acceso de lectura a
`GameState`, `currentFloor`, `user`, reloj, sueño y ascensor. Debe comprobar
`GameState.character.id===playerId`, que el runtime de supervivencia esté
asociado a los recursos de ese personaje y que la sesión siga activa. No basta
con reutilizar el objeto `player` recibido en un tick anterior o leer
`FHShadowRuntime.read()`: este último no expone cooldown ni toda la autorización.
Los booleanos deben reflejar la política actual del motor, sin inventar estados.

El corte exacto se implementará sustituyendo la llamada de `tick:307` por un
despacho privado, por ejemplo `dispatchAttack(actor,player,minute)`. Sin conexión
configurada en un runtime nuevo, el despacho llama una vez al `attack` original.
Con conexión activa, crea intención/capacidad y **retorna tras `requestAttack`**:
jamás ejecuta además la rama directa. Si la conexión está revocada o falla,
rechaza esa intención; no usa Legacy directo como recuperación.

`execute` es una continuación de confianza del cierre original, no otro
resolutor: revalida todo, marca consumida la capacidad antes de entrar en
`attack(actor,live.player,live.minute)`, invoca esa función sin copiar su cuerpo y
retorna `null`. No tiene `await` entre la última validación y la llamada. Conserva
el callback `onEvent` existente, que realiza la aplicación original una sola vez.
Si ese callback falla después del gasto o daño, la capacidad sigue consumida.
No se convierte `attack` en un evaluador puro ni se cobra el coste por separado.

### 4.2 Unión futura en el coordinador y relevo a IA 4

```ts
// Método futuro del coordinador; NO existe junto a prepare en la base examinada.
coordinator.bindLegacyCombat({
  sessionId: string,
  playerId: string,
  shadowRuntime: ShadowRuntimeWithCombatPort,
  readContext: () => LegacyLiveContext | null,
  structureAttack: (intent: LegacyStructureIntent) => unknown
}): { close(): void }
```

Este método exige una sesión **activa** y las capacidades reales del motor;
no puede deducirlas de `{kind:'prepared'}` ni de `prepared:true` del puente.
El futuro registro de activación debe ligar sesión, generación del motor, mapa,
personaje y reglamento; no está implementado por `prepare`.

El enlace conserva **una sola instancia** de `FHLegacyCombatBridge.create` por
sesión y un registro privado de capacidades por `actionId`. El cableado exacto es:

| Entrada o dependencia | Delegación propuesta |
| --- | --- |
| `requestAttack(intent,operation)` del puerto | Admitir solo intención emitida por este runtime y ligada a esta capacidad; registrar la pareja antes de delegar; llamar `bridge.executeOnce(intent)` y devolver su promesa. No evaluar, tirar ni descontar aquí. |
| `authorize(intent)` del puente | Verificar sesión/generación/identidades y pareja registrada; devolver exactamente `operation.authorize()===true`. |
| `playerAttack(intent)` del puente | Buscar la misma pareja, comprobar de nuevo contexto e igualdad del sobre y llamar una vez a `operation.execute()`. El retorno `null` produce el `LegacyCompletion` descrito. |
| `structureAttack(intent)` del puente | Puerto independiente del propietario estructural; no se fabrica desde este ataque de Sombras ni se redirige a `playerAttack`. |
| `close()` del enlace | Revocar primero la sesión/generación, cerrar el puerto y liberar capacidades. Rechazar operaciones pendientes que todavía no hayan comenzado; no deshacer efectos ya ejecutados. |

El registro no debe permitir que otra entrada reemplace la capacidad de un ID
existente. Una retransmisión legítima reutiliza intención y promesa; una pareja
distinta se rechaza. Tras completar puede liberar la capacidad, conservando el
resultado/error deduplicado en el puente durante toda la sesión. No crear un
puente nuevo por tick, ataque o reintento.

El puente actual exige también `structureAttack` para estar preparado. Si aún no
hay puerto estructural completo, el enlace limita explícitamente su entrada a
criatura → jugador y suministra una función que rechaza siempre las operaciones
estructurales; nunca una función que simule éxito. Esto no acredita soporte de
estructuras. Alternativamente se pospone la activación hasta disponer del puerto
estructural real. En ambos casos se mantiene bloqueada cualquier ruta estructural
no verificada. No se inventa un importe para `FHStructureHealth.takeDamage`.

`bindLegacyCombat` es una vía operativa específica, diferente de
`CombatAdapterPort.evaluate/SessionCoordinatorPort.validateAndApply`: no hacer
pasar esta operación con efectos por una propuesta pura. No modificar
manifiestos `planned` para saltar el rechazo de `prepare`. La integración de
otros reglamentos y el aislamiento de sus partidas siguen siendo trabajo aparte.

## 5. Identidad, autorización y exclusión

El sobre reutiliza exactamente las siete claves admitidas por `readIntent` del
puente (`fh-legacy-combat-bridge.js:37–63`). No admite `damage`, `resource`,
dados, callbacks ni propiedades adicionales. Se copia y congela. Esta ruta usa
solo criatura → jugador; la unión amplia del puente no amplía permisos del motor.

| Identidad / condición | Comprobación obligatoria antes de ejecutar |
| --- | --- |
| Sesión | `sessionId` opaco nuevo por activación, ligado al runtime/generación y al personaje/mapa activos. No usar título de mapa, clave de guardado o minuto como identidad de sesión. Reabrir invalida la sesión anterior. |
| Reglamento | Igualdad exacta `'legacy'` en intención, contexto y enlace. No fallback desde DnD/Moon ni revisión de estadísticas de otro modo. |
| Atacante | `actor.kind==='creature'`; `active.get(intent.actor.id)` debe ser la misma instancia capturada, no solo compartir el texto del ID. Verificar no eliminado, no expirado y runtime no dispuesto. Resolverlo en el `Map` privado, nunca desde el payload posterior o una malla visual. |
| Objetivo | `target.kind==='player'`; ID igual a `playerId` ligado y al `GameState.character.id` vivo. Verificar propietario de recursos disponible y correcto. Cambio de personaje invalida la sesión. |
| Acción | `action==='attack'`; `actionId` estable emitido por el dueño antes de resolución, por ejemplo `sessionId + ':shadow-attack:' + contadorMonotono`. No RNG ni reloj como generador. Una oportunidad pendiente conserva el mismo ID. |
| Revisión | Entero seguro no negativo, igual a la revisión viva. Avanza ante cambios relevantes de actores/recursos/contacto, reloj de elegibilidad o ciclo de sesión; no es `GameState.version` ni `state.seq` de aparición. El motor debe suministrar esta revisión, hoy inexistente. Se comprueba otra vez justo antes del ataque. |
| Elegibilidad física y de estado | Reutilizar `contactClear` y validaciones del motor: piso, distancia, contacto sin obstáculo, cooldown, noche/expiración, jugador despierto, activo, dentro y fuera del ascensor. No clonar navegación o colisiones en el puente. |
| Movimiento habilitante | La intención certifica el `moved` calculado por `tick` para esa oportunidad. No acumularlo otra vez ni exigir un segundo movimiento en la microtarea. Si cambió la revisión relevante desde entonces, rechazar la oportunidad. |

La revisión no sustituye comprobar valores reales. Dado que el puente espera
`authorize`, la capacidad `execute` debe repetir las comprobaciones aunque la
autorización previa haya sido verdadera. Sus callbacks son síncronos y de
confianza. Si la futura arquitectura no puede suministrar contexto vivo y
revisión coherentes, la conexión permanece deshabilitada.

Mantener una reserva privada **por atacante** mientras su intención esté
pendiente, sin tocar PE ni `lastHit`. Registrar antes de invocar al coordinador
y conservar hasta resolución/rechazo. Ticks repetidos o reentradas no crean nuevos
IDs para la misma oportunidad. Liberar con ambos resultados y manejar el rechazo
de la promesa sin dejar `unhandledRejection`. Una acción rechazada no se reenvía
con otro ID para forzarla: solo una oportunidad posterior, nuevamente elegible,
puede crear otra acción. No convertir el bloqueo pendiente en cooldown de juego.

Dos atacantes distintos pueden generar acciones distintas. Cada operación
síncrona termina antes de iniciar la siguiente; si la primera cambia revisión o
deja crítico al jugador, la segunda revalida y se rechaza cuando corresponda.
No se promete atomicidad durable, rollback o ejecución distribuida exactamente
una vez. El puente evita repetir la invocación dentro de su instancia; el motor
evita ejecutarla además por otro camino.

## 6. Flujo propuesto con puente activo

1. `tick` mantiene su elegibilidad actual y llega al corte `306–307`.
2. El despacho reserva al atacante, captura revisión y emite una intención sin
   PE de ataque consumido, sin dados y sin actualización de cooldown.
3. El enlace registra capacidad y llama exclusivamente a `executeOnce`.
4. El puente valida el sobre, registra la promesa y llama a `authorize`.
5. `playerAttack` llega a la capacidad privada. Esta revalida y se consume antes
   de llamar una vez al **`attack` original**.
6. El `attack` original selecciona normal/potenciado, cobra PE de criatura,
   tira dados, actualiza cooldown y emite el callback original.
7. El consumidor original delega una vez en `change('sp',...)` o `damagePG`.
   Conserva comprobación de crítico, aviso y guardado actuales.
8. `combat:damage` queda exclusivamente como notificación posterior. La promesa
   completa con `result:null`; se libera la reserva pendiente. No se vuelve a
   aplicar daño al completar la promesa ni al observar el evento.

`completed` solo certifica que retornó la operación; no certifica delta de daño.
Un ataque sin cambio conserva su coste y cooldown como ahora. El contrato no
añade un nuevo evento obligatorio ni altera el payload Legacy para aparentar
una transacción que actualmente no existe.

## 7. Puntos de trabajo posteriores y riesgos

| Responsable / archivo | Integración futura necesaria | Riesgo a impedir |
| --- | --- | --- |
| Dueño del motor, `juego/assets/fh-shadow-ai.js` | Puerto `connectCombat`, despacho exclusivo en `tick:307`, reserva/capacidad privada y revocación en `dispose`; reutilizar `attack:259–268` y `contactClear`. | Ejecutar ataque directo y puente; duplicar RNG/PE; conservar actor eliminado; reentrada por callback. |
| Dueño del motor, frontera hoy en `index.html:4822,4826` | Proveer contexto vivo, identidad y ciclo de activación desde el cierre real. Conservar un único consumidor de `attack` y sus mutadores. | El contexto no está expuesto hoy: un script externo que observe globales no equivale al puerto soportado. No añadir otro parche textual ni envolver globales como solución. |
| IA 2/coordinación, `juego/core/fh-session-coordinator.js` | Registro de activación y `bindLegacyCombat`; enlazar cierre, revisión e identidades. | Confundir preparación con sesión activa; recrear puente por acción; cambiar reglamento durante una ejecución. |
| IA 4, `juego/rules/legacy/fh-legacy-combat-bridge.js` | Consumir las capacidades mediante los callbacks existentes de `create` y `executeOnce`. No necesita otra fórmula Legacy. | Usar `evaluate`, repetir descuento en notificación o dar éxito ficticio a estructuras. |
| Dueño de recursos, `juego/assets/fh-survival-core.js` | Conservar `damagePG`/`change` y su identidad de recursos. No se requiere modificar sus fórmulas para este contrato. | Omitir `checkCritical`, mezclar PE de criatura/jugador o aplicar daño a otro personaje. |

La frontera del anfitrión reside hoy en texto inyectado. Una tarea posterior
debe exponerla de forma soportada desde fuente mantenible; **este documento no
autoriza ni prescribe modificar Base64 o instalar otro hook**. Sin acceso al
cierre real, el puerto no puede declararse conectado. La entrega documental no
elimina ese trabajo ni habilita gameplay multimodo.

Fallo de autorización: cero gasto de ataque, cero RNG de ataque, cero cooldown y
cero daño. Fallo tras empezar `attack` (por ejemplo aviso/guardado): conservar el
error deduplicado y reconciliar por el dueño; nunca reintentar automáticamente,
retornar a la llamada directa o repetir con un nuevo ID. Separar esos RNG/costes
de los de aparición/fase, que pueden haber ocurrido antes del corte.

Miedo/pesadillas, habilidades, supervivencia temporal, daño estructural,
colisiones, visibilidad y persistencia de modos ajenos mantienen sus propietarios.
No usar este enlace como certificación de aislamiento de partidas DnD/Moon.

## 8. Pruebas necesarias para aceptar la conexión real

Estas pruebas de la frontera nueva están **pendientes de implementación**.
Las simulaciones del puente existentes no las reemplazan.

| Caso | Evidencia exigida |
| --- | --- |
| Corte previo | Detener una intención del runtime real en el puerto; comparar PE de criatura, contador de RNG de ataque, `lastHit`, PG/SP y eventos antes/después: ningún efecto de ataque. Aislar RNG de aparición y PE de fase. |
| Exclusividad | Conectar `tick` real → enlace → puente → capacidad → consumidor real con `FHSurvival`. Contar una selección, una resolución (1 o 2 dados según el caso), un gasto/cooldown, una aplicación, un aviso y un guardado cuando `changed`. Cero llamada directa adicional. |
| Compatibilidad sin puente | Misma semilla/secuencia de entradas: mismos ataques, PE, recursos, tiempos y eventos que la base; normales y potenciados de ambas criaturas. |
| Deduplicación y reentrada | Mismo ID repetido/concurrente comparte promesa; claves reordenadas equivalen; IDs en conflicto se rechazan. Reentrada durante `chooseAttack`, `onEvent`, aviso o guardado no ejecuta otra capacidad ni crea otra oportunidad pendiente. |
| Identidades | Sesión cerrada/reabierta, actor eliminado/recreado, personaje cambiado, tipo de objetivo ajeno, reglas ajenas, ID/capacidad sustituidos: rechazo anterior a todo efecto. |
| Carrera asíncrona | Cambiar puerta/contacto, piso, revisión, sueño, ascensor, estado crítico o expiración entre `authorize` y `execute`: rechazo sin coste/RNG/cooldown/daño. El movimiento habilitante original no se exige dos veces. |
| Dos Sombras | Pendientes independientes; tras el primer ataque la segunda revalida revisión y crítico. Sin cobros al PE del jugador. |
| Propietarios y límites | PG llega a cero con `checkCritical`; SP se limita sin crear reserva PS; objetivo ya a cero conserva semántica de `changed:false`. Observar `combat:damage` nunca descuenta. |
| Fallos | Excepción después de PE, daño, notificación o guardado no reintenta ni ejecuta fallback. Promesas rechazadas manejadas; reserva liberada; cierre revoca pendientes. |
| Capacidades ausentes | Runtime deshabilitado, supervivencia incorrecta/ausente, revisión no disponible o cierre no expuesto impiden activar el enlace. Estructuras no soportadas rechazan sin recursos/geometría alterados. |
| Motor ensamblado y navegador | Verificar carga y ciclo real del iframe, una única instalación y cierre, PG/SP/crítico, avisos y guardado. Abrir/cerrar/reabrir sin callbacks de sesión previa; no limitarse a callbacks simulados. |

## 9. Verificación de esta entrega

**PASS documental:** firmas y corte contrastados con la base fijada. Se ejecutó
con Node `v24.22.1`:

```sh
node --test tests/legacy-combat-bridge.test.cjs tests/mode-session.test.cjs juego/assets/fh-shadow-ai.test.js juego/assets/fh-survival-core.test.js juego/assets/fh-preview-boot.test.js
```

Resultado: **76 pruebas aprobadas, 0 fallidas**. La suite de arranque compone el
motor real y ejecuta fragmentos en Node/VM; no modifica sus fuentes Base64.
Los tests del puente usan operaciones simuladas y el propietario de recursos
real, no una conexión jugable del puente con Sombras. No se ejecutó navegador
ni WebGL. Las pruebas nuevas de §8 y la activación real siguen **pendientes**.

También pasó `node contratos/multimodo/validar-contratos.mjs`: **846 aserciones
estructurales**, 3 mundos, 3 reglamentos y 9 combinaciones; no certifica modos
jugables. Se comprueba además `git diff --cached --check` y que el diff de entrega
contenga solo este documento. No se crean tests que simulen una frontera todavía
no implementada para declararla lista.

**Intocable en este PR:** gameplay, `index.html`, fragmentos `engine-*.js`, hooks,
`FHShadowAI`, `FHSurvival`, puente/coordinador ejecutables, recursos, mapas,
manifiestos, guardados y workflows. No se aplica daño ni se crea un resolutor.
