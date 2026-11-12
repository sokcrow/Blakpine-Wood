# Blakpine-Wood — Agua potable 01 (PR #144)

## Alcance
Primera fase de la instalación hidráulica: **agua fría limpia/potable**.
No incluye calentamiento, presión física, bañarse, WC jugable, efectos de estado, economía ni animaciones.

## Flujo de suministro

1. `water_main` representa la entrada pública, activa solamente si el contrato de agua lo permite.
2. La cisterna `water_cistern` y el tinaco `water_tinaco` son reservas independientes, configurables en litros.
3. Con contrato activo, una reserva conectada a `water_main` se rellena según `fillLpm`, sin superar `capacityLiters`.
4. Las tomas `water_outlet` alcanzables por paredes conectadas reciben agua; los montantes entre pisos se crean **solo por alineación física** de paredes.
5. Cada consumidor debe tener una toma `water_outlet` cercana, sin pared que bloquee su conexión local.
6. Si el contrato se suspende, una reserva con litros puede seguir alimentando la instalación hasta agotarse.
7. Las `water_valve` cerradas cortan la red compatible. El suministro de otro edificio no se comparte si los IDs no coinciden.
8. El circuito de drenaje sigue independiente del suministro potable.

## Muebles existentes identificados

| Uso | Modelos | Red de esta fase |
|---|---|---|
| WC | `inodoro_clasico`, `inodoro_antiguo` | Fría |
| Lavabo | `lavabo_pedestal`, `lavabo_gabinete` | Fría |
| Fregadero | `fregadero_mueble` | Fría |
| Regadera | `regadera_pared`, `plato_ducha`, `cabina_ducha` | Fría |
| Bañera | `banera_clasica`, `banera_patas` | Fría |
| Mingitorio | `mingitorio_pared` | Fría |

Estos objetos reconocen el suministro; **no se activa ninguna interacción de higiene** en esta entrega.
Los muebles personalizados pueden usar `service.requiresWater=true`; ese campo sigue siendo opcional.
Decoración como espejo, toallero y botiquín no requiere agua.

## Activación y editor
- En el menú **Agua**, elegir directamente **Cisterna potable** o **Tinaco elevado**, igual que otras herramientas de colocación. También están en **Modelos de agua** como entradas visuales.
- En **Agua y drenaje → Modelos de agua**, habilitar **Red potable automática por paredes y pisos**.
- Crear `water_main`, `water_outlet`, cisterna y/o tinaco. Asignar `networkId` consistente (por ejemplo `main`).
- Configurar la capacidad, litros iniciales, llenado y longitud máxima de distribución de cada depósito.
- Cada toma ofrece `pipeVisibility`: `concealed` (empotrada, oculta en 3D) o `visible` (se dibuja tubería 3D).
- En el editor, la capa de agua permite consultar los recorridos y detectar tomas sin abastecimiento.
- `FHServicesRuntime.waterNetwork.diagnostics()` devuelve rutas, longitud fría en pies y reservas.

**Agua 03:** se verificó el ZIP original `Forest_Horror_Agua_03_Tinaco_y_Cisterna.zip` y su catálogo. La cisterna usa **8 × 5 × 4.5 pies** y el tinaco **4 × 4 × 6 pies**. El editor guarda los tipos nativos y sus identificadores reales de modelo (`cisterna_principal`, `tinaco_elevado`), sin reutilizar `misc`. La integración binaria de los GLB y miniaturas **todavía está pendiente de publicación en el repositorio**; mientras tanto el menú usa una miniatura de respaldo. No afirmar que la visualización GLB original funciona hasta subir y verificar esos assets.

## Formato de mapa y persistencia

Se mantiene `forest-horror-map-v1`. Nuevos campos optativos:
```json
{
  "plumbing": {"enabled": true, "pipeVisibility": "concealed"}
}
```

Los depósitos se colocan como elementos `water_cistern` / `water_tinaco` con `capacityLiters`, `initialLiters`, `fillLpm`, `networkId` y `rangeFt`.
Sus litros actuales viven en `GameState.services.waterTanks`, usando la clave `floorId:itemId`.
Un mapa antiguo sin depósitos ni `plumbing.enabled` conserva el comportamiento de la red preexistente.

## Pruebas
```bash
node --test juego/assets/fh-water-potable.test.js
node --test tests/fh-services-core.test.js
```

Se exige inspección visual en editor/juego (móvil y escritorio) antes de fusionar.

## No modificado
Reloj de sueño, baño/WC jugable, PS/PE, humor, economía, Hamazon, colisiones, FOW y sistema de energía existente.
