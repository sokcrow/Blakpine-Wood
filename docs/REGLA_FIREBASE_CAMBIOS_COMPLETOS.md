# Regla: Firebase forma parte de cada cambio

Instrucción del usuario del 20 de noviembre de 2026 para Horror / Blakpine-Wood.

Cuando una función o corrección requiera permisos o validaciones de Firebase, se deben actualizar en la misma entrega las reglas y los índices necesarios. No esperar a que el usuario descubra un error de acceso o una consulta que no carga.

1. Revisar las lecturas y escrituras reales de la función antes de modificar permisos.
2. Incluir `firestore.rules`, `firestore.indexes.json` y `firebase.json` cuando corresponda. No ampliar acceso a rutas o usuarios ajenos al cambio.
3. Validar creación y actualización, propietario, membresía/rol, tipos y límites. Ejecutar pruebas de reglas con el emulador cuando sea viable.
4. Aplicar los cambios al proyecto Firebase autorizado cuando exista acceso y verificar su resultado. Un commit de reglas no equivale a despliegue.
5. Si falta autenticación, una aprobación nativa o acceso de despliegue, continuar el código y las pruebas autorizados, entregar el commit/PR y explicar qué quedó bloqueado. No afirmar que Firebase está actualizado.
6. Mantener la entrega en GitHub, sin instaladores de parches, workflows nuevos ni cambios manuales de código encargados al usuario.
