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

## Ampliación — infraestructura por paredes y Wi-Fi realista
- **Electricidad, agua limpia, drenaje y Ethernet** comparten FHServices.wallGraph. Su routeDetailed proporciona los tramos que representa el editor: troncales compartidas en vez de diagonales atravesando habitaciones.
- **Drenaje**: añadir drain_main en una pared y conectarlo a drain_outlet por recorrido físico y networkId. Sin salida principal no se mide agua evacuada. El suministro de agua continúa independiente.
- **Router**: roomId es la habitación de origen y assignedRoomIds permite extender Ethernet a otras habitaciones. propertyId activa el recorrido dentro de un polígono de propiedad existente, si el router está dentro. Una parcela no autoriza usar muros de otras propiedades; las propiedades solapadas se rechazan.
- **Longitud**: el cable Ethernet respeta ethernetLengthFt y el acceso del router a la pared respeta ethernetLeadFt; no existe conexión directa mágica por la habitación.
- **Wi-Fi**: la parcela nunca amplía la radio. wifiAt calcula distancia tridimensional, wifiRadiusFt y pérdidas por tipo de pared, puerta, ventana y pisos, expresadas en dBm. Expone tres barras y speedFactor, sin confundir cobertura con suscripción de Internet.
- **Celular**: la pantalla de redes muestra barras de intensidad y las aplicaciones online reciben una demora de carga proporcional a speedFactor. Las aplicaciones locales no dependen del Wi-Fi.
- **Repetidores**: quedan expresamente pendientes para otra entrega; no se han añadido.

Los coeficientes de propagación son parámetros de balance para el juego. El esquema sigue siendo forest-horror-map-v1. No hay tarifas ni facturas.

Pruebas: node --test juego/assets/fh-services-core.test.js y node --test juego/assets/fh-services-engine-hook.test.js.
