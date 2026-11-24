# Tiempo de D&D

En la ficha del jugador, **Tiempo D&D** permite elegir exploración o rondas.
El reloj se guarda en `GameState.clock`, junto con fecha y fracciones de minuto.
`dndTime` añade únicamente versión, modo y número de ronda al guardado v1.

| Operación | Exploración | Rondas |
| --- | --- | --- |
| Quedarse quieto, abrir menús o cerrar el navegador | 0 | 0 |
| Caminar | Distancia aceptada por las colisiones, según velocidad de ficha | Incluido en la ronda |
| Escaleras | Distancia horizontal y vertical del recorrido | Incluido en la ronda |
| Puerta, interacción realizada, combustible o ataque resuelto | 6 segundos | Incluido en la ronda |
| Intento bloqueado o ataque fuera de alcance | 0 | 0 |
| Tirada de habilidad o salvación por sí sola | 0 | 0 |
| Cerrar ronda | No disponible | 6 segundos para la ronda completa |
| Esperar 1/10 minutos o avanzar 1/8 horas | Duración elegida | No disponible |

Caminar 30 pies con velocidad 30 equivale a 6 segundos ficticios. Chocar con
una pared no consume distancia; deslizarse a lo largo de ella cuenta solamente
el trayecto aceptado. La corriente automática y las reubicaciones de seguridad
no se cobran como caminata. Los controles de ronda llevan el tiempo; no añaden
iniciativa ni restricciones de acciones o desplazamiento al combate existente.

Los 6 segundos de una interacción en exploración son una convención del juego.
Para búsquedas, conversaciones o tareas de mayor duración, se avanza el tiempo
acordado con los controles. La referencia de rondas y movimiento es
[Playing the Game, reglas 2024](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game).

Las antorchas mantienen sus 60 minutos de combustible; ahora son minutos del
mundo, sin el avance automático de un minuto por segundo real. El consumo se
sincroniza antes y después de cada avance, incluso antes del primer fotograma,
y se guarda junto al reloj. Clima y luz solar leen ese mismo calendario.

Avanzar horas sirve para contabilizar esperas y descansos. No concede curación,
dados de golpe, espacios de conjuro ni otros recursos automáticamente. El sueño
visual de una cama tampoco acelera el reloj D&D.

Las salas actuales ejecutan movimientos y acciones de forma independiente por
jugador. Estos controles afectan la partida local; no introducen autoridad del
DM ni sincronización de reloj en red. No se modificaron la API de salas, las
colisiones, la visibilidad, los tejados ni el ritmo acelerado de Legacy/Blakpine.

## Verificación

`node --test tests/dnd-clock.test.cjs` prueba distancia, inactividad, rondas,
combustible, calendario, migración/guardado, ataques y el motor 3D ensamblado.
Las pruebas existentes de `fh-game-clock.test.js` verifican el ritmo Legacy.
La interfaz también se comprobó con DOM real: botones, segundos, cambio de
modo, bloqueo de esperas durante rondas y extinción tras avanzar ocho horas.
