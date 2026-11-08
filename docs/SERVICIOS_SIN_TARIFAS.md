# Blakpine-Wood — Redes y servicios (sin tarifas)

## Alcance de esta rama
Se agregan las conexiones y medidores necesarios para configurar tarifas más adelante; **no hay precios, cargos ni facturas**.

El mapa sigue utilizando `forest-horror-map-v1`, con propiedades opcionales en cada objeto. Los muebles existentes sin propiedades `service` conservan el comportamiento anterior.

## En el editor

- **Electricidad:** coloca un `breaker_panel`, asigna su circuito y coloca `power_outlet`. Un enchufe tiene dos slots y una capacidad total configurable en rayos; un `power_strip` ocupa un slot del enchufe y distribuye más conexiones, sin ampliar la capacidad original. `phone_charger` y `router` deben alcanzar una toma libre.
- **Agua:** coloca `water_main` y `water_outlet` sobre paredes conectadas. Configura `water_valve` con el mismo `networkId` que la toma, o indica `valveId` en la toma. `drain_outlet` recibe el agua residual si está cerca.
- **Redes:** configura `router`, contraseña Wi-Fi, rango en pies, `ethernet_port` y `landline_phone` con `routerId`. Los cables Ethernet tienen una longitud máxima configurable.
- **Objetos de uso:** en su inspector activa `service.requiresPower` y/o `service.requiresWater`. Configura `service.rayos`, `service.watts`, `service.flowLpm`, `service.waterMode` y/o `service.litersPerUse`.

La red de suministro eléctrica e hidráulica se calcula siguiendo los tramos de pared (esquinas, intersecciones y bifurcaciones); la conexión corta de los muebles no atraviesa paredes.

## Gameplay

- Un objeto sin alimentación no puede usar su acción dependiente de electricidad. Los objetos anteriores siguen usando sus reglas heredadas.
- La sobrecarga deteriora gradualmente enchufes y regletas; un conector con daño de 100 deja de funcionar.
- El Wi-Fi requiere contraseña y alcance; suspender Internet corta la conectividad sin apagar la energía del router.
- La telefonía fija depende de su router y su contrato. La telefonía móvil tiene contrato y cobertura independientes del Wi-Fi.
- El celular se coloca físicamente en el cargador y desaparece completamente su menú hasta recuperarlo. Sin electricidad conserva la batería y detiene la carga.
- El agua de una toma se contabiliza solo cuando se usa: modo `pulse` por litros o `continuous` por minutos mientras está abierta.

## Estado persistente del juego
`GameState.services` almacena `contracts`, `damage`, `enabled`, `wifiKeys`, `usage`, `calls` y `meters` (kWh, litros de agua limpia y litros drenados). `GameState.phone` almacena `battery`, `placedAt` y `placedFloor`.

`contracts` acepta `active` / `suspended`, pero no procesa pagos. El siguiente módulo económico podrá leer medidores e incorporar las tarifas en dólares, su periodicidad y facturas sin reescribir los conectores.

## Pruebas
```bash
node --test tests/fh-services-core.test.js
```

**Pendiente de prueba visual en navegador:** editor y gameplay 3D, especialmente 844×390 en horizontal y 1280×720. No considerar esta rama lista para fusionar sin esas capturas y un recorrido real de las interacciones.
