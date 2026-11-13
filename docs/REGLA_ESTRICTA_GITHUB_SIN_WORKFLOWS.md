# Blakpine-Wood — Regla estricta: entregas sin workflows ni espera del verde

**Obligatoria para todos los cambios del proyecto Horror / Blakpine-Wood.**

## 1. GitHub Actions
- Se retiran los workflows existentes de `.github/workflows/`.
- No crear workflows YAML nuevos para PR, funciones, parches, tests ni assets sin petición explícita del usuario.
- Las pruebas y generadores de recursos continúan como archivos de código del repositorio.
- Si se requieren GLB, miniaturas, texturas o recursos generados, incorporarlos al commit/PR sin depender de acciones que los publiquen después.

## 2. No esperar todos los checks verdes
- Publicar el commit o abrir el PR una vez implementado el alcance solicitado y realizadas las comprobaciones pertinentes que puedan ejecutarse.
- No esperar comprobaciones ajenas, pendientes o fallidas para «tener todo verde». No relanzar workflows solo para limpiar el tablero.
- No confundir commit/PR publicado con PR fusionado, cambio desplegado o funcionamiento verificado.
- Si GitHub impone realmente una protección de rama, permiso o bloqueo, reportarlo sin afirmar que se evitó.

## 3. Pruebas y calidad
- Ejecutar pruebas focalizadas cuando sea viable; conservar las pruebas automáticas existentes en el repositorio, aunque ya no corran por Actions.
- Una prueba relevante fallida exige informar el error y su riesgo. No ocultarlo ni calificar como PASS lo no comprobado.
- No usar la ejecución de una batería total de CI como requisito artificial para publicar.

## 4. Entrega obligatoria
- Cambios en código fuente y recursos del repositorio; entrega mediante **commit publicado en GitHub o Pull Request abierto**.
- No entregar instaladores locales, scripts de instalación de parches ni instrucciones para aplicar cambios manualmente.
- El informe final debe indicar el enlace al commit/PR, estado real, archivos modificados, comprobaciones realizadas y pendientes, y qué no se tocó.

## 5. Precedencia
Esta regla complementa las reglas de Forest Horror y la regla estricta de entregas en GitHub. Prevalece sobre cualquier costumbre previa de crear workflows para cada tarea o esperar a que todas las comprobaciones sean verdes. No autoriza saltar protecciones de GitHub ni esconder fallos.