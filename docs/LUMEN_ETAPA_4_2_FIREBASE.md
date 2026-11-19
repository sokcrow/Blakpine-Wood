# LUMEN — Etapa 4.2 · Firebase Authentication y campañas

**Estado:** NEEDS WORK para aceptación en el proyecto real `rol-serv`. El código del portal, las reglas de Firestore y las pruebas estructurales están en la rama del PR #219; no se ha desplegado Firebase desde este entorno y falta el `firebaseConfig` exacto de «LUMEN Web». **No se afirma que dos cuentas reales hayan usado el sistema**.

## Qué integra

- **Entrada:** `index.html` deriva a `portal/`; `index.html?editor=1` mantiene el editor íntegro en la misma URL, origen y almacenamiento. `juego/index.html` conserva su enlace al editor añadiendo `?editor=1` en la redirección, sin ejecutar el portal accidentalmente.
- **Identidad:** SDK modular oficial Firebase JS 13.3.0 por CDN Firebase; registro por correo y contraseña, envío de verificación, inicio/cierre de sesión y recuperación de contraseña. El SDK conserva la sesión del usuario; no se escribe ninguna contraseña en Firestore.
- **Campañas:** `campaigns/{campaignId}` con ID automático Firestore, DM `ownerId`, nombre, reglamento (`legacy` o `dnd` provisional), estado y fechas. Moon no se puede crear.
- **Membresías:** `campaigns/{campaignId}/members/{userId}` estable por UID. Crear como DM añade el registro del dueño en un solo `writeBatch`; ingresar como jugador usa `runTransaction`. El documento permanece y, si se expulsa, pasa a `removed`. No se elimina: ningún código permite readmisión accidental.
- **Invitaciones:** `invitations/{code}`, 24 bytes criptográficos (192 bits), código hexadecimal independiente del ID de campaña. Una invitación se puede reutilizar por usuarios distintos mientras esté vigente, dura como máximo siete días y el DM puede revocarla. El código se almacena como ID legible **en la base, protegido contra listados ajenos**; no es un hash de secreto. El portador del código conoce el ID de campaña antes de unirse pero no puede leer su información privada.
- **Mis partidas:** campañas propias consultadas por `ownerId`; campañas ajenas por `collectionGroup('members')` filtrando el UID autenticado. Se requiere el índice `firestore.indexes.json`.
- **Panel DM:** miembros activos y expulsados, crear/revocar invitaciones y expulsar. El cliente no tiene permiso para escribir roles, borrar membresías ni elevarse a DM.
- **Sala:** muestra membresía y estado de desarrollo. **Todavía no inicia 3D compartido ni aloja host**.

## Autoridad y reglas

`firestore.rules` es la fuente de autorización en infraestructura Firebase. No depende de botones ocultos en el navegador.

1. Negación de lecturas y escrituras por defecto, incluidas rutas no reconocidas.
2. La creación fija `ownerId=request.auth.uid`, datos mínimos y timestamps de servidor.
3. Los miembros solo leen campañas con membresía `active`; el DM las consulta por propiedad. La lectura y listado de membresías tienen límites distintos.
4. Para unirse, el servidor verifica código con longitud/formato, existencia del documento de invitación, campaña coincidente, no revocación, caducidad y campaña activa **en el commit**. El ID de membresía es el UID; la primera creación es atómica y un intento repetido no crea duplicados.
5. Solo `ownerId` puede expulsar a otra cuenta, cambiando únicamente `status` y `removedAt`; no se permite borrar el historial. El DM no puede expulsarse a sí mismo.
6. Solo el DM puede crear invitaciones de su campaña o revocarlas. Los usuarios autenticados pueden hacer `get` de una invitación **si conocen exactamente el código de 192 bits**, no listar códigos de otras campañas.
7. No hay reglas genéricas que permitan a cualquier usuario modificar permisos o campañas ajenas.

**Decisión sobre Cloud Functions:** el ingreso, la revocación y la expulsión están limitados mediante Firestore Security Rules, no requieren un proceso de Admin SDK. Por eso **esta propuesta no exige facturación Blaze** exclusivamente para estas operaciones. Una Cloud Function o backend autoritativo será necesario si se agregan cuotas globales, códigos consumibles, auditoría de eventos inalterable o lógica secreta. Cloud Functions para Firebase exige Blaze para desplegarse según la documentación oficial.

## Configuración del proyecto real (pendiente)

1. Abrir Firebase Console → **rol-serv → Configuración del proyecto → Tus aplicaciones → LUMEN Web**, y obtener el `firebaseConfig` **exacto**.
2. Publicar únicamente los campos públicos en `portal/config.js`: `apiKey`, `authDomain`, `projectId: 'rol-serv'`, `appId`, `messagingSenderId`. Los valores están vacíos salvo el ID que proporcionó el Director; hasta completarlos, el registro queda inactivo y lo comunica la UI. No inventar valores.
3. Desplegar en **Cloud Firestore** las reglas y el índice del repositorio, asociados al proyecto `rol-serv`. Firestore ya está en modo producción, pero **no se ha comprobado qué reglas están publicadas**.
4. Configurar Firebase Authentication → Settings → **Authorized domains**: `sokcrow.github.io` si se sirve desde GitHub Pages, y cualquier dominio personalizado realmente usado. La lista debe incluir también `localhost` **solo** para pruebas locales autorizadas. Comprobar que el dominio `authDomain` sea exactamente el indicado por Firebase Console.
5. Firebase Hosting es opcional en esta etapa. GitHub Pages puede servir el HTML estático, pero un sitio `file://` no es una prueba válida de Auth/Firestore.
6. Verificar el flujo por navegador con dos cuentas **reales** controladas por el equipo, sin mocks, y comprobar las reglas publicadas con el Firestore Emulator antes de producción.

## Pruebas y aceptación

`node --test tests/lumen-portal.test.cjs` comprueba la generación/normalización de códigos criptográficos, que Moon sigue bloqueado, validación pura, estructura básica de reglas, configuración pública y ruta del editor. **No sustituye** la evaluación del intérprete de Firestore Rules, el despliegue de índices ni las pruebas con dos cuentas reales.

Aceptación real **aún no ejecutada**:

- A se registra y accede con Firebase Authentication.
- A crea una campaña; B accede desde otra cuenta y la encuentra mediante código.
- B cierra sesión, reingresa y mantiene membresía.
- B no puede expulsar, revocar invitaciones, cambiar `ownerId` o leer campañas ajenas.
- A expulsa B; B no puede recuperar la membresía ni con un código nuevo.
- A revoca otra invitación; ningún usuario nuevo puede entrar con ella.
- Solicitudes repetidas no duplican documentos de membresía.
- Se preservan editor, Probar 3D, esquemas `forest-horror-map-v1`, guardados Legacy y adaptadores DnD/Moon.

## Límites

Sin simulación DM-host, sincronización 3D, WebRTC, persistencia multijugador ni deployment Firebase. No hay contraseñas ni secretos de cuenta de servicio en el repositorio. La seguridad final depende de **las mismas reglas publicadas en el proyecto real**; publicar únicamente el cliente y dejar la base con políticas antiguas no cumple el objetivo.

## Archivos de alcance

`portal/app.js`, `portal/config.js`, `portal/campaign-model.js`, `portal/index.html`, `portal/strings.js`, `firestore.rules`, `firestore.indexes.json`, `firebase.json`, `.firebaserc`, `tests/lumen-portal.test.cjs`; se conserva el arranque `portal/entry.js` del PR #219. Se eliminan artefactos y pruebas específicos del proveedor Supabase para no mantener dos sistemas paralelos. No tocar el motor ni los modos.

