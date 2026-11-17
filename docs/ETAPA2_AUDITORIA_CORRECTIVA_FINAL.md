# Etapa 2 — Auditoría correctiva final (IA 6)

**Dictamen: NEEDS WORK.**

**Fecha:** 17 de noviembre de 2026. **Repositorio:** `sokcrow/Blakpine-Wood`.
**Main auditado y vuelto a consultar antes de redactar:**
`4e69a954150b2c9fa104fa26d827ec9eed3e955f`.

Permanecen los bloqueos **P1 A1 y A2**. No existe combate multimodo conectado
con garantía de coste/daño únicos, ni protección multimodo instalada en la ruta
de guardado de ambos contextos. **Las suites de IA 5 todavía no están en main.**
Los PR correctivos están abiertos y no se confunden con cambios integrados.

Las barreras actuales sí se conservan: DnD/Moon están en `planned`, el
coordinador los rechaza antes de cargar mundo, no se anuncia `connected:true`
y no se instala un segundo aplicador en `combat:damage`. No se observó una
contaminación real de partidas ni daño duplicado causado por estos módulos.
La ausencia de activación insegura permite mantenerlos bloqueados; no autoriza
dar PASS integral a la etapa.

## 1. Fuente original y referencias fijadas

Se leyó íntegra la auditoría original `docs/ETAPA2_AUDITORIA_FINAL.md` desde
el [PR #204](https://github.com/sokcrow/Blakpine-Wood/pull/204), head
`4833822ce2203579bbe569e0d45277cd513dc017`: ese documento tampoco está en main.
Se conservan sus identificadores A1–A5 y B1–B2 y sus prioridades originales.

| PR revisado | Head exacto | Estado consultado en GitHub |
| --- | --- | --- |
| [#205, contrato IA 1](https://github.com/sokcrow/Blakpine-Wood/pull/205) | `1b175ae0b4ac6ba3c9dfd209b96394e89a98f748` | Abierto, sin fusionar. |
| [#206, persistencia IA 2](https://github.com/sokcrow/Blakpine-Wood/pull/206) | `d4ccf78f051a9cd38b521bc9f117bacab4c051e4` | Abierto, sin fusionar. |
| [#207, lector IA 3](https://github.com/sokcrow/Blakpine-Wood/pull/207) | `cf72c65fbe62543dc4e222347b082d2d0371572d` | Abierto, sin fusionar. |
| [#208, enlace IA 4](https://github.com/sokcrow/Blakpine-Wood/pull/208) | `2e8dc3fac5c2a165fe2f68341a046f1ea7e75bd5` | Borrador abierto, sin fusionar. |
| [#209, suites IA 5](https://github.com/sokcrow/Blakpine-Wood/pull/209) | `378565c8179acd1522de60a89e021c3981b90af3` | Abierto contra main, sin fusionar. |
| [#210, reporte IA 5](https://github.com/sokcrow/Blakpine-Wood/pull/210) | `26e057e33c848312290b9bd8aceed1116f6ca436` | Abierto, sin fusionar. |

Se verificaron fuentes, diffs, blobs y pruebas directamente; los resultados
históricos del reporte IA 5 se distinguen de las nuevas ejecuciones de esta
auditoría. Dos pasadas conceptualmente independientes: corrección/seguridad y
arquitectura/contratos. No se ejecutaron subagentes ni se autorrepresenta como
independiente una prueba de navegador que no se repitió en este turno.

## 2. Estado de cada hallazgo original

`RESUELTO` exige satisfacer el hallazgo en su alcance de cierre; `PENDIENTE`
indica una carencia confirmada, aunque exista progreso en un PR; `NO VERIFICADO`
se reserva a una comprobación para la que falta evidencia suficiente. Las
pruebas PASS aisladas no cambian por sí solas el estado de un hallazgo operativo.

| Hallazgo original | Prioridad | Estado de cierre | Evidencia y PR correctivo |
| --- | --- | --- | --- |
| A1 — Ruta integrada de ejecución y aplicación única | P1 | **PENDIENTE** | Main conserva `attack` privado y llamada directa; no hay puerto `connectCombat`. #205 define el corte; #208 solo enlaza un puerto futuro y rechaza el motor real. Falta prueba completa de PE/RNG/cooldown y PG/SP únicos. |
| A2 — Aislamiento de partidas | P1 | **PENDIENTE** | Padre e iframe conservan la ruta Legacy sin discriminación de reglas. #206 valida sobres/claves aislados, pero está fuera de main y no protege el IO del motor. Reproducción con funciones reales acepta sobre Legacy etiquetado DnD en almacenamiento ficticio. |
| A3 — Suites IA 5 fuera de main | P2 | **PENDIENTE** | `git ls-tree` no encuentra las dos suites en HEAD; el comando para ejecutarlas en main falla por archivos ausentes. #209 contiene exclusivamente esas dos pruebas, pero sigue sin fusionar. |
| A4 — Validación de arranque inconclusa | P2 | **PENDIENTE**, con subbloque Node resuelto | Nueva ejecución completa en main: 19/19 PASS en 134,38 s. #210 diagnostica el presupuesto insuficiente del harness y documenta fallo de WebGL; sesión jugable completa sigue NO VERIFICADA por esta auditoría. No se atribuye el antiguo timeout a Etapa 2. |
| A5 — Seguridad física del lector pendiente | P2 | **PENDIENTE** en main/integración | #207 aporta dos lectores concretos y pasa las pruebas aisladas de confinamiento. Main aún exige `readJson` externo y el lector nuevo no está instalado en el motor. Transporte HTTPS desplegado no verificado aquí. |
| B1 — `evaluate` frente a `executeOnce` | P2 | **PENDIENTE** | #208 añade delegación operativa separada, pero no conecta el motor ni altera la comprobación permisiva de capacidad en `prepare`. Se reproduce `prepared` con puente real/manifest sintético, seguido del rechazo de `evaluate`, tanto en main como en el candidato. Las selecciones oficiales no activan esa condición. |
| B2 — Recorte textual privado del validador en tests | P3 | **PENDIENTE** | Patrón `function matchesType` → `const refs =` continúa en suites existentes y se repite en #207/#209. Ningún PR revisado expone un validador puro público. No se observó divergencia efectiva; no es P1. |

No se marca ninguno de los hallazgos operativos como RESUELTO en main solo por
existir un PR. El subresultado nuevo de A4 sí resuelve la incertidumbre de si
la suite Node puede terminar en este entorno; no certifica una sesión 3D jugable.

## 3. A1 y B1: combate y compatibilidad real

**Main, lectura directa:** `juego/assets/fh-shadow-ai.js:259–268` contiene la
función privada `attack`. `tick:306–307` la llama tras la elegibilidad; la API
en `310–318` solo expone `tick/dispose/read`. `attack` consulta selección,
consume PE de criatura, tira dados, actualiza `lastHit` y emite el callback
`attack`. En `index.html:4822` su consumidor llama a
`FHSurvivalRuntime.change('sp',-damage)` o `damagePG(damage)` y solo después
emite `combat:damage`, muestra aviso y guarda. La energía de fase conserva
su consumo independiente en `fh-shadow-ai.js:239–241`.

No hay suscriptor nuevo que aplique daño desde `combat:damage`, ni otro
resolutor Legacy, ni redirección de estructuras a recursos del jugador. El
problema es la ausencia del enlace solicitado, no un doble daño reproducido.

**Candidato #208:** `fh-session-coordinator.js:53–145` incorpora
`bindLegacyCombat`, una instancia de puente por enlace, registro de acción y
capacidad, reserva por atacante, comprobación de sesión/revisión, revalidación
síncrona, consumo de capacidad antes de ejecutar y revocación. Rechaza
estructuras por ese puerto; el puente amplio conserva su dominio independiente.
`fh-legacy-combat-bridge.js` añade validación sin efectos y cierre durante
autorizaciones pendientes. `getStatus` conserva `connected:false`.

Estas garantías se ejercitan con puerto sintético y FHSurvival real. La prueba
con FHShadowAI real devuelve `LEGACY_ENGINE_PORT_UNAVAILABLE`: no existe un
ataque de juego que atraviese todavía el enlace. El TODO de integración sigue
visible y no se cuenta como PASS. No se pueden certificar costes/RNG/cooldown
reales mediante un callback de importe fijo.

**Reproducción adicional de B1:** se suministró al coordinador real un
manifiesto `implemented` sintético con la identidad exacta del puente y un
cargador descriptivo simulado. En main y en el candidato #208, `prepare`
devuelve `prepared`, el puente informa `connected:false` y `evaluate` rechaza
`LEGACY_PURE_RESOLVER_UNAVAILABLE`. No se editó ningún manifiesto en disco ni se
aplicaron efectos. En #208 la comprobación original continúa en `159–167`.
La vía operativa nueva es un avance, pero no hace al puente un evaluador puro
ni demuestra que el contrato de preparación compruebe esa capacidad semántica.

**Condición para cerrar:** exponer el corte antes de `attack`, contexto vivo,
revisión y ciclo de sesión desde el dueño del motor; demostrar sustitución
exclusiva y pruebas reales de coste/daño, fallo parcial, crítico y cierre.
Las intervenciones de index/iframe/Base64 continúan sujetas al diff concreto
y autorización del Director. Esta auditoría no las realiza ni las autoriza.

## 4. A2: separación de persistencia, lectura y escritura

Las claves `blakpine_character_active_v1` y `fh_game_v1_<hash>` permanecen
intactas. El padre lee el guardado en `makeCurrent3DProject`
(`index.html:3398–3412`); el iframe restaura local/backup y escribe antes de
notificar al padre. El receptor de `FOREST_GAMESTATE_SAVE`
(`5203–5210`) comprueba clave/personaje y luego sincroniza. El filtro
`fh-character-core.js:84–118` no comprueba reglamento; sincronización de
PG/SP/PE, habilidades y muerte siguen siendo Legacy.

Se ejecutaron `readGameSave` y `writeGameSave` originales, extraídas solo en
memoria de la base del motor, junto con `selectMapSave` real. Un sobre v1
sintético con `characterId` coincidente y `rulesetId:'dnd'` se escribe, se
restaura como DnD y es aceptado por el filtro del padre. Se usó un `Map` como
almacenamiento y una clave ficticia de auditoría; **ninguna partida real fue
leída o alterada**. El resultado se mantiene incluso en el árbol candidato,
porque #206 no modifica esos lectores/escritores. Demuestra la barrera ausente,
no contaminación observada en una sesión DnD activa.

El módulo de #206 liga mapa/personaje/reglas/versión/slot a una instancia,
deriva una clave multimodo separada y requiere validadores de estado de
confianza. El sobre no incluye `version:1` en la raíz y los lectores Legacy
reales lo rechazan. Sus 9 pruebas aisladas pasan, incluidos rechazo cruzado y
claves Legacy preservadas en fixtures. No se hacen migraciones.

Para cerrar A2 falta conectar esa validación **antes** de cada lectura,
escritura, restauración y sincronización en ambos contextos, incluidos muerte,
sesión/generación y mensajes obsoletos. El filtro del padre por sí solo llega
tarde a la escritura local del iframe. Los validadores sintéticos no acreditan
un esquema funcional DnD/Moon ni protección instalada.

## 5. A5: seguridad del lector de perfiles

Main sigue delegando en `readJson` inyectado en `fh-mode-selection.js:34–56`
y `fh-world-profile-loader.js:30–55`. La validación canónica precede a las
referencias, pero no prueba por sí misma confinamiento del sistema de archivos
o transporte web.

Se revisó el lector concreto de #207 y se repitieron sus 18 pruebas:

| Frontera del candidato | Comprobación y resultado |
| --- | --- |
| Node/Linux, `72–127` | Raíz real fija, allowlist copiada por ruta/tipo, segmentos estrictos sin normalización/decodificación, rechazo de symlinks internos/externos y de directorio, `O_NOFOLLOW`, ruta del descriptor en `/proc/self/fd`, archivo regular y límite de bytes: PASS aislado. |
| Navegador, `154–205` | Base HTTPS explícita del mismo origen/subruta, `redirect:'error'`, URL final exacta, rechazo de respuestas opacas/HTML, streaming acotado y timeout: PASS en HTTP simulado/VM. No es validación de un servidor desplegado. |
| Contratos, `207–243` | Validadores canónicos suministrados por el anfitrión, tipo/versión conocidos, referencias autorizadas explícitamente; inexistencia, JSON/UTF-8 inválidos y error sin fallback: PASS aislado. |
| Compatibilidad | Se leen los tres perfiles y nueve pares existentes sin cambios a sus JSON; el mapa conserva sus unidades. |

**Límites confirmados:** raíz, allowlist, validadores y publicación son de
confianza; Node requiere Linux y `/proc`. No se demuestra seguridad contra un
proceso que reescriba concurrentemente la raíz. El navegador no inspecciona
symlinks, aliases o reescrituras del servidor; origen opaco/file no se admiten.
La misma cabecera del módulo documenta estos límites. No se encontró un escape
reproducido dentro de ese modelo, pero no se extiende la garantía a validadores
permisivos ni a una integración todavía inexistente.

## 6. Autoridad espacial y barreras de activación

Se comparó main con la base anterior `9c5293986664b67f4e21485ebb2f83a2577a4b68`
y cada candidato #205–#210 contra main en `index.html`, `juego/index.html`,
`juego/assets`, `contratos` y `forest-horror/maps`: sin diferencias en esas
rutas protegidas. La inspección de los nuevos módulos core/rules tampoco
introduce implementaciones alternativas de colisión, visibilidad o navegación.
Persisten `ForestShared.solidAt`, `canWalk`, FOW y `FHNPCGOAP.route` como fuentes
existentes; `authorize` es una obligación del futuro puerto, no otra simulación.

En el HTML realmente ensamblado no aparecen `FHModeSelection`,
`FHSessionCoordinator`, `FHWorldProfileLoader`, `FHLegacyCombatBridge`,
`FHMultimodeSaveIdentity` o `FHMultimodeResourceReader`, tanto en main como en
el árbol candidato. Esto confirma preparación externa, no conexión al juego.

Los manifiestos oficiales `legacy`, `dnd` y `moon-system` siguen `planned`.
Una comprobación propia con selector/validador reales devuelve
`RULESET_NOT_IMPLEMENTED` para los tres antes del cargador, con cero llamadas
a este. `prepare(null)` mantiene el retorno Legacy sin invocar dependencias,
como confirman las suites. **No se habilitó DnD/Moon para sortear A1/A2/B1.**

## 7. Pruebas ejecutadas por esta auditoría

Se usó Node `v24.22.1`, sin instalar dependencias. TMPDIR se fijó dentro del
workspace para fixtures, pues el entorno carece de `/tmp`. La rama documental
de main no recibió módulos ni tests nuevos.

**Main, comando focalizado:**

```sh
TMPDIR="$PWD" node --test tests/mode-session.test.cjs tests/world-profile-loader.test.cjs tests/legacy-combat-bridge.test.cjs tests/multimode-architecture.test.cjs juego/assets/fh-shadow-ai.test.js juego/assets/fh-survival-core.test.js
node contratos/multimodo/validar-contratos.mjs
timeout 180s node --test --test-reporter=spec juego/assets/fh-preview-boot.test.js
```

| Comprobación propia | Estado de prueba | Resultado |
| --- | --- | --- |
| Suites focalizadas disponibles en main | PASS | 83/83, salida 0, 0 fallos/cancelaciones/omitidos/TODO; 2.507,02 ms. |
| Contratos canónicos en main | PASS | 846 aserciones; 3 mundos, 3 reglamentos y 9 combinaciones estructurales. |
| Arranque completo en main, presupuesto 180 s | PASS | 19/19, salida 0, sin fallos/cancelaciones/omitidos/TODO; **134.376,48 ms**. Es Node/VM, no sesión WebGL. |
| Ejecutar las dos suites IA 5 directamente desde main | FAIL por entrega ausente | Salida 1: `Could not find 'tests/multimode-runtime.test.cjs, tests/multimode-compatibility.test.cjs'`. Confirma A3, no un fallo de aserción. |
| Sondas de B1/persistencia y presencia de módulos en motor | PASS de reproducción | Confirman las limitaciones descritas en §§3–4 y la ausencia de instalación. Un PASS de reproducción no cierra el hallazgo. |

**Árbol candidato contrastado:** `b003c211eb49c7931d1ba09394d2b5853b69fb97`.
Es un checkout de revisión con fuentes/tests de #206–#209, no una fusión en
main. Los nueve blobs relevantes se compararon uno a uno con sus heads remotos
y coincidieron. No se escribió código funcional para componerlo.

```sh
TMPDIR="$PWD" node --test tests/multimode-save-isolation.test.cjs tests/multimode-resource-reader.test.cjs tests/legacy-combat-integration.test.cjs tests/multimode-runtime.test.cjs tests/multimode-compatibility.test.cjs tests/mode-session.test.cjs tests/world-profile-loader.test.cjs tests/legacy-combat-bridge.test.cjs
```

**PASS limitado:** 108 aprobadas, 0 fallidas, 0 canceladas/omitidas y **1 TODO**,
total 109 enumeradas; salida 0, 14.256,45 ms. El TODO es la conexión real de A1,
no un caso aprobado. Estas pruebas no certifican gameplay DnD/Moon, persistencia
instalada ni una publicación web con el lector nuevo.

## 8. A4: conclusión de arranque y navegador

La ejecución propia completa de 134,38 s confirma que la suite puede terminar;
no se reprodujo un deadlock permanente. #210 conserva el TIMEOUT anterior a
40 s (salida 124), resultados completos de 88,45/115,96 s y un perfil CPU
centrado en el ensamblado repetido. No se vuelve a presentar ese timeout como
PASS ni como regresión causada por Etapa 2. Los tiempos varían por ejecución
y carga del entorno; no constituyen un benchmark de rendimiento del juego.

El reporte #210 documenta un intento de navegador que llega al mapa/personaje
Legacy y falla con `Error creating WebGL context`, además de restricciones de
sockets al lanzar Chromium local. **Esta auditoría no repitió el navegador ni
verificó el SHA de esa publicación**: sesión jugable Legacy, movimiento,
interacción, ataque y guardado/restauración real quedan **NO VERIFICADOS** aquí.
Ese límite es separado de la suite Node ya completada y no acredita una
regresión nueva. No se alteraron tests o producción para reducir el tiempo.

## 9. Condiciones de reconsideración y alcance exclusivo

Antes de cerrar integralmente: incorporar las suites a la rama destino y
verificarla; exponer y probar la ruta única real de combate/costes; instalar
aislamiento de IO/restauración/sincronización en padre e iframe; conectar el
lector concreto bajo su modelo de confianza; acreditar una sesión Legacy
jugable en WebGL operativo. Mantener DnD/Moon bloqueados hasta adaptadores
funcionales y evidencias correspondientes. B2 puede resolverse en una tarea
acotada del validador, sin duplicar esquemas.

**Único archivo de esta entrega:** `docs/ETAPA2_AUDITORIA_CORRECTIVA_FINAL.md`.
No se modificó código funcional, tests, index/iframe/Base64, hooks, mapas,
esquemas, manifiestos, claves/partidas, dependencias o workflows. No se fusionó
ningún PR. **Dictamen final: NEEDS WORK por A1/A2 P1 aún pendientes.**
