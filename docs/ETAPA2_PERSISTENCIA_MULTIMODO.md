# Etapa 2 — Identidad y aislamiento de partidas multimodo (A2)

**Responsable:** IA 2, persistencia multimodo. **Fecha:** 17 de noviembre de 2026.
**Base examinada:** `main`, `4e69a954150b2c9fa104fa26d827ec9eed3e955f`.

## Resultado y límite

Se incorpora `juego/core/fh-multimode-save-identity.js`, módulo puro que liga una
partida a mapa, personaje, reglamento, versión del estado y slot de guardado.
Genera una clave separada, valida sobres y exige validadores explícitos de
estado antes de serializar o devolver una restauración. No lee ni escribe
almacenamiento, no escucha mensajes y no modifica el motor ni sus guardados.

**A2 queda cubierto en el módulo aislado; la protección del juego en ejecución
sigue pendiente.** No se carga este módulo en padre o iframe, no se habilitan
DnD/Moon ni se anuncian adaptadores `implemented`. No hay migración, conversión
o exploración de partidas existentes. Las claves Legacy permanecen intactas:

- `blakpine_character_active_v1`: perfil activo Legacy.
- `fh_game_v1_<hash>`: progresión Legacy por mapa.

## Ruta real examinada

Las referencias corresponden al commit fijado. **B:n** es la línea de la base
del motor reconstruida solo en memoria a partir de `engine-00.js` a
`engine-12.js`; no se crea ni modifica un archivo decodificado. Se contrastó el
ensamblado con `tests/helpers/forest-engine.cjs` y la auditoría de integración.

| Contexto | Archivo / función | Comportamiento actual y riesgo |
| --- | --- | --- |
| Ambos | `index.html:1478–1479`, `ForestShared.gameSaveKey(project)`; copia en motor | Hash derivado de `createdAt` o título/IDs de pisos. No distingue personaje, reglas ni slot. No reutilizarlo como clave multimodo. |
| Padre, lectura inicial | `index.html:3398–3412`, `makeCurrent3DProject()` | Lee clave Legacy, filtra por personaje con `selectMapSave` y manda `__runtimeSave`/`__runtimeCharacter`. No verifica reglamento. |
| Iframe, lectura | B:2284–2296, `readGameSave(storage,key,backup)` | Intenta almacenamiento y luego backup; admite `{version:1,state:objeto}`. No discrimina reglamento ni identidad completa. |
| Iframe, restauración | B:2423–2426; `index.html:4857–4861` | Calcula `SAVE_KEY`, lee local/backup, filtra `characterId` y crea `GameState`; también mezcla personaje vivo. Filtro de personaje no aísla reglas. |
| Iframe, escritura | B:2298–2300, `writeGameSave`; B:2428–2430, `saveProgress` | Serializa `{version:1,state}`, escribe localmente **antes** de mandar `FOREST_GAMESTATE_SAVE`. El padre recibe copia aunque falle almacenamiento local. |
| Padre, recepción | `index.html:5179–5181,5203–5210`, listener `message` | Exige preview activo, `source` del iframe, clave Legacy y personaje; después escribe y sincroniza recursos/habilidades. No hay identidad/versionado multimodo. |
| Padre, sincronización | `juego/assets/fh-character-core.js:84–118` | `selectMapSave` admite versión 1 con mismo `characterId`; `syncResourcesFromSave` limita PG/SP/PE a máximos Legacy; `syncSkillsFromSave` normaliza habilidades Legacy. No deben recibir datos DnD/Moon. |
| Padre, muerte | `index.html:5189–5193`, `FOREST_CHARACTER_DEATH` | Llama a `markDead` del perfil Legacy. También necesita separación de sesión/reglamento para impedir contaminación por muerte. |

Proteger solo el receptor del padre no impide que el iframe ya haya sobrescrito
su almacenamiento. Proteger solo escritura no impide restaurar una partida
ajena. No usar el fallback Legacy cuando falte o falle un guardado multimodo.

## Contrato implementado

Script clásico: `FHMultimodeSaveIdentity`. CommonJS: `require(...)`.
Sin dependencias nuevas ni DOM, Three.js, eventos, reloj, RNG o acceso a disco.

```js
const guard = FHMultimodeSaveIdentity.create({
  identity: { mapId, characterId, rulesetId, rulesetVersion: 1, saveId },
  validateWorldState,   // (worldState, identity) => true exacto
  validateRulesetState // (rulesetData, identity) => true exacto
});
guard.key;             // clave derivada de TODA la identidad
guard.identity;        // copia inmutable ligada a la instancia
guard.pack(state);     // -> string JSON validado
guard.unpack(raw);     // string JSON -> sobre validado, copiado y congelado
guard.validate(value); // objeto -> sobre validado, copiado y congelado
```

El anfitrión proporciona la identidad **esperada de confianza**, nunca la deduce
del mismo archivo recibido para validarlo. La identidad no se puede cambiar
dentro de una instancia. Cambiarla exige otra instancia y una activación de
sesión independiente; no retargetear una promesa o mensaje pendiente.

| Campo | Significado y autoridad |
| --- | --- |
| `mapId` | Identidad estable del mapa, asignada por el anfitrión/cargador. No es el perfil de ambientación, título ni el hash Legacy. No se añade un campo obligatorio al mapa v1. |
| `characterId` | Identidad estable del personaje seleccionado. Compartir el ID no autoriza compartir estadísticas o escribir el perfil Legacy. |
| `rulesetId` | Solo `dnd` o `moon-system`, IDs exactos de los manifiestos actuales. `legacy`, alias `moon` y desconocidos se rechazan. |
| `rulesetVersion` | Versión del contrato de estado persistido; esta implementación admite únicamente el entero `1`. No equivale a la versión del manifiesto ni certifica reglas DnD/Moon jugables. Otra versión requiere soporte explícito posterior, no migración automática. |
| `saveId` | Identidad independiente del slot/partida; el anfitrión la asigna y conserva. Dos slots del mismo mapa/personaje/reglas no comparten clave. |

`mapId`, `characterId` y `saveId` son strings no vacíos, sin espacios exteriores.
No se convierten números, no se recortan ni normalizan IDs silenciosamente.
No hay `sessionId` durable: la sesión es una identidad efímera del transporte,
que ambos contextos tendrán que comprobar por separado al integrar el módulo.

Clave: `blakpine_multimode_save_v1:` seguida de
`encodeURIComponent(JSON.stringify([mapId,characterId,rulesetId,rulesetVersion,saveId]))`.
La tupla JSON evita colisiones por concatenación con separadores. No usa hashes,
no tiene el prefijo `fh_game_v1_` ni coincide con la clave del perfil Legacy.
No es cifrado ni autenticación; quien tenga acceso al almacenamiento puede
alterar datos. Cada lectura debe volver a validar el sobre y su estado.

### Sobre separado de Legacy

```js
{
  kind: 'blakpine-multimode-save',
  formatVersion: 1,
  identity: { mapId, characterId, rulesetId, rulesetVersion: 1, saveId },
  state: {
    world: { /* estado compartido autorizado por validateWorldState */ },
    rules: {
      rulesetId, rulesetVersion: 1,
      data: { /* estado exclusivo validado por validateRulesetState */ }
    }
  }
}
```

`formatVersion` versiona el sobre; `rulesetVersion` versiona el estado de reglas.
Se rechazan cambios de identidad, versión, claves extra, raíz/estado mal
formados o namespace de reglas diferente al ligado. No existe `version:1` en la
raíz: tanto el lector actual del iframe como `selectMapSave` rechazan este
sobre. Recíprocamente el módulo rechaza el sobre Legacy; no lo interpreta ni
lo convierte. Nunca envolver este sobre en `{version:1,state:...}` para pasarlo
a lectores Legacy.

Ambos validadores son obligatorios, síncronos y de confianza. Reciben copias
congeladas; solo `true` exacto aprueba. `false`, `undefined`, promesas o
excepciones rechazan; una promesa rechazada se maneja sin autorizarla. El
validador del mundo debe comprobar su esquema y referencias de personaje/mapa
si el estado las duplica. El de reglas debe comprobar campos, tipos, rangos,
versión y semántica de ese reglamento. **Este módulo no inventa esos esquemas:**
sin validadores reales del dueño de estado no hay restauración válida en juego.
La etiqueta del reglamento por sí sola no demuestra compatibilidad semántica.

Solo se acepta JSON finito, con objetos simples y arrays densos. Se rechazan
ciclos, getters, símbolos, fechas, funciones, `undefined`, NaN/Infinity y
profundidad mayor de 100; no se silencian mediante `JSON.stringify`. Las copias
se congelan profundamente. Para cruzar contextos se transporta el string JSON y
se usa `unpack` en el contexto receptor, sin compartir referencias vivas.

Errores `SaveIdentityError`, con `.code` estable:

| Código | Motivo |
| --- | --- |
| `SAVE_IDENTITY_INVALID` | Forma/campos de identidad inválidos. |
| `SAVE_RULESET_UNKNOWN` | Reglamento fuera de la lista admitida. |
| `SAVE_RULESET_VERSION_UNSUPPORTED` | Versión de estado de reglas no soportada. |
| `SAVE_VALIDATORS_MISSING` | Faltan validadores explícitos. |
| `SAVE_JSON_INVALID` | JSON inválido o dato no representable admitido. |
| `SAVE_ENVELOPE_INVALID` | Forma/tipo de sobre incorrecto, incluido Legacy. |
| `SAVE_FORMAT_UNSUPPORTED` | Versión del sobre desconocida. |
| `SAVE_IDENTITY_MISMATCH` | Identidad diferente a la ligada al guard. |
| `SAVE_STATE_INCOMPATIBLE` | Estado o namespace inválido; validador no aprueba. |

Los errores de parseo/validadores conservan `.cause` cuando corresponde.
Son códigos internos; no se añaden textos a la interfaz del jugador.

## Integración pendiente: protección en ambos contextos

El motor no importa este módulo y su sistema actual sigue siendo Legacy.
Antes de habilitar una sesión DnD/Moon se deben completar **todos** estos puntos:

| Operación | Padre | Iframe |
| --- | --- | --- |
| Activación | Fijar mapa, personaje, reglas, versión, slot y generación de sesión antes de leer. Instanciar guard con validadores reales. | Recibir selección y sesión por canal autorizado, verificar origen/emisor y ligar su propio guard a las mismas identidades antes de arrancar runtimes o almacenamiento. |
| Lectura | Sustituir la ruta multimodo de `makeCurrent3DProject`: leer solo `guard.key`, pasar `unpack`, enviar copia validada. No usar perfil/partida Legacy como reserva. | Leer solo su clave multimodo y validar local y backup individualmente. Si falta o es inválida, error/partida nueva explícita; jamás caer en `readGameSave` Legacy. |
| Restauración | No inyectar `__runtimeCharacter` como mezcla universal de recursos Legacy. Separar identidad del perfil y estado privado de reglas. | Validar antes de `createGameState` o cualquier mezcla/asignación. Proyectar únicamente campos compartidos autorizados; el dueño de DnD/Moon restaura su namespace. No mezclar PG/SP/PE Legacy con reglas privadas. |
| Escritura | Validar identidad de sesión y `unpack` antes de `setItem`. Derivar la clave localmente desde el guard, no confiar en `message.key`. | `pack` y validar antes del **primer** `setItem`, no después de `postMessage`. Usar solo `guard.key`; no llamar `writeGameSave`/`saveProgress` Legacy para una sesión multimodo. |
| Sincronización | Canal multimodo separado; comprobar iframe, sesión/generación activa, identidad y versión. Nunca llamar `syncResourcesFromSave`, `syncSkillsFromSave`, `store` o `markDead` Legacy con datos de DnD/Moon. | Enviar sobre y sesión por canal definido; recibir confirmaciones solo del padre autorizado y de su sesión. Aislar muerte, habilidades y recursos en sus propietarios de reglas. |
| Cierre/cambio | Invalidar sesión y mensajes pendientes antes de cambiar personaje, mapa, reglas o slot. No adoptar identidad de un mensaje entrante. | Cancelar escrituras diferidas de la sesión cerrada. Crear otra instancia para otra identidad; no reusar callbacks antiguos. |

Las protecciones tienen que quedar antes de accesos locales **en ambos lados**.
La comprobación actual `event.source` sigue siendo necesaria, pero no reemplaza
sesión/generación e identidad. Una clave en el mensaje nunca autoriza escritura.
No se prescribe un mensaje como ya implementado ni se instala otro hook textual.

El módulo no implementa almacenamiento transaccional, orden de escrituras,
control de revisión, firma de mensajes ni resolución de conflictos entre pestañas.
La integración deberá serializar escrituras o rechazar mensajes obsoletos para
que una copia vieja no sobrescriba una nueva con la misma identidad. Aislar
identidades no garantiza frescura ni durabilidad. No se cambia ninguna clave
Legacy ni se migra contenido para resolver esos problemas.

## Pruebas y aceptación

`tests/multimode-save-isolation.test.cjs` prueba almacenamiento simulado por
`Map`, ambos reglamentos con el mismo mapa/personaje/slot, escritura y lectura
independientes, rechazo cruzado, claves Legacy intactas, cambios de identidad,
versiones, estados incompatibles, validadores ausentes/asíncronos, JSON inválido,
colisiones por separadores, copias inmutables y carga como script clásico.
También ejecuta el selector Legacy real y el lector real del iframe reconstruido
en memoria: rechazan el sobre multimodo. Las estadísticas de fixtures son
sintéticas; no representan adaptadores DnD/Moon terminados.

Las pruebas no equivalen a sesiones jugables, almacenamiento real del navegador
o protección ya conectada. Quedan pendientes pruebas padre/iframe de sesión,
lectura local/backup, escritura previa al mensaje, cierre/reapertura, sincronización,
muerte y mensajes obsoletos cuando se implemente esa integración.

Validación ejecutada:

```sh
node --test tests/multimode-save-isolation.test.cjs tests/mode-session.test.cjs tests/legacy-combat-bridge.test.cjs juego/assets/fh-character-core.test.js
node contratos/multimodo/validar-contratos.mjs
git diff --cached --check
```

**PASS:** 36 pruebas aprobadas, 0 fallidas, incluidas 9 de aislamiento nuevas;
846 aserciones estructurales del validador canónico aprobadas. Diff limitado a
los tres archivos asignados, sin errores de whitespace. No se ejecutó navegador
ni WebGL; no se afirma cierre de A2 en el juego en ejecución.

**Alcance del PR:** únicamente módulo, test y este documento. Sin cambios a
`index.html`, Base64, hooks, `FHCharacterCore`, coordinador, puente de combate,
mapas, manifiestos, estadísticas, claves/partidas Legacy o workflows.
