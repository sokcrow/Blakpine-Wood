# Portal central — Etapa 4.1

Estado: **NEEDS WORK para aceptación real**. La implementación y las pruebas locales de PostgreSQL están disponibles. No hay proyecto Supabase autorizado ni cuentas reales de prueba conectadas. No confundir los fixtures de navegador o SQL con autenticación real, ni fusionar por esos resultados solamente.

## Entrada y conservación

La raíz dirige a `portal/`. `index.html?editor=1` abre el editor original en la misma ruta y origen. Solo se añade un script de entrada al `<head>`; no se mueven su código, assets o almacenamiento. `juego/` sigue disponible. No hay migración, lectura ni escritura de guardados Legacy desde el portal. Los cuatro tests de navegador existentes que abren la raíz usan ahora el parámetro del editor.

La dirección visual propuesta para el portal usa fondo oscuro de bosque, tipografía serif del sistema para títulos, texto marfil y controles rectos con foco visible. No cambia el HUD del juego. Las comprobaciones automáticas de navegador cubren navegación y desbordamiento móvil/escritorio. La revisión visual y accesible manual debe completarse antes de aprobar producción.

## Integración elegida: Supabase

Se usa el SDK oficial `@supabase/supabase-js`, fijado en el lockfile y empaquetado en `portal/vendor/`, para registro, confirmación por correo, login, logout y renovación de tokens. El bundle se sirve localmente desde GitHub Pages; es la única dependencia del producto. Esbuild, Playwright y PGlite son dependencias de desarrollo. Los textos se centralizan en `portal/strings.js`.

`portal/config.js` admite únicamente la URL y clave pública publicable del proyecto aprobado. Está vacío intencionalmente hasta conectar el servicio real. No se permite una clave `service_role`, `sb_secret_`, contraseña de base de datos o token administrativo en este archivo, en los commits o en la web. Las cuentas de prueba se reciben por variables del entorno privado, nunca por el código. No se solicita pegar secretos en una conversación.

Para completar esta entrega, el agente necesita acceso al proyecto Supabase elegido. Debe aplicar `supabase/migrations/202611190001_portal.sql`, configurar correo/contraseñas y la URL de retorno del portal entre las URLs permitidas de Auth, publicar únicamente la configuración pública y ejecutar la aceptación. La URL de retorno debe apuntar a `/Blakpine-Wood/portal/` en GitHub Pages (o al dominio autorizado). La confirmación de correo no se deshabilita para aparentar una prueba exitosa. El esquema `public` debe estar expuesto en Data API; `bw_private` no debe exponerse.

Referencias técnicas primarias: [Auth](https://supabase.com/docs/guides/auth), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [funciones y permisos](https://supabase.com/docs/guides/database/functions).

## Datos y autorización

- `bw_campaigns`: UUID interno, propietario obtenido de `auth.uid()`, nombre, reglamento, estado, creación y actualización. Creación habilitada solo para `legacy` y `dnd`.
- `bw_memberships`: clave campaña/cuenta, estado activo o expulsado y fechas. Una expulsión conserva la identidad y bloquea todas las invitaciones de esa campaña. No se implementa readmisión.
- `bw_invitations`: UUID propio, hash SHA-256 del código, fechas de creación, caducidad y revocación. El código usa 24 bytes criptográficos del servidor (192 bits), se muestra una sola vez y caduca a los siete días.
- Las tablas tienen RLS; no hay escrituras directas para `anon` o `authenticated`. La tabla de invitaciones tampoco tiene lectura directa. Su RPC de listado solo devuelve metadatos al DM.
- Las RPC con privilegios elevados fijan `search_path=''`, verifican la identidad y el propietario en servidor, y se conceden exclusivamente a `authenticated`. No aceptan un ID de propietario del navegador. Los helpers privados consultan la identidad real del JWT.
- Ingresar, expulsar, generar y revocar serializan sus mutaciones bloqueando primero la campaña. El ingreso revalida el código después del bloqueo. Revocar un código no elimina membresías ya existentes. Una cuenta expulsada pierde acceso por RLS aunque mantenga un token válido.
- El panel consulta miembros al abrir o actualizar; no implementa presencia, sondeo o Realtime. Una pantalla ya abierta puede mostrar datos consultados anteriormente hasta actualizar. Toda nueva solicitud se autoriza de nuevo en el servidor.

Las campañas archivadas se conservan visibles para sus miembros, pero no admiten nuevos ingresos ni invitaciones. Todavía no se ofrece edición de estado en la interfaz.

## Reglamentos y límites

Blakpine Wood conserva su editor y Probar 3D. DnD se presenta como prototipo D20 con Training Dummy y guardado propio: no se anuncia una edición o reglamento completo. Moon System permanece visible, deshabilitado en interfaz y rechazado por la RPC de creación. No se implementan sincronización 3D, servidores de juego, mundos compartidos ni cambios en adaptadores de combate.

## Pruebas

- `npm run test:portal`: PostgreSQL real mediante PGlite + pgcrypto, RLS, privilegios, invitaciones, miembros persistentes y expulsión. **10/10 PASS ejecutados localmente y en CI**. La función `auth.uid()` y las identidades son fixtures de prueba, no Supabase Auth real.
- `npm run test:portal:browser`: navegador con SDK oficial y transporte interceptado exclusivamente en el test. Comprueba pantallas, envío de operaciones, navegación, móvil/escritorio, preservación del editor y estados. No acredita el registro real. **PASS en GitHub Actions**: entrada, servicio inactivo, editor/almacenamiento y todo el contrato UI con fixtures.
- `.github/workflows/portal.yml`: bundle reproducible, SQL, navegador, layout del editor y regresión de Legacy. Chromium no puede arrancar en el sandbox local (`socket() ... Operation not permitted`); se usa CI para comprobar el navegador.
- `npm run test:portal:live`: prueba sin mocks contra el proyecto y dos cuentas autorizadas, usando solo clave pública y credenciales de esas cuentas en variables privadas. Falla con salida 2 cuando faltan, sin mostrar secretos.
- Para la fase de registro del runner se usan dos correos nuevos controlados por el equipo y `BW_REGISTER_TEST_ACCOUNTS=1`; Auth debe aceptar ambas altas. Con confirmación de correo activa, el equipo confirma esos correos y después se ejecuta la fase de acceso sin esa variable. Esa segunda fase verifica creación, ingreso, relogin de ambos, permisos, revocación, expulsión y rechazo por código. La prueba deja su campaña de aceptación y el historial de expulsión; no altera partidas Legacy.
- Variables del runner real: `BW_SUPABASE_URL`, `BW_SUPABASE_PUBLISHABLE_KEY`, `BW_DM_EMAIL`, `BW_DM_PASSWORD`, `BW_MEMBER_EMAIL`, `BW_MEMBER_PASSWORD`. No se incluyen valores de ejemplo ni cuentas inventadas.

La aceptación final exige además repetir el recorrido real en la interfaz con dos contextos de navegador y comprobar Probar 3D. No fusionar a `main` sin esa evidencia.

También se ejecutaron localmente y en CI **64/64 PASS** de regresión Legacy y guardados (cinco archivos de la CI) y **14/14 PASS** de layout del editor. `npm audit --omit=dev --audit-level=high` no encontró vulnerabilidades.

El test amplio `editor-responsive-browser.cjs` falla en CI al seleccionar un objeto (`selection=null`, línea 134 del recorrido). El portal sí abre el editor, encuentra su lienzo y conserva el centinela de almacenamiento en su prueba de navegador. La reproducción en CI con el HTML original de `main` también falla en la misma aserción (línea 134): es un fallo previo en ese recorrido bajo Chromium de CI. No se presenta el test amplio como aprobado ni se oculta su salida roja. Evidencia: [ejecución comparativa](https://github.com/sokcrow/Blakpine-Wood/actions/runs/44504451645).

## Regresión inicial observada

En `b89b48b`, antes de este cambio, dos pruebas fallan con `SAVE_ENGINE_HOOK_MISMATCH`: la integración real en `tests/dnd-combat.test.cjs` y `tests/multimode-save-engine-hook.test.cjs`. Se reprodujeron en un worktree limpio del mismo commit de `main`. La selección de ocho archivos de regresión dio 87 PASS / 2 FAIL tanto atribuibles a esos dos casos preexistentes. No se modifica el hook ni los motores para resolverlos dentro de esta etapa.

Comprobación adicional: eliminando únicamente las dos líneas de entrada nuevas, el HTML del editor coincide exactamente con `main`. `git diff main -- juego forest-horror contratos` está vacío. La revisión de corrección y seguridad y la de arquitectura se completaron sin introducir cambios en sistemas ajenos; la aceptación de producción sigue pendiente del backend y las cuentas reales.
