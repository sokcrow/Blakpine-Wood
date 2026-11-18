# ORDEN DEL DIRECTOR — Corrección DnD tras Etapa 3.4

**Repositorio:** `sokcrow/Blakpine-Wood` — **modo exclusivo:** `dnd`  
**Documento rector:** [PLANO_DIRECTOR_MULTIMODO_MAPAS_REGLAMENTOS.md](./PLANO_DIRECTOR_MULTIMODO_MAPAS_REGLAMENTOS.md).

## Error que no debe repetirse

La primera versión DnD usaba **1 energía por ataque** y una espera de **1 minuto del mundo**. Eso fue importar una economía de recursos/tiempo ajena al reglamento. Que DnD use las mismas Sombras, colisiones y mapa 3D no significa que herede PE, cooldown o fórmulas de Legacy.

## Trabajo ejecutado en esta entrega

1. Ataques básicos DnD del jugador y de criaturas: `cost: 0` al acertar o fallar.
2. Se elimina bloqueo por energía, incluso en guardados DnD v1 con `energy=0` y `energyCost=1`.
3. Se elimina cooldown artificial de **1 minuto** del ataque del jugador.
4. Se retira energía del texto y del bloqueo del botón del HUD DnD.
5. El coordinador conserva `actionId`, revisión y validación de autorización, y solo permite una aplicación por acción.
6. Campos `energy`, `maxEnergy`, `energyCost` y `lastPlayerMinute` se conservan en el estado DnD **por compatibilidad de guardados v1**, no como mecánicas activas del ataque normal.
7. Legacy conserva sus PE y reglas; Moon no se modifica; el motor compartido de Sombras mantiene detección, contacto y movimiento.

## Límite técnico importante — no declararlo completado

**DnD aún NO posee controlador de iniciativa, rondas y acciones por turno.** Quitar un cooldown incorrecto no lo crea, y los ataques pueden seguir ejecutándose mientras el objetivo esté disponible. Por tanto, **esta entrega no se debe describir como combate DnD completo ni conforme a una edición concreta**.

### Siguiente orden independiente (requiere que el Director defina la edición)

- Especificar edición/libros o contrato propio aprobado.
- Estado de encuentro, participantes, iniciativa y orden de turnos.
- Acción, acción adicional, reacción y movimiento, según la edición seleccionada.
- Decisión de IA en su turno incluso si el jugador permanece inmóvil.
- Reconexión de Sombras sin duplicar pathfinding, colisión ni visión.
- Persistencia de ronda, estado de acciones y migración v1.
- HUD de turno y pruebas de integración del runtime Three.js.

**Prohibido** suplir cualquier vacío con una barra de PE Legacy, cooldown por minuto, críticos u otra regla que no haya autorizado el Director.

## Otra tarea, otro propietario: mundo medieval

La demo empleada inicialmente para conectar DnD es **moderna**. Eso **no** implica que DnD permita electricidad convencional ni que esté implementado el filtro de catálogo. La siguiente tarea de mapa debe crear perfiles autorizados (medieval por defecto; Eberron magitecnológico opcional), validar assets y conservar `forest-horror-map-v1`.

## Criterios de aceptación inmediatos

- Ataque DnD (acierto y fallo) produce `cost===0`.
- Ataque DnD funciona aun con `energy===0` en un estado v1.
- El ataque del jugador ya no consulta `lastPlayerMinute` para bloquear.
- El HUD DnD deja de mostrar energía como recurso de ataque.
- La misma `actionId` no puede volver a aplicar daño.
- Sombras continúan usando la colisión/contacto existente.
- Ninguna fórmula o recurso Legacy ha cambiado; Moon permanece en su estado previo.
- La documentación reconoce lo que falta implementar.

## Entrega obligatoria

Modificar código en GitHub, PR/commit contra `main`, indicar estado de fusión, pruebas ejecutadas realmente y pruebas pendientes; no instaladores, no workflows como bloqueo, no afirmar WebGL validado sin ejecutarlo.
